// Pre-deploy check: `npm run check` (also run by GitHub Actions on every push).
//   1. Every JavaScript file parses.
//   2. Every local script/stylesheet referenced by index.html exists.
//   3. The seed data in js/data.js is internally consistent (regions, pillars, targets, impact framework).
// No dependencies. Exits non-zero on the first category with errors so CI fails loudly.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = msg => errors.push(msg);

// ---------- 1. syntax ----------
const walk = dir => readdirSync(dir).flatMap(n => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(m?js)$/.test(n) ? [p] : [];
});
const files = [...walk(path.join(root, 'js')), ...walk(path.join(root, 'api')), ...walk(path.join(root, 'scripts')), path.join(root, 'server.js')];
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { fail(`Syntax error in ${path.relative(root, f)}:\n${String(e.stderr).trim()}`); }
}

// ---------- 2. index.html references ----------
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, ref] of html.matchAll(/(?:src|href)="(?!https?:|#|mailto:|data:)([^"?]+)/g)) {
  if (!existsSync(path.join(root, ref))) fail(`index.html references missing file: ${ref}`);
}

// ---------- 3. seed data ----------
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(path.join(root, 'js', 'data.js'), 'utf8'), sandbox);
const D = sandbox.window.TACKLE_DATA;
const regionNames = new Set(D.regions.map(r => r.name));
const PILLARS = new Set(['FE', 'PW', 'INC', 'ACT', 'PM']);
const TAGS = new Set(['women', 'firstNations', 'pasifika', 'access']);

for (const r of D.regions) {
  if (!(r.pop > 0)) fail(`Region "${r.name}" needs a positive pop`);
  if (!D.aliases[r.name]) fail(`Region "${r.name}" has no entry in aliases`);
}
for (const name of Object.keys(D.aliases)) if (!regionNames.has(name)) fail(`aliases has unknown region "${name}"`);

D.grants.forEach((g, i) => {
  const where = `grants[${i}] "${g.project}"`;
  if (g.region !== 'Statewide' && !regionNames.has(g.region)) fail(`${where}: unknown region "${g.region}" (use a region name or "Statewide")`);
  if (!PILLARS.has(g.pillar)) fail(`${where}: unknown pillar "${g.pillar}"`);
  if (!(g.amount > 0)) fail(`${where}: amount must be positive`);
  for (const t of g.tags) if (!TAGS.has(t)) fail(`${where}: unknown tag "${t}"`);
});
D.dashboard.forEach((d, i) => {
  const where = `dashboard[${i}] "${d.initiative}"`;
  if (d.region !== 'Statewide' && !regionNames.has(d.region)) fail(`${where}: unknown region "${d.region}" (use a region name or "Statewide")`);
  if (!PILLARS.has(d.pillar)) fail(`${where}: unknown pillar "${d.pillar}"`);
  for (const t of d.tags) if (!TAGS.has(t)) fail(`${where}: unknown tag "${t}"`);
});
for (const r of D.firstNationsReach) if (!regionNames.has(r)) fail(`firstNationsReach: unknown region "${r}"`);

const ids = new Set();
for (const k of D.kpis) {
  if (ids.has(k.id)) fail(`kpis: duplicate id "${k.id}"`);
  ids.add(k.id);
  if (k.targetYear && k.startYear && k.targetYear < k.startYear) fail(`kpis "${k.id}": targetYear is before startYear`);
}
// Impact measures must come from a named external framework (see "Impact measurement" in js/data.js).
for (const [id, f] of Object.entries(D.frameworks)) {
  if (!f.org || !f.title || !f.year || !f.use) fail(`frameworks.${id}: needs org, title, year and use`);
  if (!f.url && !f.file) fail(`frameworks.${id}: needs a url or a Dataset file`);
  if (f.file && !existsSync(path.join(root, 'Dataset', f.file))) fail(`frameworks.${id}: Dataset/${f.file} not found`);
}
for (const [lens, l] of Object.entries(D.impactMethods)) {
  for (const id of l.frameworks) if (!D.frameworks[id]) fail(`impactMethods.${lens}.frameworks: unknown framework "${id}"`);
  for (const m of l.measures) {
    if (!['measured', 'partial', 'none'].includes(m.status)) fail(`impactMethods.${lens} "${m.name}": status must be measured | partial | none`);
    if (!D.frameworks[m.framework]) fail(`impactMethods.${lens} "${m.name}": unknown framework "${m.framework}"`);
    if (!m.how || !m.source) fail(`impactMethods.${lens} "${m.name}": needs how and source`);
  }
}
for (const k of D.kpis) {
  if (k.measure && !/^[a-zA-Z]+$/.test(k.measure)) fail(`kpis "${k.id}": bad measure id "${k.measure}"`);
  if (!['FE', 'PRP', 'PW', 'INC', 'ACT'].includes(k.area)) fail(`kpis "${k.id}": area must be one of the five pillars FE, PRP, PW, INC, ACT`);
  if (!['growth', 'count', 'share', 'annual', 'level'].includes(k.kind)) fail(`kpis "${k.id}": unknown kind "${k.kind}"`);
  if (k.kind === 'level' && (typeof k.baseline !== 'number' || !k.baseYear || k.unit == null)) fail(`kpis "${k.id}": level targets need baseline, baseYear and unit`);
}

// ---------- report ----------
if (errors.length) {
  console.error(`✗ ${errors.length} problem${errors.length === 1 ? '' : 's'} found:\n`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`✓ ${files.length} JS files parse · index.html references OK · seed data OK (${D.regions.length} regions, ${D.grants.length} grants, ${D.dashboard.length} dashboard lines, ${D.kpis.length} targets)`);
