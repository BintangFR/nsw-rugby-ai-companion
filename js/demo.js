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
  // KPI Framework samples: record_type "Hypothetical", so every result is labelled "Hypothetical Example".
  const hypo = (scope, start, end, inputs) => ({ meta: { period_start: start, period_end: end, scope_id: `${SAMPLE} · ${scope}`, method_version: 'v1.0', source_ref: SAMPLE,
    record_type: 'Hypothetical', source_verification: 'Estimated', source_checks_passed: true, method_permission: 'Pending', capture_status: 'Complete', publication_approved: false }, inputs });
  const SAMPLE_KPIS = {
    'P1-01': { comparison_approved: true, waves: [hypo('Holroyd Field 1', '2025-03-01', '2025-09-30', { U: 1180, H: 2080 }), hypo('Holroyd Field 1', '2026-03-01', '2026-09-30', { U: 1544, H: 2080 })] },
    'P3-02': { comparison_approved: true, waves: [hypo('Coach Level 1', '2025-01-01', '2025-12-31', { C: 18400, N: 46 }), hypo('Coach Level 1', '2026-01-01', '2026-12-31', { C: 19900, N: 61 })] },
    'S06': { comparison_approved: false, waves: [hypo('End-of-season survey', '2026-08-01', '2026-09-30', { notatall: 4, slightly: 9, moderately: 31, very: 58, extremely: 22, na: 3, unsure: 5, pnta: 1, missing: 6 })] },
    'C03': { comparison_approved: false, waves: [hypo('End-of-season survey', '2026-08-01', '2026-09-30', { sdisagree: 2, disagree: 4, neutral: 17, agree: 61, sagree: 40, na: 6, unsure: 9, pnta: 3, missing: 2 })] },
  };
  const loadSampleKpis = () => { Store.set('kpis', { ...(Store.get('kpis') || {}), ...SAMPLE_KPIS }); window.KPIs?.render(); };

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
    { tab: 'impact', target: '#dollarCard', title: 'Putting a dollar value on the benefits',
      body: 'Economic, social and cultural value in dollars, using <b>published formulas</b> on our real numbers: the economic contribution of Legacy spending (NSW Rugby League\'s method), the health value of taking part (Rugby For Good cost-benefit study, applied to Rugby Australia\'s participant numbers), and money invested in First Nations and Pasifika programs. <b>Hover any figure</b> to see exactly how it was worked out and where each number came from.',
      why: 'Every dollar figure can be checked the same way a Treasury reviewer would check it.' },
    { tab: 'impact', target: '#kpiCard', title: 'The KPIs, worked out properly',
      body: 'The evaluation team\'s 27 KPIs: 9 economic, 8 social and 10 cultural, each calculated exactly as their formula handover says. We have typed in <b>practice numbers</b> so you can see them work, for example how well a ground is used or how many participants feel their culture is respected. Practice results are labelled <b>Hypothetical Example</b>.',
      why: 'The numbers in our reports can be checked and defended.',
      before: loadSampleKpis },
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
      body: 'Choose who the report is for: the Board, the Office of Sport, the annual report, local clubs or the media. The right pages assemble themselves from the same data, for the whole program or just one pillar, region or project.',
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
    { section: 'What difference it makes', secs: 75, tab: 'impact', target: '#dollarCard', title: 'Valuing the benefits in dollars',
      body: 'Dollar values by impact type, from published formulas run on our own data. <b>Economic:</b> contribution of Legacy spending to NSW (NSW Rugby League\'s method) and RWC visitor spending (eventIMPACTS, waiting for the survey). <b>Social:</b> health value of taking part (Rugby For Good cost-benefit values × Rugby Australia participants) and the published Rugby For Good results. <b>Cultural:</b> money invested in First Nations and Pasifika programs; cultural outcomes themselves have no published dollar method.',
      notes: 'Hover the health figure: it shows players + match officials × $237 × 74%, where each number comes from, and the 5% present value under NSW Treasury TPG23-08. Hover the economic figure to show each spend category × share kept in NSW × multiplier. Stress these are indicative benefit-transfer values until NSW Rugby collects its own program data, and that figures measuring different things are never added together.' },
    { section: 'What difference it makes', secs: 30, tab: 'impact', target: '#kpiCard', title: 'The NSW Rugby KPI framework',
      body: 'The evaluation team\'s 27 KPIs (9 economic, 8 social, 10 cultural), calculated exactly as their handover specifies. Every result says whether it is verified, estimated or hypothetical, and missing data shows as "Data Collection Required", <b>never as zero</b>.',
      notes: 'One example only: facility utilisation (practice inputs, labelled Hypothetical Example). Mention 4 cultural KPIs are deliberately inactive in the handover, and the full specification is on the Framework tab.',
      before: loadSampleKpis },
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
      body: 'One set of page templates, combined for each audience: a 3-page Board Summary, a 6-page Funding Acquittal, an Annual Report Chapter, a Community Story or a one-page Media Release. Every figure comes from the data; missing data says so.',
      notes: 'Switch the report type live (Board Summary → Funding Acquittal) to show the pages reassembling. This is our main improvement on the reference reports, which are "one report for everyone".' },
    { section: 'What feedback changed', secs: 60, title: 'How feedback changed the prototype',
      body: `<ul class="feedback-changes">${[
        ['"Show how you got these numbers"', 'Every figure, heatmap column, target and impact measure now explains its calculation and source on hover.'],
        ['"Use established ways to measure impact, don\'t invent one"', 'We removed our own "spend per impact" estimate and rebuilt Impact on methods published by NSW Treasury, the OECD, NSW Rugby League, the Rugby For Good studies and the Cultural Development Network.'],
        ['"Explain how the AI gets its answers"', 'A new Methodology page: the computer does the maths, the AI explains it, a person checks it.'],
        ['"We prefer seeing the detailed figures"', 'The simplified 0–100 view is gone: every screen now shows the real figures.'],
      ].map(([was, now]) => `<li><b>${was}</b><span>${now}</span></li>`).join('')}</ul>`,
      note: 'You saw each of these on the earlier slides, marked ★ Feedback applied.',
      notes: 'Say this came from the feedback session, and point back to the amber "Feedback applied" tags on the walkthrough slides. The biggest change was the second one: we deleted figures we had made up and replaced them with published methods, and the other team now owns any new formulas.' },
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

  // Where feedback is visible in the walkthrough: each slide title -> [feedback, what changed on this screen].
  // Shown as a "Feedback applied" tag on the card, and the highlight around the screen turns to the feedback colour.
  const FB = {
    numbers: '"Show how you got these numbers"',
    methods: '"Use established ways to measure impact, don\'t invent one"',
    ai: '"Explain how the AI gets its answers"',
    detail: '"We prefer seeing the detailed figures"',
  };
  const FEEDBACK_APPLIED = {
    'The whole program at a glance': [[FB.numbers, 'Hover any tile: it shows the exact sum and where each part comes from.']],
    'Is every part of NSW getting its share?': [[FB.detail, 'Real figures on the map, flags and region table, with no 0–100 scores.'], [FB.numbers, 'Hover the legend to see how the chosen measure is calculated.']],
    'Are we on track?': [[FB.numbers, 'Hover a bar: where the actual came from, how the pace is worked out, and the target\'s source.']],
    'Impact, measured with methods others trust': [[FB.methods, 'Our own "spend per impact" figure is gone; every block names the published framework it comes from.'], [FB.numbers, 'Hover a block for how it is measured.']],
    'Valuing the benefits in dollars': [[FB.methods, 'Only published formulas (Rugby For Good CBA, NSW Rugby League, eventIMPACTS), discounted under NSW Treasury rules.'], [FB.numbers, 'Hover a result for the full working.']],
    'The NSW Rugby KPI framework': [[FB.numbers, 'Hover a result to see the formula with the figures entered, and its source and baseline.'], [FB.methods, 'Formulas come from the evaluation team\'s handover, each with its origin and evidence status.']],
    'AI findings, checked by people': [[FB.ai, 'The AI may only use figures it is given and never invents formulas or values; claims about regions are checked automatically.']],
    'The computer does the maths, the AI explains it': [[FB.ai, 'This page is new: how every figure is calculated, how the AI writes its findings, and the exact data it reads.']],
  };
  for (const s of PRESENT) if (FEEDBACK_APPLIED[s.title]) s.feedback = FEEDBACK_APPLIED[s.title];

  // ---------- Showcase mode ----------
  // A feedback session: the same walkthrough, but each stop asks the stakeholders questions about that section instead
  // of presenting it. Answers are saved (Store 'showcase', kept even in the sandbox) and can be downloaded at the end.
  // q: the question; open: true = free-text answer only, otherwise a quick Yes / Partly / No plus notes.
  const SCALE = ['Yes', 'Partly', 'No'];
  const SHOWCASE = [
    { title: 'Your feedback, section by section', mascot: 'wave', say: "G'day! Today we'd like to hear from you.",
      body: 'We will stop at each part of Tackle AI and ask a few questions. There are no wrong answers: tell us what works, what is confusing and what is missing. Answers are saved as we go.',
      questions: [{ q: 'Who is giving feedback today (names and roles)?', open: true }] },
    { section: 'Where the money goes', tab: 'overview', target: '#kpiRow', title: 'The headline figures',
      body: 'Known spend, the three pillars, and how much is held centrally. Hover any number to see how it was added up.',
      questions: [{ q: 'Are these the right headline figures for a board or funder?' }, { q: 'Is anything missing that you would expect to see first?', open: true }] },
    { section: 'Where the money goes', tab: 'overview', target: card('#map'), title: 'The region map and flags',
      body: 'Each circle is a region; flags mark regions getting much more or less than their share of the population, and First Nations communities without a program.',
      questions: [{ q: 'Is the region view useful for your decisions?' }, { q: 'Are the "more / less than its share" flags fair to regional clubs?' }, { q: 'Which measure would you look at most on the map?', open: true }] },
    { section: 'Where the money goes', tab: 'overview', target: card('#matrix'), title: 'The region table',
      body: 'Every region and every measure side by side. Hover a column heading to see how it is measured.',
      questions: [{ q: 'Are the column explanations clear when you hover?' }, { q: 'Which columns would you add or remove?', open: true }] },
    { section: 'Are we on track', tab: 'targets', target: card('#kpiProgress'), title: 'Targets',
      body: 'Every plan target judged against the pace needed to reach it: Ahead, Close or Behind. Uploads update them automatically.',
      questions: [{ q: 'Are these the right targets and target years?' }, { q: 'Is Ahead / Close / Behind easy to understand?' }, { q: 'Are Facilities (P1) and Priority Regions (P2) covered well enough now?' }] },
    { section: 'Are we on track', tab: 'programs', target: '#progDetail', title: 'A single program',
      body: 'One grant or budget line: what it cost, what it achieved and what drives the result. Shown with practice results for the Holroyd changerooms.',
      questions: [{ q: 'Could clubs and staff record these results (spend, people reached, new coaches or referees)?' }, { q: 'Who would record them, and how often?', open: true }],
      before: () => STEPS.find(s => s.tab === 'programs')?.before?.() },
    { section: 'What difference it makes', tab: 'impact', target: '#lensGrid', title: 'Social, economic and cultural impact',
      body: 'Each impact type shows which measures from published frameworks already have data. Hover a block for how it is measured.',
      questions: [{ q: 'Do these frameworks match how NSW Rugby wants to report impact?' }, { q: 'Which "no data yet" measures could you start collecting this season?', open: true }] },
    { section: 'What difference it makes', tab: 'impact', target: '#dollarCard', title: 'Dollar value by impact',
      body: 'Economic, social and cultural value in dollars, from published formulas only. Hover any figure for the full working. Cultural outcomes have no published dollar method, so they stay as survey results.',
      questions: [{ q: 'Are you comfortable showing these indicative dollar values to funders?' }, { q: 'Is the hover explanation enough to trust a figure?' }, { q: 'Should cultural impact stay without a dollar value?' }] },
    { section: 'What difference it makes', tab: 'impact', target: '#kpiCard', title: 'The NSW Rugby KPIs',
      body: 'The evaluation team\'s 27 KPIs, calculated exactly as their handover specifies. Practice results are labelled Hypothetical Example.',
      questions: [{ q: 'Can your team supply the data these KPIs need?' }, { q: 'Which KPIs matter most to start with?', open: true }],
      before: loadSampleKpis },
    { section: 'How the AI works', tab: 'insights', target: '#bubbles', title: 'AI findings',
      body: 'Short findings with the numbers behind them and a suggested next step. Staff verify or dispute each one before it can reach a report.',
      questions: [{ q: 'Are the findings accurate and useful?' }, { q: 'Would your team review findings with 👍 / 👎 regularly?' }],
      before: () => { if (!window.App.insights.length) $('#runRules')?.click(); } },
    { section: 'Keeping it current', tab: 'data', target: '#dataQuality', title: 'Adding data and data quality',
      body: 'Drop in a spreadsheet, PDF or Word file. Each file gets a traffic light: green, amber or red (too high level).',
      questions: [{ q: 'Is the traffic light rating fair for your files?' }, { q: 'Which files would you upload regularly, and who owns them?', open: true }] },
    { section: 'Reporting', tab: 'story', target: '.story-controls', title: 'Impact reports',
      body: 'Pick a report type (Board Summary, Funding Acquittal, Annual Report Chapter, Community Story or Media Release) and a scope; the pages assemble themselves.',
      questions: [{ q: 'Does the report look like something you would send out?' }, { q: 'Which report type do you need first, and for when?', open: true }] },
    { section: 'Explaining it', tab: 'methodology', target: '#m-overview', title: 'Methodology',
      body: 'How every figure is calculated, how the AI writes its findings and how they are checked.',
      questions: [{ q: 'Is this clear enough for a board member or an auditor?' }] },
    { section: 'Wrap-up', title: 'Overall',
      body: 'Last questions, then you can see and download everything we heard today.',
      questions: [{ q: 'Would your team use Tackle AI after handover?' }, { q: 'What is the one thing we should change before handover?', open: true }, { q: 'Anything else?', open: true }] },
    { section: 'Wrap-up', title: 'What we heard today', mascot: 'cheer', say: 'Thanks for your feedback!',
      body: () => summaryHtml(),
      note: 'Answers are already saved. Download them before you finish if you want a copy for the meeting notes.' },
  ];

  let session = null; // id of the current showcase session
  const qid = (step, n) => `${step.title}#${n}`;
  const allSessions = () => Store.get('showcase') || {};
  const sessionData = () => allSessions()[session] || { started: Date.now(), answers: {} };
  function saveAnswer(id, patch) {
    const s = sessionData();
    s.answers = { ...s.answers, [id]: { ...(s.answers[id] || {}), ...patch } };
    Store.set('showcase', { ...allSessions(), [session]: s });
  }
  // Every question of the session with its answer, in walkthrough order.
  const answered = () => SHOWCASE.flatMap(s => (s.questions || []).map((q, n) => ({ section: s.section || 'Intro', step: s.title, q: q.q, ...(sessionData().answers[qid(s, n)] || {}) })));
  function summaryHtml() {
    const rows = answered().filter(a => a.rating || a.note);
    const list = rows.length ? `<ul class="sc-summary">${rows.map(a => `<li><b>${esc(a.step)}:</b> ${esc(a.q)}<span>${a.rating ? `<i class="sc-r ${a.rating.toLowerCase()}">${esc(a.rating)}</i> ` : ''}${esc(a.note || '')}</span></li>`).join('')}</ul>` : '<p>No answers recorded yet.</p>';
    return `<div>${list}<div class="row sc-dl"><button class="btn" data-sc-dl="md">Download notes (.md)</button><button class="btn" data-sc-dl="csv">Download table (.csv)</button></div></div>`;
  }
  function download(kind) {
    const rows = answered(), date = new Date(sessionData().started).toLocaleString('en-AU');
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const text = kind === 'csv'
      ? [['section', 'screen', 'question', 'answer', 'notes'].join(','), ...rows.map(a => [a.section, a.step, a.q, a.rating, a.note].map(q).join(','))].join('\r\n')
      : `# Tackle AI showcase feedback\n\n${date}\n` + SHOWCASE.filter(s => s.questions).map(s => `\n## ${s.title}\n\n` + rows.filter(a => a.step === s.title).map(a => `- **${a.q}** ${a.rating ? `${a.rating}. ` : ''}${a.note || (a.rating ? '' : '_no answer_')}`).join('\n')).join('\n') + '\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: kind === 'csv' ? 'text/csv' : 'text/markdown' }));
    a.download = `tackle-showcase-feedback-${new Date(sessionData().started).toISOString().slice(0, 10)}.${kind}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function questionsHtml(step) {
    const ans = sessionData().answers;
    return `<ol class="sc-questions">${step.questions.map((q, n) => { const id = qid(step, n), a = ans[id] || {};
      return `<li data-q="${esc(id)}"><p>${esc(q.q)}</p>
        ${q.open ? '' : `<div class="sc-scale" role="group">${SCALE.map(o => `<button type="button" class="${a.rating === o ? 'on' : ''}" data-r="${o}" aria-pressed="${a.rating === o}">${o}</button>`).join('')}</div>`}
        <textarea rows="2" placeholder="${q.open ? 'Their answer' : 'What they said (optional)'}">${esc(a.note || '')}</textarea></li>`; }).join('')}</ol>`;
  }
  function bindQuestions(box) {
    $$('.sc-questions li', box).forEach(li => {
      const id = li.dataset.q;
      $$('.sc-scale button', li).forEach(b => b.onclick = () => {
        const on = !b.classList.contains('on');
        $$('.sc-scale button', li).forEach(x => { x.classList.toggle('on', on && x === b); x.setAttribute('aria-pressed', on && x === b); });
        saveAnswer(id, { rating: on ? b.dataset.r : '' });
      });
      $('textarea', li).oninput = e => saveAnswer(id, { note: e.target.value });
    });
    $$('[data-sc-dl]', box).forEach(b => b.onclick = () => download(b.dataset.scDl));
  }

  const MODES = {
    demo: { steps: STEPS, badge: 'Demo', exit: 'Exit demo' },
    present: { steps: PRESENT, badge: 'Presenting', exit: 'End presentation', timed: true },
    showcase: { steps: SHOWCASE, badge: 'Showcase', exit: 'End showcase' },
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
    spot.classList.toggle('feedback', !!step.feedback);
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
    els.box.classList.toggle('showcasing', mode === 'showcase');
    els.box.innerHTML = `
      <div class="demo-top"><span class="demo-badge">${M.badge}</span>${step.section ? `<span class="demo-section">${esc(step.section)}</span>` : ''}<span class="demo-count">${i + 1} / ${steps.length}</span><button class="demo-x" aria-label="${M.exit}" title="${M.exit} (Esc)">×</button></div>
      ${M.timed ? '<div class="present-timer"></div>' : ''}
      ${step.mascot ? `<div class="demo-hero"><span class="mascot lg ${step.mascot}" aria-hidden="true"></span><div class="demo-say">${esc(step.say)}</div></div>` : ''}
      <h3>${esc(step.title)}</h3>
      ${step.feedback ? `<div class="feedback-applied">${step.feedback.map(([quote, what]) => `<div data-tip="${esc(`Feedback from the feedback session: ${quote}\nWhat changed on this screen: ${what}`)}"><span class="fa-tag">★ Feedback applied</span> <b>${esc(quote)}</b><span>${esc(what)}</span></div>`).join('')}</div>` : ''}
      ${/^\s*<(ul|ol|div)/.test(body) ? body : `<p>${body}</p>`}
      ${step.questions ? questionsHtml(step) : ''}
      ${step.why ? `<p class="demo-why"><b>Why it matters:</b> ${esc(step.why)}</p>` : ''}
      ${step.note ? `<p class="demo-note">${esc(step.note)}</p>` : ''}
      ${step.notes ? `<details class="present-notes" ${notesOpen ? 'open' : ''}><summary>Speaker notes <span class="muted">(N)</span></summary><p>${esc(step.notes)}</p></details>` : ''}
      <div class="demo-dots">${steps.map((s, n) => `<button class="${n === i ? 'on' : n < i ? 'seen' : ''}" data-n="${n}" aria-label="Step ${n + 1}: ${esc(s.title)}" title="${esc(s.title)}${s.secs ? ` (${fmt(s.secs)})` : ''}"></button>`).join('')}</div>
      <div class="demo-nav">
        <button class="btn" data-go="-1" ${i === 0 ? 'disabled' : ''}>Back</button>
        ${M.timed ? `<button class="btn" data-pause>${pausedAt ? 'Resume' : 'Pause'} <span class="muted">(P)</span></button>` : ''}
        <button class="btn primary" data-go="1">${i === steps.length - 1 ? 'Finish' : i === 0 ? (mode === 'demo' ? 'Start the tour' : 'Start') : 'Next'}</button>
      </div>`;
    $('.demo-x', els.box).onclick = stop;
    $$('[data-go]', els.box).forEach(b => b.onclick = () => go(i + Number(b.dataset.go)));
    $$('.demo-dots button', els.box).forEach(b => b.onclick = () => go(Number(b.dataset.n)));
    const pb = $('[data-pause]', els.box); if (pb) pb.onclick = togglePause;
    const nd = $('.present-notes', els.box); if (nd) nd.ontoggle = () => { notesOpen = nd.open; };
    bindQuestions(els.box);
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
    window.App.revealElement?.(targetOf(step)); // open the sub-view (e.g. Impact > KPIs) that holds the highlighted part
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
    if (!active || e.target.closest?.('input, textarea, select, [contenteditable="true"], .sc-questions')) return;
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
    if (mode === 'showcase') session = 'sc-' + startedAt;
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

  async function stop() {
    active = false;
    clearInterval(clock);
    // Showcase answers are real: make sure they are saved before the reload.
    if (mode === 'showcase') try { await Store.flush('showcase'); } catch {}
    // Sample data only ever lived in memory: reload to return to the real data.
    const url = new URL(location.href);
    ['demo', 'present', 'showcase'].forEach(k => url.searchParams.delete(k));
    location.replace(url.toString());
  }

  document.addEventListener('app-ready', () => {
    $('#demoBtn')?.addEventListener('click', () => start('demo'));
    $('#presentBtn')?.addEventListener('click', () => start('present'));
    $('#showcaseBtn')?.addEventListener('click', () => start('showcase'));
    const q = new URLSearchParams(location.search);
    const which = ['demo', 'present', 'showcase'].find(k => q.has(k));
    if (which) setTimeout(() => start(which), 600);
  });

  window.Demo = { start, stop, STEPS, PRESENT, SHOWCASE, BUDGET };
})();
