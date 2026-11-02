// Impact tab: the NSW Rugby KPI Framework (27 KPIs from NSW_Rugby_KPI_Formula_Web_Handover.xlsx).
// Calculation rules live in js/kpi-framework.js; this file is the screen, storage, CSV export and AI context.
// Stored in Store 'kpis': { [kpiId]: { waves: [{ meta, inputs }, ...], comparison_approved } }.
(() => {
  const { $, $$, esc, toast } = window.App;
  const KF = window.KPIF, S = KF.STATUS;
  const DIMS = ['Economic', 'Social', 'Cultural'];
  let dimFilter = 'all';

  // ---------- data ----------
  const all = () => Store.get('kpis') || {};
  const entryOf = id => all()[id] || { waves: [], comparison_approved: false };
  const save = (id, entry) => Store.set('kpis', { ...all(), [id]: entry });

  // One-off move of results entered with the earlier 9-KPI economic calculator (Store 'econ') into this format.
  // Metadata did not exist then, so migrated waves show "Data Collection Required" until it is completed.
  function migrateEcon() {
    const old = Store.get('econ');
    if (!old || Object.keys(all()).length) return;
    const MAP = { 'P1-01': { used: 'U', bookable: 'H' }, 'P1-02': { contrib: 'C', returns: 'R' }, 'P1-03': { income: 'I', cost: 'E' }, 'P3-01': { cohort: 'B', retained: 'R' },
      'P3-02': { cost: 'C', qualified: 'N' }, 'P3-03': { hours: 'h' }, 'P4-01': { cost: 'C', people: 'N' }, 'P4-03': { support: 'P', reversals: 'R' } };
    const out = {};
    for (const [id, map] of Object.entries(MAP)) {
      const e = old[id];
      if (!e) continue;
      const waves = ['baseline', 'followup'].map(p => {
        const src = e[p] || {}, inputs = {};
        for (const [from, to] of Object.entries(map)) if (typeof src[from] === 'number') inputs[to] = src[from];
        if (id === 'P3-03' && typeof src.coverage === 'number') inputs.coverage = `${src.coverage}% log coverage`;
        return { meta: src.label ? { scope_id: src.label } : {}, inputs };
      });
      if (waves.some(w => Object.keys(w.inputs).length)) out[id] = { waves, comparison_approved: false };
    }
    if (Object.keys(out).length) Store.set('kpis', out);
  }

  function evaluateEntry(k) {
    const e = entryOf(k.id);
    const res = k.waves.map((_, i) => KF.evaluate(k, e.waves[i] || {}));
    const chg = k.waves.length === 2 ? KF.change(k, res[0], res[1], e) : null;
    return { e, res, chg, calculated: res.some(r => KF.isCalculated(r.status) || r.status === S.QUALITATIVE) };
  }

  // ---------- UI ----------
  const tip = s => `data-tip="${esc(s)}" tabindex="0"`;
  const statusCls = s => KF.isCalculated(s) || s === S.QUALITATIVE ? 'positive' : s === S.FAIL ? 'risk' : s === S.DCR ? '' : 'watch';
  const stateLabel = { active: 'Active', conditional: 'Research only — not activated', inactive: 'Inactive', qualitative: 'Qualitative only' };

  function waveCell(k, label, r, w = {}) {
    const m = w.meta || {};
    const metaLine = [m.period_start && `${m.period_start} to ${m.period_end || '?'}`, m.scope_id && `scope: ${m.scope_id}`, m.method_version && `method ${m.method_version}`, m.source_ref && `source: ${m.source_ref}`,
      m.source_verification, m.method_permission && `permission ${m.method_permission}`].filter(Boolean).join(' · ');
    const hover = `${k.id} ${label}: ${r.status}\n${r.workings || r.reason || ''}${(r.extra || []).map(([a, b]) => `\n${a}: ${b}`).join('')}${metaLine ? `\n\n${metaLine}` : ''}${KF.isCalculated(r.status) && !r.publishable ? '\n\nInternal only: not approved for publication.' : ''}`;
    return `<div ${tip(hover)}><span>${esc(label)}</span>${r.display ? `<b>${esc(r.display)}</b>` : ''}<span class="status ${statusCls(r.status)}">${esc(r.status)}</span>${KF.isCalculated(r.status) && !r.publishable ? '<small>internal only</small>' : ''}${!r.display && r.reason ? `<small>${esc(r.reason)}</small>` : ''}</div>`;
  }

  function field(prefix, [key, label, type, unit, req, help], value) {
    const name = `${prefix}.${key}`;
    const reqMark = req === 'req' ? '' : req === 'partial' ? ' (if partial)' : req?.startsWith('group:') ? '' : ' (optional)';
    let control;
    if (type === 'bool') control = `<input type="checkbox" data-name="${name}" data-type="bool" ${value === true ? 'checked' : ''}>`;
    else if (type.startsWith('enum:')) control = `<select data-name="${name}" data-type="text"><option value="">—</option>${type.slice(5).split('|').map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (type === 'date') control = `<input type="date" data-name="${name}" data-type="text" value="${esc(value ?? '')}">`;
    else if (type === 'text') control = `<input type="text" data-name="${name}" data-type="text" value="${esc(value ?? '')}">`;
    else control = `<span class="unit-in"><input type="number" step="${type === 'int' ? 1 : 'any'}" ${type === 'sdec' ? '' : 'min="0"'} data-name="${name}" data-type="num" value="${value ?? ''}"><i>${esc(unit || '')}</i></span>`;
    return `<label class="${type === 'bool' ? 'check' : ''}" ${tip(help || label)}>${type === 'bool' ? control + ' ' + esc(label) + reqMark : `${esc(label)}${reqMark}${control}`}</label>`;
  }

  // Short labels for the compact one-line view (the full status is on hover and in the open card).
  const SHORT = { [S.VERIFIED]: 'Verified', [S.ESTIMATED]: 'Estimated', [S.HYPOTHETICAL]: 'Hypothetical', [S.DCR]: 'Needs data', [S.NC]: 'Not calculable', [S.NA]: 'Not applicable', [S.FAIL]: 'Check inputs', [S.QUALITATIVE]: 'Recorded', [S.INACTIVE]: 'Inactive' };
  const openRows = new Set();

  // One line per KPI; click to open the full card.
  function row(k) {
    const ev = evaluateEntry(k);
    const pills = k.waves.map((l, i) => {
      const r = ev.res[i];
      return `<span class="status ${statusCls(r.status)}" title="${esc(`${l}: ${r.status}${r.reason ? ' — ' + r.reason : ''}`)}">${k.waves.length > 1 ? `${esc(l.replace('Cohort pair ', 'Pair '))}: ` : ''}${KF.isCalculated(r.status) && r.display ? esc(r.display) : SHORT[r.status] || esc(r.status)}</span>`;
    }).join('');
    return `<details class="kf-row" data-row="${k.id}" ${openRows.has(k.id) ? 'open' : ''}>
      <summary><span class="ek-id">${k.id}</span><span class="kf-name">${esc(k.name)}</span><span class="kf-pills">${pills}${ev.chg?.status === 'Calculated' ? `<span class="status positive" title="Change">${esc(ev.chg.text)}</span>` : ''}</span></summary>
      ${card(k)}
    </details>`;
  }

  function card(k) {
    const ev = evaluateEntry(k);
    const head = `<div class="ek-head"><span class="ek-id">${k.id}</span><span class="kf-chips">
        <span class="impact-chip method" ${tip(`Operational readiness ${k.readiness} (handover). ${k.tier}.`)}>${k.readiness}</span>
        <span class="impact-chip method" ${tip(`Formula origin: ${k.origin}. Evidence status: ${k.evidence}. Primary source: ${k.source}`)}>${esc(k.evidence)}</span>
        ${k.state !== 'active' ? `<span class="impact-chip method">${esc(stateLabel[k.state])}</span>` : ''}</span></div>
      <h3 ${tip(`${k.definition}\n\nPillar: ${k.pillar}`)}>${esc(k.name)}</h3>`;
    if (k.state === 'inactive') return `<article class="econ-kpi kf-card inactive" data-id="${k.id}">${head}
      <p class="small muted">${esc(k.definition)}</p><p class="ek-indicative small"><b>${S.INACTIVE}.</b> ${esc(k.limitations)}</p></article>`;
    const waveForms = k.waves.map((label, i) => {
      const w = ev.e.waves[i] || {};
      return `<fieldset><legend>${esc(label)}</legend>
        <div class="kf-meta">${KF.META.map(m => field(`${i}.meta`, [m[0], m[1], m[2], '', KF.META_REQUIRED.includes(m[0]) ? 'req' : 'opt', m[3]], (w.meta || {})[m[0]])).join('')}</div>
        <div class="kf-inputs">${k.inputs.map(f => field(`${i}.inputs`, f, (w.inputs || {})[f[0]])).join('')}</div></fieldset>`;
    }).join('');
    return `<article class="econ-kpi kf-card" data-id="${k.id}">${head}
      <code class="ek-formula" ${tip('Approved formula, exactly as in the evaluation team\'s handover. Tackle AI only applies it.')}>${esc(k.formula)}</code>
      <div class="ek-results kf-results">${k.waves.map((l, i) => waveCell(k, l, ev.res[i], ev.e.waves[i])).join('')}
        ${ev.chg ? `<div ${tip(`${ev.chg.workings || ev.chg.text}\n\nA change needs both waves calculated, the same scope and method version, and "comparison approved".`)}><span>Change</span>${ev.chg.status === 'Calculated' ? `<b>${esc(ev.chg.text)}</b>` : `<small class="muted">${esc(ev.chg.text)}</small>`}</div>` : ''}</div>
      ${k.state === 'conditional' ? `<p class="ek-indicative small"><b>Research only, not activated:</b> ${esc(k.limitations)}</p>` : ''}
      <details class="ek-more"><summary>Enter data</summary>
        <form class="ek-form kf-form">${waveForms}
          ${k.waves.length === 2 ? field('entry', ['comparison_approved', 'Comparison approved (compatible periods, populations and methods)', 'bool', '', 'opt', 'Required for a change. Not needed for a single-period level.'], ev.e.comparison_approved) : ''}
          <p class="muted small">No names, person IDs or raw responses: enter checked aggregate counts only. Blank means not available, never zero.</p>
          <div class="row end"><button type="button" class="btn kf-clear">Clear</button><button class="btn primary">Calculate</button></div>
        </form>
      </details>
      ${k.question ? `<details class="ek-more"><summary>Survey question (exact wording)</summary><p class="small">${esc(k.question)}</p></details>` : ''}
      <details class="ek-more"><summary>Source, baseline and limitations</summary>
        <p class="small"><b>Definition:</b> ${esc(k.definition)}</p>
        <p class="small"><b>Origin:</b> ${esc(k.origin)} · <b>Evidence:</b> ${esc(k.evidence)} · <b>Source:</b> ${esc(k.source)}</p>
        <p class="small"><b>Baseline:</b> ${esc(k.baseline[0])}. ${esc(k.baseline[1])}</p>
        <p class="small"><b>Limitations:</b> ${esc(k.limitations)}</p>
      </details>
    </article>`;
  }

  function readForm(form, k) {
    const entry = { waves: k.waves.map(() => ({ meta: {}, inputs: {} })), comparison_approved: false };
    $$('[data-name]', form).forEach(el => {
      const [a, b, key] = el.dataset.name.split('.');
      let val;
      if (el.dataset.type === 'bool') val = el.checked;
      else if (el.dataset.type === 'num') { if (el.value === '') return; val = Number(el.value); }
      else { if (el.value.trim() === '') return; val = el.value.trim(); }
      if (a === 'entry') entry[b] = val; else entry.waves[Number(a)][b][key] = val;
    });
    return entry;
  }

  function render() {
    const host = $('#kpiFramework');
    if (!host) return;
    const evals = KF.KPIS.map(k => [k, evaluateEntry(k)]);
    const count = (dim, f) => evals.filter(([k, e]) => (dim === 'all' || k.dim === dim) && f(k, e)).length;
    $('#kpiSummary').innerHTML = DIMS.map(d => `<span ${tip(`${d}: ${count(d, () => true)} KPIs in the handover. Active and research-only KPIs can be calculated; inactive KPIs keep their ID only.`)}><b>${d}</b> ${count(d, (k, e) => e.calculated)} of ${count(d, k => k.state !== 'inactive')} with results${count(d, k => k.state === 'inactive') ? ` · ${count(d, k => k.state === 'inactive')} inactive` : ''}</span>`).join(' · ');
    $$('#kpiDimFilter button').forEach(b => b.classList.toggle('on', b.dataset.f === dimFilter));
    host.innerHTML = DIMS.filter(d => dimFilter === 'all' || d === dimFilter).map(d => {
      const ks = KF.KPIS.filter(k => k.dim === d), live = ks.filter(k => k.state !== 'inactive'), off = ks.filter(k => k.state === 'inactive');
      return `<h3 class="ek-pillar">${d} KPIs (${ks.length})</h3><div class="kf-list">${live.map(row).join('')}
        ${off.length ? `<details class="kf-row kf-inactive-group"><summary><span class="ek-id">—</span><span class="kf-name">${off.length} inactive KPIs: ${off.map(k => k.id).join(', ')}</span><span class="kf-pills"><span class="status" title="The handover keeps these IDs only: no input, no zero, no result.">Inactive</span></span></summary><div class="ek-grid">${off.map(card).join('')}</div></details>` : ''}</div>`;
    }).join('');
    $$('.kf-row[data-row]', host).forEach(d => d.addEventListener('toggle', () => { if (d.open) openRows.add(d.dataset.row); else openRows.delete(d.dataset.row); }));
    $$('.kf-card form', host).forEach(form => {
      const k = KF.KPIS.find(x => x.id === form.closest('.kf-card').dataset.id);
      form.addEventListener('submit', e => {
        e.preventDefault();
        save(k.id, readForm(form, k));
        render();
        toast(`${k.id} recalculated.`);
        document.dispatchEvent(new CustomEvent('data-changed'));
      });
      $('.kf-clear', form).addEventListener('click', () => { save(k.id, { waves: [], comparison_approved: false }); render(); document.dispatchEvent(new CustomEvent('data-changed')); });
    });
  }

  // One line per KPI for the AI agents and the Story generator.
  function contextLines() {
    return ['NSW RUGBY KPI FRAMEWORK (27 KPIs from the evaluation team\'s handover; descriptive, not causal. Quote only results marked "publishable"; never give a value for KPIs that are INACTIVE, DATA COLLECTION REQUIRED or NOT CALCULABLE; hypothetical examples are not real results):',
      ...KF.KPIS.map(k => {
        if (k.state === 'inactive') return `- ${k.id} ${k.name} [${k.dim}]: INACTIVE, no calculation authorised`;
        const ev = evaluateEntry(k);
        const parts = k.waves.map((l, i) => { const r = ev.res[i]; return `${l} ${r.status}${r.display ? ' ' + r.display : ''}${KF.isCalculated(r.status) ? (r.publishable ? ' (publishable)' : ' (internal only)') : ''}`; });
        return `- ${k.id} ${k.name} [${k.dim}${k.state === 'conditional' ? ', research only' : ''}] = ${k.formula}: ${parts.join('; ')}${ev.chg?.status === 'Calculated' ? '; change ' + ev.chg.text : ''}`;
      })];
  }

  function exportCsv() {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['kpi_id', 'dimension', 'pillar', 'kpi', 'state', 'readiness', 'wave', 'status', 'result', 'workings_or_reason', 'publishable', ...KF.META.map(m => m[0]), 'inputs_json', 'change', 'formula', 'evidence_status', 'primary_source']];
    for (const k of KF.KPIS) {
      const ev = evaluateEntry(k);
      const waves = k.waves.length ? k.waves : ['—'];
      waves.forEach((l, i) => {
        const r = ev.res[i] || KF.evaluate(k, {}), w = ev.e.waves[i] || {};
        rows.push([k.id, k.dim, k.pillar, k.name, k.state, k.readiness, l, r.status, r.display, r.workings || r.reason, KF.isCalculated(r.status) ? (r.publishable ? 'yes' : 'no') : '',
          ...KF.META.map(m => (w.meta || {})[m[0]]), JSON.stringify(w.inputs || {}), i === 1 ? ev.chg?.text : '', k.formula, k.evidence, k.source]);
      });
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = 'tackle-kpi-framework-results.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Coverage per impact dimension, for the Impact lens cards.
  function coverage(dim) {
    const ks = KF.KPIS.filter(k => k.dim === dim && k.state !== 'inactive');
    const done = ks.filter(k => evaluateEntry(k).calculated).length;
    return { done, total: ks.length, inactive: KF.KPIS.filter(k => k.dim === dim && k.state === 'inactive').length };
  }

  document.addEventListener('app-ready', () => {
    migrateEcon();
    $$('#kpiDimFilter button').forEach(b => b.addEventListener('click', () => { dimFilter = b.dataset.f; render(); }));
    $('#kpiExport')?.addEventListener('click', exportCsv);
    render();
  });

  window.KPIs = { render, contextLines, coverage, evaluateEntry };
})();
