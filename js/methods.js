// Impact valuation calculators (Impact tab) and the Methodology tab.
// Every calculator applies a formula exactly as another organisation published it, with that organisation's own
// parameters (frameworks are listed in js/data.js). Staff enter the inputs; a missing input is never treated as zero.
// Inventing new formulas is the evaluation team's job: add a calculator here only when it has a published source.
(() => {
  const { $, $$, esc, toast } = window.App;
  const D = window.TACKLE_DATA, A = window.Analytics;
  const F = D.frameworks;
  const aud = v => '$' + Math.round(v).toLocaleString('en-AU');
  const num = v => Math.round(v).toLocaleString('en-AU');
  const has = (p, ...keys) => keys.every(k => typeof p[k] === 'number' && Number.isFinite(p[k]));
  const tip = s => `data-tip="${esc(s)}" tabindex="0"`;
  const fwChip = id => `<span class="impact-chip method" ${tip(`${F[id].org}, ${F[id].title} (${F[id].year}).\n${F[id].use}`)}>${esc(F[id].org.split(' (')[0].split(' for ')[0])}</span>`;
  const fwLink = id => F[id].url ? `<a href="${esc(F[id].url)}" target="_blank" rel="noopener">${esc(F[id].title)}</a>` : `${esc(F[id].title)} <span class="muted">(Dataset/${esc(F[id].file)})</span>`;

  // ---------- NSW Treasury TPG23-08 discounting ----------
  // Present value over an analysis period of `years` (t = 0 … years − 1). Following the R4G CBA, costs accrue in every
  // year and benefits start after the first year (t = 1 … years − 1). 5% central, 3% and 7% sensitivity.
  const RATES = [0.05, 0.03, 0.07];
  const pv = (annual, years, r, from) => { let s = 0; for (let t = from; t < years; t++) s += annual / (1 + r) ** t; return s; };

  // ---------- published parameters ----------
  const R4G = { physical: 237, physicalShare: 0.74, avoided: 557, avoidedShare: 0.26, mental: 745, years: 20 };
  const VSLY = 253000; // OIA 2026, 2025 dollars
  const PREVENT = { depression: 0.26, anxiety: 0.17 }; // Wanjau et al. 2022, as used by NSWRL 2026
  // NSWRL 2026 expenditure flow analysis: [key, category, NSW retention rate, multiplier]
  const ORG_CATS = [
    ['admin', 'Administration and compliance', 0.50, 1.5], ['insurance', 'Insurance costs', 0.10, 1.3],
    ['sponsor', 'Sponsorship and marketing', 0.55, 1.5], ['tech', 'Technology, website and communications', 0.30, 1.3],
    ['medical', 'Medical and sports science', 0.80, 1.7], ['players', 'Player and coach payments', 0.70, 1.7],
    ['referees', 'Referees and match officials', 0.90, 1.7], ['wages', 'Wages and salaries', 0.85, 1.7],
    ['capex', 'Capital expenditure', 0.65, 1.6], ['oval', 'Oval expenses and maintenance', 0.70, 1.7],
    ['canteen', 'Canteen, bar and trading costs', 0.65, 1.7], ['functions', 'Functions, trophies and presentations', 0.55, 1.5],
    ['equipment', 'Equipment and playing supplies', 0.20, 1.3], ['uniforms', 'Playing uniforms and apparel', 0.15, 1.3],
    ['travel', 'Travel and transport', 0.50, 1.5], ['other', 'All other expenses', 0.40, 1.5],
  ];
  const PART_CATS = [
    ['pUniforms', 'Participant uniforms and apparel', 0.20, 1.4], ['pEquipment', 'Participant playing equipment', 0.20, 1.4],
    ['pAccessories', 'Personal accessories', 0.25, 1.4], ['pHealth', 'Allied health services', 0.85, 1.9], ['pTravel', 'Participant travel and transport', 0.50, 1.5],
  ];
  const SUBSTITUTION = 0.5;
  const GSS = [ // [key, question, sport participants %, general population %, higher is better]
    ['volunteer', 'Volunteered for a civic organisation in the last 12 months', 42, 19, true],
    ['confide3', 'Has three or more people to confide in', 58, 37, true],
    ['confide0', 'Has no one to confide in', 10, 23, false],
    ['responsibilities', 'Can always or sometimes meet work, family and community responsibilities', 92, 87, true],
  ];
  const CDN_OUTCOMES = [
    ['belonging', 'Sense of belonging to a shared cultural heritage deepened'], ['diversity', 'Diversity of cultural expression appreciated'],
    ['knowledge', 'New knowledge, ideas and insight gained'], ['creativity', 'Creativity stimulated'], ['aesthetic', 'Aesthetic enrichment experienced'],
  ];

  // ---------- calculators ----------
  // inputs: [key, label, unit, hint]. run(p) -> { rows: [[label, value text, workings]], note } or { missing: text }.
  const CALCS = [
    { id: 'health', lens: 'social', name: 'Health benefit per participant (benefit transfer)', frameworks: ['R4G-CBA', 'TPG23-08'],
      formula: `Yearly benefit = participants in physical programs × $${R4G.physical} × ${R4G.physicalShare * 100}% + participants active over several months × $${R4G.avoided} × ${R4G.avoidedShare * 100}% + participants in mental health programs × $${R4G.mental}; then present value at 5% (3% and 7% sensitivity) over ${R4G.years} years.`,
      inputs: [['physical', 'Participants in programs with physical activity', 'people/yr', 'People in programs where rugby activity is a core part (R4G applied this to Tackle Life and Holiday Break Camps).'],
        ['longActive', 'Of those, active over several months', 'people/yr', 'R4G applied avoided healthcare costs only to multi-month programs (Tackle Life), not one-day camps.'],
        ['mental', 'Participants in mental health programs', 'people/yr', 'Programs with mental health content, such as Get Talkin\' and Holiday Break Camps.'],
        ['cost', 'Program cost a year (optional, for BCR)', 'AUD/yr', 'Yearly cash cost of delivering these programs. Needed only for the benefit-cost ratio.'],
        ['years', 'Analysis period (optional)', 'years', `Default ${R4G.years} years, as in the R4G CBA.`]],
      caveat: 'Benefit transfer: the R4G values were estimated for Rugby For Good programs (mostly young people) and are only indicative for other Legacy programs. One-day camps need the R4G adjustment; enter only participants of ongoing programs under physical activity.',
      run(p) {
        if (!has(p, 'physical') && !has(p, 'mental')) return { missing: 'Enter participant numbers.' };
        const years = has(p, 'years') && p.years >= 2 ? Math.round(p.years) : R4G.years;
        const phys = has(p, 'physical') ? p.physical * R4G.physical * R4G.physicalShare : 0;
        const avoided = has(p, 'longActive') ? Math.min(p.longActive, p.physical ?? p.longActive) * R4G.avoided * R4G.avoidedShare : 0;
        const ment = has(p, 'mental') ? p.mental * R4G.mental : 0;
        const annual = phys + avoided + ment;
        const rows = [
          ['Improved physical health', aud(phys) + '/yr', has(p, 'physical') ? `${num(p.physical)} × $${R4G.physical} (willingness to pay, Herons et al. 2015, 2024 AUD) × ${R4G.physicalShare * 100}% not injured (AusPlay 2023) = ${aud(phys)}` : 'Not entered'],
          ['Avoided net healthcare costs', aud(avoided) + '/yr', has(p, 'longActive') ? `${num(Math.min(p.longActive, p.physical ?? p.longActive))} × $${R4G.avoided} (Davis et al. 2024) × ${R4G.avoidedShare * 100}% (the injured share, counted here instead of physical health to avoid double counting) = ${aud(avoided)}` : 'Not entered'],
          ['Improved mental health', aud(ment) + '/yr', has(p, 'mental') ? `${num(p.mental)} × $${R4G.mental} (6% of median income aged 15–24 willingness to pay, Eaton & Hunt 2024, applied by R4G) = ${aud(ment)}` : 'Not entered'],
          ['Total yearly benefit', aud(annual) + '/yr', 'Sum of the three benefits above.'],
          ...RATES.map(r => {
            const b = pv(annual, years, r, 1);
            const c = has(p, 'cost') ? pv(p.cost, years, r, 0) : null;
            return [`PV at ${r * 100}%${r === 0.05 ? ' (central)' : ' (sensitivity)'}`, aud(b) + (c ? ` · BCR ${(b / c).toFixed(2)}` : ''),
              `PV of benefits = Σ yearly benefit ÷ (1 + ${r})^t for t = 1 … ${years - 1} (benefits start after the first year) = ${aud(b)}` + (c ? `\nPV of costs = Σ ${aud(p.cost)} ÷ (1 + ${r})^t for t = 0 … ${years - 1} = ${aud(c)}\nBCR = PV benefits ÷ PV costs = ${(b / c).toFixed(2)} (TPG23-08)` : '\nEnter a yearly program cost to see the benefit-cost ratio.')];
          }),
        ];
        return { rows };
      } },
    { id: 'daly', lens: 'social', name: 'Health contribution (DALYs × VSLY)', frameworks: ['NSWRL-2026', 'OIA-VSL'],
      formula: `Physical = DALYs prevented per person × participants × VSLY × (1 ÷ average years of life remaining). Mental = participants × (depression DALYs per person × ${PREVENT.depression * 100}% + anxiety DALYs per person × ${PREVENT.anxiety * 100}%) × VSLY × (1 ÷ average years of life remaining). VSLY = $${num(VSLY)}.`,
      inputs: [['participants', 'Active participants (meeting physical activity guidelines)', 'people', 'Registered and social players, referees and trainers who are regularly active. NSWRL excluded coaches, volunteers and non-playing members.'],
        ['dalyPhys', 'DALYs from physical inactivity and overweight per person', 'DALYs', 'AIHW Burden of Disease: DALYs attributed to physical inactivity and overweight (joint effect) ÷ Australian population, for the cohort\'s age and gender.'],
        ['dalyDep', 'Depression DALYs per person', 'DALYs', 'AIHW Burden of Disease: depressive disorder DALYs ÷ Australian population, for the cohort.'],
        ['dalyAnx', 'Anxiety DALYs per person', 'DALYs', 'AIHW Burden of Disease: anxiety disorder DALYs ÷ Australian population, for the cohort.'],
        ['lifeYears', 'Average years of life remaining', 'years', 'ABS Life Tables (2024) for the cohort\'s age and gender.']],
      caveat: 'NSWRL segmented participants by age, gender and participation type; run this once per segment and add the results. Benefits are counted only for years of active participation.',
      run(p) {
        if (!has(p, 'participants', 'lifeYears') || p.lifeYears <= 0) return { missing: 'Enter participants and average years of life remaining, plus at least one DALY figure.' };
        const k = p.participants * VSLY / p.lifeYears;
        const phys = has(p, 'dalyPhys') ? p.dalyPhys * k : null;
        const ment = has(p, 'dalyDep') || has(p, 'dalyAnx') ? ((p.dalyDep || 0) * PREVENT.depression + (p.dalyAnx || 0) * PREVENT.anxiety) * k : null;
        if (phys == null && ment == null) return { missing: 'Enter at least one DALY-per-person figure from the AIHW Burden of Disease Study.' };
        return { rows: [
          ['Physical health benefit', phys == null ? '–' : aud(phys) + '/yr', phys == null ? 'Not entered' : `${p.dalyPhys} × ${num(p.participants)} × $${num(VSLY)} × (1 ÷ ${p.lifeYears}) = ${aud(phys)}`],
          ['Mental health benefit', ment == null ? '–' : aud(ment) + '/yr', ment == null ? 'Not entered' : `${num(p.participants)} × (${p.dalyDep || 0} × ${PREVENT.depression} + ${p.dalyAnx || 0} × ${PREVENT.anxiety}) × $${num(VSLY)} × (1 ÷ ${p.lifeYears}) = ${aud(ment)}\nPreventative effects from Wanjau et al. 2022, as used by NSWRL 2026.`],
          ['Total yearly health contribution', aud((phys || 0) + (ment || 0)) + '/yr', 'Physical + mental.'],
        ] };
      } },
    { id: 'contribution', lens: 'economic', name: 'Economic contribution (expenditure flow analysis)', frameworks: ['NSWRL-2026'],
      formula: 'Organisation spend: Σ spend in category × NSW retention rate × multiplier. Participant spend: Σ spend × (1 − 50% substitution) × retention rate × multiplier. Direct contribution = retained spend; total = retained × multiplier.',
      inputs: [...ORG_CATS.map(([k, n, r, m]) => [k, n, 'AUD/yr', `NSW retention ${r * 100}%, multiplier ${m} (NSWRL 2026, ABS input-output tables).`]),
        ...PART_CATS.map(([k, n, r, m]) => [k, n, 'AUD/yr', `50% substitution discount, then NSW retention ${r * 100}%, multiplier ${m} (NSWRL 2026).`])],
      caveat: 'This is economic contribution (the size of rugby\'s spending in NSW), not economic impact (the net change caused by the Legacy Program against a counterfactual). Exclude depreciation, donations and registration/affiliation fees, which NSWRL treats as transfers.',
      run(p) {
        const used = [...ORG_CATS, ...PART_CATS].filter(([k]) => has(p, k));
        if (!used.length) return { missing: 'Enter expenditure for at least one category.' };
        let gross = 0, direct = 0, total = 0;
        const lines = used.map(([k, n, r, m]) => {
          const part = PART_CATS.some(c => c[0] === k);
          const base = p[k] * (part ? 1 - SUBSTITUTION : 1);
          gross += p[k]; direct += base * r; total += base * r * m;
          return `${n}: ${aud(p[k])}${part ? ' × 50%' : ''} × ${r * 100}% × ${m} = ${aud(base * r * m)}`;
        });
        return { rows: [
          ['Gross expenditure entered', aud(gross), `${used.length} categories.`],
          ['Direct contribution (retained in NSW)', aud(direct), 'Spend × retention rate (participant spend after the 50% substitution discount).'],
          ['Total economic contribution', aud(total), lines.join('\n')],
        ] };
      } },
    { id: 'event', lens: 'economic', name: 'Event visitor spending (additional expenditure)', frameworks: ['EVENTIMPACTS'],
      formula: 'Additional expenditure in the host area = visitors from outside the area who came because of the event × average spend per visitor in the host area (accommodation, food, travel, shopping).',
      inputs: [['visitors', 'Visitors from outside the host area who came because of the event', 'people', 'From the eventIMPACTS attendee survey: where do you live, and was the event your main reason for being here? Exclude locals and people who were in the area anyway.'],
        ['spend', 'Average spend per eligible visitor in the host area', 'AUD', 'From the same survey: total spent in the host area during the visit.'],
        ['organiser', 'Organiser spend in the host area (optional)', 'AUD', 'Event costs paid to businesses in the host area.']],
      caveat: 'Define the host area before surveying (e.g. the LGA). Local residents\' spending is excluded because it would have been spent locally anyway.',
      run(p) {
        if (!has(p, 'visitors', 'spend')) return { missing: 'Enter eligible visitors and average spend from the attendee survey.' };
        const v = p.visitors * p.spend, o = has(p, 'organiser') ? p.organiser : 0;
        return { rows: [
          ['Visitor additional expenditure', aud(v), `${num(p.visitors)} × ${aud(p.spend)} = ${aud(v)}`],
          ['Total additional expenditure', aud(v + o), `Visitor spending ${aud(v)}${o ? ` + organiser spend in the area ${aud(o)}` : ''}.`],
        ] };
      } },
    { id: 'socialCapital', lens: 'social', name: 'Social capital compared with ABS benchmarks', frameworks: ['OECD-SC', 'ABS-GSS', 'NSWRL-2026'],
      formula: 'For each ABS General Social Survey question: participant survey result compared with the national benchmarks for sport participants and the general population (percentage points).',
      inputs: [['n', 'Survey respondents', 'people', 'Number of NSW Rugby participants who answered.'], ...GSS.map(([k, q]) => [k, q, '%', 'Use the ABS General Social Survey question wording.'])],
      caveat: 'A difference shows association, not cause: people who choose rugby may already volunteer more. Report the number of respondents and how they were sampled.',
      run(p) {
        const done = GSS.filter(([k]) => has(p, k));
        if (!done.length) return { missing: 'Enter survey results for at least one question.' };
        return { rows: [
          ...done.map(([k, q, sport, gen, up]) => [q, `${p[k]}%`, `NSW Rugby participants ${p[k]}% vs sport participants ${sport}% (${p[k] - sport >= 0 ? '+' : ''}${p[k] - sport} pp) and general population ${gen}% (${p[k] - gen >= 0 ? '+' : ''}${p[k] - gen} pp). ${up ? 'Higher is better.' : 'Lower is better.'}\nBenchmarks: ABS General Social Survey, as reported in NSWRL 2026.`]),
          ['Respondents', has(p, 'n') ? num(p.n) : 'not entered', 'Always report the sample size with survey results.'],
        ] };
      } },
    { id: 'cultural', lens: 'cultural', name: 'Cultural outcomes (CDN schema)', frameworks: ['CDN', 'MNW'],
      formula: 'For each CDN outcome: share of respondents who agree the outcome happened for them. No weighting or combining: each outcome is reported separately.',
      inputs: [['n', 'Survey respondents', 'people', 'Participants or attendees who answered.'], ...CDN_OUTCOMES.map(([k, o]) => [k, o, '% agree', 'CDN outcome wording must not be changed without CDN\'s permission.'])],
      caveat: 'Attribute the outcomes to the Cultural Development Network. Collect First Nations responses under the Maiam nayri Wingara Indigenous Data Sovereignty principles (community control of the data and its use).',
      run(p) {
        const done = CDN_OUTCOMES.filter(([k]) => has(p, k));
        if (!done.length) return { missing: 'Enter survey results for at least one outcome.' };
        return { rows: [...done.map(([k, o]) => [o, `${p[k]}% agree`, `${p[k]}% of ${has(p, 'n') ? num(p.n) : 'unknown number of'} respondents agreed. CDN outcome, reported unweighted.`]),
          ['Respondents', has(p, 'n') ? num(p.n) : 'not entered', 'Always report the sample size.']] };
      } },
  ];

  // ---------- data ----------
  const stored = () => Store.get('methods') || {};
  const inputsOf = id => stored()[id] || {};

  function calcCard(c) {
    const p = inputsOf(c.id), res = c.run(p);
    return `<article class="econ-kpi calc" data-calc="${c.id}">
      <div class="ek-head"><span class="ek-id">${esc(D.impactMethods[c.lens].label)}</span><span>${c.frameworks.map(fwChip).join(' ')}</span></div>
      <h3>${esc(c.name)}</h3>
      <code class="ek-formula" ${tip('Formula as published by the organisation(s) shown above. Tackle AI only applies it.')}>${esc(c.formula)}</code>
      ${res.missing ? `<p class="muted small"><span class="ek-state missing">Data collection required</span> ${esc(res.missing)}</p>`
        : `<div class="calc-results">${res.rows.map(([l, v, w]) => `<div ${tip(`${l}\n\n${w}`)}><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`}
      <p class="ek-indicative small"><b>Caveat:</b> ${esc(c.caveat)}</p>
      <details class="ek-more"><summary>Enter data</summary>
        <form class="ek-form calc-form">
          <fieldset>${c.inputs.map(([k, l, u, h]) => `<label ${tip(h)}>${esc(l)}<span class="unit-in"><input type="number" step="any" min="0" data-key="${k}" value="${p[k] ?? ''}"><i>${esc(u)}</i></span></label>`).join('')}</fieldset>
          <div class="row end"><button type="button" class="btn calc-clear">Clear</button><button class="btn primary">Calculate</button></div>
        </form>
      </details>
      <details class="ek-more"><summary>Method source</summary>
        <ul class="ek-sources">${c.frameworks.map(id => `<li><b>${esc(F[id].org)}</b> - ${fwLink(id)} (${F[id].year})<br><span class="muted">${esc(F[id].use)}</span></li>`).join('')}</ul>
      </details>
    </article>`;
  }

  function renderCalcs() {
    const host = $('#calcGrid');
    if (!host) return;
    host.innerHTML = CALCS.map(calcCard).join('');
    $$('.calc', host).forEach(el => {
      const c = CALCS.find(x => x.id === el.dataset.calc);
      $('.calc-form', el).addEventListener('submit', e => {
        e.preventDefault();
        const v = {};
        $$('input', e.currentTarget).forEach(i => { if (i.value !== '') v[i.dataset.key] = Number(i.value); });
        Store.set('methods', { ...stored(), [c.id]: v });
        renderCalcs();
        toast(`${c.name} recalculated.`);
        document.dispatchEvent(new CustomEvent('data-changed'));
      });
      $('.calc-clear', el).addEventListener('click', () => { Store.set('methods', { ...stored(), [c.id]: {} }); renderCalcs(); });
    });
  }

  // One line per calculator with a result, for the AI agents and the Story.
  function contextLines() {
    const done = CALCS.map(c => [c, c.run(inputsOf(c.id))]).filter(([, r]) => !r.missing);
    if (!done.length) return ['IMPACT VALUATIONS: none calculated yet (all need data collection).'];
    return ['IMPACT VALUATIONS (published formulas applied to staff-entered inputs):',
      ...done.map(([c, r]) => `- ${c.name} [${c.frameworks.map(id => F[id].org).join('; ')}]: ` + r.rows.map(([l, v]) => `${l} ${v}`).join('; '))];
  }

  // ---------- Methodology tab ----------
  function section(id, title, body) { return `<article class="card method-section" id="${id}"><h2>${title}</h2>${body}</article>`; }
  const steps = list => `<ol class="method-steps">${list.map(([h, b]) => `<li><b>${h}</b><div>${b}</div></li>`).join('')}</ol>`;

  function renderMethodology() {
    const host = $('#methodology');
    if (!host) return;
    const O = window.Ollama;
    const briefing = A.briefing();
    const ms = Object.values(A.measures());
    const cov = A.impactCoverage();
    const model = O.config.model || (window.Store.health?.model) || 'not connected';

    const toc = [['m-overview', 'How it works'], ['m-data', 'Data in'], ['m-calc', 'Figures'], ['m-ai', 'AI insights'], ['m-check', 'Checks & learning'], ['m-story', 'Story'], ['m-impact', 'Impact methods'], ['m-targets', 'Targets'], ['m-proto', 'Prototype indicators'], ['m-sources', 'Sources']];
    host.innerHTML = `<nav class="method-toc">${toc.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav>` +
      section('m-overview', 'How Tackle AI produces its figures and insights', `
        <p>Tackle AI separates <b>calculation</b> from <b>interpretation</b>. Every number on screen is calculated in code from the data, with a published method. The AI never calculates a figure shown in a tile, map, table, target or KPI: it reads those figures and writes plain-language insights about them, which staff then check.</p>
        <div class="method-flow">
          ${[['1. Data', 'Built-in program data, the project files in Dataset/ and anything uploaded in Data Studio.'],
             ['2. Calculation', 'Analytics code turns the data into totals, targets and impact measures. Same input, same answer, every time.'],
             ['3. Briefing', `The calculated figures are written into one text briefing (${num(briefing.length)} characters right now) that every AI task reads.`],
             ['4. AI agents', `Five agents (${O.AGENTS.map(a => a.name.replace(' Agent', '')).join(', ')}) write insights in a fixed JSON format.`],
             ['5. Checks', 'Each insight is checked against the calculated flags, then reviewed by staff (verify or dispute).'],
             ['6. Learning', 'Staff ratings are fed back into every later prompt, so new insights follow what the team accepted.']]
            .map(([h, b]) => `<div ${tip(b)}><b>${h}</b><span>${esc(b)}</span></div>`).join('<span class="arrow">→</span>')}
        </div>`) +
      section('m-data', 'Data in', steps([
        ['Built-in data', 'Round 1 Legacy grants and the 3-year RWC Dashboard budgets, compiled from <i>RWC_Legacy_Data_Compilation.xlsx</i> and <i>RWC Dashboard 010926 (2).xlsx</i>, plus plan targets. Region population and First Nations share are indicative ABS 2021 approximations.'],
        ['Project files', 'Every file in <i>Dataset/</i> is loaded as if it had been uploaded, so it is profiled, quality-rated and available to the AI.'],
        ['Uploads', 'Data Studio reads Excel, CSV, JSON, PDF, Word and text. Tables are profiled column by column (number, money, date, region, category).'],
        ['What an upload changes', 'A region + amount column becomes spend on the dashboard. Other numeric region columns become map layers. A "lens"/"impact" column becomes impact evidence. Yearly counts (players, coaches, match officials, female, First Nations or Pasifika participants) become measures that update Targets.'],
        ['No double counting', 'Rows whose dollar amount is already in the built-in data are skipped. Re-uploading a file replaces its earlier contribution.'],
        ['Missing is never zero', 'Absent data shows as "No data yet" or "Data collection required", never as 0.'],
      ])) +
      section('m-calc', 'How the figures are calculated', `<p>All figures are deterministic code in <i>js/analytics.js</i>, <i>js/econ.js</i> and <i>js/methods.js</i>. Hover any underlined number in the app to see its workings.</p>` + steps([
        ['Spend totals', 'Sums of known allocations (grants + dashboard budgets + uploads) by pillar and region. Known allocations are budgets, not audited expenditure.'],
        ['Held centrally', 'Spend on lines marked "Statewide" ÷ all known spend.'],
        ['Economic KPIs', 'The nine formulas from the evaluation team\'s workbook, applied exactly as documented, with the workbook\'s edge-case rules (Not applicable / Not calculable / Data collection required).'],
        ['Impact valuations', 'Calculators that apply formulas published by other organisations (R4G CBA, NSWRL 2026, eventIMPACTS, ABS GSS benchmarks, CDN). See Impact methods below.'],
        ['Targets', 'Status against the pace needed to reach each plan target. See Targets below.'],
      ])) +
      section('m-ai', 'How the AI generates insights', steps([
        ['Model', `Runs locally through Ollama by default (currently <b>${esc(model)}</b>; default qwen2.5:7b), so program data stays on NSW Rugby's computer. On Vercel it can use Ollama Cloud or an OpenAI-compatible provider. Settings: temperature 0.3 for agents (0.6 for stories), 8,192-token context, JSON output mode, reasoning ("thinking") off.`],
        ['System prompt', `Every call starts with the same instruction: <code>${esc(O.SYSTEM)}</code>`],
        ['Shared briefing', 'The calculated figures (pillar totals, region table, flags, targets, impact measures, economic KPIs, programs, field evidence, data quality) are written as text. The AI gets the answers, not raw data to add up: small local models are unreliable at arithmetic, so verdicts such as "overspend risk" are pre-computed and marked as ground truth.'],
        ['Agents', O.AGENTS.map(a => `<div class="agent-brief" ${tip(a.brief)}><b>${esc(a.name)}</b> (${esc(a.pillar)}): ${esc(a.brief.split('\n')[0])}</div>`).join('')],
        ['Output format', 'Each agent must return JSON: title, 2–3 sentence insight, severity (positive / watch / risk), impact type, region, the key numbers as evidence, and one recommended action.'],
        ['Rules in every agent prompt', 'Use the flags exactly; take each dollar figure from its own region\'s row; say "First Nations"; quote field evidence only with its source; never invent numbers, formulas or dollar values; follow the staff feedback section.'],
        ['Speed', 'The briefing is identical for every task, so it is sent ahead of time ("pre-reading") and Ollama reuses it from its cache for 30 minutes. Agents after the first only read their short task.'],
        ['When the AI is offline', 'A rule engine writes equivalent insights directly from the calculated figures, so the app never shows an empty Insights tab. These are labelled "Rule engine".'],
      ]) + `<details class="ek-more"><summary>See the exact briefing the AI reads right now</summary><pre class="lessons briefing">${esc(briefing)}</pre></details>`) +
      section('m-check', 'Checks and learning', steps([
        ['Automatic fact check', 'Every sentence that calls a region overspent or under-served is compared with that region\'s calculated status. Contradictions are shown on the insight as "Fails data check", not hidden.'],
        ['Staff review queue', 'New insights wait in "To review". Staff verify (👍) or dispute (👎, with a reason). Disputed insights are kept out of the Story.'],
        ['Re-runs', 'A new run archives the previous run\'s unrated insights, keeps rated ones, and hides new insights that repeat a kept one.'],
        ['Learning from feedback', 'Verified examples, disputed items with reasons, deletions and failed checks are summarised into a "learned from staff feedback" section added to every later prompt. The model itself is not retrained; rated insights can be exported as training data for fine-tuning later.'],
        ['Data quality rating', 'Every file gets a rule-based score, optionally reviewed by the AI (see Prototype indicators for the weights).'],
      ])) +
      section('m-story', 'Story generator', steps([
        ['Inputs', 'The same briefing, plus the insights for the chosen pillars (disputed ones excluded) and field evidence. If there are no AI insights, the rule engine\'s are used and the draft says so.'],
        ['Formats', 'Annual report chapter, board summary, funding acquittal, community story and media release, each with its own brief and length.'],
        ['Editing', 'The draft is fully editable before export to PDF. Figures in the story come from the briefing; check them against the dashboard before publishing.'],
      ])) +
      section('m-impact', 'Impact methods', `<p>Impact is measured only with methods published by other organisations. The project brief asks for best-practice frameworks from other sporting codes, compliant with NSW Treasury guidelines; new formulas are left to the evaluation team.</p>
        <div class="table-scroll"><table class="pretty-table method-table"><thead><tr><th>Framework</th><th>Organisation</th><th>How Tackle AI uses it</th></tr></thead><tbody>
        ${Object.keys(F).map(id => `<tr><td>${fwLink(id)}</td><td>${esc(F[id].org)} (${F[id].year})</td><td>${esc(F[id].use)}</td></tr>`).join('')}</tbody></table></div>
        ${Object.entries(D.impactMethods).map(([k, lens]) => `<h3>${esc(lens.label)} — ${cov[k].measured} measured, ${cov[k].partial} partial, ${cov[k].none} no data</h3>
          <div class="table-scroll"><table class="pretty-table method-table"><thead><tr><th>Measure</th><th>Framework</th><th>How it is measured</th><th>Status</th></tr></thead><tbody>
          ${cov[k].measures.map(m => `<tr><td>${esc(m.name)}</td><td ${tip(F[m.framework].use)}>${esc(F[m.framework].org)}</td><td>${esc(m.how)}</td><td><span class="status ${m.status === 'measured' ? 'positive' : m.status === 'partial' ? 'watch' : ''}">${{ measured: 'Measured', partial: 'Partial', none: 'No data yet' }[m.status]}</span><br><span class="muted small">${esc(m.value)}</span></td></tr>`).join('')}</tbody></table></div>`).join('')}
        <h3>Valuation formulas</h3>
        ${CALCS.map(c => `<div class="method-formula"><b>${esc(c.name)}</b> <span class="muted small">(${c.frameworks.map(id => esc(F[id].org)).join('; ')})</span><code class="ek-formula">${esc(c.formula)}</code><span class="muted small">${esc(c.caveat)}</span></div>`).join('')}
        <p class="muted small">Discounting follows NSW Treasury TPG23-08: 5% real central rate with 3% and 7% sensitivity; BCR = present value of benefits ÷ present value of costs. Following the R4G CBA, costs accrue every year and benefits start after the first year.</p>`) +
      section('m-targets', 'Targets', steps([
        ['Targets', 'Plan targets from the Project Plan, RWC Dashboard and Program Logic (each target shows its source on hover). Staff can adjust a target or target year.'],
        ['Required pace', 'Growth targets: needed a year = (1 + total target growth)^(1 ÷ years) − 1, compared with the latest year-on-year growth. Count and share targets: an even pace from the start year to the target year.'],
        ['Status rule', 'From the RWC Legacy Data Compilation: Ahead at or above the pace needed, Close within 80% of it, otherwise Behind.'],
        ['Actuals', `Published figures typed in from the plan documents, unless an uploaded file has two or more consecutive years of the same measure; then the actual is that file's latest year ÷ previous year − 1 (Rugby Analytics growth definition) and the target shows "from upload". Measures found in uploads right now: ${ms.length ? ms.map(m => `<b>${esc(m.label)}</b> (${esc(m.dataset)}: ${Object.keys(m.series).join(', ')})`).join('; ') : 'none'}.`],
      ])) +
      section('m-proto', 'Prototype indicators (not from an external framework)', `<p>These screening indicators help find where to look. They are <b>not impact measures</b>, are labelled on hover wherever they appear, and are waiting for review by the evaluation team.</p>` + steps([
        ['Spend vs population', 'Region share of regionally allocated spend ÷ its share of NSW population; 1.75x or more = overspend risk, 0.5x or less = under-served. Population is indicative.'],
        ['Inclusion index', '50 × (inclusion-tagged spend ÷ region spend, capped at 1) + 50 × (inclusion groups reached ÷ 4).'],
        ['Program value-for-money comparisons', 'Programs tab: cost per person reached, per new coach or referee, and so on, compared with the median of similar programs. Only uses results staff record.'],
        ['Data quality score', 'Tables: 25 row-level records + 20 region + 15 date/season + 15 dollar amounts + 10 demographic split + 15 × completeness. Documents: 10 + 8 each for region detail, recent year and dollar figures + 6 for inclusion groups. Green 70+, amber 40–69, red below 40.'],
      ])) +
      section('m-sources', 'Sources', `<ul class="ek-sources">${Object.keys(F).map(id => `<li><b>${esc(F[id].org)}</b> - ${fwLink(id)} (${F[id].year})</li>`).join('')}</ul>`);
  }

  document.addEventListener('app-ready', () => { renderCalcs(); renderMethodology(); });
  document.addEventListener('data-changed', renderMethodology);
  document.addEventListener('insights-changed', renderMethodology);
  document.addEventListener('tab', e => { if (e.detail === 'methodology') renderMethodology(); });

  window.Methods = { CALCS, contextLines, renderCalcs, renderMethodology };
})();
