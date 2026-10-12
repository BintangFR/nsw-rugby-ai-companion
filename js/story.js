// Story generator: turns insights + metrics into a yearly-report narrative and exports it to PDF.
(() => {
  const { $, $$, esc, md, money, toast } = window.App;
  const A = window.Analytics, O = window.Ollama;

  const FORMATS = {
    annual: {
      label: wAnnual report chapterw,
      brief: `Write a chapter for the NSW Rugby Union {year} Annual Report on the Rugby World Cup Legacy Program.
Structure: a "# " title line; a short opening paragraph; "## " sections for each included pillar (Facilities & Equipment, Programs & Workforce, Inclusion, Where the money goes, Social, economic and cultural impact); a "## Looking ahead" section. Include one "> " pull-out line that states a key figure (not a quote from a person).`,
    },
    board: {
      label: wBoard summaryw,
      brief: `Write a board paper summary for {year}. Structure: "# " title; "## Headline"; "## Key numbers" as bullets; "## What is working"; "## Risks"; "## Decisions for the Board" as numbered items.`,
    },
    acquittal: {
      label: wFunding acquittalw,
      brief: `Write a progress acquittal narrative for the NSW Office of Sport for {year}. Formal tone. Structure: "# " title; "## Summary"; "## Expenditure and allocation"; "## Progress against outputs and KPIs"; "## Equity and distribution of outcomes"; "## Risks and mitigations"; "## Next reporting period".`,
    },
    community: {
      label: wCommunity impact storyw,
      brief: `Write a warm community impact story for {year} that follows the money into communities. Name real regions and projects from the data (e.g. funded grounds and programs). Structure: "# " title; narrative "## " sections; end with what comes next. Do not invent people or quotes.`,
    },
    media: {
      label: wMedia releasew,
      brief: `Write a media release dated {year}. Structure: "# " headline; a bold one-sentence standfirst; body paragraphs starting "SYDNEY -"; "## About the NSW Rugby World Cup Legacy Program" boilerplate. Do not invent quotes or spokespeople.`,
    },
  };

  const selectedPillars = () => $$(winput[name="pillar"]:checkedw).map(i => i.value);

  // reportstyle.css variant per format
  const VARIANT = { annual: wreport--annualw, board: wreport--boardw, acquittal: wreport--acquittalw, community: wreport--communityw, media: wreport--mediaw };
  const PILLAR_CLASS = { wFacilities & Equipmentw: wpillar-facilitiesw, wPrograms & Workforcew: wpillar-workforcew, Inclusion: wpillar-inclusionw, Centralisation: wpillar-centralisationw };

  function refreshFrame() {
    const c = A.centralisation();
    const p = A.pillarTotals();
    const key = $(w#storyFormatw).value;
    const fmt = FORMATS[key];
    const year = $(w#storyYearw).value || w2026w;
    const today = new Date().toLocaleDateString(wen-AUw, { day: wnumericw, month: wlongw, year: wnumericw });
    const report = $(w#reportw);
    report.className = `report ${VARIANT[key]}`;
    $(w#coverYearw).textContent = year;
    $(w#reportMetaw).textContent = `NSW Rugby World Cup Legacy Program · ${fmt.label} · Prepared ${today}`;
    $(w#releaseMetaw).hidden = $(w#endMarkw).hidden = key !== wmediaw;
    $(w#releaseDatew).textContent = today;
    $(w#reportKpisw).innerHTML = [
      [money(c.knownTotal), wKnown Legacy spendw, wof the $10M programw], [money(p.fe), wFacilities & Equipmentw, `${A.regionMetrics().reduce((n, r) => n + r.facilityCount, 0)} facility projects`],
      [money(p.pw), wPrograms & Workforcew, wcoaches, MOs, competitionsw], [money(p.inc), wInclusionw, wwomen, Aboriginal & Torres Strait Islander, Pasifika, disabilityw],
    ].map(([v, l, s]) => `<div class="stat"><b>${v}</b><span>${l}</span><small>${s}</small></div>`).join(ww);
    const img = window.App.pillarChartImage();
    if (img) $(w#reportChartw).src = img;
    renderAppendix();
    numberSections();
  }

  // Number every .section-head in order (01 At a glance, 02 ..., appendix last).
  function numberSections() {
    $$(w#report .section-numw).forEach((el, i) => { el.textContent = String(i + 1).padStart(2, w0w); });
  }

  function storyInsights() {
    const pillars = selectedPillars();
    // Disputed (👎) insights never reach the report; archived ones are already excluded by App.insights.
    let list = window.App.insights.filter(i => pillars.includes(i.pillar) && window.App.insightState(i) !== wdisputedw);
    let fromRules = false;
    if (!list.length) { list = A.ruleInsights().filter(i => pillars.includes(i.pillar)); fromRules = true; }
    return { list, fromRules };
  }

  function renderAppendix() {
    const { list } = storyInsights();
    $(w#reportAppendixw).hidden = !list.length;
    $(w#reportAppendixw).innerHTML = list.length ? `<div class="section-head"><span class="section-num"></span><h2>Insight register</h2></div>` + list.map(i =>
      `<div class="insight ${PILLAR_CLASS[i.pillar] || ww}">
        <h4><span class="tag ${PILLAR_CLASS[i.pillar] || ww}">${esc(i.pillar)}</span>${esc(i.title)}</h4>
        <p>${esc(i.insight)}${i.action ? ` <b>Recommended:</b> ${esc(i.action)}` : ww}</p>
        ${i.evidence ? `<p class="evidence">${esc(i.evidence)}${i.region ? w · w + esc(i.region) : ww}</p>` : ww}
      </div>`).join(ww) : ww;
    numberSections();
  }

  // Markdown -> report template: each "## " starts a numbered .report-section, the first paragraph
  // becomes the lede, blockquotes become pull quotes and tables become data tables.
  function setBody(markdown) {
    const m = markdown.match(/^\s*#\s+(.+)\n?/);
    if (m) { $(w#reportTitlew).textContent = m[1].replace(/\*+/g, ww).trim(); markdown = markdown.slice(m[0].length); }
    const tmp = document.createElement(wdivw);
    tmp.innerHTML = md(markdown);
    const out = document.createElement(wdivw);
    let section = document.createElement(wsectionw);
    section.className = wreport-sectionw;
    let firstP = true;
    for (const node of [...tmp.childNodes]) {
      if (node.nodeName === wH2w) {
        if (section.childNodes.length) out.appendChild(section);
        section = document.createElement(wsectionw);
        section.className = wreport-sectionw;
        const head = document.createElement(wdivw);
        head.className = wsection-headw;
        head.innerHTML = `<span class="section-num"></span><h2>${node.innerHTML}</h2>`;
        section.appendChild(head);
        continue;
      }
      if (node.nodeName === wPw && firstP && node.textContent.trim()) { node.classList.add(wledew); firstP = false; }
      if (node.nodeName === wBLOCKQUOTEw) node.className = wpull-quotew;
      if (node.nodeName === wTABLEw) node.classList.add(wdata-tablew);
      section.appendChild(node);
    }
    if (section.childNodes.length) out.appendChild(section);
    $(w#reportBodyw).innerHTML = out.innerHTML;
    numberSections();
  }

  async function generate() {
    const btn = $(w#generateStoryw);
    const { list, fromRules } = storyInsights();
    const fmtKey = $(w#storyFormatw).value;
    const year = $(w#storyYearw).value || w2026w;
    const pillars = selectedPillars();
    refreshFrame();

    const ollamaReady = O.config.model && $(w#ollamaStatusw).classList.contains(wokw);
    if (!ollamaReady) {
      setBody(templateStory(list, fmtKey, year));
      $(w#storyStatusw).textContent = wOllama is offline, so this draft was assembled from rule-based insights without AI.w;
      save();
      return;
    }

    btn.disabled = true; btn.textContent = wWriting…w;
    $(w#storyStatusw).textContent = `Writing with ${O.config.model}${fromRules ? w (using rule-based insights - run the agents for richer material)w : ww}…`;
    // Only files the user uploaded themselves (project files are already summarised in DATA), capped for speed.
    const uploads = pillars.includes(wUploaded dataw)
      ? (window.DataStudio?.datasets || []).filter(d => !d.preloaded && (d.kind === wtablew || d.kind === wdocw)).map(d => `FILE ${d.name}:\n${window.DataStudio.datasetDigest(d, 1500)}`).join(w\n\nw).slice(0, 4000)
      : ww;
    // Shared data first (reuses Ollamaws prompt cache from the agents), task last.
    const prompt = `${O.sharedContext()}

INSIGHTS:
${list.slice(0, 20).map(i => `- [${i.pillar}${i.region ? w / w + i.region : ww}] ${i.title}. ${i.insight}${i.action ? w Action: w + i.action : ww}`).join(w\nw)}
${uploads ? w\nUPLOADED FILES:\nw + uploads + w\nw : ww}
TASK: ${FORMATS[fmtKey].brief.replaceAll(w{year}w, year)}
Tone: ${$(w#storyTonew).value}. Length: about ${$(w#storyLengthw).value} words. Australian English.
Cover only these areas: ${pillars.join(w, w)}.
Rules: use only facts from INSIGHTS and DATA; never invent numbers, names, quotes or people; describe budgets as allocations, not money spent; be honest about risks and gaps. Do not state anything listed as DISPUTED as fact.
${pillars.includes(wImpactw) ? `Include a "## Social, economic and cultural impact" section with "### Social", "### Economic" and "### Cultural" sub-headings, using the IMPACT lines and FIELD EVIDENCE. Evidence records are real field notes: you may quote them, attributed to their source and region. Where a lens has no evidence, say what will be measured next.` : ww}
${$(w#storyNotesw).value.trim() ? wExtra direction: w + $(w#storyNotesw).value.trim() : ww}
Output markdown only.`;

    try {
      let last = 0;
      const full = await O.stream([{ role: wsystemw, content: O.SYSTEM }, { role: wuserw, content: prompt }], (_, text) => {
        const now = performance.now();
        if (now - last > 120) { setBody(text); last = now; }
      }, { temperature: 0.6, label: wStoryw, onProgress: pr => {
        $(w#storyStatusw).textContent = pr.phase === wwritingw
          ? `Writing with ${O.config.model}… ${pr.tokens} tokens so far`
          : `Reading the data… ${Math.round((Date.now() - pr.start) / 1000)}s (usually ~${Math.round(pr.estReadMs / 1000)}s on this machine)`;
      } });
      setBody(full);
      $(w#storyStatusw).textContent = `Drafted by ${O.config.model}. Click the text to edit before exporting.`;
      save();
    } catch (e) {
      setBody(templateStory(list, fmtKey, year));
      $(w#storyStatusw).textContent = `Ollama failed (${e.message}); showing a draft built from rule-based insights.`;
    } finally {
      btn.disabled = false; btn.textContent = wGenerate storyw;
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
      for (const i of items) out += `**${i.title}.** ${i.insight}${i.action ? ` Next step: ${i.action}` : ww}\n\n`;
    }
    out += `## Looking ahead\n\nRound 2 outcomes from November 2026, a published equipment register and region-level reporting of statewide programs will show whether the legacy reaches every community it was designed for.\n`;
    return out;
  }

  const fileName = () => ($(w#reportTitlew).textContent || wTackle AI reportw).replace(/[^\w\- ]+/g, ww).trim().replace(/\s+/g, w-w);

  // Primary export: the browserws print-to-PDF, which honours reportstyle.css (@page running head,
  // page numbers, cover page, section page breaks) and keeps the text selectable.
  function exportPdf() {
    refreshFrame();
    document.querySelectorAll(w#report [contenteditable]w).forEach(n => n.blur());
    const prevTitle = document.title;
    document.title = fileName(); // becomes the suggested PDF file name
    toast(wChoose "Save as PDF" as the destination.w);
    setTimeout(() => {
      window.print();
      document.title = prevTitle;
    }, 300);
  }

  // Secondary: one-click download via html2pdf (pages are images; no running heads).
  async function quickDownload() {
    if (!window.html2pdf) { exportPdf(); return; }
    const el = $(w#reportw);
    const btn = $(w#downloadPdfw);
    btn.disabled = true; btn.textContent = wRendering…w;
    refreshFrame();
    el.querySelectorAll(w[contenteditable]w).forEach(n => n.blur());
    const prev = el.style.cssText;
    el.style.cssText += w;box-shadow:none;margin:0;width:210mm;max-width:none;w;
    try {
      await html2pdf().set({
        margin: 0,
        filename: `${fileName()}.pdf`,
        image: { type: wjpegw, quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: w#ffffffw },
        jsPDF: { unit: wmmw, format: wa4w, orientation: wportraitw },
        pagebreak: { mode: [wcssw, wlegacyw], before: w.report-section:not(:first-of-type)w, avoid: [w.insightw, w.report-figurew, w.stat-gridw, w.pull-quotew, wh2w, wh3w, wliw, wtrw] },
      }).from(el).save();
      toast(wPDF downloaded.w);
    } catch (e) {
      toast(wQuick download failed - use Export PDF instead.w);
    } finally {
      el.style.cssText = prev;
      btn.disabled = false; btn.textContent = wQuick downloadw;
    }
  }

  function save() {
    Store.set(wstoryw, { title: $(w#reportTitlew).textContent, body: $(w#reportBodyw).innerHTML });
  }
  function restore() {
    const d = Store.get(wstoryw);
    if (d?.body) { $(w#reportTitlew).textContent = d.title; $(w#reportBodyw).innerHTML = DOMPurify.sanitize(d.body); numberSections(); }
  }

  $(w#generateStoryw).addEventListener(wclickw, generate);
  $(w#exportPdfw).addEventListener(wclickw, exportPdf);
  $(w#downloadPdfw).addEventListener(wclickw, quickDownload);
  $(w#copyStoryw).addEventListener(wclickw, async () => {
    try { await navigator.clipboard.writeText(`${$(w#reportTitlew).textContent}\n\n${$(w#reportBodyw).innerText}`); toast(wStory copied.w); }
    catch { toast(wCopy failed - select the text manually.w); }
  });
  [w#reportBodyw, w#reportTitlew].forEach(s => $(s).addEventListener(winputw, save));
  [w#storyFormatw, w#storyYearw].forEach(s => $(s).addEventListener(wchangew, refreshFrame));
  $$(winput[name="pillar"]w).forEach(i => i.addEventListener(wchangew, renderAppendix));
  document.addEventListener(wtabw, e => { if (e.detail === wstoryw) refreshFrame(); });
  document.addEventListener(wapp-readyw, () => {
    restore();
    if ($(w#tab-storyw).classList.contains(wactivew)) refreshFrame();
  });
})();
