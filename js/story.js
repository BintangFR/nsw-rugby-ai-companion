// Story tab: impact reports built from nine page templates (p1 cover … p9 appendix, plus a one-page media
// release), combined per report type as in "Impact_Report_Annotated_with_5_Report_Types". Every page is filled
// from live data; the narrative sentences have a rule-based draft that the AI can rewrite. All text is editable
// on the page, photos are added by clicking a photo slot, and the result prints to 16:9 PDF pages.
// Saved in Store 'story': { type, scopeKind, scopeValue, period, edits: {key: text}, photos: {slot: dataURL}, ai: {...} }.
(() => {
  const { $, $$, esc, money, toast } = window.App;
  const A = window.Analytics, D = window.TACKLE_DATA, O = window.Ollama;

  // ---------- report types (page 10 of the design: which pages each audience gets) ----------
  const TYPES = {
    board: { label: 'Board Summary', audience: 'NSW Rugby Board and executive', length: '4 pages · 5-minute read', pages: ['p2', 'exp', 'p6', 'p8'],
      changes: ['Only the overview, expenditure, regional reach and recap', 'Regional reach shows every region in neutral language', 'A "decisions for the Board" box on the recap'] },
    acquittal: { label: 'Funding Acquittal', audience: 'Office of Sport (funder)', length: '7 pages · formal and verifiable', pages: ['p1', 'p2', 'exp', 'p3', 'p5', 'p7', 'p9'],
      changes: ['An expenditure page shows grant vs actual expenditure', 'Page 5 keeps only indicators tied to grant targets', 'Full assumptions and the formula appendix', 'Declaration and sign-off'] },
    annual: { label: 'Annual Report Chapter', audience: 'Public, partners and members', length: '9+ pages · the full year', pages: ['p1', 'p2', 'exp', 'p3', 'p4', 'p5', 'p6', 'p8'],
      changes: ['Full structure, one chapter per pillar', 'Page 6 features one or two regions as case studies', 'Only completed valuations are shown'] },
    community: { label: 'Community Story', audience: 'Clubs, parents and local communities', length: '3 pages · people and stories', pages: ['p1', 'p4', 'p6'],
      changes: ['Led by photos and quotes', 'Page 6 told from the local view', 'No more than three numbers, no valuations or formulas'] },
    media: { label: 'Media Release', audience: 'Media and public', length: '1 page', pages: ['media'],
      changes: ['Headline, lead, three key figures, one quote, one photo', 'Only high-confidence figures', 'Must be approved by the communications team'] },
  };
  const PILLARS = { FE: { n: 1, name: 'Facilities & Equipment', short: 'Facilities' }, PW: { n: 3, name: 'Programs & Workforce', short: 'Workforce' }, INC: { n: 4, name: 'Inclusion', short: 'Inclusion' } };
  // Pillar statements, word for word from Dataset/Program Logic - NSW Rugby World Cup Legacy.docx (June 2025).
  const OBJECTIVE = {
    FE: 'Improving the places where people play Rugby and improving the development and safety of players across the game of Rugby in NSW.',
    PW: 'Increasing opportunities by enabling more people to get involved in Rugby as a player, coach, match official or administrator and increasing their access to development pathways.',
    INC: 'Rugby Australia and its Member Unions are striving to ensure that Rugby is a place where every individual feels valued and has the opportunity to participate.',
  };
  // Partner Meeting 1 slides (NSW Rugby Union).
  const ABOUT = 'NSW Rugby Union is the largest rugby member union in Australia, with 56% of Australia\'s rugby participants and more than 100,000 registered players across junior and senior programs. The $10 million NSW Rugby World Cup Legacy Program, funded by the NSW Government, invests in facilities, priority regions, programs and workforce, inclusion and Rugby World Cup activation.';

  // ---------- state ----------
  const blankState = () => ({ type: 'annual', scopeKind: 'program', scopeValue: '', period: '2025–26', edits: {}, photos: {}, ai: {} });
  let state = blankState();
  const save = () => Store.set('story', state);
  function load() {
    const s = Store.get('story');
    state = s && s.type && TYPES[s.type] ? { ...blankState(), ...s } : blankState(); // older free-text stories are not reused
  }

  // ---------- helpers ----------
  const M = v => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : money(v);
  const int = v => Math.round(v).toLocaleString('en-AU');
  const pct = v => `${(v * 100).toFixed(1)}%`;
  const today = () => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const results = () => Store.get('programs') || {};
  const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const ed = (key, def, tag = 'span', cls = '') => `<${tag} class="${cls}" data-edit="${key}" contenteditable="true">${esc(state.edits[key] ?? def)}</${tag}>`;
  const photo = (key, label, cls = '') => state.photos[key]
    ? `<div class="rp-photo has ${cls}" data-photo="${key}" style="background-image:url('${state.photos[key]}')"><span></span></div>`
    : `<div class="rp-photo ${cls}" data-photo="${key}"><span>${esc(label)}<br><small>Click to add a photo</small></span></div>`;

  // ---------- data model for the chosen scope ----------
  function model() {
    const P = window.Programs.programs();
    const rows = A.regionMetrics(), c = A.centralisation(rows);
    const { scopeKind: kind, scopeValue: val } = state;
    const scoped = kind === 'pillar' ? P.filter(p => p.pillar === val) : kind === 'region' ? P.filter(p => p.region === val) : kind === 'deliverable' ? P.filter(p => p.id === val) : P;
    const deliverable = kind === 'deliverable' ? P.find(p => p.id === val) : null;
    const scopeLabel = kind === 'pillar' ? `Pillar ${PILLARS[val]?.n} · ${PILLARS[val]?.name}` : kind === 'region' ? `${val} region` : kind === 'deliverable' ? (deliverable?.name || 'Deliverable') : 'Whole program';
    const pillarsInScope = kind === 'pillar' ? [val] : ['FE', 'PW', 'INC'];
    const res = results();
    const allocated = scoped.reduce((s, p) => s + p.cost, 0);
    const spentRows = scoped.filter(p => num(res[p.id]?.spent) != null);
    const ms = A.measures();
    const latest = id => { const s = ms[id]?.series; if (!s) return null; const ys = Object.keys(s).map(Number).sort((a, b) => a - b); return { year: ys[ys.length - 1], value: s[ys[ys.length - 1]], first: ys[0], firstValue: s[ys[0]], series: s }; };
    const kpiTarget = id => A.kpiTargets().find(k => k.id === id);
    const kpiResult = id => {
      const k = window.KPIF?.KPIS.find(x => x.id === id), ev = k && window.KPIs?.evaluateEntry(k);
      const i = ev ? ev.res.map((r, n) => [r, n]).reverse().find(([r]) => window.KPIF.isCalculated(r.status)) : null;
      return i ? { ...i[0], wave: k.waves[i[1]], real: i[0].status !== window.KPIF.STATUS.HYPOTHETICAL || !!ev.e.dummy } : null; // Demo view assumes all the data is there; each page carries a [DUMMY] mark
    };
    const participants = scoped.reduce((s, p) => s + (num(res[p.id]?.participants) || 0), 0);
    const coaches = latest('coaches'), mos = latest('matchOfficials');
    const vol = kpiResult('P3-03');
    const figures = [
      { v: M(allocated), l: 'allocated to date (known allocations)' },
      { v: int(scoped.filter(p => ['FE', 'PW', 'INC'].includes(p.pillar)).length), l: 'deliverables across Pillars 1, 3, 4' },
      { v: int(new Set(scoped.filter(p => p.region !== 'Statewide').map(p => p.region)).size), l: 'NSW regions reached' },
      participants ? { v: int(participants), l: 'participants reached (recorded results)' } : { v: null, l: 'participants reached · data collection required' },
      coaches && mos ? { v: int(coaches.value + mos.value), l: `coaches & match officials, all NSW rugby (${coaches.year})` } : { v: null, l: 'coaches & referees · data collection required' },
      vol?.real ? { v: `${int(vol.value)} hrs`, l: 'verified volunteer hours' } : { v: null, l: 'verified volunteer hours · data collection required' },
    ];
    return { P, rows, c, kind, val, scoped, deliverable, scopeLabel, pillarsInScope, res, allocated, spentRows, ms, latest, kpiTarget, kpiResult, figures, coaches, mos };
  }

  // Wins and gaps per pillar, from the data (insights the team verified are added first).
  function pillarStory(m, key) {
    const wins = [], gaps = [];
    const verified = window.App.insights.filter(i => i.pillar === PILLARS[key].name && window.App.insightState(i) === 'verified' && i.severity === 'positive');
    wins.push(...verified.map(i => i.title));
    const progs = m.scoped.filter(p => p.pillar === key);
    const growth = id => { const s = m.ms[id]?.series && A.latestGrowth(m.ms[id].series); return s ? `${s.growth >= 0 ? 'up' : 'down'} ${Math.abs(s.growth * 100).toFixed(1)}% in ${s.year} (${int(s.value)})` : null; };
    if (key === 'FE') {
      const grants = progs.filter(p => p.kind !== 'budget');
      if (grants.length) wins.push(`${grants.length} facility projects funded (${M(grants.reduce((s, p) => s + p.cost, 0))})`);
      wins.push(`${Math.round((1 - m.c.feMetroShare) * 100)}% of facility grant dollars went outside Greater Sydney`);
      const women = grants.filter(p => p.tags.includes('women') || p.tags.includes('access')).length;
      if (women) wins.push(`${women} projects add female-friendly or accessible facilities`);
      if (!m.kpiResult('P1-01')) gaps.push('No field-usage records yet to show whether grounds are used more (facility utilisation)');
    } else if (key === 'PW') {
      const cg = growth('coaches'), mg = growth('matchOfficials');
      if (cg) wins.push(`Coaches across NSW rugby ${cg}`);
      if (mg) wins.push(`Match officials across NSW rugby ${mg}`);
      const mr = m.kpiTarget('moRatio');
      if (mr?.actual != null) wins.push(`Players per match official across NSW rugby: ${mr.baseline}:1 to ${(+mr.actual).toFixed(1)}:1`);
    } else {
      const fn = m.latest('firstNationsParticipants'), pa = m.latest('pasifikaParticipants');
      if (fn) wins.push(`${int(fn.value)} First Nations participants across NSW rugby in ${fn.year}`);
      if (pa) wins.push(`${int(pa.value)} Samoan, Tongan and Fijian participants across NSW rugby in ${pa.year}`);
      const f = m.latest('femaleParticipants');
      if (f) wins.push(`${int(f.value)} female participants across NSW rugby in ${f.year}`);
      if (!m.kpiResult('C03')) gaps.push('No survey yet on whether participants feel their culture is respected');
    }
    if (!wins.length) wins.push(`${M(progs.reduce((s, p) => s + p.cost, 0))} allocated across ${progs.length} deliverables`);
    return { wins: wins.slice(0, 3), gaps: gaps.slice(0, 2), allocated: progs.reduce((s, p) => s + p.cost, 0) };
  }

  // An evidence-log quote for a pillar (linked program first), or any quote. Only records staff typed in:
  // rows imported from uploaded files are data, not people's words.
  function quoteFor(m, key) {
    const ev = A.evidenceStore.all().filter(e => !e.dataset && e.text);
    const byPillar = key ? ev.find(e => e.programId && m.P.find(p => p.id === e.programId)?.pillar === key) : null;
    const e = byPillar || ev.find(e => /survey|interview|club|community|business/i.test(e.source || '')) || ev[0];
    return e ? { text: e.text.replace(/^DEMO SAMPLE:\s*/, ''), who: `${e.source}${e.region ? ', ' + e.region : ''}` } : null;
  }

  // Rule-based narrative (the AI can replace these; on-page edits override both).
  function narrative(m) {
    const ai = state.ai || {};
    const flagged = m.rows.filter(r => r.status !== 'balanced' || r.fnGap);
    return {
      headline: ai.headline || `${M(m.allocated)} of the $10M Legacy Program is allocated so far, reaching ${m.figures[2].v} NSW regions. Results will follow as projects report.`,
      summary: ai.summary || `The $10M NSW Rugby World Cup Legacy Program invests in facilities, people and inclusion ahead of Rugby World Cup 2027. ${M(m.allocated)} has been allocated to ${m.figures[1].v} deliverables (${m.scopeLabel.toLowerCase()}); these are known allocations, not audited spend. ${Math.round(m.c.centralShare * 100)}% of known dollars are in statewide budgets, not yet split by region. No grant project has finished yet, so most social and cultural results are still to come: the next step is collecting baseline data for the KPI framework.`,
      outcome: ai.outcome || 'Funding now reaching communities across NSW',
      media_headline: ai.media_headline || `Rugby World Cup legacy reaching ${m.figures[2].v} NSW regions`,
      media_lead: ai.media_lead || `NSW Rugby's $10 million Rugby World Cup Legacy Program has ${M(m.allocated)} in known allocations across ${m.figures[1].v} facility, workforce and inclusion deliverables in ${m.figures[2].v} regions of NSW.`,
      region: r => ai.regions?.[r.name] || (r.status === 'over' ? `${r.name} has ${r.spendIndex.toFixed(1)} times its population share of known allocations${r.facilityCount ? `, including ${r.facilityCount} facility project${r.facilityCount === 1 ? '' : 's'}` : ''}.` : r.status === 'under' ? `${r.name} has ${Math.round(r.spendIndex * 100)}% of its population share of known allocations. Statewide programs may also reach it.` : r.fnGap ? `${r.name} has a large First Nations community: an opportunity for a First Nations program.` : `${r.name} has about its population share of known allocations.`),
      flagged,
    };
  }

  // ---------- NSW map (SVG): amounts written on the map, Greater Sydney combined ----------
  function mapSvg(m) {
    const W = 1130, H = 1000, X = lng => (lng - 140.9) * 0.84 * (W / 10.75), Y = lat => (-28.1 - lat) * (H / 9.5);
    const ring = r => r.map(([lng, lat], i) => `${i ? 'L' : 'M'}${X(lng).toFixed(1)},${Y(lat).toFixed(1)}`).join('') + 'Z';
    const b = window.NSW_BOUNDARY;
    const rings = [...(b.nsw || []), ...(b.act || [])]; // NSW outline rings, then ACT as a hole (even-odd fill)
    const sum = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
    const metro = m.rows.filter(r => r.metro), regional = m.rows.filter(r => !r.metro);
    const pts = [{ name: 'Greater Sydney', lat: -33.86, lng: 151.05, total: sum(metro, r => r.total), match: metro.some(r => r.name === m.val) }, ...regional.map(r => ({ ...r, match: r.name === m.val }))].filter(p => p.total > 0);
    const max = Math.max(...pts.map(p => p.total), 1);
    const dim = m.kind === 'region';
    const bubbles = pts.sort((a, b) => b.total - a.total).map(p => {
      const r = 18 + 62 * Math.sqrt(p.total / max), x = X(p.lng), y = Y(p.lat);
      return `<g opacity="${dim && !p.match ? .35 : 1}"><circle cx="${x}" cy="${y}" r="${r}" fill="#c8102e" fill-opacity=".9" stroke="#fff" stroke-width="3"/>
        <text x="${x}" y="${y + 9}" text-anchor="middle" font-size="${r > 42 ? 30 : 22}" font-weight="900" fill="#fff">${esc(M(p.total))}</text>
        <text x="${x}" y="${y + r + 30}" text-anchor="middle" font-size="24" font-weight="700" fill="#fff">${esc(p.name)}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Known allocations by region">
      <path d="${rings.map(ring).join('')}" fill="#16295a" stroke="#3c5aa0" stroke-width="3" fill-rule="evenodd"/>${bubbles}
      <rect x="40" y="${H - 120}" width="560" height="78" fill="#c8102e"/><text x="60" y="${H - 72}" font-size="34" font-weight="900" fill="#fff">${esc(M(m.c.central))} statewide</text>
      <text x="60" y="${H - 50}" font-size="18" fill="#fff">held centrally, not yet linked to a region</text></svg>`;
  }

  // Trend line since baseline, with the program start marked.
  function trendSvg(series, label) {
    if (!series) return `<p class="rp-small">No yearly series uploaded yet. Upload the Rugby Analytics export in Data Studio to draw this trend.</p>`;
    const ys = Object.keys(series).map(Number).sort((a, b) => a - b), vs = ys.map(y => series[y]);
    const W = 420, H = 120, pad = 22, lo = Math.min(...vs) * .9, hi = Math.max(...vs) * 1.05;
    const x = y => pad + (y - ys[0]) / Math.max(1, ys[ys.length - 1] - ys[0]) * (W - 2 * pad), yv = v => H - pad - (v - lo) / (hi - lo || 1) * (H - 2 * pad);
    const startX = x(Math.max(ys[0], Math.min(2025, ys[ys.length - 1])));
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#c9b9b6"/>
      <line x1="${startX}" y1="8" x2="${startX}" y2="${H - pad}" stroke="#c8102e" stroke-dasharray="4 3"/><text x="${startX + 4}" y="16" font-size="9" fill="#c8102e" font-weight="700">Legacy Program began (2025)</text>
      <polyline points="${ys.map(y => `${x(y)},${yv(series[y])}`).join(' ')}" fill="none" stroke="#0d1f45" stroke-width="2.5"/>
      ${ys.map(y => `<circle cx="${x(y)}" cy="${yv(series[y])}" r="3" fill="#0d1f45"/><text x="${x(y)}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#5a6375">${y}</text>`).join('')}
      <text x="${pad}" y="${yv(vs[0]) - 6}" font-size="9" fill="#0d1f45">${int(vs[0])}</text><text x="${x(ys[ys.length - 1]) - 4}" y="${yv(vs[vs.length - 1]) - 6}" font-size="9" text-anchor="end" fill="#0d1f45" font-weight="700">${int(vs[vs.length - 1])} ${esc(label)}</text></svg>`;
  }

  // ---------- pages ----------
  function pages() {
    const m = model(), T = TYPES[state.type], n = narrative(m);
    const date = today();
    let pageNo = 0;
    const page = (cls, inner) => `<section class="rp-page ${cls}"><div class="rp-stripe"></div>${inner}
      <footer class="rp-foot"><span><span class="rp-mark"></span>${String(++pageNo).padStart(2, '0')} · NSW Rugby RWC Legacy Program · ${esc(T.label)}</span><span>Generated by Tackle AI · data as at ${date}</span></footer></section>`;

    const P1 = () => page('p-cover', `${photo('cover', 'Full-bleed photo: players or volunteers at a funded site')}
      <div class="cover-panel"><div class="rp-kicker">NSW Rugby · RWC Legacy Program</div><h1 class="rp-title">Impact report</h1>
        ${ed('cover.scope', m.scopeLabel, 'div', 'scope')}${ed('cover.period', `Reporting period ${state.period}`, 'div', 'period')}</div>
      <div class="cover-tag">${esc(T.label)}</div>
      <div class="cover-logos"><div>NSW Rugby Union<small>logo</small></div><div><small>Proudly funded by</small>NSW Government<small>logo supplied by Office of Sport</small></div><div>RWC 2027<small>Legacy logo</small></div></div>`);

    const P2 = () => {
      const acq = state.type === 'acquittal';
      const spent = m.spentRows.reduce((s, p) => s + m.res[p.id].spent, 0), spentAlloc = m.spentRows.reduce((s, p) => s + p.cost, 0);
      const figs = m.figures.map(f => `<div class="fig ${f.v == null ? 'none' : ''}"><b>${f.v == null ? 'NO DATA' : esc(f.v)}</b><span>${esc(f.l)}</span></div>`).join('');
      return page('p-invest', `<div class="p2-grid">
        <div class="p2-left"><div class="rp-accent"></div><h1 class="rp-title">Investment<br><span class="red">drives impact</span></h1>
          ${ed('p2.headline', n.headline, 'p', 'rp-sub')}${ed('p2.summary', n.summary, 'p', 'rp-body')}
          ${acq ? '' : photo('p2', 'One representative photo: launch, handover or community event')}</div>
        <div class="figures"><h3 class="rp-h3">Key figures</h3>${figs}
          ${acq ? `<div class="spend-bar"><div class="rp-small"><b>Grant vs actual expenditure:</b> ${m.spentRows.length ? `${M(spent)} spent of ${M(spentAlloc)} allocated, for the ${m.spentRows.length} of ${m.scoped.length} deliverables with spending reported` : 'no actual expenditure reported yet: allocations only'}</div>
            <div class="track"><i style="width:${spentAlloc ? Math.min(100, spent / spentAlloc * 100) : 0}%"></i></div></div>` : ''}
          <p class="rp-small fig-source">Data source: RWC Legacy Dashboard; Round 1 Legacy grants; Rugby Analytics${m.spentRows.length ? '; program results recorded by NSW Rugby' : ''}. Amounts are known allocations, not audited spend.</p></div>
        <div class="map-wrap"><h3 class="rp-h3">Where the money goes</h3>${mapSvg(m)}</div></div>`);
    };

    const P3 = () => {
      const ps = m.pillarsInScope, tot = ps.reduce((s, k) => s + pillarStory(m, k).allocated, 0) || 1;
      return page('p-pillars', `<div class="rp-accent"></div><h1 class="rp-title">Legacy pillars</h1><p class="rp-sub">Overview of key wins &amp; next steps</p>
        <div class="p3-grid"><div class="pillar-cols ${ps.length === 1 ? 'one' : ''}">${ps.map(k => { const s = pillarStory(m, k); return `<div class="pillar-col p-${k}"><h4>Pillar ${PILLARS[k].n} · ${PILLARS[k].short}</h4>
            <p><b>Key win:</b> ${ed(`p3.${k}.win`, s.wins[0])}</p><p><b>Still to do:</b> ${ed(`p3.${k}.gap`, s.gaps[0] || 'Collect baseline data for this pillar\'s KPIs')}</p></div>`; }).join('')}</div>
          <table class="inv-table"><thead><tr><th>Pillar</th><th>Allocated · share</th></tr></thead><tbody>
            ${ps.map(k => { const a = pillarStory(m, k).allocated; return `<tr><td><span class="pnum p-${k}">${PILLARS[k].n}</span>${PILLARS[k].name}</td><td>${M(a)} · ${Math.round(a / tot * 100)}%</td></tr>`; }).join('')}
            <tr class="total"><td>Total (in scope)</td><td>${M(tot)} · 100%</td></tr></tbody></table></div>
        <p class="rp-small">Pillars 2 and 5 are outside this report's scope. Amounts are known allocations.</p>
        <div class="p3-photos">${photo('p3a', 'One image per pillar, side by side')}${photo('p3b', 'Photo')}</div>`);
    };

    const P4 = k => {
      const s = pillarStory(m, k), q = quoteFor(m, k);
      return page('p-chapter dark', `<div class="chapter-left">
        <h1 class="rp-title">Pillar ${PILLARS[k].n}:<span class="red">${esc(PILLARS[k].name)}</span></h1>
        <div><div class="objective"><div class="rp-kicker">Objective</div><p>${esc(OBJECTIVE[k])}</p></div>
          <div class="quote"><span class="mark">“</span>${ed(`p4.${k}.quote`, q ? q.text : 'Add a quote from a club, partner or official to the Evidence log', 'p')}${ed(`p4.${k}.cite`, q ? q.who : 'Name, role', 'cite')}</div></div>
        <div class="chapter-list"><span class="icon">✓</span><h5>Key wins</h5><ul>${s.wins.map((w, i) => `<li>${ed(`p4.${k}.win${i}`, w)}</li>`).join('')}</ul>
          <span class="icon">→</span><h5>Next steps &amp; data gaps</h5><ul>${(s.gaps.length ? s.gaps : ['Agree baseline data collection with the data custodian']).map((g, i) => `<li>${ed(`p4.${k}.gap${i}`, g)}</li>`).join('')}</ul></div>
      </div>${photo(`p4${k}`, 'Full-page photo: a funded facility in this pillar')}`);
    };

    const P5 = () => {
      const acq = state.type === 'acquittal';
      const fn = m.latest('firstNationsParticipants'), pa = m.latest('pasifikaParticipants');
      const big = (x, label) => x ? `<div><b>+${Math.round((x.value / x.firstValue - 1) * 100)}%</b><span>${esc(label)} vs ${x.first} (${int(x.firstValue)})</span></div>` : `<div class="none"><b>NO DATA</b><span>${esc(label)} · data collection required</span></div>`;
      const row = (val, text) => val == null ? `<div class="lrow none"><b>NO DATA</b><span>${esc(text)} · data collection required</span></div>` : `<div class="lrow"><b>${esc(val)}</b><span>${esc(text)}</span></div>`;
      const tgt = id => m.kpiTarget(id);
      const ratio = (id, label) => { const t = tgt(id); return row(t?.actual != null ? `${(+t.actual).toFixed(1)}:1` : null, `${label} · base ${t?.baseline}:1 → target ${t?.target}:1`); };
      const kpi = (id, label) => { const r = m.kpiResult(id); return row(r?.real ? r.display : null, `${label} (${id})`); };
      const ret = (D.impactMethods.social.measures.find(x => /retention/i.test(x.name))?.value.match(/Retention ([\d.]+)%/) || [])[1];
      const rows = acq
        ? `<h6>Indicators tied to grant targets</h6>${A.kpiTargets().filter(k => m.pillarsInScope.includes(k.area) && k.target != null).sort((a, b) => (a.actual == null) - (b.actual == null)).slice(0, 8).map(k => row(k.actual == null ? null : k.kind === 'growth' ? `${k.actual >= 0 ? '+' : ''}${(k.actual * 100).toFixed(1)}%` : `${+(+k.actual).toFixed(1)}${k.kind === 'share' ? '%' : k.unit === ':1' ? ':1' : ''}`, `${k.name}${k.baseline != null ? ` · base ${k.baseline}` : ''}${k.target != null ? ` → target ${k.kind === 'growth' ? '+' + Math.round(k.target * 100) + '%' : k.target}` : ''}`)).join('')}`
        : `<h6>Social lens · participation &amp; retention</h6>${row(ret ? `${ret}%` : null, 'player retention (Rugby Analytics, 2026)')}${ratio('moRatio', 'players per referee')}${ratio('coachRatio', 'players per coach')}${kpi('S06', 'high participant satisfaction')}
           <h6>Cultural lens · inclusion</h6>${row(fn ? int(fn.value) : null, 'First Nations participants, all NSW rugby')}${row(pa ? int(pa.value) : null, 'Pasifika participants, all NSW rugby')}${kpi('C03', 'participants who feel their culture is respected')}`;
      const q = quoteFor(m);
      return page('p-outcome', `<div class="p5-grid"><div class="p5-left">
          ${ed('p5.title', n.outcome, 'h1', 'rp-title')}
          <div class="big-two">${big(fn, 'First Nations participants')}${big(pa, 'Pasifika participants')}</div>
          <div class="lens-rows">${rows}</div>
          <p class="footnotes">Sources: [1] Rugby Analytics participation dashboard (export of 22/09/2026, Data Studio) [2] RWC Legacy Dashboard and Project Plan targets [3] NSW Rugby KPI Framework results, where calculated. Grey rows have no data yet.</p></div>
        <div class="p5-right"><div class="quote-bar">${ed('p5.quote', q ? `“${q.text}” — ${q.who}` : '“Short quote from the Evidence log that explains the numbers” — role')}</div>
          ${acq ? '' : photo('p5', 'Photo')}
          <div class="trend"><h3 class="rp-h3">Trend since baseline</h3>${trendSvg(fn?.series || m.latest('players')?.series, fn ? 'First Nations participants' : 'players')}</div></div></div>`);
    };

    const regionBlock = (r, finding) => {
      const share = m.c.knownTotal ? r.total / m.c.knownTotal : 0;
      const u = m.kpiResult('P1-01');
      return `<div class="p6-grid"><div>
          <div class="p6-title"><h1 class="rp-title">${esc(r.name)}<br><span class="red">In focus</span></h1><div class="club-logo">Club / sub-union<br>logo</div></div>
          ${ed(`p6.${r.name}.finding`, finding, 'p', 'finding')}
          ${ed(`p6.${r.name}.body`, `${r.name} has ${M(r.total)} in known allocations (${pct(r.spendShare)} of regionally allocated spend) for about ${pct(r.popShare)} of NSW's population, ${r.spendIndex.toFixed(2)} times its population share. ${r.facilityCount ? `It has ${r.facilityCount} funded facility project${r.facilityCount === 1 ? '' : 's'}.` : 'It has no funded facility project yet.'} ${r.fnReach ? 'A First Nations program reaches the region.' : 'No First Nations program reaches the region yet.'}`, 'p', 'rp-body')}
          ${r.status !== 'balanced' || r.fnGap ? `<div class="flagbox"><b>Note:</b> ${r.status === 'over' ? `known allocations are ${r.spendIndex.toFixed(2)} times this region's population share.` : r.status === 'under' ? `known allocations are ${r.spendIndex.toFixed(2)} times this region's population share; statewide programs may also reach it.` : 'a large First Nations community, and an opportunity for a First Nations program.'}</div>` : ''}</div>
        <div class="ind-list">
          <div class="ind"><i>$</i>${M(r.total)} allocated (${pct(share)} of known NSW allocations)</div>
          <div class="ind"><i>#</i>${r.facilityCount} funded facility project${r.facilityCount === 1 ? '' : 's'}</div>
          <div class="ind none"><i>♀</i>female players in the region · data collection required</div>
          <div class="ind ${u?.real && m.kind === 'region' ? '' : 'none'}"><i>⌂</i>${u?.real && m.kind === 'region' ? `${esc(u.display)} facility utilisation` : 'facility utilisation · data collection required'}</div>
          <div class="ind"><i>✦</i>~${r.fnShare}% First Nations population share (indicative ABS 2021)</div>
          <div class="ind none"><i>?</i>registered players and clubs by region · data collection required</div>
        </div></div>`;
    };
    const P6 = () => {
      if (m.deliverable) {
        const p = m.deliverable, r = m.res[p.id] || {}, met = window.Programs.metrics(p);
        return page('p-region', `<div class="p6-grid"><div>
            <div class="p6-title"><h1 class="rp-title">${esc(p.name)}<br><span class="red">${esc(PILLARS[p.pillar]?.short || p.pillar)}</span></h1><div class="club-logo">Club / sub-union<br>logo</div></div>
            ${ed(`p6.${p.id}.finding`, `${p.name} has ${M(p.cost)} allocated in ${p.region}.`, 'p', 'finding')}
            ${ed(`p6.${p.id}.body`, `${p.recipient ? p.recipient + ' · ' : ''}${p.region}. ${met.hasResults ? 'Results have been recorded for this deliverable.' : 'No results have been recorded for this deliverable yet, so its return cannot be judged.'}`, 'p', 'rp-body')}</div>
          <div class="ind-list">
            <div class="ind"><i>$</i>${M(p.cost)} allocated${num(r.spent) != null ? ` · ${M(r.spent)} spent` : ''}</div>
            <div class="ind ${num(r.participants) ? '' : 'none'}"><i>#</i>${num(r.participants) ? `${int(r.participants)} people reached` : 'people reached · data collection required'}</div>
            <div class="ind ${met.perPerson ? '' : 'none'}"><i>÷</i>${met.perPerson ? `${money(met.perPerson)} per person reached` : 'cost per person · data collection required'}</div>
            <div class="ind ${met.leverage != null ? '' : 'none'}"><i>+</i>${met.leverage != null ? `$${met.leverage.toFixed(2)} co-funding per $1` : 'co-funding · data collection required'}</div>
          </div></div>`);
      }
      if (state.type === 'board') {
        const list = [...m.rows].sort((a, b) => b.total - a.total);
        const share = r => r.status === 'over' ? '<span class="share-chip">Above population share</span>' : r.status === 'under' ? '<span class="share-chip">Below population share</span>' : '<span class="share-chip even">In line</span>';
        const spentIn = r => { const ps = m.P.filter(p => p.region === r.name && num(m.res[p.id]?.spent) != null); return ps.length ? M(ps.reduce((s, p) => s + m.res[p.id].spent, 0)) : 'Not reported'; };
        return page('p-region', `<div class="rp-accent"></div><h1 class="rp-title">Regional <span class="red">reach</span></h1>
          <p class="rp-sub">How known allocations are spread across NSW, compared with each region's share of the population. A different share is not a problem in itself: it can reflect where clubs applied and how many people play there.</p>
          <table class="watch-table reach" style="margin-top:8px"><thead><tr><th>Region</th><th>Allocated</th><th>Spent</th><th>Compared with population</th><th>Opportunity</th></tr></thead><tbody>
          ${list.map(r => `<tr><td><b>${esc(r.name)}</b></td><td>${M(r.total)}</td><td>${spentIn(r)}</td><td>${share(r)} ${r.spendIndex.toFixed(2)}x</td><td>${ed(`p6.${r.name}.note`, r.fnGap ? 'First Nations program' : r.status === 'under' ? 'Future funding' : '')}</td></tr>`).join('')}</tbody></table>
          <p class="rp-small" style="margin-top:6px">A further ${M(m.c.central)} sits in statewide budgets, not yet split by region. Population figures are indicative.</p>`);
      }
      const picks = m.kind === 'region' ? m.rows.filter(r => r.name === m.val)
        : state.type === 'annual' ? [[...m.rows].sort((a, b) => b.total - a.total)[0], n.flagged.find(r => r.status === 'under') || n.flagged[0]].filter((r, i, a) => r && a.indexOf(r) === i)
        : [[...m.rows].sort((a, b) => b.total - a.total)[0]];
      return picks.map(r => page('p-region', regionBlock(r, n.region(r)))).join('');
    };

    // Expenditure: the funding, what is allocated and what has been reported as spent, by pillar and by year.
    const EXP = () => {
      const funding = D.context.totalLegacyFunding, whole = m.kind === 'program' || !m.kind || m.scoped.length === m.P.length;
      const PILLAR_ROWS = [['FE', 'Facilities & Equipment'], ['PW', 'Programs & Workforce'], ['INC', 'Inclusion'], ['ACT', 'RWC Activation'], ['PM', 'Management & evaluation']];
      const reported = list => list.filter(p => num(m.res[p.id]?.spent) != null);
      const spentOf = list => reported(list).reduce((s, p) => s + m.res[p.id].spent, 0);
      const rows = PILLAR_ROWS.map(([k, label]) => { const list = m.scoped.filter(p => p.pillar === k); return { label, list, cost: list.reduce((s, p) => s + p.cost, 0) }; }).filter(r => r.list.length);
      const totalSpent = spentOf(m.scoped), anyReported = reported(m.scoped).length > 0;
      const y = [0, 1, 2].map(i => m.scoped.reduce((s, p) => s + (p.years?.[i] || 0), 0));
      const tile = (v, l) => `<div class="exp-tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
      return page('p-exp', `<div class="rp-accent"></div><h1 class="rp-title">Expenditure: <span class="red">where the money is going</span></h1>
        <div class="exp-tiles">${whole ? tile(M(funding), 'total Legacy funding') : ''}${tile(M(m.allocated), whole ? `allocated so far (${Math.round(m.allocated / funding * 100)}%)` : `allocated · ${esc(m.scopeLabel)}`)}${whole ? tile(M(Math.max(0, funding - m.allocated)), 'not yet allocated') : ''}${tile(anyReported ? M(totalSpent) : 'Not reported', anyReported ? `spent, across ${reported(m.scoped).length} of ${m.scoped.length} lines` : 'actual spend')}</div>
        <table class="watch-table" style="margin-top:12px"><thead><tr><th>Pillar</th><th>Allocated</th><th>Share of allocated</th><th>Spent</th><th>Spent as % of allocated</th></tr></thead><tbody>
        ${rows.map(r => { const has = reported(r.list).length > 0, sp = spentOf(r.list); return `<tr><td><b>${esc(r.label)}</b></td><td>${M(r.cost)}</td><td>${m.allocated ? Math.round(r.cost / m.allocated * 100) : 0}%</td><td>${has ? M(sp) : 'Not reported'}</td><td>${has && r.cost ? Math.round(sp / r.cost * 100) + '%' : '–'}</td></tr>`; }).join('')}</tbody></table>
        ${y.some(Boolean) ? `<p class="rp-small" style="margin-top:10px"><b>3-year budget lines by year:</b> Year 1 ${M(y[0])} · Year 2 ${M(y[1])} · Year 3 ${M(y[2])}. Round 1 grants are not split by year.</p>` : ''}
        ${ed('exp.note', anyReported ? 'Spend is as recorded so far and has not been audited.' : 'Allocations are budgets, not audited spend. No grant project has finished yet: recipients report actual spend in their acquittal report when the project ends (Category 2 by 31/12/2027, Category 1 by 30/06/2028).', 'p', 'rp-small')}`);
    };

    const P7 = () => {
      const C = window.Methods?.CALCS || [];
      const run = id => { const c = C.find(x => x.id === id); const r = c?.run(window.Methods.inputsFor(id).p); return r && !r.missing ? Object.fromEntries(r.rows.map(([l, v]) => [l, v])) : null; };
      const val = s => s == null ? null : parseFloat(String(s).replace(/[^0-9.-]/g, ''));
      const eco = run('contribution'), soc = run('health');
      const sub = (v, label) => `<div class="vsub"><b>${esc(v)}</b><i></i><small>${esc(label)}</small></div>`;
      const prog = label => `<div class="vsub progress"><b>IN PROGRESS</b><i></i><small>${esc(label)}</small></div>`;
      const ecoRow = eco ? (() => { const tot = val(eco['Total economic contribution']), dir = val(eco['Direct contribution (retained in NSW)']); return `<div class="vrow"><div class="vtotal"><small>ECONOMIC</small><b>${esc(M(tot))}</b></div><span class="vop">=</span>${sub(M(dir), 'direct spending retained in NSW')}<span class="vop">+</span>${sub(M(tot - dir), 'flow-on (indirect and induced)')}</div>`; })()
        : `<div class="vrow"><div class="vtotal progress"><small>ECONOMIC</small><b>…</b></div><span class="vop">=</span>${prog('club and participant spending')}<span class="vop">+</span>${prog('event visitor spending')}</div>`;
      const socRow = soc ? `<div class="vrow"><div class="vtotal"><small>SOCIAL · per year</small><b>${esc(M(val(soc['Total yearly benefit'])))}</b></div><span class="vop">=</span>${sub(M(val(soc['Improved physical health'])), 'improved physical health')}<span class="vop">+</span>${sub(M(val(soc['Avoided net healthcare costs'])), 'avoided healthcare costs')}<span class="vop">+</span>${sub(M(val(soc['Improved mental health'])), 'improved mental health')}</div>`
        : `<div class="vrow"><div class="vtotal progress"><small>SOCIAL</small><b>…</b></div><span class="vop">=</span>${prog('health benefits')}<span class="vop">+</span>${prog('mental health and wellbeing')}</div>`;
      const years = (inputs.health || {}).years || 20;
      return page('p-value dark', `<h1 class="rp-title">Estimated <span class="red">value</span></h1><p class="rp-small" style="color:rgba(255,255,255,.75)">Shown only where valuation is complete · all values are estimates · unfinished values read "in progress"</p>
        <div class="value-grid"><div class="value-rows">${ecoRow}${socRow}</div>
          <div class="assumptions"><h5>Key assumptions</h5>
            <p><b>Deadweight:</b> not yet estimated (what would have happened anyway).</p>
            <p><b>Attribution:</b> not yet estimated (share credited to this program).</p>
            <p><b>Duration:</b> benefits counted over ${years} years, discounted at 5% (3% and 7% sensitivity, NSW Treasury TPG23-08).</p>
            <p><b>Proxies:</b> the Australian Sports Commission\'s value of weekly community club sport ($5,932 per participant a year, 2018) and of volunteer time; the expenditure-flow method with its retention rates and multipliers.</p>
            <p class="rp-red"><b>Full formulas → Appendix</b></p></div></div>
        <div class="not-valued"><h5>Benefits we do not put a dollar value on</h5><span>Cultural belonging</span><span>Community pride</span><span>Safer, inclusive clubs</span><span>Stories in the Evidence log (${A.evidenceStore.all().length})</span></div>`);
    };

    const recapTiles = () => {
      const pl = m.latest('players'), co = m.ms.coaches?.series && A.latestGrowth(m.ms.coaches.series), mo = m.ms.matchOfficials?.series && A.latestGrowth(m.ms.matchOfficials.series);
      const f = m.latest('femaleParticipants'), fn = m.latest('firstNationsParticipants');
      const fe = m.P.filter(p => p.pillar === 'FE' && p.kind !== 'budget');
      const kpisNoData = (window.KPIF?.KPIS || []).filter(k => k.state !== 'inactive' && !window.KPIs?.evaluateEntry(k).calculated).length;
      const ev = A.evidenceStore.all();
      return [
        ['Rugby across NSW (context)', [pl ? `${int(pl.value)} players in ${pl.year}, all NSW rugby` : 'Player numbers: upload the Rugby Analytics export', 'Player retention 62.1% in 2026, all NSW rugby']],
        ['Workforce (context)', [co ? `Coaches up ${(co.growth * 100).toFixed(1)}% in ${co.year}, all NSW rugby` : 'Coach numbers not uploaded yet', mo ? `Match officials up ${(mo.growth * 100).toFixed(1)}% in ${mo.year}, all NSW rugby` : 'Match official numbers not uploaded yet']],
        ['Women & girls', [f ? `${int(f.value)} female participants in ${f.year}, all NSW rugby` : 'Female participation not uploaded yet', `${fe.filter(p => p.tags.includes('women')).length} facility projects target women and girls`]],
        ['First Nations & Pasifika inclusion', [fn ? `${int(fn.value)} First Nations participants, all NSW rugby` : 'First Nations participation not uploaded yet', `${M(m.P.filter(p => p.tags.includes('firstNations') || p.tags.includes('pasifika')).reduce((s, p) => s + p.cost, 0))} of Legacy funding allocated to First Nations and Pasifika programs`]],
        ['Better facilities', [`${fe.length} facility projects funded (${M(fe.reduce((s, p) => s + p.cost, 0))})`, `${Math.round((1 - m.c.feMetroShare) * 100)}% outside Greater Sydney`]],
        ['Local economy', [`${M(m.P.filter(p => p.pillar === 'FE').reduce((s, p) => s + p.cost, 0))} in facility works in local areas`, 'Visitor spending at RWC hubs to be measured in 2027']],
        ['Community pride & belonging', [`${ev.length} stories and records in the Evidence log`, 'Cultural belonging survey (CDN outcomes) not yet run']],
        ['Data we still need', [`${kpisNoData} active KPIs have no result yet`, 'Baselines: none verified yet for the KPI framework']],
      ];
    };
    const P8 = () => {
      const board = state.type === 'board';
      return page('p-recap', `<div class="rp-kicker">Summary</div><h1 class="rp-title">A recap of <span class="red">progress so far</span></h1>
        <div class="recap ${board ? 'with-decisions' : ''}">${recapTiles().map(([t, pts], i) => `<div class="tile ${i === 7 ? 'gap' : ''}"><h5>${esc(t)}</h5><ul>${pts.map((p, j) => `<li>${ed(`p8.${i}.${j}`, p)}</li>`).join('')}</ul></div>`).join('')}</div>
        ${board ? `<div class="decisions"><h5>Decisions for the Board</h5><ol>
          <li>${ed('p8.d1', 'Approve adding the KPI framework\'s survey questions to the end-of-season participant survey.')}</li>
          <li>${ed('p8.d2', `Request region-by-region delivery figures for the ${M(m.c.central)} held in statewide budgets.`)}</li>
          <li>${ed('p8.d3', 'Fund baseline data collection (field usage, workforce cohorts, training costs) before the next funding round.')}</li></ol></div>` : ''}`);
    };

    const P9 = () => {
      const K = window.KPIF?.KPIS || [];
      const res = id => { const r = m.kpiResult(id); return r ? `<small>${esc(r.display)}${r.real ? '' : ' (example)'}</small>` : '<small>no data yet</small>'; };
      const frm = (a, as, op, b, bs, out, id) => `<div class="frow"><div class="fvar">${a}<code>${as}</code></div><span class="fop">${op}</span><div class="fvar">${b}<code>${bs}</code></div><span class="fop">=</span><div class="fres">${out}${res(id)}</div></div>`;
      const rag = id => { const r = m.kpiResult(id); return !r ? 'red' : r.status === window.KPIF.STATUS.VERIFIED ? 'green' : 'amber'; };
      const dq = ['P1-01', 'P3-01', 'P3-02', 'S06', 'C03'].map(id => K.find(k => k.id === id)).filter(Boolean);
      return page('p-appendix', `<div class="rp-accent"></div><h1 class="rp-title">Appendix: <span class="red">formulas &amp; sources</span></h1>
        <div class="ap-grid"><div class="ap-table"><h5>Table 1 · Economic KPIs (3 of 9 shown)</h5>
            ${frm('Hours used', 'Club bookings', '÷', 'Hours available', 'Facility record', 'Facility utilisation', 'P1-01')}
            ${frm('Training cash cost', 'Grant data', '÷', 'New qualifications', 'Course records', 'Cost per qualification', 'P3-02')}
            ${frm('Retained staff', 'RugbyXplorer', '÷', 'Original staff', 'Baseline 2025', 'Workforce retention', 'P3-01')}
            <p class="ap-note">All 27 KPI formulas, inputs and rules: NSW Rugby KPI Formula Web Handover (evaluation team), and the Framework tab.</p></div>
          <div><div class="ap-table"><h5>Table 2 · Valuation (to be finalised)</h5>
              <div class="frow"><div class="fvar">Outcome change<code>RugbyXplorer</code></div><span class="fop">×</span><div class="fvar">Financial proxy<code>Benchmark</code></div><span class="fop">−</span><div class="fvar">Deadweight<code>Assumption</code></div><span class="fop">=</span><div class="fres">Estimated value</div></div>
              <p class="ap-note">Only change attributable to the program is counted. Benefits counted over ${(Store.get('methods') || {}).health?.years || 20} years, discounted at 5% (NSW Treasury TPG23-08).</p></div>
            <div class="dq"><h5>Indicator definitions &amp; data quality</h5>${dq.map(k => `<div><span><b>${k.id}</b> ${esc(k.name)} · owner: data custodian to be named · per season</span><span class="rag ${rag(k.id)}">${{ green: 'Green', amber: 'Amber', red: 'Red' }[rag(k.id)]}</span></div>`).join('')}
              <p class="rp-small" style="margin-top:6px">Green = verified result; amber = estimated or example only; red = no data yet.</p></div>
            ${state.type === 'acquittal' ? `<div class="signoff"><h5>Declaration and sign-off</h5>${ed('p9.declare', 'I confirm that the information in this report is accurate and that grant funds were used for the approved purposes. Figures marked as known allocations are budgets, not audited expenditure.', 'p')}
              <div class="lines"><span>Name</span><span>Position</span><span>Signature</span><span>Date</span></div></div>` : ''}</div></div>`);
    };

    const MEDIA = () => {
      const q = quoteFor(m);
      const figs = [[M(m.allocated), 'in known allocations'], [m.figures[1].v, 'facility, workforce and inclusion deliverables'], [m.figures[2].v, 'NSW regions reached']];
      return page('p-media', `<div class="draft">Draft · needs approval by NSW Rugby communications before release</div>
        <div class="media-grid"><div><div class="rp-kicker">Media release · ${today()}</div>${ed('media.headline', n.media_headline, 'h1', 'rp-title')}
            ${ed('media.lead', n.media_lead, 'p', 'media-lead')}
            <div class="media-figs">${figs.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
            ${ed('media.quote', q ? `“${q.text}” — ${q.who}` : '“Quote from a NSW Rugby spokesperson, to be supplied.”', 'p', 'rp-body')}
            <div class="about"><b>About NSW Rugby.</b> ${ed('media.about', ABOUT)}<br><b>Media contact:</b> ${ed('media.contact', '[Name, phone, email]')}</div></div>
          <div class="media-right">${photo('media', 'One photo')}<p class="rp-small">Figures are known allocations from the RWC Legacy Dashboard and Round 1 grants (high confidence). Uncertain figures are left out of media material.</p></div></div>`);
    };

    const build = { exp: EXP, p1: P1, p2: P2, p3: P3, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, media: MEDIA,
      p4: () => (state.type === 'community' && m.kind !== 'pillar' ? [m.deliverable?.pillar && PILLARS[m.deliverable.pillar] ? m.deliverable.pillar : 'FE'] : m.pillarsInScope).map(P4).join('') };
    return T.pages.map(p => build[p]()).join('');
  }

  // ---------- render ----------
  function render() {
    const host = $('#report');
    if (!host) return;
    host.innerHTML = pages();
    fit();
    const T = TYPES[state.type];
    $('#storyTypeInfo').innerHTML = `<b>${esc(T.audience)}</b> · ${esc(T.length)}<ul>${T.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
  }
  // Scale the 16:9 pages to the preview width on screen (printing always uses full size).
  function fit() {
    const host = $('#report'), wrap = $('.report-preview');
    if (!host || !wrap || !wrap.clientWidth) return;
    host.style.zoom = Math.min(1, (wrap.clientWidth - 8) / 1123).toFixed(3);
  }

  function fillScopeValues() {
    const kind = $('#storyScope').value, sel = $('#storyScopeValue');
    const opts = kind === 'pillar' ? Object.entries(PILLARS).map(([k, p]) => [k, `Pillar ${p.n} · ${p.name}`])
      : kind === 'region' ? D.regions.map(r => [r.name, r.name])
      : kind === 'deliverable' ? window.Programs.programs().filter(p => ['FE', 'PW', 'INC'].includes(p.pillar)).sort((a, b) => b.cost - a.cost).map(p => [p.id, `${p.name} (${M(p.cost)})`]) : [];
    sel.hidden = !opts.length;
    sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}" ${v === state.scopeValue ? 'selected' : ''}>${esc(l)}</option>`).join('');
    if (opts.length && !opts.some(([v]) => v === state.scopeValue)) state.scopeValue = opts[0][0];
    if (!opts.length) state.scopeValue = '';
  }

  // ---------- AI narrative (optional) ----------
  async function writeWithAi() {
    if (!window.App.requireModel()) return;
    const btn = $('#storyAi'), m = model(), n = narrative({ ...m });
    const flagged = n.flagged.slice(0, 6).map(r => `${r.name}: ${r.spendIndex.toFixed(2)}x its population share of known allocations${r.fnGap ? ', large First Nations community with no program yet' : ''}, ${M(r.total)}`);
    const facts = { reportType: TYPES[state.type].label, audience: TYPES[state.type].audience, scope: m.scopeLabel, period: state.period,
      keyFigures: m.figures.map(f => `${f.v ?? 'NO DATA'} ${f.l}`), pillarWins: Object.fromEntries(m.pillarsInScope.map(k => [PILLARS[k].name, pillarStory(m, k)])), flaggedRegions: flagged };
    btn.disabled = true; btn.textContent = 'Writing…';
    try {
      const text = await O.chat([{ role: 'system', content: O.SYSTEM }, { role: 'user', content: `${O.sharedContext()}

REPORT FACTS (use only these and DATA):
${JSON.stringify(facts, null, 1)}

TASK: Write the narrative sentences for a ${facts.reportType} for ${facts.audience}. Plain Australian English, no jargon (avoid "baseline", "attribution"). Never invent numbers, names, quotes or people. Describe budgets as allocations, not money spent. Be honest about gaps. Keep a respectful tone for a board and funders: never say overspent, over budget, under-served or risk about a region; say above or below its population share. Say which figures are all NSW rugby rather than Legacy results.
${$('#storyNotes').value.trim() ? 'Extra direction: ' + $('#storyNotes').value.trim() : ''}
Return JSON: {"headline":"one sentence: what the investment has changed so far","summary":"2-3 short paragraphs in one string: what the program is, what was funded, what has changed, what is still unknown","outcome":"6-9 word title stating the change, e.g. More women and girls on the field","media_headline":"max 12 words","media_lead":"one sentence","regions":{"<region name>":"one sentence finding for each flagged region"}}` }],
      { json: true, label: 'Report narrative', onProgress: pr => { btn.textContent = pr.phase === 'writing' ? `Writing… ${pr.tokens} tokens` : `Reading the data… ${Math.round((Date.now() - pr.start) / 1000)}s`; } });
      const j = O.parseJson(text);
      if (!j || typeof j !== 'object') throw new Error('No JSON returned');
      state.ai = { headline: j.headline, summary: j.summary, outcome: j.outcome, media_headline: j.media_headline, media_lead: j.media_lead, regions: j.regions || {} };
      save(); render();
      $('#storyStatus').textContent = `Narrative written by ${O.config.model}. Text you edited on the page is kept; use "Reset edits" to see the AI text there.`;
    } catch (e) {
      $('#storyStatus').textContent = `AI writing failed (${e.message}); the rule-based text is shown.`;
    } finally {
      btn.disabled = false; btn.textContent = 'Write narrative with AI';
    }
  }

  // ---------- photos ----------
  function addPhoto(slot) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        // Downscale so saved reports stay small: longest side 1600 px, JPEG.
        const k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        state.photos[slot] = cv.toDataURL('image/jpeg', 0.82);
        URL.revokeObjectURL(url);
        save(); render();
      };
      img.src = url;
    };
    input.click();
  }

  // ---------- export ----------
  const fileName = () => `NSW-Rugby-${TYPES[state.type].label.replace(/\s+/g, '-')}-${state.period.replace(/[^\w-]+/g, '')}`;
  function exportPdf() {
    $$('#report [contenteditable]').forEach(x => x.blur());
    const prev = document.title;
    document.title = fileName();
    toast('Choose "Save as PDF" as the destination.');
    setTimeout(() => { window.print(); document.title = prev; }, 300);
  }
  async function quickDownload() {
    if (!window.html2pdf) { exportPdf(); return; }
    const el = $('#report'), btn = $('#downloadPdf');
    btn.disabled = true; btn.textContent = 'Rendering…';
    const z = el.style.zoom; el.style.zoom = 1;
    try {
      await html2pdf().set({ margin: 0, filename: `${fileName()}.pdf`, image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: [297, 167], orientation: 'landscape' },
        pagebreak: { mode: ['css'], after: '.rp-page' } }).from(el).save();
      toast('PDF downloaded.');
    } catch { toast('Quick download failed - use Export PDF instead.'); }
    finally { el.style.zoom = z; btn.disabled = false; btn.textContent = 'Quick download'; }
  }

  // ---------- wiring ----------
  document.addEventListener('app-ready', () => {
    load();
    // A link like /#story/board opens that report type.
    const [tab, type] = decodeURIComponent(location.hash.slice(1)).split('/');
    if (tab === 'story' && TYPES[type]) state.type = type;
    $('#storyFormat').value = state.type;
    $('#storyScope').value = state.scopeKind;
    $('#storyYear').value = state.period;
    fillScopeValues();
    $('#storyFormat').addEventListener('change', e => { state.type = e.target.value; save(); render(); });
    $('#storyScope').addEventListener('change', e => { state.scopeKind = e.target.value; fillScopeValues(); save(); render(); });
    $('#storyScopeValue').addEventListener('change', e => { state.scopeValue = e.target.value; save(); render(); });
    $('#storyYear').addEventListener('change', e => { state.period = e.target.value.trim() || '2025–26'; save(); render(); });
    $('#storyAi').addEventListener('click', writeWithAi);
    $('#exportPdf').addEventListener('click', exportPdf);
    $('#downloadPdf').addEventListener('click', quickDownload);
    $('#copyStory').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#report').innerText); toast('Report text copied.'); } catch { toast('Copy failed - select the text manually.'); }
    });
    $('#storyReset').addEventListener('click', () => {
      if (!confirm('Reset all text you edited on the report pages, and the AI narrative? Photos are kept.')) return;
      state.edits = {}; state.ai = {}; save(); render();
    });
    const report = $('#report');
    report.addEventListener('input', e => { const k = e.target.closest('[data-edit]')?.dataset.edit; if (k) { state.edits[k] = e.target.closest('[data-edit]').innerText; save(); } });
    report.addEventListener('click', e => { const p = e.target.closest('[data-photo]'); if (p) addPhoto(p.dataset.photo); });
    addEventListener('resize', fit);
    render();
  });
  document.addEventListener('tab', e => { if (e.detail === 'story') { fillScopeValues(); render(); } });
  ['data-changed', 'insights-changed', 'targets-changed'].forEach(ev => document.addEventListener(ev, () => { if ($('#tab-story')?.classList.contains('active')) render(); }));

  window.Story = { render, TYPES };
})();
