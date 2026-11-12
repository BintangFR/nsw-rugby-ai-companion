// Impact: Social / Economic / Cultural lenses and the field evidence log.
(() => {
  const { $, $$, esc, toast } = window.App;
  const A = window.Analytics, D = window.TACKLE_DATA;
  const LENSES = ['social', 'economic', 'cultural'];
  const STATUS = { measured: 'Measured', partial: 'Partial', none: 'No data yet' };
  let filter = 'all';

  const tip = s => `data-tip="${esc(s)}" tabindex="0"`;
  const F = D.frameworks;

  // Each lens shows how much of its established measurement framework has data. There is deliberately no dollar
  // figure per lens: no published method assigns program spend to social, economic or cultural impact.
  function renderLenses() {
    const cov = A.impactCoverage();
    const ev = A.evidenceStore.all();
    $('#lensGrid').innerHTML = LENSES.map(k => {
      const lens = D.impactMethods[k], c = cov[k];
      const mine = ev.filter(e => e.lens === k);
      const n = mine.length, fromData = mine.filter(e => e.dataset).length;
      const pctMeasured = Math.round((c.measured + 0.5 * c.partial) / c.total * 100);
      const covTip = `How "${c.measured} of ${c.total}" is worked out:\nEach block is one measure defined by an established framework (listed below the bar).\n${c.measured} measured (green) · ${c.partial} partial (amber, e.g. all NSW rugby rather than Legacy only) · ${c.none} no data yet (grey).\n\n`
        + c.measures.map(m => `• ${m.name}: ${STATUS[m.status]}`).join('\n');
      const evTip = `Records tagged ${lens.label} in the evidence log below: ${n - fromData} entered by staff, ${fromData} imported from uploaded files. Evidence supports the measures; it is not itself a measure.`;
      return `<article class="card lens ${k}">
        <h2>${lens.label} impact</h2>
        <div class="q">${esc(lens.question)}</div>
        <div class="big"><span ${tip(covTip)}>${c.measured} of ${c.total}</span></div>
        <div class="big-sub">established measures with data${c.partial ? ` · <span ${tip('Partial = measured for part of the program only (for example, all NSW rugby rather than Legacy-funded work only), or a baseline without a follow-up.')}>${c.partial} partial</span>` : ''} · <span ${tip(evTip)}>${n} evidence record${n === 1 ? '' : 's'}</span></div>
        <div class="coverage" aria-label="${pctMeasured}% covered">${c.measures.map(m => `<span class="${m.status}" ${tip(`${m.name}\n${STATUS[m.status]}: ${m.value}\n\nHow: ${m.how}\nFramework: ${F[m.framework].org}, ${F[m.framework].title}\nSource: ${m.source}`)}></span>`).join('')}</div>
        <div class="lens-frameworks small">Frameworks: ${lens.frameworks.map(id => `<span class="impact-chip method" ${tip(`${F[id].org}, ${F[id].title} (${F[id].year}).\n${F[id].use}`)}>${esc(F[id].org.split(' (')[0].split(' for ')[0])}</span>`).join(' ')}</div>
        <details class="lens-measures"><summary>Show the ${c.total} measures</summary>
          <ul class="indicators">${c.measures.map(m => `<li ${tip(`How: ${m.how}\nFramework: ${F[m.framework].org}\nSource: ${m.source}`)}><span>${esc(m.name)}</span><span class="status ${m.status}">${STATUS[m.status]}</span><span class="iv">${esc(m.value)} · <i>${esc(F[m.framework].org)}</i></span></li>`).join('')}</ul>
        </details>
        <div class="example">${esc(lens.example)}</div>
      </article>`;
    }).join('');
  }

  function renderEvidence() {
    const all = A.evidenceStore.all();
    const list = all.filter(e => filter === 'all' || e.lens === filter);
    $('#evCount').textContent = `${all.length} record${all.length === 1 ? '' : 's'} · ${LENSES.map(k => `${all.filter(e => e.lens === k).length} ${k}`).join(', ')}`;
    $('#evList').innerHTML = list.length ? list.map(e => `<li>
        <div class="top"><span class="impact-chip ${e.lens}">${D.impactMethods[e.lens].label}</span><span>${esc(e.region || 'Statewide')}</span><span>· ${esc(e.source)}</span>${e.date ? `<span>· ${new Date(e.date).toLocaleDateString('en-AU')}</span>` : ''}${e.dataset ? `<span>· from ${esc(e.dataset)}</span>` : ''}
          <button class="del" data-id="${esc(e.id)}">Delete</button></div>
        <div>${esc(e.text)}</div>${e.metric ? `<div class="metric">${esc(e.metric)}</div>` : ''}
      </li>`).join('')
      : `<li class="muted">No evidence recorded${filter === 'all' ? '' : ' for this lens'} yet. Record what people tell you, or upload a survey in Data Studio with a "lens" or "impact" column.</li>`;
    $$('#evList .del').forEach(b => b.addEventListener('click', async () => {
      const e = all.find(x => x.id === b.dataset.id);
      if (!e || !(await window.Feedback.confirmDelete('Impact evidence', e.text.slice(0, 80)))) return;
      A.evidenceStore.remove(e.id);
      refresh();
    }));
  }

  function setPlaceholder() {
    $('#evText').placeholder = 'e.g. ' + D.impactMethods[$('#evLens').value].example;
  }

  function exportCsv() {
    const rows = A.evidenceStore.all();
    if (!rows.length) { toast('No evidence to export.'); return; }
    const cols = ['lens', 'region', 'source', 'text', 'metric', 'date'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'tackle-impact-evidence.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function refresh() {
    renderLenses();
    renderEvidence();
    window.App.renderOverview();
  }

  document.addEventListener('app-ready', () => {
    $('#evRegion').innerHTML = ['Statewide', ...D.regions.map(r => r.name)].map(n => `<option>${esc(n)}</option>`).join('');
    $('#evDate').valueAsDate = new Date();
    setPlaceholder();
    $('#evLens').addEventListener('change', setPlaceholder);
    $('#evidenceForm').addEventListener('submit', e => {
      e.preventDefault();
      A.evidenceStore.add({
        lens: $('#evLens').value, region: $('#evRegion').value, source: $('#evSource').value,
        text: $('#evText').value.trim(), metric: $('#evMetric').value.trim(), date: $('#evDate').value,
      });
      $('#evText').value = ''; $('#evMetric').value = '';
      refresh();
      toast('Evidence recorded.');
    });
    $$('#evFilter button').forEach(b => b.addEventListener('click', () => {
      $$('#evFilter button').forEach(x => x.classList.toggle('on', x === b));
      filter = b.dataset.f;
      renderEvidence();
    }));
    $('#evExport').addEventListener('click', exportCsv);
    renderLenses();
    renderEvidence();
  });
  document.addEventListener('data-changed', () => { renderLenses(); renderEvidence(); });

  window.Impact = { refresh };
})();
