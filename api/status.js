import { send, authorised } from './_lib/http.js';
import { loadedModels } from './_lib/llm.js';

// GET -> { loaded, models: [{ name, sizeVram, expiresAt }] }. Lets the UI show "loading model" vs "reading".
export default async function handler(req, res) {
  if (!authorised(req, res)) return;
  try { send(res, 200, await loadedModels()); }
  catch (e) { send(res, 502, { loaded: false, models: [], error: e.message }); }
}
