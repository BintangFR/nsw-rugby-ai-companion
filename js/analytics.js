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

  // Which impacts a line of spend is expected to drive. Lenses overlap: one dollar can count in several.
  function impactsOf(item) {
    const set = new Set();
    const name = (item.initiative || item.project || '') + ' ' + (item.type || '');
    if (item.pillar === 'FE') set.add('economic');                      // construction, local trades
    if (item.pillar === 'ACT') { set.add('economic'); set.add('cultural'); } // event hubs: visitors + gatherings
    if (item.pillar === 'PW' || item.pillar === 'INC') set.add('social');
    if (item.tags.some(t => t === 'women' || t === 'access')) set.add('social');
    if (item.tags.some(t => t === 'pasifika' || t === 'firstNations') || /pasifika|first nations|aboriginal|torres strait|indigenous|koori|naidoc|reconciliation|ella 7s|all nations|pride/i.test(name)) set.add('cultural');
    if (/rugby for good|r4g|integrity|safeguard/i.test(name)) set.add('social');
    if (/competition|comps|academy|development centre/i.test(name) && item.region === 'Western Sydney') set.add('cultural'); // high-CALD region
    return [...set];
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
  const allGrants = () => [...D.grants, ...uploadedSpend()];

  function impactTotals() {
    const lenses = { social: 0, economic: 0, cultural: 0 };
    const central = { social: 0, economic: 0, cultural: 0 };
    for (const item of [...allGrants().map(g => ({ ...g, total: g.amount })), ...D.dashboard]) {
      for (const l of impactsOf(item)) { lenses[l] += item.total; if (item.region === 'Statewide') central[l] += item.total; }
    }
    return { lenses, central };
  }

  function regionMetrics() {
    const rows = D.regions.map(r => ({
      ...r, fe: 0, pw: 0, inc: 0, total: 0, facilityCount: 0, gaps: new Set(), social: 0, economic: 0, cultural: 0, evidenceCount: 0,
      tagSpend: { women: 0, firstNations: 0, pasifika: 0, access: 0 }, items: [],
    }));
    const byName = Object.fromEntries(rows.map(r => [r.name, r]));

    for (const gr of allGrants()) {
      const r = byName[gr.region];
      if (!r) continue;
      addSpend(r, gr.pillar, gr.amount, gr.tags);
      for (const l of impactsOf(gr)) r[l] += gr.amount;
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
      for (const l of impactsOf(row)) r[l] += row.total;
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
      r.inclusionIndex = r.total ? 0.5 * Math.min(1, incSpend / r.total) + 0.5 * (r.tagsCovered / INCLUSION_TAGS.length) : 0;
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
    const hhi = sum(rows, r => r.spendShare ** 2);
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
      hhi, hhiEquivalentRegions: 1 / hhi,
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
    const imp = impactTotals();
    const fw = D.impactFramework;
    const ev = evidenceStore.all().slice(0, 15);
    const quality = Object.entries(Store.get('quality') || {});
    const layers = customLayers();
    const lines = [
      'PROGRAM: NSW Rugby World Cup Legacy Program, $10M, 2025-2028 (year 1 of 3). All $ are known allocations, not audited spend. Population and First Nations % are indicative.',
      `PILLAR TOTALS: Facilities & Equipment ${m(p.fe)}; Programs & Workforce ${m(p.pw)}; Inclusion ${m(p.inc)}; RWC activation + M&E + PM ${m(p.other)}.`,
      `CENTRALISATION: ${m(c.central)} (${pct(c.centralShare)}%) held centrally in statewide NSWRU budgets. Greater Sydney gets ${pct(c.metroShareOfAllocated)}% of regionally allocated spend with ${pct(c.metroPopShare)}% of population. ${pct(1 - c.feMetroShare)}% of facility grant $ went outside Greater Sydney. ${pct(c.incCentralShare)}% of inclusion budget is held centrally. Effective number of regions funded: ${c.hhiEquivalentRegions.toFixed(1)} of ${rows.length}.`,
      'FLAGS (ground truth - use exactly):',
      `- Overspend risk (spend share >= 1.75x population share): ${names(r => r.status === 'over')}`,
      `- Under-served (<= 0.5x): ${names(r => r.status === 'under')}`,
      `- Balanced: ${names(r => r.status === 'balanced')}`,
      `- First Nations program reach: ${names(r => r.fnReach)}`,
      `- First Nations GAP (high First Nations population, no program): ${names(r => r.fnGap)}`,
      `- Women & girls investment: ${names(r => r.tagSpend.women > 0)}`,
      `- Pasifika/CALD investment: ${names(r => r.tagSpend.pasifika > 0)}`,
      `- Accessibility investment: ${names(r => r.tagSpend.access > 0)}`,
      `- No facility project: ${names(r => r.facilityCount === 0)}`,
      'REGIONS (name | Greater Sydney? | population | First Nations % | facilities $ | workforce $ | inclusion $ | total $ | $ per resident | spend vs population | status | facility projects | audit gaps fixed | social $ | economic $ | cultural $' + layers.map(l => ' | ' + l.label).join('') + '):',
      ...rows.map(r => [r.name, r.metro ? 'yes' : 'no', (r.pop * 1000).toLocaleString('en-AU'), r.fnShare + '%', m(r.fe), m(r.pw), m(r.inc), m(r.total), '$' + r.perResident.toFixed(2), r.spendIndex.toFixed(2) + 'x', r.status, r.facilityCount, [...r.gaps].join('+') || '-', m(r.social), m(r.economic), m(r.cultural), ...layers.map(l => l.values[r.name] ?? '-')].join(' | ')),
      'FACILITY GRANTS: ' + allGrants().filter(g => g.pillar === 'FE').map(g => `${g.town || g.region} (${g.region}) ${g.type} ${m(g.amount)}`).join('; '),
      'STATEWIDE BUDGET LINES (3 yrs): ' + D.dashboard.filter(d => d.region === 'Statewide').map(d => `${d.initiative} ${m(d.total)}`).join('; '),
      'TARGETS (Ahead/Close/Behind vs the pace needed to hit each target by its target year): ' + kpiTargets().map(kpiLine).join(' | '),
      `CONTEXT: Facility audit - ${D.context.facilityAudit.femaleChangerooms}% female-friendly changerooms, ${D.context.facilityAudit.adequateLighting}% adequate lighting, ${D.context.facilityAudit.adequateDrainage}% adequate drainage. Ratios: player:coach ${D.context.ratios.playerToCoach}, player:MO ${D.context.ratios.playerToMO}. ${D.context.workforceRepresentation} ${D.context.westernSydney} ${D.context.volunteers} ${D.context.equipment} ${D.context.round2} ${D.context.socialValue} Wages ${m(D.context.salariesOnDashboard)} of dashboard budget end in 2028; NSWRU 2025 loss ${m(D.context.nswruLoss2025)}. Holroyd: $1 of grant unlocked $${D.context.holroydLeverage} of project spend.`,
      `IMPACT (lenses overlap): social ${m(imp.lenses.social)}, economic ${m(imp.lenses.economic)}, cultural ${m(imp.lenses.cultural)}.`,
      ...Object.entries(fw).map(([k, v]) => `- ${v.label} indicators: ` + v.indicators.map(i => `${i.name} [${i.status === 'none' ? 'NO DATA' : i.status}${i.status === 'none' ? '' : ': ' + i.value}]`).join('; ')),
      ...(window.Econ ? window.Econ.contextLines() : []),
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
      socialImpact$: r.social, economicImpact$: r.economic, culturalImpact$: r.cultural,
      ...Object.fromEntries(customLayers().map(l => [l.label, l.values[r.name] ?? null])),
    }));
    // Pre-computed verdicts so small local models don't have to derive them (and get them wrong).
    const names = f => rows.filter(f).map(r => r.name);
    const flags = {
      overspendRiskRegions: names(r => r.status === 'over'),
      underServedRegions: names(r => r.status === 'under'),
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
        effectiveNumberOfRegions: +c.hhiEquivalentRegions.toFixed(1),
      },
      regions,
      impact: impactContext(focus === 'IMP' ? 40 : 10),
      userFeedback: window.Feedback?.summary(),
      dataSourceQuality: Object.entries(Store.get('quality') || {}).map(([file, q]) => ({
        file, rating: q.ai?.rating || q.rule?.rating, score: q.ai?.score ?? q.rule?.score, verdict: q.ai?.verdict || undefined,
      })),
      kpis: kpiTargets().map(kpiLine),
      context: D.context,
      notes: 'Population and First Nations % are indicative approximations. spendVsPopIndex = region share of spend / share of population (>=1.75 overspend risk, <=0.5 underserved).',
    };
    if (focus === 'FE') base.facilityGrants = allGrants().filter(g => g.pillar === 'FE').map(g => ({ region: g.region, type: g.type, amount: g.amount }));
    if (focus === 'PW') base.workforceLines = D.dashboard.filter(d => d.pillar === 'PW').map(d => ({ initiative: d.initiative, region: d.region, total: d.total, status: d.status }));
    if (focus === 'INC') base.inclusionLines = D.dashboard.filter(d => d.pillar === 'INC').map(d => ({ initiative: d.initiative, total: d.total, tags: d.tags }));
    return base;
  }

  function impactContext(maxEvidence) {
    const { lenses, central } = impactTotals();
    const fw = D.impactFramework;
    return {
      note: 'byLens = known $ expected to drive each kind of impact (lenses overlap). Indicators show which measures have data today.',
      byLens$: lenses, heldCentrally$: central,
      indicators: Object.fromEntries(Object.entries(fw).map(([k, v]) => [k, v.indicators.map(i => `${i.name}: ${i.value} [${i.status}]`)])),
      evidence: evidenceStore.all().slice(0, maxEvidence).map(e => ({ lens: e.lens, region: e.region, what: e.text, source: e.source, metric: e.metric || undefined, date: e.date })),
      evidenceCountByLens: Object.fromEntries(Object.keys(fw).map(k => [k, evidenceStore.all().filter(e => e.lens === k).length])),
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
      action: 'Check participation density before calling this overspend - regional clubs often have higher rugby participation per resident.' });
    if (under.length) out.push({ pillar: 'Facilities & Equipment', severity: 'risk', region: under[0].name,
      title: `${under.map(r => r.name).slice(0, 3).join(', ')} look underserved`,
      insight: `These regions receive less than half their population share of known Legacy spend.`,
      evidence: under.map(r => `${r.name}: ${money(r.total)} (${r.spendIndex.toFixed(2)}x)`).join('; '),
      action: 'Prioritise in Round 2 facility assessment (outcomes from Nov 2026).' });
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
      action: 'Weight Round 2 facility scoring toward female-friendly changerooms.' });
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
    const { lenses } = impactTotals();
    const evCount = l => evidenceStore.all().filter(e => e.lens === l).length;
    const femaleSites = allGrants().filter(g => g.pillar === 'FE' && g.tags.includes('women'));
    out.push({ pillar: 'Impact', impact: 'social', severity: evCount('social') ? 'positive' : 'watch',
      title: 'Women-friendly facilities are the social lever',
      insight: `${femaleSites.length} Round 1 facility projects target women and girls (${femaleSites.map(g => g.town).join(', ')}). Only 31% of facilities had female-friendly changerooms at baseline, and there is no measure yet of whether women feel safe at the ground.`,
      evidence: `${money(lenses.social)} of known spend drives social impact; ${evCount('social')} field evidence record(s)`,
      action: 'Add a "Do you feel safe and welcome here?" question to the end-of-season survey at funded sites.' });
    out.push({ pillar: 'Impact', impact: 'economic', severity: 'watch',
      title: 'Local economic benefit is real but unmeasured',
      insight: `Facility works put ${money(sum(allGrants().filter(g => g.pillar === 'FE'), g => g.amount))} into local trades, ${pct(1 - c.feMetroShare)}% of it outside Greater Sydney, and Holroyd showed $${D.context.holroydLeverage} of total project spend for every $1 of grant. Nothing yet captures game-day spending at local shops or visitor spend.`,
      evidence: `${money(lenses.economic)} of known spend drives economic impact; ${evCount('economic')} field evidence record(s)`,
      action: 'Run a 3-question survey of businesses near funded grounds on game days and at RWC hubs in 2027.' });
    out.push({ pillar: 'Impact', impact: 'cultural', severity: 'watch',
      title: 'Cultural activation is funded centrally, not locally',
      insight: `Pasifika and First Nations programs are almost all statewide budgets. The Juniors All Nations 7s Cup in Cumberland is the only multicultural grant, and community gatherings at funded grounds are not tracked.`,
      evidence: `${money(lenses.cultural)} of known spend drives cultural impact; ${evCount('cultural')} field evidence record(s)`,
      action: 'Log cultural and community events at funded venues, and report statewide Pasifika and First Nations programs by region.' });
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
    const adj = Store.get('targets') || {};
    const year = new Date().getFullYear();
    return D.kpis.map(base => {
      const a = adj[base.id] || {};
      const k = { ...base, target: a.target !== undefined ? a.target : base.target, targetYear: a.targetYear ?? base.targetYear, adjusted: !!(a.target !== undefined || a.targetYear) };
      if (k.actual === 'grantsFE') k.actual = allGrants().filter(g => g.pillar === 'FE').length;
      k.planTarget = base.target; k.planYear = base.targetYear;
      if (k.kind === 'growth') {
        const years = k.targetYear - k.baseYear;
        k.requiredPa = k.target != null && years > 0 ? (1 + k.target) ** (1 / years) - 1 : null;
        k.targetValue = k.target != null && k.baseline != null ? Math.round(k.baseline * (1 + k.target)) : null;
        k.status = k.target == null ? 'No target' : years <= 0 ? 'Check year' : k.actual == null ? 'No data' : rate(k.actual, k.requiredPa);
      } else if (k.kind === 'annual') {
        k.expected = k.target;
        k.status = k.target == null ? 'No target' : k.actual == null ? 'No data' : rate(k.actual, k.target);
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
  function setTarget(id, patch) {
    const all = { ...(Store.get('targets') || {}) };
    if (patch === null) delete all[id]; else all[id] = { ...(all[id] || {}), ...patch };
    Store.set('targets', all);
  }
  const kpiLine = k => (k.group ? `[${k.group}] ` : '') + (k.kind === 'growth'
    ? `${k.name}: baseline ${k.baseline != null ? k.baseline.toLocaleString('en-AU') + ' (' + k.baseYear + ')' : 'not recorded'} -> ${k.target != null ? '+' + pct(k.target) + '% by ' + k.targetYear + (k.targetValue != null ? ' (' + k.targetValue.toLocaleString('en-AU') + ')' : '') : 'no target set'}; needs ${k.requiredPa != null ? pct(k.requiredPa) + '% p.a.' : '-'}; ${k.actualYear} actual ${k.actual == null ? 'no data' : '+' + pct(k.actual) + '%'}; ${k.status}${k.adjusted ? ' (target adjusted by staff)' : ''}`
    : k.kind === 'annual'
    ? `${k.name}: target ${k.target != null ? k.target + ' ' + k.unit + ' to ' + k.targetYear : 'not set'}; latest year ${k.actual == null ? 'no data' : k.actual}; ${k.status}${k.adjusted ? ' (target adjusted by staff)' : ''}`
    : `${k.name}:`) + (k.kind === 'growth' || k.kind === 'annual' ? '' : ` ${k.kind === 'share' ? `baseline ${k.baseline}% ${k.unit || 'of facilities'} -> ` : ''}target ${k.target != null ? k.target + (k.kind === 'share' ? '%' : ' ' + k.unit) + ' by ' + k.targetYear : 'not set'}; actual ${k.actual == null ? 'no data' : k.actual + (k.kind === 'share' ? '%' : '')}${k.expected != null ? `; expected by ${k.asAt} ~${Math.round(k.expected)}${k.kind === 'share' ? '%' : ''}` : ''}; ${k.status}${k.adjusted ? ' (target adjusted by staff)' : ''}`);

  return { kpiTargets, setTarget, regionMetrics, centralisation, pillarTotals, contextFor, briefing, ruleInsights, matchRegion, classifySpend, saveDataset, removeDataset, customLayers, uploadedSpend, INCLUSION_TAGS, impactsOf, impactTotals, evidenceStore };
})();
