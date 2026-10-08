// Persistence. Uses the backend (/api/store) when it is running, otherwise the browser's localStorage.
// Reads are synchronous from an in-memory cache; writes are saved in the background.
window.Store = (() => {
  const DEFAULTS = { evidence: [], feedback: { ratings: {}, deletions: [] }, datasets: [], insights: [], story: null };
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

  function set(c, value) {
    cache[c] = value;
    clearTimeout(timers[c]);
    timers[c] = setTimeout(() => persist(c), 300);
  }

  async function persist(c) {
    if (mode === 'server') {
      try { await api('/api/store?c=' + encodeURIComponent(c), { method: 'PUT', body: JSON.stringify({ value: cache[c] }) }); }
      catch (e) { console.error('Save failed', c, e); window.App?.toast?.(`Could not save ${c} to the server.`); }
    } else {
      try { localStorage.setItem('tackle.' + c, JSON.stringify(cache[c])); } catch {}
    }
  }

  return { init, get, set, api, headers, get mode() { return mode; }, get health() { return health; } };
})();
