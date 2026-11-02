// Framework tab: the impact measurement framework as a tool-independent specification, for anyone who wants to
// build the same thing in another form (spreadsheet, survey platform, BI dashboard, database, another app).
// Everything is generated from the definitions the app itself calculates with (js/kpi-framework.js, js/data.js,
// js/methods.js), so the specification and the app cannot drift apart.
// Downloads: standalone HTML (print / PDF), machine-readable JSON, and a CSV of every input field.
(() => {
  const { $, esc } = window.App;
  const D = window.TACKLE_DATA, KF = window.KPIF;
  const DIMS = ['Economic', 'Social', 'Cultural'];
  const PILLARS = [['P1', 'Facilities & Equipment'], ['P2', 'Priority Regions & Pathways'], ['P3', 'Programs & Workforce'], ['P4', 'Inclusion'], ['P5', 'RWC Activation']];
  const STATE = { active: 'Active', conditional: 'Research only — not activated', inactive: 'Inactive — ID retained, no calculation', qualitative: 'Qualitative only' };
  const REQ = r => r === 'req' ? 'Required' : r === 'partial' ? 'Required if capture is Partial' : r?.startsWith('group:') ? 'Required per practice (all six or none)' : 'Optional';
  const TYPE = t => ({ int: 'Whole number ≥ 0', dec: 'Decimal ≥ 0', sdec: 'Decimal (may be negative)', bool: 'Yes / No', date: 'ISO date', text: 'Text' }[t] || (t.startsWith('enum:') ? 'One of: ' + t.slice(5).split('|').join(' / ') : t));
  const primaryPillar = k => (k.pillar.match(/P\d/) || ['—'])[0];
  const table = (head, rows) => `<div class="table-scroll"><table class="pretty-table method-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  const STATUS_MODEL = [
    [KF.STATUS.VERIFIED, 'All required inputs present and valid, operational record with permission Approved, source Verified, checks passed, complete capture.'],
    [KF.STATUS.ESTIMATED, 'As above, but the source is Estimated (method-permitted uncertainty in actual observations, not a forecast).'],
    [KF.STATUS.HYPOTHETICAL, 'Record type Hypothetical: a labelled worked example, never reported as a real result.'],
    [KF.STATUS.DCR, 'A required input or control is missing, source checks are not confirmed, the source is Not verified, permission is Pending, or capture is incomplete. Never shown as zero.'],
    [KF.STATUS.NC, 'Inputs are valid but the denominator is zero (for example no valid survey responses), so no rate exists.'],
    [KF.STATUS.NA, 'The KPI does not apply in this case (for example zero bookable hours, or a zero baseline cohort for P3-01).'],
    [KF.STATUS.FAIL, 'An input breaks a rule: wrong type, negative count, end date before start, or a relationship such as U ≤ H, R ≤ B, G + U ≤ L or I + H + W = M fails; or permission is Denied.'],
    [KF.STATUS.INACTIVE, 'C01, C04, C09 and C10: the handover keeps the ID only. No input, no zero, no result.'],
    [KF.STATUS.QUALITATIVE, 'C08: a community-approved summary is recorded. No numerical unit.'],
  ];

  const PRINCIPLES = [
    ['Missing is never zero', 'A blank input means "not available". It produces Data Collection Required, never 0. Zero is reported only when complete records show zero.'],
    ['Borrow methods, never invent them', 'Every measure cites the organisation whose method it uses. New formulas come from the evaluation team, not from the tool.'],
    ['Descriptive, not causal', 'Results describe what happened. They do not prove the program caused it or show net economic benefit.'],
    ['Never add KPIs together', 'Each KPI is reported separately. No composite score, no averaging of practices, barriers or groups, no sum of overlapping groups.'],
    ['Label every result', 'Every result carries its status (Verified, Estimated, Hypothetical, or why it is not calculated) and its reporting period, scope, method version and source.'],
    ['Compare like with like', 'A change needs two calculated waves with the same scope and method version and an explicit "comparison approved". Percentages change in percentage points.'],
    ['Aggregates only, privacy first', 'The tool receives checked aggregate counts, never names, person IDs, raw responses or case narratives. Publication needs a disclosure review.'],
    ['First Nations data sovereignty', 'First Nations data is collected and used under the Maiam nayri Wingara principles and the AIATSIS Code of Ethics, with community authority over meaning and publication.'],
    ['Show your working', 'Every figure can show its formula with the actual inputs, so a reviewer can recalculate it by hand.'],
  ];

  const RECOMMENDATIONS = [
    ['Standardise data gathering', 'One template per program and grant: one row per activity with region or LGA, date or season, dollars, pillar, and counts for women & girls, First Nations, Pasifika and people with disability.'],
    ['One shared place to store it', 'A single system of record with the input contract above; export Rugby Analytics data directly instead of retyping screenshots.'],
    ['Same survey questions every time', 'Use the exact wording in this framework, at the same points in the season, with the same answer options and method version.'],
    ['Named owners and a reporting rhythm', 'A custodian for each KPI who runs the source checks, and a fixed reporting frequency (the Rugby For Good Benefits Realisation Framework model).'],
    ['Record delivery, not just budgets', 'Equipment register, hub attendance, Round 2 co-contributions, and statewide programs reported by region.'],
  ];

  // The whole framework as one sequence of steps, for the closing summary diagram. [step, what happens, the rule].
  const FLOW = () => {
    const active = KF.KPIS.filter(k => k.state === 'active').length;
    return [
      ['Collect', 'Gather standard data once: one template per program and grant, the exact survey wording, Rugby Analytics exports. Submit checked aggregate counts as waves with the shared controls.', 'Same questions, same template, every time (sections 4, 9)'],
      ['Check', 'Validate every input in a fixed order: invalid values, missing values, source checks, verification, permission, capture.', 'Missing is never zero (section 5)'],
      ['Monitor', 'Where the money goes and whether the program is on track: known spend by pillar and region, and every plan target as Ahead, Close or Behind.', `${D.kpis.length} plan targets, each with its source (section 8)`],
      ['Measure', `What difference it makes: ${KF.KPIS.length} KPIs (${DIMS.map(d => `${KF.KPIS.filter(k => k.dim === d).length} ${d.toLowerCase()}`).join(', ')}), ${active} active, each calculated exactly as the evaluation team wrote it.`, 'Never add KPIs together (section 6)'],
      ['Value', 'Put a dollar value on the benefits with published formulas only, discounted under NSW Treasury TPG23-08. Cultural outcomes stay as survey results: no published dollar method exists.', 'Borrow methods, never invent them (section 7)'],
      ['Label', 'Every result carries its status, period, scope, method version and source, and can show its formula with the actual inputs.', 'Show your working (section 3)'],
      ['Report', 'Report each result to its audience (board, funder, annual report, community, media); changes only between comparable waves.', 'Descriptive, not causal; compare like with like'],
      ['Improve', 'Named owners review results each reporting cycle, fix data gaps, and version any change of method before the next wave.', 'Each cycle starts again at Collect'],
    ];
  };
  const CONCLUSION = 'Collect standard data once, check it, calculate only with published or agreed formulas, label every result, and report it with the working shown, so that every figure NSW Rugby publishes about the Legacy Program can be traced back to its source and recalculated by hand.';

  // ---------- the specification document (shared by the tab and the HTML download) ----------
  function specHtml() {
    const calcs = window.Methods?.CALCS || [];
    const kpiSpec = k => `<section class="fw-kpi" id="fw-${k.id}">
      <h4>${esc(k.id)} · ${esc(k.name)}</h4>
      <p class="small"><b>${esc(k.dim)}</b> · ${esc(k.pillar)} · ${esc(STATE[k.state])} · readiness ${esc(k.readiness)} · ${esc(k.tier)}</p>
      <p><b>Definition.</b> ${esc(k.definition)}</p>
      <p><b>Formula.</b> <code>${esc(k.formula)}</code></p>
      ${k.inputs.length ? `<p><b>Inputs</b> (per ${esc(k.waves.join(' / ').toLowerCase() || 'submission')}, plus the shared controls)</p>
        ${table(['Field', 'Meaning', 'Type', 'Unit', 'Required'], k.inputs.map(([key, label, type, unit, req, help]) => [`<code>${esc(key)}</code>`, `${esc(label)}<br><span class="muted small">${esc(help || '')}</span>`, esc(TYPE(type)), esc(unit || ''), esc(REQ(req))]))}` : ''}
      <p><b>Output unit.</b> ${esc(k.unit || 'none')}${k.changeUnit ? ` · change in ${esc({ pp: 'percentage points', AUD: 'AUD', unitAUD: 'AUD and %', hours: 'person-hours', count: 'people' }[k.changeUnit])}` : ''}</p>
      <p><b>Missing data and zero denominators.</b> ${esc(k.rules)}</p>
      ${k.question ? `<p><b>Survey question (use exactly).</b> ${esc(k.question)}</p>` : ''}
      <p><b>Baseline.</b> ${esc(k.baseline[0])}. ${esc(k.baseline[1])}</p>
      <p><b>Formula origin.</b> ${esc(k.origin)} · <b>Evidence status:</b> ${esc(k.evidence)} · <b>Source:</b> ${esc(k.source)}</p>
      <p><b>Limitations.</b> ${esc(k.limitations)}</p>
    </section>`;

    const matrix = table(['Pillar', ...DIMS], PILLARS.map(([p, name]) => [`<b>${p}</b> ${esc(name)}`,
      ...DIMS.map(d => KF.KPIS.filter(k => k.dim === d && primaryPillar(k) === p).map(k => `<a href="#fw-${k.id}" class="${k.state === 'inactive' ? 'muted' : ''}">${k.id}</a>`).join(', ') || '<span class="muted">—</span>')]));

    return `
      <section class="fw-section" id="fw-about"><h2>1. What this framework is</h2>
        <p>A framework for measuring the economic, social and cultural impact of NSW Rugby's Rugby World Cup Legacy Program, built so it can be reused for other programs such as Rugby For Good. It answers four questions: <b>where the money goes</b>, <b>whether the program is on track</b>, <b>what difference it makes</b>, and <b>how we know</b>.</p>
        <p>Tackle AI is one implementation. Everything here is independent of that tool: the same framework can be built in a spreadsheet, a survey platform, a BI dashboard or another application by following sections 3 to 9. The project brief requires compliance with NSW Treasury guidelines (TPG22-22 evaluation, TPG23-08 cost-benefit analysis) and best practice from other sporting codes.</p>
        <p class="muted small">Generated from the live definitions on ${new Date().toLocaleDateString('en-AU')}. KPI formulas: ${esc(KF.SOURCE_FILE)} (NSW Rugby evaluation team).</p>
      </section>
      <section class="fw-section" id="fw-structure"><h2>2. Structure</h2>
        <p>Four layers, each with its own rules:</p>
        ${table(['Layer', 'What it measures', 'How'], [
          ['1. Program monitoring', 'Spend by pillar and region; progress against plan targets', 'Sums of known allocations; even-pace status against each target (section 8)'],
          ['2. Impact KPIs', `${KF.KPIS.length} KPIs: ${DIMS.map(d => `${KF.KPIS.filter(k => k.dim === d).length} ${d.toLowerCase()}`).join(', ')}`, 'Evaluation team formulas with a strict input contract (sections 4 to 6)'],
          ['3. Valuation', 'Dollar value of benefits', 'Published formulas only, discounted under NSW Treasury TPG23-08 (section 7)'],
          ['4. Evidence', 'Stories, surveys, community accounts', 'Field evidence log and governed qualitative protocols (C08, S08)'],
        ])}
        <p><b>Pillars × impact dimensions</b> (primary pillar of each KPI; greyed IDs are inactive):</p>${matrix}
      </section>
      <section class="fw-section" id="fw-principles"><h2>3. Principles every implementation must keep</h2>
        ${table(['Principle', 'Rule'], PRINCIPLES.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}
      </section>
      <section class="fw-section" id="fw-contract"><h2>4. Data input contract</h2>
        <p>Data is submitted as <b>waves</b> (a baseline and a follow-up; a cohort pair; or one matched baseline-to-follow-up submission, depending on the KPI). Every wave carries these shared controls as well as the KPI's own fields:</p>
        ${table(['Field', 'Meaning', 'Type', 'Required'], KF.META.map(([key, label, type, help]) => [`<code>${esc(key)}</code>`, `${esc(label)}<br><span class="muted small">${esc(help)}</span>`, esc(TYPE(type)), KF.META_REQUIRED.includes(key) ? 'Required' : 'Optional']))}
        <p>Per KPI, one extra control: <code>comparison_approved</code> (Yes / No), required before a change between two waves is shown. Only checked aggregate counts are submitted: no names, person IDs, raw responses or case narratives.</p>
      </section>
      <section class="fw-section" id="fw-status"><h2>5. Result statuses</h2>
        <p>Every result has exactly one status. Checks run in this order: invalid values, missing values, source checks, verification, permission, capture, then the KPI formula.</p>
        ${table(['Status', 'When'], STATUS_MODEL.map(([s, w]) => [`<b>${esc(s)}</b>`, esc(w)]))}
        <p><b>Change between waves:</b> only when both waves are calculated, both are operational or both hypothetical, scope and method version match, and comparison is approved. Rates change in percentage points; dollars in dollars; unit costs in dollars and percent. Changes are descriptive, not causal.</p>
      </section>
      <section class="fw-section" id="fw-kpis"><h2>6. KPI catalogue</h2>
        <p>${KF.KPIS.length} KPIs in the evaluation team's handover. ${Object.entries(STATE).map(([s, l]) => `${KF.KPIS.filter(k => k.state === s).length} ${l.toLowerCase()}`).join(' · ')}.</p>
        ${table(['ID', 'KPI', 'Dimension', 'Primary pillar', 'Status', 'Evidence'], KF.KPIS.map(k => [`<a href="#fw-${k.id}">${k.id}</a>`, esc(k.name), k.dim, primaryPillar(k), esc(STATE[k.state]), esc(k.evidence)]))}
        ${DIMS.map(d => `<h3>${d} KPIs</h3>${KF.KPIS.filter(k => k.dim === d).map(kpiSpec).join('')}`).join('')}
      </section>
      <section class="fw-section" id="fw-valuation"><h2>7. Valuation methods (published formulas)</h2>
        <p>Dollar values use only formulas and parameters another organisation has published. Present values follow NSW Treasury TPG23-08: 5% real central discount rate, 3% and 7% sensitivity, BCR = PV of benefits ÷ PV of costs; following the Rugby For Good CBA, costs accrue every year and benefits start after the first year.</p>
        ${table(['Method', 'Formula', 'Source', 'Caveat'], calcs.map(c => [`<b>${esc(c.name)}</b>`, `<code>${esc(c.formula)}</code>`, esc(c.frameworks.map(id => D.frameworks[id].org + ', ' + D.frameworks[id].title).join('; ')), esc(c.caveat)]))}
        <p><b>Other established measures</b> used alongside the KPIs:</p>
        ${table(['Dimension', 'Measure', 'Framework', 'How it is measured'], Object.values(D.impactMethods).flatMap(l => l.measures.filter(m => m.framework !== 'KPI-HANDOVER').map(m => [l.label, esc(m.name), esc(D.frameworks[m.framework].org), esc(m.how)])))}
      </section>
      <section class="fw-section" id="fw-targets"><h2>8. Program targets</h2>
        <p>${D.kpis.length} plan targets across the five pillars, each with its source document. Status rule (RWC Legacy Data Compilation): <b>Ahead</b> at or above the pace needed, <b>Close</b> within 80% of it, otherwise <b>Behind</b>. Pace:</p>
        ${table(['Target type', 'Pace calculation'], [
          ['Growth', 'Needed a year = (1 + total target growth)^(1 ÷ years) − 1, compared with the latest year-on-year growth (latest year ÷ previous year − 1, from the same source).'],
          ['Count / share / level', 'On-pace value = start + (target − start) × (years elapsed ÷ years to the target year). Level targets may go down (ratios, churn).'],
          ['Annual', 'Latest year\'s figure compared with the yearly target.'],
          ['No number set', 'Kept on a watch list; progress is not judged until a target is set.'],
        ])}
      </section>
      <section class="fw-section" id="fw-collect"><h2>9. Data collection and governance</h2>
        ${table(['Recommendation', 'How'], RECOMMENDATIONS.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}
        <p><b>Roles.</b> A source custodian checks raw records, matching and evidence before submitting aggregates (and confirms <code>source_checks_passed</code>). The evaluation team owns formulas and method versions. A disclosure reviewer sets <code>publication_approved</code>. First Nations communities hold authority over the meaning and publication of First Nations data.</p>
      </section>
      <section class="fw-section" id="fw-build"><h2>10. Building it in another form</h2>
        ${table(['Step', 'What to do'], [
          ['1. Data model', 'Create one table for waves (shared controls + KPI fields, section 4) and one per KPI for its inputs, or use the CSV of input fields below as the column list.'],
          ['2. Validation', 'Implement the type, required and relationship rules per field (section 6), and the status order (section 5). Test with zero denominators and blank inputs.'],
          ['3. Formulas', 'Implement each formula exactly as written; keep inactive KPIs as IDs only.'],
          ['4. Labels', 'Show the status, period, scope, method version and source with every number; show the working on demand.'],
          ['5. Collection', 'Use the survey wording exactly as given; version any change in method_version.'],
          ['6. Check', 'Recalculate a sample of results by hand from the workings before publishing.'],
        ])}
        <p>Machine-readable copies: <b>framework.json</b> (every KPI with its inputs, rules, baseline, sources, the shared controls and statuses) and <b>input-fields.csv</b> (one row per input field), from the buttons at the top of this page.</p>
      </section>
      <section class="fw-section" id="fw-sources"><h2>11. Sources</h2>
        ${table(['Organisation', 'Document', 'Used for'], Object.values(D.frameworks).map(f => [esc(f.org), f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.title)}</a> (${f.year})` : `${esc(f.title)} (${f.year}; Dataset/${esc(f.file)})`, esc(f.use)]))}
      </section>
      <section class="fw-section" id="fw-summary"><h2>12. The framework in one picture</h2>
        <p>Every part of this framework fits one repeating sequence. Each step has one rule that must not be broken.</p>
        <ol class="fw-flow">${FLOW().map(([step, what, rule], n) => `<li><span class="fw-n">${n + 1}</span><div><b>${esc(step)}</b><p>${esc(what)}</p><span class="fw-rule">${esc(rule)}</span></div></li>`).join('')}</ol>
        <p class="fw-loop">↻ Repeat every reporting cycle</p>
        <div class="fw-conclusion"><b>Conclusion.</b> ${esc(CONCLUSION)}</div>
      </section>`;
  }

  // ---------- downloads ----------
  function download(name, type, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function specJson() {
    return JSON.stringify({
      name: 'NSW Rugby RWC Legacy Impact Measurement Framework', generated: new Date().toISOString(), kpiSource: KF.SOURCE_FILE,
      principles: PRINCIPLES.map(([name, rule]) => ({ name, rule })),
      sharedControls: KF.META.map(([key, label, type, help]) => ({ key, label, type, required: KF.META_REQUIRED.includes(key), help })),
      perKpiControls: [{ key: 'comparison_approved', type: 'bool', requiredFor: 'change between waves' }],
      statuses: STATUS_MODEL.map(([status, when]) => ({ status, when })),
      kpis: KF.KPIS.map(k => ({ id: k.id, name: k.name, dimension: k.dim, pillar: k.pillar, state: k.state, readiness: k.readiness, tier: k.tier, definition: k.definition, formula: k.formula,
        waves: k.waves, inputs: k.inputs.map(([key, label, type, unit, req, help]) => ({ key, label, type, unit, required: REQ(req), help })), outputUnit: k.unit, changeUnit: k.changeUnit || null,
        missingAndZeroRules: k.rules, question: k.question || null, baseline: { type: k.baseline[0], definition: k.baseline[1] }, origin: k.origin, evidenceStatus: k.evidence, source: k.source, limitations: k.limitations })),
      valuationMethods: (window.Methods?.CALCS || []).map(c => ({ name: c.name, formula: c.formula, sources: c.frameworks.map(id => D.frameworks[id].title), caveat: c.caveat })),
      establishedMeasures: Object.values(D.impactMethods).flatMap(l => l.measures.map(m => ({ dimension: l.label, name: m.name, framework: D.frameworks[m.framework].title, how: m.how }))),
      targets: D.kpis.map(({ id, area, kind, name, unit, baseline, baseYear, target, targetYear, source }) => ({ id, pillar: area, kind, name, unit, baseline, baseYear, target, targetYear, source })),
      sources: Object.entries(D.frameworks).map(([id, f]) => ({ id, ...f })),
      summary: { steps: FLOW().map(([step, what, rule], n) => ({ order: n + 1, step, what, rule })), conclusion: CONCLUSION },
    }, null, 2);
  }

  function inputCsv() {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['kpi_id', 'kpi_name', 'dimension', 'state', 'field', 'label', 'type', 'unit', 'required', 'help']];
    for (const [key, label, type, help] of KF.META) rows.push(['ALL', 'Shared controls (every wave)', '', '', key, label, TYPE(type), '', KF.META_REQUIRED.includes(key) ? 'Required' : 'Optional', help]);
    for (const k of KF.KPIS) {
      if (!k.inputs.length) rows.push([k.id, k.name, k.dim, k.state, '', 'No inputs: ' + STATE[k.state], '', '', '', '']);
      for (const [key, label, type, unit, req, help] of k.inputs) rows.push([k.id, k.name, k.dim, k.state, key, label, TYPE(type), unit, REQ(req), help]);
    }
    return rows.map(r => r.map(q).join(',')).join('\r\n');
  }

  function standaloneHtml() {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NSW Rugby Impact Framework</title>
      <style>body{font:15px/1.5 system-ui,sans-serif;color:#111;max-width:1000px;margin:24px auto;padding:0 16px}h1{margin:0 0 4px}h2{margin-top:32px;border-bottom:2px solid #0b6b73;padding-bottom:4px}
      table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eef4f5}
      code{background:#f2f2f2;padding:1px 4px;border-radius:3px;font-size:12px;white-space:normal}.muted{color:#666}.small{font-size:12px}.fw-kpi{border:1px solid #ddd;border-radius:6px;padding:8px 12px;margin:10px 0;break-inside:avoid}
      a{color:#0b6b73}@media print{body{margin:0}h2{break-after:avoid}}
      .fw-flow{list-style:none;padding:0;margin:12px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:22px 26px;counter-reset:none}
      .fw-flow li{position:relative;display:flex;gap:8px;border:1px solid #0b6b73;border-radius:6px;padding:10px;break-inside:avoid}
      .fw-flow li:not(:last-child)::after{content:"→";position:absolute;right:-21px;top:50%;transform:translateY(-50%);color:#0b6b73;font-weight:700}
      .fw-n{flex:none;width:24px;height:24px;border-radius:50%;background:#0b6b73;color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px}
      .fw-flow p{margin:2px 0 4px;font-size:13px}.fw-rule{font-size:12px;color:#0b6b73;font-weight:600}
      .fw-loop{text-align:center;color:#0b6b73;font-weight:600}.fw-conclusion{border-left:4px solid #0b6b73;background:#eef4f5;padding:10px 14px;border-radius:0 6px 6px 0}</style></head>
      <body><h1>NSW Rugby RWC Legacy Impact Measurement Framework</h1><p class="muted">Specification for building the framework in any tool. Produced from Tackle AI.</p>${specHtml()}</body></html>`;
  }

  // ---------- tab ----------
  function render() {
    const host = $('#framework');
    if (!host) return;
    const toc = [['fw-about', 'About'], ['fw-structure', 'Structure'], ['fw-principles', 'Principles'], ['fw-contract', 'Input contract'], ['fw-status', 'Statuses'], ['fw-kpis', 'KPI catalogue'], ['fw-valuation', 'Valuation'], ['fw-targets', 'Targets'], ['fw-collect', 'Data & governance'], ['fw-build', 'Build it'], ['fw-sources', 'Sources'], ['fw-summary', 'In one picture']];
    host.innerHTML = `<nav class="method-toc">${toc.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav><article class="card fw-doc">${specHtml()}</article>`;
  }

  document.addEventListener('app-ready', () => {
    $('#fwHtml')?.addEventListener('click', () => download('nsw-rugby-impact-framework.html', 'text/html', standaloneHtml()));
    $('#fwJson')?.addEventListener('click', () => download('framework.json', 'application/json', specJson()));
    $('#fwCsv')?.addEventListener('click', () => download('input-fields.csv', 'text/csv', inputCsv()));
    render();
  });
  document.addEventListener('tab', e => { if (e.detail === 'framework') render(); });

  window.Framework = { render, specHtml, specJson, inputCsv };
})();
