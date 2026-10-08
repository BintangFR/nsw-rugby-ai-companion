import { send, authorised } from './_lib/http.js';
import { listModels, allowModelOverride, llmConfig } from './_lib/llm.js';

// Same shape as Ollama's /api/tags so the browser client works unchanged.
export default async function handler(req, res) {
  if (!authorised(req, res)) return;
  try {
    const { names, cfg } = await listModels();
    const models = allowModelOverride() ? names : names.filter(n => n === cfg.model);
    send(res, 200, { models: (models.length ? models : [cfg.model]).map(name => ({ name })), default: cfg.model, provider: cfg.provider, modelOverride: allowModelOverride() });
  } catch (e) {
    const cfg = llmConfig();
    send(res, 502, { error: `Could not reach ${cfg.provider}: ${e.message}`, default: cfg.model, provider: cfg.provider });
  }
}
