// AI client plus the insight agents. Goes through the backend (/api/chat) when server.js or Vercel is
// running, otherwise talks to Ollama directly (http://localhost:11434). Both speak Ollama's format.
window.Ollama = (() => {
  const viaServer = () => window.Store?.mode === 'server';
  const endpoint = path => viaServer() ? (path === '/api/tags' ? '/api/models' : path) : config.baseUrl + path;
  const headers = () => viaServer() ? Store.headers() : { 'Content-Type': 'application/json' };
  const KEY = 'tackle.ollama';
  const defaults = { baseUrl: 'http://localhost:11434', model: '' };
  let config = load();

  function load() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { ...defaults }; }
  }
  function save(next) {
    config = { ...config, ...next };
    try { localStorage.setItem(KEY, JSON.stringify(config)); } catch {}
  }

  async function listModels() {
    const res = await fetch(endpoint('/api/tags'), { headers: headers() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `AI server returned ${res.status}`);
    if (viaServer() && data.default && !data.modelOverride) save({ model: data.default });
    return (data.models || []).map(m => m.name);
  }

  // ---------- speed stats (used for ETAs) ----------
  // Exponential moving averages of how long this machine takes to read a prompt (per 1k chars)
  // and how fast it writes. Stored per browser; reasonable CPU defaults until the first run.
  const STATS_KEY = 'tackle.aiStats';
  let stats = (() => { try { return { readMsPerKChar: 9000, tokPerSec: 6, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') }; } catch { return { readMsPerKChar: 9000, tokPerSec: 6 }; } })();
  function learnStats(promptChars, readMs, tokens, writeMs, cachedHint) {
    const a = 0.35;
    // Calls that re-use the prompt cache are much faster to read; don't let them skew the estimate down.
    if (promptChars > 500 && readMs > 0 && !cachedHint) stats.readMsPerKChar = stats.readMsPerKChar * (1 - a) + (readMs / (promptChars / 1000)) * a;
    if (tokens > 20 && writeMs > 0) stats.tokPerSec = stats.tokPerSec * (1 - a) + (tokens / (writeMs / 1000)) * a;
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
  }
  const estimateReadMs = chars => Math.max(4000, stats.readMsPerKChar * chars / 1000);
  const estimateWriteMs = tokens => Math.max(3000, tokens / Math.max(0.5, stats.tokPerSec) * 1000);

  // ---------- activity (top-bar indicator + agent progress) ----------
  // Every AI call reports phases: 'reading' (model is processing the prompt), 'writing' (tokens arriving), 'done'.
  let activeCalls = 0;
  function emit(detail) { document.dispatchEvent(new CustomEvent('ai-activity', { detail: { ...detail, active: activeCalls } })); }

  // Core call: always streams so progress is visible, even when the caller only wants the final text.
  async function call(messages, { json = false, temperature = 0.3, numPredict, signal, label = 'AI', onProgress } = {}) {
    if (!config.model && !viaServer()) throw new Error('No Ollama model selected'); // the backend falls back to its configured model
    const promptChars = messages.reduce((n, m) => n + m.content.length, 0);
    const p = { label, phase: 'reading', start: Date.now(), firstTokenAt: null, lastTokenAt: null, tokens: 0, text: '', promptChars, estReadMs: estimateReadMs(promptChars) };
    const report = () => { onProgress?.({ ...p }); emit({ ...p }); };
    activeCalls++;
    report();
    try {
      const res = await fetch(endpoint('/api/chat'), {
        method: 'POST',
        headers: headers(),
        signal,
        // think:false stops reasoning models (qwen3, deepseek-r1) spending minutes on hidden thinking
        body: JSON.stringify({ model: config.model, messages, stream: true, think: false, keep_alive: '30m', ...(json ? { format: 'json' } : {}), options: { temperature, num_ctx: 8192, ...(numPredict ? { num_predict: numPredict } : {}) } }),
      });
      if (!res.ok || !res.body) throw new Error(`AI server returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.error) throw new Error(msg.error);
          const tok = msg.message?.content || '';
          if (!tok) continue;
          const now = Date.now();
          if (!p.firstTokenAt) { p.firstTokenAt = now; p.phase = 'writing'; }
          p.lastTokenAt = now; p.tokens++; p.text += tok;
          report();
        }
      }
      const end = Date.now();
      // The model now holds this prompt in its cache; note it so warm() doesn't re-send the same data.
      if (messages[0]?.content === SYSTEM && messages[1]?.content) {
        const ctx = sharedContext();
        if (messages[1].content.startsWith(ctx)) { warmCtx = ctx; warmedAt = end; }
      }
      if (p.firstTokenAt) learnStats(promptChars, p.firstTokenAt - p.start, p.tokens, end - p.firstTokenAt, p.firstTokenAt - p.start < p.estReadMs * 0.25);
      p.phase = 'done';
      return p.text;
    } catch (e) {
      p.phase = signal?.aborted ? 'cancelled' : 'failed';
      p.error = e.message;
      throw signal?.aborted ? new Error('Cancelled') : e;
    } finally {
      activeCalls--;
      report();
    }
  }

  // ---------- pre-reading (prompt cache) ----------
  // On a CPU-only machine the model reads ~30 tokens/s, so the ~4k-token shared data takes minutes.
  // Ollama keeps the last prompt in its cache and skips any identical prefix next time, so we send the
  // shared data ahead of time (1 output token) while the user is still typing. Every agent, question
  // and story prompt starts with exactly the same SYSTEM + sharedContext(), so they all benefit.
  let warmCtx = '', warmedAt = 0, warming = null;
  const WARM_TTL = 25 * 60 * 1000; // a little under the 30-minute keep_alive
  function warmState() {
    const ctx = sharedContext();
    return { ctx, fresh: ctx === warmCtx && Date.now() - warmedAt < WARM_TTL };
  }
  function warm() {
    if (warming) return warming;
    const { ctx, fresh } = warmState();
    if (fresh || activeCalls > 0) return Promise.resolve(fresh);
    warmCtx = ctx;
    // Stop as soon as the first token appears: by then the data is read and cached, and nothing else is needed
    // (this also protects against a backend that ignores num_predict).
    const ctl = new AbortController();
    let read = false;
    warming = call([{ role: 'system', content: SYSTEM }, { role: 'user', content: ctx }], {
      numPredict: 1, temperature: 0, label: 'Pre-reading data', signal: ctl.signal,
      onProgress: pr => { if (pr.phase === 'writing' && !read) { read = true; ctl.abort(); } },
    })
      .then(() => true, () => read)
      .then(ok => { if (ok) warmedAt = Date.now(); return ok; })
      .finally(() => { warming = null; });
    return warming;
  }
  const isWarm = () => warmState().fresh;

  // Final text only. Pass json:true to force a JSON response.
  const chat = (messages, opts = {}) => call(messages, opts);

  // Streaming: calls onToken(token, fullText) as text arrives and resolves with the full text.
  function stream(messages, onToken, opts = {}) {
    let seen = 0;
    return call(messages, { temperature: 0.5, ...opts, onProgress: pr => {
      if (pr.text.length > seen) { onToken(pr.text.slice(seen), pr.text); seen = pr.text.length; }
      opts.onProgress?.(pr);
    } });
  }

  // Is the model loaded in memory? (Ollama /api/ps via the backend, or directly.)
  async function status() {
    try {
      const res = await fetch(viaServer() ? '/api/status' : `${config.baseUrl}/api/ps`, { headers: headers() });
      const data = await res.json();
      const models = data.models || [];
      return { reachable: res.ok, loaded: data.loaded ?? models.some(m => !config.model || m.name === config.model || m.model === config.model), models };
    } catch { return { reachable: false, loaded: false, models: [] }; }
  }

  function parseJson(text) {
    try { return JSON.parse(text); } catch {}
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }

  const SYSTEM = `You are Tackle AI, a data analyst for NSW Rugby Union's Rugby World Cup Legacy Program.
You only use facts in the provided JSON. Never invent numbers. Be specific: name regions and dollar figures.
Write in plain Australian English for program managers and board members.`;

  const AGENTS = [
    { id: 'FE', name: 'Facilities Agent', pillar: 'Facilities & Equipment',
      brief: 'Assess facilities and equipment spend by region: which regions are well served, which look overspent or underserved relative to population, which audit gaps (female changerooms, lighting, drainage, accessibility) are being addressed, and the equipment gap.' },
    { id: 'PW', name: 'Workforce Agent', pillar: 'Programs & Workforce',
      brief: 'Assess programs and workforce: coach and match official growth vs targets, ratios, volunteer burnout, salary sustainability after 2028, and where workforce investment is located.' },
    { id: 'INC', name: 'Inclusion Agent', pillar: 'Inclusion',
      brief: 'Assess inclusion for women and girls, First Nations (Aboriginal and Torres Strait Islander), Pasifika and CALD communities, and people with disability. Compare regional First Nations population share with where First Nations programs reach. Flag gaps.' },
    { id: 'CEN', name: 'Centralisation Agent', pillar: 'Centralisation',
      brief: 'Assess whether spend is too centralised: share held in statewide NSWRU budgets, Greater Sydney vs regional NSW against population share, concentration across regions, and how much inclusion money is held centrally.' },
    { id: 'IMP', name: 'Impact Agent', pillar: 'Impact',
      brief: `Assess the program's SOCIAL, ECONOMIC and CULTURAL impact. Give one insight per kind of impact at minimum.
Social: do people feel safe and welcome (e.g. women feeling safe because of women-only / female-friendly facilities; First Nations players feeling culturally safe), wellbeing, mental health, safeguarding.
Economic: local business and tourism around games and events (e.g. a local takeaway shop busier on game days), construction spend, co-investment leverage, jobs (including First Nations businesses and jobs in funded works), volunteer value.
Cultural: community activation and gathering (e.g. Pasifika and First Nations communities choosing a ground as their gathering place; carnivals such as Ella 7s; NAIDOC events), multicultural participation.
Always cover First Nations peoples explicitly where the data allows. Use the term "First Nations" in your output.
Use the IMPACT lines (spend per lens, which indicators have data and which say NO DATA) and FIELD EVIDENCE. Where a lens has no evidence yet, say so and recommend how to collect it.`, count: 4 },
  ];

  // Shared data + learned lessons first (identical for every agent, so Ollama reuses its prompt cache
  // and agents after the first only process their short task), then the agent-specific task.
  function sharedContext() {
    const lessons = window.Feedback?.lessons?.() || '';
    return `DATA:\n${window.Analytics.briefing()}${lessons ? '\n\n' + lessons : ''}`;
  }

  // Rough output size, for the progress bar: ~110 tokens per insight plus JSON overhead.
  const expectedTokens = count => 40 + count * 110;

  async function runAgent(agent, { count = agent.count || 3, signal, onProgress } = {}) {
    const task = `TASK FOR ${agent.name.toUpperCase()}: ${agent.brief}

Return JSON exactly in this shape:
{"insights":[{"title":"max 10 words","insight":"2-3 sentences","severity":"positive|watch|risk","impact":"social|economic|cultural","region":"region name or empty","evidence":"the key numbers","action":"one recommended action"}]}
Give ${count} insights.
Rules:
- The FLAGS lines are ground truth. Only call a region overspent if it is listed under Overspend risk, under-served only if listed under Under-served. Never call a balanced region overspent.
- "First Nations" in the data means Aboriginal and Torres Strait Islander peoples. Refer to them as "First Nations" and use the First Nations program reach and GAP lines exactly.
- Take each dollar figure from that region's own row. Do not move numbers between regions.
- "impact" is the main kind of impact: social (safety, wellbeing, belonging, women feeling safe), economic (local business, tourism, jobs, construction, co-investment) or cultural (community gatherings, Pasifika, First Nations, multicultural activation).
- Field evidence records were written by staff; you may quote them, attributed to their source.
- Follow the LEARNED FROM STAFF FEEDBACK section if present.`;
    const text = await chat([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `${sharedContext()}\n\n${task}` },
    ], { json: true, signal, label: agent.name, onProgress: pr => onProgress?.({ ...pr, expectedTokens: expectedTokens(count), insightsWritten: (pr.text.match(/"action"\s*:/g) || []).length, insightsTotal: count }) });
    const parsed = parseJson(text);
    const list = Array.isArray(parsed) ? parsed : parsed?.insights;
    if (!Array.isArray(list) || !list.length) throw new Error('Model did not return insights JSON');
    return list.map(i => factCheck({
      title: String(i.title || 'Insight'), insight: String(i.insight || i.body || ''),
      severity: ['positive', 'watch', 'risk'].includes(i.severity) ? i.severity : 'watch',
      region: i.region || '', evidence: i.evidence ? String(i.evidence) : '', action: i.action ? String(i.action) : '',
      impact: normaliseImpact(i.impact), pillar: agent.pillar, agent: agent.name,
    }));
  }

  // Small models sometimes contradict the computed flags (e.g. call an overspend region "under-served").
  // Check over/under claims against the real status and mark contradictions instead of hiding them.
  const OVER_RE = /over[- ]?(spen|serv|fund|budget|alloc)|too much/i;
  const UNDER_RE = /under[- ]?(serv|fund|spen|invest|resourc)|neglect/i;
  function factCheck(ins) {
    const rows = window.Analytics.regionMetrics();
    const issues = [];
    const sentences = `${ins.title}. ${ins.insight}`.split(/(?<=[.!?])\s+/);
    for (const r of rows) {
      const about = sentences.filter(s => s.includes(r.name));
      if (!about.length) continue;
      const claimsOver = about.some(s => OVER_RE.test(s)), claimsUnder = about.some(s => UNDER_RE.test(s));
      const label = { over: 'overspend risk', under: 'under-served', balanced: 'balanced' }[r.status];
      if (claimsOver && r.status !== 'over') issues.push(`${r.name} is ${label} (${r.spendIndex.toFixed(2)}x), not overspent`);
      if (claimsUnder && r.status !== 'under') issues.push(`${r.name} is ${label} (${r.spendIndex.toFixed(2)}x), not under-served`);
    }
    return issues.length ? { ...ins, check: issues.join('; ') } : ins;
  }

  function normaliseImpact(v) {
    const s = String(v || '').toLowerCase();
    return ['social', 'economic', 'cultural'].find(k => s.includes(k)) || '';
  }

  return { get config() { return config; }, get viaServer() { return viaServer(); }, get busy() { return activeCalls > 0; }, save, listModels, chat, stream, status, parseJson, runAgent, sharedContext, warm, isWarm, expectedTokens, estimateReadMs, estimateWriteMs, normaliseImpact, AGENTS, SYSTEM };
})();
