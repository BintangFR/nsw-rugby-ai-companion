// Insights > Recommendations: each one connects the data as a chain: what happened → likely cause → "Since X, we can Y",
// with a link to the page holding the figures. Everything is calculated in code from the app's data, so it stays correct
// without the AI, and each shows its working on hover. A "likely cause" is what the data points to, not proof.
// Targets and surveys count Demo view figures like real ones; the program comparison is tagged [DUMMY] when it uses them.
(() => {
  const { $, esc } = window.App;
  const A = window.Analytics;
  const n = v => Math.round(v).toLocaleString('en-AU');
  const tip = s => `data-tip="${esc(s)}" tabindex="0"`;
  const years = m => Object.keys(m?.series || {}).map(Number).filter(y => Number.isFinite(m.series[y])).sort((a, b) => a - b);
  const latest = m => { const ys = years(m); if (!ys.length) return null; const y = ys[ys.length - 1]; return { y, v: m.series[y], from: m.dataset }; };
  // "from 3,262 in 2023 to 3,752 in 2026 (+15%)" for a yearly series.
  const trend = m => { const ys = years(m); if (ys.length < 2) return null; const [a, b] = [ys[0], ys[ys.length - 1]], g = m.series[b] / m.series[a] - 1; return { text: `from ${n(m.series[a])} in ${a} to ${n(m.series[b])} in ${b}`, g, a, b }; };
  const pctTxt = g => `${g >= 0 ? '+' : ''}${(g * 100).toFixed(0)}%`;
  const names = list => list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  const money = v => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${n(v)}`;

  // Known spend on lines whose name or type matches, across grants and dashboard budgets.
  function spendOn(re) {
    const D = window.TACKLE_DATA;
    return [...A.allGrants().map(g => [`${g.project} ${g.type || ''}`, g.amount]), ...D.dashboard.map(d => [d.initiative, d.total])].filter(([t]) => re.test(t)).reduce((s, [, v]) => s + v, 0);
  }

  function build() {
    const out = [], ms = A.measures(), ks = Object.fromEntries(A.kpiTargets().map(k => [k.id, k]));

    // Start with the money: what the $10M can and cannot show yet.
    const known = A.centralisation().knownTotal, funding = window.TACKLE_DATA.context.totalLegacyFunding;
    if (funding > known) out.push({ area: 'Funding', page: 'impact',
      since: `${money(known)} of the ${money(funding)} is allocated to a project or budget line so far`,
      can: `we can measure impact on that part now, and set up data collection for the other ${money(funding - known)} before it is committed`,
      happened: `Round 1 grants and 3-year budget lines account for ${Math.round(known / funding * 100)}% of the funding.`,
      cause: 'Round 2 grants are decided but not yet announced, and money not on a line cannot be linked to a result.',
      how: `${money(funding)} − ${money(known)} = ${money(funding - known)}. Allocations, not audited spend.` });
    const pl = latest(ms.players), co = latest(ms.coaches), mo = latest(ms.matchOfficials), plT = trend(ms.players);

    // Workforce needed = players ÷ the plan's target ratio, minus who we have now.
    const ratio = (who, m, k, spendRe, spendLabel, can, done) => {
      const cur = latest(m), t = trend(m);
      if (!pl || !cur || k?.target == null) return;
      const need = Math.ceil(pl.v / k.target) - cur.v, now = pl.v / cur.v, spent = spendOn(spendRe);
      out.push({ area: 'Workforce', page: 'data',
        since: `we have ${n(pl.v)} players and ${n(cur.v)} ${who}`, can: need > 0 ? can.replace('{need}', n(need)) : done,
        happened: `${who[0].toUpperCase() + who.slice(1)} went ${t ? `${t.text} (${pctTxt(t.g)})` : `to ${n(cur.v)}`}${plT ? `, while players went ${plT.text} (${pctTxt(plT.g)})` : ''}. That is ${now.toFixed(1)} players each, against a plan of ${k.target}:1.`,
        cause: need > 0 ? `${t && plT && t.g > plT.g ? `${who[0].toUpperCase() + who.slice(1)} are growing faster than players, but from a low base.` : `${who[0].toUpperCase() + who.slice(1)} are not growing faster than players.`} Known Legacy spend on ${spendLabel} is ${money(spent)}.` : `Growth in ${who} has outpaced players.`,
        how: `${n(pl.v)} players ÷ ${n(cur.v)} ${who} = ${now.toFixed(1)}.\nNeeded for ${k.target}:1 = ${n(pl.v)} ÷ ${k.target} = ${n(Math.ceil(pl.v / k.target))}, so ${need > 0 ? n(need) + ' more' : 'none more'}.\nSpend = known allocations on lines naming ${spendLabel}.\nSource: ${pl.from}, ${pl.y}. Target: ${k.source}` });
    };
    ratio('coaches', ms.coaches, ks.coachRatio, /coach/i, 'coaching', 'we can aim the next accreditation courses at the {need} more coaches needed to reach the plan ratio', 'we can move coaching effort from recruiting new coaches to keeping the ones we have');
    ratio('match officials', ms.matchOfficials, ks.moRatio, /referee|match official/i, 'referees and match officials', 'we can set a recruitment goal of about {need} more match officials, and pair new ones with mentors to keep them', 'we can move effort from recruiting officials to keeping them');

    const fe = latest(ms.femaleParticipants), fk = ks.femaleParticipation, audit = window.TACKLE_DATA.context.facilityAudit;
    if (fe && fk?.targetValue != null && fk.targetValue > fe.v) out.push({ area: 'Inclusion', page: 'data',
      since: `we have ${n(fe.v)} female participants and the plan aims for ${n(fk.targetValue)} by ${fk.targetYear}`,
      can: `we can focus girls' programs and female-friendly facility grants on finding the remaining ${n(fk.targetValue - fe.v)} participants`,
      happened: `Female participation moved from ${n(fk.baseline)} in ${fk.baseYear} to ${n(fe.v)} in ${fe.y}, and the plan needs ${(fk.requiredPa * 100).toFixed(1)}% growth a year.`,
      cause: `Facilities may be holding this back: the infrastructure audit found only ${audit.femaleChangerooms}% have female-friendly changerooms.`,
      how: `Plan: baseline ${n(fk.baseline)} (${fk.baseYear}) + ${Math.round(fk.target * 100)}% = ${n(fk.targetValue)}.\nGap: ${n(fk.targetValue)} − ${n(fe.v)} = ${n(fk.targetValue - fe.v)}.\nSource: ${fe.from}, ${fe.y}. The plan and the upload may count participants differently. The cause is a possibility from the audit, not a measured link.` });

    const rows = A.regionMetrics(), fn = latest(ms.firstNationsParticipants), gaps = rows.filter(r => r.fnGap);
    if (fn && gaps.length) {
      const c = A.centralisation();
      out.push({ area: 'Inclusion', page: 'map',
        since: `we have ${n(fn.v)} First Nations participants, and ${names(gaps.map(r => r.name))} ${gaps.length > 1 ? 'have' : 'has'} a high First Nations population but no program yet`,
        can: `we can plan the next talent ID workshops in ${gaps.length > 1 ? 'those regions' : 'that region'} with the local community`,
        happened: `${gaps.map(r => `${r.name} (about ${r.fnShare}% First Nations)`).join(', ')} ${gaps.length > 1 ? 'have' : 'has'} no First Nations-tagged spend or workshop.`,
        cause: `${Math.round(c.incCentralShare * 100)}% of the inclusion budget is held centrally, so it does not yet reach specific regions.`,
        how: `Participants: ${fn.from}, ${fn.y}.\nGap regions are flagged from indicative population shares and known First Nations program reach. A screening indicator, so check with community first.` });
    }

    const pa = latest(ms.pasifikaParticipants), pr = ks.pasifikaRoles;
    if (pa && pr?.baseline != null) out.push({ area: 'Inclusion', page: 'data',
      since: `we have ${n(pa.v)} Samoan, Tongan and Fijian participants, and Pasifika people hold ${pr.baseline}% of non-playing roles`,
      can: 'we can invite more Pasifika players and families into coaching, refereeing and club roles',
      happened: 'Pasifika people are over 11% of players but a much smaller share of coaches, officials and administrators.',
      cause: 'Playing numbers have grown ahead of pathways into non-playing roles. The plan sets no number for this yet.',
      how: `Participants: ${pa.from}, ${pa.y}. Heritage labels changed over time, so do not read growth from this figure.\nRole share: ${pr.source}` });

    const c = A.centralisation();
    out.push({ area: 'Spending', page: 'map',
      since: `${money(c.central)} (${Math.round(c.centralShare * 100)}%) of known spend sits in statewide budgets`,
      can: 'we can record where those budgets are delivered, by region, so fairness can be checked properly',
      happened: `Facility grants are spread widely (${Math.round((1 - c.feMetroShare) * 100)}% outside Greater Sydney), but workforce and inclusion money is mostly held centrally.`,
      cause: 'Statewide budget lines are recorded as one amount, with no region attached.',
      how: 'Spend on lines marked Statewide ÷ all known spend. Known allocations, not audited spend.' });

    // Zones where several things stand out at once (falling participation, no facility grant, low funding per head).
    const z2 = (window.Round2?.zones?.list || []).map(x => ({ x, key: x.notes.filter(([l]) => /falling|No Round 1 facility|Low Legacy funding/.test(l)) })).filter(o => o.key.length >= 2)
      .sort((a, b) => b.key.length - a.key.length || (a.x.growth ?? 0) - (b.x.growth ?? 0));
    if (z2.length) {
      const top = z2.slice(0, 3), first = top[0].x;
      out.push({ area: 'Zones', page: 'round2',
        since: top.map(o => `${o.x.name} ${[o.x.growth < 0 ? `saw participation fall ${Math.abs(o.x.growth * 100).toFixed(1)}%` : '', !o.x.facility ? 'has no Round 1 facility grant' : '', o.x.perHead != null && o.key.some(([l]) => /Low Legacy/.test(l)) ? `received ${money(o.x.perHead)} of Legacy funding per participant` : ''].filter(Boolean).join(' and ')}`).join('; '),
        can: `we can check whether the Round 2 list reaches these zones when it is announced, and point future funding, club support and data collection there`,
        happened: top.map(o => `${o.x.name}: ${o.x.growth == null ? '' : `participation ${o.x.growth >= 0 ? '+' : ''}${(o.x.growth * 100).toFixed(1)}%, `}${money(o.x.legacy)} in Round 1 (${o.x.perHead == null ? '-' : money(o.x.perHead)} per participant)`).join('; ') + '.',
        cause: 'Round 1 money followed the clubs that applied, so zones with fewer applications received less. The data does not show why participation fell.',
        how: `Zones with at least two of: participation falling, no Round 1 facility grant, Legacy funding per participant under half the all-zone figure. Rugby Analytics association exports; zone mapping provisional (Dataset/round2-zones.csv).` });
    }

    const fac = window.Activity?.facilities() || [];
    const noSurvey = fac.filter(p => !window.Activity.survey(p)).length;
    if (fac.length && noSurvey) out.push({ area: 'Data', page: 'impact',
      since: `${noSurvey} of ${fac.length} funded facilities have no life satisfaction survey`,
      can: 'we can add the one-question survey to end-of-season surveys and acquittal reports',
      happened: 'Grants were announced on 6 May 2026, and no project has been completed yet.',
      cause: 'Recipients only report at acquittal, when their project ends (31/12/2027 or 30/06/2028), so nothing measures the effect before then.',
      how: `Question: "${window.Activity.QUESTION}" (ASC Community Perceptions Monitor, with a national benchmark). Project terms: published grant recipient lists.` });

    return out;
  }

  function render() {
    const host = $('#recoList');
    if (!host) return;
    const list = build();
    host.innerHTML = list.length ? list.map(r => `<li class="reco">
        <div class="reco-head"><span class="impact-chip method">${esc(r.area)}</span><b ${tip(`How this is worked out:\n${r.how}`)}>Since ${esc(r.since)}, ${esc(r.can)}.</b>${window.DemoView.tag(r.dummy)}</div>
        <div class="reco-chain"><div><span>What happened</span>${esc(r.happened)}</div><i aria-hidden="true">→</i><div><span>Likely cause</span>${esc(r.cause)}</div></div>
        ${r.page === 'data' ? '<a href="#" class="reco-link" data-goto="data">See the data in Data Studio →</a>' : `<a href="#${{ map: 'dashMap', round2: 'round2Card' }[r.page] || 'dashImpact'}" class="reco-link">See it on ${{ map: 'the map', round2: 'the zone view' }[r.page] || 'Impact'} →</a>`}
      </li>`).join('')
      : '<li class="muted">Recommendations appear once the project files have loaded.</li>';
  }

  ['app-ready', 'data-changed', 'round2-ready'].forEach(ev => document.addEventListener(ev, render));
  window.Recommendations = { build, render };
})();
