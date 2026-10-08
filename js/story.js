// Story generator: turns insights + metrics into a yearly-report narrative and exports it to PDF.
(() => {
  const { $, $$, esc, md, money, toast } = window.App;
  const A = window.Analytics, O = window.Ollama;

  const FORMATS = {
    annual: {
      label: 'Annual report chapter',
      brief: `Write a chapter for the NSW Rugby Union {year} Annual Report on the Rugby World Cup Legacy Program.
Structure: a "# " title line; a short opening paragraph; "## " sections for each included pillar (Facilities & Equipment, Programs & Workforce, Inclusion, Where the money goes, Social, economic and cultural impact); a "## Looking ahead" section. Include one "> " pull-out line that states a key figure (not a quote from a person).`,
    },
    board: {
      label: 'Board summary',
      brief: `Write a board paper summary for {year}. Structure: "# " title; "## Headline"; "## Key numbers" as bullets; "## What is working"; "## Risks"; "## Decisions for the Board" as numbered items.`,
    },
    acquittal: {
      label: 'Funding acquittal',
      brief: `Write a progress acquittal narrative for the NSW Office of Sport for {year}. Formal tone. Structure: "# " title; "## Summary"; "## Expenditure and allocation"; "## Progress against outputs and KPIs"; "## Equity and distribution of outcomes"; "## Risks and mitigations"; "## Next reporting period".`,
    },
    community: {
      label: 'Community impact story',
      brief: `Write a warm community impact story for {year} that follows the money into communities. Name real regions and projects from the data (e.g. funded grounds and programs). Structure: "# " title; narrative "## " sections; end with what comes next. Do not invent people or quotes.`,
    },
    media: {
      label: 'Media release',
      brief: `Write a media release dated {year}. Structure: "# " headline; a bold one-sentence standfirst; body paragraphs starting "SYDNEY -"; "## About the NSW Rugby World Cup Legacy Program" boilerplate. Do not invent quotes or spokespeople.`,
    },
  };

  const selectedPillars = () => $$('input[name="pillar"]:checked').map(i => i.value);

  // reportstyle.css variant per format
  const VARIANT = { annual: 'report--annual', board: 'report--board', acquittal: 'report--acquittal', community: 'report--community', media: 'report--media' };
  const PILLAR_CLASS = { 'Facilities & Equipment': 'pillar-facilities', 'Programs & Workforce': 'pillar-workforce', Inclusion: 'pillar-inclusion', Centralisation: 'pillar-centralisation' };

  function refreshFrame() {
    const c = A.centralisation();
    const p = A.pillarTotals();
    const key = $('#storyFormat').value;
    const fmt = FORMATS[key];
    const year = $('#storyYear').value || '2026';
    const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    const report = $('#report');
    report.className = `report ${VARIANT[key]}`;
    $('#coverYear').textContent = year;
    $('#reportMeta').textContent = `NSW Rugby World Cup Legacy Program · ${fmt.label} · Prepared ${today}`;
    $('#releaseMeta').hidden = $('#endMark').hidden = key !== 'media';
    $('#releaseDate').textContent = today;
    $('#reportKpis').innerHTML = [
      [money(c.knownTotal), 'Known Legacy spend', 'of the $10M program'], [money(p.fe), 'Facilities & Equipment', `${A.regionMetrics().reduce((n, r) => n + r.facilityCount, 0)} facility projects`],
      [money(p.pw), 'Programs & Workforce', 'coaches, MOs, competitions'], [money(p.inc), 'Inclusion', 'women, First Nations, Pasifika, access'],
    ].map(([v, l, s]) => `<div class="stat"><b>${v}</b><span>${l}</span><small>${s}</small></div>`).join('');
    const img = window.App.pillarChartImage();
    if (img) $('#reportChart').src = img;
    renderAppendix();
    numberSections();
  }

  // Number every .section-head in order (01 At a glance, 02 ..., appendix last).
  function numberSections() {
    $$('#report .section-num').forEach((el, i) => { el.textContent = String(i + 1).padStart(2, '0'); });
  }

  function storyInsights() {
    const pillars = selectedPillars();
    let list = window.App.insights.filter(i => pillars.includes(i.pillar));
    let fromRules = false;
    if (!list.length) { list = A.ruleInsights().filter(i => pillars.includes(i.pillar)); fromRules = true; }
    return { list, fromRules };
  }

  function renderAppendix() {
    const { list } = storyInsights();
    $('#reportAppendix').hidden = !list.length;
    $('#reportAppendix').innerHTML = list.length ? `<div class="section-head"><span class="section-num"></span><h2>Insight register</h2></div>` + list.map(i =>
      `<div class="insight ${PILLAR_CLASS[i.pillar] || ''}">
        <h4><span class="tag ${PILLAR_CLASS[i.pillar] || ''}">${esc(i.pillar)}</span>${esc(i.title)}</h4>
        <p>${esc(i.insight)}${i.action ? ` <b>Recommended:</b> ${esc(i.action)}` : ''}</p>
        ${i.evidence ? `<p class="evidence">${esc(i.evidence)}${i.region ? ' · ' + esc(i.region) : ''}</p>` : ''}
      </div>`).join('') : '';
    numberSections();
  }

  // Markdown -> report template: each "## " starts a numbered .report-section, the first paragraph
  // becomes the lede, blockquotes become pull quotes and tables become data tables.
  function setBody(markdown) {
    const m = markdown.match(/^\s*#\s+(.+)\n?/);
    if (m) { $('#reportTitle').textContent = m[1].replace(/\*+/g, '').trim(); markdown = markdown.slice(m[0].length); }
    const tmp = document.createElement('div');
    tmp.innerHTML = md(markdown);
    const out = document.createElement('div');
    let section = document.createElement('section');
    section.className = 'report-section';
    let firstP = true;
    for (const node of [...tmp.childNodes]) {
      if (node.nodeName === 'H2') {
        if (section.childNodes.length) out.appendChild(section);
        section = document.createElement('section');
        section.className = 'report-section';
        const head = document.createElement('div');
        head.className = 'section-head';
        head.innerHTML = `<span class="section-num"></span><h2>${node.innerHTML}</h2>`;
        section.appendChild(head);
        continue;
      }
      if (node.nodeName === 'P' && firstP && node.textContent.trim()) { node.classList.add('lede'); firstP = false; }
      if (node.nodeName === 'BLOCKQUOTE') node.className = 'pull-quote';
      if (node.nodeName === 'TABLE') node.classList.add('data-table');
      section.appendChild(node);
    }
    if (section.childNodes.length) out.appendChild(section);
    $('#reportBody').innerHTML = out.innerHTML;
    numberSections();
  }

  async function generate() {
    const btn = $('#generateStory');
    const { list, fromRules } = storyInsights();
    const fmtKey = $('#storyFormat').value;
    const year = $('#storyYear').value || '2026';
    const pillars = selectedPillars();
    refreshFrame();

    const ollamaReady = O.config.model && $('#ollamaStatus').classList.contains('ok');
    if (!ollamaReady) {
      setBody(templateStory(list, fmtKey, year));
      $('#storyStatus').textContent = 'Ollama is offline, so this draft was assembled from rule-based insights without AI.';
      save();
      return;
    }

    btn.disabled = true; btn.textContent = 'Writing…';
    $('#storyStatus').textContent = `Writing with ${O.config.model}${fromRules ? ' (using rule-based insights - run the agents for richer material)' : ''}…`;
    // Only files the user uploaded themselves (project files are already summarised in DATA), capped for speed.
    const uploads = pillars.includes('Uploaded data')
      ? (window.DataStudio?.datasets || []).filter(d => !d.preloaded && (d.kind === 'table' || d.kind === 'doc')).map(d => `FILE ${d.name}:\n${window.DataStudio.datasetDigest(d, 1500)}`).join('\n\n').slice(0, 4000)
      : '';
    // Shared data first (reuses Ollama's prompt cache from the agents), task last.
    const prompt = `${O.sharedContext()}

INSIGHTS:
${list.slice(0, 20).map(i => `- [${i.pillar}${i.region ? ' / ' + i.region : ''}] ${i.title}. ${i.insight}${i.action ? ' Action: ' + i.action : ''}`).join('\n')}
${uploads ? '\nUPLOADED FILES:\n' + uploads + '\n' : ''}
TASK: ${FORMATS[fmtKey].brief.replaceAll('{year}', year)}
Tone: ${$('#storyTone').value}. Length: about ${$('#storyLength').value} words. Australian English.
Cover only these areas: ${pillars.join(', ')}.
Rules: use only facts from INSIGHTS and DATA; never invent numbers, names, quotes or people; describe budgets as allocations, not money spent; be honest about risks and gaps. Do not state anything listed as DISPUTED as fact.
${pillars.includes('Impact') ? `Include a "## Social, economic and cultural impact" section with "### Social", "### Economic" and "### Cultural" sub-headings, using the IMPACT lines and FIELD EVIDENCE. Evidence records are real field notes: you may quote them, attributed to their source and region. Where a lens has no evidence, say what will be measured next.` : ''}
${$('#storyNotes').value.trim() ? 'Extra direction: ' + $('#storyNotes').value.trim() : ''}
Output markdown only.`;

    try {
      let last = 0;
      const full = await O.stream([{ role: 'system', content: O.SYSTEM }, { role: 'user', content: prompt }], (_, text) => {
        const now = performance.now();
        if (now - last > 120) { setBody(text); last = now; }
      }, { temperature: 0.6, label: 'Story', onProgress: pr => {
        $('#storyStatus').textContent = pr.phase === 'writing'
          ? `Writing with ${O.config.model}… ${pr.tokens} tokens so far`
          : `Reading the data… ${Math.round((Date.now() - pr.start) / 1000)}s (usually ~${Math.round(pr.estReadMs / 1000)}s on this machine)`;
      } });
      setBody(full);
      $('#storyStatus').textContent = `Drafted by ${O.config.model}. Click the text to edit before exporting.`;
      save();
    } catch (e) {
      setBody(templateStory(list, fmtKey, year));
      $('#storyStatus').textContent = `Ollama failed (${e.message}); showing a draft built from rule-based insights.`;
    } finally {
      btn.disabled = false; btn.textContent = 'Generate story';
    }
  }

  // Deterministic draft for when no model is available.
  function templateStory(list, fmtKey, year) {
    const c = A.centralisation();
    const p = A.pillarTotals();
    const groups = {};
    for (const i of list) (groups[i.pillar] ??= []).push(i);
    let out = `# RWC Legacy Program: ${year} in review\n\n`;
    out += `The NSW Rugby World Cup Legacy Program has ${money(c.knownTotal)} in known allocations across Round 1 grants and the NSWRU legacy dashboard: ${money(p.fe)} for facilities and equipment, ${money(p.pw)} for programs and workforce and ${money(p.inc)} for inclusion.\n\n`;
    out += `> ${(c.centralShare * 100).toFixed(0)}% of known dollars are held in statewide budgets, while ${((1 - c.feMetroShare) * 100).toFixed(0)}% of facility grants went outside Greater Sydney.\n\n`;
    for (const [pillar, items] of Object.entries(groups)) {
      out += `## ${pillar}\n\n`;
      for (const i of items) out += `**${i.title}.** ${i.insight}${i.action ? ` Next step: ${i.action}` : ''}\n\n`;
    }
    out += `## Looking ahead\n\nRound 2 outcomes from November 2026, a published equipment register and region-level reporting of statewide programs will show whether the legacy reaches every community it was designed for.\n`;
    return out;
  }

  const fileName = () => ($('#reportTitle').textContent || 'Tackle AI report').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');

  // Primary export: the browser's print-to-PDF, which honours reportstyle.css (@page running head,
  // page numbers, cover page, section page breaks) and keeps the text selectable.
  function exportPdf() {
    refreshFrame();
    document.querySelectorAll('#report [contenteditable]').forEach(n => n.blur());
    const prevTitle = document.title;
    document.title = fileName(); // becomes the suggested PDF file name
    toast('Choose "Save as PDF" as the destination.');
    setTimeout(() => {
      window.print();
      document.title = prevTitle;
    }, 300);
  }

  // Secondary: one-click download via html2pdf (pages are images; no running heads).
  async function quickDownload() {
    if (!window.html2pdf) { exportPdf(); return; }
    const el = $('#report');
    const btn = $('#downloadPdf');
    btn.disabled = true; btn.textContent = 'Rendering…';
    refreshFrame();
    el.querySelectorAll('[contenteditable]').forEach(n => n.blur());
    const prev = el.style.cssText;
    el.style.cssText += ';box-shadow:none;margin:0;width:210mm;max-width:none;';
    try {
      await html2pdf().set({
        margin: 0,
        filename: `${fileName()}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], before: '.report-section:not(:first-of-type)', avoid: ['.insight', '.report-figure', '.stat-grid', '.pull-quote', 'h2', 'h3', 'li', 'tr'] },
      }).from(el).save();
      toast('PDF downloaded.');
    } catch (e) {
      toast('Quick download failed - use Export PDF instead.');
    } finally {
      el.style.cssText = prev;
      btn.disabled = false; btn.textContent = 'Quick download';
    }
  }

  function save() {
    Store.set('story', { title: $('#reportTitle').textContent, body: $('#reportBody').innerHTML });
  }
  function restore() {
    const d = Store.get('story');
    if (d?.body) { $('#reportTitle').textContent = d.title; $('#reportBody').innerHTML = DOMPurify.sanitize(d.body); numberSections(); }
  }

  $('#generateStory').addEventListener('click', generate);
  $('#exportPdf').addEventListener('click', exportPdf);
  $('#downloadPdf').addEventListener('click', quickDownload);
  $('#copyStory').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${$('#reportTitle').textContent}\n\n${$('#reportBody').innerText}`); toast('Story copied.'); }
    catch { toast('Copy failed - select the text manually.'); }
  });
  ['#reportBody', '#reportTitle'].forEach(s => $(s).addEventListener('input', save));
  ['#storyFormat', '#storyYear'].forEach(s => $(s).addEventListener('change', refreshFrame));
  $$('input[name="pillar"]').forEach(i => i.addEventListener('change', renderAppendix));
  document.addEventListener('tab', e => { if (e.detail === 'story') refreshFrame(); });
  document.addEventListener('app-ready', () => {
    restore();
    if ($('#tab-story').classList.contains('active')) refreshFrame();
  });
})();
