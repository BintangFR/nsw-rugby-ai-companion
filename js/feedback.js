// Data rating: thumbs up/down on flags and insights, a reason prompt before anything is deleted,
// and advice on how to collect more accurate data next time.
window.Feedback = (() => {
  const REASONS = [
    { id: 'outdated', label: 'Outdated', hint: 'Figures are from an old period or have since changed',
      advice: 'Refresh this data from its source at least every season, and record an "as at" date on every dataset so stale figures are easy to spot.' },
    { id: 'invalid', label: 'Invalid or incorrect', hint: 'Wrong numbers, typos, figures that do not add up',
      advice: 'Validate at entry (required fields, number formats, totals that reconcile with finance) and have a second person check grant and budget figures.' },
    { id: 'incomplete', label: 'Missing or incomplete', hint: 'Not enough responses or records to judge',
      advice: 'Collect more evidence: run end-of-season and facility-user surveys, interview clubs and councils, and make key fields mandatory in SmartyGrants and Rugby Xplorer.' },
    { id: 'equipment', label: 'Equipment not tracked', hint: 'Equipment spend or delivery is not recorded',
      advice: 'Keep an equipment register (item, club, cost, delivery date, condition) and require grant recipients to confirm delivery with a photo or receipt.' },
    { id: 'location', label: 'Wrong region or location', hint: 'Mapped to the wrong place',
      advice: 'Capture the LGA and postcode on every grant, program and survey record so it maps to a region automatically.' },
    { id: 'denominator', label: 'Wrong comparison basis', hint: 'Population or participation figures are not right for this region',
      advice: 'Replace the indicative population figures with ABS estimated resident population or, better, registered rugby participants by region from Rugby Xplorer.' },
    { id: 'context', label: 'Missing local context', hint: 'The number is right but the conclusion is not',
      advice: 'Pair the numbers with local context before judging: participation trends, facility audit results and short interviews with the zone or club.' },
    { id: 'duplicate', label: 'Duplicate', hint: 'Counted twice',
      advice: 'Give every record a unique ID (e.g. grant ID) and de-duplicate on import.' },
    { id: 'other', label: 'Other', hint: 'Explain in the note',
      advice: 'Document the issue with the data owner and agree a fix before the next reporting period.' },
  ];
  const reasonById = id => REASONS.find(r => r.id === id) || REASONS[REASONS.length - 1];

  const state = () => Store.get('feedback') || { ratings: {}, deletions: [] };
  const save = s => { Store.set('feedback', s); document.dispatchEvent(new CustomEvent('feedback-changed')); };

  function ratingFor(key) { return state().ratings[key] || null; }

  function ratingHtml(key, label, kind) {
    const r = ratingFor(key);
    const attrs = `data-key="${App.esc(key)}" data-label="${App.esc(label)}" data-kind="${App.esc(kind)}"`;
    return `<span class="rate" ${attrs}>
      <button type="button" class="up ${r?.vote === 'up' ? 'on' : ''}" title="Looks accurate" aria-label="Looks accurate" aria-pressed="${r?.vote === 'up'}">👍</button>
      <button type="button" class="down ${r?.vote === 'down' ? 'on' : ''}" title="Not accurate" aria-label="Not accurate" aria-pressed="${r?.vote === 'down'}">👎</button>
    </span>`;
  }

  function badgeHtml(key) {
    const r = ratingFor(key);
    if (!r) return '';
    return r.vote === 'up'
      ? '<span class="status positive">Verified</span>'
      : `<span class="status risk" title="${App.esc(r.note || '')}">Disputed: ${App.esc(reasonById(r.reason).label.toLowerCase())}</span>`;
  }

  // Modal that asks why something is inaccurate. Resolves { reason, note } or null if cancelled.
  function askReason({ title, subject, confirm = 'Confirm' }) {
    const dlg = document.getElementById('reasonDialog');
    document.getElementById('reasonTitle').textContent = title;
    document.getElementById('reasonSubject').textContent = subject || '';
    document.getElementById('reasonOk').textContent = confirm;
    document.getElementById('reasonNote').value = '';
    document.getElementById('reasonOptions').innerHTML = REASONS.map((r, i) =>
      `<label class="reason"><input type="radio" name="reason" value="${r.id}" ${i === 0 ? 'checked' : ''}><span><b>${r.label}</b><small>${r.hint}</small></span></label>`).join('');
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(resolve => {
      dlg.addEventListener('close', () => {
        if (dlg.returnValue !== 'ok') return resolve(null);
        resolve({ reason: dlg.querySelector('input[name="reason"]:checked')?.value || 'other', note: document.getElementById('reasonNote').value.trim() });
      }, { once: true });
    });
  }

  // Snapshot of the rated insight, so the AI can learn from it even after the insight is replaced.
  function snapshot(key) {
    if (!key.startsWith('insight:')) return undefined;
    const i = App.insights.find(x => 'insight:' + x.id === key);
    return i ? { title: i.title, insight: i.insight, evidence: i.evidence, action: i.action, pillar: i.pillar, region: i.region, agent: i.agent, severity: i.severity, impact: i.impact } : undefined;
  }

  async function vote(key, label, kind, dir) {
    const s = state();
    const current = s.ratings[key];
    if (current?.vote === dir) { delete s.ratings[key]; save(s); return; } // toggle off
    if (dir === 'up') {
      s.ratings[key] = { vote: 'up', label, kind, ts: Date.now(), example: snapshot(key) };
      save(s);
      App.toast('Thanks - the AI will use this as a good example.');
      return;
    }
    const answer = await askReason({ title: 'Why is this not accurate?', subject: label, confirm: 'Flag as inaccurate' });
    if (!answer) return;
    s.ratings[key] = { vote: 'down', label, kind, ts: Date.now(), example: snapshot(key), ...answer };
    save(s);
    advise({ label, kind, ...answer, action: 'disputed' });
  }

  // "Auto-training": ratings become lessons that are added to every AI prompt (in-context learning).
  // Liked insights are style/accuracy examples; disliked ones (with the reason) become things to avoid.
  function lessons() {
    const s = state();
    const all = Object.values(s.ratings || {}).sort((a, b) => b.ts - a.ts);
    const liked = all.filter(r => r.vote === 'up' && r.example).slice(0, 3);
    const verifiedFlags = all.filter(r => r.vote === 'up' && r.kind === 'Flag').slice(0, 6);
    const disliked = all.filter(r => r.vote === 'down').slice(0, 10);
    const deleted = (s.deletions || []).slice(0, 5);
    const failedChecks = (App.insights || []).filter(i => i.check).slice(-5);
    if (!liked.length && !verifiedFlags.length && !disliked.length && !deleted.length && !failedChecks.length) return '';
    const out = ['LEARNED FROM STAFF FEEDBACK (follow these):'];
    if (liked.length) {
      out.push('Insights staff rated as good - match their specificity, tone and use of figures:');
      for (const r of liked) out.push(`- [${r.example.pillar}] "${r.example.title}": ${r.example.insight}${r.example.action ? ' Action: ' + r.example.action : ''}`);
    }
    if (verifiedFlags.length) out.push('Flags staff confirmed as accurate: ' + verifiedFlags.map(r => r.label).join('; ') + '.');
    if (disliked.length) {
      out.push('Staff rejected these - do not repeat the claim or the mistake:');
      for (const r of disliked) out.push(`- "${r.label}" - ${reasonById(r.reason).label.toLowerCase()}${r.note ? ': ' + r.note : ''}${r.example?.insight ? ` (it said: ${r.example.insight.slice(0, 160)})` : ''}`);
    }
    if (failedChecks.length) out.push('The automatic data check caught these earlier mistakes - check each region\'s FLAGS line before writing: ' + failedChecks.map(i => i.check).join('; ') + '.');
    if (deleted.length) out.push('Deleted as inaccurate: ' + deleted.map(d => `${d.kind} "${d.label.slice(0, 60)}" (${reasonById(d.reason).label.toLowerCase()})`).join('; ') + '.');
    return out.join('\n');
  }

  // Ratings as a JSONL dataset (chat format with a rating) for real fine-tuning later
  // (e.g. preference tuning / filtering for SFT of a model on a GPU machine or a cloud service).
  function exportTrainingData() {
    const rows = Object.values(state().ratings || {}).filter(r => r.example).map(r => JSON.stringify({
      messages: [
        { role: 'system', content: Ollama.SYSTEM },
        { role: 'user', content: `Write one ${r.example.pillar} insight for the NSW RWC Legacy Program${r.example.region ? ' about ' + r.example.region : ''}.` },
        { role: 'assistant', content: JSON.stringify({ title: r.example.title, insight: r.example.insight, evidence: r.example.evidence, action: r.example.action }) },
      ],
      rating: r.vote === 'up' ? 1 : -1,
      reason: r.vote === 'down' ? reasonById(r.reason).label : undefined,
      note: r.note || undefined,
      agent: r.example.agent, rated_at: new Date(r.ts).toISOString(),
    }));
    if (!rows.length) { App.toast('No rated insights yet - use 👍 / 👎 on insight bubbles first.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n') + '\n'], { type: 'application/jsonl' }));
    a.download = 'tackle-ai-feedback.jsonl';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Record why something is being deleted. Returns false if the user cancels (so nothing is deleted).
  async function confirmDelete(kind, label) {
    const answer = await askReason({ title: 'Before you delete: why is this data not accurate?', subject: `${kind}: ${label}`, confirm: 'Delete' });
    if (!answer) return false;
    const s = state();
    s.deletions = [{ kind, label, ts: Date.now(), ...answer }, ...(s.deletions || [])].slice(0, 200);
    save(s);
    advise({ label, kind, ...answer, action: 'deleted' });
    return true;
  }

  // Adds a rule-based "how to get accurate data next time" insight, then an AI one if Ollama is connected.
  async function advise({ label, kind, reason, note, action }) {
    const r = reasonById(reason);
    App.addInsights([{
      pillar: 'Data quality', severity: 'watch', agent: 'Data quality guide',
      title: `${action === 'deleted' ? 'Deleted' : 'Disputed'} as ${r.label.toLowerCase()}: ${label.slice(0, 60)}`,
      insight: `${kind} "${label}" was ${action} because it is ${r.label.toLowerCase()}.${note ? ' Note: ' + note : ''}`,
      evidence: '', action: r.advice,
    }]);
    if (!Ollama.config.model || !document.getElementById('ollamaStatus').classList.contains('ok')) return;
    try {
      const text = await Ollama.chat([{ role: 'system', content: Ollama.SYSTEM }, { role: 'user', content:
        `A program manager marked this ${kind} as inaccurate and ${action} it.
Item: ${label}
Reason: ${r.label} (${r.hint})
Their note: ${note || 'none'}
Program data notes: population figures are indicative; spend is known allocations; equipment grants have no published register; social, economic and cultural impact are mostly unmeasured.
Suggest how to collect accurate data next time (for example more surveys, better equipment tracking, refreshing outdated data, better location capture).
Return JSON: {"title":"max 10 words","insight":"2 sentences on what went wrong","action":"2-3 concrete steps"}` }], { json: true, label: 'Data quality advice' });
      const j = Ollama.parseJson(text);
      if (j?.title) App.addInsights([{ pillar: 'Data quality', severity: 'watch', agent: 'Data quality agent', title: String(j.title), insight: String(j.insight || ''), action: String(j.action || ''), evidence: `${r.label}: ${label.slice(0, 80)}` }]);
    } catch (e) { console.warn('AI data-quality advice failed', e); }
  }

  // Short summary for the AI agents so they respect what users have verified or disputed.
  function summary() {
    const s = state();
    const ratings = Object.values(s.ratings || {});
    return {
      verifiedByUsers: ratings.filter(r => r.vote === 'up').map(r => r.label).slice(0, 20),
      disputedByUsers: ratings.filter(r => r.vote === 'down').map(r => ({ item: r.label, reason: reasonById(r.reason).label, note: r.note || undefined })).slice(0, 20),
      deletedAsInaccurate: (s.deletions || []).slice(0, 15).map(d => ({ item: `${d.kind}: ${d.label}`, reason: reasonById(d.reason).label })),
    };
  }

  function renderPanel(el) {
    const s = state();
    const ratings = Object.entries(s.ratings || {});
    const up = ratings.filter(([, r]) => r.vote === 'up');
    const down = ratings.filter(([, r]) => r.vote === 'down');
    const dels = s.deletions || [];
    const counts = {};
    for (const x of [...down.map(([, r]) => r), ...dels]) counts[x.reason] = (counts[x.reason] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const when = ts => new Date(ts).toLocaleDateString('en-AU');
    const learned = lessons();
    const examples = ratings.filter(([, r]) => r.example).length;
    el.innerHTML = `
      <div class="card-head"><div><h2>Data quality &amp; AI learning</h2><p class="muted">Ratings and deletion reasons from your team, how to get more accurate data next time, and what the AI has learned.</p></div>
        <div class="controls"><button class="btn" id="exportTraining" title="Rated insights as JSONL for fine-tuning a model later">Export training data</button></div></div>
      <details class="learning" ${learned ? '' : 'open'}>
        <summary><b>What the AI has learned</b> <span class="muted small">· ${up.length} 👍 · ${down.length} 👎 · ${examples} rated insights stored as examples</span></summary>
        ${learned ? `<pre class="lessons">${App.esc(learned)}</pre><p class="muted small">This is added to every agent, question and story prompt, so new insights follow what your team liked and avoid what it rejected. The model's weights don't change; to fine-tune a model, use <b>Export training data</b>.</p>`
          : '<p class="muted small">Nothing yet. Rate insights and flags with 👍 / 👎 and the AI will start following your feedback on its next run.</p>'}
      </details>
      <div class="dq-stats">
        <div><b>${up.length}</b><span>verified</span></div>
        <div><b>${down.length}</b><span>disputed</span></div>
        <div><b>${dels.length}</b><span>deleted as inaccurate</span></div>
      </div>
      ${top.length ? `<h3>How to get accurate data next time</h3><ul class="dq-advice">${top.map(([id, n]) => `<li><span class="status watch">${reasonById(id).label} · ${n}</span> ${App.esc(reasonById(id).advice)}</li>`).join('')}</ul>` : '<p class="muted small">No disputes yet. Use 👍 / 👎 on flags and insights to rate them.</p>'}
      ${down.length ? `<h3>Disputed</h3><ul class="dq-log">${down.map(([key, r]) => `<li><b>${App.esc(r.label)}</b> <span class="muted">· ${App.esc(reasonById(r.reason).label)}${r.note ? ' · ' + App.esc(r.note) : ''} · ${when(r.ts)}</span> <button class="link" data-clear="${App.esc(key)}">Clear</button></li>`).join('')}</ul>` : ''}
      ${dels.length ? `<h3>Deletion log</h3><ul class="dq-log">${dels.slice(0, 30).map(d => `<li><b>${App.esc(d.kind)}:</b> ${App.esc(d.label)} <span class="muted">· ${App.esc(reasonById(d.reason).label)}${d.note ? ' · ' + App.esc(d.note) : ''} · ${when(d.ts)}</span></li>`).join('')}</ul>` : ''}`;
    el.querySelector('#exportTraining').addEventListener('click', exportTrainingData);
    el.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
      const st = state(); delete st.ratings[b.dataset.clear]; save(st);
    }));
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.rate button');
    if (!btn) return;
    const box = btn.closest('.rate');
    vote(box.dataset.key, box.dataset.label, box.dataset.kind, btn.classList.contains('up') ? 'up' : 'down');
  });

  return { REASONS, ratingHtml, badgeHtml, ratingFor, askReason, confirmDelete, summary, lessons, exportTrainingData, renderPanel };
})();
