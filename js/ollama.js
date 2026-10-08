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

  // Non-streaming chat. Pass json:true to force a JSON response.
  async function chat(messages, { json = false, temperature = 0.3, signal } = {}) {
    if (!config.model && !viaServer()) throw new Error('No Ollama model selected'); // the backend falls back to its configured model
    const res = await fetch(endpoint('/api/chat'), {
      method: 'POST',
      headers: headers(),
      signal,
      // think:false stops reasoning models (qwen3, deepseek-r1) spending minutes on hidden thinking
      body: JSON.stringify({ model: config.model, messages, stream: false, think: false, ...(json ? { format: 'json' } : {}), options: { temperature, num_ctx: 8192 } }),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.message?.content ?? '';
  }

  // Streaming chat; calls onToken with each chunk and resolves with the full text.
  async function stream(messages, onToken, { temperature = 0.5, signal } = {}) {
    if (!config.model && !viaServer()) throw new Error('No Ollama model selected'); // the backend falls back to its configured model
    const res = await fetch(endpoint('/api/chat'), {
      method: 'POST',
      headers: headers(),
      signal,
      body: JSON.stringify({ model: config.model, messages, stream: true, think: false, options: { temperature, num_ctx: 8192 } }),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama returned ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', full = '';
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
        if (tok) { full += tok; onToken(tok, full); }
      }
    }
    return full;
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
Social: do people feel safe and welcome (e.g. women feeling safe because of women-only / female-friendly facilities), wellbeing, mental health, safeguarding.
Economic: local business and tourism around games and events (e.g. a local takeaway shop busier on game days), construction spend, co-investment leverage, jobs, volunteer value.
Cultural: community activation and gathering (e.g. Pasifika and First Nations communities choosing a ground as their gathering place), multicultural participation.
Use impact.byLens totals, impact.indicators (which measures have data and which do not) and impact.evidence (records from the field). Where a lens has no evidence yet, say so and recommend how to collect it.`, count: 4 },
  ];

  async function runAgent(agent, { count = agent.count || 3, signal } = {}) {
    const ctx = window.Analytics.contextFor(agent.id);
    const prompt = `${agent.brief}

Return JSON exactly in this shape:
{"insights":[{"title":"max 10 words","insight":"2-3 sentences","severity":"positive|watch|risk","impact":"social|economic|cultural","region":"region name or empty","evidence":"the key numbers","action":"one recommended action"}]}
Give ${count} insights.
Rules:
- Use the "flags" lists as ground truth. Only call a region overspent if it is in overspendRiskRegions, under-served only if in underServedRegions. Never call a balanced region overspent.
- For First Nations reach use firstNationsProgramReachRegions and firstNationsGapRegions exactly.
- "impact" is the main kind of impact: social (safety, wellbeing, health, belonging, women feeling safe), economic (local business, tourism, jobs, construction, co-investment) or cultural (community gatherings, Pasifika, First Nations, multicultural activation).
- Copy dollar figures exactly from the data. One region per insight unless comparing.
- Impact evidence entries are records written by staff; you may quote them, attributed to their source.
- userFeedback lists items staff verified or disputed. Do not repeat a disputed claim as fact; mention the dispute if relevant.

DATA:
${JSON.stringify(ctx)}`;
    const text = await chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], { json: true, signal });
    const parsed = parseJson(text);
    const list = Array.isArray(parsed) ? parsed : parsed?.insights;
    if (!Array.isArray(list) || !list.length) throw new Error('Model did not return insights JSON');
    return list.map(i => ({
      title: String(i.title || 'Insight'), insight: String(i.insight || i.body || ''),
      severity: ['positive', 'watch', 'risk'].includes(i.severity) ? i.severity : 'watch',
      region: i.region || '', evidence: i.evidence ? String(i.evidence) : '', action: i.action ? String(i.action) : '',
      impact: normaliseImpact(i.impact), pillar: agent.pillar, agent: agent.name,
    }));
  }

  function normaliseImpact(v) {
    const s = String(v || '').toLowerCase();
    return ['social', 'economic', 'cultural'].find(k => s.includes(k)) || '';
  }

  return { get config() { return config; }, get viaServer() { return viaServer(); }, save, listModels, chat, stream, parseJson, runAgent, normaliseImpact, AGENTS, SYSTEM };
})();
