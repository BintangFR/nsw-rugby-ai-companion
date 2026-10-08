// Story generator: turns insights + metrics into a yearly-report narrative and exports it to PDF.
(() => {
  const { $, $$, esc, md, money, toast } = window.App;
  const A = window.Analytics, O = window.Ollama;
  const DRAFT_KEY = 'tackle.story';

  const FORMATS = {
    annual: {
      label: 'Annual report chapter',
      brief: `Write a chapter for the NSW Rugby Union {year} Annual Report on the Rugby World Cup Legacy Program.
Structure: a "# " title line; a short opening paragraph; "## " sections for each included pillar (Facilities & Equipment, Programs & Workforce, Inclusion, Where the money goes); a "## Looking ahead" section. Include one "> " pull-out line that states a key figure (not a quote from a person).`,
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

  function refreshFrame() {
    const c = A.centralisation();
    const p = A.pillarTotals();
    const fmt = FORMATS[$('#storyFormat').value];
    $('#reportMeta').textContent = `${fmt.label} · ${$('#storyYear').value} · Prepared ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    $('#reportKpis').innerHTML = [
      [money(c.knownTotal), 'Known Legacy spend'], [money(p.fe), 'Facilities & Equipment'],
      [money(p.pw), 'Programs & Workforce'], [money(p.inc), 'Inclusion'],
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    const img = window.App.pillarChartImage();
    if (img) $('#reportChart').src = img;
    renderAppendix();
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
    $('#reportAppendix').innerHTML = list.length ? `<h2>Insight register</h2>` + list.map(i =>
      `<div class="ins"><b>${esc(i.title)}</b> <span>(${esc(i.pillar)}${i.region ? ', ' + esc(i.region) : ''})</span><br><span>${esc(i.insight)}${i.action ? ' Recommended: ' + esc(i.action) : ''}</span></div>`).join('') : '';
  }

  function setBody(markdown) {
    const m = markdown.match(/^\s*#\s+(.+)\n?/);
    if (m) { $('#reportTitle').textContent = m[1].replace(/\*+/g, '').trim(); markdown = markdown.slice(m[0].length); }
    $('#reportBody').innerHTML = md(markdown);
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
    const uploads = pillars.includes('Uploaded data') ? (window.DataStudio?.datasets || []).map(d => `FILE ${d.name}:\n${window.DataStudio.datasetDigest(d, 2500)}`).join('\n\n') : '';
    const prompt = `${FORMATS[fmtKey].brief.replaceAll('{year}', year)}

Tone: ${$('#storyTone').value}. Length: about ${$('#storyLength').value} words. Australian English.
Cover only these areas: ${pillars.join(', ')}.
Rules: use only facts from INSIGHTS and DATA; never invent numbers, names, quotes or people; describe budgets as allocations, not money spent; be honest about risks and gaps.
${$('#storyNotes').value.trim() ? 'Extra direction: ' + $('#storyNotes').value.trim() : ''}
Output markdown only.

INSIGHTS:
${list.map(i => `- [${i.pillar}${i.region ? ' / ' + i.region : ''}] ${i.title}. ${i.insight} Evidence: ${i.evidence || 'n/a'}. Action: ${i.action || 'n/a'}`).join('\n')}

DATA:
${JSON.stringify(A.contextFor('all'))}
${uploads ? '\nUPLOADED FILES:\n' + uploads : ''}`;

    try {
      let last = 0;
      const full = await O.stream([{ role: 'system', content: O.SYSTEM }, { role: 'user', content: prompt }], (_, text) => {
        const now = performance.now();
        if (now - last > 120) { setBody(text); last = now; }
      }, { temperature: 0.6 });
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

  async function exportPdf() {
    const el = $('#report');
    const btn = $('#exportPdf');
    if (!window.html2pdf) { window.print(); return; }
    btn.disabled = true; btn.textContent = 'Exporting…';
    el.querySelectorAll('[contenteditable]').forEach(n => n.blur());
    const name = ($('#reportTitle').textContent || 'Tackle AI report').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
    const prev = el.style.cssText;
    el.style.cssText += ';border:0;box-shadow:none;border-radius:0;';
    try {
      await html2pdf().set({
        margin: [14, 12, 16, 12],
        filename: `${name}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.ins', '.report-figure', '.report-kpis', 'h2', 'h3', 'blockquote', 'li'] },
      }).from(el).save();
      toast('PDF downloaded.');
    } catch (e) {
      toast('PDF export failed - opening print dialog instead.');
      window.print();
    } finally {
      el.style.cssText = prev;
      btn.disabled = false; btn.textContent = 'Export PDF';
    }
  }

  function save() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: $('#reportTitle').textContent, body: $('#reportBody').innerHTML })); } catch {}
  }
  function restore() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d?.body) { $('#reportTitle').textContent = d.title; $('#reportBody').innerHTML = DOMPurify.sanitize(d.body); }
    } catch {}
  }

  $('#generateStory').addEventListener('click', generate);
  $('#exportPdf').addEventListener('click', exportPdf);
  $('#copyStory').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${$('#reportTitle').textContent}\n\n${$('#reportBody').innerText}`); toast('Story copied.'); }
    catch { toast('Copy failed - select the text manually.'); }
  });
  ['#reportBody', '#reportTitle'].forEach(s => $(s).addEventListener('input', save));
  ['#storyFormat', '#storyYear'].forEach(s => $(s).addEventListener('change', refreshFrame));
  $$('input[name="pillar"]').forEach(i => i.addEventListener('change', renderAppendix));
  document.addEventListener('tab', e => { if (e.detail === 'story') refreshFrame(); });
  restore();
  if ($('#tab-story').classList.contains('active')) refreshFrame();
})();
