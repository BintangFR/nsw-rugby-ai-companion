// LLM provider adapter.
//   LLM_PROVIDER=ollama  -> Ollama native API (local, or Ollama Cloud with OLLAMA_API_KEY)
//   LLM_PROVIDER=openai  -> any OpenAI-compatible API (Groq, OpenRouter, Together, OpenAI, ...)
// Responses are normalised to Ollama's shape so the browser client is the same either way.

const env = k => process.env[k] || '';

export function llmConfig() {
  const provider = (env('LLM_PROVIDER') || 'ollama').toLowerCase();
  if (provider === 'openai') {
    return { provider, baseUrl: (env('LLM_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, ''), model: env('LLM_MODEL'), apiKey: env('LLM_API_KEY') };
  }
  return { provider: 'ollama', baseUrl: (env('OLLAMA_URL') || 'http://localhost:11434').replace(/\/$/, ''), model: env('OLLAMA_MODEL') || 'qwen2.5:7b', apiKey: env('OLLAMA_API_KEY') };
}

// The browser may pick a model locally; on Vercel only the configured model is used unless explicitly allowed.
export function allowModelOverride() {
  const v = env('ALLOW_MODEL_OVERRIDE');
  return v ? v === 'true' : !env('VERCEL');
}

const authHeaders = cfg => (cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {});

export async function listModels() {
  const cfg = llmConfig();
  const path = cfg.provider === 'openai' ? '/models' : '/api/tags';
  const res = await fetch(cfg.baseUrl + path, { headers: authHeaders(cfg), signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${cfg.provider} returned ${res.status}`);
  const data = await res.json();
  const names = cfg.provider === 'openai' ? (data.data || []).map(m => m.id) : (data.models || []).map(m => m.name);
  return { names, cfg };
}

function pickModel(requested) {
  const cfg = llmConfig();
  return { cfg, model: (allowModelOverride() && requested) || cfg.model };
}

// body: { model, messages, format: 'json'?, options: { temperature, num_ctx } }
export async function chat(body) {
  const { cfg, model } = pickModel(body.model);
  if (!model) throw new Error('No model configured (set OLLAMA_MODEL or LLM_MODEL)');
  if (cfg.provider === 'openai') {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
      body: JSON.stringify({ model, messages: body.messages, temperature: body.options?.temperature ?? 0.3, ...(body.format === 'json' ? { response_format: { type: 'json_object' } } : {}) }),
    });
    if (!res.ok) throw new Error(`LLM returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
  const res = await fetch(`${cfg.baseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify({ model, messages: body.messages, stream: false, think: false, ...(body.format === 'json' ? { format: 'json' } : {}), options: body.options || {} }),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).message?.content ?? '';
}

// Streams tokens to onToken(text). Resolves when the model finishes.
export async function stream(body, onToken) {
  const { cfg, model } = pickModel(body.model);
  if (!model) throw new Error('No model configured (set OLLAMA_MODEL or LLM_MODEL)');
  const openai = cfg.provider === 'openai';
  const res = await fetch(openai ? `${cfg.baseUrl}/chat/completions` : `${cfg.baseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify(openai
      ? { model, messages: body.messages, temperature: body.options?.temperature ?? 0.5, stream: true }
      : { model, messages: body.messages, stream: true, think: false, options: body.options || {} }),
  });
  if (!res.ok || !res.body) throw new Error(`LLM returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      if (openai) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        const tok = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (tok) onToken(tok);
      } else {
        const tok = JSON.parse(line).message?.content;
        if (tok) onToken(tok);
      }
    }
  }
}
