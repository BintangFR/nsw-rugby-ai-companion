import { send, readBody, authorised, methodNotAllowed } from './_lib/http.js';
import { chat, stream } from './_lib/llm.js';

// POST { model?, messages, stream?, format?: 'json', options?: { temperature, num_ctx, num_predict } }
// Non-streaming -> { message: { content } }. Streaming -> NDJSON lines { message: { content } } then { done: true }.
export default async function handler(req, res) {
  if (!authorised(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  if (!Array.isArray(body.messages) || !body.messages.length) return send(res, 400, { error: 'messages required' });
  const messages = body.messages
    .filter(m => ['system', 'user', 'assistant'].includes(m.role))
    .map(m => ({ role: m.role, content: String(m.content ?? '').slice(0, 60000) }));
  const options = { temperature: Number(body.options?.temperature ?? 0.3), num_ctx: Number(body.options?.num_ctx ?? 8192) };
  // Optional answer-length cap (also used with 1 to pre-read the shared data into the model's prompt cache).
  const np = Number(body.options?.num_predict);
  if (Number.isFinite(np) && np >= 1) options.num_predict = Math.min(Math.round(np), 4096);
  const opts = { model: body.model, messages, format: body.format, options };

  if (!body.stream) {
    try { return send(res, 200, { message: { role: 'assistant', content: await chat(opts) } }); }
    catch (e) { return send(res, 502, { error: e.message }); }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  // If the browser cancels (or the tab closes), stop the model instead of letting it run on.
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  try {
    await stream(opts, tok => res.write(JSON.stringify({ message: { role: 'assistant', content: tok } }) + '\n'), ac.signal);
    res.end(JSON.stringify({ done: true }) + '\n');
  } catch (e) {
    if (!res.writableEnded) res.end(JSON.stringify({ error: e.message, done: true }) + '\n');
  }
}
