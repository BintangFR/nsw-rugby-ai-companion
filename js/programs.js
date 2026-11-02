// Programs tab: zero in on one grant or budget line - what it costs, what it returns, what it
// contributes to, and what is driving the result (root cause), compared with similar programs.
// Results (spend to date, people reached, new coaches/referees, co-funding) are entered by staff per
// program and stored in Store 'programs'. Nothing is estimated: no results recorded = "can't judge yet".
(() => {
  const { $, $$, esc, money, toast } = window.App;
  const A = window.Analytics, D = window.TACKLE_DATA, O = window.Ollama;

  const PILLAR = { FE: 'Facilities & Equipment', PW: 'Programs & Workforce', INC: 'Inclusion', ACT: 'Activation', PM: 'Management & evaluation' };
  const SOURCE = { grant: 'Round 1 grant', budget: '3-year budget line', upload: 'Uploaded' };
  const aud = n => '$' + Math.round(n).toLocaleString('en-AU');
  const aud2 = n => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: n < 100 ? 2 : 0 });
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

  // ---------- program list ----------
  // Similar programs are compared within a "peer group": facility work by type, program grants by
  // activity, budget lines by pillar.
  function peerGroup(p) {
    if (p.kind === 'budget') return 'Budget lines · ' + (PILLAR[p.pillar] || p.pillar);
    const t = (p.type || '').toLowerCase();
    if (p.pillar === 'FE') {
      if (/light/.test(t)) return 'Facility · lighting';
      if (/changeroom|female-friendly/.test(t)) return 'Facility · changerooms';
      if (/drain|irrigat|surface/.test(t)) return 'Facility · drainage & surface';
      return 'Facility · amenities & other';
    }
    if (/coach/.test(t)) return 'Coaching';
    if (/match official|referee/.test(t)) return 'Match officials';
    if (/competition/.test(t)) return 'Competitions';
    if (/pathway/.test(t)) return 'Pathways';
    return 'Participation';
  }

  // Which plan targets a program feeds (ids from data.js kpis), by pillar, type, tags and name.
  function targetIds(p) {
    const ids = new Set(), name = `${p.name} ${p.type || ''}`.toLowerCase(), tags = p.tags || [];
    if (p.pillar === 'FE') { ids.add('facilities'); if (/equipment|scrum/.test(name)) ids.add('equipmentClubs'); if (tags.includes('women') && /changeroom|female/.test(name)) ids.add('femaleChange'); }
    if (/coach/.test(name)) ids.add(tags.includes('women') || /female/.test(name) ? 'femaleCoaches' : 'coaches');
    if (/match official|referee|\bmo\b/.test(name)) ids.add(tags.includes('women') || /female/.test(name) ? 'femaleMOs' : 'mos');
    if (/competition|participation|get into rugby|walla|7s|pathway|academy|development centre/.test(name)) ids.add('xvPlayers');
    if (p.region === 'Western Sydney') { ids.add('wsParticipation'); if (/academy|development centre/.test(name)) ids.add('wsAcademy'); if (/club development|\bdo\b|development officer/.test(name)) { ids.add('wsChurn'); ids.add('wsBoards'); } }
    if (p.region === 'Hunter' || /hunter/.test(name)) { ids.add('hunterParticipation'); ids.add('hunterClubStandards'); if (/r4g|rugby for good|rfg/.test(name)) ids.add('hunterR4gFunding'); }
    if (p.region === 'Western Sydney' && /club development/.test(name)) ids.add('wsHealthCheck');
    if (p.region === 'Western Sydney' && /\bgm\b|general manager/.test(name)) ids.add('wsR4gFunding');
    if (/match official|referee|\bmo\b/.test(name)) { ids.add('moRatio'); ids.add('moAbuse'); }
    if (/coach/.test(name)) ids.add('coachRatio');
    if (/workforce/.test(name)) { ids.add('workforceChurn'); ids.add('conferenceNps'); }
    if (/rwc|event hub/.test(name) && /hub/.test(name)) { ids.add('rwcHubs'); ids.add('rwcHubParticipants'); }
    if (p.pillar === 'FE' && /equipment/.test(name)) ids.add('clubEquipment');
    if (tags.includes('women') || /female|women|girls/.test(name)) ids.add('femaleParticipation');
    if (tags.includes('firstNations') || /first nations|aboriginal|indigenous/.test(name)) { ids.add('fnTalentId'); if (/leadership|bursar|coach/.test(name)) ids.add('fnBursaries'); }
    if (tags.includes('pasifika') || /pasifika/.test(name)) { ids.add(/leadership/.test(name) ? 'pasifikaLeaders' : 'pasifikaYouthCup'); }
    if (tags.includes('access') || /all abilities|disab/.test(name)) ids.add('allAbilities');
    if (/pride/.test(name)) ids.add('pride');
    if (/integrity|safeguard/.test(name)) ids.add('safeguarding');
    if (/workforce/.test(name)) { ids.add('coaches'); ids.add('mos'); }
    return [...ids];
  }

  function programs() {
    const list = [];
    for (const g of A.allGrants()) {
      const kind = g.datasetId ? 'upload' : 'grant';
      list.push({ kind, id: slug(`${kind}-${g.recipient || ''}-${g.project}`), name: g.project, recipient: g.recipient, pillar: g.pillar, region: g.region, town: g.town, type: g.type, tags: g.tags || [], cost: g.amount, source: g.source });
    }
    for (const d of D.dashboard) {
      list.push({ kind: 'budget', id: slug(`budget-${d.initiative}`), name: d.initiative, recipient: 'NSWRU', pillar: d.pillar, region: d.region, type: d.initiative, tags: d.tags || [], cost: d.total, years: [d.y1, d.y2, d.y3], status: d.status, source: 'RWC Dashboard' });
    }
    for (const p of list) { p.peer = peerGroup(p); p.targetIds = targetIds(p); }
    return list;
  }

  // ---------- results (entered per program) ----------
  const resultsAll = () => Store.get('programs') || {};
  const resultsOf = id => resultsAll()[id] || {};
  const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  function metrics(p, r = resultsOf(p.id)) {
    const spent = num(r.spent), base = spent ?? p.cost;
    const per = n => num(n) && n > 0 ? base / n : null;
    return {
      spent, base, baseLabel: spent != null ? 'spent so far' : 'budget',
      perPerson: per(r.participants), perQualified: per(r.qualified), perEvent: per(r.events),
      leverage: num(r.coFunding) != null && p.cost ? r.coFunding / p.cost : null,
      used: spent != null && p.cost ? spent / p.cost : null,
      hasResults: ['participants', 'qualified', 'events', 'coFunding', 'spent'].some(k => num(r[k]) != null),
    };
  }
  const METRICS = [
    ['perPerson', 'Cost per person reached', 'lower'],
    ['perQualified', 'Cost per new coach / referee', 'lower'],
    ['perEvent', 'Cost per session or event', 'lower'],
    ['leverage', 'Co-funding per $1', 'higher'],
  ];
  const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function peerStats(p, all) {
    const peers = all.filter(q => q.peer === p.peer && q.id !== p.id);
    const out = {};
    for (const [k] of METRICS) {
      const vals = peers.map(q => metrics(q)[k]).filter(v => v != null);
      if (vals.length) out[k] = { median: median(vals), n: vals.length };
    }
    return { peers, out };
  }

  // ---------- root cause: what is driving this program's result ----------
  function drivers(p, all) {
    const m = metrics(p), r = resultsOf(p.id), list = [];
    const add = (sev, text) => list.push({ sev, text });
    const rows = A.regionMetrics(), reg = rows.find(x => x.name === p.region);
    const targets = A.kpiTargets().filter(k => p.targetIds.includes(k.id));
    const { out } = peerStats(p, all);

    if (!m.hasResults) add('watch', 'No results recorded yet, so its return cannot be judged. Add people reached, new coaches or referees, sessions or co-funding below.');
    for (const [k, label, better] of METRICS) {
      const v = m[k], s = out[k];
      if (v == null || !s || !s.median) continue;
      const ratio = v / s.median;
      const fmt = k === 'leverage' ? x => '$' + x.toFixed(2) : aud;
      if (better === 'lower' && ratio >= 1.75) add('risk', `${label} is ${fmt(v)}, ${ratio.toFixed(1)}× the typical ${fmt(s.median)} for ${s.n} similar program${s.n > 1 ? 's' : ''} (${p.peer}).`);
      else if (better === 'lower' && ratio <= 0.6) add('positive', `${label} is ${fmt(v)}, well below the typical ${fmt(s.median)} for similar programs.`);
      else if (better === 'higher' && ratio <= 0.5) add('watch', `${label} is ${fmt(v)}, about half the typical ${fmt(s.median)} for similar programs.`);
      else if (better === 'higher' && ratio >= 1.75) add('positive', `${label} is ${fmt(v)}, ${ratio.toFixed(1)}× the typical ${fmt(s.median)} for similar programs.`);
    }
    if (m.leverage != null && m.leverage >= 1 && !out.leverage) add('positive', `Every $1 of Legacy money attracted ${'$' + m.leverage.toFixed(2)} of co-funding.`);
    if (p.pillar === 'FE' && num(r.coFunding) === 0) add('watch', 'No co-funding recorded. Round 2 requires a 25% co-contribution.');
    if (m.used != null && m.used > 1.05) add('risk', `Over budget: ${Math.round(m.used * 100)}% of the ${aud(p.cost)} allocation spent.`);
    else if (m.used != null && r.status === 'Complete' && m.used < 0.8) add('watch', `Marked complete with only ${Math.round(m.used * 100)}% of the budget spent. Check whether the rest can be reallocated.`);

    if (p.region === 'Statewide') add('watch', 'Held centrally, so its spend and impact cannot be traced to a region. Ask for delivery numbers by region.');
    else if (reg?.status === 'over') add('watch', `${p.region} already gets ${reg.spendIndex.toFixed(1)}× its fair share of spend. Check this does not duplicate other investment there.`);
    else if (reg?.status === 'under') add('positive', `Reaches ${p.region}, which is under-served (${reg.spendIndex.toFixed(1)}× its fair share).`);
    if (reg?.fnGap && !p.tags.includes('firstNations')) add('info', `${p.region} has a large First Nations community and no First Nations program yet. This program could be a way in.`);

    for (const k of targets) {
      // A behind target is context, not this program's own fault: flag it to check, not as a problem.
      if (k.status === 'Behind') add('watch', `Feeds "${k.name}", which is Behind. Results from this program matter for catching up.`);
      else if (k.status === 'Ahead' || k.status === 'Achieved') add('positive', `Feeds "${k.name}", which is ${k.status}.`);
    }
    if (!targets.length) add('info', 'Not linked to any plan target, so its contribution is hard to show in reports.');

    const ev = evidenceFor(p);
    if (!ev.linked.length) add('watch', ev.region.length ? `No evidence logged for this program (${ev.region.length} record${ev.region.length > 1 ? 's' : ''} for ${p.region}).` : 'No field evidence of its impact yet.');
    else add('positive', `${ev.linked.length} evidence record${ev.linked.length > 1 ? 's' : ''} logged for this program.`);

    const order = { risk: 0, watch: 1, positive: 2, info: 3 };
    return list.sort((a, b) => order[a.sev] - order[b.sev]);
  }

  function evidenceFor(p) {
    const all = A.evidenceStore.all();
    return { linked: all.filter(e => e.programId === p.id), region: all.filter(e => e.programId !== p.id && e.region === p.region) };
  }

  // ---------- UI ----------
  let state = { q: '', pillar: 'all', source: 'all', region: 'all', onlyResults: false, sort: 'cost', dir: -1, selected: null };
  let aiAbort = null;

  function filtered(all) {
    const q = state.q.trim().toLowerCase();
    let list = all.filter(p =>
      (state.pillar === 'all' || (state.pillar === 'other' ? !['FE', 'PW', 'INC'].includes(p.pillar) : p.pillar === state.pillar)) &&
      (state.source === 'all' || p.kind === state.source) &&
      (state.region === 'all' || p.region === state.region) &&
      (!state.onlyResults || metrics(p).hasResults) &&
      (!q || `${p.name} ${p.recipient} ${p.region} ${p.town || ''} ${p.type || ''}`.toLowerCase().includes(q)));
    const key = { cost: p => p.cost, name: p => p.name, perPerson: p => metrics(p).perPerson ?? -1, flags: p => p._flags ?? 0 }[state.sort] || (p => p.cost);
    return list.sort((a, b) => { const x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * state.dir; });
  }

  function renderList() {
    const all = programs();
    for (const p of all) p._flags = drivers(p, all).filter(d => d.sev === 'risk').length;
    const list = filtered(all);
    const withResults = all.filter(p => metrics(p).hasResults).length;
    $('#progSummary').innerHTML = `<span><b>${list.length}</b> of ${all.length} programs</span><span><b>${money(list.reduce((s, p) => s + p.cost, 0))}</b> total</span><span><b>${withResults}</b> with results recorded</span><span><b>${all.filter(p => p._flags).length}</b> need attention</span>`;
    const th = (k, label) => `<th data-sort="${k}" class="${state.sort === k ? 'sorted' : ''}">${label}</th>`;
    $('#progTable').innerHTML = `<thead><tr>${th('name', 'Program')}<th>Pillar</th>${th('cost', 'Cost')}${th('perPerson', 'Return')}<th>Targets</th>${th('flags', 'Flags')}</tr></thead><tbody>${list.map(p => {
      const m = metrics(p), ts = A.kpiTargets().filter(k => p.targetIds.includes(k.id));
      const ret = m.perPerson != null ? `${aud(m.perPerson)} / person` : m.perQualified != null ? `${aud(m.perQualified)} / qualified` : m.leverage != null ? `$${m.leverage.toFixed(2)} co-funding / $1` : '<span class="muted">no results yet</span>';
      return `<tr data-id="${esc(p.id)}" class="${state.selected === p.id ? 'on' : ''}" tabindex="0">
        <td><b>${esc(p.name)}</b><small>${esc(p.recipient || '')} · ${esc(p.region)}${p.kind === 'budget' ? ' · 3-yr budget' : ''}</small></td>
        <td><span class="pillar-tag p-${esc(p.pillar)}">${esc(p.pillar)}</span></td>
        <td class="num">${money(p.cost)}</td>
        <td class="num">${ret}</td>
        <td>${ts.map(k => `<i class="tdot ${k.status.replace(/\s/g, '')}" title="${esc(k.name)}: ${esc(k.status)}"></i>`).join('') || '<span class="muted">–</span>'}</td>
        <td class="num">${p._flags ? `<span class="status risk">${p._flags}</span>` : '<span class="muted">–</span>'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="muted">No programs match.</td></tr>'}</tbody>`;
    $$('#progTable th[data-sort]').forEach(h => h.onclick = () => { state.dir = state.sort === h.dataset.sort ? -state.dir : (h.dataset.sort === 'name' ? 1 : -1); state.sort = h.dataset.sort; renderList(); });
    $$('#progTable tbody tr[data-id]').forEach(tr => {
      const open = () => select(tr.dataset.id);
      tr.onclick = open; tr.onkeydown = e => { if (e.key === 'Enter') open(); };
    });
    if (state.selected && !all.some(p => p.id === state.selected)) state.selected = null;
    renderDetail(all);
  }

  function select(id) {
    state.selected = id;
    aiAbort?.abort();
    $$('#progTable tbody tr').forEach(tr => tr.classList.toggle('on', tr.dataset.id === id));
    renderDetail(programs());
    if (innerWidth < 1000) $('#progDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderDetail(all) {
    const box = $('#progDetail');
    const p = all.find(x => x.id === state.selected);
    if (!p) { box.innerHTML = '<div class="empty">Pick a program on the left to see what it costs, what it returns and what is driving the result.</div>'; return; }
    const r = resultsOf(p.id), m = metrics(p), { peers, out } = peerStats(p, all);
    const pillarTotal = all.filter(q => q.pillar === p.pillar).reduce((s, q) => s + q.cost, 0);
    const targets = A.kpiTargets().filter(k => p.targetIds.includes(k.id));
    const ds = drivers(p, all), ev = evidenceFor(p);
    // Hover text for each "What it returns" tile: the formula with this program's numbers, and what "typical" means.
    const costText = `${aud(m.base)} (${m.baseLabel === 'budget' ? 'full budget, because "spent so far" is not entered' : 'spent so far'})`;
    const WORK = {
      'Cost per person reached': ['participants', 'people reached'],
      'Cost per new coach / referee': ['qualified', 'new coaches or referees'],
      'Cost per session / event': ['events', 'sessions or events delivered'],
    };
    const working = (label, v, fmt, peer) => {
      const w = WORK[label];
      const how = w ? (v == null ? `${label} = cost ÷ ${w[1]}.\nNot calculated: no number of ${w[1]} has been recorded for this program. Enter it under "Record results for this program" below.`
          : `${label} = cost ÷ ${w[1]}\n= ${costText} ÷ ${num(r[w[0]]).toLocaleString('en-AU')} ${w[1]}\n= ${fmt(v)}`)
        : (v == null ? 'Co-funding per $1 = co-funding recorded ÷ Legacy budget.\nNot calculated: no co-funding has been recorded. Enter it under "Record results for this program" below.'
          : `Co-funding per $1 = co-funding ÷ Legacy budget\n= ${aud(r.coFunding)} ÷ ${aud(p.cost)}\n= ${fmt(v)} for every $1 of Legacy money`);
      const cmp = peer ? `\n\nTypical = the median of ${peer.n} similar program${peer.n === 1 ? '' : 's'} ("${p.peer}") that have results recorded: ${fmt(peer.median)}.`
        : `\n\nNo comparison yet: none of the other ${peers.length} programs in "${p.peer}" has this result recorded.`;
      return how + cmp + '\n\nPrototype indicator: a value-for-money screen, not from an external framework.';
    };
    const tile = (label, v, fmt, peer) => `<div class="pd-tile" data-tip="${esc(working(label, v, fmt, peer))}" tabindex="0"><span>${label}</span><b>${v == null ? '–' : fmt(v)}</b>${peer ? `<small>typical ${fmt(peer.median)} (${peer.n} similar)</small>` : v == null ? '<small>no result recorded yet: add it below</small>' : '<small>nothing to compare with yet: no similar program has this result</small>'}</div>`;
    const field = (k, label, unit) => `<label>${label}<span class="unit-in"><input type="number" min="0" step="any" data-k="${k}" value="${num(r[k]) ?? ''}"><i>${unit}</i></span></label>`;
    box.innerHTML = `
      <div class="pd-head">
        <div><h2>${esc(p.name)}</h2>
          <p class="muted">${esc(p.recipient || '')}${p.town ? ` · ${esc(p.town)}` : ''} · ${esc(p.region)}</p></div>
        <button class="btn" id="pdClose" title="Close">×</button>
      </div>
      <div class="pd-chips"><span class="pillar-tag p-${esc(p.pillar)}">${esc(PILLAR[p.pillar] || p.pillar)}</span><span class="chip">${SOURCE[p.kind]}</span><span class="chip">${esc(p.peer)}</span>${p.status ? `<span class="chip">${esc(p.status)}</span>` : ''}</div>

      <h3>What it costs</h3>
      <div class="pd-tiles">
        <div class="pd-tile"><span>${p.kind === 'budget' ? '3-year budget' : 'Grant'}</span><b>${aud(p.cost)}</b><small>${(p.cost / pillarTotal * 100).toFixed(1)}% of all ${esc(PILLAR[p.pillar] || p.pillar)} money</small></div>
        <div class="pd-tile"><span>Spent so far</span><b>${m.spent == null ? '–' : aud(m.spent)}</b><small>${m.used == null ? 'not recorded' : Math.round(m.used * 100) + '% of budget'}</small></div>
        ${p.years ? `<div class="pd-tile wide"><span>By year</span><div class="pd-years">${p.years.map((y, i) => `<div><i style="height:${Math.max(4, y / Math.max(...p.years, 1) * 44)}px"></i><small>Y${i + 1} ${money(y)}</small></div>`).join('')}</div></div>` : ''}
      </div>

      <h3>What it returns</h3>
      <div class="pd-tiles">
        ${tile('Cost per person reached', m.perPerson, aud, out.perPerson)}
        ${tile('Cost per new coach / referee', m.perQualified, aud, out.perQualified)}
        ${tile('Cost per session / event', m.perEvent, aud, out.perEvent)}
        ${tile('Co-funding per $1', m.leverage, v => '$' + v.toFixed(2), out.leverage)}
      </div>
      <p class="muted small">Costs use ${m.baseLabel === 'budget' ? 'the full budget until "spent so far" is entered' : 'the amount spent so far'}. Compared with ${peers.length} other program${peers.length === 1 ? '' : 's'} in "${esc(p.peer)}".</p>

      <h3>What's driving this?</h3>
      <ul class="pd-drivers">${ds.map(d => `<li class="${d.sev}"><span class="status ${d.sev === 'info' ? '' : d.sev}">${{ risk: 'Problem', watch: 'Check', positive: 'Good', info: 'Note' }[d.sev]}</span><span>${esc(d.text)}</span></li>`).join('')}</ul>

      <h3>Contributes to</h3>
      <ul class="pd-targets">${targets.map(k => `<li><span>${esc(k.name)}</span><span class="status ${{ Ahead: 'positive', Achieved: 'positive', Close: 'watch', Behind: 'risk' }[k.status] || ''}">${esc(k.status)}</span></li>`).join('') || '<li class="muted">No plan target linked.</li>'}</ul>

      <details class="pd-results" ${m.hasResults ? '' : 'open'}><summary>Record results for this program</summary>
        <form id="pdForm" class="pd-form">
          ${field('spent', 'Spent so far', 'AUD')}${field('coFunding', 'Co-funding received', 'AUD')}
          ${field('participants', 'People reached', 'people')}${field('qualified', 'New coaches / referees qualified', 'people')}
          ${field('events', 'Sessions or events delivered', 'count')}
          <label>Status <select data-k="status">${['', 'Not started', 'In progress', 'Complete'].map(s => `<option ${r.status === s ? 'selected' : ''} value="${s}">${s || '–'}</option>`).join('')}</select></label>
          <label class="span2">Note <input type="text" data-k="note" value="${esc(r.note || '')}" placeholder="e.g. Figures from club report, March 2026"></label>
          <div class="row end span2"><button class="btn primary">Save results</button></div>
        </form>
      </details>

      <h3>Evidence</h3>
      <ul class="pd-evidence">${ev.linked.map(e => `<li>${esc(e.text)}${e.metric ? ` <b>${esc(e.metric)}</b>` : ''} <small class="muted">· ${esc(e.source)}</small></li>`).join('') || '<li class="muted">Nothing logged for this program yet.</li>'}</ul>
      <form id="pdEvidence" class="row"><select id="pdEvLens"><option value="social">Social</option><option value="economic">Economic</option><option value="cultural">Cultural</option></select><input id="pdEvText" placeholder="Log what this program achieved, e.g. 40 girls now train under lights" required><button class="btn">Add</button></form>

      <div class="pd-ai"><button class="btn" id="pdAsk">Explain with AI</button><div id="pdAiOut" class="md"></div></div>`;

    $('#pdClose').onclick = () => { state.selected = null; renderList(); };
    $('#pdForm').onsubmit = e => {
      e.preventDefault();
      const v = {};
      $$('#pdForm [data-k]').forEach(i => {
        if (i.type === 'number') { if (i.value !== '') v[i.dataset.k] = Number(i.value); }
        else if (i.value.trim()) v[i.dataset.k] = i.value.trim();
      });
      Store.set('programs', { ...resultsAll(), [p.id]: { ...v, updated: Date.now() } });
      toast('Results saved.');
      renderList();
    };
    $('#pdEvidence').onsubmit = e => {
      e.preventDefault();
      A.evidenceStore.add({ lens: $('#pdEvLens').value, region: p.region, source: 'Program report', text: $('#pdEvText').value.trim(), programId: p.id, program: p.name, date: new Date().toISOString().slice(0, 10) });
      window.Impact?.refresh?.();
      toast('Evidence logged.');
      renderList();
    };
    $('#pdAsk').onclick = () => explain(p, all);
  }

  // AI explanation for one program. Starts with the shared data (already pre-read), so only the
  // short program block needs reading.
  async function explain(p, all) {
    if (!window.App.requireModel()) return;
    const out = $('#pdAiOut'), btn = $('#pdAsk');
    aiAbort?.abort(); aiAbort = new AbortController();
    btn.disabled = true; out.innerHTML = '<p class="muted">Thinking…</p>';
    try {
      await O.stream([
        { role: 'system', content: O.SYSTEM },
        { role: 'user', content: `${O.sharedContext()}\n\nPROGRAM IN FOCUS:\n${programLine(p, all)}\nDRIVERS FOUND: ${drivers(p, all).map(d => `[${d.sev}] ${d.text}`).join(' | ')}\n\nIn under 120 words of markdown: is this program good value, what is the main reason (root cause) behind its result, and one thing to do next? Use only the figures given.` },
      ], (_, full) => { out.innerHTML = window.App.md(full); }, { label: 'Program', numPredict: 320, signal: aiAbort.signal });
    } catch (e) { if (e.message !== 'Cancelled') out.innerHTML = `<p class="muted">Could not reach the AI: ${esc(e.message)}</p>`; }
    finally { btn.disabled = false; }
  }

  function programLine(p, all = programs()) {
    const m = metrics(p), r = resultsOf(p.id);
    const bits = [`${p.name} (${p.recipient || 'NSWRU'}, ${p.region}, ${PILLAR[p.pillar] || p.pillar}, ${SOURCE[p.kind]})`, `cost ${aud(p.cost)}`];
    if (m.spent != null) bits.push(`spent ${aud(m.spent)}`);
    if (num(r.participants) != null) bits.push(`${r.participants} people reached (${aud(m.perPerson)} each)`);
    if (num(r.qualified) != null) bits.push(`${r.qualified} new coaches/referees (${m.perQualified != null ? aud(m.perQualified) + ' each' : '-'})`);
    if (num(r.events) != null) bits.push(`${r.events} sessions/events`);
    if (m.leverage != null) bits.push(`co-funding $${m.leverage.toFixed(2)} per $1`);
    if (r.status) bits.push(`status ${r.status}`);
    return bits.join('; ');
  }

  // Only programs with recorded results go to the AI, so the shared data stays stable (and cached) otherwise.
  function contextLines() {
    const all = programs().filter(p => metrics(p).hasResults);
    return all.length ? ['PROGRAM RESULTS (entered by staff): ' + all.map(p => programLine(p)).join(' | ')] : [];
  }

  function init() {
    $('#progRegion').innerHTML = ['<option value="all">All regions</option>', '<option>Statewide</option>', ...D.regions.map(r => `<option>${esc(r.name)}</option>`)].join('');
    $('#progSearch').oninput = e => { state.q = e.target.value; renderList(); };
    $('#progRegion').onchange = e => { state.region = e.target.value; renderList(); };
    $('#progSource').onchange = e => { state.source = e.target.value; renderList(); };
    $('#progOnlyResults').onchange = e => { state.onlyResults = e.target.checked; renderList(); };
    $$('#progPillar button').forEach(b => b.onclick = () => { state.pillar = b.dataset.f; $$('#progPillar button').forEach(x => x.classList.toggle('on', x === b)); renderList(); });
    renderList();
  }

  document.addEventListener('app-ready', init);
  document.addEventListener('data-changed', () => { if ($('#progTable')) renderList(); });
  document.addEventListener('targets-changed', () => { if ($('#progTable')) renderList(); });

  window.Programs = { programs, metrics, drivers, select, contextLines, render: renderList, idFor: (kind, recipient, name) => slug(`${kind}-${recipient || ''}-${name}`) };
})();
