// Key-value storage for the app's shared state.
//   - Upstash Redis / Vercel KV REST (KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + _TOKEN)
//   - otherwise JSON files in ./data-store (local) or /tmp (Vercel without KV: NOT persistent)
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const COLLECTIONS = ['evidence', 'feedback', 'datasets', 'insights', 'story', 'quality', 'econ'];
const PREFIX = 'tackle:';

function kv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

const fileDir = () => process.env.VERCEL ? '/tmp/tackle-store' : path.join(process.cwd(), 'data-store');

export function storageInfo() {
  if (kv()) return { backend: 'redis', persistent: true };
  return process.env.VERCEL
    ? { backend: 'tmp-files', persistent: false, warning: 'No KV store configured: data resets when the function restarts. Add Upstash Redis (KV_REST_API_URL / KV_REST_API_TOKEN).' }
    : { backend: 'files', persistent: true, dir: 'data-store/' };
}

async function redis(command) {
  const { url, token } = kv();
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
  if (!res.ok) throw new Error(`KV returned ${res.status}`);
  return (await res.json()).result;
}

export async function getItem(c) {
  if (kv()) {
    const v = await redis(['GET', PREFIX + c]);
    return v == null ? null : JSON.parse(v);
  }
  try { return JSON.parse(await fs.readFile(path.join(fileDir(), `${c}.json`), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

export async function setItem(c, value) {
  if (kv()) return redis(['SET', PREFIX + c, JSON.stringify(value)]);
  await fs.mkdir(fileDir(), { recursive: true });
  const file = path.join(fileDir(), `${c}.json`);
  await fs.writeFile(file + '.tmp', JSON.stringify(value, null, 1));
  await fs.rename(file + '.tmp', file);
}
