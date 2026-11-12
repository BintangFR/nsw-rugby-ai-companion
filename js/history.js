// Data history: a commit log of every change to the data the dashboard is built from (Data Studio > History).
// Store.set is wrapped for the watched collections, so uploads, target edits, program results, valuation inputs,
// KPI waves, wellbeing surveys and evidence are recorded wherever in the app they happen. Each commit lists what
// changed (+ added, - removed, ~ changed), which pages it affects, and how to undo it. Other modules can add their
// own commits with DataHistory.log() (e.g. Targets > Compare).
// Also tracks whether the AI insights are older than the latest data, and can refresh them after each change.
window.DataHistory = (() => {
  const MAX = 300;
  const AFFECTS = {
    datasets: ['Map', 'Impact', 'Story', 'AI briefing'],
    programs: ['Impact (people reached and value)', 'Story', 'AI briefing'],
    methods: ['Impact (dollar values)', 'Story', 'AI briefing'],
    kpis: ['Impact (KPIs)', 'Story', 'AI briefing'],
    wellbeing: ['Impact (people reached and happiness)', 'AI briefing'],
    evidence: ['Impact (evidence)', 'Story quotes', 'AI briefing'],
  };
  const LABEL = { datasets: 'Data upload', programs: 'Program results', methods: 'Calculator inputs', kpis: 'KPI data', wellbeing: 'Results by place', evidence: 'Impact evidence' };
  const REVERTIBLE = new Set(['programs', 'methods', 'kpis', 'wellbeing', 'evidence']);
  const all = () => Store.get('history') || [];
  const sha = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('').slice(0, 7);
  const same = (a, b) => JSON.stringify(a ?? null, (k, v) => (k === 'created' ? undefined : v)) === JSON.stringify(b ?? null, (k, v) => (k === 'created' ? undefined : v));
  const short = (s, n = 90) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  // ---------- describing a change ----------
  const progName = id => window.Programs?.programs().find(p => p.id === id)?.name || id;
  const calcName = id => window.Methods?.CALCS.find(c => c.id === id)?.name || id;
  const kfName = id => { const k = window.KPIF?.KPIS.find(x => x.id === id); return k ? `${id} ${k.name}` : id; };
  const placeName = key => key.startsWith('region:') ? key.slice(7) : window.Programs?.programs().find(p => 'facility:' + p.id === key)?.name || key;
  const valText = v => v == null ? 'none' : typeof v === 'object' ? Object.entries(v).filter(([k]) => k !== 'note').map(([k, x]) => `${k} ${x}`).join(', ') : String(v);
  function datasetSummary(d) {
    const bits = [];
    if (d.spend?.length) bits.push(`${d.spend.length} spend rows ($${Math.round(d.spend.reduce((s, x) => s + x.amount, 0)).toLocaleString('en-AU')})`);
    if (d.layers?.length) bits.push(`${d.layers.length} map layer${d.layers.length > 1 ? 's' : ''}`);
    if (d.measures?.length) bits.push(`yearly ${d.measures.map(m => window.Analytics.MEASURES[m.id]?.label.toLowerCase() || m.id).join(', ')}`);
    if (d.wellbeing?.length) bits.push(`life satisfaction for ${d.wellbeing.length} regions`);
    if (d.evidence) bits.push(`${d.evidence} evidence records`);
    return bits.join(', ') || 'no dashboard data';
  }

  // Returns { title, items: [{ op, text }], patch } or null when nothing really changed.
  function describe(c, before, after) {
    const items = [], patch = {};
    if (c === 'datasets' || c === 'evidence') {
      const b = new Map((before || []).map(x => [x.id, x])), a = new Map((after || []).map(x => [x.id, x]));
      const text = x => c === 'datasets' ? `${x.name}: ${datasetSummary(x)}` : `[${x.lens}, ${x.region || 'Statewide'}] ${short(x.text)}`;
      for (const [id, x] of a) if (!b.has(id)) { items.push({ op: '+', text: text(x) }); patch[id] = null; }
      for (const [id, x] of b) if (!a.has(id)) { items.push({ op: '-', text: text(x) }); patch[id] = x; }
      for (const [id, x] of a) if (b.has(id) && !same(b.get(id), x)) { items.push({ op: '~', text: (c === 'datasets' ? 'Re-imported ' : 'Edited ') + text(x) }); patch[id] = b.get(id); }
      if (!items.length) return null;
      const n = items.length, add = items.filter(i => i.op === '+').length;
      const title = c === 'datasets'
        ? (n === 1 ? `${items[0].op === '+' ? 'Added' : items[0].op === '-' ? 'Removed' : 'Updated'} ${(after.find(x => x.id === Object.keys(patch)[0]) || before.find(x => x.id === Object.keys(patch)[0]))?.name}` : `${n} data files changed`)
        : `${add ? `Added ${add}` : ''}${add && n - add ? ', ' : ''}${n - add ? `changed or removed ${n - add}` : ''} evidence record${n > 1 ? 's' : ''}`;
      return { title, items, patch };
    }
    const b = before || {}, a = after || {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (same(b[k], a[k])) continue;
      patch[k] = b[k] === undefined ? null : b[k];
      const name = { programs: progName, methods: calcName, kpis: kfName, wellbeing: placeName }[c]?.(k) || k;
      if (c === 'kpis') {
        items.push({ op: '~', text: `${name}: ${(a[k]?.waves || []).length} wave(s) of data${a[k]?.comparison_approved ? ', comparison approved' : ''}` });
      } else if (c === 'wellbeing') {
        items.push({ op: a[k] ? (b[k] ? '~' : '+') : '-', text: a[k] ? `${name}: ${[Number.isFinite(a[k].people) ? `${a[k].people} people reached` : '', Number.isFinite(a[k].mean) ? `${a[k].mean}/10 from ${a[k].n} respondents` : ''].filter(Boolean).join(', ')}` : `${name}: result removed` });
      } else {
        items.push({ op: a[k] === undefined ? '-' : b[k] === undefined ? '+' : '~', text: `${name}: ${short(valText(a[k]), 140)}${b[k] !== undefined && a[k] !== undefined ? ` (was ${short(valText(b[k]), 80)})` : ''}` });
      }
    }
    if (!items.length) return null;
    const title = items.length === 1 ? `${LABEL[c]}: ${items[0].text.split(':')[0]}` : `${LABEL[c]}: ${items.length} changes`;
    return { title, items, patch };
  }

  // ---------- committing ----------
  let paused = false, reverting = false;
  function commit(entry) {
    const list = all().slice(), last = list[0];
    // Typing in a form saves on every keystroke: fold quick edits of the same thing into one commit.
    if (!reverting && last && entry.collection && last.collection === entry.collection && last.title === entry.title && Date.now() - last.at < 90_000 && !last.reverted && !last.revertOf) {
      // Describe the folded commit from the state before its first edit to now.
      const patch = { ...entry.patch, ...last.patch }, now = Store.get(entry.collection);
      const items = describe(entry.collection, applyPatch(now, patch), now)?.items || entry.items;
      list[0] = { ...last, at: Date.now(), items, patch };
    } else list.unshift({ id: sha(), at: Date.now(), who: entry.who || 'You', ...entry });
    paused = true; Store.set('history', list.slice(0, MAX)); paused = false;
    document.dispatchEvent(new CustomEvent('history-changed'));
    scheduleAi();
  }
  function log({ kind, title, detail, affects, items }) {
    commit({ kind: kind || 'note', title, items: items || (detail ? [{ op: '~', text: detail }] : []), affects: affects || [] });
  }

  const orig = Store.set.bind(Store);
  Store.set = (c, v) => {
    if (paused || !AFFECTS[c]) return orig(c, v);
    const before = structuredClone(Store.get(c));
    orig(c, v);
    const d = describe(c, before, v);
    if (d) commit({ kind: c, collection: c, title: d.title, items: d.items, patch: d.patch, affects: AFFECTS[c], who: c === 'datasets' ? 'Data Studio' : 'You', revertible: REVERTIBLE.has(c) });
  };

  // Put the items named in a patch back to their earlier values (null = the item did not exist before).
  function applyPatch(cur, patch) {
    if (Array.isArray(cur)) {
      const next = cur.filter(x => !(x.id in patch) || patch[x.id]).map(x => patch[x.id] || x);
      for (const [pid, old] of Object.entries(patch)) if (old && !next.some(x => x.id === pid)) next.unshift(old);
      return next;
    }
    const next = { ...(cur || {}) };
    for (const [k, old] of Object.entries(patch)) { if (old == null) delete next[k]; else next[k] = old; }
    return next;
  }

  // Undo one commit's own changes (later changes to other items stay). Recorded as a new commit, like git revert.
  function revert(id) {
    const cm = all().find(x => x.id === id);
    if (!cm?.revertible || !cm.patch) return false;
    const c = cm.collection, next = applyPatch(Store.get(c), cm.patch);
    const top = all()[0]?.id;
    reverting = true;
    try { Store.set(c, next); } finally { reverting = false; }
    const list = all().map(x => x.id === id ? { ...x, reverted: true } : x);
    if (list[0] && list[0].id !== top) list[0] = { ...list[0], title: `Revert "${cm.title}"`, revertOf: id, revertible: false };
    paused = true; Store.set('history', list); paused = false;
    document.dispatchEvent(new CustomEvent('data-changed'));
    document.dispatchEvent(new CustomEvent('history-changed'));
    return true;
  }

  // ---------- keeping the AI in step with the data ----------
  const lastAi = () => { try { return Number(localStorage.getItem('tackle.lastAi')) || 0; } catch { return 0; } };
  const autoAi = () => { try { return localStorage.getItem('tackle.autoAi') === 'on'; } catch { return false; } };
  const setAutoAi = on => { try { localStorage.setItem('tackle.autoAi', on ? 'on' : 'off'); } catch {} };
  const pendingChanges = () => all().filter(x => x.at > lastAi() && x);
  function markAiRun() { try { localStorage.setItem('tackle.lastAi', String(Date.now())); } catch {} document.dispatchEvent(new CustomEvent('history-changed')); }
  let timer = null;
  // Auto mode: wait for 30 s of quiet (several uploads or edits become one refresh), then run the agents.
  function scheduleAi() {
    if (!autoAi() || Store.sandbox) return;
    clearTimeout(timer);
    timer = setTimeout(() => { if (pendingChanges().length && !window.Ollama?.busy) window.App.refreshAi?.({ quiet: true }); }, 30_000);
  }

  // For the AI briefing: what changed recently, so the agents can say what moved and why.
  function contextLines() {
    const recent = all().slice(0, 6);
    return recent.length ? ['RECENT DATA CHANGES (newest first): ' + recent.map(c => `${new Date(c.at).toLocaleDateString('en-AU')} ${c.title}${c.reverted ? ' (reverted)' : ''}`).join(' | ')] : [];
  }

  // ---------- Data Studio > History (GitHub-style commit list) ----------
  let filter = 'all', open = new Set();
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };
  const KIND_LABEL = { ...LABEL, note: 'Other' };
  function render() {
    const host = document.getElementById('historyView');
    if (!host) return;
    const { esc } = window.App;
    const list = all(), pend = pendingChanges();
    document.getElementById('historyCount').textContent = list.length ? list.length : '';
    const model = window.Ollama?.config.model, connected = model && document.getElementById('ollamaStatus')?.classList.contains('ok');
    document.getElementById('aiSync').innerHTML = `
      <div class="ai-sync-state ${pend.length ? 'behind' : 'ok'}">
        <b>${pend.length ? `${pend.length} data change${pend.length > 1 ? 's' : ''} since the AI insights were last refreshed` : 'AI insights are up to date with the data'}</b>
        <span>${lastAi() ? `Last refreshed ${ago(lastAi())}` : 'Not refreshed yet'} · ${connected ? `AI agent: ${esc(model)}` : 'AI not connected: the rule engine is used'}. Every figure on the site recalculates from the data straight away; the AI's written insights need a refresh.</span>
      </div>
      <div class="row"><label class="check" data-tip="After any data change, wait 30 seconds for more changes, then re-run the AI agents (or the rule engine if the AI is offline)."><input type="checkbox" id="autoAi" ${autoAi() ? 'checked' : ''}> Refresh automatically after changes</label>
      <button class="btn ${pend.length ? 'primary' : ''}" id="refreshAi">Refresh AI insights</button></div>`;
    document.getElementById('autoAi').onchange = e => { setAutoAi(e.target.checked); if (e.target.checked) scheduleAi(); };
    document.getElementById('refreshAi').onclick = () => window.App.refreshAi();

    const kinds = [...new Set(list.map(c => c.kind))];
    document.getElementById('histFilter').innerHTML = ['all', ...kinds].map(k => `<button data-k="${k}" class="${filter === k ? 'on' : ''}">${k === 'all' ? 'All' : esc(KIND_LABEL[k] || k)} <span class="count">${k === 'all' ? list.length : list.filter(c => c.kind === k).length}</span></button>`).join('');
    document.querySelectorAll('#histFilter button').forEach(b => b.onclick = () => { filter = b.dataset.k; render(); });

    const shown = list.filter(c => filter === 'all' || c.kind === filter);
    if (!shown.length) { host.innerHTML = '<div class="empty">No changes recorded yet. Upload a file or enter a result, and it will appear here.</div>'; return; }
    const days = {};
    for (const c of shown) (days[new Date(c.at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })] ||= []).push(c);
    host.innerHTML = Object.entries(days).map(([day, cs]) => `<div class="hist-day"><div class="hist-day-head">Changes on ${esc(day)}</div><ol class="hist-list">${cs.map(c => {
      const add = c.items.filter(i => i.op === '+').length, del = c.items.filter(i => i.op === '-').length, mod = c.items.filter(i => i.op === '~').length;
      const isOpen = open.has(c.id);
      return `<li class="hist-commit ${c.reverted ? 'reverted' : ''}">
        <div class="hist-main">
          <button class="hist-title" data-open="${c.id}" aria-expanded="${isOpen}">${esc(c.title)}</button>
          <div class="hist-meta"><span class="hist-who">${esc(c.who || 'You')}</span> changed ${esc(KIND_LABEL[c.kind] || c.kind)} · <span title="${esc(new Date(c.at).toLocaleString('en-AU'))}">${ago(c.at)}</span>${c.at > lastAi() ? ' · <span class="hist-pending" title="Not yet reflected in the AI\'s written insights">AI not refreshed</span>' : ''}${c.reverted ? ' · <span class="hist-rev">reverted</span>' : ''}</div>
        </div>
        <div class="hist-side">
          <span class="hist-stats">${add ? `<b class="plus">+${add}</b>` : ''}${del ? `<b class="minus">−${del}</b>` : ''}${mod ? `<b class="mod">~${mod}</b>` : ''}</span>
          <code class="hist-sha" title="Change id">${c.id}</code>
          ${c.revertible && !c.reverted ? `<button class="btn" data-revert="${c.id}" title="Undo just this change; later changes stay">Revert</button>` : ''}
        </div>
        ${isOpen ? `<div class="hist-diff">${c.items.map(i => `<div class="d ${i.op === '+' ? 'add' : i.op === '-' ? 'del' : 'mod'}"><span>${i.op === '-' ? '−' : esc(i.op)}</span>${esc(i.text)}</div>`).join('') || '<div class="d mod"><span>~</span>No detail recorded</div>'}
          ${c.affects?.length ? `<div class="hist-affects">Affects: ${c.affects.map(a => `<span class="chip">${esc(a)}</span>`).join(' ')}</div>` : ''}</div>` : ''}
      </li>`; }).join('')}</ol></div>`).join('');
    host.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { open.has(b.dataset.open) ? open.delete(b.dataset.open) : open.add(b.dataset.open); render(); });
    host.querySelectorAll('[data-revert]').forEach(b => b.onclick = () => {
      const c = all().find(x => x.id === b.dataset.revert);
      if (!c || !confirm(`Revert "${c.title}"?\n\nOnly this change is undone; later changes stay. The revert is recorded as a new change.`)) return;
      if (revert(c.id)) window.App.toast('Change reverted.');
    });
  }
  document.addEventListener('app-ready', render);
  document.addEventListener('history-changed', render);
  setInterval(() => { if (document.getElementById('tab-data')?.classList.contains('active')) render(); }, 60_000); // keep "x min ago" fresh

  return { all, log, revert, describe, pendingChanges, markAiRun, lastAi, autoAi, setAutoAi, contextLines, render, AFFECTS };
})();
