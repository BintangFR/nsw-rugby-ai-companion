// "Reset for next demo" (Data Studio): puts the app back to its starting state, with a backup and restore.
// Resets the chosen groups of collections to their empty defaults on the server (or browser storage), clears the
// screen choices this browser remembers, then reloads. The project files in Dataset/ load again by themselves.
// Kept: the AI connection settings, the access key and the AI speed estimates.
(() => {
  const { $, esc, toast } = window.App;
  const GROUPS = [
    { id: 'data', on: true, label: 'Data and changes', help: 'Uploaded files, results by place, calculator inputs, KPI data, impact evidence, public signals and the History log.',
      keys: ['datasets', 'programs', 'methods', 'kpis', 'wellbeing', 'evidence', 'signals', 'history'] },
    { id: 'ai', on: true, label: 'AI insights and staff ratings', help: 'Insights from the AI agents and rule engine, 👍 / 👎 ratings and what the AI learned from them, and data quality ratings.',
      keys: ['insights', 'feedback', 'quality'] },
    { id: 'story', on: true, label: 'Report edits and photos', help: 'Text edited on the Story pages, added photos and AI-written narrative.', keys: ['story'] },
    { id: 'screen', on: true, label: 'Screen choices on this computer', help: 'The open page, sub-pages, sidebar and colour theme go back to the defaults (Overview, light mode).', local: true },
  ];
  const LOCAL_KEYS = k => k === 'tackle.tab' || k.startsWith('tackle.view.') || ['tackle.theme', 'tackle.rail', 'tackle.lastAi', 'tackle.autoAi', 'tackle.demoView'].includes(k);
  const APP_ID = 'tackle-ai-backup';

  function backup() {
    const collections = Object.fromEntries(Object.keys(Store.defaults()).map(c => [c, Store.get(c)]));
    const data = { app: APP_ID, version: 1, at: new Date().toISOString(), storage: Store.mode, collections };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `tackle-ai-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded.');
  }

  // Write collections, wait until each is saved, then reload into a clean page.
  async function writeAndReload(values, clearLocal) {
    const order = Object.keys(values).sort((a, b) => (a === 'history') - (b === 'history')); // history last, so the reset itself is not logged
    for (const c of order) Store.set(c, values[c]);
    const failed = [];
    for (const c of order) if (!(await Store.flush(c).catch(() => false))) failed.push(c);
    if (clearLocal) { try { Object.keys(localStorage).filter(LOCAL_KEYS).forEach(k => localStorage.removeItem(k)); } catch {} }
    if (failed.length) { toast(`Could not save ${failed.join(', ')}. Restart the server (boot.cmd) and try again.`, 8000); return; }
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.delete('demoview');
    location.replace(url.toString());
  }

  function reset(groupIds) {
    const defaults = Store.defaults(), values = {};
    for (const g of GROUPS.filter(g => groupIds.includes(g.id) && g.keys)) for (const c of g.keys) if (c in defaults) values[c] = defaults[c];
    return writeAndReload(values, groupIds.includes('screen'));
  }

  async function restore(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { toast('That file is not a Tackle AI backup.'); return; }
    if (data?.app !== APP_ID || !data.collections) { toast('That file is not a Tackle AI backup.'); return; }
    const known = Object.keys(Store.defaults()), values = {};
    for (const c of known) if (c in data.collections) values[c] = data.collections[c] ?? Store.defaults()[c];
    if (!confirm(`Restore the backup from ${new Date(data.at).toLocaleString('en-AU')}?\n\nIt replaces the current data (${Object.keys(values).length} collections). Download a backup of the current data first if you might need it.`)) return;
    await writeAndReload(values, false);
  }

  let dlg = null;
  function open() {
    if (Store.sandbox) { toast('Switch Demo view off first: it does not save changes, so there is nothing to reset yet.'); return; }
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.className = 'fw-guide reset-dialog';
      dlg.setAttribute('aria-label', 'Reset for the next demo');
      document.body.append(dlg);
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    }
    dlg.innerHTML = `<div class="fwg-top"><span class="demo-badge">Reset</span><button class="demo-x" data-r="close" aria-label="Close">×</button></div>
      <h3>Reset for the next demo</h3>
      <p class="muted">Puts Tackle AI back to how it starts: the built-in program data and the project files in Dataset/ only. Choose what to clear:</p>
      <div class="reset-groups">${GROUPS.map(g => `<label class="check"><input type="checkbox" data-g="${g.id}" ${g.on ? 'checked' : ''}><span><b>${esc(g.label)}</b><small>${esc(g.help)}</small></span></label>`).join('')}</div>
      <p class="reset-warn"><b>This cannot be undone</b> except from a backup. The AI connection settings and access key are kept.</p>
      <div class="demo-nav reset-actions">
        <span class="row"><button class="btn" data-r="backup">Download backup</button><label class="btn" tabindex="0">Restore from backup<input type="file" accept=".json,application/json" data-r="restore" hidden></label></span>
        <button class="btn primary danger" data-r="reset">Reset now</button>
      </div>`;
    dlg.querySelector('[data-r="close"]').onclick = () => dlg.close();
    dlg.querySelector('[data-r="backup"]').onclick = backup;
    dlg.querySelector('[data-r="restore"]').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); };
    dlg.querySelector('[data-r="reset"]').onclick = async e => {
      const ids = [...dlg.querySelectorAll('[data-g]:checked')].map(i => i.dataset.g);
      if (!ids.length) { toast('Nothing selected.'); return; }
      const names = GROUPS.filter(g => ids.includes(g.id)).map(g => '• ' + g.label).join('\n');
      if (!confirm(`Reset these?\n\n${names}\n\nThis cannot be undone.`)) return;
      e.currentTarget.disabled = true; e.currentTarget.textContent = 'Resetting…';
      await reset(ids);
      e.currentTarget.disabled = false; e.currentTarget.textContent = 'Reset now';
    };
    dlg.showModal();
  }

  document.addEventListener('app-ready', () => { $('#resetBtn')?.addEventListener('click', open); });
  window.Reset = { open, reset, backup, restore, GROUPS };
})();
