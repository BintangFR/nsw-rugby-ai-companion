// Data Studio: upload any file, detect its structure, prettify it, chart it,
// push region columns onto the heatmap and summarise it with the local model.
(() => {
  const { $, $$, esc, md, money, toast } = window.App;
  const A = window.Analytics, O = window.Ollama;
  const datasets = [];
  let active = null;
  let preloadText = '';

  const PROJECT_FILES = [
    'RWC_Legacy_Data_Compilation.xlsx',
    'RWC Dashboard 010926 (2).xlsx',
    'Program Logic - NSW Rugby World Cup Legacy.docx',
    'Project Plan - NSW RWC Legacy Plan - UNSW.docx',
    'NSW Rugby Union - Annual Report.pdf',
    'NSW Rugby Union Strategic Plan.pdf',
    'nsw-treasury-evidence-bank-report-2025.pdf',
    'tpg22-22-evaluation-guidelines.pdf',
  ];

  // ---------- file intake ----------
  function init() {
    const dz = $('#dropzone'), input = $('#fileInput');
    input.addEventListener('change', () => { handleFiles([...input.files]); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => handleFiles([...e.dataTransfer.files]));
    preloadProjectFiles();
  }

  // Prototype: treat the files in /Dataset as already uploaded. They load in the background,
  // feed the dashboard (duplicates of built-in data are skipped) and get a data quality rating.
  async function preloadProjectFiles() {
    for (const name of PROJECT_FILES) datasets.push({ id: 'pre-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, preloaded: true, kind: 'pending', ai: [] });
    active = datasets[0];
    renderTabs(); renderActive(); renderSources();
    let loaded = 0;
    for (const ds of datasets.filter(d => d.preloaded)) {
      await loadPreloaded(ds);
      loaded++;
      preloadText = loaded < PROJECT_FILES.length ? `· loading project files ${loaded}/${PROJECT_FILES.length}…` : '';
      renderSources();
    }
  }

  async function loadPreloaded(ds) {
    if (ds.kind !== 'pending') return;
    ds.kind = 'loading';
    try {
      const res = await fetch('Dataset/' + encodeURIComponent(ds.name));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = await parseFile(new File([await res.blob()], ds.name));
      Object.assign(ds, parsed, { id: ds.id, preloaded: true, ai: ds.ai });
      if (ds.kind === 'table') integrate(ds);
      assessQuality(ds);
    } catch (e) {
      ds.kind = 'error';
      ds.error = e.message;
    }
    renderTabs();
    if (active === ds) renderActive();
    renderSources();
  }

  async function handleFiles(files) {
    for (const file of files) {
      try {
        toast(`Reading ${file.name}…`);
        const ds = await parseFile(file);
        datasets.push(ds);
        active = ds;
        assessQuality(ds);
        if (ds.kind === 'table') {
          integrate(ds);
          const c = ds.contribution;
          if (c.spend.length || c.layers.length || c.evidence) toast(`${file.name} updated the dashboard: ${describe(c)}.`, 5000);
        }
      } catch (e) {
        console.error(e);
        toast(`Could not read ${file.name}: ${e.message}`, 5000);
      }
    }
    renderTabs();
    renderActive();
    renderSources();
  }

  // ---------- dashboard integration ----------
  const AMOUNT_RE = /amount|grant|spend|budget|cost|funding|expenditure|allocation|\$/i;
  // Exact-dollar amounts already in the built-in data; region names in source files vary, so match on amount.
  const seedAmounts = new Set(window.TACKLE_DATA.grants.map(g => Math.round(g.amount)));
  const isCodeColumn = c => /category|code|\bid\b|\bcat\b|number|no\.?$/i.test(c.name) || (c.max <= 10 && c.min >= 0 && Number.isInteger(c.max) && Number.isInteger(c.min));

  // Turn an uploaded table into spend rows, region layers and impact evidence that the dashboard reads.
  function integrate(ds) {
    const contribution = { id: ds.id, name: ds.name, ext: ds.ext, size: ds.size, created: Date.now(), spend: [], layers: [], skipped: 0, evidence: 0 };
    const evidence = [];
    for (const s of ds.sheets) {
      const regionCol = s.columns.find(c => c.region);
      const nums = s.columns.filter(c => c.type === 'number' && !c.isYear);
      const amountCol = nums.find(c => c.currency) || nums.find(c => AMOUNT_RE.test(c.name));
      const textCols = s.columns.filter(c => c.type === 'text' || c.type === 'category');

      if (regionCol && amountCol) {
        const label = textCols.find(c => /project|program|initiative|name|description|title/i.test(c.name)) || textCols[0];
        for (const r of s.rows) {
          const region = A.matchRegion(r[regionCol.name]);
          const amount = parseNum(r[amountCol.name]);
          if (!region || isNaN(amount) || amount <= 0) continue;
          if (seedAmounts.has(Math.round(amount))) { contribution.skipped++; continue; } // already in the built-in data
          const text = textCols.map(c => r[c.name]).filter(Boolean).join(' ');
          const { pillar, tags } = A.classifySpend(text);
          contribution.spend.push({ region, amount, pillar, tags, project: String(label ? r[label.name] ?? '' : '').slice(0, 120) || `${s.name} row`, type: s.name, recipient: '', town: String(r[regionCol.name] ?? '') });
        }
      }
      if (regionCol) {
        for (const col of nums.filter(c => c !== amountCol && !isCodeColumn(c)).slice(0, 3)) {
          const values = {};
          for (const r of s.rows) {
            const region = A.matchRegion(r[regionCol.name]);
            const n = parseNum(r[col.name]);
            if (region && region !== 'Statewide' && !isNaN(n)) values[region] = (values[region] || 0) + n;
          }
          if (Object.keys(values).length >= 2) contribution.layers.push({ id: `${ds.id}-${contribution.layers.length}`, label: `${col.name} (${ds.name})`, values });
        }
      }
      const lensCol = s.columns.find(c => /lens|impact/i.test(c.name) && s.rows.filter(r => O.normaliseImpact(r[c.name])).length >= s.rows.length * 0.5);
      if (lensCol) {
        const textCol = s.columns.filter(c => c !== lensCol && (c.type === 'text' || c.type === 'category')).sort((a, b) => (b.avgLen || 0) - (a.avgLen || 0))[0];
        const sourceCol = s.columns.find(c => /source/i.test(c.name));
        const dateCol = s.columns.find(c => c.type === 'date');
        const metricCol = s.columns.find(c => /metric|measure|score|result/i.test(c.name));
        for (const r of s.rows) {
          const lens = O.normaliseImpact(r[lensCol.name]);
          if (!lens || !textCol || !r[textCol.name]) continue;
          evidence.push({ lens, region: (regionCol && A.matchRegion(r[regionCol.name])) || 'Statewide', source: sourceCol ? String(r[sourceCol.name] ?? 'Upload') : 'Upload',
            text: String(r[textCol.name]), metric: metricCol ? String(r[metricCol.name] ?? '') : '', date: dateCol && r[dateCol.name] ? new Date(r[dateCol.name]).toISOString().slice(0, 10) : '',
            dataset: ds.name, datasetId: ds.id });
        }
      }
    }
    contribution.evidence = evidence.length;
    ds.contribution = contribution;
    const had = (Store.get('datasets') || []).some(d => d.id === ds.id);
    if (contribution.spend.length || contribution.layers.length || evidence.length) {
      A.saveDataset(contribution);
      if (evidence.length) {
        // re-loading the same file replaces its evidence rather than duplicating it
        Store.set('evidence', A.evidenceStore.all().filter(e => e.datasetId !== ds.id));
        A.evidenceStore.addMany(evidence);
      }
      dataChanged();
    } else if (had) {
      A.removeDataset(ds.id); // an earlier version of this file contributed data; this one doesn't
      dataChanged();
    }
  }

  function describe(c) {
    const parts = [];
    if (c.spend.length) parts.push(`${money(c.spend.reduce((s, x) => s + x.amount, 0))} spend from ${c.spend.length} rows`);
    if (c.layers.length) parts.push(`${c.layers.length} map layer${c.layers.length > 1 ? 's' : ''}`);
    if (c.evidence) parts.push(`${c.evidence} impact evidence record${c.evidence > 1 ? 's' : ''}`);
    if (c.skipped) parts.push(`${c.skipped} rows already in the dashboard skipped`);
    return parts.join(', ') || 'no region or spend columns found';
  }

  function dataChanged() {
    window.App.renderOverview();
    document.dispatchEvent(new CustomEvent('data-changed'));
  }

  async function removeContribution(id, name) {
    if (!(await window.Feedback.confirmDelete('Dataset', name))) return false;
    A.removeDataset(id);
    Store.set('evidence', A.evidenceStore.all().filter(e => e.datasetId !== id));
    const i = datasets.findIndex(d => d.id === id);
    if (i >= 0) datasets.splice(i, 1);
    if (active?.id === id) active = datasets[datasets.length - 1] || null;
    dataChanged();
    renderTabs(); renderActive(); renderSources();
    return true;
  }

  // ---------- data quality rating ----------
  const PREFERRED = 'One row per grant, facility, program or participant group, with region or LGA (and postcode), date or season, amount ($), pillar or category, and counts split by women & girls, First Nations, Pasifika/CALD and disability - plus before/after measures (participation, facility audit results, survey scores).';
  const RATING = {
    green: { label: 'Good', cls: 'positive' },
    amber: { label: 'Usable with caveats', cls: 'watch' },
    red: { label: 'Too high level', cls: 'risk' },
  };
  const DEMO_RE = /female|women|girl|gender|first nations|aboriginal|torres strait|pasifika|islander|cald|disab|all abilities/i;
  const qualityStore = () => Store.get('quality') || {};
  const qualityOf = name => qualityStore()[name] || null;
  const effectiveRating = q => q?.ai?.rating || q?.rule?.rating || null;

  // Scores how useful a dataset is for region-level, pillar-level impact analysis (0-100).
  function assessQuality(ds) {
    let checks, score;
    if (ds.kind === 'table') {
      const sheetScores = ds.sheets.map(s => {
        const n = s.rows.length;
        const cells = n * s.columns.length || 1;
        const filled = s.columns.reduce((t, c) => t + c.filled, 0);
        const entity = s.columns.some(c => (c.type === 'text' || c.type === 'category') && c.unique >= n * 0.6 && c.avgLen < 80);
        const narrative = s.columns.filter(c => c.type === 'text').some(c => c.avgLen > 90);
        const c = {
          granular: n >= 15 && entity && !narrative,
          location: s.columns.some(x => x.region),
          time: s.columns.some(x => x.type === 'date' || x.isYear || /year|date|season|period/i.test(x.name)),
          money: s.columns.some(x => x.type === 'number' && (x.currency || AMOUNT_RE.test(x.name))),
          demographics: s.columns.some(x => DEMO_RE.test(x.name)) || s.rows.slice(0, 50).some(r => Object.values(r).some(v => typeof v === 'string' && DEMO_RE.test(v) && v.length < 40)),
          completeness: filled / cells,
        };
        const sc = 25 * c.granular + 20 * c.location + 15 * c.time + 15 * c.money + 10 * c.demographics + 15 * c.completeness;
        return { name: s.name, rows: n, score: Math.round(sc), c };
      });
      const best = sheetScores.reduce((a, b) => (b.score > a.score ? b : a));
      const avg = sheetScores.reduce((t, s) => t + s.score, 0) / sheetScores.length;
      score = Math.round(best.score * 0.6 + avg * 0.4);
      const any = k => sheetScores.some(s => s.c[k]);
      checks = [
        { name: 'Row-level records (not summaries)', ok: any('granular'), detail: `${sheetScores.filter(s => s.c.granular).length} of ${sheetScores.length} tables are row-level; best: "${best.name}" (${best.rows} rows)` },
        { name: 'Region / LGA on each row', ok: any('location'), detail: any('location') ? 'Maps to NSW regions' : 'No column maps to a NSW region' },
        { name: 'Date, year or season', ok: any('time'), detail: any('time') ? 'Has a time column' : 'No date column - cannot show change over time' },
        { name: 'Dollar amounts', ok: any('money'), detail: any('money') ? 'Has amount columns' : 'No spend or budget column' },
        { name: 'Demographic breakdown', ok: any('demographics'), detail: any('demographics') ? 'Mentions women, First Nations, Pasifika or disability' : 'No split by women, First Nations, Pasifika or disability' },
        { name: 'Completeness', ok: avg >= 50, detail: `${Math.round(sheetScores.reduce((t, s) => t + s.c.completeness, 0) / sheetScores.length * 100)}% of cells filled` },
      ];
      ds.sheetQuality = sheetScores;
    } else {
      const text = ds.text || '';
      const regionsMentioned = new Set(Object.entries(window.TACKLE_DATA.aliases).filter(([, al]) => al.some(a => a.length > 4 && text.toLowerCase().includes(a))).map(([n]) => n));
      const years = (text.match(/\b20(1\d|2\d)\b/g) || []).map(Number);
      const latest = years.length ? Math.max(...years) : null;
      const dollars = (text.match(/\$\s?\d[\d,.]*\s?(k|m|million|billion)?/gi) || []).length;
      const fresh = latest && latest >= new Date().getFullYear() - 1;
      checks = [
        { name: 'Row-level records (not summaries)', ok: false, detail: 'Narrative document - figures are summaries, not records the dashboard can count' },
        { name: 'Region / LGA detail', ok: regionsMentioned.size >= 4, detail: `${regionsMentioned.size} NSW regions mentioned in the text` },
        { name: 'Up to date', ok: !!fresh, detail: latest ? `Latest year mentioned: ${latest}` : 'No years found' },
        { name: 'Dollar figures', ok: dollars >= 5, detail: `${dollars} dollar figures found` },
        { name: 'Demographic breakdown', ok: DEMO_RE.test(text), detail: DEMO_RE.test(text) ? 'Mentions inclusion groups' : 'No inclusion groups mentioned' },
      ];
      score = Math.round(10 + 8 * (regionsMentioned.size >= 4) + 8 * !!fresh + 8 * (dollars >= 5) + 6 * DEMO_RE.test(text));
    }
    const rating = score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red';
    const issues = checks.filter(c => !c.ok).map(c => `${c.name}: ${c.detail}`);
    const all = qualityStore();
    Store.set('quality', { ...all, [ds.name]: { ...(all[ds.name] || {}), rule: { score, rating, checks, issues, assessed: Date.now() } } });
    return all[ds.name];
  }

  async function aiRateQuality(ds) {
    if (!window.App.requireModel()) return;
    const q = qualityOf(ds.name);
    const btn = $('#aiQuality');
    if (btn) { btn.disabled = true; btn.textContent = 'AI is rating…'; }
    try {
      const prompt = `You review data quality for the NSW Rugby World Cup Legacy impact dashboard.
The dashboard needs data at this level: ${PREFERRED}
Rate the uploaded file:
- "red" if it is too high level (narrative, statewide totals only, no region, no dates, no amounts) or outdated,
- "amber" if partly usable,
- "green" only if it is row-level with location, time and amounts.
Return JSON: {"rating":"red|amber|green","score":0-100,"verdict":"one sentence","issues":["..."],"whatWeNeed":"what better data would look like for this file","nextSteps":["2-3 concrete ways to collect it, e.g. surveys, equipment register, refreshing outdated data"]}

FILE: ${ds.name}
AUTOMATED CHECKS: ${JSON.stringify(q?.rule?.checks || [])}
CONTENT SAMPLE:
${datasetDigest(ds, 3500)}`;
      const j = O.parseJson(await O.chat([{ role: 'system', content: O.SYSTEM }, { role: 'user', content: prompt }], { json: true }));
      if (!j?.rating) throw new Error('No rating returned');
      const ai = {
        rating: ['red', 'amber', 'green'].includes(String(j.rating).toLowerCase()) ? String(j.rating).toLowerCase() : 'amber',
        score: Number(j.score) || null, verdict: String(j.verdict || ''), issues: (j.issues || []).map(String).slice(0, 6),
        whatWeNeed: String(j.whatWeNeed || ''), nextSteps: (j.nextSteps || []).map(String).slice(0, 4), model: O.config.model, assessed: Date.now(),
      };
      const all = qualityStore();
      Store.set('quality', { ...all, [ds.name]: { ...(all[ds.name] || {}), ai } });
      if (ai.rating === 'red') window.App.addInsights([{ pillar: 'Data quality', severity: 'risk', agent: 'Data quality agent', title: `Red flag: ${ds.name}`, insight: ai.verdict, evidence: ai.issues.join('; '), action: ai.nextSteps.join(' ') || ai.whatWeNeed }]);
    } catch (e) {
      toast('AI quality rating failed: ' + e.message, 5000);
    } finally {
      renderTabs(); renderSources();
      if (active === ds) renderActive();
    }
  }

  async function aiRateAll() {
    if (!window.App.requireModel()) return;
    const btn = $('#rateAll');
    btn.disabled = true;
    const ready = datasets.filter(d => d.kind === 'table' || d.kind === 'doc');
    for (let i = 0; i < ready.length; i++) {
      btn.textContent = `Rating ${i + 1}/${ready.length}…`;
      await aiRateQuality(ready[i]);
    }
    btn.disabled = false; btn.textContent = 'Rate all with AI';
    toast('AI finished rating data quality.');
  }

  function qualityDot(name) {
    const r = effectiveRating(qualityOf(name));
    return r ? `<span class="q-dot ${r}" title="Data quality: ${RATING[r].label}"></span>` : '';
  }

  function qualityPanel(ds) {
    const q = qualityOf(ds.name);
    if (!q?.rule) return '';
    const r = effectiveRating(q);
    const ai = q.ai;
    return `<div class="quality ${r}">
      <div class="q-head">
        <span class="q-flag ${r}">${r === 'red' ? '⚑ ' : ''}${RATING[r].label}</span>
        <b>Data quality ${ai?.score ?? q.rule.score}/100</b>
        <span class="muted small">${ai ? `AI review by ${esc(ai.model)}` : 'Automated check'} · rule score ${q.rule.score}</span>
        <button class="btn" id="aiQuality">${ai ? 'Re-rate with AI' : 'AI rate quality'}</button>
      </div>
      ${ai?.verdict ? `<p><b>AI verdict:</b> ${esc(ai.verdict)}</p>` : ''}
      <ul class="q-checks">${q.rule.checks.map(c => `<li class="${c.ok ? 'ok' : 'bad'}"><span>${c.ok ? '✓' : '✗'}</span><b>${esc(c.name)}</b> <span class="muted">${esc(c.detail)}</span></li>`).join('')}</ul>
      ${ai?.issues?.length ? `<p class="small"><b>Issues:</b> ${ai.issues.map(esc).join(' · ')}</p>` : ''}
      <p class="small"><b>What the AI prefers:</b> ${esc(ai?.whatWeNeed || PREFERRED)}</p>
      ${ai?.nextSteps?.length ? `<p class="small"><b>Next time:</b> ${ai.nextSteps.map(esc).join(' · ')}</p>` : ''}
    </div>`;
  }

  // Everything currently feeding the dashboard (persists across reloads).
  function renderSources() {
    const preloadedIds = new Set(datasets.filter(d => d.preloaded).map(d => d.id));
    const list = (Store.get('datasets') || []).filter(d => !preloadedIds.has(d.id));
    const el = $('#sourcesCard');
    const qLine = name => {
      const q = qualityOf(name), r = effectiveRating(q);
      return r ? `<span class="q-flag ${r}">${r === 'red' ? '⚑ ' : ''}${RATING[r].label} · ${q.ai?.score ?? q.rule.score}/100${q.ai ? ' · AI' : ''}</span>` : '<span class="muted small">Not rated yet</span>';
    };
    const project = datasets.filter(d => d.preloaded);
    const counts = { red: 0, amber: 0, green: 0 };
    for (const d of datasets) { const r = effectiveRating(qualityOf(d.name)); if (r) counts[r]++; }
    el.innerHTML = `<div class="card-head"><div><h2>Data feeding the dashboard</h2>
        <p class="muted">${counts.green} good · ${counts.amber} usable with caveats · ${counts.red} flagged red <span id="preloadStatus">${preloadText}</span></p></div>
        <div class="controls"><button class="btn primary" id="rateAll">Rate all with AI</button></div></div>
      <ul class="sources">
        <li><span class="status positive">Built in</span><span class="grow"><b>Compiled seed data</b><br><span class="muted small">38 Round 1 grants, 24 dashboard budget lines, KPIs and impact indicators (from the files below)</span></span></li>
        ${project.map(d => `<li><span class="status watch">Project file</span><span class="grow"><b>${esc(d.name)}</b><br><span class="muted small">${d.kind === 'pending' || d.kind === 'loading' ? 'Loading…' : d.kind === 'error' ? 'Could not load' : d.contribution ? describe(d.contribution) : d.kind === 'doc' ? 'Document - used for AI summaries and stories' : 'No region or spend columns'}</span></span>
          ${qLine(d.name)}<button class="btn" data-open="${esc(d.id)}">Open</button></li>`).join('')}
        ${list.map(d => `<li><span class="status watch">Uploaded</span><span class="grow"><b>${esc(d.name)}</b><br><span class="muted small">${describe(d)} · ${new Date(d.created).toLocaleDateString('en-AU')}</span></span>
          ${qLine(d.name)}<button class="btn" data-remove="${esc(d.id)}" data-name="${esc(d.name)}">Remove</button></li>`).join('')}
      </ul>
      <p class="footnote">Uploads with a region column and an amount column are added as spend. Other numeric region columns become map layers, and a "lens" or "impact" column (social / economic / cultural) is imported as impact evidence.</p>`;
    $$('[data-remove]', el).forEach(b => b.addEventListener('click', () => removeContribution(b.dataset.remove, b.dataset.name)));
    $$('[data-open]', el).forEach(b => b.addEventListener('click', () => {
      active = datasets.find(d => d.id === b.dataset.open);
      renderTabs(); renderActive();
      if (active.kind === 'pending') loadPreloaded(active);
      $('#datasetTabs').scrollIntoView({ behavior: 'smooth' });
    }));
    $('#rateAll').addEventListener('click', aiRateAll);
  }

  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const base = { id: Math.random().toString(36).slice(2), name: file.name, size: file.size, ext, ai: [] };
    if (['xlsx', 'xls', 'xlsm', 'csv', 'tsv'].includes(ext)) {
      const wb = ['csv', 'tsv'].includes(ext)
        ? XLSX.read(await file.text(), { type: 'string', cellDates: true })
        : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheets = wb.SheetNames.map(n => tableFromAoa(n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true })))
        .filter(s => s.rows.length);
      if (!sheets.length) throw new Error('No tabular data found');
      return { ...base, kind: 'table', sheets, sheet: 0 };
    }
    if (ext === 'json') {
      const data = JSON.parse(await file.text());
      const tables = jsonTables(data);
      if (tables.length) return { ...base, kind: 'table', sheets: tables, sheet: 0 };
      return { ...base, kind: 'doc', text: JSON.stringify(data, null, 2), html: `<pre>${esc(JSON.stringify(data, null, 2))}</pre>` };
    }
    if (ext === 'pdf') {
      const text = await pdfText(file);
      return { ...base, kind: 'doc', text, html: prettifyText(text) };
    }
    if (ext === 'docx') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
      const buf = await file.arrayBuffer();
      const [{ value: html }, { value: text }] = await Promise.all([
        mammoth.convertToHtml({ arrayBuffer: buf }), mammoth.extractRawText({ arrayBuffer: buf }),
      ]);
      return { ...base, kind: 'doc', text, html: DOMPurify.sanitize(html) };
    }
    const text = await file.text();
    // A text file that is really a delimited table
    const firstLines = text.split(/\r?\n/).slice(0, 5);
    if (firstLines.length > 1 && firstLines.every(l => (l.match(/,|\t/g) || []).length >= 2)) {
      const wb = XLSX.read(text, { type: 'string', cellDates: true });
      const s = tableFromAoa(file.name, XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true }));
      if (s.rows.length) return { ...base, kind: 'table', sheets: [s], sheet: 0 };
    }
    return { ...base, kind: 'doc', text, html: ext === 'md' ? md(text) : prettifyText(text) };
  }

  function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async function pdfText(file) {
    // Loading the worker script on the page makes pdf.js parse on the main thread; a cross-origin
    // Worker from the CDN is blocked by browsers and would hang.
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      const lines = [];
      let lastY = null, line = '';
      for (const item of content.items) {
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = ''; }
        line += item.str + (item.hasEOL ? '' : ' ');
        lastY = y;
      }
      lines.push(line.trim());
      pages.push(lines.filter(Boolean).join('\n'));
    }
    return pages.join('\n\n');
  }

  // ---------- structure detection ----------
  function tableFromAoa(name, aoa) {
    const rows = aoa.filter(r => r && r.some(v => v !== null && String(v).trim() !== ''));
    if (!rows.length) return { name, columns: [], rows: [] };
    const width = Math.max(...rows.map(r => r.length));
    let h = 0;
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const cells = rows[i].filter(v => v !== null && String(v).trim() !== '');
      const strings = cells.filter(v => typeof v === 'string' && isNaN(parseNum(v)));
      if (cells.length >= Math.max(2, width * 0.5) && strings.length >= cells.length * 0.6) { h = i; break; }
    }
    const seen = {};
    const headers = Array.from({ length: width }, (_, i) => {
      let n = String(rows[h][i] ?? '').replace(/\s+/g, ' ').trim() || `Column ${i + 1}`;
      if (seen[n]) n += ' ' + (++seen[n]); else seen[n] = 1;
      return n;
    });
    const objs = rows.slice(h + 1).map(r => Object.fromEntries(headers.map((k, i) => [k, r[i] ?? null])));
    const columns = headers.map(k => profileColumn(k, objs.map(o => o[k]))).filter(c => c.filled > 0);
    return { name, columns, rows: objs };
  }

  function jsonTables(data) {
    const isRows = a => Array.isArray(a) && a.length && a.every(x => x && typeof x === 'object' && !Array.isArray(x));
    const fromRows = (name, arr) => {
      const keys = [...new Set(arr.flatMap(o => Object.keys(o)))];
      const rows = arr.map(o => Object.fromEntries(keys.map(k => [k, typeof o[k] === 'object' && o[k] !== null ? JSON.stringify(o[k]) : o[k] ?? null])));
      return { name, columns: keys.map(k => profileColumn(k, rows.map(r => r[k]))), rows };
    };
    if (isRows(data)) return [fromRows('data', data)];
    if (data && typeof data === 'object') return Object.entries(data).filter(([, v]) => isRows(v)).map(([k, v]) => fromRows(k, v));
    return [];
  }

  function parseNum(v) {
    if (typeof v === 'number') return v;
    if (v == null || v instanceof Date) return NaN;
    let s = String(v).trim();
    if (!s) return NaN;
    const neg = /^\(.*\)$/.test(s);
    s = s.replace(/[()$,\s%]|AUD|US\$/gi, '');
    const m = s.match(/^(-?\d*\.?\d+)([kKmMbB])?$/);
    if (!m) return NaN;
    let n = parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1);
    return neg ? -n : n;
  }

  const MONEY_RE = /\$|budget|cost|amount|grant|spend|revenue|expense|funding|salary|price|value \(\$\)/i;
  function profileColumn(name, values) {
    const filled = values.filter(v => v !== null && String(v).trim() !== '');
    const col = { name, filled: filled.length, total: values.length, type: 'text' };
    if (!filled.length) return col;
    const nums = filled.map(parseNum);
    const numOk = nums.filter(n => !isNaN(n));
    const dates = filled.filter(v => v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v.trim())));
    const regionHits = filled.filter(v => typeof v === 'string' && A.matchRegion(v)).length;

    if (dates.length >= filled.length * 0.8) {
      col.type = 'date';
      const ds = dates.map(v => v instanceof Date ? v : new Date(v)).filter(d => !isNaN(d));
      col.min = new Date(Math.min(...ds)); col.max = new Date(Math.max(...ds));
    } else if (numOk.length >= filled.length * 0.8) {
      col.type = 'number';
      col.currency = MONEY_RE.test(name) || filled.some(v => typeof v === 'string' && v.includes('$'));
      const pctSign = filled.some(v => typeof v === 'string' && v.includes('%'));
      const allFraction = numOk.every(n => Math.abs(n) <= 1.5);
      col.percent = col.currency ? false : pctSign ? 'whole' : (/%|share|rate|percent/i.test(name) && allFraction) ? 'fraction' : false;
      col.sum = numOk.reduce((a, b) => a + b, 0);
      col.mean = col.sum / numOk.length;
      col.min = Math.min(...numOk); col.max = Math.max(...numOk);
      col.isYear = !col.currency && numOk.every(n => Number.isInteger(n) && n >= 1900 && n <= 2100);
    } else {
      const counts = {};
      for (const v of filled) { const k = String(v).trim(); counts[k] = (counts[k] || 0) + 1; }
      const uniq = Object.keys(counts).length;
      const avgLen = filled.reduce((s, v) => s + String(v).length, 0) / filled.length;
      col.unique = uniq; col.avgLen = avgLen;
      col.top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (uniq <= Math.max(12, filled.length * 0.5) && avgLen < 45 && filled.length >= 3) col.type = 'category';
    }
    if (regionHits >= filled.length * 0.5) col.region = true;
    return col;
  }

  function fmt(col, v) {
    if (v === null || v === undefined || String(v).trim() === '') return '<span class="muted">–</span>';
    if (col.type === 'number') {
      const n = parseNum(v);
      if (isNaN(n)) return esc(v);
      if (col.isYear) return String(n);
      if (col.currency) return '$' + n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 });
      if (col.percent === 'fraction') return (n * 100).toFixed(1) + '%';
      if (col.percent === 'whole') return n.toLocaleString() + '%';
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (col.type === 'date') { const d = v instanceof Date ? v : new Date(v); return isNaN(d) ? esc(v) : d.toLocaleDateString('en-AU'); }
    if (col.type === 'category' || col.region) return `<span class="chip">${esc(v)}</span>`;
    const s = String(v);
    return esc(s.length > 220 ? s.slice(0, 220) + '…' : s).replace(/\n/g, '<br>');
  }

  function statLine(col) {
    if (col.type === 'number') {
      const f = v => fmt(col, v).replace(/<[^>]+>/g, '');
      return `${col.currency ? 'Total ' + f(col.sum) + '<br>' : ''}Avg ${f(col.mean)} · Range ${f(col.min)} – ${f(col.max)}`;
    }
    if (col.type === 'date') return `${col.min.toLocaleDateString('en-AU')} – ${col.max.toLocaleDateString('en-AU')}`;
    return `${col.unique} unique${col.top ? '<br>Top: ' + col.top.map(([k, n]) => `${esc(k.slice(0, 24))} (${n})`).join(', ') : ''}`;
  }

  function prettifyText(text) {
    const blocks = text.replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    return blocks.map(b => {
      const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 1 && lines[0].length < 80 && !/[.,;:]$/.test(lines[0]) && /^[A-Z0-9]/.test(lines[0]) && lines[0].split(' ').length <= 10)
        return `<h3>${esc(lines[0])}</h3>`;
      if (lines.every(l => /^([•\-*–]|\d+[.)])\s+/.test(l)))
        return `<ul>${lines.map(l => `<li>${esc(l.replace(/^([•\-*–]|\d+[.)])\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${esc(lines.join(' '))}</p>`;
    }).join('');
  }

  // ---------- rendering ----------
  function renderTabs() {
    $('#datasetTabs').innerHTML = datasets.map(d => `<button data-id="${d.id}" class="${d === active ? 'on' : ''}">${qualityDot(d.name)}${esc(d.name)}${d.kind === 'pending' || d.kind === 'loading' ? ' …' : ''}</button>`).join('');
    $$('#datasetTabs button').forEach(b => b.addEventListener('click', () => {
      active = datasets.find(d => d.id === b.dataset.id);
      renderTabs(); renderActive();
      if (active.kind === 'pending') loadPreloaded(active);
    }));
    if (!datasets.length) $('#datasetView').innerHTML = '';
  }

  let chart;
  function renderActive() {
    const view = $('#datasetView');
    if (!active) { view.innerHTML = ''; return; }
    const ds = active;
    if (ds.kind === 'pending' || ds.kind === 'loading') { view.innerHTML = `<article class="card"><h2>${esc(ds.name)}</h2><p class="muted">Loading from the Dataset folder…</p></article>`; return; }
    if (ds.kind === 'error') { view.innerHTML = `<article class="card"><h2>${esc(ds.name)}</h2><p class="muted">Could not load this project file (${esc(ds.error)}). Run the site with <code>node server.js</code> so the Dataset folder is served.</p></article>`; return; }
    const head = `<div class="card-head"><div><h2>${qualityDot(ds.name)}${esc(ds.name)}</h2><p class="muted">${ds.preloaded ? 'Project file (pre-loaded) · ' : ''}${(ds.size / 1024).toFixed(0)} KB · ${ds.kind === 'table' ? `${ds.sheets.length} table(s)` : `${ds.text.split(/\s+/).length.toLocaleString()} words`}</p></div>
      <div class="controls">${ds.kind === 'doc' ? '<button class="btn" id="aiTidy">AI tidy-up</button>' : ''}<button class="btn primary" id="aiSummary">Summarise with AI</button><button class="btn" id="removeDs">Remove</button></div></div>
      ${qualityPanel(ds)}`;
    const aiBlock = `<div class="bubbles" id="dsInsights">${ds.ai.map(i => bubble(i)).join('')}</div>`;

    if (ds.kind === 'doc') {
      view.innerHTML = `<article class="card">${head}${aiBlock}<div class="doc" id="docBody">${ds.tidy ? md(ds.tidy) : ds.html}</div></article>`;
    } else {
      const s = ds.sheets[ds.sheet];
      const nums = s.columns.filter(c => c.type === 'number' && !c.isYear);
      const cats = s.columns.filter(c => c.type === 'category' || c.region || c.isYear);
      const regionCol = s.columns.find(c => c.region);
      view.innerHTML = `<article class="card">${head}
        ${ds.sheets.length > 1 ? `<div class="seg sheet-tabs">${ds.sheets.map((sh, i) => `<button data-i="${i}" class="${i === ds.sheet ? 'on' : ''}">${esc(sh.name)}</button>`).join('')}</div>` : ''}
        ${aiBlock}
        ${ds.contribution ? `<div class="layer-box"><b>Dashboard:</b> ${esc(describe(ds.contribution))}.${regionCol ? ` Region column: ${esc(regionCol.name)}.` : ' No region column in this table.'}</div>` : ''}
        <div class="profile">${s.columns.slice(0, 16).map(c => `<div class="col-card"><div class="type">${c.region ? 'region' : c.currency ? 'currency' : c.percent ? 'percent' : c.type}</div><div class="name" title="${esc(c.name)}">${esc(c.name)}</div><div class="stat">${statLine(c)}</div></div>`).join('')}</div>
        ${cats.length && nums.length ? `<div class="card-head"><h2>Auto chart</h2><div class="controls">
            <label class="select">Group by <select id="chartX">${cats.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label>
            <label class="select">Value <select id="chartY">${nums.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label>
            <label class="select">As <select id="chartAgg"><option value="sum">Sum</option><option value="mean">Average</option><option value="count">Count</option></select></label>
          </div></div><div class="chart-box" style="height:300px;margin-bottom:16px"><canvas id="dsChart"></canvas></div>` : ''}
        <div class="card-head"><h2>Table</h2><div class="controls"><input id="tableSearch" placeholder="Search rows…"><span class="muted small" id="tableCount"></span></div></div>
        <div class="table-scroll"><table class="pretty-table" id="prettyTable"></table></div>
      </article>`;
      $$('.sheet-tabs button').forEach(b => b.addEventListener('click', () => { ds.sheet = +b.dataset.i; renderActive(); }));
      if ($('#dsChart')) { ['#chartX', '#chartY', '#chartAgg'].forEach(id => $(id).addEventListener('change', () => drawChart(s))); drawChart(s); }
      let sort = null;
      const drawTable = () => {
        const q = $('#tableSearch').value.toLowerCase();
        let rows = q ? s.rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) : s.rows;
        if (sort) {
          const col = s.columns.find(c => c.name === sort.k);
          rows = [...rows].sort((a, b) => {
            const x = a[sort.k], y = b[sort.k];
            const r = col.type === 'number' ? (parseNum(x) || 0) - (parseNum(y) || 0) : String(x ?? '').localeCompare(String(y ?? ''));
            return r * sort.dir;
          });
        }
        const shown = rows.slice(0, 300);
        $('#prettyTable').innerHTML = `<thead><tr>${s.columns.map(c => `<th data-k="${esc(c.name)}">${esc(c.name)}${sort?.k === c.name ? (sort.dir > 0 ? ' ▴' : ' ▾') : ''}</th>`).join('')}</tr></thead>
          <tbody>${shown.map(r => `<tr>${s.columns.map(c => `<td class="${c.type === 'number' ? 'num' : ''}">${fmt(c, r[c.name])}</td>`).join('')}</tr>`).join('')}</tbody>`;
        $('#tableCount').textContent = `Showing ${shown.length} of ${rows.length} rows`;
        $$('#prettyTable th').forEach(th => th.addEventListener('click', () => {
          sort = { k: th.dataset.k, dir: sort?.k === th.dataset.k ? -sort.dir : 1 };
          drawTable();
        }));
      };
      $('#tableSearch').addEventListener('input', drawTable);
      drawTable();
    }
    $('#aiSummary').addEventListener('click', () => summarise(ds));
    if ($('#aiQuality')) $('#aiQuality').addEventListener('click', () => aiRateQuality(ds));
    $('#removeDs').addEventListener('click', async () => {
      if (ds.contribution && (Store.get('datasets') || []).some(d => d.id === ds.id)) { removeContribution(ds.id, ds.name); return; }
      if (!(await window.Feedback.confirmDelete('Dataset', ds.name))) return;
      datasets.splice(datasets.indexOf(ds), 1);
      active = datasets[datasets.length - 1] || null;
      renderTabs(); renderActive();
    });
    if ($('#aiTidy')) $('#aiTidy').addEventListener('click', () => tidy(ds));
  }

  function drawChart(s) {
    if (!window.Chart) return;
    const x = $('#chartX').value, y = $('#chartY').value, agg = $('#chartAgg').value;
    const groups = {};
    for (const r of s.rows) {
      const k = r[x] == null || String(r[x]).trim() === '' ? '(blank)' : String(r[x]).trim();
      const n = parseNum(r[y]);
      groups[k] ??= { sum: 0, count: 0 };
      if (!isNaN(n)) groups[k].sum += n;
      groups[k].count++;
    }
    let entries = Object.entries(groups).map(([k, g]) => [k, agg === 'count' ? g.count : agg === 'mean' ? g.sum / g.count : g.sum]);
    entries.sort((a, b) => b[1] - a[1]);
    if (entries.length > 15) {
      const rest = entries.slice(14).reduce((s, e) => s + e[1], 0);
      entries = [...entries.slice(0, 14), ['Other', agg === 'mean' ? rest / (entries.length - 14) : rest]];
    }
    const col = s.columns.find(c => c.name === y);
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const label = v => agg === 'count' ? v.toLocaleString() : fmt(col, v).replace(/<[^>]+>/g, '');
    if (chart) chart.destroy();
    chart = new Chart($('#dsChart'), {
      type: 'bar',
      data: { labels: entries.map(e => e[0].length > 28 ? e[0].slice(0, 27) + '…' : e[0]), datasets: [{ data: entries.map(e => e[1]), backgroundColor: css('--series-1'), borderRadius: 4, borderSkipped: false, maxBarThickness: 28 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => label(c.raw) } } },
        scales: {
          x: { grid: { color: css('--grid') }, border: { display: false }, ticks: { color: css('--muted'), callback: v => agg === 'count' ? v : label(v) } },
          y: { grid: { display: false }, ticks: { color: css('--ink') } },
        },
      },
    });
  }

  // ---------- AI ----------
  function bubble(i) {
    return `<article class="bubble ${i.severity}"><div class="meta"><span class="status ${i.severity}">${{ positive: 'Positive', watch: 'Watch', risk: 'Risk' }[i.severity]}</span><span>${esc(i.agent)}</span></div>
      <h3>${esc(i.title)}</h3><p>${esc(i.insight)}</p>${i.evidence ? `<div class="evidence">${esc(i.evidence)}</div>` : ''}${i.action ? `<div class="action">${esc(i.action)}</div>` : ''}</article>`;
  }

  function datasetDigest(ds, limit = 9000) {
    if (ds.kind === 'doc') return ds.text.slice(0, limit);
    return ds.sheets.map(s => {
      const cols = s.columns.map(c => `${c.name} [${c.type}${c.currency ? ', $' : ''}${c.region ? ', region' : ''}]: ${statLine(c).replace(/<[^>]+>/g, ' ')}`).join('\n');
      const sample = s.rows.slice(0, 25).map(r => s.columns.map(c => String(r[c.name] ?? '').slice(0, 60)).join(' | ')).join('\n');
      return `TABLE "${s.name}" (${s.rows.length} rows)\nCOLUMNS:\n${cols}\nSAMPLE ROWS:\n${s.columns.map(c => c.name).join(' | ')}\n${sample}`;
    }).join('\n\n').slice(0, limit);
  }

  async function summarise(ds) {
    if (!window.App.requireModel()) return;
    const btn = $('#aiSummary');
    btn.disabled = true; btn.textContent = 'Summarising…';
    try {
      const prompt = `A user uploaded "${ds.name}". Summarise what it shows, focusing where relevant on (1) facilities & equipment, (2) programs & workforce, (3) inclusion (women, First Nations, Pasifika, disability), and regional spread across NSW.
Return JSON: {"insights":[{"title":"max 10 words","insight":"2-3 sentences","severity":"positive|watch|risk","evidence":"key numbers","action":"one recommended action"}]} with 3-5 insights. Only use facts in the content.

CONTENT:
${datasetDigest(ds)}`;
      const text = await O.chat([{ role: 'system', content: O.SYSTEM }, { role: 'user', content: prompt }], { json: true });
      const parsed = O.parseJson(text);
      const list = (Array.isArray(parsed) ? parsed : parsed?.insights || []).map(i => ({
        title: String(i.title || 'Insight'), insight: String(i.insight || ''), evidence: i.evidence ? String(i.evidence) : '',
        action: i.action ? String(i.action) : '', severity: ['positive', 'watch', 'risk'].includes(i.severity) ? i.severity : 'watch',
        pillar: 'Uploaded data', agent: 'Data agent · ' + ds.name, source: ds.name,
      }));
      if (!list.length) throw new Error('Model returned no insights');
      ds.ai = list;
      window.App.addInsights(list);
      if (active === ds) $('#dsInsights').innerHTML = list.map(bubble).join('');
      toast('Insights added - they also appear on the Insights tab and feed the Story.');
    } catch (e) {
      toast('AI summary failed: ' + e.message, 5000);
    } finally {
      btn.disabled = false; btn.textContent = 'Summarise with AI';
    }
  }

  async function tidy(ds) {
    if (!window.App.requireModel()) return;
    const body = $('#docBody');
    body.innerHTML = '<p class="muted">Restructuring…</p>';
    try {
      ds.tidy = await O.stream([
        { role: 'system', content: 'You restructure messy extracted document text into clean, well-organised markdown: a one-paragraph summary, then headings, bullet lists and markdown tables where the content is tabular. Keep all facts and figures; do not add anything.' },
        { role: 'user', content: ds.text.slice(0, 12000) },
      ], (_, full) => { if (active === ds) body.innerHTML = md(full); });
    } catch (e) {
      body.innerHTML = ds.html;
      toast('AI tidy-up failed: ' + e.message, 5000);
    }
  }

  window.DataStudio = { get datasets() { return datasets; }, datasetDigest };
  document.addEventListener('app-ready', () => {
    init();
    renderSources();
    window.Feedback.renderPanel($('#dataQuality'));
  });
  document.addEventListener('feedback-changed', () => window.Feedback.renderPanel($('#dataQuality')));
})();
