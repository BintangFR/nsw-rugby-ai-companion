// NSW Rugby KPI Framework: the 27 KPIs in Dataset/NSW_Rugby_KPI_Formula_Web_Handover.xlsx, implemented exactly as the
// evaluation team specified (sheets "KPI Formulas", "Baseline Requirements", "Formula References" and
// "Web Input Requirements"). Pure calculation engine: no page code, so scripts/check.mjs can test it.
//
// Rules carried over from the handover's web input contract:
//  - Each submission ("wave") carries shared controls: reporting period, scope, method version, source reference,
//    record type, source verification, source checks, method permission, capture status, publication approval.
//  - Missing required input -> Data Collection Required. Invalid input -> Validation Failed. Never replace missing with 0.
//  - A change needs two calculated waves, comparison_approved = true and the same scope and method version.
//    Percentages change in percentage points. Results are descriptive, not causal.
//  - Inactive KPIs keep their ID and status only: no input, no zero, no result.
window.KPIF = (() => {
  const STATUS = {
    VERIFIED: 'Calculated — Verified', ESTIMATED: 'Calculated — Estimated', HYPOTHETICAL: 'Hypothetical Example',
    DCR: 'Data Collection Required', NC: 'Not Calculable', NA: 'Not applicable', FAIL: 'Validation Failed',
    INACTIVE: 'Inactive — no calculation authorised', QUALITATIVE: 'Qualitative evidence recorded',
  };
  const CALCULATED = [STATUS.VERIFIED, STATUS.ESTIMATED, STATUS.HYPOTHETICAL];
  const isCalculated = s => CALCULATED.includes(s);

  // Shared calculation controls, attached to every wave. [key, label, type, help]
  const META = [
    ['period_start', 'Reporting period start', 'date', 'Actual observation window for this wave.'],
    ['period_end', 'Reporting period end', 'date', 'Must be on or after the start.'],
    ['scope_id', 'Scope', 'text', 'Fixed programme / site / population, e.g. "Holroyd Field 1, 2026 season". Must match between waves to compare.'],
    ['method_version', 'Method version', 'text', 'Definition / question / rubric / basket version, e.g. "v1.0". Must match between waves to compare.'],
    ['source_ref', 'Source reference', 'text', 'Traceable approved source extract or reference (not raw respondent records).'],
    ['record_type', 'Record type', 'enum:Operational|Hypothetical', 'Operational = actual observations. Hypothetical = labelled example. Budgets, targets and forecasts are never actual observations.'],
    ['source_verification', 'Source verification', 'enum:Verified|Estimated|Not verified', 'Estimated = uncertainty the method permits in actual observations, not a forecast. Not verified blocks a reportable result.'],
    ['source_checks_passed', 'Source custodian checks passed', 'bool', 'The custodian confirms eligibility, uniqueness, capture completeness and required linkage/reconciliation.'],
    ['method_permission', 'Method permission', 'enum:Approved|Pending|Denied', 'Approval of the local question, data access and governance. Operational records require Approved.'],
    ['capture_status', 'Capture status', 'enum:Complete|Partial', 'Complete is required. Only P3-03 may use Partial logs, with log coverage stated.'],
    ['publication_approved', 'Approved for publication', 'bool', 'Disclosure review completed. If not ticked the result is shown internally only.'],
  ];
  const META_REQUIRED = ['period_start', 'period_end', 'scope_id', 'method_version', 'source_ref', 'record_type', 'source_verification', 'source_checks_passed', 'method_permission', 'capture_status'];

  // ---------- formatting ----------
  const pct = v => v.toFixed(1) + '%';
  const aud = v => (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-AU', { maximumFractionDigits: 0 });
  const aud2 = v => (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const int = v => Math.round(v).toLocaleString('en-AU');
  const hours = v => v.toLocaleString('en-AU', { maximumFractionDigits: 1 }) + ' person-hours';
  const signed = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));

  // ---------- results ----------
  const ok = (value, display, workings, extra = []) => ({ ok: true, value, display, workings, extra });
  const nc = reason => ({ status: STATUS.NC, reason });
  const na = reason => ({ status: STATUS.NA, reason });
  const fail = reason => ({ status: STATUS.FAIL, reason });
  const dcr = reason => ({ status: STATUS.DCR, reason });

  // ---------- reusable KPI shapes ----------
  // Survey item: positive categories / all substantive categories; exclusions outside the denominator.
  function survey({ positive, other, exclusions, exclusionsRequired = false, label }) {
    const cats = [...positive, ...other];
    const inputs = [
      ...cats.map(([k, l]) => [k, l, 'int', 'respondents', 'req', `Unique eligible responses selecting "${l}".`]),
      ...exclusions.map(([k, l]) => [k, `${l} (excluded)`, 'int', 'respondents', exclusionsRequired ? 'req' : 'opt', `Outside the valid denominator. Leave blank if the count is not available: blank is not zero.`]),
      ['invited_eligible', 'Invited eligible people (optional)', 'int', 'people', 'opt', 'Only with a complete reconciled invitation frame. Used for response coverage only.'],
      ['invitation_frame_complete', 'Invitation frame complete', 'bool', '', 'opt', 'Tick only if a reconciled complete eligible invitation frame exists for this exact question, population and wave.'],
    ];
    function calc(v) {
      const P = positive.reduce((s, [k]) => s + v[k], 0);
      const D = cats.reduce((s, [k]) => s + v[k], 0);
      const excl = exclusions.map(([k]) => v[k]);
      const exclKnown = excl.every(x => x != null);
      const exclTotal = exclKnown ? excl.reduce((s, x) => s + x, 0) : null;
      if (v.invitation_frame_complete && v.invited_eligible != null && exclKnown && D + exclTotal > v.invited_eligible) return fail('Valid responses plus exclusions exceed the invited eligible frame.');
      if (D === 0) return nc('No valid substantive responses (D = 0).');
      const rate = 100 * P / D;
      const dist = cats.map(([k, l]) => `${l}: ${int(v[k])} (${pct(100 * v[k] / D)})`).join('; ');
      const extra = [['Full distribution', dist],
        ['Excluded (outside D)', exclusions.map(([k, l]) => `${l}: ${v[k] == null ? 'not available' : int(v[k])}`).join('; ')]];
      if (v.invitation_frame_complete && v.invited_eligible > 0 && exclKnown) extra.push(['Valid response coverage', `${pct(100 * D / v.invited_eligible)} (D ${int(D)} ÷ invited ${int(v.invited_eligible)})`]);
      else extra.push(['Valid response coverage', 'Unavailable: needs a complete invitation frame and all exclusion counts (not 0%).']);
      return ok(rate, pct(rate), `${label} = 100 × (${positive.map(([, l]) => l).join(' + ')}) ÷ all ${cats.length} substantive categories = 100 × ${int(P)} ÷ ${int(D)} = ${pct(rate)}`, extra);
    }
    return { inputs, calc, unit: '%', changeUnit: 'pp' };
  }

  // Profile of a self-declared group within a complete roster (S07 participants, C07 leaders).
  function profile(who) {
    return {
      calc(v) {
        if (v.G + v.U > v.L) return fail('G + U cannot exceed L.');
        if (v.L === 0) return nc(`No eligible ${who} (L = 0).`);
        const share = 100 * v.G / v.L, completeness = 100 * (v.L - v.U) / v.L;
        const extra = [['Group-status completeness', `${pct(completeness)} = 100 × (L ${int(v.L)} − U ${int(v.U)}) ÷ L`], ['Counts', `G ${int(v.G)}, U ${int(v.U)}, L ${int(v.L)}`]];
        if (v.U === v.L) return { ...ok(share, 'Unknown', `Every ${who.replace(/s$/, '')}'s group status is unknown (U = L), so the true share is unknown. Completeness 0%; public share withheld.`, extra), withhold: true };
        return ok(share, pct(share), `Recorded share = 100 × G ÷ L = 100 × ${int(v.G)} ÷ ${int(v.L)} = ${pct(share)}. Unknowns stay in L.`, extra);
      },
      unit: '%', changeUnit: 'pp',
    };
  }

  // Frozen cohort and verified returners (P3-01 workforce, S05 players).
  function cohort(who, zeroStatus) {
    return {
      inputs: [['B', `Baseline active ${who} (B)`, 'int', 'people', 'req', `Frozen unique actual-active baseline cohort. No registrations or intentions.`],
        ['R', 'Of those, active in the follow-up cycle (R)', 'int', 'people', 'req', 'Verified follow-up activity among members of the original B only; new entrants excluded.'],
        ['checks', 'Cohort checks passed (complete capture at both cycles, matching resolved)', 'bool', '', 'req', 'Must be ticked. Unknown follow-up or unresolved matches are not treated as leavers.']],
      calc(v) {
        if (v.R > v.B) return fail('R cannot exceed B (new entrants must be excluded).');
        if (v.checks !== true) return dcr('Pending: source checks (complete capture at both cycles and resolved matching).');
        if (v.B === 0) return zeroStatus('Zero baseline cohort (B = 0).');
        const r = 100 * v.R / v.B;
        return ok(r, pct(r), `Return rate = 100 × R ÷ B = 100 × ${int(v.R)} ÷ ${int(v.B)} = ${pct(r)}`);
      },
      unit: '%', changeUnit: 'pp', waves: ['Cohort pair 1', 'Cohort pair 2'],
    };
  }

  // Cost ÷ unique people (P3-02, P4-01).
  function unitCost(peopleLabel, zeroReason) {
    return {
      inputs: [['C', 'Agreed net cash cost', 'dec', 'AUD', 'req', 'Actual net cash delivery cost for this cohort/cycle, refunds reconciled.'],
        ['N', peopleLabel, 'int', 'people', 'req', 'Unique eligible people; repeat visits or duplicate awards count once.']],
      calc(v) {
        if (v.N === 0) return nc(`${zeroReason} Cost ${aud(v.C)} shown separately.`);
        const r = v.C / v.N;
        return ok(r, aud2(r), `Cost per person = C ÷ N = ${aud(v.C)} ÷ ${int(v.N)} = ${aud2(r)}`);
      },
      unit: 'AUD per person', changeUnit: 'unitAUD',
    };
  }

  // ---------- the 27 KPIs ----------
  // state: active | conditional (research, not activated) | inactive | qualitative
  // readiness: YELLOW / RED. evidence: Verified | Partial | No Direct Source. waves: labels of the submissions.
  const K = [];
  const add = k => K.push({ waves: ['Baseline', 'Follow-up'], state: 'active', ...k });

  // Economic
  add({ id: 'P1-01', dim: 'Economic', pillar: 'P1', name: 'Facility Utilisation Rate', readiness: 'YELLOW', cls: 'Adapted', tier: 'Existing core economic KPI',
    definition: 'Share of approved bookable field capacity actually used in the reporting season, in standard-field-equivalent hours (a half-field for one hour = 0.5). Cancelled bookings are not use; concurrent uses count only up to field capacity.',
    formula: '100 × actual used standard-field-equivalent hours ÷ approved bookable standard-field-equivalent hours (summed hours, never an average of site percentages).',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Economic_Impact_Framework_Updated_20261026.xlsx, 'Final 9 KPI Framework'!C11; supporting: Multi-Sport Community Facility Fund Guidelines 2022/23, Criterion 1 (p.12)",
    limitations: 'Capacity depends on lease rights, weather, season and ground condition. Higher use can increase wear. Booking volume is not actual use. Equipment-only projects are not covered.',
    inputs: [['U', 'Actual used field-hours (U)', 'dec', 'field-hours', 'req', 'Summed actual standard-field-equivalent use, field weighting applied once.'],
      ['H', 'Approved bookable field-hours (H)', 'dec', 'field-hours', 'req', 'Summed approved capacity in the same boundary and season.']],
    calc(v) {
      if (v.U > v.H) return fail('Used hours exceed bookable capacity (U ≤ H).');
      if (v.H === 0) return na('Zero bookable hours.');
      const r = 100 * v.U / v.H;
      return ok(r, pct(r), `100 × U ÷ H = 100 × ${v.U} ÷ ${v.H} = ${pct(r)}`);
    }, unit: '%', changeUnit: 'pp' });
  add({ id: 'P1-02', dim: 'Economic', pillar: 'P1', name: 'Realised Cash Co-investment', readiness: 'YELLOW', cls: 'Proposed', tier: 'Existing core economic KPI',
    definition: 'External matching cash actually received or paid by a co-funder toward approved facility/equipment scope in the period, net of returns. Excludes the core Legacy grant, debt, undisbursed commitments and in-kind value.',
    formula: 'Σ verified in-scope co-investment cash contributions recognised in the period − related returns/reversals.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Economic_Impact_Framework_Updated_20261026.xlsx, 'Final 9 KPI Framework'!C33",
    limitations: 'Narrower than co-investment "secured" in the plan. Transfers are not automatically additional investment or net benefit.',
    inputs: [['C', 'Eligible cash contributions recognised (C)', 'dec', 'AUD', 'req', 'Verified realised eligible cash, counted once. No budgets, commitments or in-kind.'],
      ['R', 'Related returns / reversals (R)', 'dec', 'AUD', 'req', 'Linked returns of eligible recognised cash. Enter 0 only if records confirm none.']],
    calc: v => ok(v.C - v.R, aud(v.C - v.R), `C − R = ${aud(v.C)} − ${aud(v.R)} = ${aud(v.C - v.R)} (a negative net flow can be valid)`),
    unit: 'AUD', changeUnit: 'AUD' });
  add({ id: 'P1-03', dim: 'Economic', pillar: 'P1', name: 'Facility Operating Cost Recovery Rate', readiness: 'YELLOW', cls: 'Adapted', tier: 'Existing core economic KPI',
    definition: 'Earned facility operating income (net of refunds) as a share of recurring cash operating expenditure, within the agreed facility boundary. Grants, loans, donations and subsidies are excluded from income.',
    formula: '100 × earned facility operating income net of refunds ÷ agreed recurring cash operating expenditure.',
    origin: 'Adapted Methodology', evidence: 'Verified', source: 'Sport England, Moving Communities in Focus (April 2022), pp.12–13 cost recovery',
    limitations: 'Higher fees can improve the ratio while reducing access; subsidised operation may be intentional. Omits capital renewal and reserves. No 100% target is implied; above 100% is valid.',
    inputs: [['I', 'Earned operating income net of refunds (I)', 'sdec', 'AUD', 'req', 'Eligible boundary only; no grants, capital or unrelated club income.'],
      ['E', 'Recurring cash operating expenditure (E)', 'dec', 'AUD', 'req', 'Same period and boundary as income.']],
    calc(v) {
      if (v.E === 0) return nc(`Zero operating costs; income ${aud(v.I)} shown separately.`);
      const r = 100 * v.I / v.E;
      return ok(r, pct(r), `100 × I ÷ E = 100 × ${aud(v.I)} ÷ ${aud(v.E)} = ${pct(r)}`);
    }, unit: '%', changeUnit: 'pp' });
  add({ id: 'P3-01', dim: 'Economic', pillar: 'P3', name: 'Active Workforce Cohort Retention Rate', readiness: 'YELLOW', cls: 'Proposed', tier: 'Existing core economic KPI',
    definition: 'Share of an original active workforce cohort (at least one verified delivered assignment) that delivers an approved role in the next comparable season. Registration or qualification alone is not activity.',
    formula: '100 × unique baseline-cohort people active in the follow-up season ÷ unique active people in the original baseline cohort.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Economic_Impact_Framework_Updated_20261026.xlsx, 'Final 9 KPI Framework'!C77",
    limitations: 'Intention differs from actual service; relocation and retirement affect rates. No replacement-cost benefit is claimed.',
    ...cohort('workforce people', na) });
  add({ id: 'P3-02', dim: 'Economic', pillar: 'P3', name: 'Cash Training Cost per Newly Qualified Person', readiness: 'YELLOW', cls: 'Adapted', tier: 'Existing core economic KPI',
    definition: 'Actual cash training-delivery cost for a closed cohort per unique person newly achieving the agreed rugby credential by a stated cutoff. Costs of unsuccessful learners stay in; renewals and existing holders are excluded.',
    formula: 'Agreed cash training-delivery expenditure for the cohort ÷ unique cohort members newly achieving the approved credential by the cutoff.',
    origin: 'Adapted Methodology', evidence: 'Verified', source: 'NSW Treasury TPG22-22, p.59 cost-efficiency analysis, p.60 Table 8',
    limitations: 'Course size, delivery mode, credential standard and delayed awards affect results. Qualification is an output, not proof of better performance.',
    ...unitCost('Newly qualified people (N)', 'Zero new qualifications.') });
  add({ id: 'P3-03', dim: 'Economic', pillar: 'P3', name: 'Unpaid Volunteer Delivery Hours', readiness: 'YELLOW', cls: 'Adapted', tier: 'Existing core economic KPI', partialAllowed: true,
    definition: 'Actual unpaid person-hours contributed to agreed program, coaching, officiating and support assignments in the season. Excludes player participation and paid roles. No wage valuation.',
    formula: 'Σ verified non-overlapping unpaid person-hours in approved assignments (two people × one hour = two person-hours; one person\'s simultaneous roles count once).',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Economic_Impact_Framework_Updated_20261026.xlsx, 'Final 9 KPI Framework'!C121; supporting: ASC Sport Volunteering Dashboard",
    limitations: 'Logging and role mix change totals. More hours may mean more delivery or excessive burden. No wage multiplier or saved-payroll claim.',
    inputs: [['h', 'Verified unpaid person-hours', 'dec', 'person-hours', 'req', 'Non-overlapping person-hours, not role-hours.'],
      ['coverage', 'Log coverage (required for Partial capture)', 'text', '', 'partial', 'E.g. "logs from 14 of 20 clubs". Distinguishes a partial log from a complete census.']],
    calc(v, meta) {
      const partial = meta.capture_status === 'Partial';
      return ok(v.h, partial ? `${hours(v.h)} (logged subtotal)` : hours(v.h), partial ? `Logged subtotal of verified unpaid person-hours: ${hours(v.h)}. Partial capture (${v.coverage}); not a full census.` : `Σ verified unpaid person-hours = ${hours(v.h)}`);
    }, unit: 'person-hours', changeUnit: 'hours' });
  add({ id: 'P4-01', dim: 'Economic', pillar: 'P4', name: 'Inclusion Delivery Cost per Unique Participant Served', readiness: 'YELLOW', cls: 'Adapted', tier: 'Existing core economic KPI',
    definition: 'Cash cost of one defined inclusion service/cycle per de-duplicated eligible person attending at least one delivered session. Keep services separate; recurring and setup costs reported separately.',
    formula: 'Agreed cash inclusion-delivery expenditure for the cycle ÷ unique eligible participants with at least one verified attendance.',
    origin: 'Adapted Methodology', evidence: 'Verified', source: 'NSW Treasury TPG22-22, p.59 costs per unit of output, p.60 Table 8',
    limitations: 'Serving people with greater barriers can legitimately cost more. Does not show who would otherwise not play.',
    ...unitCost('Unique participants served (N)', 'Zero participants.') });
  add({ id: 'P4-02', dim: 'Economic', pillar: 'P4', name: 'Comparable Participant Out-of-Pocket Cost Change', readiness: 'YELLOW', cls: 'Adapted', tier: 'Existing core economic KPI', waves: ['Matched baseline → follow-up'],
    definition: 'Average follow-up minus baseline net cash cost for the same matched people over an approved basket of fees, equipment, travel and compulsory charges, after realised item-linked support (each deduction once, capped at the item).',
    formula: 'Mean change = Σ over matched set M (follow-up OOP − baseline OOP) ÷ n, with n = |M| > 0. Item-level support rules are applied by the source custodian before the sums are entered.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Economic_Impact_Framework_Updated_20261026.xlsx, 'Final 9 KPI Framework'!C165",
    limitations: 'Recall, attrition, price inflation and altered travel/intensity affect costs. Household relief is not net economic benefit.',
    inputs: [['n', 'Matched people (n = |M|)', 'int', 'people', 'req', 'Unique people with two complete, comparable baskets.'],
      ['Bsum', 'Baseline net basket cost, sum over M (Bsum)', 'dec', 'AUD', 'req', 'After item support rules.'],
      ['Fsum', 'Follow-up net basket cost, sum over the same M (Fsum)', 'dec', 'AUD', 'req', 'Exactly the same people as the baseline.'],
      ['checks', 'Pair, basket and support checks passed', 'bool', '', 'req', 'Same people and basket codes at both waves; support allocated once, refunds netted, no double deduction, item caps enforced.'],
      ['nF', 'Observed follow-up people outside M (optional)', 'int', 'people', 'opt', 'Separate unmatched sample, for a follow-up level only.'],
      ['Fobs', 'Their follow-up basket cost sum (optional)', 'dec', 'AUD', 'opt', 'Needed together with the count above.']],
    calc(v) {
      if (v.checks !== true) return dcr('Pending: pair/basket/support checks.');
      const level = v.nF > 0 && v.Fobs != null ? [['Observed follow-up level (unmatched sample)', `${aud2(v.Fobs / v.nF)} per person (${int(v.nF)} people); not a change`]] : [];
      if (v.n === 0) {
        if (v.Bsum > 0 || v.Fsum > 0) return fail('n = 0 cannot carry positive matched costs.');
        return { ...nc('No matched comparable baseline: change not calculable.'), extra: level };
      }
      const c = (v.Fsum - v.Bsum) / v.n;
      return ok(c, `${signed(c, aud2)} per person${c < 0 ? ' (reduction)' : ''}`, `(Fsum − Bsum) ÷ n = (${aud(v.Fsum)} − ${aud(v.Bsum)}) ÷ ${int(v.n)} = ${signed(c, aud2)}`,
        [['Period means (same M)', `baseline ${aud2(v.Bsum / v.n)}, follow-up ${aud2(v.Fsum / v.n)}`], ...level]);
    }, unit: 'AUD per person' });
  add({ id: 'P4-03', dim: 'Economic', pillar: 'P4', name: 'Cash Participation Support Delivered', readiness: 'YELLOW', cls: 'Proposed', tier: 'Existing core economic KPI',
    definition: 'Actual beneficiary-linked bursary payments, reimbursements and provider payments for named eligible participants in one service/cycle, net of reversals. Fee waivers and free places are counted separately, never valued.',
    formula: 'Σ verified eligible beneficiary-linked cash support payments in the period − related returns/reversals.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Economic_Impact_Framework_Updated_20261026.xlsx, 'Final 9 KPI Framework'!C187",
    limitations: 'Assistance is a transfer, not cost relief or net benefit. Never add it to P4-01 or P4-02 as a benefit total.',
    inputs: [['P', 'Eligible beneficiary-linked support paid (P)', 'dec', 'AUD', 'req', 'Actual cash linked to eligible beneficiaries; no budgets or unredeemed offers.'],
      ['R', 'Related returns / reversals (R)', 'dec', 'AUD', 'req', 'Linked reversals only.']],
    calc: v => ok(v.P - v.R, aud(v.P - v.R), `P − R = ${aud(v.P)} − ${aud(v.R)} = ${aud(v.P - v.R)}`),
    unit: 'AUD', changeUnit: 'AUD' });

  // Social
  add({ id: 'S01', dim: 'Social', pillar: 'P3 primary; P1/P4 delivery', name: 'Newly recorded programme participant starts', readiness: 'YELLOW', cls: 'Proposed', tier: 'Delivery monitoring (not a standalone outcome KPI)',
    definition: 'Unique people with an actual eligible programme start in the cycle and no recorded in-scope participation in the agreed prior cycle. "Newly recorded", not first-ever rugby participants.',
    formula: 'N = count of distinct eligible person IDs meeting the actual-start and prior-cycle-history rules; unknown prior history reported separately.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Social_Impact_KPI_Revised_Framework_Updated_20261026.xlsx, 'Formula Specifications'!D9",
    limitations: 'Delivery output / access proxy, not a demonstrated social outcome.',
    inputs: [['N', 'New actual starts with verified prior-cycle history', 'int', 'people', 'req', 'Unique people; repeat visits do not count.'],
      ['U', 'Starters with unknown prior history', 'int', 'people', 'opt', 'Required for complete disclosure. Never relabelled as new.']],
    calc: v => ok(v.N, `${int(v.N)} people`, `N = ${int(v.N)} distinct eligible new starts`, [['Unknown prior history (reported separately)', v.U == null ? 'not reported' : `${int(v.U)} people`]]),
    unit: 'people', changeUnit: 'count' });
  add({ id: 'S02', dim: 'Social', pillar: 'P1/P3/P4, one initiative at a time', name: 'Reported participation-barrier improvement (by barrier)', readiness: 'YELLOW', cls: 'Proposed', tier: 'Tier 1 — Core (pilot after item and follow-up approval)', waves: ['Matched baseline → follow-up'],
    definition: 'For one agreed barrier, the share of the fixed baseline-barrier cohort with a valid same-person follow-up whose severity is lower than at baseline. Reported improvement among matched respondents, not programme-attributed removal.',
    formula: 'Improvement = 100 × I ÷ M; unchanged = 100 × H ÷ M; worsened = 100 × W ÷ M (M > 0). Matched follow-up coverage = 100 × M ÷ B (B > 0). I + H + W = M ≤ B. Never sum or average barriers.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Social_Impact_KPI_Revised_Framework_Updated_20261026.xlsx, 'Formula Specifications'!D39",
    question: 'During [reference period], how much did [barrier] prevent you taking part in [activity] as often as you wanted? None / A little / A lot / Completely (ordered 0–3 for comparison only). Separate: Did not want to participate / Unsure / Prefer not to answer; skipped. Candidate barriers: fees/equipment, transport, timing, physical access/adjustments, information.',
    limitations: 'Ordinal order only; no severity average. One barrier per entry.',
    inputs: [['barrier', 'Barrier (one per entry)', 'text', '', 'req', 'Pre-agreed barrier key and item version, the same at both waves.'],
      ['B', 'Baseline-barrier cohort (B, severity > 0)', 'int', 'people', 'req', 'Frozen before follow-up.'],
      ['M', 'Matched valid pairs (M)', 'int', 'people', 'req', 'Same person, same barrier, valid answers at both waves.'],
      ['I', 'Improved (I)', 'int', 'people', 'req', 'Follow-up severity lower than baseline.'],
      ['H', 'Unchanged (H)', 'int', 'people', 'req', 'Same severity.'],
      ['W', 'Worsened (W)', 'int', 'people', 'req', 'Higher severity.']],
    calc(v) {
      if (v.I + v.H + v.W !== v.M) return fail('I + H + W must equal M.');
      if (v.M > v.B) return fail('M cannot exceed B.');
      const cov = v.B > 0 ? `${pct(100 * v.M / v.B)} (M ${int(v.M)} ÷ B ${int(v.B)})` : 'Not calculable (B = 0)';
      if (v.M === 0) return { ...nc('No matched pairs (M = 0): improvement not calculable.'), extra: [['Matched follow-up coverage', cov]] };
      const r = 100 * v.I / v.M;
      return ok(r, pct(r), `Barrier "${v.barrier}": improvement = 100 × I ÷ M = 100 × ${int(v.I)} ÷ ${int(v.M)} = ${pct(r)}`,
        [['Unchanged / worsened', `${pct(100 * v.H / v.M)} / ${pct(100 * v.W / v.M)}`], ['Matched follow-up coverage', cov]]);
    }, unit: '%' });
  add({ id: 'S03', dim: 'Social', pillar: 'P3 primary; P1/P4 context', name: 'Rugby-linked social contact beyond organised activity', readiness: 'YELLOW', cls: 'Proposed', tier: 'Tier 1 — Core (developmental pilot item)',
    definition: 'Percentage of eligible experienced participants reporting voluntary social contact outside organised rugby with someone met through the club/programme, excluding household. Interpersonal connection evidence.',
    formula: 'Rugby-linked contact (%) = 100 × Yes ÷ (Yes + No). Unsure, refused and skipped are outside the denominator.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Social_Impact_KPI_Revised_Framework_Updated_20261026.xlsx, 'Formula Specifications'!D69",
    question: 'During [reference period], did you choose to socialise or keep in touch outside organised rugby with anyone you met through [club/programme], excluding people in your household? Yes / No / Unsure / Prefer not to answer; skipped separate. Viewing or following public social media alone does not qualify.',
    limitations: 'Not a validated social connectedness or loneliness instrument.',
    ...survey({ label: 'Contact', positive: [['yes', 'Yes']], other: [['no', 'No']], exclusions: [['unsure', 'Unsure'], ['pnta', 'Prefer not to answer'], ['missing', 'Skipped / missing']] }) });
  add({ id: 'S04', dim: 'Social', pillar: 'P1/P3/P4 context', name: 'Sense of belonging to the rugby club community', readiness: 'RED', cls: 'Adapted', tier: 'Tier 3 — Future / conditional', state: 'conditional',
    definition: 'Proportion of experienced respondents who feel very or fairly strongly that they belong to the named rugby club community. Local adaptation of a published neighbourhood-belonging item.',
    formula: 'Club-community belonging (%) = 100 × (Very strongly + Fairly strongly) ÷ all four substantive categories. No composite with S03 or C04.',
    origin: 'Adapted Methodology', evidence: 'Partial', source: 'Community Life Survey 2024/25 Online Questionnaire, p.13 SBeNeigh',
    question: 'How strongly do you feel you belong to the community at [rugby club]? Very strongly / Fairly strongly / Not very strongly / Not at all strongly. Separate: Unsure / Prefer not to answer; skipped.',
    limitations: 'Research only, not activated: test distinctness and meaning before routine use. Not psychometrically validated.',
    ...survey({ label: 'Belonging', positive: [['vs', 'Very strongly'], ['fs', 'Fairly strongly']], other: [['nvs', 'Not very strongly'], ['nas', 'Not at all strongly']], exclusions: [['unsure', 'Unsure'], ['pnta', 'Prefer not to answer'], ['missing', 'Skipped / missing']] }) });
  add({ id: 'S05', dim: 'Social', pillar: 'P3/P4 primary', name: 'Observed active-player cohort return rate', readiness: 'YELLOW', cls: 'Proposed', tier: 'Tier 2 — Supporting',
    definition: 'Percentage of a fixed baseline cohort of unique actual active players with verified actual play in the next comparable cycle. Registration, intention or a churn headline alone is not return.',
    formula: 'Observed cohort return (%) = 100 × R ÷ B, with R ⊆ B, complete capture at both cycles and resolved matching. New entrants excluded.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Social_Impact_KPI_Revised_Framework_Updated_20261026.xlsx, 'Formula Specifications'!D129",
    limitations: 'Behavioural continuity evidence, not wellbeing or programme causation. Dashboard churn (48.9%, 39.5%) cannot be inverted into this KPI.',
    ...cohort('players', nc) });
  add({ id: 'S06', dim: 'Social', pillar: 'P3 primary; P1/P4 context', name: 'High overall participant-experience satisfaction', readiness: 'YELLOW', cls: 'Adapted', tier: 'Tier 1 — Core',
    definition: 'Percentage of eligible participants selecting Very or Extremely satisfied with their overall programme/club experience. Not NPS and not a composite of safety or inclusion.',
    formula: 'High satisfaction (%) = 100 × (Very satisfied + Extremely satisfied) ÷ all five substantive categories.',
    origin: 'Adapted Methodology', evidence: 'Partial', source: 'Sport NZ, Voice of Participant Summary 2023–24, p.1',
    question: 'Overall, how satisfied are you with your experience of [club/programme] during [reference period]? Not at all / Slightly / Moderately / Very / Extremely satisfied. Separate: Not applicable / Unsure / Prefer not to answer; skipped. Check the current Rugby Australia questionnaire first.',
    limitations: 'Local wording proposed, not validated. Keep child, proxy and workforce responses separate.',
    ...survey({ label: 'High satisfaction', positive: [['very', 'Very satisfied'], ['extremely', 'Extremely satisfied']], other: [['notatall', 'Not at all satisfied'], ['slightly', 'Slightly satisfied'], ['moderately', 'Moderately satisfied']], exclusions: [['na', 'Not applicable'], ['unsure', 'Unsure'], ['pnta', 'Prefer not to answer'], ['missing', 'Skipped / missing']] }) });
  add({ id: 'S07', dim: 'Social', pillar: 'P4 primary; P1/P3 delivery', name: 'Recorded priority-group participation reach profile', readiness: 'YELLOW', cls: 'Proposed', tier: 'Tier 2 — Supporting',
    definition: 'Unique actual participants self-identifying with one approved priority group, with group-status completeness. Recorded representation among users, not uptake in the wider community.',
    formula: 'Recorded share = 100 × G ÷ L; completeness = 100 × (L − U) ÷ L. G + U ≤ L. Never add overlapping groups.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Social_Impact_KPI_Revised_Framework_Updated_20261026.xlsx, 'Formula Specifications'!D189; supporting: ASC Diversity Data Standards",
    limitations: 'Equity-of-delivery context, not demonstrated inclusion. Voluntary self-identification only; never inferred from names or appearance.',
    inputs: [['group', 'Priority group (one per entry)', 'text', '', 'req', 'E.g. First Nations, Pasifika, women and girls. One group at a time.'],
      ['L', 'All unique eligible participants (L)', 'int', 'people', 'req', 'Complete roster; unknowns stay in L.'],
      ['G', 'Self-declared group members (G)', 'int', 'people', 'req', 'Voluntary self-identification.'],
      ['U', 'Unknown / refused / uncollected status (U)', 'int', 'people', 'req', 'Never treated as non-members.']],
    ...profile('participants') });
  add({ id: 'S08', dim: 'Social', pillar: 'P3/P1 context', name: 'Non-playing community involvement and accounts', readiness: 'RED', cls: 'Adapted', tier: 'Not shortlisted (contextual)', state: 'conditional',
    definition: 'Count of unique people with actual in-scope non-playing involvement, separate from optional governed qualitative accounts. The count alone is not a social outcome.',
    formula: 'Contextual count = distinct eligible contributors. Qualitative accounts have no numerator, denominator or score.',
    origin: 'Adapted Methodology', evidence: 'Verified', source: 'AusPlay Online Questionnaire v2.0 (2024), p.15 INVOLVED / ROLE1–3',
    limitations: 'Research only, not activated. No story-percentage or forced score; approved summaries only.',
    inputs: [['N', 'Unique non-playing contributors', 'int', 'people', 'req', 'Count once across roles.'],
      ['summary', 'Approved de-identified summary (optional)', 'text', '', 'opt', 'Community/participant-approved themes including adverse and unchanged evidence.']],
    calc: v => ok(v.N, `${int(v.N)} people`, `Contextual count: ${int(v.N)} distinct contributors. Not a social outcome on its own.`, v.summary ? [['Approved summary', v.summary]] : []),
    unit: 'people', changeUnit: 'count' });

  // Cultural
  const inactive = (id, pillar, name, definition, why) => add({ id, dim: 'Cultural', pillar, name, readiness: 'RED', cls: 'Proposed', state: 'inactive', tier: 'Not selected', definition,
    formula: 'No operational calculation prescribed in the latest refinement.', origin: 'Project-Defined Formula', evidence: 'No Direct Source',
    source: 'NSW_Rugby_Cultural_Impact_KPI_Revised_Framework_Updated_20261026.xlsx', limitations: why, inputs: [], waves: [] });
  inactive('C01', 'P2/P5 context', 'Awareness of locally inclusive rugby opportunities', 'Adults in one catchment who can identify a current, verified local inclusion offer.', 'Inactive / excluded: ID and historical context only. No input, baseline zero, score or result is authorised.');
  add({ id: 'C02', dim: 'Cultural', pillar: 'P1 primary; P4 context', name: 'Perceived welcome at community rugby', readiness: 'RED', cls: 'Adapted', tier: 'Tier 3 — Conditional', state: 'conditional',
    definition: 'Adult residents in an agreed catchment reporting that they expect to be welcomed and valued at a local rugby club. Expected welcome is not experienced cultural safety.',
    formula: 'Expected-welcome rate = 100 × (Definitely true + Probably true) ÷ all four substantive categories. Unweighted sample description; no national weights.',
    origin: 'Adapted Methodology', evidence: 'Verified', source: 'ASC Community Perceptions Monitor 2024–25 Annual Report, pp.4, 24',
    question: 'I would be welcomed and valued at a community rugby club in my area. Definitely true / Probably true / Probably false / Definitely false. Separate: Unsure / Prefer not to answer.',
    limitations: 'Research only, not activated. Media and reputation affect answers; not statewide without a valid design.',
    ...survey({ label: 'Expected welcome', positive: [['dt', 'Definitely true'], ['pt', 'Probably true']], other: [['pf', 'Probably false'], ['df', 'Definitely false']], exclusions: [['unsure', 'Unsure'], ['pnta', 'Prefer not to answer'], ['missing', 'Skipped / missing']] }) });
  add({ id: 'C03', dim: 'Cultural', pillar: 'P4 primary; P3 context', name: 'Participant-reported cultural respect', readiness: 'YELLOW', cls: 'Proposed', tier: 'Tier 1 — Core',
    definition: 'Unique experienced players or workforce members reporting that their cultural background is respected. Adult self-report first; child and proxy evidence need a separate protocol.',
    formula: 'Favourable cultural-respect rate = 100 × (Agree + Strongly agree) ÷ all five substantive categories; full distribution reported.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Cultural_Impact_KPI_Revised_Framework_Updated_20261026.xlsx, 'Formula Specifications'!D69",
    question: 'My cultural background is respected at [club/programme]. Strongly disagree / Disagree / Neither agree nor disagree / Agree / Strongly agree. Separate: Not applicable / Unsure / Prefer not to answer; blank recorded as skipped.',
    limitations: 'A favourable response does not certify cultural safety. Courtesy and selection bias; not validated.',
    ...survey({ label: 'Cultural respect', exclusionsRequired: true, positive: [['agree', 'Agree'], ['sagree', 'Strongly agree']], other: [['sdisagree', 'Strongly disagree'], ['disagree', 'Disagree'], ['neutral', 'Neither agree nor disagree']], exclusions: [['na', 'Not applicable'], ['unsure', 'Unsure'], ['pnta', 'Prefer not to answer'], ['missing', 'Skipped / missing']] }) });
  inactive('C04', 'P4 primary', 'Culturally anchored sense of belonging', 'Experienced participants responding to an identity-anchored belonging item.', 'Inactive / deferred: strong overlap with C03. No calculation authorised.');
  const PRACTICES = [['a', 'P05a community input acted on'], ['b', 'P05b culturally respectful communication applied'], ['c', 'P05c inclusive leadership access and voice']];
  add({ id: 'C05', dim: 'Cultural', pillar: 'P4 primary; P3 context', name: 'Verified culturally inclusive club practices', readiness: 'YELLOW', cls: 'Proposed', tier: 'Tier 1 — Core practice indicator',
    definition: 'Evidence of each agreed culturally inclusive practice at applicable pilot clubs. Each practice reported separately with assessment coverage; no all-practice pass or cultural score.',
    formula: 'For each practice p: verification = 100 × V ÷ A; assessment coverage = 100 × A ÷ D. V ≤ A ≤ D and D + approved N/A + unresolved = expected due. Never average practices.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Cultural_Impact_KPI_Revised_Framework_Updated_20261026.xlsx, 'Formula Specifications'!D129; supporting: ASC Sport Governance Standards",
    limitations: 'Assessed subset may be selective; evidence does not prove lived culture. Not-assessed clubs are not failures.',
    inputs: PRACTICES.flatMap(([p, l]) => [
      [`${p}V`, `${l}: verified clubs (V)`, 'int', 'clubs', 'group:' + p, 'Applicable assessed clubs verified against the rubric.'],
      [`${p}A`, `${l}: assessed applicable clubs (A)`, 'int', 'clubs', 'group:' + p, 'Completed Verified / Not verified assessments.'],
      [`${p}D`, `${l}: applicable due clubs (D)`, 'int', 'clubs', 'group:' + p, 'All applicable due clubs, including not assessed.'],
      [`${p}NA`, `${l}: approved not-applicable clubs`, 'int', 'clubs', 'group:' + p, 'Approved N/A clubs in the original due universe.'],
      [`${p}UNR`, `${l}: unresolved applicability`, 'int', 'clubs', 'group:' + p, 'Applicability not yet decided.'],
      [`${p}EXP`, `${l}: expected due clubs`, 'int', 'clubs', 'group:' + p, 'Complete due-club universe before exclusions.'],
    ]),
    calc(v) {
      const parts = [];
      let any = false;
      for (const [p, l] of PRACTICES) {
        const keys = ['V', 'A', 'D', 'NA', 'UNR', 'EXP'].map(s => p + s);
        const given = keys.filter(k => v[k] != null).length;
        if (!given) { parts.push([l, 'Data Collection Required']); continue; }
        if (given < keys.length) return dcr(`${l}: all six counts are needed.`);
        const [V, A, D, NAc, UNR, EXP] = keys.map(k => v[k]);
        if (!(V <= A && A <= D)) return fail(`${l}: requires V ≤ A ≤ D.`);
        if (D + NAc + UNR !== EXP) return fail(`${l}: D + approved N/A + unresolved must equal expected due.`);
        any = true;
        let txt;
        if (D === 0) txt = UNR > 0 ? 'Applicability unresolved; rates unavailable' : 'Not applicable (no applicable due clubs)';
        else if (A === 0) txt = 'Verification not calculable; assessment coverage 0%';
        else txt = `verified ${pct(100 * V / A)} (V ${V} ÷ A ${A}); coverage ${pct(100 * A / D)} (A ${A} ÷ D ${D}); not assessed ${D - A}; N/A ${NAc}; unresolved ${UNR}`;
        parts.push([l, txt]);
      }
      if (!any) return dcr('No practice counts entered.');
      return ok(null, 'Per practice (no score)', 'Each practice is reported separately; rates are never averaged.', parts);
    }, unit: 'per practice' });
  add({ id: 'C06', dim: 'Cultural', pillar: 'P3 primary; P4 context', name: 'Officials reporting verbal abuse in community rugby', readiness: 'YELLOW', cls: 'Adapted', tier: 'Tier 2 — Supporting conduct indicator',
    definition: 'Unique officials with at least one actual appointment in the season reporting verbal abuse directed at them while officiating. Receiving abuse, not witnessing it. Lower is better.',
    formula: 'Received-abuse rate (%) = 100 × Yes ÷ (Yes + No). Never divide abuse cases, accredited totals or games.',
    origin: 'Adapted Methodology', evidence: 'Partial', source: 'ASC Community Perceptions Monitor 2024–25, pp.35–36 Poor Behaviour',
    question: 'During [season] at [club/competition], have you experienced verbal abuse directed at you while officiating? Yes / No / Unsure / Prefer not to answer.',
    limitations: 'Lower reports can mean suppressed reporting. Generic abuse does not measure cultural discrimination specifically. The plan\'s abuse-case count (73) is a different unit.',
    ...survey({ label: 'Received-abuse rate', positive: [['yes', 'Yes']], other: [['no', 'No']], exclusions: [['unsure', 'Unsure'], ['pnta', 'Prefer not to answer'], ['missing', 'Skipped / missing']] }) });
  add({ id: 'C07', dim: 'Cultural', pillar: 'P4 leadership; P3 senior workforce', name: 'Priority-community leadership representation', readiness: 'YELLOW', cls: 'Proposed', tier: 'Tier 2 — Supporting structural indicator',
    definition: 'Unique people holding a formally appointed in-scope leadership position at a fixed census date, by self-declared priority group and leadership stratum. Composition is not cultural influence.',
    formula: 'Recorded representation = 100 × G ÷ L; identity completeness = 100 × (L − U) ÷ L, for one group and stratum at a fixed census.',
    origin: 'Project-Defined Formula', evidence: 'No Direct Source', source: "NSW_Rugby_Cultural_Impact_KPI_Revised_Framework_Updated_20261026.xlsx, 'Formula Specifications'!D189; supporting: ASC Diversity Data Standards",
    limitations: 'Visibility is not influence; rises may reflect better collection. Disclosure review required.',
    inputs: [['group', 'Priority group', 'text', '', 'req', 'One group at a time.'], ['stratum', 'Leadership stratum', 'text', '', 'req', 'E.g. committee leadership or senior workforce.'],
      ['census', 'Census date', 'date', '', 'req', 'Fixed census date for this stratum.'],
      ['L', 'All unique eligible current leaders (L)', 'int', 'people', 'req', 'Unique people, not roles.'],
      ['G', 'Self-declared group members (G)', 'int', 'people', 'req', 'Voluntary self-identification only.'],
      ['U', 'Unknown / refused / uncollected (U)', 'int', 'people', 'req', 'Stay in L.'],
      ['roster', 'Roster complete', 'bool', '', 'req', 'Must be ticked.'], ['ready', 'Records ready', 'bool', '', 'req', 'Must be ticked.']],
    calc(v) {
      if (v.roster !== true || v.ready !== true) return dcr('Pending: roster complete and records ready must both be confirmed.');
      const r = profile('leaders').calc(v);
      return r.ok ? { ...r, workings: `${v.group}, ${v.stratum}, census ${v.census}. ${r.workings}` } : r;
    }, unit: '%', changeUnit: 'pp' });
  add({ id: 'C08', dim: 'Cultural', pillar: 'P4 primary', name: 'Community-defined accounts of cultural recognition and voice', readiness: 'RED', cls: 'Adapted', tier: 'Tier 3 — Conditional qualitative measure', state: 'qualitative', waves: ['Account'],
    definition: 'Separately governed First Nations and Pasifika community accounts of cultural recognition, respect and voice, with meanings and authority negotiated before collection.',
    formula: 'No mathematical formula. Agree questions and governance; collect consented accounts; analyse positive, negative, unchanged and divergent evidence; community review; approved public summary.',
    origin: 'Adapted Methodology', evidence: 'Verified', source: 'AIATSIS Code of Ethics for Aboriginal and Torres Strait Islander Research (2020), Principles 2–3, responsibility 4.3',
    limitations: 'Purposive small accounts are not prevalence or causal proof. Do not generalise one community agreement to all groups.',
    inputs: [['summary', 'Community-approved de-identified summary', 'text', '', 'req', 'Themes with context, positive/negative/unchanged/divergent evidence and action response. No identifiable narratives.']],
    calc: v => ({ status: STATUS.QUALITATIVE, display: 'Approved summary recorded', workings: v.summary, extra: [] }) });
  inactive('C09', 'P4', 'Cultural-discrimination concern reporting and response', 'Recorded culturally discriminatory concerns and their response pathway.', 'Inactive / excluded from the public cultural framework. No calculation authorised.');
  inactive('C10', 'P3 enabling P4', 'Demonstrated application of culturally inclusive practice by workforce', 'Trained personnel showing an agreed culture-specific practice at a follow-up session.', 'Inactive / deferred. No calculation authorised.');

  // ---------- baseline requirements ("Baseline Requirements" sheet) ----------
  // No verified actual baseline was found for any KPI; a first observation does not establish pre-program impact.
  const HIST = 'Historical baseline if compatible; otherwise first observed baseline';
  const BASELINE = {
    'P1-01': [HIST, 'Prior comparable season actual-used and approved-bookable field-hours; otherwise the first complete prospective season.'],
    'P1-02': [HIST, 'First fully reconciled contribution cycle, or comparable prior project stage. Zero only with complete verified no-payment records.'],
    'P1-03': [HIST, 'Prior comparable season earned facility receipts net of refunds and recurring cash costs; otherwise the first complete actual accounts.'],
    'P3-01': ['Actual cohort and completed follow-up required', 'A fixed actual-active workforce baseline plus a complete actual follow-up gives the first retention result. Compare only two completed cohort pairs.'],
    'P3-02': [HIST, 'First complete closed cohort: actual cash costs and unique new approved credentials by the cutoff.'],
    'P3-03': [HIST, 'First verified season of actual unpaid shift logs with defined role, age and pay boundary and logging coverage. A rounded "5000+" claim is not a baseline.'],
    'P4-01': [HIST, 'First completed service/cycle actual cash costs and de-duplicated eligible attendees.'],
    'P4-02': ['Matched pre/follow-up observations required', 'Actual completed baseline-period costs for each matched person, plus exact basket and support status, then an equivalent follow-up.'],
    'P4-03': [HIST, 'First fully reconciled beneficiary-linked cash-support cycle. Zero requires complete no-support records.'],
    'S01': [HIST, 'First complete cycle with comparable prior history. If history is absent, report starters with newness unknown; do not assume all are new.'],
    'S02': ['Matched pre/follow-up observations required', 'Record barrier severity before the change and freeze the baseline-barrier cohort. This sets the cohort, not a 0% improvement.'],
    'S03': [HIST, 'First actual-experience wave. Pre-entry expectations are not an experience baseline; no assumed zero for new entrants.'],
    'S04': [HIST, 'First actual-experience wave with agreed meaning; not a neighbourhood score or C04.'],
    'S05': ['Actual cohort and completed follow-up required', 'Agree the activity criterion and cutoffs, then freeze the actual-active baseline set. A roster alone is not a return rate; dashboard churn cannot be inverted.'],
    'S06': [HIST, 'Compatible historical satisfaction item if verified; otherwise the first prospective wave. Do not import other countries\' rates.'],
    'S07': [HIST, 'First complete actual-participant profile with unknowns. Different identity categories are not comparable.'],
    'S08': [HIST, 'First complete contributor register; a consented starting account if qualitative evaluation is approved.'],
    'C01': ['Not applicable (inactive)', 'No active calculation.'],
    'C02': [HIST, 'New catchment expectation wave before the intervention, or the first prospective baseline. A national survey is not a local baseline.'],
    'C03': [HIST, 'Actual experience before the change among returning participants if available; otherwise the first actual wave.'],
    'C04': ['Not applicable (inactive)', 'No active calculation.'],
    'C05': [HIST, 'First agreed practice audit before support if possible; log existing implementation and incomplete assessment. Do not start at a presumed zero.'],
    'C06': [HIST, 'First actual received-abuse experience wave. The plan\'s abuse-case count is not a baseline for this respondent percentage.'],
    'C07': [HIST, 'First verified people-based leadership census with identity completeness.'],
    'C08': ['First observed baseline (qualitative)', 'Negotiated starting account before change; otherwise the first prospective account without retrospective attribution.'],
    'C09': ['Not applicable (inactive)', 'No active calculation.'],
    'C10': ['Not applicable (inactive)', 'No active calculation.'],
  };
  for (const k of K) k.baseline = BASELINE[k.id];

  // Missing-data and zero-denominator rules ("Missing Data / Zero Denominator Rules" column), in plain words.
  const INACTIVE_RULE = 'Inactive: never display a value, a baseline zero or a score.';
  const RULES = {
    'P1-01': 'H = 0: Not applicable. Missing use or capacity: Data Collection Required. Fractional hours are valid; negative hours are rejected; U must not exceed H.',
    'P1-02': 'Zero only with complete reconciled records. Missing reconciliation: Data Collection Required. Gross amounts are non-negative; a signed net period result is possible.',
    'P1-03': 'E = 0: Not calculable (show income separately). Missing ledger components: Data Collection Required. Above 100% is valid; no cap.',
    'P3-01': 'B = 0: Not applicable. Missing matching or capture: pending, never assumed exits. Whole-number counts; R ≤ B.',
    'P3-02': 'N = 0: Not calculable (show cost and zero awards separately). Missing costs or outcomes: Data Collection Required. No existing holders or renewals.',
    'P3-03': 'Missing shifts are not zero. Partial logs only as a labelled subtotal with stated coverage; never an extrapolated census.',
    'P4-01': 'N = 0: Not calculable (costs separately). Missing cash or attendance: Data Collection Required. N counts distinct people, not visits.',
    'P4-02': 'n = 0: change Not calculable (report the observed follow-up level only). Unknown item amounts or support status make a basket incomplete; never substitute zero. Item cost ≥ 0; the change may be negative.',
    'P4-03': 'Zero only with complete reconciled beneficiary records. Missing linkage: Data Collection Required. No value for fee waivers or free places.',
    'S01': 'Missing coverage or unresolved duplicates: pending, not zero. A complete register with no eligible records gives an observed zero. No denominator.',
    'S02': 'M = 0: rates Not calculable (coverage 0% if B > 0). B = 0: coverage Not calculable. Non-substantive answers are never severity 0; invalid counts are rejected.',
    'S03': 'D = 0: Not calculable. Yes = 0 with D > 0 is a valid zero. Unsure, refused and skipped are never counted as No.',
    'S04': 'D = 0: Not calculable. Non-substantive answers sit outside D and are disclosed.',
    'S05': 'B = 0: Not calculable. 0% is genuine only with complete capture and resolved matching. Unresolved identities are never counted as non-returners.',
    'S06': 'D = 0: Not calculable. Dissatisfaction and missing are never treated as the same.',
    'S07': 'L = 0: Not calculable. U = L: completeness 0%, true share unknown, public 0% claim withheld. Unknowns are never non-members.',
    'S08': 'Missing coverage or duplicates: pending, not zero. No narratives without consent and interpretation review.',
    'C01': INACTIVE_RULE, 'C04': INACTIVE_RULE, 'C09': INACTIVE_RULE, 'C10': INACTIVE_RULE,
    'C02': 'D = 0: Not calculable. Unsure is not false and refusal is not zero.',
    'C03': 'D = 0: Not calculable; a valid zero is allowed. Not applicable, unsure, refused and skipped stay separate (not neutral, not disagreement).',
    'C05': 'A = 0 and D > 0: verification Not calculable, coverage 0%. D = 0 with unresolved applicability: rates unavailable. D = 0 and none unresolved: Not applicable. Not-assessed clubs are not failures.',
    'C06': 'D = 0: Not calculable. Yes = 0 with D > 0 is a valid 0%. Unsure, refused and skipped are never counted as No.',
    'C07': 'L = 0: Not calculable. L − U = 0: completeness 0%, public share withheld. Roster complete and records ready must both be confirmed.',
    'C08': 'Missing authority, consent or review: collection or publication pending. No numerical unit.',
  };
  for (const k of K) k.rules = RULES[k.id];

  // ---------- evaluation ----------
  const blank = x => x == null || x === '' || (typeof x === 'number' && !Number.isFinite(x));
  function checkType(type, val) {
    if (type === 'int') return Number.isInteger(val) && val >= 0;
    if (type === 'dec') return typeof val === 'number' && Number.isFinite(val) && val >= 0;
    if (type === 'sdec') return typeof val === 'number' && Number.isFinite(val);
    if (type === 'bool') return typeof val === 'boolean';
    if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(val);
    if (type.startsWith('enum:')) return type.slice(5).split('|').includes(val);
    return typeof val === 'string' && val.trim().length > 0;
  }

  // Evaluate one wave: { meta: {...}, inputs: {...} } -> { status, reason?, value?, display?, workings?, extra?, publishable }
  function evaluate(kpi, wave = {}) {
    if (kpi.state === 'inactive') return { status: STATUS.INACTIVE, reason: kpi.limitations, publishable: false };
    const meta = wave.meta || {}, v = wave.inputs || {};
    const bad = [], missing = [];
    for (const [key, label, type] of META) {
      if (blank(meta[key])) { if (META_REQUIRED.includes(key)) missing.push(label); }
      else if (!checkType(type, meta[key])) bad.push(label);
    }
    for (const [key, label, type, , req] of kpi.inputs) {
      if (blank(v[key])) {
        if (req === 'req' || (req === 'partial' && meta.capture_status === 'Partial')) missing.push(label);
      } else if (!checkType(type, v[key])) bad.push(label);
    }
    if (!blank(meta.period_start) && !blank(meta.period_end) && meta.period_end < meta.period_start) bad.push('Reporting period (end before start)');
    if (bad.length) return { status: STATUS.FAIL, reason: `Invalid: ${bad.join('; ')}.` };
    if (missing.length) return { status: STATUS.DCR, reason: `Missing: ${missing.join('; ')}.` };
    if (meta.source_checks_passed !== true) return { status: STATUS.DCR, reason: 'Pending: source checks not confirmed by the custodian.' };
    if (meta.source_verification === 'Not verified') return { status: STATUS.DCR, reason: 'Source not verified: this blocks a reportable result.' };
    if (meta.record_type === 'Operational' && meta.method_permission === 'Denied') return { status: STATUS.FAIL, reason: 'Method permission denied for an operational record.' };
    if (meta.record_type === 'Operational' && meta.method_permission !== 'Approved') return { status: STATUS.DCR, reason: 'Pending: method permission must be Approved for an operational record.' };
    if (meta.capture_status === 'Partial' && !kpi.partialAllowed) return { status: STATUS.DCR, reason: 'Complete capture is required (only P3-03 may use partial logs).' };
    const r = kpi.calc(v, meta);
    const publishable = meta.publication_approved === true && !r.withhold;
    if (!r.ok) return { ...r, publishable: false };
    const status = meta.record_type === 'Hypothetical' ? STATUS.HYPOTHETICAL : meta.source_verification === 'Estimated' ? STATUS.ESTIMATED : STATUS.VERIFIED;
    return { status, value: r.value, display: r.display, workings: r.workings, extra: r.extra, withhold: !!r.withhold, publishable };
  }

  // Change between two waves (level KPIs) or two cohort pairs. Descriptive, not causal.
  function change(kpi, a, b, entry = {}) {
    if (kpi.waves.length !== 2 || !kpi.changeUnit) return null;
    if (!isCalculated(a.status) || !isCalculated(b.status) || a.value == null || b.value == null) return { status: STATUS.NC, text: 'Needs both waves calculated' };
    if (a.withhold || b.withhold) return { status: STATUS.NC, text: 'Not calculable: identity unknown in a wave' };
    const ma = entry.waves?.[0]?.meta || {}, mb = entry.waves?.[1]?.meta || {};
    if ((a.status === STATUS.HYPOTHETICAL) !== (b.status === STATUS.HYPOTHETICAL)) return { status: 'Not comparable', text: 'Not comparable: hypothetical and operational waves' };
    if (ma.scope_id !== mb.scope_id || ma.method_version !== mb.method_version) return { status: 'Not comparable', text: 'Not comparable: scope or method version differs' };
    if (entry.comparison_approved !== true) return { status: 'Not comparable', text: 'Not comparable: comparison not approved' };
    const d = b.value - a.value;
    const text = kpi.changeUnit === 'pp' ? `${signed(d, x => x.toFixed(1))} pp`
      : kpi.changeUnit === 'AUD' ? signed(d, aud)
      : kpi.changeUnit === 'unitAUD' ? `${signed(d, aud2)}${a.value > 0 ? ` (${signed(100 * d / a.value, x => x.toFixed(1))}%)` : ''}`
      : kpi.changeUnit === 'hours' ? signed(d, x => x.toLocaleString('en-AU', { maximumFractionDigits: 1 })) + ' person-hours'
      : signed(d, int);
    return { status: 'Calculated', text, workings: `${kpi.waves[1]} ${b.display} − ${kpi.waves[0]} ${a.display} = ${text}. Descriptive, not causal.` };
  }

  const SOURCE_FILE = 'NSW_Rugby_KPI_Formula_Web_Handover.xlsx';
  return { STATUS, META, META_REQUIRED, KPIS: K, evaluate, change, isCalculated, SOURCE_FILE };
})();
