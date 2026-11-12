// Presentation mode: the 20-minute Final Pitch Presentation (CDEV6000 Assessment 2), run inside the live app, styled on
// Team 1's Project Plan deck (Presentation/…Project_Presentation….pdf): navy cover and close, light content slides with a
// red section tag, a presenter pill and the Team 1 footer.
// Follows the assessment headings (1 Introduction … 6 Conclusion, Reference List, untimed Appendix) and centres the
// solution on NSW Rugby's five project deliverables (frameworks, metrics and monetisation, baseline, tracking tools,
// dashboard) and the partner feedback on impact values and formula sources.
// Figures come from the app's live data, never from Demo view's dummy file. Every slide has a default presenter so each
// member presents a third; names and roles are editable (Team slide > Edit team) and kept in this browser.
// Start with ▶ Present (top bar) or ?present (?present=N opens at slide N). Keys: → / Enter next, ← back, P pause, N notes, Esc exit.
(() => {
  const { $, $$, esc, toast } = window.App;
  const A = window.Analytics, D = window.TACKLE_DATA;
  const BUDGET = 15 * 60, KEY = 'tackle.present.v2', IMG = 'img/present/';
  const FOOT = 'CDEV6000 · RWC Legacy Impact Framework · Team 1';
  // Team 1, as in the Project Plan presentation.
  // As in the Template-Based Presentation (Presentation/Template-Based Presentation.pdf).
  const TEAM = [
    { name: 'Yinnan Hu', role: 'Documentation & logistics', note: 'Master of Commerce (Marketing Analytics)', brings: 'Structures our documents, meetings and partner communication so findings are clear and usable.', photo: 'yinnan.jpg' },
    { name: 'Xiao Yang', role: 'Data researcher', note: 'Master of Public Relations and Advertising', brings: 'Reviews evidence, benchmarks frameworks and designs pillar-level indicators and baselines.', photo: 'xiao.jpg' },
    { name: 'Bintang', role: 'Team lead & software engineer', note: 'Master of IT (Cybersecurity Eng.)', brings: 'Software engineering and project management background; builds the data pipeline and prototype with privacy by design.', photo: 'bintang.jpg' },
  ];
  const cfg = () => { try { const c = JSON.parse(localStorage.getItem(KEY) || '{}'); return { team: c.team?.length ? c.team : TEAM, url: c.url || '' }; } catch { return { team: TEAM, url: '' }; } };
  const saveCfg = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };

  // ---------- live figures (real data only) ----------
  const M = v => v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;
  const N = v => Math.round(v).toLocaleString('en-AU');
  const live = () => {
    const c = A.centralisation(), funding = D.context.totalLegacyFunding, grants = A.allGrants();
    const lens = l => window.DemoView?.on ? [] : (window.Methods?.lensValues?.(l) || []).filter(([, v]) => !/DUMMY|Needs data|Not in dollars/.test(v));
    const sig = Store.get('signals') || {}, items = sig.items || [];
    const rel = it => window.Signals?.relate(it) || { level: 'nsw' };
    const zones = (window.Round2?.zones?.list || []).filter(z => z.name);
    return { funding, known: c.knownTotal, untraced: funding - c.knownTotal, share: c.knownTotal / funding, grants: grants.length,
      towns: new Set(grants.map(g => g.town).filter(Boolean)).size, regions: new Set(grants.map(g => g.region).filter(Boolean)).size,
      econ: lens('economic')[0], cult: lens('cultural')[0], stories: items.length, linked: items.filter(it => it.ai?.relevant !== false && rel(it).level !== 'nsw').length,
      zones, fall: zones.filter(z => z.growth < 0).sort((a, b) => a.growth - b.growth) };
  };
  // Baselines from the uploaded Rugby Analytics series and the plan's own figures.
  function baselines() {
    const ms = A.measures(), first = s => { const y = Object.keys(s || {}).map(Number).filter(Number.isFinite).sort(); return y.length ? [y[0], s[y[0]], y[y.length - 1], s[y[y.length - 1]]] : null; };
    const row = (label, key, src) => { const f = first(ms[key]?.series); return f ? [label, `${N(f[1])} (${f[0]})`, `${N(f[3])} (${f[2]})`, src] : [label, '–', '–', src]; };
    const kt = id => A.kpiTargets().find(k => k.id === id);
    const ratio = (label, id) => { const k = kt(id); return [label, k?.baseline != null ? `${k.baseline}:1 (${k.baseYear || 'plan'})` : '–', k?.actual != null ? `${(+k.actual).toFixed(1)}:1` : '–', 'Plan baseline; latest from Rugby Analytics']; };
    return [row('Players', 'players', 'Rugby Analytics'), row('Coaches', 'coaches', 'Rugby Analytics'), row('Match officials', 'matchOfficials', 'Rugby Analytics'),
      row('Female participants', 'femaleParticipants', 'Rugby Analytics'), row('First Nations participants', 'firstNationsParticipants', 'Rugby Analytics (heritage)'), row('Pasifika participants', 'pasifikaParticipants', 'Rugby Analytics (heritage)'),
      ratio('Players per coach', 'coachRatio'), ratio('Players per match official', 'moRatio'),
      ['Clubs meeting a club standard', '241 of 307 clubs (45 Silver, 196 Bronze)', 'next check', 'NSW Rugby club list (2026)'],
      ['Facilities with female-friendly changerooms', `${D.context.facilityAudit.femaleChangerooms}%`, 'next audit', 'Rugby Australia facility audit'],
      ...(window.AusPlay?.baselineRows() || []).slice(0, 3).map(([m, b, l, s]) => [m, b, l, 'AusPlay NSW 2025–26'])];
  }

  // ---------- slide parts ----------
  const ph = t => `<span class="ph">[${esc(t)}]</span>`;
  const so = t => `<div class="pt-key"><b>What it means</b> ${t}</div>`;
  const spec = t => `<p class="pt-spec"><b>For specialists:</b> ${t}</p>`;
  const src = t => `<p class="pt-src">Sources: ${t}</p>`;
  const ul = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const cards = (list, cls = 'pt-g3') => `<div class="${cls}">${list.map(([h, b]) => `<div class="pt-card"><h4>${h}</h4><div>${b}</div></div>`).join('')}</div>`;
  const table = (head, rows, cls = '') => `<table class="pt-table ${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  // ---------- the slides ----------
  // sec: assessment heading; tag: the red section label; by: default presenter (0 Xiao, 1 Yinnan, 2 Bintang); secs: time.
  const SECTIONS = { intro: '1. Introduction', problem: '2. Problem context', stake: '3. Stakeholder engagement', solution: '4. Solution development', impl: '5. Implementation', close: '6. Conclusion', refs: 'Reference list', appendix: '7. Appendix' };
  const SLIDES = [
    { sec: 'intro', by: 2, secs: 15, kind: 'cover', title: 'Measuring the Legacy', notes: 'Welcome NSW Rugby. Tackle AI is the working name of the tool; the framework is "Measuring the Legacy". Say we will end by asking for your feedback, because we finalise the deliverable after today. Present with Demo view off, so every figure is real.' },
    { sec: 'intro', by: 2, secs: 20, kind: 'aoc', title: 'Acknowledgement of Country', notes: 'Read the acknowledgement slowly.' },
    { sec: 'intro', by: 2, secs: 20, tag: 'Team member profiles', title: 'Three complementary skill sets, one team', team: true, body: () => { const c = cfg(), parts = ['Presents the Framework page', 'Presents the Story page', 'Presents everything else'];
      return `<div class="pt-team">${c.team.map((m, n) => `<div class="pt-card pt-member">${m.photo ? `<img class="pt-head" src="${IMG}${esc(m.photo)}" alt="${esc(m.name)}">` : `<div class="pt-avatar">${esc((m.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</div>`}<h3>${esc(m.name)}</h3><p class="pt-role">${esc(m.role || '')}</p><p class="pt-note">${esc(m.note || '')}</p>${m.brings ? `<p class="pt-brings"><b>Brings</b> ${esc(m.brings)}</p>` : ''}<span class="pt-part">${esc(parts[n] || '')}</span></div>`).join('')}</div>
        <p class="pt-src">Who presents what is shown on each slide. <button class="btn" data-edit-team>Edit team</button></p>`; },
      notes: 'Each member says their name and the part they present, five seconds each.' },

    { sec: 'problem', by: 2, secs: 20, tag: 'Project background · The partner', title: 'Who is NSW Rugby Union?', body: () => `<div class="pt-g3">
        <div class="pt-navy"><p class="pt-kick">Who they are</p><p class="pt-quote sm light">"Supporting our clubs, schools, volunteers and communities to drive the growth of rugby in NSW."</p>${ul(['Community network spanning Sydney, Suburban, Country, Sydney Women\'s and NSW Junior rugby', 'Rugby For Good programs through the NSW Rugby Foundation'])}
          <div class="pt-stat4"><div><b>38,244</b><span>XV club players (2025)</span></div><div><b>6,160</b><span>of them female (16%)</span></div><div><b>3,167</b><span>sevens club players</span></div><div><b>+18%</b><span>coaches and match officials</span></div></div></div>
        <div class="pt-card"><p class="pt-kick red">What they want</p>${ul(['<b>25% more participants by 2027</b>: the key indicator in the 2025–2027 Strategic Plan', '<b>A sport of choice for everyone</b>: inclusive, strengthening communities', '<b>A lasting legacy from RWC 2027 and 2029</b>: "not only ready to host the world, but … a lasting legacy for our communities" (CEO)'])}</div>
        <div class="pt-card pt-pink"><p class="pt-kick red">What they need (the brief)</p>${ul(['<b>A way to measure outcomes</b>: no performance measurement framework or tools today', '<b>Evidence to win funding</b>: outcomes strengthen grant applications and private investment', '<b>A story backed by results</b>: tangible outcomes for NSW Rugby\'s storytelling'])}<p class="pt-fits">→ This is where our project fits</p></div></div>
      ${src('NSW Rugby Union (2025, p. 2; 2026a, pp. 2, 7–8; 2026b).')}`,
      notes: 'Set the scene in NSW Rugby\'s own words. The figures are rugby-wide context, not Legacy impact.' },
    { sec: 'problem', by: 2, secs: 25, tag: 'Project brief', title: 'What the brief asks, and how we read it', body: () => `<div class="pt-g2"><div class="pt-navy"><p class="pt-kick">The brief</p><p class="pt-quote">"A framework to measure the economic and social impacts of the delivery of the Rugby World Cup Legacy program."</p><p class="pt-src light">Project brief (NSW Rugby Union 2026a)</p>
          <p class="pt-kick">Why NSW Rugby needs it</p><p>NSW Rugby "currently has no performance measurement frameworks or tools", which affects grant funding, private investment and storytelling (NSW Rugby Union 2026b).</p></div>
        <div><p class="pt-kick red">Three kinds of impact, valued in clear units</p><div class="pt-impacts">${[['economic', 'Economic impacts', 'Spending kept in NSW, visitors and overnight stays, jobs. In dollars.'], ['social', 'Social impacts', 'Weekly participation, volunteering, quality of life. In dollars, hours and a 0–100 index.'], ['cultural', 'Cultural outcomes', 'Identity, inclusion and belonging, for First Nations and Pasifika communities. In % who agree.']].map(([k, h, b]) => `<div class="pt-card"><img src="${IMG}impact-${k}.jpg" alt=""><h4>${h}</h4><p>${b}</p></div>`).join('')}</div>
        <p class="pt-aims"><b>Our aims</b> ① Measure only the $10M Legacy Program ② Value every impact with independent evidence ③ Make it repeatable, and scalable to national and Rugby For Good programs</p></div></div>`,
      notes: 'Partner interaction: NSW Rugby\'s latest feedback asked two things above all: what is the value of your impact, and how did you reach your formula. The rest of our talk answers both. We added cultural because NSW Rugby\'s Partner Meeting 1 slides define it separately.' },
    { sec: 'problem', by: 2, secs: 40, tag: 'Our thought process', title: 'Why we chose this solution', body: () => {
        const Y = '<span class="pt-yes">●</span>', H = '<span class="pt-half">◐</span>', X = '<span class="pt-no">○</span>';
        return `<div class="pt-think">${[['1', 'The problem', 'No framework or tools; budgets and outputs recorded, outcomes not; most Legacy events still to run.'], ['2', 'What NSW Rugby needs', 'Impact values it can defend to funders, with every formula traceable, kept running by the next cohort.'], ['3', 'Options we weighed', 'A one-off report, a spreadsheet, a BI dashboard, or a framework run by a light tool.'], ['4', 'Our choice', 'Framework first (values and sources), tracking tools for the data that does not exist yet, and a light tool to run it.']].map(([n, h, b]) => `<div><span class="pt-num">${n}</span><h4>${h}</h4><p>${b}</p></div>`).join('<span class="pt-arrow">→</span>')}</div>
        ${table(['What it had to do', 'One-off report', 'Spreadsheet', 'BI dashboard', 'Framework + light tool'], [
          ['Trace every value to the $10M and a source', H, H, X, Y],
          ['Capture data from events not yet run', X, H, X, Y],
          ['Follow NSW Treasury guidelines', Y, H, H, Y],
          ['Usable by non-technical staff', Y, Y, H, Y],
          ['Repeatable by the summer cohort', X, Y, H, Y],
          ['Low cost; data stays with NSW Rugby', Y, Y, X, Y]], 'sm pt-matrix')}
        <p class="pt-src">● meets it · ◐ partly · ○ does not. Team assessment against NSW Rugby's brief and feedback.</p>`; },
      notes: 'Walk left to right: problem, need, options, choice. The deciding rows are the first two: a report or a dashboard can show numbers, but cannot prove where they come from or capture data from events that have not happened yet. The framework also works in Excel, so it does not depend on our tool.' },
    { sec: 'problem', by: 2, secs: 25, tag: 'Key outcomes and scope', title: 'Five deliverables, one framework', body: () => `${table(['#', 'NSW Rugby asked for', 'What we delivered', 'Where to see it'], [
        ['1', '<b>Best-practice impact frameworks</b>, NSW Treasury compliant', 'Methods benchmarked from other codes and agencies, adopted or adapted with reasons', 'Framework > Formula sheet, Sources'],
        ['2', '<b>Metrics, methods and data sources</b>, incl. benefit banks; monetise benefits', 'An impact value scorecard: unit, formula, standard value and source for each impact', 'Dashboard > Impact; Framework'],
        ['3', '<b>Baseline assessment</b> from existing data', 'A baseline register: participation, workforce, inclusion, club standards, facilities', 'Framework > Baseline register'],
        ['4', '<b>Tracking tools</b>: surveys, attendance, post-event follow-up', 'Post-event survey, attendance sheet, follow-up script, Legacy lines template', 'Framework > Tracking tools (downloads)'],
        ['5', '<b>Dashboard or calculator prototype</b>, scalable', 'Tackle AI: money, map, three impacts, zones, reports; runs on a laptop', 'The live tool (QR code later)']], 'pt-deliv')}
      ${so('The framework is the core deliverable; the dashboard is only as good as the numbers behind it, which is why most of our time went into deliverables 1 to 4.')}`,
      notes: 'This is the map for the whole talk. Point out the user manual (formulation and dashboard usage) is part of the handover for the summer cohort.' },
    { sec: 'problem', by: 2, secs: 35, appx: true, kind: 'live', tab: 'overview', target: '#dashMap', tag: 'Geographic context', title: 'Where the Legacy money is', body: () => { const L = live(); return `Known Legacy spend by region: <b>${L.grants}</b> grants and budget lines across <b>${L.towns}</b> towns. <b>${M(L.known)}</b> of ${M(L.funding)} (${Math.round(L.share * 100)}%) is traced to a project; the rest includes Round 2, already decided and to be announced by the Minister.`; },
      notes: 'Click one region. Woonona Shamrocks were removed after NSW Rugby told us they declined their Round 1 offer, which is why the total is $5.65M. NSW holds 56% of Australia\'s rugby participants (NSW Rugby Union 2026b).' },
    { sec: 'problem', by: 2, secs: 15, tag: 'Our sentence', title: 'Our concept in one sentence', body: () => `<div class="pt-sentence">A framework, and a tool to run it, that puts a <b>checked, evidence-backed value</b> on the economic, social and cultural impact of the <b>$10M Legacy Program</b>, so NSW Rugby can <b>prove it to funders</b> and <b>plan what comes next</b>.</div>`,
      notes: 'Say it once, slowly.' },

    { sec: 'stake', by: 2, secs: 30, tag: 'Stakeholder mapping', title: 'Who decides, who is affected, who supports', body: () => `<div class="pt-g3 pt-map">
        <div><div class="pt-band red">Key: decide and fund</div>${ul(['<b>NSW Rugby Union (Legacy team)</b>: owns the framework and data', '<b>Office of Sport, NSW Government</b>: funder; acquittal', '<b>NSW Treasury</b>: evaluation and CBA rules, Evidence Bank'])}</div>
        <div><div class="pt-band navy">Primary: directly affected</div>${ul(['<b>Clubs, zones and associations</b>: receive grants, report results', '<b>Coaches, referees and volunteers</b>', '<b>Women and girls, First Nations and Pasifika participants</b>'])}</div>
        <div><div class="pt-band blue">Secondary: support and inform</div>${ul(['<b>Rugby Australia</b>: Rugby Analytics data', '<b>Councils, local business, Destination NSW</b>: event and visitor impact', '<b>UNSW summer cohort</b>: continues the framework'])}</div></div>
      ${so('The framework succeeds only if two groups act: NSW Rugby staff who use it and clubs who report into it.')}${src('NSW Rugby Union (2026a); team analysis.')}`,
      notes: 'Stakeholders from the brief: NSW Rugby Union, Rugby Australia, NSW Rugby Clubs, Office of Sport, NSW Rugby Union Foundation. We added communities and local business because economic and cultural impact happen there.' },
    { sec: 'stake', by: 2, secs: 30, tag: 'Engagement strategy', title: 'How we engaged, and what we sought', body: () => `${table(['Who', 'How we engaged', 'Value sought'], [
        ['NSW Rugby project lead (Dona D\'Amico) and team', 'Three partner meetings: problem definition, formula feedback, Legacy refocus', 'Priorities, approval of methods and scope, data access'],
        ['NSW Rugby data holders', 'Rugby Analytics exports, club list by zone, volunteer data and survey sample', 'Real baselines; zone mapping; survey design'],
        ['UNSW facilitator (between meetings)', 'We sent written questions after each meeting; the facilitator relayed them to NSW Rugby, brought back answers and data, and shared feedback given to all teams', 'Fast answers between meetings (zone mapping, a declined grant, Round 2 status); data requests met; feedback applied before the next meeting'],
        ['Evaluation team', 'Their KPI Formula Web Handover, used unchanged (27 KPIs)', 'One consistent KPI set'],
        ['Public sources', 'Grant lists, Destination NSW, NSW Treasury Evidence Bank, news and social media', 'Independent values and evidence']])}
      ${so('Every round of engagement narrowed our claims: from rugby-wide numbers to Legacy-only, from borrowed figures to independent standard values.')}`,
      notes: 'Mention NSW Rugby answered our questions directly: associations stay separate from zones, Sydney associations can be grouped, Woonona declined, Round 2 is decided.' },
    { sec: 'stake', by: 2, secs: 20, tag: 'Analysis and insights', title: 'What the data and the partner told us', body: () => { const L = live(); return `<div class="pt-g2"><div class="pt-card"><h4>Key data</h4>${ul([
          `<b>${M(L.known)}</b> of ${M(L.funding)} traced to projects (${Math.round(L.share * 100)}%)`,
          L.econ ? `${esc(L.econ[0])}: <b>${esc(L.econ[1])}</b>` : 'Economic contribution: needs spend by category',
          L.cult ? `${esc(L.cult[0])}: <b>${esc(L.cult[1])}</b>` : 'First Nations and Pasifika investment: needs tagged lines',
          L.fall.length ? `${esc(L.fall[0].name)}: participation ${(L.fall[0].growth * 100).toFixed(1)}%${L.fall[0].facility ? '' : ', no Round 1 facility grant'}` : 'Zone data: load the Rugby Analytics files',
          ...(window.AusPlay?.data ? [`AusPlay (independent survey): about <b>${N(window.AusPlay.data.adults.n + window.AusPlay.data.children.n)}</b> NSW rugby union players; women only ${Math.round(window.AusPlay.data.adultWomen.n / window.AusPlay.data.adults.n * 100)}% of adults`] : []),
          'No funded project has reported people reached yet: results arrive at acquittal'])}</div>
        <div class="pt-card"><h4>Influential partner feedback</h4><ul class="pt-quotes">${[
          ['"What is the value of your impact?"', 'an impact value scorecard with units and a scoring method'],
          ['"How did you reach your formula?"', 'every formula linked to research, a benchmarked sport or a data bank'],
          ['"Methods, not figures, from Rugby For Good and Rugby League"', 'their figures removed; independent standard values instead'],
          ['"Economic impact is more than registrations"', 'visitors and overnight stays, domestic vs international'],
          ['"Every metric should explain itself"', 'every figure shows "of what, based on what"']].map(([q, a]) => `<li><b>${q}</b><span>→ ${a}</span></li>`).join('')}</ul><p class="pt-src">NSW Rugby feedback sessions, paraphrased</p></div></div>`; },
      notes: 'The most influential feedback: "the impact isn\'t related to the $10M" early on, and now "how did you reach your formula". Our biggest gap is data, not method: results only arrive at acquittal, so the framework must tell clubs exactly what to capture.' },
    { sec: 'stake', by: 2, secs: 30, tag: 'Persona profiles', title: 'The two groups the framework relies on', body: () => `<div class="pt-g2">
        <div class="pt-card pt-persona"><div class="pt-avatar">PM</div><h4>The Legacy program manager</h4><p class="pt-note">NSW Rugby staff · composite persona</p>${ul(['<b>Needs:</b> report to the Board and Office of Sport; prove value for the next grant', '<b>Pains:</b> data in spreadsheets, PDFs and screenshots; asked "76% of what?"', '<b>Gains:</b> every value explained and sourced; reports in minutes'])}<p class="pt-quote sm">"I need numbers I can defend in front of a funder."</p></div>
        <div class="pt-card pt-persona"><div class="pt-avatar">CV</div><h4>The club volunteer grant recipient</h4><p class="pt-note">Club secretary running a funded project · composite persona</p>${ul(['<b>Needs:</b> deliver the project; finish the acquittal', '<b>Pains:</b> little time; unclear what to record at events', '<b>Gains:</b> one template, one short post-event survey, the club\'s story told'])}<p class="pt-quote sm">"Tell me exactly what to send, once."</p></div></div>
      ${so('The manager uses the framework; the volunteer feeds it. That is why the tracking tools matter as much as the dashboard.')}`,
      notes: 'Composite personas built from the partner meetings and the grant data, not real people.' },
    { sec: 'stake', by: 2, secs: 15, tag: 'Value proposition canvas', title: 'Where our solution fits NSW Rugby', body: () => `<div class="pt-vpc">
        <div class="vp"><h4>Value map</h4><div><b>Products</b>${ul(['Eight-step framework and formula sheet', 'Baseline register and tracking tools', 'Dashboard, zone view and reports'])}</div><div><b>Pain relievers</b>${ul(['Independent standard values, sources shown', 'Legacy money only; missing is never zero', 'Works offline; AI only explains'])}</div><div><b>Gain creators</b>${ul(['Impact value per $1 of Legacy money', 'Public evidence linked to funded places', 'Reports for five audiences'])}</div></div>
        <div class="fit">FIT</div>
        <div class="cs"><h4>Customer profile: NSW Rugby</h4><div><b>Jobs</b>${ul(['Show the impact of the $10M', 'Win future funding', 'Tell the legacy story'])}</div><div><b>Pains</b>${ul(['No framework or tools', 'Numbers that cannot be traced', 'Events not yet run'])}</div><div><b>Gains</b>${ul(['Trusted values', 'Faster reporting', 'A plan for the data to collect'])}</div></div></div>${src('Canvas: Osterwalder et al. (2014).')}`,
      notes: 'Strongest fit: "numbers that cannot be traced" ↔ "independent standard values, sources shown".' },

    { sec: 'solution', by: 2, secs: 35, appx: true, tag: 'Solution ideation', title: 'From the brief to one framework and one tool', body: () => `${cards([['Option A · Spreadsheet only', 'Easy to adopt, but cannot explain its figures, read uploads or keep a history.'], ['Option B · BI dashboard', 'Strong visuals, but needs licences, a data team and still no method.'], ['Chosen · Framework + light web tool', 'The framework works in Excel; the tool runs it on a laptop, explains every figure and keeps data with NSW Rugby.']])}
      ${so('Partner feedback shaped each choice: "use established methods" removed our own score; "explain the AI" set the rule that code calculates and AI only explains.')}`,
      notes: 'Keep it short: why not a spreadsheet, why not Power BI.' },
    { sec: 'solution', by: 2, secs: 50, tag: 'Prototype iteration', title: 'Three partner meetings, three iterations', body: () => `<ol class="pt-steps pt-meet">
        <li><b>Partner meeting 1 · Define the problem</b><span>NSW Rugby has "no performance measurement frameworks or tools"; the brief asks for the economic and social impact of the Legacy Program.</span><em>We set the problem, the scope and three impacts (adding cultural, as NSW Rugby defines it).</em><small><b>Implemented in:</b> problem and scope slides; Framework, section 1; the five deliverables map.</small></li>
        <li><b>Partner meeting 2 · How we get the numbers</b><span>Feedback on our formulas: show how each number is reached, use established methods instead of our own, explain the AI, show the real figures.</span><em>We rebuilt every formula on published methods and showed the working.</em><small><b>Implemented in:</b> hover working on every figure (Dashboard); Formula sheet with reasons for anything adapted (Framework, section 5); "How the app works" page; 0–100 scores removed.</small></li>
        <li><b>Partner meeting 3 · Back to the Legacy Program</b><span>NSW Rugby liked the formulas, but our data had drifted beyond the Legacy Program. Written feedback followed: value every impact, source every formula, methods not other programs' figures.</span><em>Every figure now traces to the $10M; where Legacy data does not exist yet, we fall back to public data and web search to relate impact to our results.</em><small><b>Implemented in:</b> "What the $10M has delivered" (Legacy money only); Rugby For Good figures and a declined grant removed; "What the public is saying" (news, Reddit, Bluesky); AusPlay and Clearinghouse values; tracking tools (Framework, section 7).</small></li>
        <li class="now"><b>Today · Final pitch</b><span>Value scorecard on independent values, baseline register, post-event tools, user manual for the next cohort.</span><em>Your feedback today → the final deliverable and slide deck report.</em></li></ol>
      ${so('Each meeting changed something you can see in the tool. The claims got narrower and the evidence stronger every round.')}`,
      notes: 'This is the partner-interaction story. Point at the tool for each meeting: hover a figure (meeting 2), the Legacy-only impact card and public stories (meeting 3). Between meetings, our UNSW facilitator relayed our written questions and brought back answers and data, so each iteration started from NSW Rugby\'s own input.' },
    { sec: 'solution', by: 2, secs: 40, tag: 'Partner meeting 3 · Feedback applied', title: 'Seven points from NSW Rugby, and where each is now', body: () => table(['NSW Rugby asked', 'What we changed', 'Where to see it'], [
        ['1. What is the value of your impact?', 'Value scorecard: dollars, activity hours, quality of life, with one scoring method', 'Framework, section 4; Dashboard impact card'],
        ['2. How did you reach your formula?', 'Every value linked to research, a benchmarked sport or a data bank (DCJ Benefits Database, Clearinghouse for Sport, AusPlay)', 'Framework, sections 4, 5 and 8'],
        ['3. Stay within the $10M', 'Rugby For Good and Rugby League figures removed; their methods only', 'Every Dashboard figure; Framework, section 8'],
        ['4. More than registrations', 'Visitor and overnight spending, day / domestic / international', 'Calculators; post-event survey'],
        ['5. Every metric explains itself', 'Hover any number for "of what, and based on what"', 'Every figure on the Dashboard'],
        ['6. Data you do not have yet', 'Post-event survey, attendance sheet, follow-up script', 'Framework, section 7 (downloads)'],
        ['7. User manual', 'Formulation and dashboard use for the summer cohort', '<span class="pt-h">In progress</span>']], 'sm'),
      notes: 'This is the written feedback our facilitator sent after meeting 3. Go down the list quickly; point at the tool for one or two. Be upfront that the user manual is being finished for the final submission.' },
    { sec: 'solution', by: 2, secs: 25, tag: 'Deliverable 1 · Frameworks', title: 'Benchmarked against what already works', body: () => `${table(['Framework', 'Where from', 'What we use it for'], [
        ['NSW Treasury TPG22-22 Evaluation Guidelines', 'NSW Government', 'Program logic, baselines, outcome evaluation: the structure of the eight steps'],
        ['NSW Treasury TPG23-08 Cost-Benefit Analysis', 'NSW Government', 'Present values at 5% (3% and 7% tests); benefit-cost ratio at the end of the program'],
        ['NSW Treasury Evidence Bank → DCJ Benefits Database, Outcome Values Database', 'NSW Government', 'Independent standard values for health and quality of life (e.g. QALY $69,948)'],
        ['Clearinghouse for Sport', 'Australian Sports Commission', 'Value of weekly club sport ($5,932 per participant a year) and of volunteer time'],
        ['Community Impact of Rugby League (2026)', 'Rugby league, NSW', 'Expenditure-flow <b>method</b> for economic contribution (method only, no figures)'],
        ['eventIMPACTS toolkit', 'UK events', 'Visitor and overnight spending from a post-event survey'],
        ['Sport England Active Lives', 'England', 'Life satisfaction question for quality of life'],
        ['Cultural Development Network outcomes', 'Australia', 'Cultural outcomes measured as % who agree']], 'sm')}
      ${spec('Rugby For Good and Rugby League were examples of how others measured impact: we use their methods where helpful, never their figures, as they are separate programs.')}${src('NSW Treasury (2023a; 2023b; 2025); DCJ (2024); eventIMPACTS (n.d.); Cultural Development Network (2018).')}`,
      notes: 'This answers "how did you reach your formula" at the framework level. Point to the Framework page sources section on the tool.' },
    { sec: 'solution', by: 2, secs: 50, tag: 'Deliverable 2 · Metrics and value', title: 'The value of our impact, and what each number means', body: () => { const L = live(); return `${table(['Impact', 'Measure', 'Unit', 'How it is valued', 'Today'], [
        ['Economic', 'Contribution of Legacy spending', '$', 'Legacy spend by category × share kept in NSW × multiplier', L.econ ? `<b>${esc(L.econ[1])}</b><br><small>${esc(L.econ[2])}</small>` : 'Needs data'],
        ['Economic', 'Visitor and overnight spending', '$', 'Visitors from outside the area (day / overnight, domestic / international) × spend per visitor (Destination NSW)', 'Needs post-event survey'],
        ['Social', 'Physical activity', 'hours', 'Participants × sessions × hours per session', 'Needs attendance capture'],
        ['Social', 'Quality of life', '0–100 and $', 'Life satisfaction (0–10) × 10; change valued with the DCJ QALY standard value ($69,948)', 'Needs survey'],
        ['Social', 'Weekly participation and volunteering', '$ a year', 'Weekly participants × $5,932 (Australian Sports Commission 2018) + volunteer hours × $18.99 (ASC 2017)', 'Needs weekly counts'],
        ['Social', 'Health outcomes avoided', '$ a year', 'Alternative: participants avoiding an outcome × DCJ standard value (e.g. child depression $555 a year)', 'Needs evidence of outcomes avoided'],
        ['Cultural', 'Investment and outcomes', '$ and %', 'Legacy $ in First Nations and Pasifika programs; % who agree with each CDN outcome', L.cult ? `<b>${esc(L.cult[1])}</b> invested` : 'Needs data']], 'sm pt-score')}
      ${so('Scoring method: each value = a Legacy-attributable quantity × an independent standard value. Each is labelled measured or needs data, shown per $1 of Legacy money, and never added to the others.')}${src('DCJ (2024) Benefits Database, FY2022/23 values; Destination NSW; NSW Treasury (2023b).')}`; },
      notes: 'This is the answer to "what is the value of your impact". Read one row end to end: physical activity hours = participants × sessions × hours, captured on the attendance sheet. Be honest: most values need data from events that have not run yet; the tracking tools make sure it is captured. The social value now uses the Australian Sports Commission\'s $5,932 per weekly club sport participant a year (Clearinghouse for Sport) instead of the Rugby For Good figure, per NSW Rugby\'s feedback.' },
    { sec: 'solution', by: 2, secs: 30, tag: 'Deliverable 2 · Formula sources', title: 'How we reached each formula', body: () => `${table(['Formula', 'Based on', 'Evidence type'], [
        ['Economic contribution', 'Expenditure-flow analysis; ABS input-output multipliers', 'Benchmarked sport (method) · data bank'],
        ['Visitor and overnight spending', 'eventIMPACTS method; Destination NSW visitor spend', 'Benchmarked events · data bank'],
        ['Physical activity hours', 'AusPlay definition of participation; our attendance capture', 'Research · Legacy data'],
        ['Quality of life', 'Sport England life satisfaction question; DCJ QALY value', 'Benchmarked sport · data bank'],
        ['Weekly participation and volunteering', 'Australian Sports Commission values via the Clearinghouse for Sport', 'National sport agency'],
        ['Health outcomes avoided', 'DCJ Benefits Database standard values', 'Data bank'],
        ['Present values', 'NSW Treasury TPG23-08 (5%, with 3% and 7%)', 'Government guideline'],
        ['Cultural outcomes', 'Cultural Development Network schema', 'Research']], 'sm')}
      ${so('No value is a guess: each is traceable to research, a benchmarked sport or a government data bank, and the Framework page lists anything we adapted with the reason.')}`,
      notes: 'If asked about Rugby League multipliers: they come from ABS input-output tables; we use the method, and the next step is to source the multipliers directly from ABS.' },
    { sec: 'solution', by: 2, secs: 30, tag: 'Deliverable 3 · Baseline', title: 'The starting point to compare against after Legacy', body: () => `${table(['Measure', 'Baseline', 'Latest', 'Source'], baselines(), 'sm')}
      ${so('Change is only measurable against a fixed starting point. These are recorded now, before the 2027 Rugby World Cup peak.')}`,
      notes: 'Live from the uploaded Rugby Analytics files. Rugby-wide numbers are context for Legacy, not Legacy impact; the Legacy-specific baseline is set per project at the start of each funded activity.' },
    { sec: 'solution', by: 2, secs: 35, tag: 'Deliverable 4 · Tracking tools', title: 'What NSW Rugby should capture after each event', body: () => `<div class="pt-g3">
        <div class="pt-card"><h4>Post-event survey</h4>${ul(['Where do you live? (postcode or country) → domestic or international', 'Was the event your main reason to visit?', 'Nights stayed, and where', 'Spend in the area: accommodation, food, travel, shopping', '"Overall, how satisfied are you with your life nowadays?" (0–10)', 'Hours of physical activity in a typical week', 'I feel I belong at this club (agree / disagree)'])}</div>
        <div class="pt-card"><h4>Attendance capture</h4>${ul(['Date, venue, Legacy line', 'Participants by session (girls, First Nations, Pasifika, disability)', 'Session length in hours', 'Coaches, referees and volunteers present', 'Spectators (count or estimate method)'])}</div>
        <div class="pt-card"><h4>Post-event follow-up</h4>${ul(['Within 7 days: send the survey link (QR at the venue)', 'Within 30 days: club enters attendance on the Legacy lines template', 'At acquittal: spend, people reached, photos and a short story'])}</div></div>
      ${so('Most Legacy events have not run yet. These tools make sure every event produces the numbers the value scorecard needs.')}`,
      notes: 'Download links are on the Framework page: post-event survey, attendance sheet, follow-up script and the Legacy lines template.' },
    { sec: 'solution', by: 0, secs: 60, kind: 'live', tab: 'framework', target: '#fw-steps', tag: 'Deliverables 1–4 · In the tool', title: 'The framework, reproducible anywhere', body: 'Eight steps, each with the data needed, the formula, where the tool shows it and a check, plus the formula sheet, baseline register and tracking-tool downloads. It works in Excel as well as in the tool.',
      notes: 'Scroll to the formula sheet and the downloads. Point out the user manual covers the same formulation for the summer cohort.' },
    { sec: 'solution', by: 2, secs: 35, kind: 'live', tab: 'overview', view: ['impact', 'overview'], target: '#dollarCard', tag: 'Deliverable 5 · Dashboard', title: 'The calculator at work', body: () => { const L = live(); return `The three impacts side by side, each tied to Legacy money; hover any value for its formula and source.${L.stories ? ` Below: ${L.stories} public stories and posts, ${L.linked} linked to a funded club, town or region.` : ''}`; },
      notes: 'Hover the economic figure to show the working. If the AI is off, the "From the data" summary shows: the tool never goes blank.' },
    { sec: 'solution', by: 2, secs: 25, appx: true, kind: 'live', tab: 'overview', target: '#round2Card', tag: 'Deliverable 5 · Zones', title: 'Where Legacy money has reached', body: 'Each rugby zone from NSW Rugby\'s club list: participation, churn, coaches and Legacy money per participant. Ready to check the Round 2 list once announced, and to target future funding.',
      notes: 'NSW Rugby told us Round 2 is decided, so this view now supports checking coverage and future programs, such as the Women\'s RWC 2029 legacy.' },
    { sec: 'solution', by: 2, secs: 10, kind: 'qr', tag: 'Deliverable 5 · Try it', title: 'Scan to open the tool', body: () => `<div class="pt-g2"><div class="pt-qr" id="ptQr"></div><div><p class="pt-lead">Hover any figure to see how it was worked out.</p><p>${cfg().url ? `<a href="${esc(cfg().url)}" target="_blank" rel="noopener">${esc(cfg().url)}</a>` : ph('Add the hosted link in "Edit team" to show the QR code')}</p></div></div>`,
      notes: 'Invite the partners to scan now.' },

    { sec: 'solution', by: 1, secs: 60, kind: 'live', tab: 'story', target: '.story-controls', tag: 'Deliverable 5 · Reports', title: 'Telling the legacy story', body: 'Board Summary, Funding Acquittal, Annual Report chapter, Community Story and Media Release, built from the same checked values. Missing figures say "NO DATA", never zero, so every report can be defended.',
      notes: 'Switch Board Summary → Funding Acquittal live. NSW Rugby said the lack of tangible outcomes hurt their storytelling: this is the answer. The expenditure page replaced the "overbudget" wording after feedback.' },

    { sec: 'impl', by: 2, secs: 35, tag: 'Timeline and scalability', title: 'Checkpoints: 12 months, 1–3 years, 3–5 years', body: () => `<div class="pt-tl">
        <div><img class="pt-tlimg" src="${IMG}outcome-week10.jpg" alt=""><span class="pt-yr">Next 12 months</span><small>Phase 2 · summer cohort</small>${ul(['User manual handed over (formulation + dashboard use)', 'Tracking tools used at the first Legacy events', 'First weekly participant counts valued at the Australian Sports Commission rate', 'Round 2 list checked against the zone view'])}</div>
        <div><img class="pt-tlimg" src="${IMG}outcome-2028.jpg" alt=""><span class="pt-yr">1–3 years</span><small>RWC 2027 · end of funding 2028</small>${ul(['Visitor and overnight survey at RWC 2027 event hubs', 'Yearly check-ins; July 2028 final report', 'Benefit-cost ratio once costs and benefits are complete'])}</div>
        <div><img class="pt-tlimg" src="${IMG}outcome-2029.jpg" alt=""><span class="pt-yr">3–5 years</span><small>Phase 3 and beyond</small>${ul(['Women\'s RWC 2029 legacy', 'Rugby For Good and other programs (new data, same method)', 'National scaling with Rugby Australia'])}</div></div>${src('NSW Rugby Union (2026b), multi-stage project.')}`,
      notes: 'A new program only needs a new list of funded lines; steps, formulas and tools stay the same.' },
    { sec: 'impl', by: 2, secs: 30, tag: 'Feasibility and success', title: 'Can it work, and how will we know?', body: () => { const L = live(); return `<div class="pt-g2"><div class="pt-card"><h4>Feasibility</h4>${ul(['<b>Technical:</b> runs on a laptop; AI local, so data stays with NSW Rugby', '<b>Operational:</b> one template and one short survey per event', '<b>Data:</b> the main constraint: values need event data'])}</div>
        <div class="pt-card"><h4>Measures of success</h4>${table(['Measure', 'Today → target'], [['Legacy money traced', `${Math.round(L.share * 100)}% → 100%`], ['Funded lines reporting people reached', '0 → all, at acquittal'], ['Events with a post-event survey', '0 → all'], ['Values backed by a data bank', 'most → all'], ['Time to draft a board report', `${ph('today, from NSW Rugby')} → minutes`]], 'sm')}</div></div>`; },
      notes: 'Success is data flowing in and every value traceable, not more features.' },
    { sec: 'impl', by: 2, secs: 30, tag: 'Risks and responses', title: 'What could go wrong, and our response', body: () => table(['Risk', 'Likelihood', 'Impact', 'Response'], [
        ['Clubs do not capture event data', '<span class="pt-h">High</span>', '<span class="pt-h">High</span>', 'Short survey and template built into acquittal; "needs data" shown, never zero'],
        ['Values challenged by funders', 'Medium', '<span class="pt-h">High</span>', 'Independent standard values only; source shown for each'],
        ['Handover lost between cohorts', 'Medium', '<span class="pt-h">High</span>', 'User manual; framework works in Excel; one-click start'],
        ['Privacy and First Nations data', 'Low', '<span class="pt-h">High</span>', 'Totals only; Maiam nayri Wingara principles; community approval'],
        ['AI misreads or is offline', 'Medium', 'Medium', 'Code calculates every figure; data-only fallback'],
        ['Public data limits', '<span class="pt-h">High</span>', 'Low', 'Public feeds only; staff check each story']], 'sm'),
      notes: 'Top risk is data capture, which is why deliverable 4 exists.' },
    { sec: 'impl', by: 2, secs: 20, tag: 'Financial insights', title: 'The $10M, and the cost of measuring it', body: () => { const L = live(); const P = [['NSW Rugby Legacy Plan', 5e6], ['Club Legacy Grants, Round 1', 2.15e6], ['Club Legacy Grants, Round 2', 2.15e6], ['Club Equipment Grants', 3.5e5]];
      return `<div class="pt-g2"><div class="pt-card"><h4>Legacy Program funding</h4>${P.map(([n, v]) => `<div class="pt-bar"><span>${n}</span><i style="width:${v / 5e6 * 100}%"></i><b>${M(v)}</b></div>`).join('')}<p class="pt-src">NSW Rugby Union (2026b). Traced to projects in the tool: <b>${M(L.known)}</b>.</p></div>
        <div class="pt-card"><h4>Cost of running the framework</h4>${ul(['Tool and AI model: $0 (open model on a laptop)', 'Public evidence search: $0 (public feeds)', `Hosting: ${ph('confirm plan')}`, 'Main cost: staff and volunteer time for surveys and attendance'])}${L.econ ? `<p><b>Insight:</b> ${esc(L.econ[0])} is ${esc(L.econ[1])} (${esc(L.econ[2])}). Descriptive, not a benefit-cost ratio.</p>` : ''}</div></div>`; },
      notes: 'The tool costs almost nothing; the investment is in data capture, which protects future grant funding.' },
    { sec: 'impl', by: 2, secs: 15, tag: 'Wider issues', title: 'Beyond the tool', body: () => cards([
        ['Timing', 'RWC 2027 and Women\'s RWC 2029 are short windows: surveys must be ready before the event hubs open.'], ['After 2028', 'Funded roles end with the grant; measurement must outlive the program.'], ['Attribution', 'We report what happened where the money went, not what it caused.'],
        ['Data sovereignty and AI', 'First Nations data stays under community authority; the AI only explains figures and runs locally.'], ['Public data', 'News covers what gets reported; Facebook, Instagram, X and TikTok need approved access.'], ['Scalability', 'NSW holds 56% of Australian rugby participants: a method proven here can scale nationally.']]),
      notes: 'Attribution is the question evaluators press on: results are descriptive (NSW Treasury 2023a).' },

    { sec: 'close', by: 2, secs: 25, tag: 'Conclusion', title: 'What we leave NSW Rugby with', body: () => `<div class="pt-sentence sm">A framework that puts a <b>checked, evidence-backed value</b> on the Legacy Program's impact, with the <b>tools to capture the data</b> and a <b>dashboard to run it</b>.</div>
      ${cards([['Recommend 1', 'Build the post-event survey and attendance sheet into every Legacy event and acquittal.'], ['Recommend 2', 'Adopt independent standard values (DCJ Benefits Database, Outcome Values Database) for every monetised benefit.'], ['Recommend 3', 'Hand the user manual to the summer cohort and run the visitor survey at RWC 2027 hubs.']])}`,
      notes: 'Return to the sentence. Three recommendations, one line each.' },
    { sec: 'close', by: 2, secs: 15, kind: 'thanks', title: 'Thank you', notes: 'Pause after each question; write down answers for Assessment 3.' },

    { sec: 'refs', by: 2, secs: 0, tag: 'Reference list · UNSW Harvard', title: 'Reference list', body: refs, notes: 'Not presented.' },
    { sec: 'appendix', by: 2, secs: 0, tag: 'Appendix · For Q&A', title: 'Key contributors', body: () => { const tick = '<span class="pt-tick">✓</span>', no = '<span class="muted">–</span>';
      const rows = [['Team leadership', 1, 0, 0], ['PPT creation (slide design & build)', 1, 0, 0], ['Data research', 1, 0, 0], ['Prototype development', 1, 0, 0], ['Data verification', 0, 1, 1], ['Slides editing', 0, 1, 1]];
      return table(['', 'Bintang · Team leader', 'Yinnan Hu · Data researcher', 'Xiao Yang · Documentation & logistics'], rows.map(([l, ...v]) => [`<b>${l}</b>`, ...v.map(x => x ? tick : no)]), 'pt-contrib'); }, notes: 'From the team\'s contribution record.' },
    { sec: 'appendix', by: 2, secs: 0, kind: 'live', tab: 'framework', target: '#fw-formulas', tag: 'Appendix · For Q&A', title: 'A1 Formula sheet', body: 'Every formula: published, adapted (with reasons) and created (with reasons).', notes: 'For method questions.' },
    { sec: 'appendix', by: 2, secs: 0, kind: 'live', tab: 'methodology', target: '#m-overview', tag: 'Appendix · For Q&A', title: 'A2 How the AI is used', body: 'Code calculates every figure; the AI only explains and reviews; staff check.', notes: 'For AI questions.' },
    { sec: 'appendix', by: 2, secs: 0, kind: 'live', tab: 'data', target: '#tab-data .card', tag: 'Appendix · For Q&A', title: 'A3 Data and history', body: 'Every file NSW Rugby has shared, its quality rating, and a history of every change.', notes: 'For data questions.' },
  ];

  // 15-minute talk: slides marked appx move after the reference list as untimed appendix slides for Q&A.
  { const main = SLIDES.filter(s => !s.appx && s.sec !== 'refs' && s.sec !== 'appendix'), tail = SLIDES.filter(s => s.sec === 'refs' || s.sec === 'appendix');
    const moved = SLIDES.filter(s => s.appx).map(s => ({ ...s, sec: 'appendix', secs: 0, tag: 'Appendix · For Q&A' }));
    SLIDES.splice(0, SLIDES.length, ...main, ...tail, ...moved); }

  // UNSW Harvard reference list from the sources the tool uses, plus partner documents and data banks.
  function refs() {
    const viewed = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    const list = [
      'NSW Rugby Union 2026a, <i>Project brief: Rugby World Cup Legacy Program impact modelling, Term 3 2026</i>, UNSW Employability, Sydney.',
      'NSW Rugby Union 2026b, <i>Partner Meeting 1</i> [presentation slides], NSW Rugby Union, Sydney.',
      'NSW Rugby Union 2026c, <i>List of all NSW RU clubs</i> [spreadsheet], NSW Rugby Union, Sydney.',
      `Department of Communities and Justice 2024, <i>DCJ Benefits Database: standard values for human services cost-benefit analysis</i>, FACSIAR, NSW Government, Sydney, viewed ${viewed}, &lt;https://dcj.nsw.gov.au/documents/about-us/facsiar/facsiar-publications-and-resources/dcj-benefits-database-standard-values-human-services-cost-benefit-analysis.pdf&gt;.`,
      'NSW Treasury 2025, <i>Evidence Bank annual insights report</i>, NSW Treasury, Sydney.',
      'Osterwalder, A, Pigneur, Y, Bernarda, G & Smith, A 2014, <i>Value proposition design</i>, Wiley, Hoboken, NJ.',
      ...Object.entries(D.frameworks).filter(([id]) => id !== 'R4G-CBA').map(([, f]) => `${esc(f.org)} ${f.year}, <i>${esc(f.title)}</i>, ${f.url ? `viewed ${viewed}, &lt;${esc(f.url)}&gt;` : 'document provided by NSW Rugby Union'}.`),
      ...(window.Framework?.RESEARCH || []).map(([, cite, , , , url]) => { const m = cite.match(/^(.*?)\s*\((\d{4})\),?\s*(.*)$/); if (!m || (url && Object.values(D.frameworks).some(f => f.url === url))) return '';
        return `${esc(m[1])} ${m[2]}, <i>${esc(m[3])}</i>${url ? `, viewed ${viewed}, &lt;${esc(url)}&gt;` : ''}.`; }).filter(Boolean),
    ];
    return `<ol class="pt-refs">${[...new Set(list)].sort((a, b) => a.replace(/<[^>]+>/g, '').localeCompare(b.replace(/<[^>]+>/g, ''))).map(r => `<li>${r}</li>`).join('')}</ol>`;
  }

  // ---------- full-slide layouts ----------
  const secNo = s => ({ intro: 1, problem: 2, stake: 3, solution: 4, impl: 5, close: 6, refs: 'R', appendix: 'A' }[s.sec]);
  function frame(s, n, inner) {
    const who = cfg().team[s.by]?.name || '';
    return `<div class="pt-top"><span class="pt-tag"><i>${secNo(s)}</i>${esc(s.tag || s.title)}</span>${who && s.secs ? `<span class="pt-presenter">Presenter <b>${esc(who)}</b></span>` : ''}</div>
      <h2 class="pt-title">${esc(s.title)}</h2><div class="pt-content">${inner}</div>
      <div class="pt-foot"><span>${FOOT}</span><span>${n + 1}</span><img src="${IMG}waratah.png" alt=""></div>`;
  }
  function cover() { const c = cfg();
    return `<div class="pt-navyslide"><div class="pt-cover-l"><div class="pt-logo"><img src="${IMG}logo.png" alt="NSW Rugby Union"></div><p class="pt-kicker">NSW Rugby Union × UNSW Sydney</p><h1>MEASURING THE LEGACY</h1><p class="pt-subtitle">An impact framework and tool for the NSW Rugby World Cup Community Legacy Program</p>
      <div class="pt-coverbox"><b>Final Pitch Presentation · CDEV6000 Team 1</b><span>${c.team.map(m => esc(m.name)).join(' · ')}</span><span>UNSW Sydney · Term 3, 2026</span></div><p class="pt-motto">Care, connect and unify the game in NSW</p></div>
      <div class="pt-cover-r"><img src="${IMG}cover.jpg" alt="Junior rugby players"></div></div>`; }
  const aoc = () => `<div class="pt-navyslide pt-aoc"><img class="pt-aoc-img" src="${IMG}aoc.jpg" alt="Young First Nations rugby players"><p class="pt-kicker">Acknowledgement of Country</p>
      <h2>We acknowledge the Bedegal people, Traditional Custodians of the land on which UNSW Kensington stands, and the Traditional Custodians of the lands across New South Wales where rugby is played.</h2>
      <p>We pay our respects to Elders past and present, and extend that respect to all Aboriginal and Torres Strait Islander peoples with us today. We recognise the enduring contribution of First Nations players, coaches, match officials and communities to rugby in NSW.</p>
      <div class="pt-foot light"><span>${FOOT}</span><img src="${IMG}waratah.png" alt=""></div></div>`;
  const thanks = () => `<div class="pt-navyslide"><div class="pt-cover-l"><div class="pt-logo"><img src="${IMG}logo.png" alt="NSW Rugby Union"></div><h1>THANK YOU</h1><p class="pt-subtitle">Questions, feedback and direction</p>
      <div class="pt-ask"><b>We'd value your view on</b>${ul(['Does the value scorecard answer "what is the value of our impact"?', 'Can the post-event survey and attendance sheet be built into acquittal?', 'Which values should NSW Rugby adopt first from the DCJ and Outcome Values databases?', 'Who will own the framework and user manual after handover?'])}</div></div>
      <div class="pt-cover-r"><img src="${IMG}thanks.jpg" alt="Young rugby supporters"></div></div>`;

  // ---------- engine ----------
  let i = 0, active = false, els = null, clock = null, startedAt = 0, stepAt = 0, pausedAt = 0, notesOpen = false;
  const fmt = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  const timed = SLIDES.filter(s => s.secs);
  const planEnd = n => SLIDES.slice(0, n + 1).reduce((t, s) => t + s.secs, 0);
  const shares = () => { const t = {}; for (const s of timed) { const nm = cfg().team[s.by]?.name || 'Unassigned'; t[nm] = (t[nm] || 0) + s.secs; } return t; };

  function tick() {
    const el = els && $('.present-timer', els.bar);
    if (!el) return;
    const now = pausedAt || Date.now(), total = (now - startedAt) / 1000, onStep = (now - stepAt) / 1000, s = SLIDES[i];
    const drift = s.secs ? total - planEnd(i) : 0, pace = drift > 30 ? 'late' : drift > 0 ? 'tight' : 'ok';
    el.className = `present-timer ${pace}${pausedAt ? ' paused' : ''}`;
    el.innerHTML = `<span>${fmt(total)} / ${fmt(BUDGET)}</span><span>slide ${fmt(onStep)} / ${fmt(s.secs)}</span>
      <span class="pace">${pausedAt ? 'Paused' : !s.secs ? 'Untimed' : pace === 'ok' ? 'On pace' : pace === 'tight' ? 'Tight' : `${fmt(drift)} behind`}</span>
      <span class="bar"><i style="width:${Math.min(100, total / BUDGET * 100)}%"></i><b style="left:${Math.min(100, planEnd(i) / BUDGET * 100)}%"></b></span>`;
  }

  function build() {
    const shade = document.createElement('div'); shade.className = 'demo-shade';
    const spot = document.createElement('div'); spot.className = 'demo-spot';
    const box = document.createElement('div'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-live', 'polite');
    const bar = document.createElement('div'); bar.className = 'pt-control';
    document.body.append(shade, spot, box, bar);
    return { shade, spot, box, bar };
  }
  const targetOf = s => s.target ? $(s.target) : null;
  const isLive = s => s.kind === 'live';

  function place() {
    if (!active) return;
    const s = SLIDES[i], { spot, box, shade } = els;
    if (!isLive(s)) { spot.hidden = true; shade.hidden = false; box.removeAttribute('style'); return; }
    const t = targetOf(s);
    shade.hidden = true; spot.hidden = !t;
    if (!t) { box.style.left = ''; box.style.top = ''; return; }
    const r = t.getBoundingClientRect(), pad = 8, vw = innerWidth, vh = innerHeight;
    const top = Math.max(r.top - pad, 4), bottom = Math.min(r.bottom + pad, vh - 4);
    Object.assign(spot.style, { left: r.left - pad + 'px', top: top + 'px', width: r.width + pad * 2 + 'px', height: Math.max(bottom - top, 24) + 'px' });
    const bw = box.offsetWidth, bh = box.offsetHeight, gap = 14;
    let x = Math.min(Math.max(r.left, 16), vw - bw - 16), y;
    // Beside the highlight if there is room, else below or above it, else bottom-right above the control bar.
    if (r.right + gap + bw < vw - 16) { x = r.right + gap; y = Math.min(Math.max(top, 16), vh - bh - 84); }
    else if (r.left - gap - bw > 16) { x = r.left - gap - bw; y = Math.min(Math.max(top, 16), vh - bh - 84); }
    else if (bottom + gap + bh < vh - 76) y = bottom + gap; else if (top - gap - bh > 0) y = top - gap - bh; else { y = vh - bh - 84; x = vw - bw - 16; }
    box.style.left = x + 'px'; box.style.top = y + 'px';
  }

  function render() {
    const s = SLIDES[i], body = typeof s.body === 'function' ? s.body() : (s.body || '');
    if (isLive(s)) {
      const who = cfg().team[s.by]?.name || '';
      els.box.className = 'pt-live';
      els.box.innerHTML = `<div class="pt-top"><span class="pt-tag"><i>${secNo(s)}</i>${esc(s.tag || '')}</span></div><h3>${esc(s.title)}</h3><p>${body}</p>
        <div class="pt-livefoot">${who && s.secs ? `<span class="pt-presenter">Presenter <b>${esc(who)}</b></span>` : '<span></span>'}<span class="pt-livehint">Highlighted on the live site</span><img src="${IMG}waratah.png" alt=""></div>`;
    } else {
      els.box.removeAttribute('style');
      els.box.className = `present-slide pt-slide${['cover', 'aoc', 'thanks'].includes(s.kind) ? ' navy' : ''}`;
      els.box.innerHTML = s.kind === 'cover' ? cover() : s.kind === 'aoc' ? aoc() : s.kind === 'thanks' ? thanks() : frame(s, i, body);
    }
    els.bar.innerHTML = `<div class="present-timer"></div>
      <details class="present-notes" ${notesOpen ? 'open' : ''}><summary>Speaker notes <span class="muted">(N)</span></summary><p>${esc(s.notes || '')}</p></details>
      <div class="pt-nav"><span class="pt-sec">${esc(SECTIONS[s.sec])} · ${i + 1} / ${SLIDES.length}</span><button class="btn" data-go="-1" ${i === 0 ? 'disabled' : ''}>Back</button><button class="btn" data-pause>${pausedAt ? 'Resume' : 'Pause'}</button><button class="btn primary" data-go="1">${i === SLIDES.length - 1 ? 'Finish' : 'Next'}</button><button class="btn" data-stop title="End presentation (Esc)">×</button></div>`;
    $$('[data-go]', els.bar).forEach(b => b.onclick = () => go(i + Number(b.dataset.go)));
    $('[data-pause]', els.bar).onclick = togglePause;
    $('[data-stop]', els.bar).onclick = stop;
    const nd = $('.present-notes', els.bar); nd.ontoggle = () => { notesOpen = nd.open; };
    $('[data-edit-team]', els.box)?.addEventListener('click', editTeam);
    if (s.kind === 'qr') drawQr();
    tick();
  }

  // Team names and roles, and the link for the QR code. Kept in this browser only.
  function editTeam() {
    const c = cfg();
    $('.pt-content', els.box).innerHTML = `<form class="pt-edit"><table class="pt-table sm"><thead><tr><th>Name</th><th>Role</th><th>Background</th></tr></thead><tbody>${c.team.map((m, n) => `<tr><td><input data-n="${n}" data-f="name" value="${esc(m.name || '')}"></td><td><input data-n="${n}" data-f="role" value="${esc(m.role || '')}"></td><td><input data-n="${n}" data-f="note" value="${esc(m.note || '')}"></td></tr>`).join('')}</tbody></table>
      <label class="pt-url">Hosted link for the QR code <input data-url value="${esc(c.url || '')}" placeholder="https://…"></label>
      <p class="pt-src">Time each person presents: ${Object.entries(shares()).map(([n, t]) => `${esc(n)} ${fmt(t)}`).join(' · ')}</p>
      <div class="row end"><button type="button" class="btn" data-reset>Restore Team 1</button><button type="button" class="btn" data-cancel>Cancel</button><button class="btn primary">Save</button></div></form>`;
    const form = $('.pt-edit', els.box);
    $('[data-cancel]', form).onclick = render;
    $('[data-reset]', form).onclick = () => { saveCfg({ team: TEAM, url: cfg().url }); render(); };
    form.onsubmit = e => { e.preventDefault();
      const team = c.team.map((_, n) => Object.fromEntries(['name', 'role', 'note'].map(f => [f, $(`[data-n="${n}"][data-f="${f}"]`, form).value.trim()])));
      saveCfg({ team, url: $('[data-url]', form).value.trim() }); toast('Saved in this browser.'); render(); };
  }

  function drawQr() {
    const url = cfg().url, host = $('#ptQr', els.box);
    if (!url || !host) return;
    const make = () => { try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); host.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch { host.textContent = url; } };
    if (window.qrcode) return make();
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    sc.onload = make; sc.onerror = () => { host.textContent = url; };
    document.head.append(sc);
  }

  // Scroll only the nearest scrolling container (scrollIntoView also moves the page itself).
  function reveal(t) {
    let c = t.parentElement;
    while (c && c !== document.body && c !== document.documentElement) {
      const oy = getComputedStyle(c).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && c.scrollHeight > c.clientHeight + 4) break;
      c = c.parentElement;
    }
    const box = c && c !== document.body && c !== document.documentElement ? c : document.scrollingElement;
    const r = t.getBoundingClientRect(), top = box === document.scrollingElement ? 0 : box.getBoundingClientRect().top;
    const want = r.height > innerHeight * 0.6 ? 70 : Math.max(70, (innerHeight - r.height) / 2 - 60);
    box.scrollBy({ top: r.top - top - want, behavior: 'instant' });
  }

  function togglePause() {
    if (pausedAt) { const d = Date.now() - pausedAt; startedAt += d; stepAt += d; pausedAt = 0; } else pausedAt = Date.now();
    render();
  }

  function go(n) {
    if (n >= SLIDES.length) return stop();
    i = Math.max(0, Math.min(n, SLIDES.length - 1));
    stepAt = pausedAt || Date.now();
    const s = SLIDES[i];
    if (s.tab) window.App.showTab(s.tab);
    if (s.view) window.App.showView(...s.view);
    render();
    setTimeout(() => { const t = isLive(s) && targetOf(s); if (t) reveal(t); setTimeout(place, 450); }, 120);
    $('.pt-nav .primary', els.bar)?.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (!active || e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); }
    else if (e.key === 'n' || e.key === 'N') { const nd = $('.present-notes', els.bar); if (nd) { e.preventDefault(); nd.open = !nd.open; } }
  }

  function start(at = 0) {
    if (active) return;
    at = Number(at) || 0;
    if (window.DemoView?.on) toast('Demo view is on: live slides will show [DUMMY] figures. Switch it off to present real data only.', 6000);
    active = true; startedAt = stepAt = Date.now(); pausedAt = 0;
    clock = setInterval(tick, 1000);
    document.body.classList.add('demo-on', 'presenting');
    els = els || build();
    Object.values(els).forEach(el => el.hidden = false);
    addEventListener('keydown', onKey); addEventListener('resize', place); addEventListener('scroll', place, { passive: true });
    go(Math.max(0, at - 1)); // ?present=5 opens at slide 5, for rehearsing one part
  }

  function stop() {
    active = false; clearInterval(clock);
    document.body.classList.remove('demo-on', 'presenting');
    if (els) Object.values(els).forEach(el => { el.hidden = true; el.removeAttribute('style'); });
    removeEventListener('keydown', onKey); removeEventListener('resize', place); removeEventListener('scroll', place);
    const url = new URL(location.href); if (url.searchParams.has('present')) { url.searchParams.delete('present'); history.replaceState(null, '', url); }
  }

  document.addEventListener('app-ready', () => {
    $('#presentBtn')?.addEventListener('click', () => start());
    const q = new URLSearchParams(location.search);
    if (q.has('clean')) document.body.classList.add('pt-clean'); // ?present=N&clean: slide only, for exporting to PDF
    if (q.has('present')) setTimeout(() => start(q.get('present')), 600);
  });
  window.Present = { start, stop, SLIDES, BUDGET, total: () => timed.reduce((t, s) => t + s.secs, 0), shares };
})();
