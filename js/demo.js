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
      body: 'Each column is scored out of 100, where 100 is the best-funded region. So 50 simply means "half as much as the top region". Hover over any number to see the real figure.',
      why: 'Very different numbers become easy to compare.' },
    { tab: 'targets', target: card('#kpiProgress'), title: 'Are we on track?',
      body: 'Every goal in the plan: for grounds, for coaches and referees, and for women and girls, First Nations, Pasifika and people with disability. The blue bar is progress; the small tick is where we should be by now. <b>Ahead</b>, <b>Close</b> or <b>Behind</b> tells you at a glance.',
      why: 'Problems show up early, while there is still time to fix them. Goals can be updated as plans change.' },
    { tab: 'impact', target: '#lensGrid', title: 'What difference is it making?',
      body: 'Impact is shown three ways: <b>social</b> (do people feel safe and welcome?), <b>economic</b> (does it help local business and jobs?) and <b>cultural</b> (does it bring communities together?). The coloured bar shows how much we can already prove, and what we still need to measure.',
      why: 'It is honest about what we know and what we do not know yet.' },
    { tab: 'impact', target: '#econCard', title: 'The money results, worked out properly',
      body: 'Nine money measures, each calculated the way NSW Treasury and the Office of Sport recommend. We have typed in <b>practice numbers</b> so you can see them work: for example, how well a ground is used, or the cost to train each new coach.',
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
    { title: 'Tackle AI', mascot: 'cheer', say: "That's full time! Thanks for watching.",
      body: 'One place to see <b>where the legacy money goes</b>, <b>whether it is fair</b>, <b>what difference it is making</b>, and <b>the report that proves it</b>.<br><br>Built for NSW Rugby, using its own information, on its own computers.',
      note: 'Press Finish to end the tour. The practice data is wiped.' },
  ];

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
    const step = STEPS[i], t = targetOf(step), { spot, box, shade } = els;
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
    const step = STEPS[i];
    els.box.innerHTML = `
      <div class="demo-top"><span class="demo-badge">Demo</span><span class="demo-count">${i + 1} / ${STEPS.length}</span><button class="demo-x" aria-label="Exit demo" title="Exit demo (Esc)">×</button></div>
      ${step.mascot ? `<div class="demo-hero"><span class="mascot lg ${step.mascot}" aria-hidden="true"></span><div class="demo-say">${esc(step.say)}</div></div>` : ''}
      <h3>${esc(step.title)}</h3>
      <p>${step.body}</p>
      ${step.why ? `<p class="demo-why"><b>Why it matters:</b> ${esc(step.why)}</p>` : ''}
      ${step.note ? `<p class="demo-note">${esc(step.note)}</p>` : ''}
      <div class="demo-dots">${STEPS.map((_, n) => `<button class="${n === i ? 'on' : n < i ? 'seen' : ''}" data-n="${n}" aria-label="Step ${n + 1}"></button>`).join('')}</div>
      <div class="demo-nav">
        <button class="btn" data-go="-1" ${i === 0 ? 'disabled' : ''}>Back</button>
        <button class="btn primary" data-go="1">${i === STEPS.length - 1 ? 'Finish' : i === 0 ? 'Start the tour' : 'Next'}</button>
      </div>`;
    $('.demo-x', els.box).onclick = stop;
    $$('[data-go]', els.box).forEach(b => b.onclick = () => go(i + Number(b.dataset.go)));
    $$('.demo-dots button', els.box).forEach(b => b.onclick = () => go(Number(b.dataset.n)));
  }

  function go(n) {
    if (n >= STEPS.length) return stop();
    i = Math.max(0, Math.min(n, STEPS.length - 1));
    const step = STEPS[i];
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
  }

  let prevView = null;
  function start() {
    if (active) return;
    Store.startSandbox();
    // The tour always uses the Simple view; the viewer's own choice is put back on exit.
    prevView = window.App.viewMode;
    if (prevView !== 'simple') $('#viewMode [data-v="simple"]')?.click();
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
    if (prevView && prevView !== 'simple') { try { localStorage.setItem('tackle.view', prevView); } catch {} }
    // Sample data only ever lived in memory: reload to return to the real data.
    const url = new URL(location.href);
    url.searchParams.delete('demo');
    location.replace(url.toString());
  }

  document.addEventListener('app-ready', () => {
    $('#demoBtn')?.addEventListener('click', start);
    if (new URLSearchParams(location.search).has('demo')) setTimeout(start, 600);
  });

  window.Demo = { start, stop, STEPS };
})();
