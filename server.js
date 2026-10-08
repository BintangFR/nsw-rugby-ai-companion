// Local server for Tackle AI: serves the site and runs the same /api handlers that Vercel deploys.
// No npm install needed. Usage: node server.js   (PORT=5173 by default)
import http from 'node:http';
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local / .env (simple KEY=VALUE lines) without overriding real environment variables.
for (const name of ['.env.local', '.env']) {
  const file = path.join(root, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT) || 5173;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.csv': 'text/csv', '.md': 'text/markdown', '.txt': 'text/plain; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const BLOCKED = /^(api|data-store|node_modules|\.git)(\/|$)|(^|\/)\.env|^server\.js$|^package(-lock)?\.json$/;
const handlers = {};

async function apiHandler(name) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) return null;
  const file = path.join(root, 'api', `${name}.js`);
  if (!existsSync(file)) return null;
  handlers[name] ??= (await import(pathToFileURL(file).href)).default;
  return handlers[name];
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  try {
    if (rel.startsWith('api/')) {
      const handler = await apiHandler(rel.slice(4).replace(/\/$/, ''));
      if (!handler) { res.statusCode = 404; return res.end('Not found'); }
      return await handler(req, res);
    }
    if (BLOCKED.test(rel)) { res.statusCode = 404; return res.end('Not found'); }
    const file = path.join(root, rel || 'index.html');
    if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
    const data = await fs.readFile(file);
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EISDIR') { res.statusCode = 404; return res.end('Not found'); }
    console.error(e);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Server error');
  }
});

server.listen(PORT, () => {
  console.log(`Tackle AI running at http://localhost:${PORT}`);
  console.log(`LLM: ${process.env.LLM_PROVIDER || 'ollama'} · model ${process.env.OLLAMA_MODEL || process.env.LLM_MODEL || 'qwen2.5:7b'} · storage: data-store/`);
});
