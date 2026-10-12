// Economic KPIs: the nine formulas in Dataset/NSW_Rugby_Economic_KPI_Formula_Summary.xlsx
// ("KPI Formula & Reference Summary" sheet). Each KPI is computed for a baseline and a follow-up
// period from summary inputs entered by staff; edge cases follow the workbook's rules exactly
// (Not applicable / Not calculable / Data collection required - missing is never treated as zero).
(() => {
  const { $, $$, esc, money, toast } = window.App;

  const WORKBOOK = 'NSW_Rugby_Economic_KPI_Formula_Summary.xlsx';
  const PERIODS = [['baseline', 'Baseline'], ['followup', 'Follow-up']];
  const aud = v => '$' + Math.round(v).toLocaleString('en-AU');
  const aud2 = v => '$' + v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct1 = v => v.toFixed(1) + '%';
  const signed = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));
  const ok = value => ({ ok: true, value });
  const missing = () => ({ ok: false, code: 'missing', label: 'Data collection required' });
  const na = why => ({ ok: false, code: 'na', label: 'Not applicable', why });
  const nc = why => ({ ok: false, code: 'nc', label: 'Not calculable', why });
  const bad = why => ({ ok: false, code: 'invalid', label: 'Check inputs', why });
  const has = (p, ...keys) => keys.every(k => typeof p[k] === 'number' && Number.isFinite(p[k]));

  // Shared change rules: rates change in percentage points, AUD totals in AUD,
  // unit costs in AUD and % (the % change needs a positive baseline).
  const ppChange = (b, f) => `${signed(f - b, v => v.toFixed(1))} pp`;
  const audChange = (b, f) => signed(f - b, aud);
  const unitChange = (b, f) => `${signed(f - b, aud2)}${b > 0 ? ` (${signed((f - b) / b * 100, v => v.toFixed(1))}%)` : ''}`;

  const src = (id, org, title, locator, supports, url) => ({ id, org, title, locator, supports, url });
  const SOURCES = {
    F1: src('F1', 'Sport England', 'Moving Communities in Focus – April 2022', 'Financial performance, printed pp. 12–13', 'Explicitly supports the cost-recovery ratio; the rugby earned-income/cash boundary is adapted.', 'https://sportengland-production-files.s3.eu-west-2.amazonaws.com/s3fs-public/2022-05/Moving%20Communities%20in%20Focus%20-%20April%202022..pdf?VersionId=hQmh.eY3P3L6br8iPjB9WNme7hajlVxQ'),
    F2: src('F2', 'Sport England', 'Moving Communities Facilities Impact Report April 2023–March 2025', 'Section 5 Finance, printed pp. 26–32; p. 26 footnote 5', 'Supports income/cost recovery and price/management context; does not prescribe the rugby exclusions.', 'https://sportengland-production-files.s3.eu-west-2.amazonaws.com/s3fs-public/2025-11/Moving-Communities-Impact-Report-April-2023-March-2025.pdf?VersionId=_670uUO7d.qngNLgWhMBB7xxO5ltbYlp'),
    F3: src('F3', 'NSW Office of Sport', 'Multi-Sport Community Facility Fund – Program Guidelines 2022/2023 (Round 2)', 'Key objectives p. 5; Design principles p. 6; Merit criteria 1 and 3, p. 12', 'Supports usage/capacity schedules, operating viability and evidence of co-contributions; does not prescribe the exact rugby formula.', 'https://www.sport.nsw.gov.au/sites/default/files/2026-01/mscff_2022_guidelines.pdf'),
    F4: src('F4', 'Sport England', 'Moving Communities', 'Facilities — Operating model; Finance dashboard', 'Supports attendance/use and facility-performance records, not a bookable-field-hour definition.', 'https://www.sportengland.org/research-and-data/data/moving-communities?section=access_the_reports'),
    T1: src('T1', 'NSW Treasury', 'Evaluation Guidelines (TPG22-22)', 'Printed pp. 21–22 §4.3–4.4; pp. 30–32 §6.2; pp. 57–60 Appendix C', 'Supports cost per delivered output and the efficiency vs causal cost-effectiveness distinction.', 'https://arp.nsw.gov.au/assets/ars/attachments/tpg22-22-evaluation-guidelines.pdf'),
    T3: src('T3', 'NSW Treasury', 'Monitoring and Evaluation framework — TPG22-22 Technical Note (Dec 2025)', 'Printed p. 9; p. 10 Table 2; p. 14; pp. 15–16', 'Supports input classification and baseline/data specifications; does not prescribe the cash-sum formula.', 'https://www.nsw.gov.au/sites/default/files/noindex/2025-12/Monitoring%20and%20evaluation%20framework.pdf'),
    W1: src('W1', 'Australian Sports Commission / Clearinghouse for Sport', 'Sport Volunteering Dashboard', 'Data sources — AusPlay; Community Perceptions Monitor', 'Supports volunteer roles/hours and AusPlay’s 15+ definition; not an audited rugby hours formula.', 'https://www.ausport.gov.au/clearinghouse/research/volunteer-dashboard'),
    W4: src('W4', 'Sport New Zealand — Ihi Aotearoa', 'Recruiting and managing volunteers', 'Planning to recruit volunteers; volunteer management programme', 'Supports volunteer planning, role/training records and programme management; no rate formula.', 'https://sportnz.org.nz/resources/recruiting-and-managing-volunteers/'),
    W5: src('W5', 'Australian Sports Commission / Clearinghouse for Sport', 'Market Segmentation — Volunteers', 'Introductory findings / workforce insights', 'Supports retention rationale; intention to continue is not observed retention.', 'https://www.ausport.gov.au/clearinghouse/research/market-seg/volunteers'),
    W6: src('W6', 'Audit Office of New South Wales', 'Assessment of the use of a training program (2018)', '2.2 Economy of the program — Exhibit 5', 'Supports a training unit-cost example using restricted direct costs; rugby credential/cost scope is adapted.', 'https://www.audit.nsw.gov.au/our-work/reports/assessment-of-the-use-of-a-training-program'),
    I1: src('I1', 'NSW Office of Sport; University of Sydney SPRINTER Group', 'Active Kids Evaluation Report 2018–2020 – Full Report (2022)', 'Printed pp. 9, 12–18, 73–78', 'Supports expenditure excluding voucher support and redeemed financial support; not the rugby formula.', 'https://www.sport.nsw.gov.au/sites/default/files/2024-05/active_kids_outcomes_evaluation_-_sprinter_group.pdf'),
    I3: src('I3', 'Sport New Zealand — Ihi Aotearoa', 'Tū Manawa Active Aotearoa: Insights July 2020 – June 2024', 'PDF pp. 1–3', 'Supports funding/resource and reach reporting; supplies no unit-cost formula.', 'https://sportnz.org.nz/media/rssbmwre/t%C5%AB-manawa-insights-from-july-2020-to-june-2024.pdf'),
    I4: src('I4', 'NSW Office of Sport; The Centre for International Economics', 'Economic evaluation of the Active Kids program (2022)', 'Printed pp. 24–29, 72–74, 78–80', 'Supports actual voucher/programme payments and cost boundaries; not this beneficiary-linked formula.', 'https://www.sport.nsw.gov.au/sites/default/files/2024-05/cie_final_report_nsw_office_of_sport_active_kids_program_-_05072022_public.pdf'),
    I6: src('I6', 'Australian Sports Commission commissioned research (Frontiers in Sports and Active Living)', 'Cost to play community-level sport in Australia (2026)', 'Methods: Measures; Data analysis; Limitations', 'Supports itemised community-sport costs; supplementary research, not an official KPI standard.', 'https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2026.1891152/full'),
  };

  // inputs: [key, label, unit]. calc(period) -> ok(value) | status. fmt: value formatter. change(b, f): text.
  // indicative: figures we hold that are NOT valid KPI inputs under the workbook rules (shown, never computed).
  const KPIS = [
    { id: 'P1-01', pillar: 'FE', name: 'Facility Utilisation Rate', cls: 'Adapted', unit: '%; change in pp',
      formula: '100 × actual used standard-field-equivalent hours ÷ approved bookable standard-field-equivalent hours',
      rule: 'Sum hours across sites (never average site percentages). A half-field for one hour = 0.5 field-hours. Zero bookable hours: Not applicable. Equipment-only projects: Not applicable.',
      inputs: [['used', 'Actual used field-hours', 'hours'], ['bookable', 'Approved bookable field-hours', 'hours']],
      calc: p => !has(p, 'used', 'bookable') ? missing() : p.bookable === 0 ? na('Zero bookable hours') : p.used > p.bookable ? bad('Used hours exceed bookable capacity (cap concurrent uses at field capacity)') : ok(100 * p.used / p.bookable),
      fmt: pct1, change: ppChange, sources: ['F3', 'F4'] },
    { id: 'P1-02', pillar: 'FE', name: 'Realised Cash Co-investment', cls: 'Proposed', unit: 'AUD per period',
      formula: 'Σ verified in-scope co-investment cash contributions recognised in the period − related returns/reversals',
      rule: 'Count each contribution once even if later spent. Exclude the core Legacy grant, debt, undisbursed commitments and in-kind value. Missing reconciliation: Data collection required.',
      inputs: [['contrib', 'Verified cash contributions', 'AUD'], ['returns', 'Returns / reversals', 'AUD']],
      calc: p => !has(p, 'contrib') ? missing() : (p.returns ?? 0) > p.contrib ? bad('Returns exceed contributions') : ok(p.contrib - (p.returns ?? 0)),
      fmt: aud, change: audChange, sources: ['F3', 'T3'],
      indicative: 'Holroyd (Cumberland Council): $561,000 project cost vs $150,000 Legacy grant implies ~$411,000 planned co-funding (3.74x leverage). This is a committed project budget, not verified realised cash, so the formula excludes it.' },
    { id: 'P1-03', pillar: 'FE', name: 'Facility Operating Cost Recovery Rate', cls: 'Adapted', unit: '%; change in pp',
      formula: '100 × earned facility operating income net of refunds ÷ agreed recurring cash operating expenditure',
      rule: 'Exclude capital grants, loans, donations and subsidies from income; exclude capital, depreciation, financing and unpaid labour from costs. Zero operating costs: Not calculable. No 100% target is implied.',
      inputs: [['income', 'Earned income net of refunds', 'AUD'], ['cost', 'Recurring operating cash costs', 'AUD']],
      calc: p => !has(p, 'income', 'cost') ? missing() : p.cost === 0 ? nc('Zero operating costs - report income separately') : ok(100 * p.income / p.cost),
      fmt: pct1, change: ppChange, sources: ['F1', 'F2'] },
    { id: 'P3-01', pillar: 'PW', name: 'Active Workforce Cohort Retention Rate', cls: 'Proposed', unit: '%; cohort-to-cohort change in pp',
      formula: '100 × unique baseline-cohort people active in the follow-up season ÷ unique active people in the original baseline cohort',
      rule: 'Active = at least one approved delivered assignment in the season. Exclude new entrants from the numerator. Unmatched records are Data collection required, not assumed exits. Zero cohort: Not applicable.',
      inputs: [['cohort', 'Unique active people in cohort', 'people'], ['retained', 'Of those, active next season', 'people']],
      periodLabels: ['Cohort A → B', 'Cohort B → C'],
      calc: p => !has(p, 'cohort', 'retained') ? missing() : p.cohort === 0 ? na('Zero baseline cohort') : p.retained > p.cohort ? bad('Retained exceeds cohort (new entrants must be excluded)') : ok(100 * p.retained / p.cohort),
      fmt: pct1, change: ppChange, sources: ['W4', 'W5'],
      indicative: 'The plan cites a 39.5% workforce churn baseline. The workbook states this undefined planning figure is not this baseline, so no retention rate is derived from it.' },
    { id: 'P3-02', pillar: 'PW', name: 'Cash Training Cost per Newly Qualified Person', cls: 'Adapted', unit: 'AUD per newly qualified person',
      formula: 'Agreed cash training-delivery expenditure for the cohort ÷ unique cohort members newly achieving the approved credential by the cutoff',
      rule: 'Keep costs of unsuccessful learners. Exclude prior holders, renewals and duplicate awards. Zero new qualifications: Not calculable.',
      inputs: [['cost', 'Cohort cash training cost', 'AUD'], ['qualified', 'Newly qualified people', 'people']],
      calc: p => !has(p, 'cost', 'qualified') ? missing() : p.qualified === 0 ? nc('Zero new qualifications - show costs and zero output separately') : ok(p.cost / p.qualified),
      fmt: aud2, change: unitChange, sources: ['T1', 'W6'],
      indicative: 'Dashboard budget: Female MO course at ~$20 per participant for 100 new female MOs. Planned budget and enrolments, not actual cost per new award, so the formula excludes it.' },
    { id: 'P3-03', pillar: 'PW', name: 'Unpaid Volunteer Delivery Hours', cls: 'Adapted', unit: 'person-hours',
      formula: 'Σ verified non-overlapping unpaid person-hours in approved assignments',
      rule: 'Two people for one hour = 2 person-hours; one person’s simultaneous roles count once. Exclude player participation and paid/honorarium roles. Incomplete logging: report coverage, not a full census. No wage multiplier is applied.',
      inputs: [['hours', 'Verified unpaid person-hours', 'hours'], ['coverage', 'Log coverage (optional)', '%']],
      calc: p => !has(p, 'hours') ? missing() : ok(p.hours),
      fmt: v => Math.round(v).toLocaleString('en-AU') + ' h', change: (b, f) => signed(f - b, v => Math.round(v).toLocaleString('en-AU')) + ' person-hours',
      note: p => has(p, 'coverage') && p.coverage < 100 ? `incomplete: ${p.coverage}% log coverage` : '',
      sources: ['W1', 'W4'],
      indicative: 'Context only: 45% of volunteers give 6+ hours/week (Program Logic). Not verified rugby person-hours.' },
    { id: 'P4-01', pillar: 'INC', name: 'Inclusion Delivery Cost per Unique Participant Served', cls: 'Adapted', unit: 'AUD per unique participant',
      formula: 'Agreed cash inclusion-delivery expenditure for the cycle ÷ unique eligible participants with at least one verified attendance in the cycle',
      rule: 'Keep services/cohorts separate. Registrations, targets and visit counts are not the denominator. Exclude unpaid labour and notional fee discounts. Zero participants: Not calculable.',
      inputs: [['cost', 'Service cash cost for the cycle', 'AUD'], ['people', 'Unique verified attendees', 'people']],
      calc: p => !has(p, 'cost', 'people') ? missing() : p.people === 0 ? nc('Zero participants - report costs separately') : ok(p.cost / p.people),
      fmt: aud2, change: unitChange, sources: ['T1', 'I3'] },
    { id: 'P4-02', pillar: 'INC', name: 'Comparable Participant Out-of-Pocket Cost Change', cls: 'Adapted', unit: 'AUD per participant; negative = reduction',
      formula: 'For matched respondents: mean of (follow-up net cash participation cost − baseline net cash participation cost)',
      rule: 'Net cost = agreed gross cash basket − realised in-basket support, capped at item cost (never negative). Use the same matched respondents in both periods. No matched baseline: change unavailable.',
      inputs: [['mean', 'Mean net cash cost (matched)', 'AUD'], ['n', 'Matched respondents', 'people']],
      calc: p => !has(p, 'mean', 'n') ? missing() : p.n === 0 ? na('No matched respondents') : p.mean < 0 ? bad('Net out-of-pocket cost cannot be negative') : ok(p.mean),
      fmt: aud2, change: (b, f) => `${signed(f - b, aud2)} per participant${f < b ? ' (reduction)' : ''}`,
      pairCheck: (b, f) => b.n !== f.n ? 'Matched respondent counts differ between periods - use the same matched set' : '',
      sources: ['I1', 'I6'] },
    { id: 'P4-03', pillar: 'INC', name: 'Cash Participation Support Delivered', cls: 'Proposed', unit: 'AUD per service/cycle',
      formula: 'Σ verified eligible beneficiary-linked cash support payments in the period − related returns/reversals',
      rule: 'Exclude planned budgets, unredeemed offers, general delivery costs and grants without beneficiary linkage. Count fee waivers/free places separately with no hypothetical price.',
      inputs: [['support', 'Beneficiary-linked support paid', 'AUD'], ['reversals', 'Returns / reversals', 'AUD'], ['recipients', 'Recipients (supporting)', 'people']],
      calc: p => !has(p, 'support') ? missing() : (p.reversals ?? 0) > p.support ? bad('Reversals exceed payments') : ok(p.support - (p.reversals ?? 0)),
      fmt: aud, change: audChange,
      note: p => has(p, 'recipients') ? `${p.recipients.toLocaleString('en-AU')} recipients` : '',
      sources: ['I1', 'I4'],
      indicative: 'Dashboard plans $25k for First Nations and Pasifika coach bursary places. A planned budget is excluded until payments are made to named recipients.' },
  ];
  const PILLARS = { FE: 'Pillar 1 — Facilities & Equipment', PW: 'Pillar 3 — Programs & Workforce', INC: 'Pillar 4 — Inclusion' };

  // ---------- data ----------
  const all = () => Store.get('econ') || {};
  const entry = id => all()[id] || { baseline: {}, followup: {} };
  function save(id, value) { Store.set('econ', { ...all(), [id]: value }); }

  function evaluate(k) {
    const e = entry(k.id);
    const res = Object.fromEntries(PERIODS.map(([p]) => [p, k.calc(e[p] || {})]));
    let change = null, warn = '';
    if (res.baseline.ok && res.followup.ok) {
      warn = k.pairCheck?.(e.baseline, e.followup) || '';
      change = k.change(res.baseline.value, res.followup.value);
    }
    const latest = res.followup.ok ? res.followup : res.baseline;
    return { e, res, change, warn, latest, calculated: res.baseline.ok || res.followup.ok };
  }

  const resultText = (k, r, p) => r.ok ? k.fmt(r.value) + (k.note?.(p) ? ` (${k.note(p)})` : '') : r.label + (r.why ? ` - ${r.why}` : '');

  // ---------- UI ----------
  function card(k) {
    const ev = evaluate(k);
    const labels = k.periodLabels || PERIODS.map(([, l]) => l);
    const cell = (r, p) => r.ok
      ? `<b>${esc(k.fmt(r.value))}</b>${k.note?.(p) ? `<small>${esc(k.note(p))}</small>` : ''}`
      : `<span class="ek-state ${r.code}">${esc(r.label)}</span>${r.why ? `<small>${esc(r.why)}</small>` : ''}`;
    const field = (period, [key, label, unit]) => `<label>${esc(label)}<span class="unit-in"><input type="number" step="any" min="0" data-period="${period}" data-key="${key}" value="${ev.e[period]?.[key] ?? ''}"><i>${esc(unit)}</i></span></label>`;
    return `<article class="econ-kpi" data-id="${k.id}">
      <div class="ek-head"><span class="ek-id">${k.id}</span><span class="impact-chip economic">${k.cls}</span></div>
      <h3>${esc(k.name)}</h3>
      <code class="ek-formula">${esc(k.formula)}</code>
      <div class="ek-results">
        ${PERIODS.map(([p], i) => `<div><span>${esc(labels[i])}</span>${cell(ev.res[p], ev.e[p] || {})}</div>`).join('')}
        <div><span>Change</span>${ev.change ? `<b>${esc(ev.change)}</b>` : '<small class="muted">needs both periods</small>'}</div>
      </div>
      ${ev.warn ? `<div class="fact-check">${esc(ev.warn)}</div>` : ''}
      <p class="ek-unit muted small detail-only">Unit: ${esc(k.unit)}</p>
      ${k.indicative ? `<p class="ek-indicative small"><b>Indicative only, not a KPI result:</b> ${esc(k.indicative)}</p>` : ''}
      <details class="ek-more"><summary>Enter data</summary>
        <form class="ek-form">
          ${PERIODS.map(([p], i) => `<fieldset><legend>${esc(labels[i])}</legend>
            <label>Period / site / cohort<input type="text" data-period="${p}" data-key="label" value="${esc(ev.e[p]?.label ?? '')}" placeholder="e.g. 2025 season, Holroyd Field 1"></label>
            ${k.inputs.map(f => field(p, f)).join('')}</fieldset>`).join('')}
          <p class="muted small">${esc(k.rule)}</p>
          <div class="row end"><button type="button" class="btn ek-clear">Clear</button><button class="btn primary">Calculate</button></div>
        </form>
      </details>
      <details class="ek-more"><summary>Formula source</summary>
        <ul class="ek-sources">${k.sources.map(id => SOURCES[id]).map(s => `<li><b>${s.id}</b> ${esc(s.org)} - <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><br><span class="muted">${esc(s.locator)}. ${esc(s.supports)}</span></li>`).join('')}</ul>
        <p class="muted small">From ${WORKBOOK}, "KPI Formula &amp; Reference Summary". No external source prescribes this exact rugby formula; it is an NSW Rugby-specific ${k.cls === 'Proposed' ? 'proposal' : 'adaptation'}.</p>
      </details>
    </article>`;
  }

  function render() {
    const host = $('#econKpis');
    if (!host) return;
    const evals = KPIS.map(evaluate);
    const done = evals.filter(e => e.calculated).length;
    $('#econSummary').textContent = `${done} of ${KPIS.length} KPIs calculated from entered data · ${KPIS.length - done} need data collection`;
    host.innerHTML = Object.entries(PILLARS).map(([p, label]) => `<h3 class="ek-pillar">${esc(label)}</h3>
      <div class="ek-grid">${KPIS.filter(k => k.pillar === p).map(card).join('')}</div>`).join('');
    $$('.econ-kpi', host).forEach(el => {
      const k = KPIS.find(x => x.id === el.dataset.id);
      const form = $('.ek-form', el);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const v = { baseline: {}, followup: {} };
        $$('input', form).forEach(i => {
          if (i.dataset.key === 'label') { if (i.value.trim()) v[i.dataset.period].label = i.value.trim(); }
          else if (i.value !== '') v[i.dataset.period][i.dataset.key] = Number(i.value);
        });
        save(k.id, v);
        render();
        toast(`${k.id} recalculated.`);
        document.dispatchEvent(new CustomEvent('data-changed'));
      });
      $('.ek-clear', el).addEventListener('click', () => { save(k.id, { baseline: {}, followup: {} }); render(); });
    });
  }

  // One line per KPI for the AI agents and the story generator.
  function contextLines() {
    return [`ECONOMIC KPIs (9-KPI framework, formulas from ${WORKBOOK}; descriptive monitoring indicators, NOT attributable net economic benefit; never invent values for KPIs marked DATA COLLECTION REQUIRED):`,
      ...KPIS.map(k => {
        const ev = evaluate(k);
        const p = per => resultText(k, ev.res[per], ev.e[per] || {}) + (ev.e[per]?.label ? ` [${ev.e[per].label}]` : '');
        const body = ev.calculated ? `baseline ${p('baseline')}; follow-up ${p('followup')}${ev.change ? '; change ' + ev.change : ''}` : 'DATA COLLECTION REQUIRED';
        return `- ${k.id} ${k.name} = ${k.formula}: ${body}`;
      })];
  }

  function exportCsv() {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['kpi_id', 'pillar', 'kpi', 'formula', 'baseline_label', 'baseline_result', 'followup_label', 'followup_result', 'change', 'unit', 'classification', 'sources']];
    for (const k of KPIS) {
      const ev = evaluate(k);
      rows.push([k.id, PILLARS[k.pillar], k.name, k.formula, ev.e.baseline?.label, resultText(k, ev.res.baseline, ev.e.baseline || {}), ev.e.followup?.label, resultText(k, ev.res.followup, ev.e.followup || {}), ev.change || '', k.unit, k.cls, k.sources.map(id => `${id} ${SOURCES[id].url}`).join(' ; ')]);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = 'tackle-economic-kpis.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.addEventListener('app-ready', () => {
    $('#econExport')?.addEventListener('click', exportCsv);
    render();
  });

  window.Econ = { KPIS, SOURCES, evaluate, contextLines, render };
})();
