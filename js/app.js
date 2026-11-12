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
    // A link like /#impact (or /#impact/kpis for a sub-view) opens that tab directly; otherwise reopen the last tab.
    const [fromHash, sub] = decodeURIComponent(location.hash.slice(1)).split('/');
    const known = id => $(`#tab-${CSS.escape(id || '')}`);
    const saved = known(fromHash) ? fromHash : (() => { try { return localStorage.getItem('tackle.tab'); } catch { return null; } })();
    if (saved && known(saved)) showTab(saved);
    if (known(fromHash) && sub && $(`[data-subview="${CSS.escape(fromHash)}:${CSS.escape(sub)}"]`)) showView(fromHash, sub); // story/<type> is handled by story.js
  }
  // Sub-views inside a tab keep long pages short: buttons <button data-view="impact:kpis"> switch the matching
  // panel <div data-subview="impact:kpis">. The choice is remembered per tab.
  function showView(group, view) {
    $$(`[data-subview^="${group}:"]`).forEach(p => p.classList.toggle('active', p.dataset.subview === `${group}:${view}`));
    $$(`[data-view^="${group}:"]`).forEach(b => { const on = b.dataset.view === `${group}:${view}`; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    try { localStorage.setItem('tackle.view.' + group, view); } catch {}
    document.dispatchEvent(new CustomEvent('view', { detail: { group, view } }));
  }
  function initViews() {
    const groups = [...new Set($$('[data-subview]').map(p => p.dataset.subview.split(':')[0]))];
    for (const g of groups) {
      const first = $(`[data-subview^="${g}:"]`).dataset.subview.split(':')[1];
      let saved = null; try { saved = localStorage.getItem('tackle.view.' + g); } catch {}
      showView(g, saved && $(`[data-subview="${g}:${saved}"]`) ? saved : first);
    }
    $$('[data-view]').forEach(b => b.addEventListener('click', () => { const [g, v] = b.dataset.view.split(':'); showView(g, v); }));
  }
  function showTab(id) {
    // "methodology" is a page inside the Framework tab, so the Framework tab stays highlighted.
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === (id === 'methodology' ? 'framework' : id)));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
    try { localStorage.setItem('tackle.tab', id); } catch {}
    if (id === 'overview' && map) setTimeout(() => {
      map.invalidateSize();
      if (mapNeedsFit && $('#map').offsetWidth) { map.fitBounds(VIEWS.nsw.bounds, { padding: [10, 10] }); mapNeedsFit = false; }
      renderMap(A.regionMetrics());
    }, 50);
    document.dispatchEvent(new CustomEvent('tab', { detail: id }));
  }

  function initTheme() {
    let theme = null;
    try { theme = localStorage.getItem('tackle.theme'); } catch {}
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light'; // light is the default (Power BI style)
    const mark = () => $$('#themeToggle button').forEach(b => b.classList.toggle('on', b.dataset.themeSet === (isDark() ? 'dark' : 'light')));
    $$('#themeToggle button').forEach(b => b.addEventListener('click', () => {
      if ((isDark() ? 'dark' : 'light') === b.dataset.themeSet) return;
      document.documentElement.dataset.theme = b.dataset.themeSet;
      try { localStorage.setItem('tackle.theme', b.dataset.themeSet); } catch {}
      mark();
      renderOverview();
    }));
    mark();
  }
  // Pages pane: full width or a narrow icon rail (☰ in the header), remembered per browser.
  function initRail() {
    const btn = $('#railToggle');
    if (!btn) return;
    const set = collapsed => {
      document.documentElement.classList.toggle('rail-collapsed', collapsed);
      btn.setAttribute('aria-expanded', !collapsed);
      btn.setAttribute('aria-label', collapsed ? 'Expand the Pages pane' : 'Collapse the Pages pane');
      try { localStorage.setItem('tackle.rail', collapsed ? 'collapsed' : 'open'); } catch {}
      setTimeout(() => window.dispatchEvent(new Event('resize')), 200); // the map re-measures its width
    };
    let saved = null; try { saved = localStorage.getItem('tackle.rail'); } catch {}
    set(saved === 'collapsed');
    btn.addEventListener('click', () => set(!document.documentElement.classList.contains('rail-collapsed')));
  }
  // Light is the default; dark is opt-in via the toggle.
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
      { id: 'spendIndex', label: 'Spend vs population', fmt: v => v.toFixed(2) + 'x', diverging: true },
      { id: 'evidenceCount', label: 'Impact evidence records', fmt: v => String(v) },
    ];
    for (const l of A.customLayers()) defs.push({ id: 'custom:' + l.id, label: '⬆ ' + l.label, fmt: v => v == null ? '–' : Number(v).toLocaleString() });
    return defs;
  }

  // The headline: the $10M, and how much of it can be traced so far.
  function renderKpis(c) {
    const funding = D.context.totalLegacyFunding, res = Store.get('programs') || {};
    const reported = window.Programs.programs().map(p => res[p.id]).filter(r => Number.isFinite(r?.spent));
    const spent = reported.reduce((s, r) => s + r.spent, 0), dummy = reported.some(r => r.dummy);
    const tiles = [
      ['Legacy funding', money(funding), '2025 to 2028', 'Total NSW Rugby World Cup Legacy Program funding. Everything on this page is about what this money delivers.'],
      ['Allocated so far', money(c.knownTotal), `${Math.round(c.knownTotal / funding * 100)}% of the $10M`, `${moneyFull(c.knownTotal)} = Round 1 Legacy grants + 3-year RWC Dashboard budgets + any uploaded spend. Allocations, not audited spend.`],
      ['Not yet traced', money(Math.max(0, funding - c.knownTotal)), 'no project or budget line yet', `${moneyFull(funding)} − ${moneyFull(c.knownTotal)} allocated. Includes Round 2 grants, which are decided but not announced yet. Its impact cannot be measured until it is assigned.`],
      ['Spent so far', reported.length ? money(spent) + (dummy ? ' [DUMMY]' : '') : 'Not reported', reported.length ? `${reported.length} lines reported` : 'recipients report at acquittal', reported.length ? `Sum of spend recorded for ${reported.length} lines.${dummy ? ' Made-up figures from Demo view.' : ''}` : 'No project has finished. Recipients report actual spend in their acquittal report, when the project ends (31/12/2027 or 30/06/2028).'],
    ];
    $('#kpiRow').innerHTML = tiles.map(([l, v, s, t]) => `<div class="kpi"><div class="label">${l}</div><div class="value"><span data-tip="${esc(t)}" tabindex="0">${v}</span></div><div class="sub">${s}</div></div>`).join('');
  }

  let map, tiles, labels, circles, heat, nswMask, actMask, nswFill, nswGlow, nswOutline, legendCtl, mapNeedsFit = false;
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
    // Fitting a hidden (zero-size) map picks a nonsense zoom; re-fit when the Overview tab is first shown.
    mapNeedsFit = !$('#map').offsetWidth;
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
      m.bindTooltip(`<b>${esc(r.name)}</b><br>${esc(def.label)}: <b>${def.fmt(v)}</b><br><span class="muted small">${esc((COL_TIPS[def.id] || '').split('\n')[0])}</span>`, { direction: 'top', offset: [0, -size / 2], className: 'map-tip' });
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
         <div><span class="swatch" style="background:var(--series-1)"></span>Below population share ≤0.5x</div>
         <div><span class="swatch" style="background:var(--good)"></span>In line</div>
         <div><span class="swatch" style="background:var(--critical)"></span>Above population share ≥1.75x</div>`
      : `<b>${esc(def.label)}</b>
         <div class="ramp">${seqVars.slice(2).map(v => `<span style="background:var(${v})"></span>`).join('')}</div>
         <div class="ramp-ends"><span>Low</span><span>${def.fmt(max)}</span></div>`;
    const how = COL_TIPS[def.id] || colTip({ key: def.id, label: def.label });
    legendCtl.getContainer().innerHTML = legendHtml.replace('<b>', `<b data-tip="${esc(`How "${def.label}" is measured:\n${how}`)}" tabindex="0">`)
      + `<div class="pulse-key" data-tip="Pulsing = worth a closer look: well above (≥1.75x) or below (≤0.5x) its population share, or a First Nations program opportunity."><span class="pulse-dot"></span>Pulsing = worth a closer look</div>`;
    $('#mapLegend').innerHTML = `<span class="muted">Bubble size and colour = <span data-tip="${esc(how)}" tabindex="0">${esc(def.label)}</span> · click a region for detail · labels for Sydney regions appear when you zoom in</span>`;
  }

  function popupHtml(r) {
    const tags = A.INCLUSION_TAGS.filter(t => r.tagSpend[t] > 0).map(t => ({ women: 'Women & girls', firstNations: 'First Nations', pasifika: 'Pasifika/CALD', access: 'Accessibility' }[t]));
    const parts = [['fe', 'Facilities', 'var(--series-1)'], ['pw', 'Workforce', 'var(--series-2)'], ['inc', 'Inclusion', 'var(--series-3)']];
    return `<div class="pop-head"><h3>${esc(r.name)}</h3><span class="status ${r.status}">${{ over: 'Above population share', under: 'Below population share', balanced: 'In line with population' }[r.status]}</span></div>
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

  // "How is this measured?" for every map measure (shown on hover over the legend).
  const PROTO = '\n\nPrototype screening indicator: not from an external framework. Pending review by the evaluation team.';
  const COL_TIPS = {
    fe: 'Sum of Facilities & Equipment (Pillar 1) Legacy grants located in this region: Round 1 grants plus uploaded spend.',
    pw: 'Sum of Programs & Workforce (Pillar 3) grants and 3-year RWC Dashboard budget lines located in this region (other non-facility, non-inclusion lines such as activation are counted here too).',
    inc: 'Sum of Inclusion (Pillar 4) grants and 3-year RWC Dashboard budget lines located in this region.',
    total: 'All known allocations located in this region (grants + dashboard budgets + uploads). "Statewide" lines held centrally are not in any region.',
    perResident: 'Total $ in the region ÷ region population (indicative ABS 2021 approximation).',
    spendIndex: 'Region\'s share of regionally allocated spend ÷ its share of NSW population. 1.75x or more = above population share; 0.5x or less = below it.' + PROTO,
    facilityCount: 'Number of Facilities & Equipment grants located in the region.',
    women: 'Sum of grants and budget lines tagged women & girls in this region.',
    fn: 'Indicative First Nations share of residents (ABS 2021, rounded). ✓ = a First Nations-tagged line or talent ID workshop reaches the region; ⚠ gap = First Nations share of 7% or more and no program reach.',
    pasifika: 'Sum of grants and budget lines tagged Pasifika / CALD in this region.',
    access: 'Sum of grants and budget lines tagged disability / accessibility in this region.',
    evidenceCount: 'Count of field evidence records (surveys, interviews, business feedback, stories) logged against this region or imported from uploads. This is a count of evidence, not a measure of impact.',
  };
  const colTip = c => COL_TIPS[c.key] || (c.key.startsWith('custom:') ? 'Values from an uploaded file\'s numeric region column, added up per region.' : c.label);

  function renderOverview() {
    const rows = A.regionMetrics();
    renderKpis(A.centralisation(rows));
    renderMap(rows);
  }

  // ---------- insights ----------
  let insightFilter = 'all', insightQueue = 'todo';
  const MAX_ARCHIVED = 60;
  const voteOf = i => window.Feedback?.ratingFor('insight:' + i.id)?.vote;
  // Review state: archived (from an older run) > verified (👍) > disputed (👎) > to review.
  const insightState = i => i.archived ? 'archived' : voteOf(i) === 'up' ? 'verified' : voteOf(i) === 'down' ? 'disputed' : 'todo';
  // Title similarity (shared meaningful words) to spot the same insight re-worded by a new run.
  const words = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  function similar(a, b) {
    const x = words(a), y = words(b);
    if (!x.size || !y.size) return 0;
    let both = 0; for (const w of x) if (y.has(w)) both++;
    return both / Math.min(x.size, y.size);
  }
  const sameInsight = (a, b) => a.pillar === b.pillar && (a.region || '') === (b.region || '') && similar(a.title, b.title) >= 0.6;

  // replacePillar: a pillar name or a predicate. Instead of deleting the previous run, its UNRATED insights
  // are archived (rated ones are kept), and new insights that repeat a kept one are skipped.
  function addInsights(list, { replacePillar } = {}) {
    const replaces = typeof replacePillar === 'function' ? replacePillar : p => p === replacePillar;
    let archived = 0, skipped = 0, added = 0;
    if (replacePillar) insights = insights.map(i => !i.archived && replaces(i.pillar) && !voteOf(i) ? (archived++, { ...i, archived: Date.now() }) : i);
    for (const n of list) {
      if (insights.some(o => !o.archived && sameInsight(o, n))) { skipped++; continue; }
      insights.push({ id: crypto.randomUUID?.() || String(Math.random()), created: Date.now(), ...n });
      added++;
    }
    const old = insights.filter(i => i.archived).sort((a, b) => b.archived - a.archived).slice(MAX_ARCHIVED).map(i => i.id);
    if (old.length) insights = insights.filter(i => !old.includes(i.id));
    persist();
    renderBubbles();
    return { added, archived, skipped };
  }
  const runSummary = r => `${r.added} new${r.archived ? ` · ${r.archived} previous archived` : ''}${r.skipped ? ` · ${r.skipped} repeat${r.skipped === 1 ? '' : 's'} hidden` : ''}`;

  function bubbleHtml(i) {
    const sev = { positive: 'Positive', watch: 'Watch', risk: 'Risk' }[i.severity] || 'Watch';
    const F = window.Feedback;
    const key = 'insight:' + i.id;
    const disputed = F?.ratingFor(key)?.vote === 'down';
    return `<article class="bubble ${i.severity} ${disputed ? 'disputed' : ''}" data-id="${esc(i.id)}">
      <div class="meta"><span class="status ${i.severity}">${sev}</span>${i.impact ? `<span class="impact-chip ${i.impact}">${i.impact[0].toUpperCase() + i.impact.slice(1)}</span>` : ''}<span>${esc(i.pillar)}</span>${i.region ? `<span>· ${esc(i.region)}</span>` : ''}<span>· ${esc(i.agent || '')}</span>
        ${i.archived ? '<button class="link restore" title="Move back to the review queue">Restore</button>' : ''}${F ? F.ratingHtml(key, i.title, 'Insight') : ''}<button class="remove" title="Delete insight" aria-label="Delete insight">×</button></div>
      ${F ? F.badgeHtml(key) : ''}
      ${i.check ? `<div class="fact-check" title="Automatic check against the dashboard data">⚠ Fails data check: ${esc(i.check)}</div>` : ''}
      <h3>${esc(i.title)}</h3>
      <p>${esc(i.insight)}</p>
      ${i.evidence ? `<div class="evidence">${esc(i.evidence)}</div>` : ''}
      ${i.action ? `<div class="action">${esc(i.action)}</div>` : ''}
    </article>`;
  }

  function renderBubbles() {
    const inPillar = insights.filter(i => insightFilter === 'all' || i.pillar === insightFilter);
    const counts = { todo: 0, verified: 0, disputed: 0, archived: 0 };
    for (const i of inPillar) counts[insightState(i)]++;
    $$('#insightQueue button').forEach(b => { b.classList.toggle('on', b.dataset.q === insightQueue); $('span', b).textContent = counts[b.dataset.q]; });
    const list = inPillar.filter(i => insightState(i) === insightQueue);
    const empty = !insights.some(i => !i.archived)
      ? 'No insights yet. Press <b>Run agents</b> to have your local Ollama model analyse the data, or <b>Rule-based only</b> for instant insights without AI.'
      : { todo: 'All caught up: every insight here has been rated. See Verified and Disputed.', verified: 'Nothing verified yet. Rate an insight 👍 to verify it.', disputed: 'Nothing disputed.', archived: 'No archived insights. Unrated insights from a previous run are archived here when the agents run again.' }[insightQueue];
    $('#bubbles').innerHTML = list.length ? list.map(bubbleHtml).join('') : `<div class="empty">${empty}</div>`;
    $('#insightCount').textContent = `${list.length} shown · ${counts.todo} to review`;
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
    // No model: fill the insights from the rule engine (real data) instead of leaving the queue empty.
    if (!(O.config.model && $('#ollamaStatus').classList.contains('ok'))) { runRules({ quiet: true }); toast('Your AI model is not connected, so the insights come from the rule engine (calculated from the data). Connect a model in Settings to run the agents.', 6000); return; }
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
    if (!run.ctl.signal.aborted) window.DataHistory?.markAiRun();
    toast(run.ctl.signal.aborted ? 'Agents cancelled.' : 'Agents finished.');
  }

  function runRules({ quiet = false } = {}) {
    const r = addInsights(A.ruleInsights(), { replacePillar: p => p !== 'Uploaded data' && p !== 'Data quality' });
    window.DataHistory?.markAiRun();
    if (!quiet) toast(`Rule-based insights: ${runSummary(r)}.`);
  }

  // Bring the insights up to date with the data: the AI agents when the model is connected, else the rule engine.
  // Called from Data Studio > History ("Refresh AI insights") and automatically after data changes when switched on.
  function refreshAi({ quiet = false } = {}) {
    if ($('#runAgents')?.disabled) return; // already running
    if (O.config.model && $('#ollamaStatus').classList.contains('ok')) { if (!quiet) toast('AI agents are re-reading the latest data…'); return runAgents(); }
    runRules({ quiet });
    if (!quiet) toast('AI not connected: insights refreshed with the rule engine.');
  }

  async function ask(question) {
    const el = document.createElement('article');
    el.className = 'bubble answer watch thinking';
    el.innerHTML = `<div class="meta"><span>You asked</span></div><h3>${esc(question)}</h3><div class="md"><p></p></div>`;
    $('#bubbles').prepend(el);
    if (!(O.config.model && $('#ollamaStatus').classList.contains('ok'))) { // no model: answer from the data instead of nothing
      el.classList.remove('thinking');
      $('.md', el).innerHTML = `<p class="muted small">Your AI model is not connected (Settings, top bar), so this answer is the closest findings from the data, worked out in code:</p>${md(dataAnswer(question))}`;
      return;
    }
    // Keep everything after the shared data short: on a CPU-only machine every extra token adds reading time.
    const known = insights.filter(i => !i.archived && insightState(i) !== 'disputed').slice(0, 6).map(i => `- [${i.pillar}] ${i.title}`).join('\n');
    const tail = `\n\nEXISTING INSIGHT TITLES:\n${known || 'none'}\n\nQUESTION: ${question}\nAnswer in under 120 words using markdown. Cite figures from the data.`;
    // The shared data is skipped if the model has already read it (see Ollama.warm); estimate accordingly.
    const warm = O.isWarm();
    const estRead = O.estimateReadMs(warm ? tail.length + 300 : O.sharedContext().length + tail.length);
    const status = $('.md p', el);
    let started = false;
    try {
      await O.stream([
        { role: 'system', content: O.SYSTEM },
        { role: 'user', content: `${O.sharedContext()}${tail}` },
      ], (_, full) => { started = true; $('.md', el).innerHTML = md(full); }, {
        label: 'Question', numPredict: 320,
        onProgress: pr => {
          if (started || pr.phase !== 'reading') return;
          const t = Date.now() - pr.start;
          status.textContent = warm
            ? `Thinking… ${fmtDur(t)}`
            : `Reading the program data… ${fmtDur(t)} of about ${fmtDur(estRead)} (later questions are much faster)`;
        },
      });
      el.classList.remove('thinking');
    } catch (e) {
      el.classList.remove('thinking');
      $('.md', el).innerHTML = `<p class="muted small">Your AI model could not answer (${esc(e.message)}). Closest findings from the data, worked out in code:</p>${md(dataAnswer(question))}`;
    }
  }

  // Placeholder answer when the model fails: the rule-based insights and recommendations that share the most words
  // with the question. Real data only (Demo view's [DUMMY] figures are not used by these rules' Legacy figures).
  function dataAnswer(question) {
    const stop = /^(what|which|where|when|have|does|with|from|that|this|they|their|about|into|much|many|the|and|for|are|how|our|has|did|was|were|will|can|should|legacy|program|rugby)$/;
    const qw = [...new Set(question.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.test(w)))];
    const facts = [
      ...A.ruleInsights().map(r => ({ text: `**${r.title}.** ${r.insight}`, hay: `${r.title} ${r.insight} ${r.pillar} ${r.region || ''}` })),
      ...(window.Recommendations?.build?.() || []).map(r => ({ text: `**Since ${r.since},** ${r.can}.`, hay: `${r.area} ${r.since} ${r.can}` })),
    ];
    const score = f => qw.filter(w => f.hay.toLowerCase().includes(w)).length;
    const ranked = facts.map(f => ({ ...f, s: score(f) })).sort((a, b) => b.s - a.s);
    const top = (ranked[0]?.s ? ranked.filter(f => f.s) : ranked).slice(0, 3);
    return top.length ? top.map(f => `- ${f.text}`).join('\n') : '- No calculated finding matches this question yet.';
  }

  // Pre-read the program data into the model's memory while the user is about to ask something,
  // so the question itself only needs a few seconds of reading. Skipped if the AI is busy or offline.
  function prewarm() {
    if (!$('#ollamaStatus').classList.contains('ok') || O.busy) return;
    O.warm();
  }

  function initInsights() {
    renderAgentChips();
    renderBubbles();
    $('#runAgents').addEventListener('click', runAgents);
    $('#cancelAgents').addEventListener('click', () => { run?.ctl.abort(); toast('Cancelling…'); });
    $('#runRules').addEventListener('click', () => runRules());
    $$('#insightFilter button').forEach(b => b.addEventListener('click', () => {
      $$('#insightFilter button').forEach(x => x.classList.toggle('on', x === b));
      insightFilter = b.dataset.f;
      renderBubbles();
    }));
    $$('#insightQueue button').forEach(b => b.addEventListener('click', () => { insightQueue = b.dataset.q; renderBubbles(); }));
    document.addEventListener('click', e => {
      const btn = e.target.closest('.bubble .restore');
      if (!btn) return;
      const id = btn.closest('.bubble').dataset.id;
      insights = insights.map(i => i.id === id ? { ...i, archived: undefined } : i);
      persist();
      renderBubbles();
      toast('Insight moved back to To review.');
    });
    $('#askInput').addEventListener('focus', prewarm);
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

  // "How we got this number" tooltips: any element with data-tip shows it on hover or keyboard focus.
  function initTips() {
    const tip = document.createElement('div');
    tip.className = 'how-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    let owner = null;
    const show = el => {
      owner = el;
      tip.textContent = el.dataset.tip;
      tip.classList.add('on');
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      const left = Math.max(8, Math.min(r.left, innerWidth - w - 8));
      const top = r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8;
      tip.style.left = left + 'px';
      tip.style.top = Math.max(8, top) + 'px';
    };
    const hide = () => { owner = null; tip.classList.remove('on'); };
    // Plain title="" attributes get the same styled tooltip (and stop the browser's own one appearing too).
    const adopt = el => { if (el && !el.dataset.tip && el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); el.classList.add('tip-plain'); } };
    document.addEventListener('mouseover', e => { adopt(e.target.closest('[title]')); const el = e.target.closest('[data-tip]'); if (el && el !== owner) show(el); else if (!el && owner) hide(); });
    document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); el ? show(el) : hide(); });
    document.addEventListener('scroll', hide, true);
    // Drop-down menus (<details class="menu">): close on outside click, after choosing an item, or with Esc.
    document.addEventListener('click', e => {
      for (const m of $$('details.menu[open]')) if (!m.contains(e.target) || e.target.closest('.menu-list button')) m.open = false;
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('details.menu[open]').forEach(m => { m.open = false; }); });
    // In-text links to another tab: <a href="#" data-goto="methodology">
    document.addEventListener('click', e => { const a = e.target.closest('[data-goto]'); if (a) { e.preventDefault(); hide(); showTab(a.dataset.goto); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initTips();
    initTheme();
    initRail();
    await Store.init();
    await window.DemoView?.init();
    insights = Store.get('insights') || [];
    initViews();
    initTabs();
    initSettings();
    renderOverview();
    initInsights();
    checkOllama();
    document.addEventListener('feedback-changed', () => renderBubbles());
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
    $, $$, esc, md, money, moneyFull, pct, toast, requireModel, addInsights, renderOverview, renderBubbles, refreshAi, bubbleHtml, showTab, showView,
    get insights() { return insights.filter(i => !i.archived); }, // archived (older-run) insights stay out of Impact, Story and the AI
    insightState,
  };
})();
