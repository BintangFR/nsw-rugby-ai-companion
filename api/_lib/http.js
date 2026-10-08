// Small helpers shared by the API handlers. Works with Vercel functions and the local server.js.
import { timingSafeEqual } from 'node:crypto';

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function query(req) {
  return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
}

export async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

// Optional shared access key (APP_ACCESS_KEY). Returns true if the request may continue.
export function authorised(req, res) {
  const expected = process.env.APP_ACCESS_KEY;
  if (!expected) return true;
  const given = String(req.headers['x-app-key'] || '');
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (a.length === b.length && timingSafeEqual(a, b)) return true;
  send(res, 401, { error: 'Access key required' });
  return false;
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, { error: 'Method not allowed' });
}
