// LLM provider adapter.
//   LLM_PROVIDER=ollama  -> Ollama native API (local, or Ollama Cloud with OLLAMA_API_KEY)
//   LLM_PROVIDER=openai  -> any OpenAI-compatible API (Groq, OpenRouter, Together, OpenAI, ...)
// Responses are normalised to Ollama's shape so the browser client is the same either way.

import http from 'node:http';
import https from 'node:https';

const env = k => process.env[k] || '';
// CPU-only Ollama can take minutes before the first token, longer than fetch()'s built-in 5-minute
// headers timeout, so Ollama calls use node:http with our own (long) limit instead.
const LLM_TIMEOUT_MS = Number(env('LLM_TIMEOUT_MS')) || 15 * 60 * 1000;
const KEEP_ALIVE = env('OLLAMA_KEEP_ALIVE') || '30m'; // keep the model loaded between agent calls

// POST JSON and call onLine(obj) for each NDJSON line of the response.
function postNdjson(url, body, headers, onLine, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Cancelled'));
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } }, res => {
      if (res.statusCode >= 400) {
        let err = '';
        res.on('data', c => { err += c; });
        res.on('end', () => reject(new Error(`Ollama returned ${res.statusCode}: ${err.slice(0, 300)}`)));
        return;
      }
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', chunk => {
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop();
        try {
          for (const line of lines) if (line.trim()) onLine(JSON.parse(line));
        } catch (e) { req.destroy(e); }
      });
      res.on('end', () => {
        try { if (buf.trim()) onLine(JSON.parse(buf)); resolve(); } catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.setTimeout(LLM_TIMEOUT_MS, () => req.destroy(new Error(`AI request timed out after ${Math.round(LLM_TIMEOUT_MS / 60000)} min`)));
    req.on('error', reject);
    signal?.addEventListener('abort', () => req.destroy(new Error('Cancelled')), { once: true }); // stops Ollama working on a cancelled job
    req.end(JSON.stringify(body));
  });
}

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
  // Stream internally so data keeps flowing during long generations; return the joined text.
  let text = '';
  await postNdjson(`${cfg.baseUrl}/api/chat`,
    { model, messages: body.messages, stream: true, think: false, keep_alive: KEEP_ALIVE, ...(body.format === 'json' ? { format: 'json' } : {}), options: body.options || {} },
    authHeaders(cfg),
    msg => { if (msg.error) throw new Error(msg.error); text += msg.message?.content || ''; });
  return text;
}

// Streams tokens to onToken(text). Resolves when the model finishes. body.format 'json' forces JSON output.
export async function stream(body, onToken, signal) {
  const { cfg, model } = pickModel(body.model);
  if (!model) throw new Error('No model configured (set OLLAMA_MODEL or LLM_MODEL)');
  const openai = cfg.provider === 'openai';
  if (!openai) {
    return postNdjson(`${cfg.baseUrl}/api/chat`,
      { model, messages: body.messages, stream: true, think: false, keep_alive: KEEP_ALIVE, ...(body.format === 'json' ? { format: 'json' } : {}), options: body.options || {} },
      authHeaders(cfg),
      msg => { if (msg.error) throw new Error(msg.error); if (msg.message?.content) onToken(msg.message.content); },
      signal);
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) }, signal,
    body: JSON.stringify({ model, messages: body.messages, temperature: body.options?.temperature ?? 0.5, stream: true, ...(body.format === 'json' ? { response_format: { type: 'json_object' } } : {}) }),
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

// Which models are loaded in memory (Ollama /api/ps). Hosted APIs are always "loaded".
export async function loadedModels() {
  const cfg = llmConfig();
  if (cfg.provider === 'openai') return { loaded: true, models: [{ name: cfg.model }] };
  const res = await fetch(`${cfg.baseUrl}/api/ps`, { headers: authHeaders(cfg), signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const models = ((await res.json()).models || []).map(m => ({ name: m.name, sizeVram: m.size_vram, expiresAt: m.expires_at }));
  return { loaded: models.length > 0, models };
}