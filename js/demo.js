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
    { title: 'Meet Tackle AI',
      body: `NSW Rugby is investing <b>$10M</b> in a Rugby World Cup legacy, across facilities, workforce and inclusion. Today that story lives in a dozen spreadsheets, PDFs and board packs.<br><br><b>Tackle AI turns it into one living picture</b>: where the money goes, whether it is fair, what it is achieving, and the report that proves it.`,
      note: 'Demo mode uses sample data that disappears when you exit. Use → / ← or the buttons.' },
    { tab: 'overview', target: '#kpiRow', title: 'The program at a glance',
      body: 'Every known dollar in one row: total known spend, the three pillars, how much is <b>held centrally</b>, and how many regions are flagged as over- or under-served.' },
    { tab: 'overview', target: card('#map'), title: 'Where does the money land?',
      body: 'A NSW-only spend heatmap. Bubble size and colour show the metric you pick: total, per resident, inclusion, or social, economic and cultural impact. <b>Pulsing</b> regions are flagged. Click any region for its funded projects.' },
    { tab: 'overview', target: card('#centralBar'), title: 'Is it too centralised?',
      body: 'The question every board asks, answered with numbers: the share held in statewide budgets, Greater Sydney vs population share, and the effective number of regions funded.' },
    { tab: 'overview', target: card('#flagList'), title: 'Fairness flags, with a human in the loop',
      body: 'Regions are flagged when their share of spend is far from their share of population, or when a large First Nations community has no program. Staff rate each flag 👍/👎, and <b>the AI learns from those ratings</b>.' },
    { tab: 'overview', target: card('#matrix'), title: 'Region heatmap',
      body: 'Every region against every measure: spend, fairness, facility audit gaps and inclusion. In <b>Simple</b> view each measure is scaled 0–100 (100 = the leading region), so very different numbers can be compared at a glance. Switch to <b>Detailed</b> in the top bar for every raw figure.' },
    { tab: 'overview', target: card('#kpiProgress'), title: 'Are we on track?',
      body: 'Facilities, workforce and inclusion targets, each measured against the pace needed to hit it by its target year (the tick). 18 of 20 facilities are already funded; coaches are ahead; female participation is behind. <b>Adjust targets</b> lets staff change any target or target year, and the status updates instantly.' },
    { tab: 'impact', target: '#lensGrid', title: 'Impact through three lenses',
      body: 'Social, economic and cultural. For each lens: the spend expected to drive it, which indicators are measured today, and an honest coverage bar showing <b>what is still unmeasured</b>.' },
    { tab: 'impact', target: '#econCard', title: 'Economic KPIs, backed by formulas',
      body: 'Nine economic KPIs, each with a documented formula and an official source (NSW Treasury, Office of Sport, Sport England, ASC). We just entered <b>sample</b> data: utilisation, training cost per new coach and inclusion cost per participant are calculated instantly, and missing data never counts as zero.',
      before: () => { Store.set('econ', { ...(Store.get('econ') || {}), ...SAMPLE_KPIS }); window.Econ?.render(); } },
    { tab: 'impact', target: card('#evidenceForm'), title: 'Capture the stories numbers miss',
      body: 'Staff log what they see and hear: a survey result, a local business, a community moment. We just added one. The AI agents and the report use these records as evidence.',
      before: () => {
        if (A.evidenceStore.all().some(e => e.text.startsWith(SAMPLE))) return;
        A.evidenceStore.add({ lens: 'social', region: 'Western Sydney', source: 'Participant survey', date: new Date().toISOString().slice(0, 10),
          text: `${SAMPLE}: girls at Holroyd say the new female-friendly changerooms make them feel safe to train at night.`, metric: '82% feel safe (n=45)' });
        window.Impact?.refresh();
      } },
    { tab: 'insights', target: card('#agentChips'), title: 'Five AI analysts',
      body: 'Facilities, Workforce, Inclusion, Centralisation and Impact agents each read the same data with their own brief. They run on a <b>local model</b>, so program data never leaves NSW Rugby. Live progress shows exactly what each one is doing.' },
    { tab: 'insights', target: '#bubbles', title: 'Insights you can act on',
      body: 'Each insight comes with evidence and a recommended action. It works like an inbox: rate one and it moves from <b>To review</b> to Verified or Disputed, and disputed insights never reach the report. Re-running the agents archives the old unrated ones and hides repeats, so the list stays short. (These were made by the rule engine, which works even when the AI is offline.)',
      before: () => { if (!window.App.insights.length) $('#runRules')?.click(); } },
    { tab: 'insights', target: '#askForm', title: 'Ask anything',
      body: 'Follow-up questions in plain English, e.g. <i>"Which regions should Round 2 prioritise for female-friendly changerooms?"</i>, answered from the program data.' },
    { tab: 'data', target: '#dropzone', title: 'Bring your own data',
      body: 'Drop in Excel, CSV, PDF or Word. Tables are profiled and charted, and <b>uploads update the dashboard</b>: region + amount columns become spend, and impact columns become evidence.' },
    { tab: 'data', target: '#dataQuality', title: 'Data quality, rated',
      body: 'Every source gets a green, amber or red rating. Red means "too high level", and the AI explains what better data would look like, so collection improves every season.' },
    { tab: 'story', target: '.story-controls', title: 'From data to the annual report',
      body: 'Pick a format (annual report chapter, board summary, Office of Sport acquittal, community story or media release), set the tone and length, and generate.' },
    { tab: 'story', target: '#report', title: 'A finished, branded report',
      body: 'Cover page, numbered sections, stat grid and insight register. The text is editable, and <b>Export PDF</b> gives a print-ready document with page numbers and running headers.' },
    { title: 'Tackle AI',
      body: 'One place to see <b>where the legacy money goes</b>, <b>whether it is fair</b>, <b>what it is achieving</b>, and <b>the report that proves it</b>.<br><br>Built for NSW Rugby, running on its own data and its own machines.',
      note: 'Press Finish to leave demo mode. All sample data is discarded.' },
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
      <h3>${esc(step.title)}</h3>
      <p>${step.body}</p>
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

  function start() {
    if (active) return;
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
