// Demo view (top bar switch): fills what is not recorded or not measured with made-up values from demo/Dummy-dataset.csv.
// Off by default: without it the app shows real data only. When on, the page runs in the sandbox, so nothing is saved
// and real records stay untouched; a real value always wins over a dummy one. Every dummy value is tagged [DUMMY] on
// screen and in the AI briefing. Demo view assumes all the data is there, so nothing reads as unmeasured while it is on.
// Switching reloads the page.
window.DemoView = (() => {
  const FILE = 'Dummy-dataset.csv', KEY = 'tackle.demoView';
  const NOTE = `[DUMMY] made-up figure from demo/${FILE}, not collected data.`;
  const TAG = `<span class="dummy-tag" data-tip="${NOTE} It only appears in Demo view.">[DUMMY]</span>`;
  const isOn = () => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } };
  let on = false, targets = {}, measures = {};

  const parseCsv = text => {
    const [head, ...lines] = text.trim().split(/\r?\n/).map(l => [...l.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map(m => (m[1] ?? m[2]).replace(/""/g, '"')));
    return lines.map(l => Object.fromEntries(head.map((h, i) => [h, l[i] ?? ''])));
  };
  const number = v => (v !== '' && Number.isFinite(Number(v)) ? Number(v) : v);

  // Group rows into { section: { item: { field: value } } }.
  function group(rows) {
    const out = {};
    for (const r of rows) if (r.data_tag === '[DUMMY]') ((out[r.section] ||= {})[r.item] ||= {})[r.field] = r.value;
    return out;
  }
  const has = v => v && Object.keys(v).length > 0;

  function kpiEntry(k, fields) {
    const waves = k.waves.map((_, i) => {
      const inputs = {};
      for (const [f, v] of Object.entries(fields)) {
        const [w, key] = f.split('.');
        if (Number(w) !== i) continue;
        const type = k.inputs.find(x => x[0] === key)?.[2] || 'text';
        inputs[key] = type === 'bool' ? v === 'true' : ['int', 'dec', 'sdec'].includes(type) ? Number(v) : v;
      }
      return { inputs, meta: { period_start: `${2025 + i}-01-01`, period_end: `${2025 + i}-12-31`, scope_id: '[DUMMY] demo', method_version: 'v1.0', source_ref: `[DUMMY] ${FILE}`, record_type: 'Hypothetical', source_verification: 'Estimated', source_checks_passed: true, method_permission: 'Pending', capture_status: 'Complete', publication_approved: false } };
    });
    return { waves, comparison_approved: true, dummy: true };
  }

  async function init() {
    // ?demoview=on or ?demoview=off sets the switch from the address, e.g. for a bookmarked demo.
    const asked = new URLSearchParams(location.search).get('demoview');
    if (asked === 'on' || asked === 'off') { try { localStorage.setItem(KEY, asked); } catch {} }
    if (!isOn()) return;
    let data;
    try {
      const res = await fetch('demo/' + FILE);
      if (!res.ok) throw new Error(res.status);
      data = group(parseCsv(await res.text()));
    } catch (e) {
      console.error('Demo view: could not load the dummy data set', e);
      return;
    }
    Store.startSandbox(); // nothing below, or anything done in Demo view, is saved
    on = true;
    document.documentElement.classList.add('demo-view');
    const fill = (c, make) => {
      const cur = { ...(Store.get(c) || {}) };
      for (const [id, fields] of Object.entries(data[c] || {})) if (!has(cur[id])) cur[id] = make(fields, id);
      Store.overlay(c, cur);
    };
    const numbers = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, number(v)]));
    fill('programs', f => ({ ...numbers(f), note: '[DUMMY] Demo view', dummy: true }));
    fill('wellbeing', f => ({ ...numbers(f), date: '', dummy: true }));
    fill('methods', f => ({ ...numbers(f), _dummy: true }));
    fill('kpis', (f, id) => { const k = window.KPIF.KPIS.find(x => x.id === id); return k ? kpiEntry(k, f) : undefined; });
    targets = Object.fromEntries(Object.entries(data.targets || {}).map(([id, f]) => [id, numbers(f)]));
    measures = Object.fromEntries(Object.entries(data.measures || {}).map(([name, f]) => [name, f.value]));
    const evidence = Object.values(data.evidence || {}).map((f, i) => ({ id: `dummy-${i + 1}`, created: 0, date: '', ...f, text: `[DUMMY] ${f.text}`, source: `[DUMMY] ${f.source}`, dummy: true }));
    Store.overlay('evidence', [...(Store.get('evidence') || []), ...evidence]);
  }

  function bindSwitch() {
    const box = document.getElementById('demoViewToggle');
    if (!box) return;
    box.checked = on;
    box.addEventListener('change', () => {
      try { localStorage.setItem(KEY, box.checked ? 'on' : 'off'); } catch {}
      location.reload();
    });
  }
  document.addEventListener('app-ready', bindSwitch);

  return { init, FILE, NOTE, TAG, get on() { return on; }, target: id => targets[id] || null, measure: name => measures[name] || null, tag: dummy => (dummy ? ' ' + TAG : '') };
})();
