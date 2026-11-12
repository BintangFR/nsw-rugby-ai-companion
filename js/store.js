// Persistence. Uses the backend (/api/store) when it is running, otherwise the browser's localStorage.
// Reads are synchronous from an in-memory cache; writes are saved in the background.
window.Store = (() => {
  const DEFAULTS = { evidence: [], feedback: { ratings: {}, deletions: [] }, datasets: [], insights: [], story: null, quality: {}, programs: {}, methods: {}, kpis: {}, wellbeing: {}, signals: {}, history: [] };
  const cache = {};
  const timers = {};
  let mode = 'local';
  let health = null;

  const appKey = () => { try { return localStorage.getItem('tackle.appKey') || ''; } catch { return ''; } };
  const headers = () => ({ 'Content-Type': 'application/json', ...(appKey() ? { 'x-app-key': appKey() } : {}) });

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
    if (res.status === 401) {
      const key = prompt('This Tackle AI workspace is password protected. Enter the access key:');
      if (key) { try { localStorage.setItem('tackle.appKey', key); } catch {} return api(path, opts); }
      throw new Error('Unauthorised');
    }
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return res;
  }

  async function init() {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 2500);
      const res = await fetch('/api/health', { signal: ctl.signal, headers: headers() });
      clearTimeout(t);
      if (!res.ok && res.status !== 401) throw new Error('no backend');
      if (res.status === 401) await api('/api/health');
      health = await (await api('/api/health')).json();
      const all = await (await api('/api/store')).json();
      for (const c of Object.keys(DEFAULTS)) cache[c] = all[c] ?? structuredClone(DEFAULTS[c]);
      mode = 'server';
    } catch {
      mode = 'local';
      for (const c of Object.keys(DEFAULTS)) {
        try { cache[c] = JSON.parse(localStorage.getItem('tackle.' + c)) ?? structuredClone(DEFAULTS[c]); }
        catch { cache[c] = structuredClone(DEFAULTS[c]); }
      }
    }
    return mode;
  }

  function get(c) { return cache[c]; }
  // Demo view: put values in memory only. Never saved and never logged in History.
  function overlay(c, value) { cache[c] = value; }

  function set(c, value) {
    cache[c] = value;
    if (sandbox) return;
    clearTimeout(timers[c]);
    timers[c] = setTimeout(() => persist(c), 300);
  }

  // Demo mode: changes stay in memory only and are thrown away on reload.
  let sandbox = false;
  function startSandbox() {
    for (const c of Object.keys(timers)) { clearTimeout(timers[c]); persist(c); } // flush real pending writes first
    sandbox = true;
  }

  // Resolves true when saved, false when the save failed (the user is told why).
  async function persist(c) {
    if (mode === 'server') {
      try { await api('/api/store?c=' + encodeURIComponent(c), { method: 'PUT', body: JSON.stringify({ value: cache[c] }) }); return true; }
      catch (e) {
        console.error('Save failed', c, e);
        // 400 = the running server does not know this collection yet: it was started before an update added it.
        window.App?.toast?.(/returned 400/.test(e.message)
          ? `Could not save ${c}: the server is older than this page. Close the Tackle AI window and run boot.cmd again.`
          : `Could not save ${c} to the server.`, 8000);
        return false;
      }
    }
    try { localStorage.setItem('tackle.' + c, JSON.stringify(cache[c])); return true; } catch { return false; }
  }

  // Save a pending write now (e.g. before a reload). Resolves true when saved.
  function flush(c) { clearTimeout(timers[c]); return persist(c); }

  // Every collection and its empty starting value (used by Reset and backups).
  const defaults = () => structuredClone(DEFAULTS);

  return { init, get, set, overlay, flush, defaults, api, headers, startSandbox, get sandbox() { return sandbox; }, get mode() { return mode; }, get health() { return health; } };
})();
