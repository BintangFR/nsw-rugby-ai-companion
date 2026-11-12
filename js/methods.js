// Value calculators and the Methodology page.
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
  // Present value over an analysis period of `years` (t = 0 … years − 1). As in common CBA practice, costs accrue in every
  // year and benefits start after the first year (t = 1 … years − 1). 5% central, 3% and 7% sensitivity.
  const RATES = [0.05, 0.03, 0.07];
  const pv = (annual, years, r, from) => { let s = 0; for (let t = from; t < years; t++) s += annual / (1 + r) ** t; return s; };

  // ---------- published parameters ----------
  // Independent Australian values, from the Clearinghouse for Sport (Australian Sports Commission). These replace the Rugby For
  // Good per-person values: NSW Rugby asked for other programs' methods only, never their figures.
  const CLUB = { value: 5932, year: 2018 }; // social benefit per participant a year, community club sport once a week (ASC & Griffith 2018)
  const VOL_RATE = 3e9 / 158e6; // $ per sport volunteer hour: $3 billion ÷ 158 million hours (BCG for the ASC 2017)
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
    { id: 'health', lens: 'social', name: 'Social value of weekly club sport and volunteering', frameworks: ['ASC-CLUB', 'BCG-ASC', 'TPG23-08'],
      formula: `Yearly value = people taking part at least once a week through the season × $${CLUB.value.toLocaleString('en-AU')} (social benefit of community club sport per participant a year, Australian Sports Commission & Griffith 2018) + volunteer hours × $${VOL_RATE.toFixed(2)} an hour ($3 billion ÷ 158 million sport volunteer hours, BCG for the ASC 2017); then present value at 5% (3% and 7% sensitivity) over the analysis period.`,
      inputs: [['weekly', 'People taking part at least once a week through the season', 'people/yr', 'From the attendance sheet: people who attended weekly sessions for most of the season in Legacy-funded activity. One-off attendees (carnivals, come-and-try days) are not counted: the value was measured for weekly club sport.'],
        ['volHours', 'Volunteer hours in Legacy-funded activity (optional)', 'hours/yr', 'From the attendance sheet: coaches, referees and volunteers present × session hours.'],
        ['cost', 'Program cost a year (optional, for BCR)', 'AUD/yr', 'Yearly cash cost of delivering these Legacy programs. Needed only for the benefit-cost ratio.'],
        ['years', 'Analysis period (optional)', 'years', 'Default 10 years.']],
      caveat: `Independent Australian values (Clearinghouse for Sport, Australian Sports Commission): the $${CLUB.value.toLocaleString('en-AU')} covers health, social and human-capital benefits of playing community club sport once a week (${CLUB.year} dollars, not escalated). The volunteer rate is derived by dividing a published total by published hours. Both are national averages, so they are indicative for Legacy programs. Do not add the health outcomes in section 4 on top: they are part of the same benefit.`,
      run(p) {
        if (!has(p, 'weekly') && !has(p, 'volHours')) return { missing: 'Enter people taking part weekly, or volunteer hours.' };
        const years = has(p, 'years') && p.years >= 2 ? Math.round(p.years) : 10;
        const soc = has(p, 'weekly') ? p.weekly * CLUB.value : 0, vol = has(p, 'volHours') ? p.volHours * VOL_RATE : 0, annual = soc + vol;
        const rows = [
          ['Social value of weekly club sport', aud(soc) + '/yr', has(p, 'weekly') ? `${num(p.weekly)} weekly participants × $${CLUB.value.toLocaleString('en-AU')} (ASC & Griffith Business School 2018, Economic value of community club-based sport in Australia) = ${aud(soc)}` : 'Not entered'],
          ['Value of volunteer time', aud(vol) + '/yr', has(p, 'volHours') ? `${num(p.volHours)} hours × $${VOL_RATE.toFixed(2)} (= $3 billion ÷ 158 million hours, BCG for the ASC 2017, Intergenerational Review of Australian Sport) = ${aud(vol)}` : 'Not entered'],
          ['Total yearly value', aud(annual) + '/yr', 'Sum of the two values above.'],
          ...RATES.map(r => {
            const bn = pv(annual, years, r, 1);
            const c = has(p, 'cost') ? pv(p.cost, years, r, 0) : null;
            return [`PV at ${r * 100}%${r === 0.05 ? ' (central)' : ' (sensitivity)'}`, aud(bn) + (c ? ` · BCR ${(bn / c).toFixed(2)}` : ''),
              `PV of benefits = Σ yearly value ÷ (1 + ${r})^t for t = 1 … ${years - 1} (benefits start after the first year) = ${aud(bn)}` + (c ? `\nPV of costs = Σ ${aud(p.cost)} ÷ (1 + ${r})^t for t = 0 … ${years - 1} = ${aud(c)}\nBCR = PV benefits ÷ PV costs = ${(bn / c).toFixed(2)} (TPG23-08)` : '\nEnter a yearly program cost to see the benefit-cost ratio.')];
          }),
        ];
        return { rows };
      } },
    { id: 'contribution', lens: 'economic', name: 'Economic contribution (expenditure flow analysis)', frameworks: ['NSWRL-2026'],
      formula: 'Organisation spend: Σ spend in category × NSW retention rate × multiplier. Participant spend: Σ spend × (1 − 50% substitution) × retention rate × multiplier. Direct contribution = retained spend; total = retained × multiplier.',
      inputs: [...ORG_CATS.map(([k, n, r, m]) => [k, n, 'AUD/yr', `NSW retention ${r * 100}%, multiplier ${m} (NSWRL 2026, ABS input-output tables).`]),
        ...PART_CATS.map(([k, n, r, m]) => [k, n, 'AUD/yr', `50% substitution discount, then NSW retention ${r * 100}%, multiplier ${m} (NSWRL 2026).`])],
      caveat: 'This is the economic contribution of the spending entered, not its net impact (the change caused by the Legacy Program against a counterfactual). Exclude depreciation, donations and registration/affiliation fees, which NSWRL treats as transfers.',
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
    { id: 'event', lens: 'economic', name: 'Event visitor and overnight spending (additional expenditure)', frameworks: ['EVENTIMPACTS', 'DNSW'],
      formula: 'Additional expenditure in the host area = Σ over visitor groups (day trips, domestic overnight, international) of visitors from outside the area who came because of the event × their average spend in the host area per trip (accommodation, food, travel, shopping), + organiser spend in the area.',
      inputs: [['visitors', 'Day-trip visitors from outside the host area who came because of the event', 'people', 'From the post-event survey: where do you live, was the event your main reason for being here, and nights stayed = 0. Exclude locals and people who were in the area anyway.'],
        ['spend', 'Average spend per day-trip visitor in the host area', 'AUD', 'From the same survey; check against Destination NSW average daytrip spend.'],
        ['overnight', 'Domestic overnight visitors who came because of the event (optional)', 'people', 'Survey: lives in Australia outside the host area, main reason = the event, nights stayed ≥ 1.'],
        ['overnightSpend', 'Average spend per domestic overnight visitor in the area, whole stay (optional)', 'AUD', 'Survey: total spend in the area for the stay, including accommodation; check against Destination NSW spend per domestic overnight trip.'],
        ['intl', 'International visitors who came because of the event (optional)', 'people', 'Survey: lives overseas, main reason = the event.'],
        ['intlSpend', 'Average spend per international visitor in the area, whole stay (optional)', 'AUD', 'Survey; check against Destination NSW spend per international visitor night × nights.'],
        ['organiser', 'Organiser spend in the host area (optional)', 'AUD', 'Event costs paid to businesses in the host area.']],
      caveat: 'Define the host area before surveying (e.g. the LGA). Local residents\' spending is excluded because it would have been spent locally anyway. Count a person once, in one group. Destination NSW averages are a check, not a substitute for the survey.',
      run(p) {
        const groups = [['Day-trip visitors', 'visitors', 'spend'], ['Domestic overnight visitors', 'overnight', 'overnightSpend'], ['International visitors', 'intl', 'intlSpend']].filter(([, n, s]) => has(p, n, s));
        if (!groups.length) return { missing: 'Enter visitors and average spend for at least one group, from the post-event survey.' };
        const parts = groups.map(([l, n, s]) => [l, p[n] * p[s], `${num(p[n])} × ${aud(p[s])} = ${aud(p[n] * p[s])}`]);
        const v = parts.reduce((t, x) => t + x[1], 0), o = has(p, 'organiser') ? p.organiser : 0;
        return { rows: [
          ...parts.map(([l, x, w]) => [l, aud(x), w]),
          ['Visitor additional expenditure', aud(v), parts.map(x => x[2]).join('\n')],
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

  // Inputs the app can fill from Legacy data when staff have entered none. Rugby-wide counts are never used:
  // most players are not reached by Legacy funding, so counting them would overstate what the $10M delivered.
  function autoInputs(id) {
    if (id === 'health') {
      const res = Store.get('programs') || {};
      // Only weekly participants count: the value was measured for weekly club sport, so one-off attendees are left out.
      const rows = (window.Programs?.programs() || []).filter(p => Number.isFinite(res[p.id]?.weekly));
      if (!rows.length) return null;
      const n = rows.reduce((s, p) => s + res[p.id].weekly, 0), vh = rows.reduce((s, p) => s + (Number.isFinite(res[p.id].volunteerHours) ? res[p.id].volunteerHours : 0), 0);
      return { p: { weekly: n, ...(vh ? { volHours: vh } : {}) }, dummy: rows.some(p => res[p.id].dummy), note: `weekly participants = ${num(n)} people taking part weekly in ${rows.length} Legacy-funded lines${vh ? `; volunteer hours = ${num(vh)}` : ''}. Someone in two programs counts twice.` };
    }
    if (id === 'contribution') {
      const lines = legacySpend();
      if (!lines.length) return null;
      const p = {};
      for (const l of lines) p[l.cat] = (p[l.cat] || 0) + l.amount;
      return { p, note: `all known Legacy allocations (not audited spend), sorted into the NSWRL spending categories: ${Object.entries(p).map(([k, v]) => `${catName(k)} ${aud(v)}`).join('; ')}. Facility grants count as capital expenditure, staff roles as wages and salaries, match official programs as referees and match officials, and everything else as all other expenses.` };
    }
    return null;
  }

  // ---------- Legacy spend, in the NSWRL 2026 expenditure categories ----------
  const catOf = k => ORG_CATS.find(c => c[0] === k);
  const catName = k => catOf(k)[1];
  const isRole = name => /\b(manager|mgr|officer|gm)\b/i.test(name) || /\bDO\b/.test(name);
  // Category for one spend line. NSWRL publishes the categories and their rates; this only decides which category a
  // line belongs to, and the working is shown in the hover so it can be checked.
  function nswrlCategory(pillar, name, type) {
    if (pillar === 'FE') return 'capex';
    if (isRole(name)) return 'wages';
    if (/match official|referee/i.test(`${type} ${name}`)) return 'referees';
    return 'other';
  }
  function legacySpend() {
    const grants = A.allGrants().map(g => ({ amount: g.amount, cat: nswrlCategory(g.pillar, g.project || '', g.type || '') }));
    const dash = D.dashboard.map(d => ({ amount: d.total, cat: nswrlCategory(d.pillar, d.initiative, '') }));
    return [...grants, ...dash].filter(l => l.amount > 0);
  }
  // What a calculator runs on: the figures staff entered, otherwise what the app can fill from its data.
  function inputsFor(id) {
    const own = inputsOf(id);
    if (own._dummy) return { p: own, from: 'dummy', note: window.DemoView.NOTE }; // Demo view only
    if (Object.keys(own).length) return { p: own, from: 'entered' };
    const auto = autoInputs(id);
    return auto ? { ...auto, from: auto.dummy ? 'dummy' : 'data' } : { p: {}, from: 'none' };
  }
  const fromLine = inp => inp.from === 'dummy' ? `Inputs: ${inp.note}` : inp.from === 'data' ? `Inputs from Legacy data: ${inp.note}` : inp.from === 'entered' ? 'Inputs entered by staff (Impact > Calculators).' : '';

  function calcCard(c) {
    const inp = inputsFor(c.id), p = inp.p, res = c.run(p);
    return `<article class="econ-kpi calc" data-calc="${c.id}">
      <div class="ek-head"><span class="ek-id">${esc(D.impactMethods[c.lens].label)}</span><span>${c.frameworks.map(fwChip).join(' ')}</span></div>
      <h3 ${tip(`Formula: ${c.formula}\n\nCaveat: ${c.caveat}`)}>${esc(c.name)}</h3>
      ${res.missing ? `<p class="muted small"><span class="ek-state missing">Data collection required</span> ${esc(res.missing)}</p>`
        : `<div class="calc-results">${res.rows.map(([l, v, w]) => `<div ${tip(`${l}\n\n${w}`)}><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`}
      ${inp.from === 'data' ? `<p class="muted small"><b>Pre-filled from Legacy data:</b> ${esc(inp.note)} Enter your own figures to replace these.</p>` : ''}
      ${inp.from === 'dummy' ? `<p class="muted small"><span class="dummy-tag">[DUMMY]</span> ${esc(inp.note)} Enter real figures to replace these.</p>` : ''}
      <details class="ek-more"><summary>How it's calculated</summary>
        <code class="ek-formula">${esc(c.formula)}</code>
        <p class="ek-indicative small"><b>Caveat:</b> ${esc(c.caveat)}</p>
      </details>
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
      $('.calc-clear', el).addEventListener('click', () => { Store.set('methods', { ...stored(), [c.id]: {} }); renderCalcs(); document.dispatchEvent(new CustomEvent('data-changed')); });
    });
  }

  // ---------- Dollar value row (Impact > Overview) ----------
  const big$ = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'k' : aud(v);
  const srcLine = c => 'Source: ' + c.frameworks.map(id => `${F[id].org}, ${F[id].title} (${F[id].year})`).join('; ');

  const HEALTH_PER_PERSON = CLUB.value; // social benefit per weekly club sport participant a year (ASC & Griffith 2018)
  const healthWorking = `$${CLUB.value.toLocaleString('en-AU')} a year per person taking part weekly (social benefit of community club sport, Australian Sports Commission & Griffith Business School ${CLUB.year}, via the Clearinghouse for Sport)`;
  const LENS_KEYS = ['economic', 'social', 'cultural'];
  const per$1 = (v, base) => base ? `$${(v / base).toFixed(2)} per $1 of the ${big$(base)} allocated` : '';

  // What the $10M has delivered: [label, value, sub, hover working]. Every value traces to Legacy money or to people
  // reached by Legacy-funded work. Rugby-wide numbers are not counted as Legacy impact, and other programs' results are not
  // shown. Values that measure different things are never added together.
  function lensValues(lens) {
    const rows = [], known = A.centralisation().knownTotal, funding = D.context.totalLegacyFunding;
    const needs = (label, sub, how) => rows.push([label, 'Needs data', sub, how]);
    const dollars = text => Number(text.replace(/[^\d]/g, ''));

    if (lens === 'economic') {
      const c = CALCS.find(x => x.id === 'contribution'), inp = inputsFor('contribution'), res = c.run(inp.p);
      if (res.missing) needs('Economic contribution of Legacy spending', 'needs spend by category', `How it will be calculated: ${c.formula}\n${srcLine(c)}`);
      else {
        const total = res.rows.find(r => r[0] === 'Total economic contribution'), direct = res.rows.find(r => r[0] === 'Direct contribution (retained in NSW)'), v = dollars(total[1]);
        rows.push(['Economic contribution of Legacy spending', big$(v), inp.from === 'entered' ? 'from spend entered by staff' : per$1(v, known),
          `How this is worked out (NSW Rugby League 2026 expenditure flow analysis):\nLegacy spend in each category × share kept in NSW × multiplier.\n${total[2].split('\n').map(l => '• ' + l).join('\n')}\n\nDirect contribution (spend kept in NSW): ${direct[1]}\nTotal: ${total[1]}\n${inp.from === 'entered' ? '' : `Per $1: ${total[1]} ÷ ${aud(known)} allocated of the ${aud(funding)} program.\n`}\n${fromLine(inp)}\n\nCaveat: ${c.caveat}\n${srcLine(c)}`]);
      }
      const ev = CALCS.find(x => x.id === 'event'), evInp = inputsFor('event'), er = ev.run(evInp.p), evDummy = evInp.from === 'dummy';
      if (er.missing) needs('RWC event visitor spending', 'visitor survey not run yet', `How it will be calculated (${ev.name}): ${ev.formula}\n\nFor the Legacy-funded RWC event hubs. Run the eventIMPACTS visitor survey at the hubs, then enter the results under Calculators.\n\nCaveat: ${ev.caveat}\n${srcLine(ev)}`);
      else {
        const t = er.rows.find(r => r[0] === 'Total additional expenditure');
        rows.push(['RWC event visitor spending', (evDummy ? '[DUMMY] ' : '') + big$(dollars(t[1])), 'new spending at Legacy-funded event hubs', `${evDummy ? '[DUMMY] ' : ''}How this is worked out (${ev.name}):\n${er.rows.map(r => `• ${r[0]}: ${r[2]}`).join('\n')}\n\n${fromLine(evInp)}\n\nCaveat: ${ev.caveat}\n${srcLine(ev)}`]);
      }
    }

    if (lens === 'social') {
      const h = CALCS.find(x => x.id === 'health'), inp = inputsFor('health'), res = h.run(inp.p);
      if (res.missing) needs('Social value of weekly participants', 'needs weekly participants in Legacy programs', `How it will be calculated: people taking part weekly in Legacy-funded programs × ${healthWorking}, plus volunteer hours × $${VOL_RATE.toFixed(2)}.\n\nNo program has reported yet: the attendance sheet captures weekly participants. Rugby-wide player numbers are not used, because most players are not reached by Legacy funding.\n${srcLine(h)}`);
      else {
        const total = res.rows.find(r => r[0] === 'Total yearly value'), v = dollars(total[1]), dm = inp.from === 'dummy';
        const parts = res.rows.filter(r => !r[0].startsWith('PV') && r !== total && r[2] !== 'Not entered');
        rows.push(['Social value of weekly participants', (dm ? '[DUMMY] ' : '') + big$(v), `a year · indicative · ${per$1(v, known)}`,
          `${dm ? '[DUMMY] ' : ''}How this is worked out (${h.name}):\n${parts.map(r => `• ${r[0]}: ${r[2]}`).join('\n')}\nTotal: ${total[1]}\n\n${fromLine(inp)}\n\nCaveat: ${h.caveat}\n${srcLine(h)}`]);
      }
      const ms = A.measures(), pl = ms.players?.series || {}, mo = ms.matchOfficials?.series || {};
      if (Number.isFinite(pl[2025]) && Number.isFinite(pl[2026]) && Number.isFinite(mo[2025]) && Number.isFinite(mo[2026])) {
        const a = pl[2025] + mo[2025], b = pl[2026] + mo[2026], d = b - a;
        rows.push(['Change in active participants since 2025', `${d >= 0 ? '+' : ''}${num(d)}`, 'people, all NSW rugby: context, not all from Legacy', `Players + match officials: ${num(a)} in 2025 → ${num(b)} in 2026 (Rugby Analytics).\n\nNot a dollar value and not proof of Legacy impact: it covers all NSW rugby and other things changed too. Shown because the Legacy Program aims to grow these numbers.`]);
      }
    }

    if (lens === 'cultural') {
      const tagged = [...A.allGrants().map(g => ({ name: g.project, amount: g.amount, tags: g.tags || [] })), ...D.dashboard.map(d => ({ name: d.initiative, amount: d.total, tags: d.tags || [] }))]
        .filter(l => l.amount > 0 && (l.tags.includes('firstNations') || l.tags.includes('pasifika')));
      const sumT = tagged.reduce((s, l) => s + l.amount, 0);
      rows.push(['Invested in First Nations and Pasifika programs', sumT ? big$(sumT) : 'Needs data', `${(sumT / funding * 100).toFixed(1)}% of the $10M · ${tagged.length} spend lines`,
        `The sum of Legacy allocations tagged First Nations or Pasifika (each line counted once).\n${tagged.map(l => `• ${l.name}: ${aud(l.amount)}`).join('\n')}\nTotal: ${aud(sumT)}\n\nThis is money invested, not the value of the outcome. Budgets, not audited spend.`]);
      rows.push(['Cultural value itself', 'Not in dollars', 'measured with the five CDN outcomes instead',
        `No published method puts a dollar value on cultural outcomes such as belonging or cultural identity. The Cultural Development Network measures them as the share of people who agree each outcome happened for them (see the Cultural outcomes calculator), and First Nations data is collected under the Maiam nayri Wingara Indigenous Data Sovereignty principles.\n\nSource: ${F.CDN.org}, ${F.CDN.title}`]);
    }
    return rows;
  }

  function renderDollars() {
    const host = $('#dollarRow');
    if (!host) return;
    host.innerHTML = LENS_KEYS.map(k => `<article class="pillar-value lens-${k}">
        <h3>${esc(D.impactMethods[k].label)} impact</h3>
        <div class="pv-invest">${esc(D.impactMethods[k].question)}</div>
        <ul class="pv-rows">${lensValues(k).map(([l, v, s, t]) => `<li><span class="pv-label">${esc(l)}</span><b class="${/^(Needs data|Not in dollars)$/.test(v) ? 'pv-missing' : ''}" ${tip(t)}>${esc(v)}</b><span class="pv-sub">${esc(s)}</span></li>`).join('')}</ul>
      </article>`).join('');
  }

  // One line per calculator with a result, for the AI agents and the Story.
  function contextLines() {
    const done = CALCS.map(c => [c, inputsFor(c.id)]).map(([c, inp]) => [c, inp, c.run(inp.p)]).filter(([, , r]) => !r.missing);
    if (!done.length) return ['LEGACY VALUE: none calculated yet (all need data collection).'];
    return ['LEGACY VALUE (published formulas applied to Legacy spending and people reached by Legacy programs):',
      ...done.map(([c, inp, r]) => `- ${c.name} [${c.frameworks.map(id => F[id].org).join('; ')}]${inp.from === 'dummy' ? ' [DUMMY: made-up inputs, never report as a result]' : inp.from === 'data' ? ' (inputs: ' + inp.note + ')' : ''}: ` + r.rows.map(([l, v]) => `${l} ${v}`).join('; '))];
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

    const toc = [['m-overview', 'How it works'], ['m-data', 'Data in'], ['m-calc', 'Figures'], ['m-ai', 'AI insights'], ['m-check', 'Checks & learning'], ['m-story', 'Story'], ['m-impact', 'Impact methods'], ['m-proto', 'Prototype indicators'], ['m-sources', 'Sources']];
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
        ['What an upload changes', 'A region + amount column becomes spend on the dashboard. Other numeric region columns become map layers. A "lens"/"impact" column becomes impact evidence. Yearly counts (players, coaches, match officials, female, First Nations or Pasifika participants) become yearly figures the recommendations and reports use.'],
        ['No double counting', 'Rows whose dollar amount is already in the built-in data are skipped. Re-uploading a file replaces its earlier contribution.'],
        ['Missing is never zero', 'Absent data shows as "No data yet" or "Data collection required", never as 0.'],
      ])) +
      section('m-calc', 'How the figures are calculated', `<p>All figures are deterministic code in <i>js/analytics.js</i>, <i>js/kpi-framework.js</i> and <i>js/methods.js</i>. Hover any underlined number in the app to see its workings.</p>` + steps([
        ['Spend totals', 'Sums of known allocations (grants + dashboard budgets + uploads) by pillar and region. Known allocations are budgets, not audited expenditure.'],
        ['Held centrally', 'Spend on lines marked "Statewide" ÷ all known spend.'],
        ['NSW Rugby KPI Framework', 'The evaluation team\'s 27 KPIs (9 economic, 8 social, 10 cultural) from the KPI Formula Web Handover, applied exactly as specified. Each submission carries a reporting period, scope, method version, source and verification level; results are labelled Calculated — Verified, Calculated — Estimated or Hypothetical Example, and otherwise Data Collection Required, Not Calculable, Not applicable or Validation Failed. Inactive KPIs never show a value. The full specification is on the <a href="#" data-goto="framework">Framework</a> tab.'],
        ['Value calculators', 'Calculators that apply formulas published by other organisations (NSWRL 2026, eventIMPACTS, ABS GSS benchmarks, CDN, and per-person values from the Australian Sports Commission via the Clearinghouse for Sport). See Impact methods below.'],
        ['Activity and happiness by place (Impact)', `For each facility and region. <b>People taking part</b> = "people reached" entered for each Legacy-funded facility or region (Programs and regions add up from it). <b>Dollar value</b> = people taking part × ${HEALTH_PER_PERSON.toLocaleString('en-AU')} a year for each person taking part weekly (Australian Sports Commission & Griffith 2018, via the Clearinghouse for Sport). <b>Happiness index</b> = average answer to the life satisfaction question from the ASC Community Perceptions Monitor (0–10) × 10, comparable with national data, from staff-entered or uploaded surveys; with an earlier survey the change is shown in points. No real survey: flagged "Survey needed". Figures marked <b>[DUMMY]</b> appear only in Demo view (top bar) and are made up (demo/Dummy-dataset.csv) for data NSW Rugby does not hold yet. Demo view assumes all the data is there, so the whole tool can be shown working; with it off they do not appear. Nothing is saved in Demo view, and any real figure replaces them. The reasons for every formula this project adapted or created, and the past research behind each value, are in sections 4 and 6 of the <a href="#" data-goto="framework">Framework</a>. Life satisfaction is not converted to dollars: the WELLBY value is UK HM Treasury guidance with no Australian equivalent.`],
        ['What the $10M has delivered', `Only Legacy money and people reached by Legacy-funded work count; rugby-wide numbers and other programs\' results do not. <b>Economic</b>: all known Legacy allocations, sorted into NSWRL 2026 categories (facility grants → capital expenditure ${catOf('capex')[2] * 100}% kept in NSW × ${catOf('capex')[3]}; staff roles → wages ${catOf('wages')[2] * 100}% × ${catOf('wages')[3]}; match official programs → referees ${catOf('referees')[2] * 100}% × ${catOf('referees')[3]}; everything else → all other expenses ${catOf('other')[2] * 100}% × ${catOf('other')[3]}), shown per $1 allocated. RWC event spending (eventIMPACTS) waits for the visitor survey. <b>Social</b>: people taking part weekly in Legacy programs × ${CLUB.value.toLocaleString('en-AU')} (Australian Sports Commission & Griffith 2018), plus volunteer hours × ${VOL_RATE.toFixed(2)} (BCG for the ASC 2017). <b>Cultural</b>: spend tagged First Nations or Pasifika (money invested, not value); cultural outcomes have no published dollar method. Reasons and research are in sections 4 and 6 of the <a href="#" data-goto="framework">Framework</a>.`],
      ])) +
      section('m-ai', 'How the AI generates insights', steps([
        ['Model', `Runs locally through Ollama by default (currently <b>${esc(model)}</b>; default qwen2.5:7b), so program data stays on NSW Rugby's computer. On Vercel it can use Ollama Cloud or an OpenAI-compatible provider. Settings: temperature 0.3 for agents (0.6 for stories), 8,192-token context, JSON output mode, reasoning ("thinking") off.`],
        ['System prompt', `Every call starts with the same instruction: <code>${esc(O.SYSTEM)}</code>`],
        ['Shared briefing', 'The calculated figures (pillar totals, region table, flags, targets, impact measures, economic KPIs, programs, field evidence, data quality) are written as text. The AI gets the answers, not raw data to add up: small local models are unreliable at arithmetic, so results such as "above population share" are pre-computed and marked as ground truth.'],
        ['Agents', O.AGENTS.map(a => `<div class="agent-brief" ${tip(a.brief)}><b>${esc(a.name)}</b> (${esc(a.pillar)}): ${esc(a.brief.split('\n')[0])}</div>`).join('')],
        ['Output format', 'Each agent must return JSON: title, 2–3 sentence insight, severity (positive / watch / risk), impact type, region, the key numbers as evidence, and one recommended action.'],
        ['Rules in every agent prompt', 'Use the flags exactly; take each dollar figure from its own region\'s row; say "First Nations"; quote field evidence only with its source; never invent numbers, formulas or dollar values; follow the staff feedback section.'],
        ['Speed', 'The briefing is identical for every task, so it is sent ahead of time ("pre-reading") and Ollama reuses it from its cache for 30 minutes. Agents after the first only read their short task.'],
        ['When the AI is offline', 'A rule engine writes equivalent insights directly from the calculated figures, so the app never shows an empty Insights tab. These are labelled "Rule engine".'],
      ]) + `<details class="ek-more"><summary>See the exact briefing the AI reads right now</summary><pre class="lessons briefing">${esc(briefing)}</pre></details>`) +
      section('m-check', 'Checks and learning', steps([
        ['Automatic fact check', 'Every sentence that says a region is above or below its population share is compared with that region\'s calculated status. Contradictions are shown on the insight as "Fails data check", not hidden.'],
        ['Staff review queue', 'New insights wait in "To review". Staff verify (👍) or dispute (👎, with a reason). Disputed insights are kept out of the Story.'],
        ['Re-runs', 'A new run archives the previous run\'s unrated insights, keeps rated ones, and hides new insights that repeat a kept one.'],
        ['Learning from feedback', 'Verified examples, disputed items with reasons, deletions and failed checks are summarised into a "learned from staff feedback" section added to every later prompt. The model itself is not retrained; rated insights can be exported as training data for fine-tuning later.'],
        ['Data quality rating', 'Every file gets a rule-based score, optionally reviewed by the AI (see Prototype indicators for the weights).'],
      ])) +
      section('m-story', 'Impact reports (Story tab)', steps([
        ['Page templates', 'Nine 16:9 page templates (cover, investment drives impact, pillar overview, pillar chapter, outcome data, region or deliverable, estimated value, impact recap, formula appendix) plus a one-page media release, modelled on the Legacy \'23, Scottish FA, Birmingham 2022 and KPMG reference reports.'],
        ['Report types', 'Board Summary (overview, expenditure, regional reach, recap), Funding Acquittal (1, 2, expenditure, 3, 5, 7, 9 with sign-off), Annual Report Chapter (1, 2, expenditure, 3–6 and 8, one chapter per pillar), Community Story (1, 4, 6) and Media Release (one page). Staff choose a type and a scope (whole program, a pillar, a region or a deliverable); the pages assemble themselves.'],
        ['Where the figures come from', 'Every number is calculated from the app\'s data: known allocations, program results, uploaded Rugby Analytics series, targets, KPI results and valuations. Missing figures show as "NO DATA", never zero. Pillar objectives are quoted from the Program Logic; quotes come only from evidence typed in by staff.'],
        ['AI\'s part', 'Each page has a rule-based draft. "Write narrative with AI" rewrites only the narrative sentences (headline, summary, outcome title, region findings, media headline) from the same facts; disputed insights are never used.'],
        ['Editing and export', 'All text is editable on the page and photos are added by clicking a photo slot. Export prints one 16:9 page per template page. Media releases carry a "needs approval" banner.'],
      ])) +
      section('m-impact', 'Impact methods', `<p>Impact is measured only with methods published by other organisations. The project brief asks for best-practice frameworks from other sporting codes, compliant with NSW Treasury guidelines; new formulas are left to the evaluation team.</p>
        <div class="table-scroll"><table class="pretty-table method-table"><thead><tr><th>Framework</th><th>Organisation</th><th>How Tackle AI uses it</th></tr></thead><tbody>
        ${Object.keys(F).map(id => `<tr><td>${fwLink(id)}</td><td>${esc(F[id].org)} (${F[id].year})</td><td>${esc(F[id].use)}</td></tr>`).join('')}</tbody></table></div>
        ${Object.entries(D.impactMethods).map(([k, lens]) => `<h3>${esc(lens.label)} — ${cov[k].measured} measured, ${cov[k].partial} partial, ${cov[k].none} no data</h3>
          <div class="table-scroll"><table class="pretty-table method-table"><thead><tr><th>Measure</th><th>Framework</th><th>How it is measured</th><th>Status</th></tr></thead><tbody>
          ${cov[k].measures.map(m => `<tr><td>${esc(m.name)}</td><td ${tip(F[m.framework].use)}>${esc(F[m.framework].org)}</td><td>${esc(m.how)}</td><td><span class="status ${m.status === 'measured' ? 'positive' : m.status === 'partial' ? 'watch' : ''}">${{ measured: 'Measured', partial: 'Partial', none: 'No data yet' }[m.status]}</span><br><span class="muted small">${esc(m.value)}</span></td></tr>`).join('')}</tbody></table></div>`).join('')}
        <h3>Valuation formulas</h3>
        ${CALCS.map(c => `<div class="method-formula"><b>${esc(c.name)}</b> <span class="muted small">(${c.frameworks.map(id => esc(F[id].org)).join('; ')})</span><code class="ek-formula">${esc(c.formula)}</code><span class="muted small">${esc(c.caveat)}</span></div>`).join('')}
        <p class="muted small">Discounting follows NSW Treasury TPG23-08: 5% real central rate with 3% and 7% sensitivity; BCR = present value of benefits ÷ present value of costs. Costs accrue every year and benefits start after the first year.</p>`) +
      section('m-proto', 'Prototype indicators (not from an external framework)', `<p>These screening indicators help find where to look. They are <b>not impact measures</b>, are labelled on hover wherever they appear, and are waiting for review by the evaluation team.</p>` + steps([
        ['Spend vs population', 'Region share of regionally allocated spend ÷ its share of NSW population; 1.75x or more = above population share, 0.5x or less = below it. Population is indicative.'],
        ['Data quality score', 'Tables: 25 row-level records + 20 region + 15 date/season + 15 dollar amounts + 10 demographic split + 15 × completeness. Documents: 10 + 8 each for region detail, recent year and dollar figures + 6 for inclusion groups. Green 70+, amber 40–69, red below 40.'],
      ])) +
      section('m-sources', 'Sources', `<ul class="ek-sources">${Object.keys(F).map(id => `<li><b>${esc(F[id].org)}</b> - ${fwLink(id)} (${F[id].year})</li>`).join('')}</ul>`);
  }

  document.addEventListener('app-ready', () => { renderCalcs(); renderDollars(); renderMethodology(); });
  // Uploads can change the pre-filled inputs (participants, facility grants).
  document.addEventListener('data-changed', () => { renderDollars(); if (!$('#calcGrid form:focus-within')) renderCalcs(); renderMethodology(); });
  document.addEventListener('insights-changed', renderMethodology);
  document.addEventListener('tab', e => { if (e.detail === 'methodology') renderMethodology(); });

  window.Methods = { CALCS, PARAMS: { CLUB, VOL_RATE, ORG_CATS, PART_CATS, SUBSTITUTION, GSS, CDN_OUTCOMES }, lensValues, HEALTH_PER_PERSON, healthWorking, inputsFor, contextLines, renderCalcs, renderDollars, renderMethodology };
})();
