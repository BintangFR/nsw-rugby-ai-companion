// Demo mode: a guided, step-by-step tour of every feature, written as pitch talking points.
// Runs on a sandbox (Store.startSandbox): anything the tour adds is sample data held in memory
// and thrown away on exit (page reload), so it never touches real records.
// Start with the "Demo" button, or open the site with ?demo in the URL. Keys: → / Enter next, ← back, Esc exit.
(() => {
  const { $, $$, esc, toast, showTab } = window.App;
  const A = window.Analytics;
  const card = sel => () => $(sel)?.closest('.card') || $(sel);

  const SAMPLE = 'DEMO SAMPLE';
  // Clearly labelled sample inputs, only ever held in the sandbox.
  const SAMPLE_KPIS = {
    'P1-01': { baseline: { label: `${SAMPLE} · 2025 season`, used: 1180, bookable: 2080 }, followup: { label: `${SAMPLE} · 2026 season (new lights)`, used: 1544, bookable: 2080 } },
    'P3-02': { baseline: { label: `${SAMPLE} · Coach L1 2025`, cost: 18400, qualified: 46 }, followup: { label: `${SAMPLE} · Coach L1 2026`, cost: 19900, qualified: 61 } },
    'P4-01': { baseline: { label: `${SAMPLE} · Girls 7s cycle 1`, cost: 12600, people: 84 }, followup: { label: `${SAMPLE} · Girls 7s cycle 2`, cost: 13100, people: 131 } },
  };
  const SAMPLE_HEALTH = { physical: 400, longActive: 250, mental: 300, cost: 150000 };

  const STEPS = [
    // Written for a non-technical audience: plain words, one idea per step, and a "why it matters" line.
    { title: 'Meet Tackle AI', mascot: 'wave', say: "G'day! I'm Tackle. Let me show you around.",
      body: `NSW Rugby is spending <b>$10 million</b> to leave a lasting legacy from the Rugby World Cup: better grounds, more coaches and referees, and more people from every community playing.<br><br>Right now that information is scattered across spreadsheets and reports. <b>Tackle AI puts it all in one place</b> and answers the questions people actually ask.`,
      why: 'Less time digging through files, more time making good decisions.',
      note: 'This tour uses practice data that is wiped when you finish. Use the buttons, or the arrow keys.' },
    { tab: 'overview', target: '#kpiRow', title: 'The whole program on one line',
      body: 'How much money is committed, where it is going (grounds, people, inclusion), and how much is still managed from head office.',
      why: 'Anyone can see the big picture in five seconds.' },
    { tab: 'overview', target: card('#map'), title: 'Where is the money going?',
      body: 'Each circle is a region of NSW. <b>Bigger and darker means more money.</b> Circles that pulse need attention. Click any circle to see the actual projects there.',
      why: 'You can see straight away if any part of the state is being missed.' },
    { tab: 'overview', target: card('#centralBar'), title: 'Is too much held in Sydney?',
      body: 'This compares money held centrally, in Greater Sydney, and in regional NSW, against where people actually live.',
      why: 'It answers the fairness question boards and government always ask.' },
    { tab: 'overview', target: card('#flagList'), title: 'Regions that need a closer look',
      body: 'The app points out regions getting much more, or much less, than their fair share, and communities with a large First Nations population but no program yet. Staff give each one a 👍 or 👎.',
      why: 'People stay in control, and the AI learns from their judgement.' },
    { tab: 'overview', target: card('#matrix'), title: 'Every region, side by side',
      body: 'Every region and every measure in one table, with the real figures. Darker cells mean more. Hover over a column heading to see how it is measured, and click it to sort.',
      why: 'You can compare regions on any measure in seconds.' },
    { tab: 'targets', target: card('#kpiProgress'), title: 'Are we on track?',
      body: 'Every goal in the plan: for grounds, for coaches and referees, and for women and girls, First Nations, Pasifika and people with disability. The blue bar is progress; the small tick is where we should be by now. <b>Ahead</b>, <b>Close</b> or <b>Behind</b> tells you at a glance.',
      why: 'Problems show up early, while there is still time to fix them. Goals can be updated as plans change.' },
    { tab: 'programs', target: '#progDetail', title: 'Zoom in on one program',
      body: 'Pick any grant or budget line to see <b>what it cost</b>, <b>what it achieved</b> (for example, cost per person reached), and how that compares with similar programs. "What\'s driving this?" explains the reasons behind the result. We have added <b>practice results</b> for three changeroom grants.',
      why: 'You can find the real cause of a good or poor result, not just the headline number.',
      before: () => {
        const P = window.Programs; if (!P) return;
        const id = (r, n) => P.idFor('grant', r, n);
        const holroyd = id('Cumberland Council', 'Holroyd Sportsgrounds female-friendly facilities');
        Store.set('programs', { ...(Store.get('programs') || {}),
          [holroyd]: { spent: 150000, coFunding: 411000, participants: 220, events: 140, status: 'Complete', note: SAMPLE },
          [id('Coffs Harbour Snappers RUC', 'Changeroom upgrades - Coffs Rugby Park')]: { spent: 112348, coFunding: 30000, participants: 160, status: 'Complete', note: SAMPLE },
          [id('Goulburn RUFC', 'Change room upgrades')]: { spent: 49025, coFunding: 5000, participants: 35, status: 'Complete', note: SAMPLE },
        });
        P.render(); P.select(holroyd);
      } },
    { tab: 'impact', target: '#lensGrid', title: 'What difference is it making?',
      body: 'Impact is shown three ways: <b>social</b> (do people feel connected and well?), <b>economic</b> (does it bring money and jobs?) and <b>cultural</b> (does it strengthen identity and belonging?). Every measure comes from a method <b>another organisation has already published</b>, such as NSW Treasury, the OECD or NSW Rugby League. The coloured bar shows which measures already have data. Hover any block to see how it is measured.',
      why: 'Our results use methods funders already trust, and we are honest about what we cannot prove yet.' },
    { tab: 'impact', target: card('#calcGrid'), title: 'Putting a dollar value on the benefits',
      body: 'These calculators use published formulas, for example the health value per participant from the Rugby For Good cost-benefit study, or the way NSW Rugby League measured its economic contribution. We have typed in <b>practice numbers</b> for the health benefit so you can see it work.',
      why: 'When the real participant numbers come in, the value can be worked out the same way a Treasury reviewer would.',
      before: () => { Store.set('methods', { ...(Store.get('methods') || {}), health: SAMPLE_HEALTH }); window.Methods?.renderCalcs(); } },
    { tab: 'impact', target: '#econCard', title: 'The money results, worked out properly',
      body: 'Nine money measures from the evaluation team\'s formula workbook, each backed by an official source. We have typed in <b>practice numbers</b> so you can see them work: for example, how well a ground is used, or the cost to train each new coach.',
      why: 'The numbers in our reports can be checked and defended.',
      before: () => { Store.set('econ', { ...(Store.get('econ') || {}), ...SAMPLE_KPIS }); window.Econ?.render(); } },
    { tab: 'impact', target: card('#evidenceForm'), title: 'Capture the stories behind the numbers',
      body: 'Staff can write down what they see and hear, like a comment from a player or a local shop owner. We have added a practice example. These stories are used in the reports alongside the figures.',
      why: 'Funders want both the numbers and the human stories.',
      before: () => {
        if (A.evidenceStore.all().some(e => e.text.startsWith(SAMPLE))) return;
        A.evidenceStore.add({ lens: 'social', region: 'Western Sydney', source: 'Participant survey', date: new Date().toISOString().slice(0, 10),
          text: `${SAMPLE}: girls at Holroyd say the new female-friendly changerooms make them feel safe to train at night.`, metric: '82% feel safe (n=45)' });
        window.Impact?.refresh();
      } },
    { tab: 'insights', target: card('#agentChips'), title: 'Five AI helpers',
      body: 'Each helper looks at one area: grounds, workforce, inclusion, fairness, or impact. They read the program information and write short findings. They run <b>on NSW Rugby\'s own computer</b>, so the information stays private.',
      why: 'It is like having five analysts check the data in minutes.' },
    { tab: 'insights', target: '#bubbles', title: 'Findings, with a suggested next step',
      body: 'Each finding explains what was found, shows the numbers behind it, and suggests what to do next. It works like an email inbox: once someone gives it a 👍 or 👎, it moves out of <b>To review</b>. Anything marked 👎 is kept out of reports.',
      why: 'Nothing goes into a report until a person has checked it.',
      before: () => { if (!window.App.insights.length) $('#runRules')?.click(); } },
    { tab: 'insights', target: '#askForm', title: 'Just ask a question',
      body: 'Type a question in everyday words, for example <i>"Which regions should get new female-friendly changerooms next?"</i>, and get an answer based on the program information.',
      why: 'No need to know spreadsheets to get answers.' },
    { tab: 'data', target: '#dropzone', title: 'Add new information',
      body: 'Drag in a spreadsheet, PDF or Word document. The app reads it, makes charts, and adds anything about regions and spending to the dashboard automatically.',
      why: 'The picture stays up to date as new information comes in.' },
    { tab: 'data', target: '#dataQuality', title: 'Is the information good enough?',
      body: 'Each file gets a traffic light: <b>green</b> (good), <b>amber</b> (usable) or <b>red</b> (too general to rely on). For red files, the app explains what better information would look like.',
      why: 'Every season, the information collected gets better.' },
    { tab: 'story', target: '.story-controls', title: 'Write the report for you',
      body: 'Choose the kind of document you need: an annual report chapter, a board summary, a funding report for the Office of Sport, a community story or a media release. Pick the tone and length, then press Generate.',
      why: 'A first draft in minutes instead of days.' },
    { tab: 'story', target: '#report', title: 'Ready to share',
      body: 'The draft comes out as a finished, branded document. You can change any wording directly on the page, then press <b>Export PDF</b> to save or print it.',
      why: 'From information to a polished report in one place.' },
    { tab: 'methodology', target: '#m-overview', title: 'How the AI gets its answers',
      body: 'This page explains, in plain words, how every figure is worked out and how the AI writes its findings. The short version: <b>the computer does the maths, the AI explains it, and a person checks it.</b> You can even read the exact information the AI is given.',
      why: 'Anyone, from a board member to an auditor, can see how the answers were reached.' },
    { title: 'Tackle AI', mascot: 'cheer', say: "That's full time! Thanks for watching.",
      body: 'One place to see <b>where the legacy money goes</b>, <b>whether it is fair</b>, <b>what difference it is making</b>, and <b>the report that proves it</b>.<br><br>Built for NSW Rugby, using its own information, on its own computers.',
      note: 'Press Finish to end the tour. The practice data is wiped.' },
  ];

  // ---------- Presentation mode ----------
  // A 15-minute talk track (secs per slide add up to exactly 15:00) for a board, funder or partner meeting.
  // body = what the audience sees; notes = what the presenter says (toggle with N). Same sandbox as the demo.
  const BUDGET = 15 * 60;
  const statusCounts = () => {
    const ks = A.kpiTargets();
    const n = s => ks.filter(k => k.status === s).length;
    return `<b>${n('Ahead') + n('Achieved')}</b> ahead, <b>${n('Close')}</b> close, <b>${n('Behind')}</b> behind and <b>${n('No data')}</b> with no data yet`;
  };
  // NSW Rugby's pain points, each paired with what Tackle AI does about it. Live figures where the app has them.
  function painPoints() {
    const q = Object.values(Store.get('quality') || {});
    const red = q.filter(x => (x.ai?.rating || x.rule?.rating) === 'red').length;
    const c = A.centralisation();
    const cov = Object.values(A.impactCoverage());
    const noData = cov.reduce((t, l) => t + l.none, 0), total = cov.reduce((t, l) => t + l.total, 0);
    return [
      ['No way to measure outcomes: NSW Rugby has no performance measurement framework or tools.', `Impact measured with methods others already publish; ${noData} of ${total} measures still need data, and the app says which.`],
      ['Hard to prove value to funders, so harder to win grants and private investment, and the story lacks hard outcomes.', 'Dollar valuations under NSW Treasury rules, and report drafts built from checked findings.'],
      [`Information scattered across spreadsheets, PDFs and Word files, much of it too high level${q.length ? ` (${red} of ${q.length} files rated red)` : ''}.`, 'One place for every file, with a data-quality traffic light and advice on better data.'],
      [`Money hard to trace: ${Math.round(c.centralShare * 100)}% of known spend sits in statewide budgets, not linked to a region.`, 'Region-by-region view of where the money goes, with the gaps flagged.'],
      ['Workforce at risk: 39.5% workforce churn, and the funded roles are wages that end in 2028.', 'Targets that update from new data, so slipping goals show up early.'],
    ];
  }

  const PRESENT = [
    { section: 'Why', secs: 30, title: 'Tackle AI: measuring the Rugby World Cup legacy', mascot: 'wave', say: "G'day! I'm Tackle.",
      body: 'A single place to see <b>where the $10 million Legacy Program money goes</b>, <b>whether it is on track</b>, and <b>what difference it is making</b>, with every figure explained.',
      notes: 'Introduce yourself and the project: UNSW Employability partnership with NSW Rugby Union, Term 3 2026. Purpose in one line: a framework and prototype tool to measure the economic and social impacts of the RWC Legacy Program.' },
    { section: 'Why', secs: 90, title: 'The pain points',
      body: () => `<ul class="pain-points">${painPoints().map(([pain, fix]) => `<li><b>${pain}</b><span>→ ${fix}</span></li>`).join('')}</ul>`,
      notes: 'Sources: points 1–2 are NSW Rugby\'s own words in the Partner Meeting 1 slides ("NSW Rugby currently has no performance measurement frameworks or tools"; it "impacts the ability to apply for more grant funding and to attract private investment" and "our storytelling"). Point 3 is the live data-quality rating of the project files. Point 4 is the live share of spend in statewide budget lines. Point 5 is the RWC Dashboard: workforce churn baseline 39.5%, and the funded roles are wages that end with the grant in 2028. Then say: the brief asked for best-practice frameworks from other codes, NSW Treasury compliant, plus a dashboard or calculator prototype. This is that prototype.' },
    { section: 'Where the money goes', secs: 30, tab: 'overview', target: '#kpiRow', title: 'The whole program at a glance',
      body: 'Known spend, the three main pillars, and how much is still held centrally. <b>Hover any number</b> to see exactly how it was added up.',
      notes: 'Hover the "Held centrally" tile to show the tooltip: statewide budget lines ÷ known spend. Point out these are known allocations from the grants list and RWC Dashboard, not audited spend.' },
    { section: 'Where the money goes', secs: 45, tab: 'overview', target: card('#map'), title: 'Is every part of NSW getting its share?',
      body: 'Each circle is a region: bigger and darker means more money. Pulsing circles are flagged as getting much more or much less than their share of the population, or as First Nations communities without a program.',
      notes: 'Click one region to open its popup. Mention the fairness check is a screening indicator to decide where to look, clearly labelled as such; it is not an impact measure.' },
    { section: 'Are we on track', secs: 75, tab: 'targets', target: card('#kpiProgress'), title: 'Are we on track?',
      body: () => `Every target in the plan, judged against the pace needed to reach it. Right now: ${statusCounts()}. Uploading new data, such as the Rugby Analytics participation export, <b>updates these automatically</b>.`,
      notes: 'Point at Accredited coaches: the uploaded Rugby Analytics seasonal data recalculates growth (latest year ÷ previous year − 1) and the status changes. Hover the bar to show where the figure came from and how the pace is worked out.' },
    { section: 'Are we on track', secs: 30, tab: 'programs', target: '#progDetail', title: 'Zoom in on a single program',
      body: 'Any grant or budget line: what it cost, what it achieved, and what is driving the result. Shown here with <b>practice results</b> for the Holroyd changerooms.',
      notes: 'Keep this short. Mention results are never estimated: no recorded results means "can\'t judge yet".',
      before: () => STEPS.find(s => s.tab === 'programs')?.before?.() },
    { section: 'What difference it makes', secs: 75, tab: 'impact', target: '#lensGrid', title: 'Impact, measured with methods others trust',
      body: 'Social, economic and cultural impact, using <b>only published methods</b>: NSW Treasury guidelines, the OECD social cohesion framework, the Rugby For Good Benefits Realisation Framework, NSW Rugby League\'s 2026 community impact study, and the Cultural Development Network. The bar shows which measures already have data.',
      notes: 'Key message: we did not invent formulas. Hover a grey block to show "no data yet" and how it would be measured (e.g. ABS General Social Survey questions with national benchmarks). Mention the new Rugby Analytics data: First Nations participants up 35% since 2022, Pasifika groups almost 4x.' },
    { section: 'What difference it makes', secs: 75, tab: 'impact', target: card('#calcGrid'), title: 'Valuing the benefits in dollars',
      body: 'Published formulas, ready for real data: health value per participant from the Rugby For Good cost-benefit study, NSW Rugby League\'s economic contribution method, and eventIMPACTS for RWC event visitors. Shown with <b>practice numbers</b>.',
      notes: 'Hover the "PV at 5%" result: present value under NSW Treasury TPG23-08 with 3% and 7% sensitivity, and a benefit-cost ratio. Stress these are benefit-transfer values until NSW Rugby collects its own participant data.',
      before: () => { Store.set('methods', { ...(Store.get('methods') || {}), health: SAMPLE_HEALTH }); window.Methods?.renderCalcs(); } },
    { section: 'What difference it makes', secs: 30, tab: 'impact', target: '#econCard', title: 'Nine economic KPIs',
      body: 'The evaluation team\'s nine formulas, each with its official source, calculated from baseline and follow-up figures. Missing data shows as "data collection required", <b>never as zero</b>.',
      notes: 'One example only: facility utilisation with the practice inputs. Move on quickly.',
      before: () => { Store.set('econ', { ...(Store.get('econ') || {}), ...SAMPLE_KPIS }); window.Econ?.render(); } },
    { section: 'How the AI works', secs: 60, tab: 'insights', target: '#bubbles', title: 'AI findings, checked by people',
      body: 'Five AI helpers write short findings with the numbers behind them and a next step. <b>Nothing reaches a report until a person has checked it</b>, and the AI learns from every 👍 and 👎.',
      notes: 'The AI runs on NSW Rugby\'s own computer, so data stays private. If the AI is offline, the rule engine fills in, so this always works in a meeting.',
      before: () => { if (!window.App.insights.length) $('#runRules')?.click(); } },
    { section: 'How the AI works', secs: 60, tab: 'methodology', target: '#m-overview', title: 'The computer does the maths, the AI explains it',
      body: 'The Methodology page shows how every figure is calculated, how the AI writes its findings, how they are fact-checked, and which published methods are used. You can read the exact information the AI is given.',
      notes: 'Walk the six-step flow: data, calculation, briefing, AI agents, checks, learning. Answer the likely question "can the AI make numbers up?": no figure on screen comes from the AI, and AI claims about regions are checked automatically against the calculated flags.' },
    { section: 'Keeping it current', secs: 30, tab: 'data', target: '#dropzone', title: 'New data, updated instantly',
      body: 'Drop in a spreadsheet, PDF or Word file. Spend, map layers, impact evidence and yearly participation figures flow straight into the dashboard and targets, and each file gets a <b>data quality traffic light</b>.',
      notes: 'Mention the participation workbook was added this way and moved the coach and referee targets.' },
    { section: 'Reporting', secs: 45, tab: 'story', target: '.story-controls', title: 'The report writes its first draft',
      body: 'Annual report chapter, board summary, funding acquittal, community story or media release, drafted from checked findings and real figures, then edited and exported to PDF.',
      notes: 'If there is time, press Generate; otherwise show a previously exported PDF.' },
    { section: 'What feedback changed', secs: 60, title: 'How feedback changed the prototype',
      body: `<ul class="feedback-changes">${[
        ['"Show how you got these numbers"', 'Every figure, heatmap column, target and impact measure now explains its calculation and source on hover.'],
        ['"Use established ways to measure impact, don\'t invent one"', 'We removed our own "spend per impact" estimate and rebuilt Impact on methods published by NSW Treasury, the OECD, NSW Rugby League, the Rugby For Good studies and the Cultural Development Network.'],
        ['"Explain how the AI gets its answers"', 'A new Methodology page: the computer does the maths, the AI explains it, a person checks it.'],
        ['"We prefer seeing the detailed figures"', 'The simplified 0–100 view is gone: every screen now shows the real figures.'],
      ].map(([was, now]) => `<li><b>${was}</b><span>${now}</span></li>`).join('')}</ul>`,
      notes: 'Say this came from the feedback session. The biggest change was the second one: we deleted figures we had made up and replaced them with published methods, and the other team now owns any new formulas.' },
    { section: 'Recommendations', secs: 60, title: 'Recommendations',
      body: `<ul class="recommendations">${[
        ['Standardise how data is gathered', 'One template for every program and grant: one row per activity with region or LGA, date or season, dollars, pillar, and counts for women & girls, First Nations, Pasifika and people with disability.'],
        ['Store it in one shared place', 'One system of record instead of spreadsheets, PDFs and screenshots. Export Rugby Analytics data directly rather than retyping dashboard screenshots.'],
        ['Use the same survey questions every time', 'ABS General Social Survey questions for social capital, CDN outcomes for culture, and the Rugby For Good pre/post questions, asked at the start and end of every program.'],
        ['Agree definitions and owners', 'Shared definitions (Rugby Analytics for participation and churn), a named owner for each measure and a reporting rhythm, as the Rugby For Good Benefits Realisation Framework sets out.'],
        ['Record delivery, not just budgets', 'An equipment register, hub attendance, Round 2 co-contributions, and statewide programs reported by region.'],
        ['Respect First Nations data', 'Collect and use First Nations data under Indigenous Data Sovereignty principles, co-designed with community.'],
      ].map(([what, how]) => `<li><b>${what}</b><span>${how}</span></li>`).join('')}</ul>`,
      notes: 'Each recommendation comes from a gap we hit. 1: many project files are rated red (too high level, no region, dates or amounts), and many targets show "No data". 2: the participation figures came from dashboard screenshots typed into a spreadsheet, and some names were cut off. 3: most social and cultural measures have no survey yet; the Rugby For Good framework lists inadequate data collection as a high risk and recommends standardised surveys plus staff training. 4: the Annual Report and Rugby Analytics count coaches differently, which is why the baseline and the uploaded growth do not match. 5: equipment recipients and hub numbers are not published, and statewide budgets cannot be traced to regions. 6: Maiam nayri Wingara principles.' },
    { section: 'Next session', secs: 75, title: 'Next session: testing and handover',
      body: '<b>Testing</b><br><b>1.</b> Test the framework and tool against Legacy pillars already delivered (Round 1 grants, funded workforce roles).<br><b>2.</b> Pilot the survey questions (ABS social capital, CDN cultural outcomes) at one club or event and check the results flow into the dashboard.<br><b>3.</b> NSW Rugby staff try it with real files: upload, check figures by hovering, and rate the AI findings.<br><br><b>Handover</b><br><b>4.</b> Handover pack: quick start, handover guide, how it works and how to maintain it.<br><b>5.</b> Pass on accounts and access, and agree who owns the data and new formulas.',
      notes: 'Testing matches Phase 2 in the partner slides: test the chosen framework and tools against delivered pillars, plus community surveying and interviews for case studies. What we will measure in testing: do staff find every figure explained, is the AI accurate (share of findings disputed), and does an upload update targets correctly. Handover: docs/HANDOVER.md, ARCHITECTURE.md and MAINTAINING.md; one-click start with boot.cmd; npm run check runs on every GitHub push. Accounts to transfer: GitHub, Vercel, AI provider, the access key and any saved data. The evaluation team owns new formulas; Tackle AI only applies published ones.' },
    { section: 'Next session', secs: 30, title: 'Thank you', mascot: 'cheer', say: "That's full time!",
      body: 'Tackle AI: <b>where the money goes</b>, <b>whether it is on track</b>, <b>what difference it makes</b>, and <b>the report that proves it</b>, built on methods others already trust.<br><br>Questions?',
      notes: 'Open for questions. Practice data is wiped when you press Finish.' },
  ];

  const MODES = {
    demo: { steps: STEPS, badge: 'Demo', exit: 'Exit demo' },
    present: { steps: PRESENT, badge: 'Presenting', exit: 'End presentation', timed: true },
  };
  let mode = 'demo', steps = STEPS;
  // Timer: total elapsed against the 15:00 budget, and time on the current slide against its allocation.
  let clock = null, startedAt = 0, stepAt = 0, pausedAt = 0, notesOpen = false;
  const fmt = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  const planEnd = n => steps.slice(0, n + 1).reduce((t, s) => t + (s.secs || 0), 0);
  function tick() {
    const el = els && $('.present-timer', els.box);
    if (!el) return;
    const now = pausedAt || Date.now();
    const total = (now - startedAt) / 1000, onStep = (now - stepAt) / 1000;
    const step = steps[i], allowed = step.secs || 0;
    const drift = total - planEnd(i); // positive = running late against the plan for this slide's end
    const pace = drift > 30 ? 'late' : drift > 0 ? 'tight' : 'ok';
    el.className = `present-timer ${pace}${pausedAt ? ' paused' : ''}`;
    el.innerHTML = `<span data-tip="Total time so far, out of the 15-minute budget.">${fmt(total)} / ${fmt(BUDGET)}</span>
      <span data-tip="Time on this slide, out of its allocation.">slide ${fmt(onStep)} / ${fmt(allowed)}</span>
      <span class="pace" data-tip="On pace if you finish this slide by ${fmt(planEnd(i))} total. Tight = up to 30 s over, late = more than 30 s over.">${pausedAt ? 'Paused' : pace === 'ok' ? 'On pace' : pace === 'tight' ? 'Tight' : `${fmt(drift)} behind`}</span>
      <span class="bar"><i style="width:${Math.min(100, total / BUDGET * 100)}%"></i><b style="left:${planEnd(i) / BUDGET * 100}%"></b></span>`;
  }

  let i = 0, active = false, els = null;

  function build() {
    const shade = document.createElement('div');
    shade.className = 'demo-shade';
    const spot = document.createElement('div');
    spot.className = 'demo-spot';
    const box = document.createElement('div');
    box.className = 'demo-card';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    document.body.append(shade, spot, box);
    return { shade, spot, box };
  }

  function targetOf(step) {
    if (!step.target) return null;
    return typeof step.target === 'function' ? step.target() : $(step.target);
  }

  function place() {
    if (!active) return;
    const step = steps[i], t = targetOf(step), { spot, box, shade } = els;
    const pad = 8, vw = innerWidth, vh = innerHeight;
    if (!t) {
      spot.hidden = true; shade.hidden = false;
      box.classList.add('center');
      box.style.left = box.style.top = '';
      return;
    }
    shade.hidden = true; spot.hidden = false;
    box.classList.remove('center');
    const r = t.getBoundingClientRect();
    const top = Math.max(r.top - pad, 4), bottom = Math.min(r.bottom + pad, vh - 4);
    Object.assign(spot.style, { left: r.left - pad + 'px', top: top + 'px', width: r.width + pad * 2 + 'px', height: Math.max(bottom - top, 24) + 'px' });
    // Card: below the target if it fits, else above, else pinned bottom-right.
    const bw = box.offsetWidth, bh = box.offsetHeight, gap = 14;
    let x = Math.min(Math.max(r.left, 16), vw - bw - 16), y;
    if (bottom + gap + bh < vh) y = bottom + gap;
    else if (top - gap - bh > 0) y = top - gap - bh;
    else { y = vh - bh - 16; x = vw - bw - 16; }
    box.style.left = x + 'px'; box.style.top = y + 'px';
  }

  function render() {
    const step = steps[i], M = MODES[mode];
    const body = typeof step.body === 'function' ? step.body() : step.body;
    els.box.classList.toggle('presenting', !!M.timed);
    els.box.innerHTML = `
      <div class="demo-top"><span class="demo-badge">${M.badge}</span>${step.section ? `<span class="demo-section">${esc(step.section)}</span>` : ''}<span class="demo-count">${i + 1} / ${steps.length}</span><button class="demo-x" aria-label="${M.exit}" title="${M.exit} (Esc)">×</button></div>
      ${M.timed ? '<div class="present-timer"></div>' : ''}
      ${step.mascot ? `<div class="demo-hero"><span class="mascot lg ${step.mascot}" aria-hidden="true"></span><div class="demo-say">${esc(step.say)}</div></div>` : ''}
      <h3>${esc(step.title)}</h3>
      ${/^\s*<(ul|ol|div)/.test(body) ? body : `<p>${body}</p>`}
      ${step.why ? `<p class="demo-why"><b>Why it matters:</b> ${esc(step.why)}</p>` : ''}
      ${step.note ? `<p class="demo-note">${esc(step.note)}</p>` : ''}
      ${step.notes ? `<details class="present-notes" ${notesOpen ? 'open' : ''}><summary>Speaker notes <span class="muted">(N)</span></summary><p>${esc(step.notes)}</p></details>` : ''}
      <div class="demo-dots">${steps.map((s, n) => `<button class="${n === i ? 'on' : n < i ? 'seen' : ''}" data-n="${n}" aria-label="Step ${n + 1}: ${esc(s.title)}" title="${esc(s.title)}${s.secs ? ` (${fmt(s.secs)})` : ''}"></button>`).join('')}</div>
      <div class="demo-nav">
        <button class="btn" data-go="-1" ${i === 0 ? 'disabled' : ''}>Back</button>
        ${M.timed ? `<button class="btn" data-pause>${pausedAt ? 'Resume' : 'Pause'} <span class="muted">(P)</span></button>` : ''}
        <button class="btn primary" data-go="1">${i === steps.length - 1 ? 'Finish' : i === 0 ? (M.timed ? 'Start' : 'Start the tour') : 'Next'}</button>
      </div>`;
    $('.demo-x', els.box).onclick = stop;
    $$('[data-go]', els.box).forEach(b => b.onclick = () => go(i + Number(b.dataset.go)));
    $$('.demo-dots button', els.box).forEach(b => b.onclick = () => go(Number(b.dataset.n)));
    const pb = $('[data-pause]', els.box); if (pb) pb.onclick = togglePause;
    const nd = $('.present-notes', els.box); if (nd) nd.ontoggle = () => { notesOpen = nd.open; };
    tick();
  }

  function togglePause() {
    if (pausedAt) { const d = Date.now() - pausedAt; startedAt += d; stepAt += d; pausedAt = 0; }
    else pausedAt = Date.now();
    render();
  }

  function go(n) {
    if (n >= steps.length) return stop();
    i = Math.max(0, Math.min(n, steps.length - 1));
    if (!pausedAt) stepAt = Date.now(); else stepAt = pausedAt;
    const step = steps[i];
    if (step.tab) showTab(step.tab);
    try { step.before?.(); } catch (e) { console.error('Demo step', e); }
    render();
    // Wait for the tab to lay out (and the map to resize) before measuring.
    setTimeout(() => {
      const t = targetOf(step);
      if (t) t.scrollIntoView({ block: t.offsetHeight > innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' });
      else scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(place, 450);
    }, 120);
    $('.demo-nav .primary', els.box)?.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (!active || e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (MODES[mode].timed && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); togglePause(); }
    else if (e.key === 'n' || e.key === 'N') { const nd = $('.present-notes', els.box); if (nd) { e.preventDefault(); nd.open = !nd.open; } }
  }

  function start(which = 'demo') {
    if (active) return;
    mode = MODES[which] ? which : 'demo';
    steps = MODES[mode].steps;
    startedAt = stepAt = Date.now(); pausedAt = 0;
    if (MODES[mode].timed) clock = setInterval(tick, 1000);
    Store.startSandbox();
    active = true;
    document.body.classList.add('demo-on');
    els = els || build();
    [els.shade, els.spot, els.box].forEach(el => el.hidden = false);
    addEventListener('keydown', onKey);
    addEventListener('resize', place);
    addEventListener('scroll', place, { passive: true });
    go(0);
  }

  function stop() {
    active = false;
    clearInterval(clock);
    // Sample data only ever lived in memory: reload to return to the real data.
    const url = new URL(location.href);
    url.searchParams.delete('demo');
    url.searchParams.delete('present');
    location.replace(url.toString());
  }

  document.addEventListener('app-ready', () => {
    $('#demoBtn')?.addEventListener('click', () => start('demo'));
    $('#presentBtn')?.addEventListener('click', () => start('present'));
    const q = new URLSearchParams(location.search);
    if (q.has('demo')) setTimeout(() => start('demo'), 600);
    else if (q.has('present')) setTimeout(() => start('present'), 600);
  });

  window.Demo = { start, stop, STEPS, PRESENT, BUDGET };
})();
