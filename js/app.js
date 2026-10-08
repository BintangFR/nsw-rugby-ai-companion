// Core UI: tabs, theme, Ollama status, overview (map, matrix, KPIs) and insight bubbles.
window.App = (() => {
  const A = window.Analytics, O = window.Ollama, D = window.TACKLE_DATA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const money = n => n == null ? '–' : '$' + (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + 'k' : Math.round(n));
  const moneyFull = n => '$' + Math.round(n).toLocaleString();
  const pct = x => (x * 100).toFixed(1) + '%';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = text => DOMPurify.sanitize(marked.parse(text || ''));

  let insights = [];
  const persist = () => Store.set('insights', insights);

  // ---------- generic UI ----------
  function toast(msg, ms = 3200) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
  }

  function initTabs() {
    $$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    const saved = (() => { try { return localStorage.getItem('tackle.tab'); } catch { return null; } })();
    if (saved) showTab(saved);
  }
  function showTab(id) {
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === id));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
    try { localStorage.setItem('tackle.tab', id); } catch {}
    if (id === 'overview' && map) setTimeout(() => map.invalidateSize(), 50);
    document.dispatchEvent(new CustomEvent('tab', { detail: id }));
  }

  function initTheme() {
    let theme = null;
    try { theme = localStorage.getItem('tackle.theme'); } catch {}
    if (theme) document.documentElement.dataset.theme = theme;
    $('#themeToggle').addEventListener('click', () => {
      const dark = isDark();
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('tackle.theme', document.documentElement.dataset.theme); } catch {}
      renderOverview();
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderOverview);
  }
  const isDark = () => document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;

  // ---------- Ollama status & settings ----------
  async function checkOllama() {
    const pill = $('#ollamaStatus');
    try {
      const models = await O.listModels();
      if (!models.length) throw new Error('No models pulled');
      if (!O.config.model || !models.includes(O.config.model)) {
        const pref = models.find(m => /qwen|gemma|llama3|mistral|phi/i.test(m)) || models[0];
        O.save({ model: pref });
      }
      pill.className = 'pill ok';
      $('.label', pill).textContent = 'Ollama: ' + O.config.model;
      return models;
    } catch (e) {
      pill.className = 'pill err';
      $('.label', pill).textContent = 'Ollama: offline';
      return null;
    }
  }

  function initSettings() {
    const dlg = $('#settings');
    const fill = async () => {
      $('#ollamaUrl').value = O.config.baseUrl;
      $('#settingsMsg').textContent = 'Connecting…';
      const models = await checkOllama();
      const sel = $('#ollamaModel');
      sel.innerHTML = (models || []).map(m => `<option ${m === O.config.model ? 'selected' : ''}>${esc(m)}</option>`).join('');
      $('#settingsMsg').textContent = models ? `${models.length} model(s) found.` : `Could not reach Ollama at ${O.config.baseUrl}.`;
    };
    $('#ollamaStatus').addEventListener('click', () => { dlg.showModal(); fill(); });
    $('#refreshModels').addEventListener('click', () => { O.save({ baseUrl: $('#ollamaUrl').value.trim() || 'http://localhost:11434' }); fill(); });
    $('#saveSettings').addEventListener('click', () => {
      O.save({ baseUrl: $('#ollamaUrl').value.trim() || 'http://localhost:11434', model: $('#ollamaModel').value || O.config.model });
      checkOllama();
    });
  }

  function requireModel() {
    if (O.config.model && $('#ollamaStatus').classList.contains('ok')) return true;
    toast('Ollama is not connected - open settings to pick a model.');
    $('#settings').showModal();
    return false;
  }

  // ---------- overview ----------
  const seqVars = ['--seq-100', '--seq-200', '--seq-300', '--seq-400', '--seq-500', '--seq-600', '--seq-700'];
  const redRamp = ['#fbdcdb', '#f5b4b3', '#ec8988', '#e05a59', '#c23a3a', '#962727'];
  const seqColor = t => css(seqVars[Math.min(6, Math.max(0, Math.round(t * 6)))]);
  const seqInk = t => Math.round(t * 6) >= 4 ? '#ffffff' : '#0b0b0b';

  function metricDefs() {
    const defs = [
      { id: 'total', label: 'Total known spend', fmt: money },
      { id: 'fe', label: 'Facilities & Equipment $', fmt: money },
      { id: 'pw', label: 'Programs & Workforce $', fmt: money },
      { id: 'inc', label: 'Inclusion $', fmt: money },
      { id: 'perResident', label: '$ per resident', fmt: v => '$' + v.toFixed(2) },
      { id: 'spendIndex', label: 'Spend vs population (over/under)', fmt: v => v.toFixed(2) + 'x', diverging: true },
      { id: 'inclusionIndex', label: 'Inclusion index', fmt: v => Math.round(v * 100) + '/100' },
      { id: 'social', label: 'Social impact $', fmt: money },
      { id: 'economic', label: 'Economic impact $', fmt: money },
      { id: 'cultural', label: 'Cultural impact $', fmt: money },
    ];
    for (const l of A.customLayers()) defs.push({ id: 'custom:' + l.id, label: '⬆ ' + l.label, fmt: v => v == null ? '–' : Number(v).toLocaleString() });
    return defs;
  }

  function renderKpis(rows, c, p) {
    const flagged = rows.filter(r => r.status !== 'balanced').length;
    const tiles = [
      ['Known spend', money(c.knownTotal), `of $10M Legacy Program`],
      ['Facilities & Equipment', money(p.fe), `${D.grants.filter(g => g.pillar === 'FE').length} facility projects`],
      ['Programs & Workforce', money(p.pw), 'coaches, MOs, competitions'],
      ['Inclusion', money(p.inc), 'women, First Nations, Pasifika, access'],
      ['Held centrally', pct(c.centralShare), money(c.central) + ' in statewide budgets'],
      ['Regions flagged', `${flagged} / ${rows.length}`, 'over- or under-served'],
    ];
    $('#kpiRow').innerHTML = tiles.map(([l, v, s]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join('');
  }

  let map, tiles, circles, heat, nswMask, nswOutline;
  // Esri grey canvas basemaps: no API key needed.
  const TILE_URL = dark => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'}/MapServer/tile/{z}/{y}/{x}`;
  const ll = ring => ring.map(([lng, lat]) => [lat, lng]);

  function renderMap(rows) {
    if (!window.L) { $('#map').innerHTML = '<p class="empty">Map library failed to load (offline?).</p>'; return; }
    if (!map) {
      const nswBounds = L.latLngBounds([-37.6, 140.9], [-28.1, 153.7]);
      map = L.map('map', {
        scrollWheelZoom: false, zoomSnap: 0.25, minZoom: 5, maxZoom: 11,
        maxBounds: nswBounds.pad(0.15), maxBoundsViscosity: 0.9,
      }).fitBounds(nswBounds);
      map.createPane('mask').style.zIndex = 350;
      map.createPane('regions').style.zIndex = 450; // keep markers above the heat canvas
      circles = L.layerGroup().addTo(map);
      if (window.NSW_BOUNDARY) {
        const nsw = ll(NSW_BOUNDARY.nsw[0]);
        const act = ll(NSW_BOUNDARY.act[0]);
        // Dim everything outside NSW (world rectangle with NSW cut out); ACT stays dimmed as it is not NSW.
        nswMask = L.polygon([[[-90, -180], [-90, 180], [90, 180], [90, -180]], nsw], { pane: 'mask', stroke: false, fillOpacity: 0.55, interactive: false }).addTo(map);
        L.polygon(act, { pane: 'mask', stroke: false, fillOpacity: 0.55, interactive: false, className: 'act-mask' }).addTo(map);
        nswOutline = L.polygon(nsw, { pane: 'mask', fill: false, weight: 1.5, interactive: false }).addTo(map);
      }
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
      $('#heatToggle').addEventListener('change', () => renderMap(A.regionMetrics()));
      $('#mapMetric').addEventListener('change', () => renderMap(A.regionMetrics()));
    }
    const tileUrl = TILE_URL(isDark());
    if (!tiles || tiles._url !== tileUrl) {
      if (tiles) tiles.remove();
      tiles = L.tileLayer(tileUrl, { attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 11 }).addTo(map);
    }
    if (nswMask) {
      nswMask.setStyle({ fillColor: css('--page') });
      map.eachLayer(l => { if (l.options?.className === 'act-mask') l.setStyle({ fillColor: css('--page') }); });
      nswOutline.setStyle({ color: css('--brand') });
    }

    const sel = $('#mapMetric');
    const defs = metricDefs();
    const current = sel.value || 'total';
    sel.innerHTML = defs.map(d => `<option value="${d.id}" ${d.id === current ? 'selected' : ''}>${esc(d.label)}</option>`).join('');
    const def = defs.find(d => d.id === sel.value) || defs[0];
    const vals = rows.map(r => r[def.id] ?? 0);
    const max = Math.max(...vals.map(v => Math.abs(v)), 1e-9);

    circles.clearLayers();
    for (const r of rows) {
      const v = r[def.id] ?? 0;
      const t = Math.abs(v) / max;
      let fill;
      if (def.diverging) fill = r.status === 'over' ? css('--critical') : r.status === 'under' ? css('--series-1') : css('--good');
      else fill = v ? seqColor(0.15 + t * 0.85) : css('--axis');
      const radius = def.diverging ? 9 + 6 * Math.min(3, v) : 6 + 24 * Math.sqrt(t);
      const m = L.circleMarker([r.lat, r.lng], { pane: 'regions', radius, color: css('--surface'), weight: 2, fillColor: fill, fillOpacity: 0.88 });
      m.bindTooltip(`<b>${esc(r.name)}</b><br>${esc(def.label)}: ${def.fmt(v)}`, { direction: 'top' });
      m.bindPopup(popupHtml(r));
      circles.addLayer(m);
    }

    if (heat) { heat.remove(); heat = null; }
    if ($('#heatToggle').checked && L.heatLayer && !def.diverging) {
      const pts = rows.filter(r => (r[def.id] ?? 0) > 0).map(r => [r.lat, r.lng, Math.max(0.15, (r[def.id] ?? 0) / max)]);
      heat = L.heatLayer(pts, { radius: 55, blur: 40, maxZoom: 9, max: 1, minOpacity: 0.25,
        gradient: { 0.2: css('--seq-200'), 0.5: css('--seq-400'), 0.8: css('--seq-600'), 1: css('--seq-700') } }).addTo(map);
    }

    $('#mapLegend').innerHTML = def.diverging
      ? `<span><span class="swatch" style="background:var(--series-1)"></span>Under-served (≤0.5x)</span>
         <span><span class="swatch" style="background:var(--good)"></span>Balanced</span>
         <span><span class="swatch" style="background:var(--critical)"></span>Overspend risk (≥1.75x)</span>
         <span class="muted">Circle size = index</span>`
      : `<span>Low<span class="ramp">${seqVars.map(v => `<span style="background:var(${v})"></span>`).join('')}</span>High</span>
         <span class="muted">Circle size = ${esc(def.label)} · click a region for detail</span>`;
  }

  function popupHtml(r) {
    const tags = A.INCLUSION_TAGS.filter(t => r.tagSpend[t] > 0).map(t => ({ women: 'Women & girls', firstNations: 'First Nations', pasifika: 'Pasifika/CALD', access: 'Accessibility' }[t]));
    return `<h3>${esc(r.name)}</h3>
      <span class="status ${r.status}">${{ over: 'Overspend risk', under: 'Under-served', balanced: 'Balanced' }[r.status]}</span>
      <div style="margin-top:6px">Total ${moneyFull(r.total)} · ${r.spendIndex.toFixed(2)}x pop. share<br>
      Facilities ${money(r.fe)} · Workforce ${money(r.pw)} · Inclusion ${money(r.inc)}<br>
      Audit gaps addressed: ${r.gaps.size ? [...r.gaps].join(', ') : 'none'}<br>
      Inclusion focus: ${tags.length ? tags.join(', ') : 'none tagged'}${r.fnGap ? '<br><b>⚠ First Nations gap</b> (~' + r.fnShare + '% of residents)' : ''}</div>
      <ul>${r.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  }

  function renderCentral(c) {
    const parts = [
      { label: 'Held centrally (statewide)', v: c.central, color: 'var(--series-1)' },
      { label: 'Greater Sydney', v: c.metro, color: 'var(--series-2)' },
      { label: 'Regional NSW', v: c.regional, color: 'var(--series-3)' },
    ];
    const tot = parts.reduce((s, p) => s + p.v, 0);
    $('#centralBar').innerHTML = parts.map(p => `<div style="flex:${p.v};background:${p.color}" title="${p.label}: ${moneyFull(p.v)} (${pct(p.v / tot)})"></div>`).join('');
    const legend = parts.map(p => `<span style="--c:${p.color}">${p.label} ${pct(p.v / tot)}</span>`).join('');
    let lg = $('#centralLegend');
    if (!lg) { lg = document.createElement('div'); lg.id = 'centralLegend'; lg.className = 'stack-legend'; $('#centralBar').after(lg); }
    lg.innerHTML = legend;
    $('#centralFacts').innerHTML = `
      <dt>Greater Sydney share of regional spend</dt><dd>${pct(c.metroShareOfAllocated)}</dd>
      <dt>Greater Sydney share of population</dt><dd>${pct(c.metroPopShare)}</dd>
      <dt>Facility grants outside Greater Sydney</dt><dd>${pct(1 - c.feMetroShare)}</dd>
      <dt>Inclusion budget held centrally</dt><dd>${pct(c.incCentralShare)}</dd>
      <dt>Effective number of regions funded</dt><dd>${c.hhiEquivalentRegions.toFixed(1)} of ${D.regions.length}</dd>`;
    let v = $('#centralVerdict');
    if (!v) { v = document.createElement('div'); v.id = 'centralVerdict'; $('#centralFacts').after(v); }
    const central = c.verdict === 'Centralised';
    v.innerHTML = `<span class="verdict"><span class="status ${central ? 'watch' : 'positive'}">${central ? 'Leaning centralised' : 'Well distributed'}</span></span>
      <p class="muted small" style="margin-top:6px">${central
        ? `${pct(c.centralShare)} of known dollars sit in statewide NSWRU budgets. Facility grants are spread widely, but inclusion and workforce money is mostly managed from the centre.`
        : 'Most known dollars are allocated to named regions.'}</p>`;
  }

  function renderFlags(rows) {
    const flagged = rows.filter(r => r.status !== 'balanced' || r.fnGap).sort((a, b) => b.spendIndex - a.spendIndex);
    $('#flagList').innerHTML = flagged.map(r => {
      const label = r.status === 'over' ? 'Overspend risk' : r.status === 'under' ? 'Under-served' : 'Balanced';
      return `<li><span class="status ${r.status}">${label}</span><div><b>${esc(r.name)}</b> ${r.spendIndex.toFixed(2)}x · ${money(r.total)} · $${r.perResident.toFixed(2)}/resident${r.fnGap ? `<br><span class="status risk">First Nations gap</span> <span class="muted small">~${r.fnShare}% First Nations, no program reach</span>` : ''}</div></li>`;
    }).join('') || '<li class="muted">No regions flagged.</li>';
  }

  let matrixSort = { key: 'total', dir: -1 }, matrixFilter = 'all';
  function matrixColumns() {
    const cols = [
      { key: 'fe', label: 'Facilities $', group: 'Spend', f: ['all', 'FE'], fmt: money },
      { key: 'pw', label: 'Workforce $', group: 'Spend', f: ['all', 'PW'], fmt: money },
      { key: 'inc', label: 'Inclusion $', group: 'Spend', f: ['all', 'INC'], fmt: money },
      { key: 'total', label: 'Total $', group: 'Spend', f: ['all', 'FE', 'PW'], fmt: money },
      { key: 'perResident', label: '$ / resident', group: 'Fairness', f: ['all', 'FE', 'PW', 'INC'], fmt: v => '$' + v.toFixed(2) },
      { key: 'spendIndex', label: 'Spend vs pop.', group: 'Fairness', f: ['all', 'FE', 'PW', 'INC'], fmt: v => v.toFixed(2) + 'x', diverging: true },
      { key: 'facilityCount', label: 'Projects', group: 'Facilities', f: ['all', 'FE'], fmt: v => v || '–' },
      { key: 'gapCoverage', label: 'Audit gaps (of 4)', group: 'Facilities', f: ['all', 'FE'], fmt: v => v || '–', max: 4 },
      { key: 'inclusionIndex', label: 'Inclusion index', group: 'Inclusion', f: ['all', 'INC'], fmt: v => Math.round(v * 100) },
      { key: 'women', label: 'Women & girls $', group: 'Inclusion', f: ['all', 'INC'], fmt: money, get: r => r.tagSpend.women },
      { key: 'fn', label: 'First Nations', group: 'Inclusion', f: ['all', 'INC'], get: r => r.fnShare, fn: true },
      { key: 'pasifika', label: 'Pasifika/CALD $', group: 'Inclusion', f: ['all', 'INC'], fmt: money, get: r => r.tagSpend.pasifika },
      { key: 'access', label: 'Access $', group: 'Inclusion', f: ['all', 'INC'], fmt: money, get: r => r.tagSpend.access },
    ];
    cols.push(
      { key: 'social', label: 'Social $', group: 'Impact', f: ['all', 'IMP'], fmt: money },
      { key: 'economic', label: 'Economic $', group: 'Impact', f: ['all', 'IMP'], fmt: money },
      { key: 'cultural', label: 'Cultural $', group: 'Impact', f: ['all', 'IMP'], fmt: money },
      { key: 'evidenceCount', label: 'Evidence records', group: 'Impact', f: ['IMP'], fmt: v => v || '–' },
    );
    for (const l of A.customLayers()) cols.push({ key: 'custom:' + l.id, label: l.label, group: 'Uploaded', f: ['all', 'FE', 'PW', 'INC', 'IMP'], fmt: v => v == null ? '–' : Number(v).toLocaleString() });
    return cols.filter(c => c.f.includes(matrixFilter));
  }

  function renderMatrix(rows) {
    const cols = matrixColumns();
    const val = (r, c) => c.get ? c.get(r) : r[c.key];
    const sorted = [...rows].sort((a, b) => {
      const col = cols.find(c => c.key === matrixSort.key) || cols[0];
      return ((val(a, col) ?? -Infinity) - (val(b, col) ?? -Infinity)) * matrixSort.dir;
    });
    const groups = [];
    for (const c of cols) { const g = groups[groups.length - 1]; if (g && g.name === c.group) g.n++; else groups.push({ name: c.group, n: 1 }); }

    let html = `<thead><tr><th class="group"></th>${groups.map(g => `<th class="group" colspan="${g.n}">${g.name}</th>`).join('')}</tr>
      <tr><th data-k="name">Region</th>${cols.map(c => `<th data-k="${c.key}" class="${c.key === matrixSort.key ? 'sorted' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>`;
    const maxes = Object.fromEntries(cols.map(c => [c.key, c.max || Math.max(...rows.map(r => Math.abs(val(r, c) ?? 0)), 1e-9)]));
    for (const r of sorted) {
      html += `<tr><td class="name">${esc(r.name)}<small>${r.metro ? 'Greater Sydney' : 'Regional'} · ~${r.pop.toLocaleString()}k residents</small></td>`;
      for (const c of cols) {
        const v = val(r, c);
        let bg = 'transparent', ink = 'var(--ink)', text, tip = `${r.name} · ${c.label}`;
        if (c.fn) {
          text = `~${v}% ${r.fnReach ? '✓' : r.fnGap ? '⚠' : ''}`;
          tip += `: ~${v}% of residents; ${r.fnReach ? 'First Nations program reach' : 'no First Nations program reach'}`;
          if (r.fnGap) { bg = redRamp[1]; ink = '#0b0b0b'; text += ' gap'; }
          else { const t = v / 16; bg = seqColor(t); ink = seqInk(t); }
        } else if (c.diverging) {
          const l = Math.max(-2, Math.min(2, Math.log2(v || 0.01)));
          const step = Math.min(5, Math.floor(Math.abs(l) / 2 * 6));
          if (Math.abs(l) < 0.4) { bg = css('--div-mid'); }
          else if (l > 0) { bg = redRamp[step]; ink = step >= 3 ? '#fff' : '#0b0b0b'; }
          else { bg = seqColor(step / 5); ink = seqInk(step / 5); }
          text = c.fmt(v);
          tip += `: ${text} (${r.status === 'over' ? 'overspend risk' : r.status === 'under' ? 'under-served' : 'balanced'})`;
        } else if (v == null || v === 0) {
          text = '–';
        } else {
          const t = Math.abs(v) / maxes[c.key];
          bg = seqColor(t); ink = seqInk(t); text = c.fmt(v); tip += `: ${text}`;
        }
        html += `<td class="cell" style="background:${bg};color:${ink}" title="${esc(tip)}">${text}</td>`;
      }
      html += '</tr>';
    }
    $('#matrix').innerHTML = html + '</tbody>';
    $$('#matrix th[data-k]').forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.k;
      if (k === 'name') return;
      matrixSort = { key: k, dir: matrixSort.key === k ? -matrixSort.dir : -1 };
      renderMatrix(A.regionMetrics());
    }));
  }

  function renderProgress() {
    const statusClass = { Ahead: 'positive', Close: 'watch', Behind: 'risk', 'No data': '' };
    $('#kpiProgress').innerHTML = D.kpis.map(k => {
      const scale = Math.max(k.requiredPa, k.actual || 0) * 1.25;
      return `<div class="progress-item">
        <div class="top"><b>${esc(k.name)}</b><span class="status ${statusClass[k.status]}">${k.status}</span></div>
        <div class="track" title="2025 growth ${k.actual == null ? 'not published' : pct(k.actual)}; needed ${pct(k.requiredPa)} a year">
          ${k.actual != null ? `<div class="fill" style="width:${(k.actual / scale) * 100}%"></div>` : ''}
          <div class="target" style="left:${(k.requiredPa / scale) * 100}%"></div>
        </div>
        <div class="sub">2025: ${k.actual == null ? 'no figure published' : '+' + pct(k.actual)} · needed ${pct(k.requiredPa)} p.a. · baseline ${k.baseline.toLocaleString()}</div>
      </div>`;
    }).join('') + '<p class="footnote">Bar = 2025 growth. Black tick = growth needed each year.</p>';
  }

  let pillarChart;
  function pillarChartConfig(p, colors) {
    const labels = ['Facilities & Equipment', 'Programs & Workforce', 'Inclusion', 'Activation, M&E, PM'];
    const data = [p.fe, p.pw, p.inc, p.other];
    return {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors.bar, borderRadius: 4, borderSkipped: false, barThickness: 22 }] },
      options: {
        indexAxis: 'y', responsive: colors.responsive !== false, maintainAspectRatio: false, animation: colors.animation,
        layout: { padding: { right: 60 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => moneyFull(c.raw) } } },
        scales: {
          x: { grid: { color: colors.grid }, border: { display: false }, ticks: { color: colors.muted, callback: v => money(v) } },
          y: { grid: { display: false }, border: { color: colors.axis }, ticks: { color: colors.ink, font: { size: 12 } } },
        },
      },
      plugins: [{
        id: 'endLabels',
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          ctx.save(); ctx.fillStyle = colors.ink; ctx.font = '600 12px system-ui, sans-serif'; ctx.textBaseline = 'middle';
          chart.getDatasetMeta(0).data.forEach((bar, i) => ctx.fillText(money(data[i]), bar.x + 6, bar.y));
          ctx.restore();
        },
      }],
    };
  }
  function renderPillarChart(p) {
    if (!window.Chart) return;
    if (pillarChart) pillarChart.destroy();
    pillarChart = new Chart($('#pillarChart'), pillarChartConfig(p, {
      bar: css('--series-1'), grid: css('--grid'), axis: css('--axis'), muted: css('--muted'), ink: css('--ink'),
    }));
  }
  // Light-theme image of the pillar chart for the PDF report.
  function pillarChartImage() {
    if (!window.Chart) return '';
    const canvas = document.createElement('canvas');
    canvas.width = 1400; canvas.height = 480;
    const chart = new Chart(canvas, pillarChartConfig(A.pillarTotals(), {
      bar: '#2a78d6', grid: '#e1e0d9', axis: '#c3c2b7', muted: '#898781', ink: '#0b0b0b', responsive: false, animation: false,
    }));
    chart.options.devicePixelRatio = 1;
    chart.options.scales.y.ticks.font.size = 22; chart.options.scales.x.ticks.font = { size: 20 };
    chart.update();
    const url = canvas.toDataURL('image/png');
    chart.destroy();
    return url;
  }

  function renderOverview() {
    const rows = A.regionMetrics();
    const c = A.centralisation(rows);
    const p = A.pillarTotals(rows);
    renderKpis(rows, c, p);
    renderMap(rows);
    renderCentral(c);
    renderFlags(rows);
    renderMatrix(rows);
    renderProgress();
    renderPillarChart(p);
  }

  function initMatrixFilter() {
    $$('#matrixFilter button').forEach(b => b.addEventListener('click', () => {
      $$('#matrixFilter button').forEach(x => x.classList.toggle('on', x === b));
      matrixFilter = b.dataset.f;
      if (!matrixColumns().some(c => c.key === matrixSort.key)) matrixSort = { key: matrixColumns()[0].key, dir: -1 };
      renderMatrix(A.regionMetrics());
    }));
  }

  // ---------- insights ----------
  let insightFilter = 'all';
  function addInsights(list, { replacePillar } = {}) {
    if (replacePillar) insights = insights.filter(i => i.pillar !== replacePillar);
    for (const i of list) insights.push({ id: crypto.randomUUID?.() || String(Math.random()), created: Date.now(), ...i });
    persist();
    renderBubbles();
  }

  function bubbleHtml(i) {
    const sev = { positive: 'Positive', watch: 'Watch', risk: 'Risk' }[i.severity] || 'Watch';
    return `<article class="bubble ${i.severity}">
      <div class="meta"><span class="status ${i.severity}">${sev}</span><span>${esc(i.pillar)}</span>${i.region ? `<span>· ${esc(i.region)}</span>` : ''}<span>· ${esc(i.agent || '')}</span></div>
      <h3>${esc(i.title)}</h3>
      <p>${esc(i.insight)}</p>
      ${i.evidence ? `<div class="evidence">${esc(i.evidence)}</div>` : ''}
      ${i.action ? `<div class="action">${esc(i.action)}</div>` : ''}
    </article>`;
  }

  function renderBubbles() {
    const list = insights.filter(i => insightFilter === 'all' || i.pillar === insightFilter);
    $('#bubbles').innerHTML = list.length ? list.map(bubbleHtml).join('')
      : `<div class="empty">No insights yet. Press <b>Run agents</b> to have your local Ollama model analyse the data, or <b>Rule-based only</b> for instant insights without AI.</div>`;
    $('#insightCount').textContent = `${list.length} insight${list.length === 1 ? '' : 's'}`;
  }

  function renderAgentChips(states = {}) {
    $('#agentChips').innerHTML = O.AGENTS.map(a => {
      const s = states[a.id] || { state: 'idle', text: 'Ready' };
      return `<div class="agent ${s.state}"><div class="avatar">${a.id}</div><div><b>${a.name}</b><div class="state">${esc(s.text)}</div></div></div>`;
    }).join('');
  }

  async function runAgents() {
    if (!requireModel()) return;
    const btn = $('#runAgents');
    btn.disabled = true; btn.textContent = 'Running…';
    const states = {};
    O.AGENTS.forEach(a => states[a.id] = { state: 'idle', text: 'Queued' });
    renderAgentChips(states);
    const rules = A.ruleInsights();
    for (const agent of O.AGENTS) {
      states[agent.id] = { state: 'running', text: `Thinking with ${O.config.model}…` };
      renderAgentChips(states);
      const t0 = performance.now();
      try {
        const list = await O.runAgent(agent);
        addInsights(list, { replacePillar: agent.pillar });
        states[agent.id] = { state: 'done', text: `${list.length} insights in ${((performance.now() - t0) / 1000).toFixed(0)}s` };
      } catch (e) {
        console.error(agent.name, e);
        addInsights(rules.filter(r => r.pillar === agent.pillar), { replacePillar: agent.pillar });
        states[agent.id] = { state: 'failed', text: 'AI failed - used rule engine' };
      }
      renderAgentChips(states);
    }
    btn.disabled = false; btn.textContent = 'Run agents';
    toast('Agents finished.');
  }

  function runRules() {
    const rules = A.ruleInsights();
    insights = insights.filter(i => i.pillar === 'Uploaded data');
    addInsights(rules);
    toast(`${rules.length} rule-based insights added.`);
  }

  async function ask(question) {
    if (!requireModel()) return;
    const el = document.createElement('article');
    el.className = 'bubble answer watch thinking';
    el.innerHTML = `<div class="meta"><span>You asked</span></div><h3>${esc(question)}</h3><div class="md"><p></p></div>`;
    $('#bubbles').prepend(el);
    const ctx = A.contextFor('all');
    const known = insights.slice(0, 20).map(i => `- [${i.pillar}] ${i.title}: ${i.insight}`).join('\n');
    try {
      await O.stream([
        { role: 'system', content: O.SYSTEM },
        { role: 'user', content: `DATA:\n${JSON.stringify(ctx)}\n\nEXISTING INSIGHTS:\n${known || 'none'}\n\nQUESTION: ${question}\nAnswer in under 200 words using markdown. Cite figures from the data.` },
      ], (_, full) => { $('.md', el).innerHTML = md(full); });
      el.classList.remove('thinking');
    } catch (e) {
      el.classList.remove('thinking');
      $('.md', el).innerHTML = `<p>Could not reach Ollama: ${esc(e.message)}</p>`;
    }
  }

  function initInsights() {
    renderAgentChips();
    renderBubbles();
    $('#runAgents').addEventListener('click', runAgents);
    $('#runRules').addEventListener('click', runRules);
    $$('#insightFilter button').forEach(b => b.addEventListener('click', () => {
      $$('#insightFilter button').forEach(x => x.classList.toggle('on', x === b));
      insightFilter = b.dataset.f;
      renderBubbles();
    }));
    $('#askForm').addEventListener('submit', e => {
      e.preventDefault();
      const q = $('#askInput').value.trim();
      if (q) { ask(q); $('#askInput').value = ''; }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTabs();
    initSettings();
    initMatrixFilter();
    renderOverview();
    initInsights();
    checkOllama();
  });

  return {
    $, $$, esc, md, money, moneyFull, pct, toast, requireModel, addInsights, renderOverview, renderBubbles, pillarChartImage, showTab,
    get insights() { return insights; },
  };
})();
