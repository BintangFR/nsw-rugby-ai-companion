// Impact tab: Social / Economic / Cultural lenses, the field evidence log and the Impact agent.
(() => {
  const { $, $$, esc, money, toast } = window.App;
  const A = window.Analytics, O = window.Ollama, D = window.TACKLE_DATA;
  const LENSES = ['social', 'economic', 'cultural'];
  const STATUS = { measured: 'Measured', partial: 'Partial', none: 'No data yet' };
  let filter = 'all';

  function renderLenses() {
    const { lenses, central } = A.impactTotals();
    const ev = A.evidenceStore.all();
    $('#lensGrid').innerHTML = LENSES.map(k => {
      const fw = D.impactFramework[k];
      const n = ev.filter(e => e.lens === k).length;
      const measured = fw.indicators.filter(i => i.status === 'measured').length;
      return `<article class="card lens ${k}">
        <h2>${fw.label} impact</h2>
        <div class="q">${esc(fw.question)}</div>
        <div class="big">${money(lenses[k])}</div>
        <div class="big-sub">known spend expected to drive it · ${Math.round(central[k] / (lenses[k] || 1) * 100)}% held centrally · ${n} evidence record${n === 1 ? '' : 's'}</div>
        <div class="small muted">Measurement coverage: ${measured} of ${fw.indicators.length} indicators measured</div>
        <div class="coverage" title="Green = measured, amber = partial, grey = no data yet">${fw.indicators.map(i => `<span class="${i.status}"></span>`).join('')}</div>
        <ul class="indicators detail-only">${fw.indicators.map(i => `<li><span>${esc(i.name)}</span><span class="status ${i.status}">${STATUS[i.status]}</span><span class="iv">${esc(i.value)} · <i>${esc(i.source)}</i></span></li>`).join('')}</ul>
        <div class="example">${esc(fw.example)}</div>
      </article>`;
    }).join('');
  }

  function renderImpactBubbles() {
    const list = window.App.insights.filter(i => i.pillar === 'Impact' || i.impact);
    $('#impactBubbles').innerHTML = list.length ? list.map(window.App.bubbleHtml).join('')
      : '<div class="empty">Press <b>Run Impact agent</b> to have the local model assess social, economic and cultural impact from the data and your evidence log.</div>';
  }

  function renderEvidence() {
    const all = A.evidenceStore.all();
    const list = all.filter(e => filter === 'all' || e.lens === filter);
    $('#evCount').textContent = `${all.length} record${all.length === 1 ? '' : 's'} · ${LENSES.map(k => `${all.filter(e => e.lens === k).length} ${k}`).join(', ')}`;
    $('#evList').innerHTML = list.length ? list.map(e => `<li>
        <div class="top"><span class="impact-chip ${e.lens}">${D.impactFramework[e.lens].label}</span><span>${esc(e.region || 'Statewide')}</span><span>· ${esc(e.source)}</span>${e.date ? `<span>· ${new Date(e.date).toLocaleDateString('en-AU')}</span>` : ''}${e.dataset ? `<span>· from ${esc(e.dataset)}</span>` : ''}
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
    $('#evText').placeholder = 'e.g. ' + D.impactFramework[$('#evLens').value].example;
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

  async function runImpactAgent() {
    if (!window.App.requireModel()) return;
    const btn = $('#runImpactAgent');
    btn.disabled = true; btn.textContent = 'Assessing impact…';
    try {
      const agent = O.AGENTS.find(a => a.id === 'IMP');
      const list = await O.runAgent(agent, { onProgress: pr => {
        btn.textContent = pr.phase === 'writing' ? `Writing… ${pr.tokens} tokens (insight ${Math.min(pr.insightsTotal, pr.insightsWritten + 1)} of ${pr.insightsTotal})` : `Reading the data… ${Math.round((Date.now() - pr.start) / 1000)}s`;
      } });
      window.App.addInsights(list, { replacePillar: 'Impact' });
      toast(`${list.length} impact insights added.`);
    } catch (e) {
      window.App.addInsights(A.ruleInsights().filter(i => i.pillar === 'Impact'), { replacePillar: 'Impact' });
      toast('AI failed - showing rule-based impact insights.');
    } finally {
      btn.disabled = false; btn.textContent = 'Run Impact agent';
    }
  }

  function refresh() {
    renderLenses();
    renderEvidence();
    renderImpactBubbles();
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
    $('#runImpactAgent').addEventListener('click', runImpactAgent);
    renderLenses();
    renderEvidence();
    renderImpactBubbles();
  });
  document.addEventListener('insights-changed', () => { if ($('#impactBubbles')) renderImpactBubbles(); });
  document.addEventListener('data-changed', () => { renderLenses(); renderEvidence(); });

  window.Impact = { refresh };
})();
