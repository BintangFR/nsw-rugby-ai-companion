// Data Studio: upload any file, detect its structure, prettify it, chart it,
// push region columns onto the heatmap and summarise it with the local model.
(() => {
  const { $, $$, esc, md, money, toast } = window.App;
  const A = window.Analytics, O = window.Ollama;
  const datasets = [];
  let active = null;

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

    const picker = document.createElement('div');
    picker.className = 'row';
    picker.style.cssText = 'flex-wrap:wrap;margin:-6px 0 16px';
    picker.innerHTML = `<span class="muted small">Or open a project file:</span>
      <select id="projectFile">${PROJECT_FILES.map(f => `<option>${esc(f)}</option>`).join('')}</select>
      <button class="btn" id="openProjectFile">Open</button>`;
    dz.after(picker);
    $('#openProjectFile').addEventListener('click', async () => {
      const name = $('#projectFile').value;
      try {
        const res = await fetch('Dataset/' + encodeURIComponent(name));
        if (!res.ok) throw new Error(res.status);
        const blob = await res.blob();
        handleFiles([new File([blob], name)]);
      } catch {
        toast('Could not open project files - start the site with serve.ps1 so it runs on http://localhost.');
      }
    });
    renderTabs();
  }

  async function handleFiles(files) {
    for (const file of files) {
      try {
        toast(`Reading ${file.name}…`);
        const ds = await parseFile(file);
        datasets.push(ds);
        active = ds;
      } catch (e) {
        console.error(e);
        toast(`Could not read ${file.name}: ${e.message}`, 5000);
      }
    }
    renderTabs();
    renderActive();
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
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
    $('#datasetTabs').innerHTML = datasets.map(d => `<button data-id="${d.id}" class="${d === active ? 'on' : ''}">${esc(d.name)}</button>`).join('');
    $$('#datasetTabs button').forEach(b => b.addEventListener('click', () => { active = datasets.find(d => d.id === b.dataset.id); renderTabs(); renderActive(); }));
    if (!datasets.length) $('#datasetView').innerHTML = '';
  }

  let chart;
  function renderActive() {
    const view = $('#datasetView');
    if (!active) { view.innerHTML = ''; return; }
    const ds = active;
    const head = `<div class="card-head"><div><h2>${esc(ds.name)}</h2><p class="muted">${(ds.size / 1024).toFixed(0)} KB · ${ds.kind === 'table' ? `${ds.sheets.length} table(s)` : `${ds.text.split(/\s+/).length.toLocaleString()} words`}</p></div>
      <div class="controls">${ds.kind === 'doc' ? '<button class="btn" id="aiTidy">AI tidy-up</button>' : ''}<button class="btn primary" id="aiSummary">Summarise with AI</button><button class="btn" id="removeDs">Remove</button></div></div>`;
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
        ${regionCol && nums.length ? `<div class="layer-box"><b>Region column detected:</b> ${esc(regionCol.name)}. Add
          <select id="layerCol">${nums.map(c => `<option>${esc(c.name)}</option>`).join('')}</select>
          to the NSW heatmap <button class="btn primary" id="addLayer">Add layer</button></div>` : ''}
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
      if ($('#addLayer')) $('#addLayer').addEventListener('click', () => addLayer(s, regionCol, s.columns.find(c => c.name === $('#layerCol').value)));
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
    $('#removeDs').addEventListener('click', () => {
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

  function addLayer(s, regionCol, valueCol) {
    const values = {};
    let matched = 0;
    for (const r of s.rows) {
      const region = A.matchRegion(r[regionCol.name]);
      const n = parseNum(r[valueCol.name]);
      if (!region || isNaN(n)) continue;
      values[region] = (values[region] || 0) + n;
      matched++;
    }
    if (!matched) { toast('No rows matched a known NSW region.'); return; }
    A.addCustomLayer(`${valueCol.name} (${active.name})`, values);
    window.App.renderOverview();
    toast(`Added layer from ${matched} rows across ${Object.keys(values).length} regions - see Overview.`);
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
  init();
})();
