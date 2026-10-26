# Maintaining Tackle AI

Recipes for the changes you are most likely to make. Background on how the parts fit is in [ARCHITECTURE.md](ARCHITECTURE.md).

**Golden rule:** after any change, run `npm run check` and open the app to look at the screen you touched. The same check runs automatically on GitHub for every push.

## Everyday tasks

### Update grants or budgets (new funding round, corrected amounts)

1. Edit [js/data.js](../js/data.js): add `g(...)` lines to `grants` or `d(...)` lines to `dashboard`. The comments above each list explain every field.
2. `region` must be one of the names in `regions`, or `"Statewide"` for money held centrally.
3. `pillar` is `FE`, `PW`, `INC`, `ACT` (activation/events) or `PM` (program management). `tags` are `women`, `firstNations`, `pasifika`, `access`.
4. Run `npm run check`. It catches unknown regions, pillars and tags.

No-code alternative: upload a spreadsheet with region and amount columns in **Data Studio**; it feeds the dashboard straight away.

### Change or add a plan target

Edit the `kpis` list in `js/data.js` (ids must be unique). Staff can also change targets and target years in the app (**Targets → Adjust targets**) without touching code.

### Update an impact measure (social / economic / cultural)

**Rule: impact is measured only with methods another organisation has published.** Tackle AI does not invent impact formulas; new formulas come from the evaluation team.

- Measures live in `impactMethods` in [js/data.js](../js/data.js). Each one names its `framework` (a key of `frameworks`), `how` it is measured (the framework's own method), `status` (`measured`, `partial`, `none`), `value` and `source`. All of these appear on hover and on the Methodology tab.
- To add a framework, add it to `frameworks` with its organisation, title, year, a `url` or a `Dataset/` `file`, and what it is used for. `npm run check` fails if a measure cites an unknown framework or a framework file is missing.
- There is deliberately no "dollars per impact type" figure: no published method assigns program spend to impact.

### Add an impact valuation calculator

Calculators live in `CALCS` in [js/methods.js](../js/methods.js). Only add one when the formula and its parameters are published (cite them in `frameworks` and in the calculator's `formula`, `caveat` and result workings). Each calculator's `run()` returns result rows with their workings, which become the hover explanations, and a `missing` message when inputs are absent (never treat missing as zero).

### Add a yearly measure that updates Targets

Uploaded files are scanned for yearly counts (players, coaches, match officials, female / First Nations / Pasifika participants). The patterns are in `MEASURES` in [js/analytics.js](../js/analytics.js); the layouts the scanner understands are in `extractMeasures()` in [js/upload.js](../js/upload.js). Link a target to a measure with `measure: '<id>'` in `kpis`. With two consecutive years from one file, the target's actual becomes that file's latest year ÷ previous year − 1.

### Edit the Presentation or Demo script

Both are in [js/demo.js](../js/demo.js): `STEPS` (self-paced demo) and `PRESENT` (15-minute presentation). Each presentation slide has `secs`; keep the total at 900 (15:00). `body` is what the audience sees, `notes` is the presenter's script.

### Add or change an economic KPI

Add an entry to `KPIS` in [js/econ.js](../js/econ.js): `inputs`, a `calc` that returns `ok(value)` / `missing()` / `na()` / `nc()` / `bad()`, a formatter and source ids from `SOURCES`. The UI, CSV export, AI context and hover explanation are generated from that entry.

### Add a region

Add it to `regions` (with coordinates, indicative population and First Nations share) and to `aliases` (names that uploaded files might use) in `js/data.js`. `npm run check` fails if either is missing.

### Change an AI agent or add one

Agents live in `AGENTS` in [js/ollama.js](../js/ollama.js). Each has an `id`, `name`, `pillar` and a plain-English `brief`. The shared output rules (JSON shape, "never invent numbers", "First Nations" wording) are in `runAgent()`; change them there so all agents stay consistent. If the AI needs new figures, add them to `Analytics.briefing()`.

### Switch AI model or provider

Configuration only. Copy [.env.example](../.env.example) to `.env.local` (local) or set the variables in Vercel. No code change needed.

### Add a new tab

1. Add a `<button role="tab" data-tab="x">` and a `<section id="tab-x" class="tab-panel">` in `index.html`.
2. Create `js/x.js` as an IIFE that renders on `app-ready` and re-renders on `data-changed`.
3. Add its `<script>` tag after `app.js` in `index.html`.
4. If it saves anything, add a collection to `js/store.js` and `api/_lib/store.js`.

### Add a hover explanation to a number

Add `data-tip="..."` (built with `esc()`) and `tabindex="0"` to the element. Use `\n` for line breaks. The tooltip in `app.js` handles positioning, keyboard focus and dark mode.

## Conventions

- **Style:** 2-space indent, single quotes, semicolons, small pure functions; match the surrounding code. `.editorconfig` sets the basics.
- **Escape everything** inserted into HTML with `esc()`. AI-written Markdown goes through `md()` (DOMPurify).
- **Don't store derived numbers.** Store inputs; compute in `Analytics`.
- **Wording:** "First Nations" in UI and AI text (data matching still accepts Aboriginal / Indigenous). Write for a non-technical reader.
- **New libraries:** load from cdnjs with an exact version, as in `index.html`. Avoid adding a build step unless the project outgrows it (see below).

## Before you deploy

1. `npm run check` passes.
2. Start the app (`boot.cmd` / `./boot.sh` / `npm start`) and click through Overview, Impact and Story. The browser console should show no red errors.
3. Run **▶ Demo** end to end; it exercises most features without changing saved data.
4. Push to GitHub. Vercel deploys automatically if the repo is connected.

## Backups and data

- Local saved data lives in `data-store/` (ignored by git). Copy that folder to back it up.
- On Vercel, data lives in Upstash Redis; use Upstash's backup / export.
- Evidence and economic KPIs can also be exported to CSV from the Impact tab.

## When the project grows

The current design suits a prototype or a small team. These are the steps to take, in order, when it needs to scale:

| Trigger | Change |
|---|---|
| Several people editing at the same time | Collections are saved whole (last write wins). Move to per-record storage, e.g. Postgres or Supabase with one row per evidence record / rating, and replace `/api/store` with per-record endpoints. |
| Seed data changes often or is owned by non-developers | Move `js/data.js` content into a database or a maintained spreadsheet loaded at start-up; keep `npm run check`'s validations as import validation. |
| Need named users or roles | Replace the shared `APP_ACCESS_KEY` with real sign-in (e.g. Microsoft Entra / Google SSO via Vercel or Auth.js) and record who made each change. |
| Codebase passes ~10k lines or more developers join | Convert scripts to ES modules with a bundler (Vite) and add TypeScript gradually; add Playwright tests for the demo path. |
| Public link or sensitive data | Turn on Vercel Deployment Protection, remove `Dataset/` from the deployment, and review privacy of evidence records. |
| Hosted AI costs or latency | Cache `Analytics.briefing()` per data version, and use a larger hosted model only for the Story tab. |
