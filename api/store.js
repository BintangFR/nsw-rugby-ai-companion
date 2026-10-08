import { send, readBody, query, authorised, methodNotAllowed } from './_lib/http.js';
import { COLLECTIONS, getItem, setItem } from './_lib/store.js';

// GET  /api/store          -> { evidence, feedback, datasets, insights, story }
// GET  /api/store?c=name   -> value
// PUT  /api/store?c=name   { value } -> { ok: true }
export default async function handler(req, res) {
  if (!authorised(req, res)) return;
  const { c } = query(req);
  if (c && !COLLECTIONS.includes(c)) return send(res, 400, { error: `Unknown collection "${c}"` });
  try {
    if (req.method === 'GET') {
      if (c) return send(res, 200, await getItem(c));
      const entries = await Promise.all(COLLECTIONS.map(async k => [k, await getItem(k)]));
      return send(res, 200, Object.fromEntries(entries));
    }
    if (req.method === 'PUT') {
      if (!c) return send(res, 400, { error: 'c (collection) required' });
      const body = await readBody(req);
      if (!('value' in body)) return send(res, 400, { error: 'value required' });
      await setItem(c, body.value);
      return send(res, 200, { ok: true });
    }
    return methodNotAllowed(res, ['GET', 'PUT']);
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
