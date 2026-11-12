// Turns the raw seed data (plus any uploaded region layers) into region metrics,
// centralisation measures and rule-based insights.
window.Analytics = (() => {
  const D = window.TACKLE_DATA;
  const INCLUSION_TAGS = ['women', 'firstNations', 'pasifika', 'access'];
  const GAP_TYPES = {
    lighting: /light/i,
    changerooms: /changeroom|female-friendly/i,
    drainage: /drainage|irrigation|surface/i,
    accessibility: /accessib|inclusive/i,
  };

  // Region layers from uploaded datasets: { id, label, values: { regionName: number } }
  const customLayers = () => (Store.get('datasets') || []).flatMap(d => d.layers || []);

  // Yearly measures that uploaded files can supply (e.g. Rugby Analytics seasonal comparisons). Targets with a
  // matching `measure` recalculate from them. re: matched against a column header (long format, one row per year)
  // or a row label (wide format, one column per year). sum: add up every matching row (e.g. heritage groups).
  const MEASURES = {
    players:            { label: 'Players', unit: 'players', re: /^(all |total |club )?players$/i },
    coaches:            { label: 'Coaches', unit: 'coaches', re: /^(accredited )?coaches$/i },
    matchOfficials:     { label: 'Match officials', unit: 'match officials', re: /^(accredited )?(match officials?|referees)$/i },
    nonPlaying:         { label: 'Non-playing roles', unit: 'people', re: /^other \(non-playing\)$|^non-playing( roles)?$/i },
    participants:       { label: 'Participants', unit: 'participants', re: /^(total |all )?participants$/i },
    femaleParticipants: { label: 'Female participants', unit: 'participants', re: /^(female|women( and| &) girls)( participants| players)?$/i },
    firstNationsParticipants: { label: 'First Nations participants', unit: 'participants', re: /aboriginal|torres strait|first nations/i },
    pasifikaParticipants: { label: 'Pasifika participants', unit: 'participants', re: /^(samoan|tongan|fijian|pasifika|pacific islander)$/i, sum: true },
  };
  // All yearly series from uploads: { id: { ...MEASURES[id], series: { year: value }, dataset, sheet } }.
  // When several files supply the same measure, the most recently uploaded one wins.
  function measures() {
    const out = {};
    const list = (Store.get('datasets') || []).slice().sort((a, b) => (a.created || 0) - (b.created || 0));
    for (const d of list) for (const m of d.measures || []) if (MEASURES[m.id]) out[m.id] = { ...MEASURES[m.id], ...m, dataset: d.name };
    return out;
  }
  // Latest year-on-year change of a series, or null with fewer than two consecutive years.
  function latestGrowth(series) {
    const years = Object.keys(series || {}).map(Number).sort((a, b) => a - b);
    const y = years[years.length - 1], prev = years[years.length - 2];
    if (years.length < 2 || y - prev !== 1 || !series[prev]) return null;
    return { year: y, prevYear: prev, value: series[y], prevValue: series[prev], growth: series[y] / series[prev] - 1 };
  }

  // Field evidence for the impact lenses (survey results, business feedback, community stories).
  const evidenceStore = {
    all: () => Store.get('evidence') || [],
    add(entry) { Store.set('evidence', [{ id: uid(), created: Date.now(), ...entry }, ...this.all()]); },
    addMany(entries) { Store.set('evidence', [...entries.map(e => ({ id: uid(), created: Date.now(), ...e })), ...this.all()]); },
    remove(id) { Store.set('evidence', this.all().filter(e => e.id !== id)); },
  };
  const uid = () => Math.random().toString(36).slice(2, 10);

  // Spend rows and region layers contributed by uploaded datasets (persisted in Store 'datasets').
  const uploadedSpend = () => (Store.get('datasets') || []).flatMap(d => (d.spend || []).map(s => ({ ...s, source: d.name, datasetId: d.id })));
  // Grants NSW Rugby says are not part of the program (offer declined, withdrawn) are left out wherever they come from,
  // including uploaded files, so they never reach a total.
  const excluded = g => (D.excludedGrants || []).some(x => x.match.test(`${g.recipient || ''} ${g.project || ''} ${g.town || ''}`) && (!x.amount || Math.abs(g.amount - x.amount) < 1));
  const allGrants = () => [...D.grants, ...uploadedSpend()].filter(g => !excluded(g));

  // Coverage of the established impact measures (js/data.js impactMethods), per lens.
  function impactCoverage() {
    // Measures marked dynamic: 'kpi' take their status from the NSW Rugby KPI Framework results for that dimension.
    const kpiStatus = (m, dim) => {
      const c = window.KPIs?.coverage(dim);
      if (!c) return m;
      return { ...m, status: c.done === 0 ? 'none' : c.done === c.total ? 'measured' : 'partial', value: `${c.done} of ${c.total} active ${dim.toLowerCase()} KPIs have results${c.inactive ? ` (${c.inactive} inactive)` : ''}` };
    };
    // Measures with a `calc` take their status from that valuation calculator (js/methods.js). Values filled from app
    // data, or transferred from another study, count as partial: they are indicative until NSW Rugby collects its own.
    const calcStatus = m => {
      const M = window.Methods, c = M?.CALCS.find(x => x.id === m.calc);
      if (!c) return m;
      const inp = M.inputsFor(c.id), res = c.run(inp.p);
      if (res.missing) return m;
      const last = res.rows.find(r => /^Total/.test(r[0])) || res.rows[0];
      if (inp.from === 'dummy') return { ...m, status: 'measured', value: `[DUMMY] ${last[0]}: ${last[1]}` };
      return { ...m, status: 'partial', value: `${last[0]}: ${last[1]} (${inp.from === 'data' ? 'inputs filled from app data, indicative' : 'staff-entered inputs'})` };
    };
    return Object.fromEntries(Object.entries(D.impactMethods).map(([k, lens]) => {
      // Demo view assumes all the data is there: nothing reads as unmeasured, and what is assumed is tagged [DUMMY].
      const demoValue = m => {
        if (!window.DemoView?.on || m.status === 'measured') return m;
        return { ...m, status: 'measured', value: `[DUMMY] ${window.DemoView.measure(m.name) || `assumed complete: ${m.value}`}` };
      };
      const ms = lens.measures.map(m => demoValue(m.dynamic === 'kpi' ? kpiStatus(m, lens.label) : m.calc ? calcStatus(m) : m));
      const count = s => ms.filter(m => m.status === s).length;
      return [k, { measures: ms, measured: count('measured'), partial: count('partial'), none: count('none'), total: ms.length }];
    }));
  }

  function regionMetrics() {
    const rows = D.regions.map(r => ({
      ...r, fe: 0, pw: 0, inc: 0, total: 0, facilityCount: 0, gaps: new Set(), evidenceCount: 0,
      tagSpend: { women: 0, firstNations: 0, pasifika: 0, access: 0 }, items: [],
    }));
    const byName = Object.fromEntries(rows.map(r => [r.name, r]));

    for (const gr of allGrants()) {
      const r = byName[gr.region];
      if (!r) continue;
      addSpend(r, gr.pillar, gr.amount, gr.tags);
      r.items.push(`${gr.project} (${gr.recipient}) $${Math.round(gr.amount).toLocaleString()}`);
      if (gr.pillar === 'FE') {
        r.facilityCount++;
        for (const [k, re] of Object.entries(GAP_TYPES)) if (re.test(gr.type)) r.gaps.add(k);
      }
    }
    for (const row of D.dashboard) {
      const r = byName[row.region];
      if (!r) continue;
      addSpend(r, row.pillar, row.total, row.tags);
      r.items.push(`${row.initiative} (dashboard, 3 yrs) $${row.total.toLocaleString()}`);
    }

    for (const e of evidenceStore.all()) if (byName[e.region]) byName[e.region].evidenceCount++;

    const totalSpend = sum(rows, r => r.total);
    const totalPop = sum(rows, r => r.pop);
    for (const r of rows) {
      r.perResident = r.total / (r.pop * 1000);
      r.spendShare = totalSpend ? r.total / totalSpend : 0;
      r.popShare = r.pop / totalPop;
      r.spendIndex = r.popShare ? r.spendShare / r.popShare : 0;
      r.status = r.spendIndex >= 1.75 ? 'over' : r.spendIndex <= 0.5 ? 'under' : 'balanced';
      r.gapCoverage = r.gaps.size;
      const incSpend = inclusiveSpend(r);
      r.inclusiveSpend = incSpend;
      r.tagsCovered = INCLUSION_TAGS.filter(t => r.tagSpend[t] > 0 || (t === 'firstNations' && D.firstNationsReach.includes(r.name))).length;
      r.fnReach = r.tagSpend.firstNations > 0 || D.firstNationsReach.includes(r.name);
      r.fnGap = r.fnShare >= 7 && !r.fnReach;
      for (const layer of customLayers()) r['custom:' + layer.id] = layer.values[r.name] ?? null;
    }
    return rows;
  }

  function addSpend(r, pillar, amount, tags) {
    if (pillar === 'FE') r.fe += amount;
    else if (pillar === 'INC') r.inc += amount;
    else r.pw += amount;
    r.total += amount;
    for (const t of tags) if (t in r.tagSpend) r.tagSpend[t] += amount;
  }

  // Each grant counted once even if it carries several inclusion tags.
  function inclusiveSpend(r) {
    let s = 0;
    for (const gr of allGrants()) if (gr.region === r.name && gr.tags.some(t => INCLUSION_TAGS.includes(t))) s += gr.amount;
    for (const row of D.dashboard) if (row.region === r.name && row.tags.some(t => INCLUSION_TAGS.includes(t))) s += row.total;
    return s;
  }

  function centralisation(rows = regionMetrics()) {
    const grantTotal = sum(allGrants(), g => g.amount);
    const dashTotal = sum(D.dashboard, d => d.total);
    const central = sum(D.dashboard.filter(d => d.region === 'Statewide'), d => d.total) +
                    sum(allGrants().filter(g => g.region === 'Statewide'), g => g.amount);
    const metro = sum(rows.filter(r => r.metro), r => r.total);
    const regional = sum(rows.filter(r => !r.metro), r => r.total);
    const allocated = metro + regional;
    const metroPopShare = sum(rows.filter(r => r.metro), r => r.pop) / sum(rows, r => r.pop);
    const feTotal = sum(rows, r => r.fe);
    const feMetro = sum(rows.filter(r => r.metro), r => r.fe);
    const incCentral = sum(D.dashboard.filter(d => d.pillar === 'INC' && d.region === 'Statewide'), d => d.total);
    const incTotal = incCentral + sum(rows, r => r.inc);
    return {
      knownTotal: grantTotal + dashTotal, grantTotal, dashTotal,
      central, metro, regional,
      centralShare: central / (grantTotal + dashTotal),
      metroShareOfAllocated: metro / allocated,
      metroPopShare,
      feMetroShare: feMetro / feTotal,
      incCentralShare: incCentral / incTotal,
      verdict: central / (grantTotal + dashTotal) > 0.35 ? 'Centralised' : 'Distributed',
    };
  }

  function pillarTotals(rows = regionMetrics()) {
    const fe = sum(allGrants().filter(g => g.pillar === 'FE'), g => g.amount);
    const pw = sum(allGrants().filter(g => g.pillar === 'PW'), g => g.amount) + sum(D.dashboard.filter(d => d.pillar === 'PW'), d => d.total);
    const inc = sum(allGrants().filter(g => g.pillar === 'INC'), g => g.amount) + sum(D.dashboard.filter(d => d.pillar === 'INC'), d => d.total);
    const other = sum(D.dashboard.filter(d => d.pillar === 'ACT' || d.pillar === 'PM'), d => d.total);
    return { fe, pw, inc, other };
  }

  // Compact plain-text briefing every AI call receives (~2k tokens instead of ~5k of JSON).
  // It is identical for all agents, so Ollama can reuse its prompt cache: put it FIRST in the prompt.
  function briefing() {
    const rows = regionMetrics();
    const c = centralisation(rows);
    const p = pillarTotals(rows);
    const m = n => '$' + Math.round(n).toLocaleString('en-AU');
    const names = f => rows.filter(f).map(r => r.name).join(', ') || 'none';
    const cov = impactCoverage();
    const ms = Object.values(measures());
    const ev = evidenceStore.all().slice(0, 15);
    const quality = Object.entries(Store.get('quality') || {});
    const layers = customLayers();
    const lines = [
      `THE MISSION: find the impact of the $10M Legacy Program. ${m(c.knownTotal)} is allocated so far. Only link an impact to Legacy funding if the DATA ties it to Legacy money or people reached by Legacy programs. Rugby-wide participation is context, not Legacy impact: never credit all of it to the program.`,
      ...(window.DemoView?.on ? ['DEMO VIEW IS ON: program results, surveys, target actuals, KPI inputs, valuation inputs and evidence that are not recorded yet are made up. Anything marked [DUMMY] or Hypothetical is not a real result: say so whenever you mention it.'] : []),
      'PROGRAM: NSW Rugby World Cup Legacy Program, $10M, 2025-2028 (year 1 of 3). All $ are known allocations, not audited spend. Population and First Nations % are indicative.',
      `PILLAR TOTALS: Facilities & Equipment ${m(p.fe)}; Programs & Workforce ${m(p.pw)}; Inclusion ${m(p.inc)}; RWC activation + M&E + PM ${m(p.other)}.`,
      `CENTRALISATION: ${m(c.central)} (${pct(c.centralShare)}%) held centrally in statewide NSWRU budgets. Greater Sydney gets ${pct(c.metroShareOfAllocated)}% of regionally allocated spend with ${pct(c.metroPopShare)}% of population. ${pct(1 - c.feMetroShare)}% of facility grant $ went outside Greater Sydney. ${pct(c.incCentralShare)}% of inclusion budget is held centrally.`,
      'FLAGS (ground truth - use exactly):',
      `- Above population share (spend share >= 1.75x population share): ${names(r => r.status === 'over')}`,
      `- Below population share (<= 0.5x): ${names(r => r.status === 'under')}`,
      `- Balanced: ${names(r => r.status === 'balanced')}`,
      `- First Nations program reach: ${names(r => r.fnReach)}`,
      `- First Nations GAP (high First Nations population, no program): ${names(r => r.fnGap)}`,
      `- Women & girls investment: ${names(r => r.tagSpend.women > 0)}`,
      `- Pasifika/CALD investment: ${names(r => r.tagSpend.pasifika > 0)}`,
      `- Accessibility investment: ${names(r => r.tagSpend.access > 0)}`,
      `- No facility project: ${names(r => r.facilityCount === 0)}`,
      'REGIONS (name | Greater Sydney? | population | First Nations % | facilities $ | workforce $ | inclusion $ | total $ | $ per resident | spend vs population | status | facility projects | audit gaps fixed' + layers.map(l => ' | ' + l.label).join('') + '):',
      ...rows.map(r => [r.name, r.metro ? 'yes' : 'no', (r.pop * 1000).toLocaleString('en-AU'), r.fnShare + '%', m(r.fe), m(r.pw), m(r.inc), m(r.total), '$' + r.perResident.toFixed(2), r.spendIndex.toFixed(2) + 'x', r.status, r.facilityCount, [...r.gaps].join('+') || '-', ...layers.map(l => l.values[r.name] ?? '-')].join(' | ')),
      'FACILITY GRANTS: ' + allGrants().filter(g => g.pillar === 'FE').map(g => `${g.town || g.region} (${g.region}) ${g.type} ${m(g.amount)}`).join('; '),
      'STATEWIDE BUDGET LINES (3 yrs): ' + D.dashboard.filter(d => d.region === 'Statewide').map(d => `${d.initiative} ${m(d.total)}`).join('; '),
      'PLAN TARGETS (what each plan aims for, with the latest all-NSW-rugby actual; do not call them ahead or behind, that method is not part of the framework): ' + kpiTargets().filter(k => k.target != null && !/rugby for good/i.test(k.name)).map(k => `${k.name}: base ${k.baseline ?? '-'}, target ${k.target} by ${k.targetYear}, latest ${k.actual ?? 'no data'}`).join(' | '),
      `CONTEXT: Facility audit - ${D.context.facilityAudit.femaleChangerooms}% female-friendly changerooms, ${D.context.facilityAudit.adequateLighting}% adequate lighting, ${D.context.facilityAudit.adequateDrainage}% adequate drainage. Ratios: player:coach ${D.context.ratios.playerToCoach}, player:MO ${D.context.ratios.playerToMO}. ${D.context.workforceRepresentation} ${D.context.westernSydney} ${D.context.volunteers} ${D.context.equipment} ${D.context.round2} ${D.context.socialValue} Wages ${m(D.context.salariesOnDashboard)} of dashboard budget end in 2028; NSWRU 2025 loss ${m(D.context.nswruLoss2025)}. Holroyd: $1 of grant unlocked $${D.context.holroydLeverage} of project spend.`,
      'IMPACT MEASURES (only established methods: NSW Treasury TPG22-22/TPG23-08, OECD social cohesion with ABS GSS benchmarks, per-person values from the Rugby For Good CBA (a different program, used as published values only), NSWRL 2026 community impact methods, CDN cultural outcomes, eventIMPACTS, Rugby Australia participation definitions. Never invent a new formula, multiplier or dollar value; there is no "spend per lens" figure):',
      ...Object.entries(cov).map(([k, c]) => `- ${D.impactMethods[k].label} (${c.measured} measured, ${c.partial} partial, ${c.none} no data): ` + c.measures.map(i => `${i.name} [${D.frameworks[i.framework].org}] ${i.status === 'none' ? 'NO DATA' : i.status + ': ' + i.value}`).join('; ')),
      ...(ms.length ? ['UPLOADED YEARLY SERIES: ' + ms.map(s => `${s.label} (${s.dataset}): ` + Object.entries(s.series).map(([y, v]) => `${y} ${Math.round(v).toLocaleString('en-AU')}`).join(', ')).join(' | ')] : []),
      ...(window.KPIs ? window.KPIs.contextLines() : []),
      ...(window.Methods ? window.Methods.contextLines() : []),
      ...(window.Programs ? window.Programs.contextLines() : []),
      ...(window.Activity ? window.Activity.contextLines() : []),
      ...(window.Signals ? window.Signals.contextLines() : []),
      ...(window.Round2 ? window.Round2.contextLines() : []),
      ...(window.AusPlay ? window.AusPlay.contextLines() : []),
      ...(window.DataHistory ? window.DataHistory.contextLines() : []),
      `FIELD EVIDENCE (${evidenceStore.all().length} records): ` + (ev.length ? ev.map(e => `[${e.lens}, ${e.region}, ${e.source}] "${e.text}"${e.metric ? ' (' + e.metric + ')' : ''}`).join(' | ') : 'none recorded yet'),
    ];
    // Staff ratings are added separately by Feedback.lessons() (see Ollama.sharedContext).
    if (quality.length) lines.push('DATA SOURCE QUALITY: ' + quality.map(([f, q]) => `${f} ${q.ai?.rating || q.rule?.rating} ${q.ai?.score ?? q.rule?.score}/100`).join('; '));
    return lines.join('\n');
  }

  // Older JSON form (kept for debugging/export).
  function contextFor(focus) {
    const rows = regionMetrics();
    const c = centralisation(rows);
    const p = pillarTotals(rows);
    const regions = rows.map(r => ({
      region: r.name, metro: r.metro, population: r.pop * 1000, firstNationsPct: r.fnShare,
      facilities$: r.fe, programsWorkforce$: r.pw, inclusion$: r.inc, total$: r.total,
      perResident$: +r.perResident.toFixed(2), spendVsPopIndex: +r.spendIndex.toFixed(2), status: r.status,
      facilityProjects: r.facilityCount, auditGapsAddressed: [...r.gaps],
      inclusionTags: INCLUSION_TAGS.filter(t => r.tagSpend[t] > 0), firstNationsReach: r.fnReach,
      ...Object.fromEntries(customLayers().map(l => [l.label, l.values[r.name] ?? null])),
    }));
    // Pre-computed verdicts so small local models don't have to derive them (and get them wrong).
    const names = f => rows.filter(f).map(r => r.name);
    const flags = {
      aboveShareRegions: names(r => r.status === 'over'),
      belowShareRegions: names(r => r.status === 'under'),
      balancedRegions: names(r => r.status === 'balanced'),
      firstNationsProgramReachRegions: names(r => r.fnReach),
      firstNationsGapRegions_highFirstNationsPopulationButNoReach: names(r => r.fnGap),
      womenFocusedInvestmentRegions: names(r => r.tagSpend.women > 0),
      pasifikaCaldInvestmentRegions: names(r => r.tagSpend.pasifika > 0),
      accessibilityInvestmentRegions: names(r => r.tagSpend.access > 0),
      regionsWithNoFacilityProject: names(r => r.facilityCount === 0),
    };
    const base = {
      program: 'NSW Rugby World Cup Legacy Program ($10M, 2025-2028). Year 1 of 3.',
      flags,
      pillarTotals$: p,
      centralisation: {
        heldCentrallyByNSWRU$: c.central, centralSharePct: pct(c.centralShare),
        greaterSydneyShareOfRegionalSpendPct: pct(c.metroShareOfAllocated), greaterSydneyPopulationSharePct: pct(c.metroPopShare),
        greaterSydneyShareOfFacilityGrantsPct: pct(c.feMetroShare), inclusionBudgetHeldCentrallyPct: pct(c.incCentralShare),
      },
      regions,
      impact: impactContext(focus === 'IMP' ? 40 : 10),
      userFeedback: window.Feedback?.summary(),
      dataSourceQuality: Object.entries(Store.get('quality') || {}).map(([file, q]) => ({
        file, rating: q.ai?.rating || q.rule?.rating, score: q.ai?.score ?? q.rule?.score, verdict: q.ai?.verdict || undefined,
      })),
      kpis: kpiTargets().map(kpiLine),
      context: D.context,
      notes: 'Population and First Nations % are indicative approximations. spendVsPopIndex = region share of spend / share of population (>=1.75 above population share, <=0.5 below population share).',
    };
    if (focus === 'FE') base.facilityGrants = allGrants().filter(g => g.pillar === 'FE').map(g => ({ region: g.region, type: g.type, amount: g.amount }));
    if (focus === 'PW') base.workforceLines = D.dashboard.filter(d => d.pillar === 'PW').map(d => ({ initiative: d.initiative, region: d.region, total: d.total, status: d.status }));
    if (focus === 'INC') base.inclusionLines = D.dashboard.filter(d => d.pillar === 'INC').map(d => ({ initiative: d.initiative, total: d.total, tags: d.tags }));
    return base;
  }

  function impactContext(maxEvidence) {
    const cov = impactCoverage();
    return {
      note: 'Measures come only from established frameworks (each names its organisation). Status shows which have data today.',
      measures: Object.fromEntries(Object.entries(cov).map(([k, c]) => [k, c.measures.map(i => `${i.name} (${D.frameworks[i.framework].org}): ${i.value} [${i.status}]`)])),
      evidence: evidenceStore.all().slice(0, maxEvidence).map(e => ({ lens: e.lens, region: e.region, what: e.text, source: e.source, metric: e.metric || undefined, date: e.date })),
      evidenceCountByLens: Object.fromEntries(Object.keys(cov).map(k => [k, evidenceStore.all().filter(e => e.lens === k).length])),
    };
  }

  // Deterministic insights used when Ollama is unreachable, and as grounding facts.
  function ruleInsights() {
    const rows = regionMetrics();
    const c = centralisation(rows);
    const p = pillarTotals(rows);
    const out = [];
    const money = n => '$' + Math.round(n).toLocaleString();
    const over = rows.filter(r => r.status === 'over').sort((a, b) => b.spendIndex - a.spendIndex);
    const under = rows.filter(r => r.status === 'under').sort((a, b) => a.spendIndex - b.spendIndex);

    if (over.length) out.push({ pillar: 'Facilities & Equipment', severity: 'watch', region: over[0].name,
      title: `${over[0].name} draws ${over[0].spendIndex.toFixed(1)}x its population share`,
      insight: `${over.map(r => r.name).join(', ')} receive well above their population share of known spend. ${over[0].name} has ${money(over[0].total)} across ${over[0].facilityCount} facility projects.`,
      evidence: `${pct(over[0].spendShare)}% of regional spend vs ${pct(over[0].popShare)}% of population`,
      action: 'Check participation per resident before drawing conclusions: regional clubs often have higher rugby participation.' });
    if (under.length) out.push({ pillar: 'Facilities & Equipment', severity: 'watch', region: under[0].name,
      title: `${under.map(r => r.name).slice(0, 3).join(', ')} are below their population share`,
      insight: `These regions receive less than half their population share of known Legacy spend.`,
      evidence: under.map(r => `${r.name}: ${money(r.total)} (${r.spendIndex.toFixed(2)}x)`).join('; '),
      action: 'When the Round 2 recipients are announced, check whether any reach these regions; if not, point future funding and support there.' });
    out.push({ pillar: 'Facilities & Equipment', severity: 'watch',
      title: 'Equipment is the invisible line item',
      insight: 'Major equipment grants (e.g. scrum machines ~$11k) are planned for >20 clubs, but no equipment recipients are published and the dashboard has no Facilities & Equipment rows.',
      evidence: `Facility grants ${money(p.fe)}; dashboard F&E budget $0`,
      action: 'Add an equipment register and an F&E section to the dashboard.' });
    out.push({ pillar: 'Programs & Workforce', severity: 'positive',
      title: 'Coaches ahead, match officials close',
      insight: 'Accredited coaches grew 18% (needs 14.5% p.a.) and match officials 18% (needs 20.5% p.a.).',
      evidence: 'Player:MO ratio 56:1 vs 30:1 target',
      action: 'Shift a share of workforce spend toward MO recruitment and retention.' });
    out.push({ pillar: 'Programs & Workforce', severity: 'risk',
      title: 'Salaries end in 2028',
      insight: `${money(D.context.salariesOnDashboard)} (~37%) of the dashboard budget is wages for 8 roles that end with the grant, while NSWRU posted a ${money(D.context.nswruLoss2025)} loss in 2025.`,
      evidence: 'Dashboard code "RWC Wages"',
      action: 'Build a co-funding or absorption plan for each role by 2027.' });
    out.push({ pillar: 'Inclusion', severity: 'risk',
      title: 'Female participation behind target',
      insight: 'Women\'s game grew 6% against the ~14.5% a year needed for +50%. Only 31% of facilities have female-friendly changerooms.',
      evidence: `${rows.filter(r => r.tagSpend.women > 0).length} of ${rows.length} regions have women-focused investment`,
      action: 'Use female-friendly changerooms as a priority in future facility funding, and check the Round 2 list for them once announced.' });
    const fnGaps = rows.filter(r => r.fnGap);
    if (fnGaps.length) out.push({ pillar: 'Inclusion', severity: 'risk', region: fnGaps[0].name,
      title: `No First Nations reach in ${fnGaps.map(r => r.name).join(' & ')}`,
      insight: 'These regions have the highest First Nations population shares but no First Nations-tagged spend or talent ID workshop.',
      evidence: fnGaps.map(r => `${r.name} ~${r.fnShare}% First Nations`).join('; '),
      action: 'Add a talent ID day in Western NSW / New England (e.g. Dubbo hub, Brewarrina).' });
    out.push({ pillar: 'Centralisation', severity: c.centralShare > 0.35 ? 'watch' : 'positive',
      title: `${pct(c.centralShare)}% of known spend is held centrally`,
      insight: `${money(c.central)} sits in statewide NSWRU budgets, including ${pct(c.incCentralShare)}% of inclusion money. Facility grants are more distributed: ${pct(1 - c.feMetroShare)}% went outside Greater Sydney.`,
      evidence: `Greater Sydney: ${pct(c.metroShareOfAllocated)}% of regionally allocated spend vs ${pct(c.metroPopShare)}% of population`,
      action: 'Report statewide program delivery by region so central budgets can be traced to communities.' });
    const cov = impactCoverage();
    const evCount = l => evidenceStore.all().filter(e => e.lens === l).length;
    const covLine = l => `${cov[l].measured} of ${cov[l].total} established measures have data, ${cov[l].partial} partial; ${evCount(l)} field evidence record(s)`;
    const femaleSites = allGrants().filter(g => g.pillar === 'FE' && g.tags.includes('women'));
    out.push({ pillar: 'Impact', impact: 'social', severity: 'watch',
      title: 'Social capital is unmeasured for Legacy participants',
      insight: `The OECD social cohesion measures that NSW Rugby League benchmarked against the ABS General Social Survey (volunteering, confidants, isolation) have no NSW Rugby survey yet. ${femaleSites.length} Round 1 facility projects target women and girls, but whether women feel included and safe is not yet captured.`,
      evidence: covLine('social'),
      action: 'Add the ABS General Social Survey social capital questions to the end-of-season participant survey and compare with the national benchmarks.' });
    out.push({ pillar: 'Impact', impact: 'economic', severity: 'watch',
      title: 'Economic contribution can be measured with the NSWRL method',
      insight: 'NSW Rugby League\'s 2026 study measured economic contribution from club, competition and participant expenditure using published NSW retention rates and ABS-based multipliers. The same expenditure flow analysis can be applied to rugby union once expenditure by category is collected. Event visitor spending (RWC hubs) is not measured yet.',
      evidence: covLine('economic'),
      action: 'Collect club expenditure by category and a participant spend survey; use the eventIMPACTS visitor survey at the 2027 RWC hubs.' });
    out.push({ pillar: 'Impact', impact: 'cultural', severity: 'positive',
      title: 'Pasifika and First Nations participation is growing',
      insight: 'Across all NSW rugby, Rugby Analytics shows 3,174 First Nations participants and 3,486 Samoan, Fijian and Tongan participants in 2026. Nothing yet shows how many of them Legacy programs reached, and none of the five Cultural Development Network outcomes is surveyed yet.',
      evidence: covLine('cultural'),
      action: 'Survey participants and event attendees on the CDN outcomes (e.g. sense of belonging to a shared cultural heritage), collecting First Nations data under Indigenous Data Sovereignty principles.' });
    return out.map(i => ({ ...i, agent: 'Rule engine' }));
  }

  // Match a free-text value to a known region using names, LGAs and towns.
  function matchRegion(value) {
    if (value == null) return null;
    const v = String(value).toLowerCase().trim();
    if (!v) return null;
    for (const r of D.regions) if (r.name.toLowerCase() === v) return r.name;
    if (/^(statewide|state-wide|nsw|all regions|nsw-wide|central)$/.test(v)) return 'Statewide';
    let best = null, bestLen = 0;
    for (const [name, list] of Object.entries(D.aliases)) {
      for (const a of list) {
        if ((v === a || v.includes(a)) && a.length > bestLen) { best = name; bestLen = a.length; }
      }
    }
    return best;
  }

  // Guess pillar and inclusion tags for an uploaded spend row from its text.
  function classifySpend(text) {
    const t = String(text || '').toLowerCase();
    const tags = [];
    if (/women|female|girl/.test(t)) tags.push('women');
    if (/first nations|aboriginal|torres strait|indigenous|koori/.test(t)) tags.push('firstNations');
    if (/pasifika|pacific|islander|samoa|tonga|fiji|cald|multicultural|all nations/.test(t)) tags.push('pasifika');
    if (/disab|accessib|all abilities|inclusive/.test(t)) tags.push('access');
    let pillar = 'PW';
    if (/facilit|equipment|infrastructure|lighting|light|changeroom|change room|drainage|irrigation|amenit|clubhouse|field|pitch|scrum machine|goal post|capital/.test(t)) pillar = 'FE';
    else if (tags.length || /inclusion|diversity|pride|safeguard|integrity/.test(t)) pillar = 'INC';
    return { pillar, tags };
  }

  // Add or replace a dataset's contribution (spend rows / layers) to the dashboard.
  function saveDataset(record) {
    const list = (Store.get('datasets') || []).filter(d => d.id !== record.id);
    Store.set('datasets', [...list, record]);
  }
  function removeDataset(id) {
    Store.set('datasets', (Store.get('datasets') || []).filter(d => d.id !== id));
  }

  const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const pct = x => Math.round(x * 1000) / 10;

  // ---------- targets (adjustable) ----------
  // Plan targets from data.js with staff adjustments (Store 'targets': { id: { target, targetYear } }) applied.
  // Status rule from the Data Compilation: Ahead if actual >= needed, Close if >= 80% of needed, else Behind.
  const rate = (actual, needed) => actual >= needed ? 'Ahead' : actual >= 0.8 * needed ? 'Close' : 'Behind';
  function kpiTargets() {
    const year = new Date().getFullYear();
    const ms = measures();
    return D.kpis.map(base => {
      const k = { ...base };
      // actualFrom explains where the actual came from (shown on hover in the Targets tab).
      k.actualFrom = k.actual == null ? 'No figure published yet' : `Typed in from: ${k.source}`;
      if (k.actual === 'grantsFE') {
        const fe = allGrants().filter(g => g.pillar === 'FE');
        k.actual = fe.length;
        k.actualFrom = `Counted live: ${fe.length} Facilities & Equipment grants (${D.grants.filter(g => g.pillar === 'FE').length} Round 1 + ${fe.length - D.grants.filter(g => g.pillar === 'FE').length} uploaded)`;
      }
      // Demo view only: made-up values fill what is not published. Staff entries and real figures always win.
      const dm = window.DemoView?.target(base.id);
      if (dm) {
        const used = [];
        if (k.actual == null && dm.actual != null) { k.actual = dm.actual; k.actualYear = k.actualYear || year; used.push('actual'); }
        if (k.target == null && dm.target != null) { k.target = dm.target; used.push('target'); }
        if (k.baseline == null && dm.baseline != null) { k.baseline = dm.baseline; used.push('baseline'); }
        if (used.length) { k.dummy = true; k.actualFrom = `[DUMMY] made-up ${used.join(', ')} from demo/Dummy-dataset.csv, not collected data.`; }
      }
      // An uploaded yearly series replaces the typed-in growth figure (same file, same definition for both years).
      const m = k.measure && ms[k.measure];
      const g = m && k.kind === 'growth' && latestGrowth(m.series);
      if (g) {
        k.actual = g.growth; k.actualYear = g.year; k.fromUpload = m.dataset; k.dummy = false;
        k.actualFrom = `From upload "${m.dataset}" (${m.sheet}, "${m.header}"): ${g.year} ${Math.round(g.value).toLocaleString('en-AU')} ÷ ${g.prevYear} ${Math.round(g.prevValue).toLocaleString('en-AU')} − 1 = ${(g.growth * 100).toFixed(1)}%. Note: the plan baseline (${k.baseline?.toLocaleString('en-AU') ?? 'not recorded'}, ${k.baseYear}) comes from ${k.source.split(':')[0]}, which may count ${m.label.toLowerCase()} differently.`;
      }
      k.planTarget = base.target; k.planYear = base.targetYear;
      if (k.kind === 'growth') {
        const years = k.targetYear - k.baseYear;
        k.requiredPa = k.target != null && years > 0 ? (1 + k.target) ** (1 / years) - 1 : null;
        k.targetValue = k.target != null && k.baseline != null ? Math.round(k.baseline * (1 + k.target)) : null;
        k.status = k.target == null ? 'No target' : years <= 0 ? 'Check year' : k.actual == null ? 'No data' : rate(k.actual, k.requiredPa);
      } else if (k.kind === 'annual') {
        k.expected = k.target;
        k.status = k.target == null ? 'No target' : k.actual == null ? 'No data' : rate(k.actual, k.target);
      } else if (k.kind === 'level') {
        // Moves from baseline toward target in either direction (lower is better when target < baseline).
        const dir = k.target != null && k.target < k.baseline ? -1 : 1;
        const span = k.targetYear - k.baseYear;
        k.lowerIsBetter = dir < 0;
        k.asAt = Math.min(Math.max(year, k.baseYear), k.targetYear);
        k.expected = k.target != null && span > 0 ? k.baseline + (k.target - k.baseline) * (k.asAt - k.baseYear) / span : null;
        k.status = k.target == null ? 'No target' : span <= 0 ? 'Check year' : k.actual == null ? 'No data'
          : (k.actual - k.target) * dir >= 0 ? 'Achieved' : rate((k.actual - k.baseline) * dir, (k.expected - k.baseline) * dir);
      } else {
        const start = k.kind === 'share' ? k.baseYear : k.startYear;
        const from = k.kind === 'share' ? k.baseline : 0;
        const span = k.targetYear - start;
        k.asAt = Math.min(Math.max(year, start), k.targetYear);
        k.expected = k.target != null && span > 0 ? from + (k.target - from) * (k.asAt - start) / span : null;
        k.status = k.target == null ? 'No target' : span <= 0 ? 'Check year' : k.actual == null ? 'No data'
          : k.actual >= k.target ? 'Achieved' : rate(k.actual - from, k.expected - from);
      }
      return k;
    });
  }
  const kpiLine = k => (k.group ? `[${k.group}] ` : '') + (k.kind === 'growth'
    ? `${k.name}: baseline ${k.baseline != null ? k.baseline.toLocaleString('en-AU') + ' (' + k.baseYear + ')' : 'not recorded'} -> ${k.target != null ? '+' + pct(k.target) + '% by ' + k.targetYear + (k.targetValue != null ? ' (' + k.targetValue.toLocaleString('en-AU') + ')' : '') : 'no target set'}; needs ${k.requiredPa != null ? pct(k.requiredPa) + '% p.a.' : '-'}; ${k.actualYear} actual ${k.actual == null ? 'no data' : '+' + pct(k.actual) + '%'}; ${k.status}`
    : k.kind === 'annual'
    ? `${k.name}: target ${k.target != null ? k.target + ' ' + k.unit + ' to ' + k.targetYear : 'not set'}; latest year ${k.actual == null ? 'no data' : k.actual}; ${k.status}`
    : k.kind === 'level'
    ? `${k.name}: baseline ${k.baseline}${k.unit} (${k.baseYear}) -> target ${k.target != null ? k.target + k.unit + ' by ' + k.targetYear : 'not set'}${k.lowerIsBetter ? ' (lower is better)' : ''}; actual ${k.actual == null ? 'no data' : k.actual + k.unit + (k.actualYear ? ' (' + k.actualYear + ')' : '')}${k.expected != null ? `; on pace = ~${+k.expected.toFixed(1)}${k.unit} by ${k.asAt}` : ''}; ${k.status}`
    : `${k.name}:`) + (k.kind === 'growth' || k.kind === 'annual' || k.kind === 'level' ? '' : ` ${k.kind === 'share' ? `baseline ${k.baseline}% ${k.unit || 'of facilities'} -> ` : ''}target ${k.target != null ? k.target + (k.kind === 'share' ? '%' : ' ' + k.unit) + ' by ' + k.targetYear : 'not set'}; actual ${k.actual == null ? 'no data' : k.actual + (k.kind === 'share' ? '%' : '')}${k.expected != null ? `; expected by ${k.asAt} ~${Math.round(k.expected)}${k.kind === 'share' ? '%' : ''}` : ''}; ${k.status}`);

  return { allGrants, kpiTargets, regionMetrics, centralisation, pillarTotals, contextFor, briefing, ruleInsights, matchRegion, classifySpend, saveDataset, removeDataset, customLayers, uploadedSpend, INCLUSION_TAGS, MEASURES, measures, latestGrowth, impactCoverage, evidenceStore };
})();
