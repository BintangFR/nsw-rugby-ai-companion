// Generates Dataset/Dummy-dataset.csv: every made-up value used by Demo view, in one file. Nothing here is collected data.
// It fills what is not recorded or not measured yet: program results, surveys, target actuals, KPI inputs, valuation
// inputs, impact measures and evidence. Same input, same output: values come from a hash of each item's name.
// Each KPI is run through the real KPI rules, so a bad value fails here rather than on screen.
// Usage: node scripts/make-dummy-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/kpi-framework.js']) vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx);
const D = ctx.window.TACKLE_DATA, KF = ctx.window.KPIF;

// 0..1 from a text and a salt (FNV-1a), so each field varies independently.
const rand = (text, salt) => { let h = 2166136261; for (const c of `${salt}:${text}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 2 ** 32; };
const between = (text, salt, lo, hi) => lo + rand(text, salt) * (hi - lo);
const whole = (text, salt, lo, hi) => Math.round(between(text, salt, lo, hi));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); // same as js/programs.js

const q = v => `"${String(v).replace(/"/g, '""')}"`;
const rows = [['data_tag', 'section', 'item', 'label', 'field', 'value'].join(',')];
const add = (section, item, label, field, value) => rows.push(['[DUMMY]', section, item, label, field, value].map(q).join(','));

// ---------- program results (Programs tab; also the activity counts on Impact) ----------
// Demo view assumes all data is there, so every program has every field.
const QUALIFIES = /coach|referee|match official|\bmo\b|official/i;
function program(id, name, cost, spentShare) {
  add('programs', id, name, 'spent', Math.round(cost * spentShare));
  add('programs', id, name, 'coFunding', Math.round(cost * between(name, 'cofund', 0.1, 0.9)));
  const reached = whole(name, 'people', 40, 420);
  add('programs', id, name, 'participants', reached);
  add('programs', id, name, 'weekly', Math.round(reached * between(name, 'weekly share', 0.35, 0.75))); // weekly is a subset of people reached
  add('programs', id, name, 'volunteerHours', whole(name, 'volunteer hours', 80, 900));
  add('programs', id, name, 'qualified', QUALIFIES.test(name) ? whole(name, 'qualified', 6, 60) : whole(name, 'qualified', 1, 8));
  add('programs', id, name, 'events', whole(name, 'events', 8, 140));
  add('programs', id, name, 'status', 'In progress');
}
for (const g of D.grants) program(slug(`grant-${g.recipient || ''}-${g.project}`), g.project, g.amount, between(g.project, 'spent', 0.15, 0.6));
for (const d of D.dashboard) program(slug(`budget-${d.initiative}`), d.initiative, d.total, d.y1 / d.total * between(d.initiative, 'spent', 0.8, 1) || 0.05);

// ---------- life satisfaction surveys (happiness index) ----------
for (const g of D.grants.filter(x => x.pillar === 'FE')) {
  const n = g.project, ls = +between(n, 'ls', 6.6, 8).toFixed(1);
  const id = 'facility:' + slug(`grant-${g.recipient || ''}-${n}`);
  add('wellbeing', id, n, 'n', whole(n, 'resp', 25, 90)); add('wellbeing', id, n, 'mean', ls); add('wellbeing', id, n, 'before', +(ls - between(n, 'chg', -0.1, 0.5)).toFixed(1));
}
for (const r of D.regions) {
  const n = r.name, id = 'region:' + n;
  add('wellbeing', id, n, 'n', whole(n, 'resp', 80, 300)); add('wellbeing', id, n, 'mean', +between(n, 'ls', 6.8, 7.8).toFixed(1));
}

// ---------- targets: actuals not published; numbers and baselines the plan does not set ----------
const TARGETS = {
  majorUpgrades: { actual: 1 }, equipmentClubs: { actual: 9 }, femaleChange: { actual: 38, target: 60 }, clubEquipment: { actual: 72 }, r2CoContribution: { actual: 28 },
  wsHealthCheck: { actual: 64 }, wsR4gFunding: { actual: 70 }, hunterR4gFunding: { actual: 55 }, hunterParticipation: { actual: 0.04 }, wsAcademy: { actual: 44 }, wsChurn: { actual: 47.6 },
  wsBoards: { actual: 48, target: 70 }, moAbuse: { actual: 66 }, workforceChurn: { actual: 38.2 }, conferenceNps: { actual: 68 }, femaleMOs: { actual: 0.22 }, femaleCoaches: { actual: 0.19 },
  fnTalentId: { actual: 4 }, fnMOs: { actual: 0.15, target: 0.5 }, fnRoles: { actual: 4.5, target: 7.5 }, fnBursaries: { actual: 3, target: 10 }, pasifikaLeaders: { actual: 17 },
  pasifikaYouthCup: { actual: 0.12, baseline: 450 }, pasifikaMOs: { actual: 0.1, target: 0.5 }, pasifikaRoles: { actual: 5, target: 11 }, allAbilities: { actual: 2, target: 5 }, pride: { actual: 1, target: 3 },
  safeguarding: { actual: 4 }, rwcHubs: { actual: 0 }, rwcHubParticipants: { actual: 0 },
};
for (const [id, v] of Object.entries(TARGETS)) {
  const k = D.kpis.find(x => x.id === id);
  if (!k) throw new Error(`Unknown target ${id}`);
  for (const [f, val] of Object.entries(v)) add('targets', id, k.name, f, val);
}

// ---------- valuation calculators with no real inputs ----------
const METHODS = {
  event: { visitors: 320, spend: 85 },
  socialCapital: { n: 240, volunteer: 46, confide3: 61, confide0: 8, responsibilities: 90 },
  cultural: { n: 240, belonging: 78, diversity: 74, knowledge: 69, creativity: 52, aesthetic: 48 },
};
for (const [id, v] of Object.entries(METHODS)) for (const [f, val] of Object.entries(v)) add('methods', id, id, f, val);

// ---------- impact measures with no data (shown as the measure's value) ----------
const MEASURES = {
  'Social capital: volunteered for a civic organisation in the last 12 months': '46% of 240 respondents',
  'Social capital: three or more people to confide in': '61% of 240 respondents',
  'Social capital: no one to confide in (isolation)': '8% of 240 respondents',
  'Social inclusion: feeling accepted, valued and safe': '81% agree, 240 respondents',
  'Event visitor spending (RWC hubs, carnivals, State Championships)': '320 eligible visitors × $85',
  'CDN outcome: sense of belonging to a shared cultural heritage deepened': '78% agree, 240 respondents',
  'CDN outcome: diversity of cultural expression appreciated': '74% agree, 240 respondents',
  'CDN outcome: new knowledge, ideas and insight gained': '69% agree, 240 respondents',
  'CDN outcome: creativity stimulated': '52% agree, 240 respondents',
  'CDN outcome: aesthetic enrichment experienced': '48% agree, 240 respondents',
};
const known = Object.values(D.impactMethods).flatMap(l => l.measures.map(m => m.name));
for (const [name, value] of Object.entries(MEASURES)) { if (!known.includes(name)) throw new Error(`Unknown measure ${name}`); add('measures', name, name, 'value', value); }

// ---------- field evidence ----------
const EVIDENCE = [
  ['social', 'Western Sydney', 'Participant survey', 'Girls say the new changerooms make them feel safe to train at night.', '82% feel safe (n=45)'],
  ['social', 'Hunter', 'Club volunteer', 'Parents say the lights let families train after work.', ''],
  ['economic', 'Central West', 'Local business', 'A takeaway shop near the ground reports busier game days.', 'About 20 extra orders a game day'],
  ['economic', 'Illawarra', 'Club treasurer', 'The upgraded clubhouse now brings in hire income from other groups.', '$6,000 a year'],
  ['cultural', 'Western Sydney', 'Community leader', 'Pasifika families now use the ground as a gathering place on weekends.', ''],
  ['cultural', 'Mid North Coast', 'First Nations program officer', 'Players say the carnival made them feel their culture was respected.', '90% agree (n=30)'],
];
EVIDENCE.forEach(([lens, region, source, text, metric], i) => {
  const id = `e${i + 1}`;
  for (const [f, v] of Object.entries({ lens, region, source, text, metric })) if (v) add('evidence', id, `Evidence ${i + 1}`, f, v);
});

// ---------- KPI inputs (two waves unless the KPI has one) ----------
const yes = true;
const KPIS = {
  'P1-01': [{ U: 1180, H: 2080 }, { U: 1544, H: 2080 }], 'P1-02': [{ C: 120000, R: 0 }, { C: 240000, R: 5000 }], 'P1-03': [{ I: 42000, E: 68000 }, { I: 51000, E: 70000 }],
  'P3-01': [{ B: 410, R: 270, checks: yes }, { B: 460, R: 315, checks: yes }], 'P3-02': [{ C: 18400, N: 46 }, { C: 19900, N: 61 }], 'P3-03': [{ h: 9200 }, { h: 10400 }],
  'P4-01': [{ C: 46000, N: 210 }, { C: 52000, N: 265 }], 'P4-02': [{ n: 120, Bsum: 18000, Fsum: 16200, checks: yes }], 'P4-03': [{ P: 28000, R: 900 }, { P: 33000, R: 700 }],
  S01: [{ N: 620, U: 40 }, { N: 810, U: 35 }], S02: [{ barrier: 'Transport', B: 180, M: 120, I: 62, H: 44, W: 14 }],
  S03: [{ yes: 212, no: 88, unsure: 14, pnta: 6, missing: 10 }, { yes: 240, no: 72, unsure: 12, pnta: 5, missing: 9 }],
  S04: [{ vs: 60, fs: 150, nvs: 70, nas: 20, unsure: 10, pnta: 4, missing: 6 }, { vs: 74, fs: 160, nvs: 56, nas: 14, unsure: 9, pnta: 4, missing: 5 }],
  S05: [{ B: 5200, R: 3120, checks: yes }, { B: 5500, R: 3410, checks: yes }],
  S06: [{ notatall: 4, slightly: 9, moderately: 31, very: 58, extremely: 22, na: 3, unsure: 5, pnta: 1, missing: 6 }, { notatall: 3, slightly: 7, moderately: 28, very: 64, extremely: 29, na: 3, unsure: 4, pnta: 1, missing: 5 }],
  S07: [{ group: 'Women and girls', L: 900, G: 720, U: 40 }, { group: 'Women and girls', L: 1000, G: 840, U: 30 }],
  S08: [{ N: 24, summary: '[DUMMY] Made-up summary of participant accounts.' }, { N: 30, summary: '[DUMMY] Made-up summary of participant accounts.' }],
  C02: [{ dt: 90, pt: 60, pf: 14, df: 6, unsure: 8, pnta: 2, missing: 4 }, { dt: 104, pt: 58, pf: 10, df: 4, unsure: 6, pnta: 2, missing: 3 }],
  C03: [{ sdisagree: 2, disagree: 4, neutral: 17, agree: 61, sagree: 40, na: 6, unsure: 9, pnta: 3, missing: 2 }, { sdisagree: 1, disagree: 3, neutral: 14, agree: 66, sagree: 48, na: 5, unsure: 8, pnta: 2, missing: 2 }],
  C05: [{ aV: 5, aA: 10, aD: 20, aNA: 3, aUNR: 2, aEXP: 25 }, { aV: 8, aA: 14, aD: 25, aNA: 2, aUNR: 1, aEXP: 28 }],
  C06: [{ yes: 180, no: 40, unsure: 12, pnta: 4, missing: 6 }, { yes: 205, no: 32, unsure: 10, pnta: 4, missing: 5 }],
  C07: [{ group: 'First Nations', stratum: 'Coaches', census: '2025-08-01', L: 300, G: 240, U: 20, roster: yes, ready: yes }, { group: 'First Nations', stratum: 'Coaches', census: '2026-08-01', L: 340, G: 290, U: 14, roster: yes, ready: yes }],
  C08: [{ summary: '[DUMMY] Made-up community-approved summary, for layout only.' }],
};
const meta = i => ({ period_start: `${2025 + i}-01-01`, period_end: `${2025 + i}-12-31`, scope_id: 'demo', method_version: 'v1.0', source_ref: 'demo', record_type: 'Hypothetical', source_verification: 'Estimated', source_checks_passed: true, method_permission: 'Pending', capture_status: 'Complete', publication_approved: false });
let bad = 0;
for (const k of KF.KPIS.filter(x => x.state !== 'inactive')) {
  const waves = KPIS[k.id];
  if (!waves) { console.log(`no dummy inputs: ${k.id}`); bad++; continue; }
  waves.forEach((inputs, i) => {
    const r = KF.evaluate(k, { meta: meta(i), inputs });
    if (r.status !== KF.STATUS.HYPOTHETICAL && r.status !== KF.STATUS.QUALITATIVE) { console.log(`${k.id} wave ${i + 1}: ${r.status} ${r.reason || ''}`); bad++; }
    for (const [f, v] of Object.entries(inputs)) add('kpis', k.id, k.name, `${i}.${f}`, v);
  });
}

const out = path.join(root, 'Dataset', 'Dummy-dataset.csv');
writeFileSync(out, rows.join('\r\n') + '\r\n');
console.log(`${rows.length - 1} [DUMMY] rows written to ${path.relative(root, out)}${bad ? `; ${bad} PROBLEM(S) above` : '; all KPI inputs pass the KPI rules'}`);
if (bad) process.exitCode = 1;
