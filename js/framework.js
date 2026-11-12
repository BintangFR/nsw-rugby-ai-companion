// Framework tab: the Legacy impact framework as eight steps anyone can reproduce in a spreadsheet or another tool.
// The steps follow Tackle AI itself (money → map → people → three impacts → KPIs → evidence → zones → recommend
// and report). Every formula and parameter is printed from the definitions the app calculates with (js/data.js,
// js/methods.js, js/kpi-framework.js), so the document and the app cannot drift apart.
// Downloads: standalone HTML (print / PDF), machine-readable JSON, the Legacy lines template (CSV) and the KPI input fields (CSV).
(() => {
  const { $, esc } = window.App;
  const D = window.TACKLE_DATA, KF = window.KPIF, A = window.Analytics;
  const DIMS = ['Economic', 'Social', 'Cultural'];
  const PILLARS = [['P1', 'Facilities & Equipment'], ['P2', 'Priority Regions & Pathways'], ['P3', 'Programs & Workforce'], ['P4', 'Inclusion'], ['P5', 'RWC Activation']];
  const STATE = { active: 'Active', conditional: 'Research only — not activated', inactive: 'Inactive — ID retained, no calculation', qualitative: 'Qualitative only' };
  const REQ = r => r === 'req' ? 'Required' : r === 'partial' ? 'Required if capture is Partial' : r?.startsWith('group:') ? 'Required per practice (all six or none)' : 'Optional';
  const TYPE = t => ({ int: 'Whole number ≥ 0', dec: 'Decimal ≥ 0', sdec: 'Decimal (may be negative)', bool: 'Yes / No', date: 'ISO date', text: 'Text' }[t] || (t.startsWith('enum:') ? 'One of: ' + t.slice(5).split('|').join(' / ') : t));
  const primaryPillar = k => (k.pillar.match(/P\d/) || ['—'])[0];
  const table = (head, rows) => `<div class="table-scroll"><table class="pretty-table method-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const aud = v => '$' + Math.round(v).toLocaleString('en-AU');
  const P = () => window.Methods.PARAMS;

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
    ['Measure the Legacy Program only', 'Every impact figure traces to Legacy money or to people reached by Legacy-funded work. Rugby-wide numbers are labelled as context. Other programs, such as Rugby For Good, are not measured.'],
    ['Missing is never zero', 'A blank means "not reported yet". It shows as "Needs data" or "Data collection required", never as 0.'],
    ['Adapt before you create', 'Use a method a sport organisation has published, and cite it. Adapt it if it does not quite fit. Create a formula only when nothing suitable exists, and state why (section 5).'],
    ['Keep different things apart', 'Never add the three impacts together, never add a value to money invested, and never add or average KPIs.'],
    ['Show your working', 'Every figure can show its formula with the actual inputs, so a reviewer can recalculate it by hand.'],
    ['Describe, do not claim cause', 'Results show what happened where Legacy money went. They do not prove the program caused it.'],
    ['Connect the data', 'Every recommendation shows what happened, the likely cause and what to do, with the figure behind it.'],
    ['Keep made-up data separate', 'Test figures live in one file, appear only in a marked demo view, carry a [DUMMY] tag, and are never reported. Any real figure replaces them.'],
    ['Privacy and First Nations data sovereignty', 'Collect checked totals, not names or individual answers. First Nations data follows the Maiam nayri Wingara principles and the AIATSIS Code of Ethics, with community authority over meaning and publication.'],
  ];

  // The Legacy lines template: one row per grant or budget line. [field, meaning, example, step].
  const LINE_FIELDS = [
    ['line_id', 'Your ID for the grant or budget line', 'R1-FE-001', 1],
    ['round', 'Funding round, or "Budget" for a three-year budget line', '1', 1],
    ['recipient', 'Club, association or NSW Rugby team receiving the money', 'Example Rugby Club', 1],
    ['project', 'Project or budget line name', 'Ground lighting upgrade', 1],
    ['pillar', 'FE facilities & equipment, PW programs & workforce, INC inclusion', 'FE', 1],
    ['town', 'Town or suburb (blank for statewide lines)', 'Example town', 1],
    ['region', 'Region, or Statewide', 'New England', 2],
    ['allocated_aud', 'Legacy money allocated', '150000', 1],
    ['spent_aud', 'Legacy money spent so far. Blank until reported', '', 1],
    ['tags', 'Who it is for, any of: women, firstNations, pasifika, access', 'women; access', 4],
    ['people_reached', 'People who took part in the period. Blank until reported', '', 3],
    ['sessions', 'Sessions or events held in the period (from the attendance sheet)', '', 3],
    ['hours_per_session', 'Average length of a session in hours', '', 3],
    ['survey_respondents', 'People who answered the life satisfaction question', '', 3],
    ['life_satisfaction_avg', 'Their average answer, 0 to 10', '', 3],
    ['period', 'Reporting period', '2026 season', 1],
    ['source', 'Where the figures came from', 'Acquittal report', 1],
  ];

  const GOVERNANCE = [
    ['One template, every grant', 'Every recipient reports on the Legacy lines template (section 7) at acquittal, with the same fields every time.'],
    ['Same survey questions every time', 'Use the exact wording in this framework, at the same points in the season, with the same answer options.'],
    ['Export, do not retype', 'Take Rugby Analytics data as exports each year, from the same reports, so years compare like with like.'],
    ['Named owners', 'A custodian checks each source before figures are entered. The evaluation team owns formulas and method versions. A reviewer approves anything published.'],
    ['Keep a history', 'Record what changed, when and why (Tackle AI does this in Data Studio > History), so any report can be traced to the data it used.'],
  ];

  // ---------- NSW Rugby's five project deliverables (Partner Meeting 1) and where each is answered ----------
  const DELIVERABLES = [
    ['Best-practice impact frameworks', 'Research of best-practice impact frameworks in other sporting codes, compliant with NSW Treasury guidelines.', 'Benchmarks from other codes and agencies, each adopted or adapted with a reason, checked against TPG22-22 and TPG23-08.', 'fw-formulas'],
    ['Metrics, methods and data sources', 'The best metrics, the data sources available (including benefit banks), how to analyse the data and monetise the benefits.', 'An impact value scorecard: for each impact, its unit, formula, standard value (DCJ Benefits Database, Outcomes Values Database, Destination NSW) and status.', 'fw-value'],
    ['Baseline assessment', 'A baseline of outcomes from existing data, to compare against after Legacy funding.', 'A baseline register built from Rugby Analytics, NSW Rugby\'s club list and the plan, with the year and source of every figure.', 'fw-baseline'],
    ['Tracking tools', 'Recommended ongoing tracking tools: surveys, attendance capture, post-event follow-up scripts.', 'A post-event survey, an attendance sheet, a follow-up script and the Legacy lines template, all downloadable.', 'fw-tools'],
    ['Dashboard or calculator', 'A prototype for data collection and visibility, scalable to later phases (national, Rugby For Good).', 'Tackle AI: money, map, three impacts, zones, evidence and reports, running this framework on a laptop.', 'fw-steps'],
  ];

  // Frameworks benchmarked, and how each is used. [framework, where from, what it measures, what we use].
  const BENCHMARKS = [
    ['NSW Treasury TPG22-22 Evaluation Guidelines', 'NSW Government', 'Program logic; process, outcome and economic evaluation; baselines', 'The structure of the eight steps: inputs → activities → outputs → outcomes, with a baseline'],
    ['NSW Treasury TPG23-08 Guide to Cost-Benefit Analysis', 'NSW Government', 'Present values, benefit-cost ratio, sensitivity tests', 'Discounting at 5% (3% and 7% tests); the benefit-cost ratio once costs and benefits are complete'],
    ['NSW Treasury Evidence Bank (2026) → Outcomes Values Database, DCJ Benefits Database', 'NSW Government', 'Standard values for economic and social outcomes', 'Independent values to monetise health and quality-of-life outcomes'],
    ['Community Impact of Rugby League in NSW (2026)', 'Rugby league, NSW', 'Economic contribution of club and participant spending', 'Its expenditure-flow method only. NSW Rugby asked us to use other programs\' methods, never their figures'],
    ['eventIMPACTS toolkit', 'UK events (UK Sport, EventScotland)', 'Additional visitor spending caused by an event', 'The post-event visitor survey: where visitors live, why they came, nights and spend'],
    ['Sport England Active Lives', 'England', 'Physical activity and wellbeing, including life satisfaction', 'The life satisfaction question for quality of life'],
    ['AusPlay', 'Australian Sports Commission', 'Participation and its frequency and duration', 'Participation definitions for physical activity hours'],
    ['Clearinghouse for Sport: value and benefits', 'Australian Sports Commission', 'The national evidence on the economic, health, social and volunteering value of sport', 'Per-participant value of weekly club sport ($5,932) and the value of volunteer time; context for injuries, inactivity and major events'],
    ['Cultural Development Network outcomes', 'Australia', 'Cultural outcomes such as belonging and cultural identity', 'Cultural outcomes measured as the share who agree'],
  ];
  // How the framework meets NSW Treasury requirements. [requirement, how it is met].
  const COMPLIANCE = [
    ['Program logic linking inputs to outcomes (TPG22-22)', 'Steps 1 to 4 run from Legacy money (inputs) through people reached (outputs) to valued outcomes.'],
    ['A baseline before the program changes things (TPG22-22)', 'The baseline register (section 6), recorded before the 2027 Rugby World Cup peak.'],
    ['Benefits valued with recognised parameters (TPG23-08)', 'Standard values from the DCJ Benefits Database and the Outcomes Values Database, named in the Evidence Bank.'],
    ['Discounting and sensitivity (TPG23-08)', '5% real discount rate, tested at 3% and 7%.'],
    ['Transparency about attribution (TPG22-22)', 'Results describe what happened where Legacy money went; no causal claim without a comparison group.'],
  ];

  // The value of each impact. [impact, measure, unit, how it is valued, standard value or source, data needed].
  const VALUE_SCORECARD = [
    ['Economic', 'Contribution of Legacy spending', '$', 'Legacy spend in each category × share kept in NSW × multiplier, shown per $1 allocated', 'Expenditure-flow method; ABS input-output multipliers', 'Legacy allocations (have)'],
    ['Economic', 'Visitor and overnight spending', '$', 'Visitors from outside the area × spend per visitor, split into day trips, domestic overnight and international visitors', 'Destination NSW visitor spend; eventIMPACTS survey method', 'Post-event survey'],
    ['Social', 'Physical activity', 'hours', 'Participants × sessions × hours per session', 'AusPlay participation definitions', 'Attendance capture'],
    ['Social', 'Quality of life', '0–100 index; $', 'Average life satisfaction (0–10) × 10; a change can be valued in QALYs', 'Sport England question; DCJ QALY value $69,948', 'Survey before and after'],
    ['Social', 'Value of weekly participation', '$ a year', 'People taking part weekly × social benefit of community club sport', 'Australian Sports Commission & Griffith (2018), Clearinghouse for Sport: $5,932 per participant a year', 'Attendance capture (weekly participants)'],
    ['Social', 'Volunteer time', 'hours and $', 'Volunteer hours × value per hour', 'BCG for the ASC (2017): $3 billion ÷ 158 million hours = $18.99 an hour', 'Attendance capture (volunteers × hours)'],
    ['Social', 'Health outcomes avoided (alternative to the line above, never both)', '$ a year', 'Participants who avoid an outcome × its standard value', 'DCJ Benefits Database: child depression $555, anxiety $314, obesity $127 a year', 'People reached; evidence on how many avoid each outcome'],
    ['Cultural', 'Investment in First Nations and Pasifika programs', '$', 'Sum of Legacy allocations tagged First Nations or Pasifika', 'Legacy data', 'Tagged lines (have)'],
    ['Cultural', 'Cultural outcomes', '% agree', 'Share of respondents who agree each CDN outcome happened for them', 'Cultural Development Network schema; not monetised', 'Survey'],
  ];
  // Standard values from independent data banks. [outcome, value, unit, bank, price year].
  const STANDARD_VALUES = [
    ['Playing community club sport once a week', '$5,932', 'per participant a year', 'Australian Sports Commission & Griffith Business School (2018), via the Clearinghouse for Sport', '2018'],
    ['One hour of sport volunteering', '$18.99', 'per hour (derived)', 'BCG for the Australian Sports Commission (2017): $3 billion ÷ 158 million hours', '2017'],
    ['One quality-adjusted life year (QALY)', '$69,948', 'per QALY', 'DCJ Benefits Database (2024)', 'FY2022/23 (from $60,500 in 2019, CPI)'],
    ['Child avoids or overcomes depression', '$555', 'per person a year', 'DCJ Benefits Database (2024), HE34', 'FY2022/23'],
    ['Child avoids or overcomes anxiety', '$314', 'per person a year', 'DCJ Benefits Database (2024)', 'FY2022/23'],
    ['Child avoids or overcomes being obese', '$127', 'per person a year', 'DCJ Benefits Database (2024), HE36', 'FY2022/23'],
    ['Child avoids or overcomes being overweight', '$78', 'per person a year', 'DCJ Benefits Database (2024), HE35', 'FY2022/23'],
    ['Obese client avoids a hospital admission', '$7,496', 'per episode', 'DCJ Benefits Database (2024), HE19', 'FY2022/23'],
    ['Value of a statistical life', '$5,400,000', 'per person', 'DCJ Benefits Database (2024), from the Office of Impact Analysis', '2023'],
  ];

  // Tracking tools. Post-event survey: [question, answer format, what it feeds].
  const SURVEY = [
    ['Where do you live? (postcode, or country if overseas)', 'Postcode / country', 'Domestic or international; local or visitor'],
    ['Was this event your main reason for being in the area today?', 'Yes / Partly / No', 'Visitor spending counts only for "Yes" (eventIMPACTS)'],
    ['How many nights are you staying in the area?', 'Number (0 = day trip)', 'Day trip or overnight stay'],
    ['Where are you staying?', 'Hotel or motel / Friends or family / Caravan or camping / Other', 'Accommodation spend'],
    ['About how much will your group spend in the area on this trip? Accommodation, food and drink, transport, shopping, other', 'Dollars per category, and group size', 'Visitor spending per person'],
    ['Overall, how satisfied are you with your life nowadays?', '0 (not at all) to 10 (completely)', 'Quality of life (Sport England Active Lives)'],
    ['In a typical week, how many hours are you physically active (enough to raise your breathing)?', 'Hours', 'Physical activity hours'],
    ['I feel I belong at this club or event.', 'Strongly disagree to strongly agree', 'Cultural outcome: belonging (CDN)'],
    ['Do you identify as Aboriginal or Torres Strait Islander, or with a Pasifika heritage? (optional)', 'Options, plus "prefer not to say"', 'Inclusion reach (aggregate only)'],
  ];
  // Attendance sheet: [column, meaning, example].
  const ATTENDANCE = [
    ['date', 'Date of the session or event', '2027-03-14'],
    ['legacy_line', 'The Legacy grant or budget line it belongs to', 'R1-FE-001'],
    ['venue', 'Venue', 'Example Oval'],
    ['session_type', 'Training, game, carnival, clinic, course', 'Carnival'],
    ['participants', 'People taking part', '120'],
    ['girls_women', 'Of whom girls and women', '48'],
    ['first_nations', 'Of whom First Nations (if shared)', '9'],
    ['pasifika', 'Of whom Pasifika (if shared)', '14'],
    ['disability', 'Of whom people with disability (if shared)', '2'],
    ['hours', 'Length of the session in hours', '3'],
    ['coaches_refs_volunteers', 'Coaches, referees and volunteers present', '18'],
    ['spectators', 'Spectators, and how counted (gate, ticket, estimate)', '400 (estimate)'],
  ];
  // Post-event follow-up script: [when, who, what to do or say].
  const FOLLOWUP = [
    ['On the day', 'Event lead', 'Put the survey QR code at the gate and canteen. Say: "Help us show what this event means for your club: a two-minute survey, no names."'],
    ['Within 2 days', 'Club secretary', 'Email or text participants and visitors the survey link. "Thanks for coming to [event]. NSW Rugby and the NSW Government funded it through the Rugby World Cup Legacy Program; two minutes of your time helps keep this funding coming: [link]."'],
    ['Within 7 days', 'Club secretary', 'Enter the attendance sheet totals on the Legacy lines template (people reached, sessions, hours).'],
    ['Within 30 days', 'NSW Rugby Legacy team', 'Download survey results, check for duplicates, and upload the totals in Data Studio. Note anything unusual (weather, a clash with another event).'],
    ['At acquittal', 'Recipient', 'Report spend, people reached, photos and one short story with permission to publish.'],
  ];

  // Baseline register, live from the uploaded Rugby Analytics series, the club list and the plan.
  function baseline() {
    const ms = A.measures(), N = v => Math.round(v).toLocaleString('en-AU');
    const ends = s => { const y = Object.keys(s || {}).map(Number).filter(Number.isFinite).sort(); return y.length ? [y[0], s[y[0]], y[y.length - 1], s[y[y.length - 1]]] : null; };
    const row = (label, key, src) => { const e = ends(ms[key]?.series); return e ? [label, `${N(e[1])} (${e[0]})`, `${N(e[3])} (${e[2]})`, src] : [label, 'Needs data', '–', src]; };
    const kt = id => A.kpiTargets().find(k => k.id === id);
    const ratio = (label, id) => { const k = kt(id); return [label, k?.baseline != null ? `${k.baseline}:1 (${k.baseYear || 'plan'})` : 'Needs data', k?.actual != null ? `${(+k.actual).toFixed(1)}:1` : '–', `Plan baseline; latest from Rugby Analytics. Target ${k?.target ?? '–'}:1`]; };
    return [row('Players', 'players', 'Rugby Analytics'), row('Coaches', 'coaches', 'Rugby Analytics'), row('Match officials', 'matchOfficials', 'Rugby Analytics'),
      row('Female participants', 'femaleParticipants', 'Rugby Analytics'), row('First Nations participants', 'firstNationsParticipants', 'Rugby Analytics (heritage)'), row('Pasifika participants', 'pasifikaParticipants', 'Rugby Analytics (heritage)'),
      ratio('Players per coach', 'coachRatio'), ratio('Players per match official', 'moRatio'),
      ['Clubs meeting a club standard', '241 of 307 (45 Silver, 196 Bronze; 0 Gold)', 'next check', 'NSW Rugby club list (2026)'],
      ['Facilities with female-friendly changerooms', `${D.context.facilityAudit.femaleChangerooms}%`, 'next audit', 'Rugby Australia facility audit'],
      ['Facilities with adequate lighting', `${D.context.facilityAudit.adequateLighting}%`, 'next audit', 'Rugby Australia facility audit'],
      ...(window.AusPlay?.baselineRows() || []),
      ['Legacy lines reporting people reached', '0', 'at acquittal', 'Legacy lines template'],
      ['Legacy events with a post-event survey', '0', 'after each event', 'Post-event survey']];
  }

  // Every formula this project adapted or created, with the reason. Update this list whenever one is added or changed.
  // [name, formula, adapted from (or 'None found'), why it exists, limit]. KPI formulas are the evaluation team's and are not listed.
  const ADAPTED = [
    ['Spend lines sorted into spending categories', 'Facility grants → capital expenditure; staff roles → wages and salaries; match official programs → referees and match officials; everything else → all other expenses. Then spend × share kept in NSW × multiplier.', 'NSW Rugby League 2026 expenditure flow analysis (its categories, rates and multipliers, unchanged).', 'NSW Rugby League\'s method needs spend by category, but Legacy records list projects and budget lines. Sorting them lets its published rates be used without inventing any new rates.', 'The sorting rule is ours. Spend is allocations, not audited spend. "All other expenses" is a catch-all.'],
    ['Value of weekly participation', 'People taking part weekly in Legacy-funded work × $5,932 a year, plus volunteer hours × $18.99.', 'Australian Sports Commission & Griffith Business School (2018) per-participant value of weekly club sport, unchanged; volunteer rate derived from BCG for the ASC (2017), $3 billion ÷ 158 million hours. Both via the Clearinghouse for Sport.', 'The mission is the impact of the $10M, so only people Legacy-funded work reaches weekly are valued. NSW Rugby asked for independent values rather than another program\'s figures, and the Australian Sports Commission\'s national value of weekly club sport is the closest published match. Earlier versions counted all NSW players, then used Rugby For Good values; both were replaced.', 'A national average in 2018 dollars, so indicative. Applying it needs a weekly count, not people reached. The volunteer rate is a derived average. Do not add health outcomes on top: they are part of the same benefit.'],
    ['Happiness index', 'Average answer to the life satisfaction question (0–10) × 10.', 'Sport England Active Lives survey (question and 0–10 scale, unchanged).', 'A sport organisation already asks this question and publishes averages to compare with. Multiplying by 10 only puts it on the same 0–100 scale as the app\'s percentages; it does not change the result.', 'One question, not a full wellbeing measure. The published averages are from England in 2016-17.'],
    ['Spend vs population', 'Region share of spend ÷ region share of population. 1.75x or more = above population share; 0.5x or less = below it.', 'The idea of population-based funding, which Sport NZ describes as its approach. The ratio and cut-offs are ours.', 'Boards and funders ask whether money is reaching every region fairly, and we found no published sport test to apply. Wide cut-offs flag only clear outliers.', 'A screening indicator, not an impact measure. The cut-offs are a judgement, population figures are indicative, and participation would be a fairer base once it is available by region.'],
  ];
  const CREATED = [
    ['AI review of public stories', 'A local AI model reads each story with the list of funded projects and returns: about Legacy-funded work or not, impact type, and one sentence on what it shows. It also suggests extra searches and writes one summary per impact type.', 'None found as a published method for sport impact. It follows the app\'s rule that code calculates and AI only explains: links to grants are made by fixed rules, and the model\'s sentences are checked so every figure appears in the source stories.', 'Keyword rules cannot tell a story about a funded club\'s new lights from a match report in the same town. A model reading the story can, and it can think of searches the fixed list misses.', 'A model can still misread a story, so its judgement is shown as an "AI review" and a person checks each story before it becomes evidence. Results vary a little between runs.'],
    ['Match-day difference', 'Average daily figure on match or event days ÷ average on other days on the same weekdays − 1 (also shown against all other days).', 'eventIMPACTS counts spending that happens because an event is staged; this applies the same idea to a daily figure (spending, takings, visitors, Google Trends interest) when no visitor survey exists. No published formula for the daily comparison was found.', 'NSW Rugby wants to know whether local business is busier because of matches at funded grounds. Comparing with the same weekday stops ordinary weekend trade from looking like a match effect.', 'Shows a difference on those days, not proof the match caused it. Other events on the same days, weather and school holidays also matter. Fewer than three match days is a first look only.'],
    ['Public story links', 'Each public story is linked as: names a Legacy-funded club (all words of the club name appear), in a Legacy-funded town (the town appears as a place), or NSW rugby with no funded place named.', 'None found.', 'Public data only helps measure Legacy impact when it is tied to a place the program funds, so every story says what it is linked to and how strongly.', 'Word matching can miss stories or link the wrong one, so a person checks each story before it becomes evidence. A link is not proof the funding caused what the story describes.'],
    ['Legacy funding per participant (zones)', 'Round 1 Legacy allocations placed in a rugby zone (by the club or town named, using NSW Rugby\'s club list) ÷ participants in that zone in 2026.', 'None found as a published sport formula. It is plain division of two published figures.', 'Future funding decisions, and checking the Round 2 list once announced, need to see where Legacy money has gone relative to how many people play there. Participants are a fairer base than population for a sport program.', 'Statewide budgets are in no zone; the zone mapping is provisional; associations overlap, so participants can be counted twice.'],
    ['Zone "worth a look" notes', 'A zone is noted if participation fell, it has no Round 1 facility grant, its Legacy funding per participant is under half the all-zone figure, churn is 5 points above it, players per coach is over the plan ratio + 2, or its First Nations or Pasifika share is 1.5 times the all-zone share.', 'None found.', 'People planning future funding need to see quickly where to look, without a combined score that would hide the reasons. Each note shows its own figures.', 'The cut-offs are a judgement chosen so that only clear differences show. A note is a prompt to look closer, not a ranking or a funding recommendation.'],
    ['Value per $1 of Legacy funding', 'Dollar value ÷ Legacy funds allocated so far.', 'None found as a sport-sector formula for a program mid-delivery. A benefit-cost ratio (NSW Treasury TPG23-08) needs costs and benefits over the whole program, which do not exist yet.', 'The mission is to relate impact to the $10M, so each value is shown against the money behind it, using only allocations known so far.', 'Descriptive, not a benefit-cost ratio. Allocations are not audited spend, and the figure will change as money is allocated.'],
    ['Workforce needed', 'Players ÷ the plan\'s target ratio − current coaches or match officials.', 'None needed: it is arithmetic on the plan\'s own ratios (players per coach, players per match official).', 'It turns a ratio into a number staff can act on in a recommendation.', 'Uses all NSW rugby counts, as the plan does, so it is context for the program and not a measure of its impact.'],
    ['Public stories by impact type', 'Public news stories about Legacy-funded places and NSW rugby, sorted into economic, cultural or social by whichever has the most keyword matches. A headline with no keyword match takes the type of the search that found it (each town is searched once per impact type), and is marked so.', 'None found.', 'NSW Rugby approved public data, and news can show effects its own records miss, such as local business or community activity. Staff check each item before it becomes evidence.', 'A mention shows something happened near funded work, not that the funding caused it. News covers only what gets reported, and keyword sorting can be wrong.'],
    ['Data quality score', 'Tables: 25 row-level records + 20 region + 15 date or season + 15 dollar amounts + 10 demographic split + 15 × completeness. Documents: 10 + 8 each for region detail, recent year and dollar figures + 6 for inclusion groups. Green 70+, amber 40–69, red below 40.', 'None found.', 'The team needed a quick way to flag files that are "too high level" to rely on. The points follow what the measures in this framework actually need from a file.', 'The weights are a judgement. It rates whether a file is usable, not whether its numbers are correct.'],
  ];

  // Past research behind the values and formulas. [id, citation, what it found, how it is used here, how we checked it, url].
  // "How we checked" must stay honest: cited in a report we read is not the same as reading the study itself.
  const VIA_R4G = 'Seen as cited in the Rugby For Good CBA 2025. Original not read.';
  const VIA_NSWRL = 'Seen as cited in the NSW Rugby League 2026 study. Original not read.';
  const ABSTRACT = 'Abstract or summary read. Full text not read.';
  const VIA_CH = 'Figure read on the Clearinghouse for Sport page (Australian Sports Commission, updated May 2026). Original report not read.';
  const RESEARCH = [
    ['asc-club', 'Australian Sports Commission & Griffith Business School (2018), Economic value of community club-based sport in Australia', 'Playing community club sport once a week brings a social benefit of $5,932 per participant a year.', 'The value of each weekly participant in Legacy-funded activity.', VIA_CH, 'https://www.ausport.gov.au/clearinghouse/evidence/value-and-benefits/economic'],
    ['bcg17', 'Boston Consulting Group for the Australian Sports Commission (2017), Intergenerational Review of Australian Sport', 'Australians give 158 million volunteer hours to sport a year, worth $3 billion.', 'The value of a volunteer hour: $3 billion ÷ 158 million = $18.99 (our division).', VIA_CH, 'https://www.ausport.gov.au/clearinghouse/evidence/volunteers-in-sport/benefits'],
    ['abs-io', 'Australian Bureau of Statistics, Input-Output tables', 'How spending in each sector flows through the economy.', 'The main reference for NSW Rugby League\'s multipliers for each spending category.', VIA_NSWRL],
    ['abs-gss', 'Australian Bureau of Statistics, General Social Survey', 'National benchmarks for volunteering, confiding in others and meeting responsibilities.', 'The comparison points for social capital.', VIA_NSWRL],
    ['sirc', 'Sheffield Hallam University for Sport England (2018), analysis of the Active Lives survey, 2016-17', 'Over 50,000 responses. Average life satisfaction: 6.51 inactive, 7.00 fairly active, 7.24 active.', 'The question and 0–10 scale of the happiness index, and the context figures.', 'Summary of the study read. Full report not read.', 'https://blogs.shu.ac.uk/hwbstaffnews/2018/01/05/physical-activity-and-wellbeing/'],
    ['cheung', 'Cheung & Lucas (2014), Assessing the validity of single-item life satisfaction measures, Quality of Life Research 23(10)', 'In three large samples, one question gave almost the same answers as a longer five-item scale.', 'The reason one question is acceptable for the happiness index.', ABSTRACT, 'https://www.diw.de/de/diw_01.c.766284.de/s_9009.html'],
    ['eime', 'Eime et al. (2016), Population levels of sport participation: implications for sport policy, BMC Public Health', 'Participation generally runs higher outside metropolitan areas, and drops steeply through adolescence. Victorian data.', 'Why population is an imperfect base for spend vs population, and context for reading the age data.', ABSTRACT, 'https://doaj.org/article/9df1069642794da4af2fdb8a52f6e7dd'],
    ['wang', 'Wang & Strong (1996), Beyond Accuracy: What Data Quality Means to Data Consumers, Journal of Management Information Systems 12(4)', 'Data quality means fitness for use, and goes beyond accuracy to things like completeness.', 'The idea behind rating files on what the measures need. The points are ours.', ABSTRACT, 'https://web.mit.edu/tdqm/www/tdqmpub/beyondaccuracy_files/beyondaccuracy.html'],
  ];
  // Research behind each adapted or created formula. An empty list means our searches found none.
  const RESEARCH_FOR = {
    'Spend lines sorted into spending categories': ['abs-io'], 'Value of weekly participation': ['asc-club', 'bcg17'],
    'Happiness index': ['sirc', 'cheung'], 'Spend vs population': ['eime'], 'Legacy funding per participant (zones)': ['eime'], 'Data quality score': ['wang'],
  };
  const researchCell = name => {
    const ids = RESEARCH_FOR[name] || [];
    return ids.length ? ids.map(id => esc(RESEARCH.find(r => r[0] === id)[1].split(',')[0])).join('; ') : '<span class="muted">None found</span>';
  };


  // ---------- the eight steps (the same order as Tackle AI) ----------
  // [id, title, question it answers, data you need, how to calculate [figure, rule], where Tackle AI shows it, check].
  function STEPS() {
    const p = P(), known = A.centralisation().knownTotal, funding = D.context.totalLegacyFunding;
    const cat = k => { const c = p.ORG_CATS.find(x => x[0] === k); return `${c[1].toLowerCase()} (${c[2] * 100}% kept in NSW × ${c[3]})`; };
    return [
      ['fw-s1', 'List the Legacy money', 'Where has the $10M gone?',
        ['Round 1 grant recipient lists (Category 1 and 2, published 6 May 2026): recipient, project, town, amount.', 'RWC Dashboard three-year budgets: initiative, pillar, region, amount per year.', 'Spending reported by recipients at acquittal.', 'Put them on the Legacy lines template (section 7): one row per grant or budget line.'],
        [['Allocated so far', 'Sum of allocated_aud over every line, each line once.'],
         ['Not yet traced', `${aud(funding)} − allocated so far.`],
         ['Spent so far', 'Sum of spent_aud over the lines that have reported. A line with no report stays blank: never count it as $0.'],
         ['By pillar and by region', 'The same sums grouped by pillar and by region. Statewide lines are their own group.']],
        'Dashboard headline tiles; Story > expenditure page.', `Your "allocated so far" should match the Dashboard tile (today ${aud(known)}).`],
      ['fw-s2', 'Place it on the map', 'Is the money reaching every region?',
        ['The step 1 lines with their region.', 'Region population and First Nations share (ABS Census 2021; indicative).'],
        [['Spend vs population', 'Region share of regional spend ÷ region share of NSW population. Statewide lines are left out of both shares.'],
         ['Reading it', '1.75 or more = above population share; 0.5 or less = below population share; otherwise in line. It shows where to look, not impact.']],
        'Dashboard > map.', 'The regional shares of spend add up to 100%.'],
      ['fw-s3', 'Count the people reached', 'Who did the money reach, and how do they feel?',
        ['People reached by each Legacy-funded line in the period, from the recipient\'s acquittal report.', 'A life satisfaction survey at funded facilities and programs, asking exactly: "Overall, how satisfied are you with your life nowadays?" (0 = not at all, 10 = completely; Sport England Active Lives).'],
        [['People reached', 'Sum of people_reached over the lines that have reported. Someone in two programs counts twice.'],
         ['Physical activity hours', 'Participants × sessions × hours per session, from the attendance sheet (section 7).'],
         ['Happiness index', 'Average answer (0–10) × 10, giving 0–100. With an earlier survey, show the change in points.'],
         ['Gaps', 'No people reached: "Activity data needed". No survey: "Survey needed". Never fill a gap with zero.']],
        'Impact > Overview: activity and happiness by facility and region.', 'Count only people reached by Legacy-funded lines, never all NSW players.'],
      ['fw-s4', 'Value the three impacts', 'What has the $10M delivered?',
        ['Step 1 allocations (economic).', 'Step 3 people reached (social).', 'Lines tagged firstNations or pasifika (cultural).', 'Optional surveys: the eventIMPACTS visitor survey at RWC event hubs, the ABS General Social Survey questions, the Cultural Development Network outcome questions.'],
        [['Economic: contribution of Legacy spending', `Put each line in a NSW Rugby League 2026 spending category, then add up spend × share kept in NSW × multiplier. Facility grants → ${cat('capex')}; staff roles → ${cat('wages')}; match official programs → ${cat('referees')}; everything else → ${cat('other')}.`],
         ['Economic: per $1', 'Contribution ÷ allocated so far. Descriptive, not a benefit-cost ratio.'],
         ['Economic: event visitor spending (rugby tourism)', 'Visitors from outside the host area who came because of a carnival, match or event hub, split into day trips, domestic overnight and international visitors, × their spend in the area (accommodation, food, travel, shopping), plus organiser spend in the area. Method: eventIMPACTS; spend per visitor: the post-event survey, checked against Destination NSW averages.'],
         ['Economic: jerseys, merchandise and trading', 'Count them inside the contribution above, in their NSW Rugby League categories: participant uniforms and apparel, and club canteen, bar and trading. Sales figures come from the club or retailer; public stories and Google Trends only show interest, not sales.'],
         ['Social: value of weekly participation', `People taking part weekly × $${p.CLUB.value.toLocaleString('en-AU')} a year (social benefit of community club sport, Australian Sports Commission & Griffith ${p.CLUB.year}), plus volunteer hours × $${p.VOL_RATE.toFixed(2)} (BCG for the ASC 2017). One-off attendees are not valued.`],
         ['Social: social capital', 'For each ABS General Social Survey question, the participants\' result compared in percentage points with the ABS benchmarks (section 5).'],
         ['Cultural: invested', 'Sum of allocated_aud on lines tagged firstNations or pasifika, each line once. Money invested, not the value of the outcome.'],
         ['Cultural: outcomes', 'For each of the five Cultural Development Network outcomes, the share of respondents who agree. Not in dollars: no published method values cultural outcomes.']],
        'Impact > Overview ("What the $10M has delivered") and Impact > Calculators.', 'Report the three impacts side by side; never add them together. Hover a value in the app to see the same working with today\'s inputs.'],
      ['fw-s5', 'Track the evaluation team\'s KPIs', 'Are the funded projects achieving their outcomes?',
        [`The ${KF.KPIS.length} KPIs in the evaluation team's KPI Formula Web Handover (Appendix A lists each one's inputs).`, 'Results submitted as waves (a baseline and a follow-up) with the shared controls (Appendix A).'],
        [['Each KPI', 'Calculated exactly as the evaluation team wrote it, and labelled with one status (Appendix A).'],
         ['Change', 'Shown only between two calculated waves with the same scope and method, once the comparison is approved.']],
        'Impact > KPIs.', 'Never add or average KPIs.'],
      ['fw-s6', 'Gather evidence', 'How do we know?',
        ['Field evidence: stories, quotes and photos, each with its source.', 'Public news (Google News, Bing News) and public social media posts (Reddit, Bluesky) about Legacy-funded towns. Facebook, Instagram, X and TikTok need approved developer access, so they are not searched.', 'Optional: a daily figure near a funded ground (a Google Trends download, council spending data such as Spendmapp, or a business\'s daily takings) and the match dates.'],
        [['Public story link', 'Strongest first: names a Legacy-funded club (every word of the club name appears); in a Legacy-funded town (the town appears as a place); NSW rugby with no funded place named.'],
         ['Impact type', 'Economic, social or cultural: whichever has the most keyword matches in the story. With none, the type of the search that found it (each funded town is searched three times, once per impact type).'],
         ['AI review (optional deep search)', 'Your own AI model plans extra searches from the funded projects, judges whether each story is about Legacy-funded work and which impact it shows, and writes one summary per impact. Grant links stay rule-based; any figure the model writes must appear in the stories, or it is dropped.'],
         ['Match-day difference', 'Average on match days ÷ average on other days that fall on the same weekdays − 1. Also shown against all other days.']],
        'Impact > Evidence.', 'A person reads every story and result before it enters the evidence log. A link or a difference is not proof the funding caused it.'],
      ['fw-s7', 'Compare zones', 'Where has Legacy money reached, and where could future funding go?',
        ['Rugby Analytics association exports: Hierarchy Churn, Hierarchy Metrics, Heritage, Key Stats by Age Group.', 'A mapping of associations, regions and towns to rugby zones (Dataset/round2-zones.csv; provisional until NSW Rugby confirms it).', 'Round 1 allocations from step 1.'],
        [['Per zone', 'Participants in 2026, growth since 2025, churn, players per coach, and First Nations, Pasifika and female shares.'],
         ['Legacy funding per participant', 'Round 1 allocations mapped to the zone ÷ its participants in 2026.'],
         ['Worth a look', 'Noted when participation fell, there is no Round 1 facility grant, funding per participant is under half the all-zone figure, churn is 5 points above it, players per coach is over the plan ratio + 2, or the First Nations or Pasifika share is 1.5 times the all-zone share. Each note shows its own figures; there is no combined score.']],
        'Dashboard > Zone view.', 'Statewide budgets belong to no zone, and associations overlap, so a player can be counted twice.'],
      ['fw-s8', 'Recommend and report', 'What should we do next, and how do we tell people?',
        ['The results of steps 1 to 7.'],
        [['Recommendation', '"Since [a figure], we can [an action]", with what happened, the likely cause and the figure behind it. Rules: money not yet traced; coaches and match officials needed for the plan ratios; female participation against the plan; regions with a high First Nations population and no program; Pasifika in non-playing roles; the share held in statewide budgets; zones worth a look; funded facilities with no survey.'],
         ['Reports', 'Board Summary (overview, expenditure, regional reach, recap); Funding Acquittal (adds a cover, pillar overview, outcome data, estimated value and sign-off); Annual Report Chapter; Community Story; Media Release. Every number comes from steps 1 to 7, and a missing figure shows "NO DATA".']],
        'Dashboard > Insights; Story.', 'A likely cause is what the data points to, not proof.'],
    ];
  }
  const CONCLUSION = 'List the Legacy money, place it, count who it reached, value the three impacts with published methods, check the KPIs and the evidence, then recommend and report with the working shown. Every figure NSW Rugby publishes about the Legacy Program then traces back to the $10M and can be recalculated by hand.';

  // ---------- the document (shared by the tab and the HTML download) ----------
  function specHtml(print) {
    const p = P(), calcs = window.Methods.CALCS, steps = STEPS(), R = D.frameworks['R4G-CBA'];
    const list = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const stepCard = ([id, title, q, need, calc, shows, check], n) => `<section class="fw-step" id="${id}">
        <h3><span class="fw-n">${n + 1}</span>${esc(title)}</h3><p class="fw-q">${esc(q)}</p>
        <dl><dt>Data you need</dt><dd>${list(need)}</dd>
          <dt>How to calculate</dt><dd>${table(['Figure', 'Rule'], calc.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}</dd>
          <dt>In Tackle AI</dt><dd>${esc(shows)}</dd>
          <dt>Check</dt><dd>${esc(check)}</dd></dl></section>`;
    const kpiSpec = k => `<section class="fw-kpi" id="fw-${k.id}">
      <h4>${esc(k.id)} · ${esc(k.name)}</h4>
      <p class="small"><b>${esc(k.dim)}</b> · ${esc(k.pillar)} · ${esc(STATE[k.state])} · readiness ${esc(k.readiness)} · ${esc(k.tier)}</p>
      <p><b>Definition.</b> ${esc(k.definition)}</p>
      <p><b>Formula.</b> <code>${esc(k.formula)}</code></p>
      ${k.inputs.length ? `<p><b>Inputs</b> (per ${esc(k.waves.join(' / ').toLowerCase() || 'submission')}, plus the shared controls)</p>
        ${table(['Field', 'Meaning', 'Type', 'Unit', 'Required'], k.inputs.map(([key, label, type, unit, req, help]) => [`<code>${esc(key)}</code>`, `${esc(label)}<br><span class="muted small">${esc(help || '')}</span>`, esc(TYPE(type)), esc(unit || ''), esc(REQ(req))]))}` : ''}
      <p><b>Missing data and zero denominators.</b> ${esc(k.rules)}</p>
      ${k.question ? `<p><b>Survey question (use exactly).</b> ${esc(k.question)}</p>` : ''}
      <p><b>Baseline.</b> ${esc(k.baseline[0])}. ${esc(k.baseline[1])}</p>
      <p><b>Source:</b> ${esc(k.source)} · <b>Limitations.</b> ${esc(k.limitations)}</p>
    </section>`;
    const matrix = table(['Pillar', ...DIMS], PILLARS.map(([pl, name]) => [`<b>${pl}</b> ${esc(name)}`,
      ...DIMS.map(d => KF.KPIS.filter(k => k.dim === d && primaryPillar(k) === pl).map(k => `<a href="#fw-${k.id}" class="${k.state === 'inactive' ? 'muted' : ''}">${k.id}</a>`).join(', ') || '<span class="muted">—</span>')]));

    return `
      <section class="fw-section" id="fw-about"><h2>1. What this framework is</h2>
        <p>A step-by-step method for measuring the economic, social and cultural impact of NSW Rugby's $10M Rugby World Cup Legacy Program. Every figure starts from Legacy money or from people reached by Legacy-funded work.</p>
        <p><b>To reproduce it</b> you need a spreadsheet, the tracking tools in section 7 and the values and formulas in sections 4 and 5. Work through the eight steps in order: each step uses the results of the steps before it. Tackle AI is one way to run it; it can equally be built in Excel, a survey platform or a BI dashboard. It follows NSW Treasury guidelines (TPG22-22 evaluation, TPG23-08 cost-benefit analysis) and methods published by other sports.</p>
        <h3>NSW Rugby's five deliverables, and where each is answered</h3>
        ${table(['Deliverable', 'What NSW Rugby asked for', 'What this framework provides', 'Section'], DELIVERABLES.map(([d, ask, ours, id], n) => [`<b>${n + 1}. ${esc(d)}</b>`, esc(ask), esc(ours), `<a href="#${id}">${esc(id === 'fw-steps' ? 'Section 3 and the tool' : ({ 'fw-formulas': 'Section 5', 'fw-value': 'Section 4', 'fw-baseline': 'Section 6', 'fw-tools': 'Section 7' })[id])}</a>`]))}
        <h3>The eight steps</h3>
        <ol class="fw-flow">${steps.map(([id, title, q], n) => `<li><span class="fw-n">${n + 1}</span><div><b><a href="#${id}">${esc(title)}</a></b><p>${esc(q)}</p></div></li>`).join('')}</ol>
        <p class="fw-loop">↻ Repeat every reporting season</p>
        <div class="fw-conclusion"><b>In one sentence.</b> ${esc(CONCLUSION)}</div>
        <p class="muted small">Generated from the live definitions on ${new Date().toLocaleDateString('en-AU')}.</p>
      </section>
      <section class="fw-section" id="fw-principles"><h2>2. Rules</h2>
        ${table(['Rule', 'What it means'], PRINCIPLES.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}
      </section>
      <section class="fw-section" id="fw-steps"><h2>3. The eight steps</h2>
        ${steps.map(stepCard).join('')}
      </section>
      <section class="fw-section" id="fw-value"><h2>4. The value of our impact</h2>
        <p>Each impact is valued in a clear unit: <b>dollars</b>, <b>physical activity hours</b> or <b>quality of life</b>. The scoring method is the same for all of them:</p>
        <div class="fw-conclusion"><b>Value = a Legacy-attributable quantity × an independent standard value.</b> The quantity comes from Legacy data (money, people reached, sessions, survey answers); the standard value comes from a government data bank or a benchmarked method. Every value is labelled <i>measured</i> or <i>needs data</i>, shown per $1 of Legacy money where it is in dollars, and never added to the others. A number always says what it is a share of and what it is based on.</div>
        ${table(['Impact', 'Measure', 'Unit', 'How it is valued', 'Standard value or method', 'Data needed'], VALUE_SCORECARD.map(([i, m, u, h, s, d]) => [`<b>${esc(i)}</b>`, esc(m), esc(u), esc(h), esc(s), esc(d)]))}
        <h3>Standard values from independent data banks</h3>
        <p>NSW Treasury's Evidence Bank (2026) points to the Outcomes Values Database and the DCJ Benefits Database as the standard sources of values for NSW cost-benefit analysis. These are the values this framework uses to monetise social outcomes:</p>
        ${table(['Outcome', 'Value', 'Unit', 'Source', 'Price year'], STANDARD_VALUES.map(([o, v, u, s, y]) => [esc(o), `<b>${esc(v)}</b>`, esc(u), esc(s), esc(y)]))}
        <p class="muted small">To value a health outcome, the number of participants who avoid it because they take part is needed; that share must come from published research or Legacy survey results, never from a guess. Until then the outcome is shown as "needs data". Values are escalated to the current year with CPI, as the DCJ database does.</p>
      </section>
      <section class="fw-section" id="fw-formulas"><h2>5. Formula sheet</h2>
        <p>Every formula used, where it comes from, and why. Published methods are used unchanged; anything adapted or created states its reason, so a reviewer can challenge or replace it.</p>
        <h3>Frameworks benchmarked</h3>
        ${table(['Framework', 'Where from', 'What it measures', 'How this framework uses it'], BENCHMARKS.map(([a, b, c, d]) => [`<b>${esc(a)}</b>`, esc(b), esc(c), esc(d)]))}
        <h3>NSW Treasury compliance</h3>
        ${table(['Requirement', 'How it is met'], COMPLIANCE.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}
        <h3>Published methods, used unchanged</h3>
        ${table(['Method', 'Formula', 'Source', 'Caveat'], calcs.map(c => [`<b>${esc(c.name)}</b>`, `<code>${esc(c.formula)}</code>`, esc(c.frameworks.map(id => D.frameworks[id].org + ', ' + D.frameworks[id].title).join('; ')), esc(c.caveat)]))}
        <h3>Published parameters</h3>
        <p><b>NSW Rugby League 2026 spending categories</b> (economic contribution, step 4). Participant spending is first reduced by ${p.SUBSTITUTION * 100}% for substitution.</p>
        ${table(['Category', 'Share kept in NSW', 'Multiplier'], [...p.ORG_CATS, ...p.PART_CATS].map(([, n, r, m]) => [esc(n), `${Math.round(r * 100)}%`, String(m)]))}
        <p><b>ABS General Social Survey benchmarks</b> (social capital, step 4; as reported in NSWRL 2026).</p>
        ${table(['Question', 'Sport participants', 'General population', 'Better when'], p.GSS.map(([, q, s, g, up]) => [esc(q), `${s}%`, `${g}%`, up ? 'Higher' : 'Lower']))}
        <p><b>Social value of weekly participation</b> (step 4): $${p.CLUB.value.toLocaleString('en-AU')} per participant a year for playing community club sport once a week (Australian Sports Commission & Griffith Business School ${p.CLUB.year}), and $${p.VOL_RATE.toFixed(2)} per volunteer hour ($3 billion ÷ 158 million hours, BCG for the ASC 2017), both from the Clearinghouse for Sport. These replaced the Rugby For Good per-person values after NSW Rugby asked for other programs' methods only, never their figures.</p>
        <p><b>Present values</b> in the calculators follow NSW Treasury TPG23-08: 5% real discount rate, tested at 3% and 7%.</p>
        <h3>Adapted from a published method</h3>
        ${table(['Formula', 'How it works', 'Adapted from', 'Past research', 'Why', 'Limit'], ADAPTED.map(([a, f, s, w, l]) => [`<b>${esc(a)}</b>`, esc(f), esc(s), researchCell(a), esc(w), esc(l)]))}
        <h3>Created by this project (no published method found)</h3>
        ${table(['Formula', 'How it works', 'What we looked for', 'Past research', 'Why', 'Limit'], CREATED.map(([a, f, s, w, l]) => [`<b>${esc(a)}</b>`, esc(f), esc(s), researchCell(a), esc(w), esc(l)]))}
        <p class="muted small">"None found" means our searches did not find one, not that none exists. All of these wait for review by the evaluation team; a published method should replace any of them when one turns up. KPI formulas belong to the evaluation team and are in Appendix A.</p>
      </section>
      <section class="fw-section" id="fw-baseline"><h2>6. Baseline register</h2>
        <p>The starting point to compare against after Legacy funding, recorded before the 2027 Rugby World Cup peak. Rugby-wide figures are context for the program; each funded project also records its own baseline when it starts (the first wave of the Legacy lines template). Download: Baseline register (CSV).</p>
        ${table(['Measure', 'Baseline', 'Latest', 'Source'], baseline())}
        ${window.AusPlay?.data ? `<h3>What the independent AusPlay survey adds</h3><p>AusPlay (Australian Sports Commission, via the Clearinghouse for Sport) surveys the population, so it counts everyone who played, not only registered players. It is state-wide context for the Legacy Program, never Legacy impact by itself. Figures with a margin of error of 50% or more are flagged as AusPlay advises.</p>
        ${table(['Finding', 'What the data shows', 'What it means for the Legacy Program'], window.AusPlay.findings().map(([a, b, c]) => [`<b>${esc(a)}</b>`, esc(b), esc(c)]))}` : window.AusPlay?.failed ? `<p class="muted small">AusPlay file not read: ${esc(window.AusPlay.failed)}</p>` : ''}
      </section>
      <section class="fw-section" id="fw-tools"><h2>7. Tracking tools</h2>
        <p>Most Legacy events have not run yet. These tools make sure every event produces the numbers the value scorecard needs. All four are in the Download menu.</p>
        <h3>Post-event survey</h3>
        ${table(['Question (use exactly)', 'Answer', 'What it feeds'], SURVEY.map(([q, a, w]) => [esc(q), esc(a), esc(w)]))}
        <h3>Attendance sheet</h3>
        ${table(['Column', 'Meaning', 'Example'], ATTENDANCE.map(([c, m, e]) => [`<code>${esc(c)}</code>`, esc(m), esc(e)]))}
        <h3>Post-event follow-up script</h3>
        ${table(['When', 'Who', 'What to do or say'], FOLLOWUP.map(([w, who, what]) => [`<b>${esc(w)}</b>`, esc(who), esc(what)]))}
        <h3>Legacy lines template</h3>
        <p><b>The Legacy lines template</b>: one row per grant or budget line (Download > Legacy lines template). Leave a cell blank when a figure is not reported; never type 0 for "unknown".</p>
        ${table(['Field', 'Meaning', 'Example', 'Step'], LINE_FIELDS.map(([f, m, e, s]) => [`<code>${esc(f)}</code>`, esc(m), esc(e), String(s)]))}
        <p><b>Other data</b></p>
        ${list(['Rugby Analytics exports each year (participants, churn, coaches, heritage, age groups): steps 4 and 7.', 'The rugby zone mapping (Dataset/round2-zones.csv): step 7.', 'Surveys with the exact wording above: life satisfaction (step 3); optionally eventIMPACTS, ABS General Social Survey and CDN outcomes (step 4).', 'KPI inputs, submitted as waves (Download > KPI input fields): step 5.', 'Field evidence, public stories and daily figures for the match-day check: step 6.'])}
        <p><b>Who looks after it</b></p>
        ${table(['Practice', 'How'], GOVERNANCE.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))}
      </section>
      <section class="fw-section" id="fw-sources"><h2>8. Sources and past research</h2>
        ${table(['Organisation', 'Document', 'Used for'], Object.entries(D.frameworks).filter(([id]) => id !== 'R4G-CBA').map(([, f]) => [esc(f.org), f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.title)}</a> (${f.year})` : `${esc(f.title)} (${f.year}; Dataset/${esc(f.file)})`, esc(f.use)]))}
        <div class="fw-separate"><h3>Rugby For Good: a separate program</h3>
          <p>Rugby For Good is a different NSW Rugby program with its own funding. This framework does not measure it: none of its participants, results or dollar values count towards the Legacy Program.</p>
          ${table(['', 'Rugby For Good'], [
            ['What is borrowed', `Nothing. Its cost-benefit study (${esc(R.org)}, ${R.year}; Dataset/${esc(R.file)}) was shared as an example of how another program measured impact. Its per-person values were used in an earlier version and have been replaced by Australian Sports Commission values, because NSW Rugby asked for other programs' methods only, never their figures.`],
            ['What is not counted', 'Its participants, program results, benefit-cost ratio and fundraising targets.'],
            ['Legacy money in Rugby For Good roles', 'Legacy budget lines that pay for Rugby For Good roles or activities (for example in the Hunter) are Legacy spending, so they count as Legacy allocations. What those roles achieve counts only when it is reported for the Legacy line.'],
          ])}</div>
        <h3>Past research behind the values</h3>
        <p>Where each value comes from, and how far we checked it. The evaluation team should read the originals before these values are relied on in reports.</p>
        ${table(['Research', 'What it found', 'How it is used here', 'How we checked it'], RESEARCH.map(([, cite, found, used, checked, url]) => [url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(cite)}</a>` : esc(cite), esc(found), esc(used), esc(checked)]))}
      </section>
      <section class="fw-section" id="fw-kpis"><h2>Appendix A. The evaluation team's KPIs</h2>
        <p>${KF.KPIS.length} KPIs from ${esc(KF.SOURCE_FILE)} (NSW Rugby evaluation team), used in step 5: ${Object.entries(STATE).map(([s, l]) => `${KF.KPIS.filter(k => k.state === s).length} ${l.toLowerCase()}`).join(' · ')}.</p>
        <details class="fw-appendix"${print ? ' open' : ''}><summary>Show the KPI specification (inputs, statuses, every KPI)</summary>
          <h3>KPIs by pillar and impact</h3><p class="muted small">Primary pillar of each KPI; greyed IDs are inactive.</p>${matrix}
          <h3>Shared controls on every wave</h3>
          <p>A wave is one submission for one period: a baseline and a follow-up, a cohort pair, or one matched submission, depending on the KPI. Only checked totals are submitted: no names, IDs or individual answers.</p>
          ${table(['Field', 'Meaning', 'Type', 'Required'], KF.META.map(([key, label, type, help]) => [`<code>${esc(key)}</code>`, `${esc(label)}<br><span class="muted small">${esc(help)}</span>`, esc(TYPE(type)), KF.META_REQUIRED.includes(key) ? 'Required' : 'Optional']))}
          <p>Per KPI, one extra control: <code>comparison_approved</code> (Yes / No), required before a change between two waves is shown.</p>
          <h3>Result statuses</h3>
          <p>Every result has exactly one status. Checks run in this order: invalid values, missing values, source checks, verification, permission, capture, then the KPI formula.</p>
          ${table(['Status', 'When'], STATUS_MODEL.map(([s, w]) => [`<b>${esc(s)}</b>`, esc(w)]))}
          <h3>Every KPI</h3>
          ${table(['ID', 'KPI', 'Impact', 'Primary pillar', 'Status'], KF.KPIS.map(k => [`<a href="#fw-${k.id}">${k.id}</a>`, esc(k.name), k.dim, primaryPillar(k), esc(STATE[k.state])]))}
          ${DIMS.map(d => `<h4>${d} KPIs</h4>${KF.KPIS.filter(k => k.dim === d).map(kpiSpec).join('')}`).join('')}
        </details>
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
  const csv = rows => { const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`; return rows.map(r => r.map(q).join(',')).join('\r\n'); };

  function specJson() {
    const p = P();
    return JSON.stringify({
      name: 'NSW Rugby RWC Legacy Impact Framework', generated: new Date().toISOString(),
      rules: PRINCIPLES.map(([name, rule]) => ({ name, rule })),
      steps: STEPS().map(([id, title, question, dataNeeded, calc, inTackleAi, check], n) => ({ order: n + 1, id, title, question, dataNeeded, calculate: calc.map(([figure, rule]) => ({ figure, rule })), inTackleAi, check })),
      formulas: {
        published: window.Methods.CALCS.map(c => ({ name: c.name, formula: c.formula, sources: c.frameworks.map(id => D.frameworks[id].title), caveat: c.caveat })),
        parameters: { nswrlCategories: [...p.ORG_CATS, ...p.PART_CATS].map(([key, category, keptInNsw, multiplier]) => ({ key, category, keptInNsw, multiplier })), participantSubstitution: p.SUBSTITUTION,
          absGssBenchmarks: p.GSS.map(([key, question, sportParticipants, generalPopulation, higherIsBetter]) => ({ key, question, sportParticipants, generalPopulation, higherIsBetter })),
          socialValue: { perWeeklyParticipantPerYear: p.CLUB.value, priceYear: p.CLUB.year, source: 'Australian Sports Commission & Griffith Business School 2018', perVolunteerHour: +p.VOL_RATE.toFixed(2), volunteerSource: 'BCG for the ASC 2017 ($3bn ÷ 158m hours)' }, discountRates: [0.05, 0.03, 0.07] },
        adapted: ADAPTED.map(([name, formula, adaptedFrom, reason, limit]) => ({ name, formula, adaptedFrom, research: RESEARCH_FOR[name] || [], reason, limit })),
        created: CREATED.map(([name, formula, searchedFor, reason, limit]) => ({ name, formula, searchedFor, research: RESEARCH_FOR[name] || [], reason, limit })),
      },
      deliverables: DELIVERABLES.map(([deliverable, asked, provided, section]) => ({ deliverable, asked, provided, section })),
      benchmarks: BENCHMARKS.map(([framework, from, measures, use]) => ({ framework, from, measures, use })),
      treasuryCompliance: COMPLIANCE.map(([requirement, how]) => ({ requirement, how })),
      valueScorecard: VALUE_SCORECARD.map(([impact, measure, unit, how, standard, data]) => ({ impact, measure, unit, how, standard, data })),
      standardValues: STANDARD_VALUES.map(([outcome, value, unit, source, priceYear]) => ({ outcome, value, unit, source, priceYear })),
      baseline: baseline().map(([measure, base, latest, source]) => ({ measure, baseline: base, latest, source })),
      trackingTools: { survey: SURVEY.map(([question, answer, feeds]) => ({ question, answer, feeds })), attendance: ATTENDANCE.map(([column, meaning, example]) => ({ column, meaning, example })), followUp: FOLLOWUP.map(([when, who, what]) => ({ when, who, what })) },
      legacyLinesTemplate: LINE_FIELDS.map(([field, meaning, example, step]) => ({ field, meaning, example, step })),
      governance: GOVERNANCE.map(([practice, how]) => ({ practice, how })),
      sources: Object.entries(D.frameworks).map(([id, f]) => ({ id, ...f, separateProgram: id === 'R4G-CBA' || undefined })),
      pastResearch: RESEARCH.map(([id, citation, found, usedFor, howChecked, url]) => ({ id, citation, found, usedFor, howChecked, url: url || null })),
      kpis: {
        source: KF.SOURCE_FILE,
        sharedControls: KF.META.map(([key, label, type, help]) => ({ key, label, type, required: KF.META_REQUIRED.includes(key), help })),
        perKpiControls: [{ key: 'comparison_approved', type: 'bool', requiredFor: 'change between waves' }],
        statuses: STATUS_MODEL.map(([status, when]) => ({ status, when })),
        list: KF.KPIS.map(k => ({ id: k.id, name: k.name, dimension: k.dim, pillar: k.pillar, state: k.state, definition: k.definition, formula: k.formula, waves: k.waves,
          inputs: k.inputs.map(([key, label, type, unit, req, help]) => ({ key, label, type, unit, required: REQ(req), help })), outputUnit: k.unit, missingAndZeroRules: k.rules,
          question: k.question || null, baseline: { type: k.baseline[0], definition: k.baseline[1] }, source: k.source, limitations: k.limitations })),
      },
      conclusion: CONCLUSION,
    }, null, 2);
  }

  // A blank template to fill in, with one example row.
  const linesCsv = () => csv([LINE_FIELDS.map(f => f[0]), LINE_FIELDS.map(f => f[2])]);
  const surveyCsv = () => csv([['question', 'answer_format', 'feeds'], ...SURVEY]);
  const attendanceCsv = () => csv([ATTENDANCE.map(a => a[0]), ATTENDANCE.map(a => a[2])]);
  const followupText = () => ['Post-event follow-up script (NSW Rugby World Cup Legacy Program)', '', ...FOLLOWUP.map(([w, who, what]) => `${w} | ${who}\n  ${what}\n`)].join('\n');
  const baselineCsv = () => csv([['measure', 'baseline', 'latest', 'source'], ...baseline()]);

  function inputCsv() {
    const rows = [['kpi_id', 'kpi_name', 'dimension', 'state', 'field', 'label', 'type', 'unit', 'required', 'help']];
    for (const [key, label, type, help] of KF.META) rows.push(['ALL', 'Shared controls (every wave)', '', '', key, label, TYPE(type), '', KF.META_REQUIRED.includes(key) ? 'Required' : 'Optional', help]);
    for (const k of KF.KPIS) {
      if (!k.inputs.length) rows.push([k.id, k.name, k.dim, k.state, '', 'No inputs: ' + STATE[k.state], '', '', '', '']);
      for (const [key, label, type, unit, req, help] of k.inputs) rows.push([k.id, k.name, k.dim, k.state, key, label, TYPE(type), unit, REQ(req), help]);
    }
    return csv(rows);
  }

  function standaloneHtml() {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NSW Rugby Impact Framework</title>
      <style>body{font:15px/1.5 system-ui,sans-serif;color:#111;max-width:1000px;margin:24px auto;padding:0 16px}h1{margin:0 0 4px}h2{margin-top:32px;border-bottom:2px solid #0b6b73;padding-bottom:4px}
      table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eef4f5}
      code{background:#f2f2f2;padding:1px 4px;border-radius:3px;font-size:12px;white-space:normal}.muted{color:#666}.small{font-size:12px}.fw-kpi{border:1px solid #ddd;border-radius:6px;padding:8px 12px;margin:10px 0;break-inside:avoid}
      a{color:#0b6b73}@media print{body{margin:0}h2{break-after:avoid}}
      .fw-flow{list-style:none;padding:0;margin:12px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:22px 26px}
      .fw-flow li{position:relative;display:flex;gap:8px;border:1px solid #0b6b73;border-radius:6px;padding:10px;break-inside:avoid}
      .fw-flow li:not(:last-child)::after{content:"→";position:absolute;right:-21px;top:50%;transform:translateY(-50%);color:#0b6b73;font-weight:700}
      .fw-n{flex:none;width:24px;height:24px;border-radius:50%;background:#0b6b73;color:#fff;display:inline-grid;place-items:center;font-weight:700;font-size:13px;margin-right:8px}
      .fw-flow p{margin:2px 0 4px;font-size:13px}.fw-loop{text-align:center;color:#0b6b73;font-weight:600}
      .fw-conclusion{border-left:4px solid #0b6b73;background:#eef4f5;padding:10px 14px;border-radius:0 6px 6px 0}
      .fw-step{border:1px solid #ccc;border-radius:6px;padding:8px 14px;margin:14px 0;break-inside:avoid}.fw-step h3{display:flex;align-items:center;margin:4px 0 0}.fw-q{margin:2px 0 8px;color:#555;font-style:italic}
      .fw-step dl{display:grid;grid-template-columns:130px 1fr;gap:6px 12px;margin:0}.fw-step dt{font-weight:600}.fw-step dd{margin:0}.fw-step ul{margin:0;padding-left:18px}
      .fw-separate{border:1px dashed #999;border-radius:6px;padding:4px 14px 10px;margin-top:14px}summary{font-weight:600;cursor:pointer}</style></head>
      <body><h1>NSW Rugby RWC Legacy Impact Framework</h1><p class="muted">Eight steps to measure the impact of the $10M Legacy Program, in any tool. Produced from Tackle AI.</p>${specHtml(true)}</body></html>`;
  }

  // ---------- "How to use this framework" guide: one stop per step ----------
  // [title, what to do (HTML list items), you'll need, section].
  const guideList = () => [
    ['Start here', ['Section 1 shows the eight steps and the question each one answers.', 'Agree the rules in section 2 with your team, especially <b>a blank is never a zero</b> and <b>count Legacy-funded work only</b>.', 'Download the <b>Legacy lines template</b> (Download menu) and start one row per grant or budget line.'], 'A spreadsheet and the Round 1 grant lists.', 'fw-about'],
    ...STEPS().map(([id, title, q, need, calc, , check]) => [title, [`<i>${esc(q)}</i>`, ...calc.slice(0, 3).map(([a, b]) => `<b>${esc(a)}:</b> ${esc(b)}`), `<b>Check:</b> ${esc(check)}`], need[0], id]),
  ];
  let GUIDE = [];
  let gi = 0, dlg = null;
  function guideDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'fw-guide';
    dlg.setAttribute('aria-label', 'How to use this framework');
    document.body.append(dlg);
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); // click outside closes
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); guideGo(gi + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); guideGo(gi - 1); }
    });
    return dlg;
  }
  function guideGo(n) {
    if (!GUIDE.length) GUIDE = guideList();
    gi = Math.max(0, Math.min(n, GUIDE.length - 1));
    const [title, todo, need, sec] = GUIDE[gi], d = guideDialog();
    const secTitle = $(`#${sec} h2, #${sec} h3`)?.textContent || '';
    d.innerHTML = `<div class="fwg-top"><span class="demo-badge">Step ${gi + 1} of ${GUIDE.length}</span><button class="demo-x" data-g="close" aria-label="Close guide">×</button></div>
      <h3>${esc(title)}</h3>
      <ol class="fwg-todo">${todo.map(t => `<li>${t}</li>`).join('')}</ol>
      <p class="fwg-need"><b>You'll need:</b> ${esc(need)}</p>
      <button class="btn" data-g="show">Show me ${esc(secTitle ? `"${secTitle.replace(/^\d+\.\s*/, '')}"` : 'this section')} →</button>
      <div class="demo-dots">${GUIDE.map((g, k) => `<button class="${k === gi ? 'on' : k < gi ? 'seen' : ''}" data-n="${k}" title="${esc(g[0])}" aria-label="Step ${k + 1}: ${esc(g[0])}"></button>`).join('')}</div>
      <div class="demo-nav"><button class="btn" data-g="back" ${gi === 0 ? 'disabled' : ''}>Back</button><button class="btn primary" data-g="next">${gi === GUIDE.length - 1 ? 'Done' : 'Next'}</button></div>`;
    d.querySelector('[data-g="close"]').onclick = () => d.close();
    d.querySelector('[data-g="back"]').onclick = () => guideGo(gi - 1);
    d.querySelector('[data-g="next"]').onclick = () => gi === GUIDE.length - 1 ? d.close() : guideGo(gi + 1);
    d.querySelector('[data-g="show"]').onclick = () => showSection(sec);
    d.querySelectorAll('.demo-dots button').forEach(b => b.onclick = () => guideGo(Number(b.dataset.n)));
    if (!d.open) d.showModal();
    d.querySelector('[data-g="next"]').focus();
  }
  // Close the guide, jump to a section and flash it; a small bar lets the reader return to the same step.
  function showSection(id) {
    dlg?.close();
    const el = $('#' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('fw-flash'); void el.offsetWidth; el.classList.add('fw-flash');
    const bar = $('#fwGuideReturn');
    bar.hidden = false;
    bar.querySelector('span').textContent = `Guide step ${gi + 1} of ${GUIDE.length}: ${GUIDE[gi][0]}`;
  }

  // ---------- tab ----------
  function render() {
    const host = $('#framework');
    if (!host) return;
    GUIDE = guideList();
    const toc = [['fw-about', 'Overview'], ['fw-principles', 'Rules'], ['fw-steps', 'Eight steps'], ['fw-value', 'Value of impact'], ['fw-formulas', 'Formula sheet'], ['fw-baseline', 'Baseline'], ['fw-tools', 'Tracking tools'], ['fw-sources', 'Sources'], ['fw-kpis', 'Appendix: KPIs']];
    host.innerHTML = `<div class="fw-start"><div><b>New to the framework?</b> Follow the ${GUIDE.length}-stop guide: one stop per step, with what to collect, what to calculate and how to check it.</div><button class="btn primary" data-fw-guide>Start the guide</button></div>
      <div class="fw-return" id="fwGuideReturn" hidden><span></span><button class="btn" data-fw-guide-back>Back to the guide</button></div>
      <nav class="method-toc">${toc.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav><article class="card fw-doc">${specHtml(false)}</article>`;
    host.querySelector('[data-fw-guide]').onclick = () => guideGo(0);
    host.querySelector('[data-fw-guide-back]').onclick = () => guideGo(gi);
    // Links into the KPI appendix open it first.
    host.querySelectorAll('a[href^="#fw-"]').forEach(a => a.addEventListener('click', () => {
      const t = host.querySelector(a.getAttribute('href')); if (t?.closest('details')) t.closest('details').open = true;
    }));
  }

  document.addEventListener('app-ready', () => {
    $('#fwGuideBtn')?.addEventListener('click', () => guideGo(0));
    $('#fwHtml')?.addEventListener('click', () => download('nsw-rugby-impact-framework.html', 'text/html', standaloneHtml()));
    $('#fwJson')?.addEventListener('click', () => download('framework.json', 'application/json', specJson()));
    $('#fwLines')?.addEventListener('click', () => download('legacy-lines-template.csv', 'text/csv', linesCsv()));
    $('#fwCsv')?.addEventListener('click', () => download('kpi-input-fields.csv', 'text/csv', inputCsv()));
    $('#fwSurvey')?.addEventListener('click', () => download('post-event-survey.csv', 'text/csv', surveyCsv()));
    $('#fwAttend')?.addEventListener('click', () => download('attendance-sheet.csv', 'text/csv', attendanceCsv()));
    $('#fwFollow')?.addEventListener('click', () => download('post-event-follow-up-script.txt', 'text/plain', followupText()));
    $('#fwBaseline')?.addEventListener('click', () => download('baseline-register.csv', 'text/csv', baselineCsv()));
    render();
  });
  document.addEventListener('tab', e => { if (e.detail === 'framework') render(); });
  document.addEventListener('ausplay-ready', () => render());

  window.Framework = { render, specHtml, specJson, inputCsv, linesCsv, guide: guideGo, RESEARCH, STEPS, baseline, VALUE_SCORECARD, STANDARD_VALUES };
})();
