import { send, authorised } from './_lib/http.js';
import { llmConfig, listModels, allowModelOverride } from './_lib/llm.js';
import { storageInfo } from './_lib/store.js';

export default async function handler(req, res) {
  if (!authorised(req, res)) return;
  const cfg = llmConfig();
  let reachable = false, error;
  try { await listModels(); reachable = true; } catch (e) { error = e.message; }
  send(res, 200, {
    ok: true,
    llm: { provider: cfg.provider, model: cfg.model, baseUrl: cfg.provider === 'ollama' && !cfg.apiKey ? cfg.baseUrl : undefined, reachable, error, modelOverride: allowModelOverride() },
    storage: storageInfo(),
    deployment: process.env.VERCEL ? 'vercel' : 'local',
  });
}
