// Data files the modules read (Rugby Analytics exports, NSW Rugby's club list, AusPlay tables). The tool must run with an
// empty Dataset/ folder, because partner data is not committed: a file is taken from Dataset/ if it is there, otherwise
// from files uploaded in Data Studio, which are kept in this browser (IndexedDB) so they survive a reload.
// Modules ask for a file by a name pattern, and listen for 'datafile-added' to reload when someone uploads one.
window.DataFiles = (() => {
  const DB = 'tackle-files', STORE = 'files';
  const open = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function tx(mode, fn) { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); }

  // Keep an uploaded file. Called by Data Studio for every upload.
  async function put(file) {
    try {
      const data = await file.arrayBuffer();
      await tx('readwrite', s => s.put({ name: file.name, type: file.type, data, at: Date.now() }, file.name));
    } catch (e) { console.warn('DataFiles: not kept', e); return; }
    document.dispatchEvent(new CustomEvent('datafile-added', { detail: { name: file.name } }));
  }
  async function remove(name) { try { await tx('readwrite', s => s.delete(name)); } catch {} }
  async function list() { try { return await tx('readonly', s => s.getAll()); } catch { return []; } }

  // The newest uploaded file whose name matches, else the Dataset/ file. Returns { name, buffer, from } or null.
  async function get(match, datasetName) {
    const re = match instanceof RegExp ? match : new RegExp('^' + match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    const up = (await list()).filter(f => re.test(f.name)).sort((a, b) => b.at - a.at)[0];
    if (up) return { name: up.name, buffer: up.data, from: 'Data Studio upload' };
    if (datasetName) {
      try { const r = await fetch('Dataset/' + encodeURIComponent(datasetName)); if (r.ok) return { name: datasetName, buffer: await r.arrayBuffer(), from: 'Dataset folder' }; } catch {}
    }
    return null;
  }
  const text = f => new TextDecoder().decode(f.buffer);

  return { put, get, list, remove, text };
})();
