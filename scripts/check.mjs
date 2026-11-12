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
  // Dataset/ may be empty (partner files are not committed), so a cited file only has to be named, not present.
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

// ---------- 4. KPI framework engine (rules from NSW_Rugby_KPI_Formula_Web_Handover.xlsx) ----------
const kctx = { window: {} };
vm.runInNewContext(readFileSync(path.join(root, 'js', 'kpi-framework.js'), 'utf8'), kctx);
const KF = kctx.window.KPIF;
const S = KF.STATUS;
if (KF.KPIS.length !== 27) fail(`KPI framework: expected 27 KPIs, found ${KF.KPIS.length}`);
for (const [dim, n] of [['Economic', 9], ['Social', 8], ['Cultural', 10]]) {
  const c = KF.KPIS.filter(k => k.dim === dim).length;
  if (c !== n) fail(`KPI framework: expected ${n} ${dim} KPIs, found ${c}`);
}
for (const k of KF.KPIS) {
  if (!k.baseline) fail(`KPI framework ${k.id}: no baseline requirement`);
  if (!k.rules) fail(`KPI framework ${k.id}: no missing-data / zero-denominator rule`);
}
const meta = (o = {}) => ({ period_start: '2026-01-01', period_end: '2026-12-31', scope_id: 'Test site', method_version: 'v1', source_ref: 'test extract',
  record_type: 'Operational', source_verification: 'Verified', source_checks_passed: true, method_permission: 'Approved', capture_status: 'Complete', ...o });
const kpi = id => KF.KPIS.find(k => k.id === id);
const ev = (id, inputs, m) => KF.evaluate(kpi(id), { meta: meta(m), inputs });
const expect = (name, got, want) => { if (got !== want) fail(`KPI engine: ${name}: expected "${want}", got "${got}"`); };
expect('P1-01 rate', ev('P1-01', { U: 1500, H: 2000 }).display, '75.0%');
expect('P1-01 verified status', ev('P1-01', { U: 1500, H: 2000 }).status, S.VERIFIED);
expect('P1-01 zero capacity', ev('P1-01', { U: 0, H: 0 }).status, S.NA);
expect('P1-01 U > H', ev('P1-01', { U: 3, H: 2 }).status, S.FAIL);
expect('missing input is never zero', ev('P1-01', { U: 10 }).status, S.DCR);
expect('missing metadata', KF.evaluate(kpi('P1-01'), { meta: {}, inputs: { U: 1, H: 2 } }).status, S.DCR);
expect('hypothetical label', ev('P1-01', { U: 1, H: 2 }, { record_type: 'Hypothetical', method_permission: 'Pending' }).status, S.HYPOTHETICAL);
expect('operational needs approval', ev('P1-01', { U: 1, H: 2 }, { method_permission: 'Pending' }).status, S.DCR);
expect('estimated label', ev('P1-01', { U: 1, H: 2 }, { source_verification: 'Estimated' }).status, S.ESTIMATED);
expect('not verified blocks result', ev('P1-01', { U: 1, H: 2 }, { source_verification: 'Not verified' }).status, S.DCR);
expect('end before start', ev('P1-01', { U: 1, H: 2 }, { period_end: '2025-01-01' }).status, S.FAIL);
expect('partial only for P3-03', ev('P1-01', { U: 1, H: 2 }, { capture_status: 'Partial' }).status, S.DCR);
expect('P3-03 partial needs coverage', ev('P3-03', { h: 120 }, { capture_status: 'Partial' }).status, S.DCR);
expect('P3-03 partial subtotal', ev('P3-03', { h: 120, coverage: '14 of 20 clubs' }, { capture_status: 'Partial' }).status, S.VERIFIED);
expect('P1-03 zero cost', ev('P1-03', { I: 500, E: 0 }).status, S.NC);
expect('P3-01 checks pending', ev('P3-01', { B: 10, R: 5, checks: false }).status, S.DCR);
expect('P3-01 rate', ev('P3-01', { B: 40, R: 30, checks: true }).display, '75.0%');
expect('P3-02 zero output', ev('P3-02', { C: 1000, N: 0 }).status, S.NC);
expect('P4-02 change', ev('P4-02', { n: 10, Bsum: 5000, Fsum: 4000, checks: true }).display, '−$100.00 per person (reduction)');
expect('P4-02 n=0 with costs', ev('P4-02', { n: 0, Bsum: 10, Fsum: 0, checks: true }).status, S.FAIL);
expect('S02 counts must add up', ev('S02', { barrier: 'transport', B: 20, M: 10, I: 5, H: 3, W: 1 }).status, S.FAIL);
expect('S02 improvement', ev('S02', { barrier: 'transport', B: 20, M: 10, I: 5, H: 3, W: 2 }).display, '50.0%');
expect('S03 rate', ev('S03', { yes: 30, no: 10 }).display, '75.0%');
expect('S03 no valid responses', ev('S03', { yes: 0, no: 0 }).status, S.NC);
expect('C03 exclusions required', ev('C03', { agree: 5, sagree: 5, sdisagree: 1, disagree: 1, neutral: 1 }).status, S.DCR);
expect('S07 all unknown withheld', ev('S07', { group: 'Pasifika', L: 10, G: 0, U: 10 }).display, 'Unknown');
expect('S07 G+U>L', ev('S07', { group: 'Pasifika', L: 10, G: 6, U: 5 }).status, S.FAIL);
expect('C05 practice rules', ev('C05', { aV: 3, aA: 4, aD: 5, aNA: 1, aUNR: 0, aEXP: 6 }).status, S.VERIFIED);
expect('C05 V<=A<=D', ev('C05', { aV: 5, aA: 4, aD: 5, aNA: 1, aUNR: 0, aEXP: 6 }).status, S.FAIL);
expect('inactive KPI', KF.evaluate(kpi('C01'), {}).status, S.INACTIVE);
const w1 = ev('P1-01', { U: 1000, H: 2000 }), w2 = ev('P1-01', { U: 1500, H: 2000 });
const entry = ok => ({ comparison_approved: ok, waves: [{ meta: meta() }, { meta: meta() }] });
expect('change in pp', KF.change(kpi('P1-01'), w1, w2, entry(true)).text, '+25.0 pp');
expect('change needs approval', KF.change(kpi('P1-01'), w1, w2, entry(false)).status, 'Not comparable');

// ---------- report ----------
if (errors.length) {
  console.error(`✗ ${errors.length} problem${errors.length === 1 ? '' : 's'} found:\n`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`✓ ${files.length} JS files parse · index.html references OK · seed data OK (${D.regions.length} regions, ${D.grants.length} grants, ${D.dashboard.length} dashboard lines, ${D.kpis.length} targets) · KPI framework OK (${KF.KPIS.length} KPIs, engine tests passed)`);
