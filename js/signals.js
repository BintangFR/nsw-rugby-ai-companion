// Impact > Summary: what the public is saying. Searches public news and public social media for the towns Legacy funds
// (api/signals.js), links each story to the Legacy grant, club, town or region it names, tags what kind of effect it
// describes (such as local business on an event day), and groups it into economic, social and cultural.
// Deep search adds the team's own AI model (Ollama) in three steps: it plans extra searches from the funded projects,
// reviews every story (is it about Legacy-funded work? which impact? what does it show?) and writes a short summary per
// impact. Links to grants stay rule-based, so they can be checked; the model's figures are checked against the stories.
// Staff add what is relevant to the evidence log. A public story shows something happened near funded work; it does not
// prove the funding caused it.
(() => {
  const { $, $$, esc, toast } = window.App;
  const A = window.Analytics;
  const LENSES = [['economic', 'Economic'], ['social', 'Social'], ['cultural', 'Cultural']];
  const LENS_IDS = LENSES.map(l => l[0]);
  const SKIP = /daceyville/i; // NSW Rugby's head office address, not a funded place
  const ANNOUNCED = new Date('2026-05-06'); // Round 1 grants announced (published grant recipient lists)
  const state = () => Store.get('signals') || {};
  let running = false;

  // Towns with Legacy grants, largest grants first.
  function places() {
    const seen = new Set();
    return A.allGrants().filter(g => g.town && !SKIP.test(g.town)).sort((a, b) => b.amount - a.amount)
      .filter(g => !seen.has(g.town) && seen.add(g.town)).map(g => ({ place: g.town, region: g.region }));
  }

  // How a story connects to the Legacy Program, strongest first.
  const esc$ = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = s => String(s || '').toLowerCase().replace(/\b(rugby|union|club|football|inc|incorporated|rufc|ruc|jrc|jru|council|shire|the|and|of)\b/g, ' ').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  function relate(item) {
    const raw = `${item.title} ${item.snippet || ''}`, text = raw.toLowerCase();
    const grants = A.allGrants();
    const named = grants.find(g => { const w = words(g.recipient); return w.length && w.every(x => text.includes(x)); });
    // A town counts when it appears as a place ("in Yamba", "Yamba Rugby"), not as a surname; a region when its name appears capitalised.
    const asPlace = t => new RegExp(`\\b(in|at|from|near|around|across) ${esc$(t)}\\b|\\b${esc$(t)}('s|( [A-Z][a-z]+)? (rugby|club)| junior| juniors| shire| council| oval| park| sportsground| district| region| community)\\b`, 'i').test(raw);
    const inTown = item.place ? grants.filter(g => g.town === item.place) : grants.filter(g => g.town && !SKIP.test(g.town) && asPlace(g.town));
    const region = !inTown.length && (window.TACKLE_DATA.regions.map(r => r.name).find(n => n.length > 4 && new RegExp(`\\b${esc$(n)}\\b`).test(raw) && grants.some(g => g.region === n)));
    const link = named ? { level: 'club', label: 'Names a Legacy-funded club', grant: named }
      : inTown.length ? { level: 'town', label: 'In a Legacy-funded town', grant: inTown.sort((a, b) => b.amount - a.amount)[0] }
      : region ? { level: 'region', label: 'In a Legacy-funded region', grant: grants.filter(g => g.region === region).sort((a, b) => b.amount - a.amount)[0] }
      : { level: 'nsw', label: 'NSW rugby, no funded place named', grant: null };
    const themes = [];
    if (item.event && item.business) themes.push(['Event-day business or visitors', 'A rugby event and local business, visitors or spending in the same story: the effect a match-day check can measure.']);
    else if (item.business) themes.push(['Local business or visitors', 'Mentions local business, tourism, visitors or spending.']);
    if (item.event && !item.business) themes.push(['Rugby event', 'A match, carnival, tournament or event hub.']);
    if (item.tourism) themes.push(['Rugby tourism or merchandise', 'Mentions people travelling for rugby, tickets, accommodation, jerseys or merchandise. Measure it with the event visitor spending method (eventIMPACTS) or the NSW Rugby League participant and trading spend categories.']);
    if (item.legacy) themes.push(['Funding or upgrade reported', 'Mentions Legacy, a grant, funding or a facility upgrade.']);
    const d = item.date ? new Date(item.date) : null;
    return { ...link, themes, after: d && !isNaN(d) ? d >= ANNOUNCED : null };
  }
  // The impact type shown: the AI review's when there is one, otherwise the keyword one.
  const lensOf = item => (LENS_IDS.includes(item.ai?.lens) ? item.ai.lens : item.lens);

  // Placeholder summary written by code, used whenever the AI summary is missing (model off, failed, or never run).
  // Real data only: the stories actually found and the Legacy figures above. Demo view's [DUMMY] figures are never used.
  const listNames = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
  const GAP = {
    economic: 'A visitor survey at a funded carnival, council spending data or a club\'s sales figures would show the local economic effect.',
    social: 'Stories or results from funded clubs about participation and use of the new facilities would show the social effect.',
    cultural: 'Stories from First Nations and Pasifika programs, shared with community approval, would show the cultural effect.',
  };
  function legacyFigure(l) {
    if (window.DemoView?.on) return '';
    const row = (window.Methods?.lensValues?.(l) || []).find(([, v]) => !/^(Needs data|Not in dollars)$/.test(v) && !/DUMMY/.test(v));
    return row ? `${row[0]}: ${row[1]}${row[2] ? ` (${row[2]})` : ''}.` : '';
  }
  function ruleSummary(l, items) {
    const label = { economic: 'economic', social: 'social', cultural: 'cultural' }[l];
    const fig = legacyFigure(l);
    if (!items) return `${fig ? fig + ' ' : ''}No public search yet: run a search to see what news and social media say about ${label} impact in Legacy-funded places.`;
    const mine = items.filter(x => x.item.ai?.relevant !== false && lensOf(x.item) === l);
    const linked = mine.filter(x => x.rel.level !== 'nsw'), wide = mine.length - linked.length;
    const towns = [...new Set(linked.map(x => x.rel.grant?.town).filter(Boolean))];
    const count = re => linked.filter(x => x.rel.themes.some(([t]) => re.test(t))).length;
    const tour = count(/tourism/), eventBiz = count(/Event-day/), funding = count(/Funding/), social = linked.filter(x => x.item.channel === 'social').length;
    const parts = linked.length
      ? [`${linked.length} public ${linked.length === 1 ? 'story links' : 'stories link'} ${label} activity to Legacy-funded places: ${listNames(towns.slice(0, 5))}${towns.length > 5 ? ` and ${towns.length - 5} more` : ''}.`,
         [tour && `${tour} mention rugby tourism or merchandise`, eventBiz && `${eventBiz} describe event-day business or visitors`, funding && `${funding} report funding or an upgrade`, social && `${social} ${social === 1 ? 'is a social media post' : 'are social media posts'}`].filter(Boolean).join(', ').replace(/^./, c => c.toUpperCase())]
      : [`No public story yet links ${label} activity to a Legacy-funded place. ${GAP[l]}`];
    if (wide) parts.push(`${wide} more statewide ${label} ${wide === 1 ? 'story names' : 'stories name'} no funded place.`);
    return [fig, ...parts].filter(Boolean).map(s => s.endsWith('.') ? s : s + '.').join(' ');
  }

  async function search(extra = []) {
    const res = await Store.api('/api/signals', { method: 'POST', body: JSON.stringify({ places: places(), extra, refresh: extra.length > 0 }) });
    return res.json();
  }
  const failText = e => /returned 404/.test(e.message) ? 'The server is older than this page. Close the Tackle AI window and run boot.cmd again.' : /returned 502/.test(e.message) ? 'Nothing found this time. Try again later.' : `Could not search: ${e.message}`;
  const busy = on => { running = on; ['#sigRun', '#sigDeep'].forEach(id => { const b = $(id); if (b) b.disabled = on; }); };

  async function run() {
    if (running) return;
    if (Store.mode !== 'server') { toast('This needs the Tackle AI server: start it with boot.cmd.'); return; }
    busy(true);
    $('#sigStatus').textContent = 'Searching public news and social media for Legacy-funded towns… about 20 seconds.';
    try {
      const data = await search();
      Store.set('signals', { at: Date.now(), items: data.items, searches: data.searches, added: state().added || {} });
      render();
      toast(`${data.items.length} public stories and posts found.`);
    } catch (e) { $('#sigStatus').textContent = failText(e); } finally { busy(false); }
  }

  // ---------- deep search with the team's AI model ----------
  const O = () => window.Ollama;
  async function aiJson(prompt, label, numPredict = 1500) {
    const text = await O().chat([{ role: 'system', content: O().SYSTEM }, { role: 'user', content: prompt }], { json: true, temperature: 0.2, label, numPredict });
    return O().parseJson(text);
  }
  const grantLines = () => A.allGrants().filter(g => g.town && !SKIP.test(g.town)).sort((a, b) => b.amount - a.amount).slice(0, 30)
    .map(g => `- ${g.recipient || '?'} | ${g.project} | ${g.town} | ${g.region} | $${Math.round(g.amount).toLocaleString('en-AU')}`).join('\n');
  // Numbers the model writes must appear in the material it was given; otherwise the sentence is dropped.
  const nums = s => (String(s).match(/\d[\d,.]*/g) || []).map(n => n.replace(/[,.]+$/, '').replace(/,/g, ''));
  const checked = (sentence, source) => { const have = new Set(nums(source)); return nums(sentence).every(n => have.has(n)) ? sentence : ''; };

  async function plan() {
    const names = new Set(places().map(p => p.place));
    const j = await aiJson(`Task: plan extra public news and social media searches that could show the impact of NSW Rugby's $10M Rugby World Cup Legacy Program in the places it funds.

Legacy-funded projects (recipient | project | town | region | amount):
${grantLines()}

Write up to 15 short search queries, 3 to 8 words each. Each query must contain the word "rugby" and a funded town, club or project from the list. Cover all three impact types:
- economic: rugby tourism (people travelling to carnivals and matches, accommodation, tickets), jerseys and merchandise sold, local business, jobs, building the funded facility
- social: participation, girls and women, juniors, volunteers, use of the funded facility
- cultural: First Nations, Aboriginal, NAIDOC, Pasifika, multicultural, heritage
Do not search for rugby league or NRL.

Return JSON only: {"queries":[{"q":"...","lens":"economic|social|cultural","place":"<town from the list, or empty>"}]}`, 'Deep search: planning searches', 900);
    const seen = new Set();
    return (j?.queries || []).map(x => ({ q: String(x.q || '').trim().slice(0, 100), lens: LENS_IDS.includes(x.lens) ? x.lens : 'social', place: names.has(x.place) ? x.place : '' }))
      .filter(x => /rugby/i.test(x.q) && !/rugby league|\bnrl\b/i.test(x.q) && !seen.has(x.q.toLowerCase()) && seen.add(x.q.toLowerCase())).slice(0, 15);
  }

  async function review(items, onStep) {
    const BATCH = 12;
    for (let s = 0; s < items.length; s += BATCH) {
      const part = items.slice(s, s + BATCH);
      onStep(s, items.length);
      const j = await aiJson(`Task: review public stories and social media posts about rugby in NSW. For each one, decide whether it describes something that happened at, or because of, work the Legacy Program funds (a club, facility, program or town in the list), and what kind of impact it shows.

Legacy-funded projects (recipient | project | town | region | amount):
${grantLines()}

Stories:
${part.map((it, i) => { const rel = relate(it); return `[${i}] ${it.title}${it.snippet && it.snippet !== it.title ? ' — ' + it.snippet.slice(0, 220) : ''} (${it.source || 'unknown'}${it.date ? ', ' + new Date(it.date).toLocaleDateString('en-AU') : ''})${rel.grant ? ` [names a funded ${rel.level}: ${rel.grant.recipient || rel.grant.town}, ${rel.grant.project}]` : ''}`; }).join('\n')}

Rules: a story that names a funded club, facility or town from the list IS relevant, even when it does not say who paid for the work (most local news does not). Mark relevant false only for rugby league or NRL, professional or international matches, other programs, or places not in the list. Use only what each story says; never add figures; say "First Nations".
Return JSON only: {"reviews":[{"i":0,"relevant":true,"lens":"economic|social|cultural","impact":"one plain sentence: what this shows about the Legacy Program's impact, or why it is not relevant"}]}`, `Deep search: reviewing stories ${s + 1}–${s + part.length}`, 1600);
      for (const r of j?.reviews || []) {
        const it = part[Number(r.i)];
        if (!it || typeof r.relevant !== 'boolean') continue;
        it.ai = { relevant: r.relevant, lens: LENS_IDS.includes(r.lens) ? r.lens : null, note: checked(String(r.impact || '').slice(0, 240), `${it.title} ${it.snippet || ''}`) };
      }
    }
  }

  async function summarise(items) {
    const by = l => items.filter(x => x.item.ai?.relevant && lensOf(x.item) === l);
    const lines = LENSES.map(([l, label]) => `${label} stories:\n${by(l).slice(0, 12).map(x => `- ${x.item.title} (${x.item.source}${x.rel.grant ? `; linked to ${x.rel.grant.project}, ${x.rel.grant.town}` : ''})${x.item.ai.note ? ': ' + x.item.ai.note : ''}`).join('\n') || '- none'}`).join('\n\n');
    const j = await aiJson(`Task: summarise what public news and social media say about the impact of NSW Rugby's $10M Legacy Program, for a board member. Use only these reviewed stories.

${lines}

For each impact type write one or two plain sentences that name the places. If there are no stories for a type, say what evidence is missing. Do not claim the funding caused anything. Say "First Nations".
Return JSON only: {"economic":"...","social":"...","cultural":"..."}`, 'Deep search: summarising', 700);
    return Object.fromEntries(LENS_IDS.map(l => [l, checked(String(j?.[l] || '').slice(0, 500), lines)]));
  }

  async function deep() {
    if (running) return;
    if (Store.mode !== 'server') { toast('This needs the Tackle AI server: start it with boot.cmd.'); return; }
    // If the model cannot be reached, still run the standard search: the columns then show the summaries written by code.
    const st = await O().status().catch(() => ({ reachable: false }));
    if (!st.reachable) { toast('Your AI model is not reachable, so the standard search runs and the summaries are written from the data.'); return run(); }
    busy(true);
    const status = $('#sigStatus'), started = Date.now(), failed = [];
    // Each step falls back on its own: no plan → standard searches only; a failed review batch → keyword sorting for
    // those stories; no summary → the summary written by code from the same stories.
    try {
      status.textContent = 'Step 1 of 3: your AI model is planning searches from the funded projects… (the whole deep search takes about 5 to 12 minutes on a laptop; the page stays usable)';
      let queries = [];
      try { queries = await plan(); } catch { failed.push('planning'); }
      status.textContent = `Step 1 of 3: searching with ${queries.length} extra searches from your model, plus the standard ones…`;
      const data = await search(queries);
      // Review everything linked to a funded place, plus the 12 most recent statewide stories.
      const all = data.items.map(item => ({ item, rel: relate(item) }));
      const pick = [...all.filter(x => x.rel.level !== 'nsw'), ...all.filter(x => x.rel.level === 'nsw').slice(0, 12)].map(x => x.item);
      try { await review(pick, (n, total) => { status.textContent = `Step 2 of 3: your model is reviewing stories ${n + 1}–${Math.min(n + 12, total)} of ${total}…`; }); } catch { failed.push('reviewing'); }
      status.textContent = 'Step 3 of 3: your model is writing a summary for each impact…';
      let summary = {};
      try { summary = await summarise(all); } catch { failed.push('summarising'); }
      Store.set('signals', { at: Date.now(), items: data.items, searches: data.searches, added: state().added || {},
        deep: { at: Date.now(), model: O().config.model || 'server default', queries, summary, reviewed: pick.filter(i => i.ai).length, failed, ms: Date.now() - started } });
      render();
      toast(failed.length ? `Deep search finished, but your model failed at ${listNames(failed)}: those parts use the data-only version.` : 'Deep search finished.');
    } catch (e) {
      status.textContent = /Cancelled/.test(e.message) ? 'Deep search cancelled.' : /returned (404|502)/.test(e.message) ? failText(e) : `Deep search stopped: ${e.message}`;
    } finally { busy(false); }
  }

  function add(item, rel) {
    A.evidenceStore.add({ lens: lensOf(item), region: item.region || rel.grant?.region || 'Statewide', source: `Public: ${item.source || 'news'}`, text: item.title,
      metric: [rel.grant ? `Linked to ${rel.grant.project} (${rel.grant.recipient || rel.grant.town})` : '', item.ai?.note ? `AI review: ${item.ai.note}` : ''].filter(Boolean).join('. '),
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '', url: item.url });
    Store.set('signals', { ...state(), added: { ...(state().added || {}), [item.url]: true } });
    window.Impact?.refresh();
    render();
    toast('Added to the evidence log.');
  }

  const money = v => `$${Math.round(v).toLocaleString('en-AU')}`;
  const chip = (cls, label, tipText) => `<span class="${cls}" data-tip="${esc(tipText)}" tabindex="0">${esc(label)}</span>`;
  function card(item, rel, k) {
    const added = (state().added || {})[item.url];
    return `<li class="sig-card ${rel.level}${item.ai?.relevant === false ? ' off' : ''}">
      <a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>
      <small class="muted">${esc(item.source || '')}${item.date ? ` · ${new Date(item.date).toLocaleDateString('en-AU')}` : ''}${rel.after === true ? ' · after Round 1 was announced' : rel.after === false ? ' · before Round 1 was announced' : ''}</small>
      <div class="sig-chips">${chip(`sig-link ${rel.level}`, rel.label, rel.grant ? `${rel.label}: ${rel.grant.project}, ${rel.grant.recipient || ''} (${rel.grant.town}), ${money(rel.grant.amount)}.` : 'The story is about rugby in NSW but names no Legacy-funded club, town or region.')}${item.channel === 'social' ? chip('sig-theme social-media', 'Social media', 'A public post. Posts are personal views: check the post and the account before using it as evidence.') : ''}${item.ai ? '' : item.lensBy === 'search' ? chip('sig-theme', `Found by ${item.lens} search`, `The headline has no ${item.lens} keywords. It was found by a search for ${item.lens} stories, so it is shown here; check it before adding it as evidence.`) : ''}${item.ai && !item.ai.relevant ? '' : rel.themes.map(([l, t]) => chip('sig-theme', l, t)).join('')}${(item.subjects || []).map(([sub, l]) => chip('sig-theme sig-subject', sub, `Clearinghouse for Sport subject (Australian Sports Commission), part of the ${l} impact in this framework.`)).join('')}</div>
      ${rel.grant ? `<small>Linked to: <b>${esc(rel.grant.project)}</b> (${money(rel.grant.amount)})</small>` : ''}
      ${item.ai?.note ? `<p class="sig-ai"><b>AI review:</b> ${esc(item.ai.note)}</p>` : ''}
      ${added ? '<span class="status positive">Added to evidence</span>' : item.ai?.relevant === false ? '' : `<button class="btn" data-sig="${k}">Add to evidence</button>`}
    </li>`;
  }

  // The AI summary when there is one; otherwise the placeholder written by code, saying why.
  function summaryBox(l, sum, dp, items) {
    if (sum) return `<p class="sig-sum" data-tip="${esc(`Written by your AI model (${dp.model}) from the stories it reviewed. Any figure it used was checked against the stories. Check the stories before quoting it.`)}" tabindex="0"><b>AI summary:</b> ${esc(sum)}</p>`;
    const why = dp?.failed?.includes('summarising') ? 'Your AI model could not write a summary this time' : dp && !dp.summary?.[l] ? 'The AI summary for this impact came back empty, or was dropped because it used a figure the stories do not contain' : 'No AI summary yet (use "Deep search with AI")';
    return `<p class="sig-sum fallback" data-tip="${esc(`${why}, so this was written by code from real data only: the stories found and the Legacy figures above. Demo view's [DUMMY] figures are never used here.`)}" tabindex="0"><b>From the data:</b> ${esc(ruleSummary(l, items))}</p>`;
  }

  function render() {
    const host = $('#sigList');
    if (!host) return;
    if (!state().at) { // before any search: the three columns with the placeholder, so the section is never empty
      $('#sigStatus').textContent = 'Not searched yet. "Deep search with AI" uses your model to plan extra searches, review each story and summarise it; "Search public data" runs the standard searches only.';
      host.innerHTML = `<div class="sig-grid">${LENSES.map(([l, label]) => `<section class="lens-${l}"><h3>${label}</h3>${summaryBox(l, null, null, null)}</section>`).join('')}</div>`;
      return;
    }
    const s = state(), dp = s.deep && s.deep.at >= (s.at || 0) - 1000 ? s.deep : null;
    const items = (s.items || []).map((item, k) => ({ item, k, rel: relate(item) }));
    const off = items.filter(x => x.item.ai?.relevant === false), on = items.filter(x => x.item.ai?.relevant !== false);
    const linked = on.filter(x => x.rel.level !== 'nsw'), other = on.filter(x => x.rel.level === 'nsw');
    const eventBiz = linked.filter(x => x.item.event && x.item.business).length, posts = items.filter(x => x.item.channel === 'social').length;
    $('#sigStatus').textContent = s.at ? `Last searched ${new Date(s.at).toLocaleString('en-AU')}: ${items.length} stories and posts (${posts} from social media), ${linked.length} linked to a Legacy-funded club, town or region${eventBiz ? `, ${eventBiz} about event-day business or visitors` : ''}.${dp ? ` Deep search by ${dp.model}: ${dp.queries.length} extra searches, ${dp.reviewed} stories reviewed, ${off.length} judged not about Legacy-funded work.` : ''}` : 'Not searched yet. "Deep search with AI" uses your model to plan extra searches, review each story and summarise it; "Search public data" runs the standard searches only.';
    const order = x => ({ club: 0, town: 1, region: 2 }[x.rel.level] ?? 3) - (x.rel.themes.length * 0.1) - (x.item.ai?.relevant ? 0.5 : 0);
    // Each impact column: the AI summary (deep search), stories linked to a funded club, town or region, then statewide stories.
    host.innerHTML = s.at ? `<div class="sig-grid">${LENSES.map(([l, label]) => {
        const list = linked.filter(x => lensOf(x.item) === l).sort((a, b) => order(a) - order(b)), wide = other.filter(x => lensOf(x.item) === l).sort((a, b) => order(a) - order(b));
        const sum = dp?.summary?.[l];
        return `<section class="lens-${l}"><h3>${label} <span class="muted">${list.length} linked · ${wide.length} statewide</span></h3>
          ${summaryBox(l, sum, dp, items)}
          <ul>${list.map(x => card(x.item, x.rel, x.k)).join('') || '<li class="muted">Nothing linked to a funded place yet.</li>'}</ul>
          ${wide.length ? `<details class="ek-more"><summary>${wide.length} statewide ${label.toLowerCase()} stories (no funded place named)</summary><ul class="sig-other">${wide.map(x => card(x.item, x.rel, x.k)).join('')}</ul></details>` : ''}</section>`; }).join('')}</div>
      ${off.length ? `<details class="ek-more"><summary>${off.length} stories your AI model judged not about Legacy-funded work</summary><ul class="sig-other">${off.map(x => card(x.item, x.rel, x.k)).join('')}</ul></details>` : ''}
      ${dp?.queries.length ? `<details class="ek-more"><summary>The ${dp.queries.length} extra searches your model planned</summary><ul class="sig-other">${dp.queries.map(q => `<li>${esc(q.q)} <span class="muted">(${esc(q.lens)}${q.place ? ', ' + esc(q.place) : ''})</span></li>`).join('')}</ul></details>` : ''}` : '';
    $$('[data-sig]', host).forEach(b => b.onclick = () => { const x = items.find(i => i.k === Number(b.dataset.sig)); add(x.item, x.rel); });
  }

  // For the AI briefing: linked stories the model did not reject, with their link, theme and review, not yet checked by staff.
  function contextLines() {
    const s = state(), items = (s.items || []).filter(it => it.ai?.relevant !== false).map(item => ({ item, rel: relate(item) })).filter(x => x.rel.level !== 'nsw');
    if (!items.length) return [];
    const sum = s.deep?.summary ? ' AI SUMMARY: ' + LENSES.map(([l, label]) => s.deep.summary[l] ? `${label}: ${s.deep.summary[l]}` : '').filter(Boolean).join(' ') : '';
    return [`PUBLIC STORIES AND POSTS LINKED TO LEGACY-FUNDED PLACES (${items.length}, not checked by staff; a story is not proof the funding caused it): ` + items.slice(0, 12).map(({ item, rel }) => `[${lensOf(item)}; ${rel.label}${rel.grant ? ': ' + rel.grant.project : ''}${rel.themes.length ? '; ' + rel.themes.map(t => t[0]).join(', ') : ''}${item.channel === 'social' ? '; social media' : ''}] ${item.title} (${item.source})${item.ai?.note ? ' AI review: ' + item.ai.note : ''}`).join(' | ') + sum];
  }

  document.addEventListener('app-ready', () => { $('#sigRun')?.addEventListener('click', run); $('#sigDeep')?.addEventListener('click', deep); render(); });
  window.Signals = { run, deep, render, contextLines, places, relate, lensOf };
})();
