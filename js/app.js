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
    if (id === 'overview' && map) setTimeout(() => { map.invalidateSize(); renderMap(A.regionMetrics()); }, 50);
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
  }
  // Grimdark is the default; light (parchment) is opt-in via the toggle.
  const isDark = () => document.documentElement.dataset.theme !== 'light';

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
      $('.label', pill).textContent = (O.viaServer ? 'AI: ' : 'Ollama: ') + O.config.model;
      pill.title = O.viaServer ? `Via backend (${Store.health?.llm?.provider}) · storage: ${Store.health?.storage?.backend}` : 'Direct to Ollama · storage: this browser';
      return models;
    } catch (e) {
      pill.className = 'pill err';
      $('.label', pill).textContent = O.viaServer ? 'AI: offline' : 'Ollama: offline';
      pill.title = e.message;
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
      $('#ollamaUrl').closest('label').hidden = O.viaServer;
      const h = Store.health;
      $('#settingsMsg').textContent = O.viaServer
        ? `Connected through the Tackle AI backend (${h?.deployment}) · provider ${h?.llm?.provider} · storage ${h?.storage?.backend}${h?.storage?.warning ? ' - ' + h.storage.warning : ''}. ${models ? models.length + ' model(s) available.' : 'AI provider unreachable: ' + (h?.llm?.error || '')}`
        : models ? `${models.length} model(s) found. Storage: this browser only (start server.js for shared storage).` : `Could not reach Ollama at ${O.config.baseUrl}.`;
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

  let map, tiles, labels, circles, heat, nswMask, actMask, nswFill, nswGlow, nswOutline, legendCtl;
  // Esri grey canvas basemap + its place-name overlay: no API key needed.
  const ESRI = (dark, kind) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${dark ? 'Dark' : 'Light'}_Gray_${kind}/MapServer/tile/{z}/{y}/{x}`;
  const ll = ring => ring.map(([lng, lat]) => [lat, lng]);
  const VIEWS = {
    nsw: { label: 'All NSW', bounds: [[-37.6, 140.9], [-28.1, 153.7]] },
    sydney: { label: 'Greater Sydney', bounds: [[-34.25, 150.6], [-33.55, 151.4]] },
    coast: { label: 'Hunter & Coast', bounds: [[-35.2, 149.8], [-28.9, 153.7]] },
  };
  const shortName = n => n.replace('Sydney - ', 'Syd ').replace(' & Bayside', '');

  function initMap() {
    map = L.map('map', {
      scrollWheelZoom: false, zoomSnap: 0.25, minZoom: 5, maxZoom: 11, zoomControl: false,
      maxBounds: L.latLngBounds(VIEWS.nsw.bounds).pad(0.15), maxBoundsViscosity: 0.9,
    }).fitBounds(VIEWS.nsw.bounds, { padding: [10, 10] });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    map.createPane('mask').style.zIndex = 350;
    map.createPane('labels').style.zIndex = 340; // under the mask, so place names outside NSW are dimmed
    map.getPane('labels').style.pointerEvents = 'none';
    circles = L.layerGroup().addTo(map);
    if (window.NSW_BOUNDARY) {
      const nsw = ll(NSW_BOUNDARY.nsw[0]);
      const act = ll(NSW_BOUNDARY.act[0]);
      // Dim everything outside NSW (world rectangle with NSW cut out); ACT is dimmed too as it is not NSW.
      nswMask = L.polygon([[[-90, -180], [-90, 180], [90, 180], [90, -180]], nsw], { pane: 'mask', stroke: false, fillOpacity: 0.62, interactive: false }).addTo(map);
      actMask = L.polygon(act, { pane: 'mask', stroke: false, fillOpacity: 0.62, interactive: false }).addTo(map);
      nswFill = L.polygon(nsw, { pane: 'mask', stroke: false, fillOpacity: 0.05, interactive: false }).addTo(map);
      nswGlow = L.polygon(nsw, { pane: 'mask', fill: false, weight: 9, opacity: 0.16, interactive: false }).addTo(map);
      nswOutline = L.polygon(nsw, { pane: 'mask', fill: false, weight: 1.6, interactive: false }).addTo(map);
    }
    // View switcher (top-left)
    const views = L.control({ position: 'topleft' });
    views.onAdd = () => {
      const el = L.DomUtil.create('div', 'map-views');
      el.innerHTML = Object.entries(VIEWS).map(([k, v]) => `<button data-view="${k}" class="${k === 'nsw' ? 'on' : ''}">${v.label}</button>`).join('');
      L.DomEvent.disableClickPropagation(el);
      el.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        map.flyToBounds(VIEWS[b.dataset.view].bounds, { padding: [20, 20], duration: 0.8 });
      });
      return el;
    };
    views.addTo(map);
    // Floating legend (bottom-left: the area south-west of NSW is empty)
    legendCtl = L.control({ position: 'bottomleft' });
    legendCtl.onAdd = () => { const el = L.DomUtil.create('div', 'map-legend'); L.DomEvent.disableClickPropagation(el); return el; };
    legendCtl.addTo(map);
    // Metro labels only once zoomed in enough to separate them
    const zoomClass = () => $('#map').classList.toggle('zoomed-in', map.getZoom() >= 8);
    map.on('zoomend', zoomClass); zoomClass();
    $('#heatToggle').addEventListener('change', () => renderMap(A.regionMetrics()));
    $('#mapMetric').addEventListener('change', () => renderMap(A.regionMetrics()));
  }

  function renderMap(rows) {
    if (!window.L) { $('#map').innerHTML = '<p class="empty">Map library failed to load (offline?).</p>'; return; }
    if (!map) initMap();
    const dark = isDark();
    const tileUrl = ESRI(dark, 'Base');
    if (!tiles || tiles._url !== tileUrl) {
      tiles?.remove(); labels?.remove();
      tiles = L.tileLayer(tileUrl, { attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 11 }).addTo(map);
      labels = L.tileLayer(ESRI(dark, 'Reference'), { pane: 'labels', maxZoom: 11, opacity: 0.75 }).addTo(map);
    }
    if (nswMask) {
      const page = css('--page'), brand = css('--brand');
      nswMask.setStyle({ fillColor: page }); actMask.setStyle({ fillColor: page });
      nswFill.setStyle({ fillColor: brand }); nswGlow.setStyle({ color: brand }); nswOutline.setStyle({ color: brand });
    }

    const sel = $('#mapMetric');
    const defs = metricDefs();
    const current = sel.value || 'total';
    sel.innerHTML = defs.map(d => `<option value="${d.id}" ${d.id === current ? 'selected' : ''}>${esc(d.label)}</option>`).join('');
    const def = defs.find(d => d.id === sel.value) || defs[0];
    const vals = rows.map(r => r[def.id] ?? 0);
    const max = Math.max(...vals.map(v => Math.abs(v)), 1e-9);

    circles.clearLayers();
    // Draw small bubbles last so they sit on top of big neighbours.
    const order = [...rows].sort((a, b) => Math.abs(b[def.id] ?? 0) - Math.abs(a[def.id] ?? 0));
    for (const r of order) {
      const v = r[def.id] ?? 0;
      const t = Math.abs(v) / max;
      let fill, ink = '#ffffff';
      if (def.diverging) fill = r.status === 'over' ? css('--critical') : r.status === 'under' ? css('--series-1') : css('--good');
      else if (!v) { fill = css('--axis'); ink = css('--ink-2'); }
      else { const tt = 0.3 + t * 0.7; fill = seqColor(tt); ink = seqInk(tt); }
      const size = Math.round(def.diverging ? 26 + 12 * Math.min(3, v) : v ? 22 + 46 * Math.sqrt(t) : 16);
      const flagged = r.status !== 'balanced' || r.fnGap;
      const ring = r.status === 'over' ? css('--critical') : r.status === 'under' ? css('--series-1') : css('--warning');
      const icon = L.divIcon({
        className: `region-marker ${r.metro ? 'metro' : ''}`,
        iconSize: [size, size],
        html: `<div class="map-bubble ${flagged ? 'flagged' : ''}" style="--fill:${fill};--vink:${ink};--ring:${ring};width:${size}px;height:${size}px">
            ${size >= 40 ? `<span class="val">${def.fmt(v)}</span>` : ''}</div>
          <div class="map-name">${esc(shortName(r.name))}</div>`,
      });
      const m = L.marker([r.lat, r.lng], { icon, riseOnHover: true, zIndexOffset: Math.round((1 - t) * 1000) });
      m.bindTooltip(`<b>${esc(r.name)}</b><br>${esc(def.label)}: <b>${def.fmt(v)}</b>`, { direction: 'top', offset: [0, -size / 2], className: 'map-tip' });
      m.bindPopup(popupHtml(r), { className: 'map-popup', maxWidth: 320 });
      circles.addLayer(m);
    }

    if (heat) { heat.remove(); heat = null; }
    // leaflet.heat throws on a zero-size canvas, so skip it while the map is hidden (another tab is open);
    // showTab('overview') re-renders the map once it is visible.
    if ($('#heatToggle').checked && L.heatLayer && !def.diverging && $('#map').offsetWidth > 0) {
      const pts = rows.filter(r => (r[def.id] ?? 0) > 0).map(r => [r.lat, r.lng, Math.max(0.15, (r[def.id] ?? 0) / max)]);
      heat = L.heatLayer(pts, { radius: 55, blur: 40, maxZoom: 9, max: 1, minOpacity: 0.25,
        gradient: { 0.2: css('--seq-200'), 0.5: css('--seq-400'), 0.8: css('--seq-600'), 1: css('--seq-700') } }).addTo(map);
    }

    const legendHtml = def.diverging
      ? `<b>${esc(def.label)}</b>
         <div><span class="swatch" style="background:var(--series-1)"></span>Under-served ≤0.5x</div>
         <div><span class="swatch" style="background:var(--good)"></span>Balanced</div>
         <div><span class="swatch" style="background:var(--critical)"></span>Overspend risk ≥1.75x</div>`
      : `<b>${esc(def.label)}</b>
         <div class="ramp">${seqVars.slice(2).map(v => `<span style="background:var(${v})"></span>`).join('')}</div>
         <div class="ramp-ends"><span>Low</span><span>${def.fmt(max)}</span></div>`;
    legendCtl.getContainer().innerHTML = legendHtml + `<div class="pulse-key"><span class="pulse-dot"></span>Pulsing = flagged</div>`;
    $('#mapLegend').innerHTML = `<span class="muted">Bubble size and colour = ${esc(def.label)} · click a region for detail · labels for Sydney regions appear when you zoom in</span>`;
  }

  function popupHtml(r) {
    const tags = A.INCLUSION_TAGS.filter(t => r.tagSpend[t] > 0).map(t => ({ women: 'Women & girls', firstNations: 'First Nations', pasifika: 'Pasifika/CALD', access: 'Accessibility' }[t]));
    const parts = [['fe', 'Facilities', 'var(--series-1)'], ['pw', 'Workforce', 'var(--series-2)'], ['inc', 'Inclusion', 'var(--series-3)']];
    return `<div class="pop-head"><h3>${esc(r.name)}</h3><span class="status ${r.status}">${{ over: 'Overspend risk', under: 'Under-served', balanced: 'Balanced' }[r.status]}</span></div>
      <div class="pop-stats">
        <div><b>${money(r.total)}</b><span>known spend</span></div>
        <div><b>${r.spendIndex.toFixed(2)}x</b><span>vs population</span></div>
        <div><b>$${r.perResident.toFixed(2)}</b><span>per resident</span></div>
      </div>
      ${r.total ? `<div class="pop-bar">${parts.filter(([k]) => r[k] > 0).map(([k, l, c]) => `<span style="flex:${r[k]};background:${c}" title="${l} ${moneyFull(r[k])}"></span>`).join('')}</div>
      <div class="pop-key">${parts.map(([k, l, c]) => `<span><i style="background:${c}"></i>${l} ${money(r[k])}</span>`).join('')}</div>` : ''}
      <div class="pop-meta">Audit gaps fixed: <b>${r.gaps.size ? [...r.gaps].join(', ') : 'none'}</b><br>
      Inclusion focus: <b>${tags.length ? tags.join(', ') : 'none tagged'}</b>${r.fnGap ? `<br><span class="status risk">First Nations gap</span> ~${r.fnShare}% of residents` : ''}</div>
      ${r.items.length ? `<details><summary>${r.items.length} funded item${r.items.length > 1 ? 's' : ''}</summary><ul>${r.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></details>` : ''}`;
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
    const F = window.Feedback;
    const items = [];
    for (const r of flagged) {
      if (r.status !== 'balanced') {
        const label = r.status === 'over' ? 'Overspend risk' : 'Under-served';
        items.push({ key: `flag:${r.name}:${r.status}`, text: `${r.name} - ${label}`, status: r.status, label,
          body: `<b>${esc(r.name)}</b> ${r.spendIndex.toFixed(2)}x · ${money(r.total)} · $${r.perResident.toFixed(2)}/resident` });
      }
      if (r.fnGap) items.push({ key: `flag:${r.name}:fn-gap`, text: `${r.name} - First Nations gap`, status: 'risk', label: 'First Nations gap',
        body: `<b>${esc(r.name)}</b> <span class="muted small">~${r.fnShare}% First Nations residents, no program reach</span>` });
    }
    $('#flagList').innerHTML = items.map(it => {
      const disputed = F?.ratingFor(it.key)?.vote === 'down';
      return `<li class="${disputed ? 'disputed' : ''}"><span class="status ${it.status}">${it.label}</span><div>${it.body} ${F ? F.badgeHtml(it.key) : ''}</div>${F ? F.ratingHtml(it.key, it.text, 'Flag') : ''}</li>`;
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
    const F = window.Feedback;
    const key = 'insight:' + i.id;
    const disputed = F?.ratingFor(key)?.vote === 'down';
    return `<article class="bubble ${i.severity} ${disputed ? 'disputed' : ''}" data-id="${esc(i.id)}">
      <div class="meta"><span class="status ${i.severity}">${sev}</span>${i.impact ? `<span class="impact-chip ${i.impact}">${i.impact[0].toUpperCase() + i.impact.slice(1)}</span>` : ''}<span>${esc(i.pillar)}</span>${i.region ? `<span>· ${esc(i.region)}</span>` : ''}<span>· ${esc(i.agent || '')}</span>
        ${F ? F.ratingHtml(key, i.title, 'Insight') : ''}<button class="remove" title="Delete insight" aria-label="Delete insight">×</button></div>
      ${F ? F.badgeHtml(key) : ''}
      ${i.check ? `<div class="fact-check" title="Automatic check against the dashboard data">⚠ Fails data check: ${esc(i.check)}</div>` : ''}
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
    document.dispatchEvent(new CustomEvent('insights-changed'));
  }

  // ---------- agent run progress ----------
  // Each agent goes queued -> loading (model into memory) -> reading (processing the prompt) -> writing
  // (tokens streaming) -> done. Progress, ETA and "may be stuck" warnings are derived from those phases.
  const fmtDur = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`; };
  let run = null; // { states: {id: state}, order, start, ctl, ticker, poller, modelLoaded }

  function agentFraction(s) {
    if (!s || s.phase === 'queued') return 0;
    if (['done', 'failed', 'cancelled'].includes(s.phase)) return 1;
    const now = Date.now();
    if (s.phase === 'writing') return 0.35 + 0.65 * Math.min(0.97, s.tokens / (s.expectedTokens || 400));
    return 0.35 * Math.min(0.95, (now - s.start) / (s.estReadMs || 30000));
  }

  function agentRemainingMs(s, agent) {
    const exp = s?.expectedTokens || O.expectedTokens(agent.count || 3);
    if (!s || s.phase === 'queued') return O.estimateReadMs(2500) + O.estimateWriteMs(exp); // later agents reuse the prompt cache
    if (s.phase === 'writing') return O.estimateWriteMs(Math.max(0, exp - s.tokens));
    if (['done', 'failed', 'cancelled'].includes(s.phase)) return 0;
    return Math.max(2000, (s.estReadMs || 30000) - (Date.now() - s.start)) + O.estimateWriteMs(exp);
  }

  function phaseText(s, agent) {
    const now = Date.now();
    switch (s?.phase) {
      case undefined: return 'Ready';
      case 'queued': return 'Waiting in queue';
      case 'loading': return `Loading the model into memory… ${fmtDur(now - s.start)}`;
      case 'reading': return `Reading the data… ${fmtDur(now - s.start)} (usually ~${fmtDur(s.estReadMs)})`;
      case 'writing': return `Writing · ${s.tokens} tokens · insight ${Math.min(s.insightsTotal, s.insightsWritten + 1)} of ${s.insightsTotal}`;
      case 'done': return `✓ ${s.count} insights in ${fmtDur(s.end - s.start)}`;
      case 'cancelled': return 'Cancelled';
      case 'failed': return `AI failed (${s.error}) - used rule engine`;
    }
    return '';
  }

  function stallWarning(s) {
    if (!s) return '';
    const now = Date.now();
    if (run?.reachable === false) return 'Can\'t reach Ollama right now. Check that it is running (llama icon in the system tray, or "ollama serve").';
    if ((s.phase === 'reading' || s.phase === 'loading') && now - s.start > Math.max(2.5 * s.estReadMs, 180000))
      return `Still reading after ${fmtDur(now - s.start)}, which is longer than usual (about ${fmtDur(s.estReadMs)} expected on this machine). Ollama may be busy with another request or stuck. You can keep waiting or press Cancel.`;
    if (s.phase === 'writing' && now - s.lastTokenAt > 30000)
      return `No new text for ${fmtDur(now - s.lastTokenAt)}. The model may be stuck. You can keep waiting or press Cancel.`;
    return '';
  }

  function renderAgentChips() {
    const states = run?.states || {};
    $('#agentChips').innerHTML = O.AGENTS.map(a => {
      const s = states[a.id];
      const cls = !s ? 'idle' : s.phase === 'done' ? 'done' : ['failed', 'cancelled'].includes(s.phase) ? 'failed' : s.phase === 'queued' ? 'queued' : 'running';
      const pct = Math.round(agentFraction(s) * 100);
      const indeterminate = s && (s.phase === 'reading' || s.phase === 'loading');
      return `<div class="agent ${cls}"><div class="avatar">${a.id}</div>
        <div class="agent-body"><b>${a.name}</b><div class="state">${esc(phaseText(s, a))}</div>
        ${s && s.phase !== 'queued' ? `<div class="mini-bar ${indeterminate ? 'indeterminate' : ''}"><span style="width:${pct}%"></span></div>` : ''}</div></div>`;
    }).join('');
  }

  function renderRunProgress() {
    if (!run) { $('#runProgress').hidden = true; return; }
    $('#runProgress').hidden = false;
    const agents = O.AGENTS;
    const fractions = agents.map(a => agentFraction(run.states[a.id]));
    const overall = fractions.reduce((x, y) => x + y, 0) / agents.length;
    const current = agents.find(a => !['done', 'failed', 'cancelled', 'queued'].includes(run.states[a.id]?.phase));
    const finished = agents.filter(a => ['done', 'failed', 'cancelled'].includes(run.states[a.id]?.phase)).length;
    const eta = agents.reduce((t, a) => t + agentRemainingMs(run.states[a.id], a), 0);
    const pct = Math.round(overall * 100);
    $('#rpFill').style.width = pct + '%';
    $('#rpBar').setAttribute('aria-valuenow', pct);
    $('#rpTitle').textContent = run.finished
      ? `Finished · ${finished} of ${agents.length} agents · ${fmtDur(run.end - run.start)}`
      : `${pct}% · agent ${Math.min(agents.length, finished + 1)} of ${agents.length}${current ? ' · ' + current.name : ''}`;
    $('#rpMeta').textContent = run.finished ? '' : `Elapsed ${fmtDur(Date.now() - run.start)} · about ${fmtDur(eta)} left (estimate from this machine's speed) · model ${O.config.model}`;
    const warn = current ? stallWarning(run.states[current.id]) : '';
    $('#rpWarn').hidden = !warn;
    $('#rpWarn').textContent = warn ? '⚠ ' + warn : '';
    $('#cancelAgents').hidden = !!run.finished;
    const s = current && run.states[current.id];
    $('#rpLive').textContent = s?.text ? s.text.slice(-900) : s ? (s.phase === 'loading' ? 'Loading the model into memory…' : `${current.name} is reading the data (${(s.promptChars / 1000).toFixed(1)}k characters). Text appears here as soon as it starts writing.`) : (run.finished ? 'Done.' : 'Waiting for the first words…');
    $('#rpLive').scrollTop = $('#rpLive').scrollHeight;
  }

  async function pollModelStatus() {
    if (!run || run.finished) return;
    const current = O.AGENTS.find(a => ['reading', 'loading'].includes(run.states[a.id]?.phase));
    const st = await O.status();
    if (!run) return;
    run.reachable = st.reachable;
    if (current) {
      const s = run.states[current.id];
      if (s.phase === 'reading' && st.reachable && !st.loaded) s.phase = 'loading';
      else if (s.phase === 'loading' && st.loaded) s.phase = 'reading';
    }
  }

  async function runAgents() {
    if (!requireModel()) return;
    const btn = $('#runAgents');
    btn.disabled = true; btn.textContent = 'Running…';
    run = { states: {}, start: Date.now(), ctl: new AbortController() };
    O.AGENTS.forEach(a => run.states[a.id] = { phase: 'queued' });
    const tick = () => { renderAgentChips(); renderRunProgress(); };
    run.ticker = setInterval(tick, 1000);
    run.poller = setInterval(pollModelStatus, 4000);
    tick();
    const rules = A.ruleInsights();
    for (const agent of O.AGENTS) {
      if (run.ctl.signal.aborted) { run.states[agent.id] = { phase: 'cancelled' }; continue; }
      run.states[agent.id] = { phase: 'reading', start: Date.now(), tokens: 0, estReadMs: 30000 };
      tick();
      try {
        const list = await O.runAgent(agent, {
          signal: run.ctl.signal,
          onProgress: pr => {
            const s = run.states[agent.id];
            Object.assign(s, pr, { phase: pr.phase === 'reading' && s.phase === 'loading' ? 'loading' : pr.phase });
            if (pr.phase === 'writing') renderRunProgress(); // live text without waiting for the ticker
          },
        });
        addInsights(list, { replacePillar: agent.pillar });
        Object.assign(run.states[agent.id], { phase: 'done', count: list.length, end: Date.now() });
      } catch (e) {
        console.error(agent.name, e);
        if (run.ctl.signal.aborted) { run.states[agent.id].phase = 'cancelled'; continue; }
        addInsights(rules.filter(r => r.pillar === agent.pillar), { replacePillar: agent.pillar });
        const reason = String(e.message || e).replace(/^Error:\s*/, '').slice(0, 140);
        Object.assign(run.states[agent.id], { phase: 'failed', error: reason, end: Date.now() });
        toast(`${agent.name}: ${reason}`, 6000);
      }
      tick();
    }
    clearInterval(run.ticker); clearInterval(run.poller);
    run.finished = true; run.end = Date.now();
    tick();
    btn.disabled = false; btn.textContent = 'Run agents';
    toast(run.ctl.signal.aborted ? 'Agents cancelled.' : 'Agents finished.');
  }

  function runRules() {
    const rules = A.ruleInsights();
    insights = insights.filter(i => i.pillar === 'Uploaded data' || i.pillar === 'Data quality');
    addInsights(rules);
    toast(`${rules.length} rule-based insights added.`);
  }

  async function ask(question) {
    if (!requireModel()) return;
    const el = document.createElement('article');
    el.className = 'bubble answer watch thinking';
    el.innerHTML = `<div class="meta"><span>You asked</span></div><h3>${esc(question)}</h3><div class="md"><p></p></div>`;
    $('#bubbles').prepend(el);
    const known = insights.slice(0, 12).map(i => `- [${i.pillar}] ${i.title}: ${i.insight}`).join('\n');
    try {
      await O.stream([
        { role: 'system', content: O.SYSTEM },
        { role: 'user', content: `${O.sharedContext()}\n\nEXISTING INSIGHTS:\n${known || 'none'}\n\nQUESTION: ${question}\nAnswer in under 200 words using markdown. Cite figures from the data.` },
      ], (_, full) => { $('.md', el).innerHTML = md(full); }, { label: 'Question' });
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
    $('#cancelAgents').addEventListener('click', () => { run?.ctl.abort(); toast('Cancelling…'); });
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
    // Delete an insight (asks why it is inaccurate first). Works for every bubble list.
    document.addEventListener('click', async e => {
      const btn = e.target.closest('.bubble .remove');
      if (!btn) return;
      const id = btn.closest('.bubble').dataset.id;
      const ins = insights.find(i => i.id === id);
      if (!ins || !(await window.Feedback.confirmDelete('Insight', ins.title))) return;
      insights = insights.filter(i => i.id !== id);
      persist();
      renderBubbles();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await Store.init();
    insights = Store.get('insights') || [];
    initTabs();
    initSettings();
    initMatrixFilter();
    renderOverview();
    initInsights();
    checkOllama();
    document.addEventListener('feedback-changed', () => { renderFlags(A.regionMetrics()); renderBubbles(); });
    // Top-bar pill mirrors whatever the AI is doing anywhere in the app.
    document.addEventListener('ai-activity', e => {
      const d = e.detail, pill = $('#ollamaStatus');
      if (d.active > 0 && (d.phase === 'reading' || d.phase === 'writing')) {
        pill.classList.add('busy');
        $('.label', pill).textContent = `AI: ${d.label} · ${d.phase === 'writing' ? `writing ${d.tokens} tokens` : `reading ${fmtDur(Date.now() - d.start)}`}`;
      } else if (d.active === 0) {
        pill.classList.remove('busy');
        if (pill.classList.contains('ok')) $('.label', pill).textContent = (O.viaServer ? 'AI: ' : 'Ollama: ') + O.config.model;
      }
    });
    document.dispatchEvent(new CustomEvent('app-ready'));
  });

  return {
    $, $$, esc, md, money, moneyFull, pct, toast, requireModel, addInsights, renderOverview, renderBubbles, bubbleHtml, pillarChartImage, showTab,
    get insights() { return insights; },
  };
})();
