# Architecture

How Tackle AI fits together. Read this before changing code; read [MAINTAINING.md](MAINTAINING.md) for step-by-step recipes.

## The big picture

```
 Browser (index.html + js/*.js, no build step)
   │   reads/writes app state ──► /api/store ──► data-store/*.json (local)  or  Upstash Redis (Vercel)
   │   asks the AI ─────────────► /api/chat  ──► Ollama (local / Ollama Cloud)  or  any OpenAI-compatible API
   │
   └─ if no backend is running (serve.ps1 / static hosting): state goes to localStorage,
      and the browser calls Ollama on http://localhost:11434 directly.
```

- **Frontend:** plain HTML, CSS and JavaScript. No framework, no bundler, no `npm install`. Third-party libraries (Leaflet, Chart.js, SheetJS, marked, DOMPurify, html2pdf) load from CDNs with pinned versions in [index.html](../index.html).
- **Backend:** the files in [api/](../api) are small Node handlers. On Vercel each one is a serverless function; locally [server.js](../server.js) serves the site and routes `/api/<name>` to `api/<name>.js`, so the same code runs in both places.
- **AI:** all model calls go through [api/_lib/llm.js](../api/_lib/llm.js), which normalises Ollama and OpenAI-compatible APIs to one response shape. Changing provider is configuration only (see [.env.example](../.env.example)).

## Frontend modules

Scripts are plain `<script>` tags loaded **in order** (the order in `index.html` matters). Each file is an IIFE that publishes one global.

| File | Global | Responsibility |
|---|---|---|
| `js/datafiles.js` | `DataFiles` | Partner data files (Rugby Analytics exports, club list, AusPlay tables) are **not committed**: a module asks for a file by name pattern and gets the newest upload from Data Studio (kept in this browser's IndexedDB) or, if present, the file in `Dataset/`. Fires `datafile-added` on upload. The tool runs with an empty `Dataset/` folder. |
| `js/store.js` | `Store` | Persistence. Picks server or localStorage at start-up; synchronous reads from a cache, debounced background writes. Demo sandbox mode. |
| `js/data.js` | `TACKLE_DATA` | **Seed data**: regions, region aliases, Round 1 grants, 3-year dashboard budgets, targets, impact framework. Pure data, no logic. |
| `js/analytics.js` | `Analytics` | All calculations: region metrics, centralisation, pillar totals, impact lens totals, target status, rule-based insights, the data briefing sent to the AI. |
| `js/ollama.js` | `Ollama` | AI client (via `/api/chat` or direct to Ollama), the five agents, prompt text, fact-checking of AI output. |
| `js/app.js` | `App` | App shell: pages, theme, Dashboard headline and map, Insights queue, hover tooltips (`data-tip`). Shared helpers (`$`, `esc`, `money`, `toast`…). |
| `js/feedback.js` | `Feedback` | 👍/👎 ratings, deletion reasons, "lessons" fed back into AI prompts, data-quality advice. |
| `js/upload.js` | — | Data Studio: file parsing, structure detection, quality rating, turning uploads into spend / map layers / evidence. Preloads `Dataset/`. |
| `js/impact.js` | `Impact` | Impact: measures by impact type and the evidence log. |
| `js/kpi-framework.js` | `KPIF` | **NSW Rugby KPI Framework engine**: the 27 KPIs from `Dataset/NSW_Rugby_KPI_Formula_Web_Handover.xlsx` (definitions, inputs, formulas, missing/zero rules, baselines, sources) and the status rules of the handover's input contract. Pure code with no page access, so `npm run check` tests it. |
| `js/kpis.js` | `KPIs` | Screen for the 27 KPIs: data entry per wave, results with workings, CSV export, AI context. |
| `js/framework.js` | `Framework` | Framework tab: the framework as eight reproducible steps (money, map, people reached, three impacts, KPIs, evidence, Round 2, recommend and report), each with the data needed, the formula, where the app shows it and a check; plus a formula sheet, data template and sources. The KPI specification is Appendix A. Downloads: HTML, JSON, Legacy lines template CSV, KPI input fields CSV. Printed from the same definitions the app calculates with. |
| `js/methods.js` | `Methods` | Impact valuation calculators (published formulas only) and the "How the app works" page (inside the Framework tab), generated from the live app. |
| `js/programs.js` | `Programs` | Data only: every Legacy grant and budget line with its recorded results, used by the Dashboard, Story and AI. |
| `js/story.js` | `Story` | Impact reports: nine page templates combined per report type (Board Summary, Funding Acquittal, Annual Report Chapter, Community Story, Media Release) and scope, filled from live data, with optional AI narrative, on-page editing, photos and 16:9 PDF export (styles: `css/report-pages.css`). |
| `js/history.js` | `DataHistory` | Data Studio > History. Wraps `Store.set` for the data collections, records a commit per change (what changed, which pages it affects, an undo patch), reverts single commits, tracks whether AI insights are older than the data and can refresh them after each change. Loaded right after `store.js`. |
| `js/reset.js` | `Reset` | Data Studio > Reset: resets chosen groups of collections to their defaults (`Store.defaults()`), clears remembered screen choices, waits for every save, reloads. Also downloads and restores full JSON backups. |
| `js/round2.js` | `Round2` | Dashboard > Zone view: Legacy money by rugby zone against participation, churn, coaches and inclusion shares. Zones, associations and clubs come from NSW Rugby's club list (`Dataset/List of all NSW RU Clubs.xlsx`); grants are placed by club name, then town, then `Dataset/round2-zones.csv` (Southern Inland under ACT & Southern NSW Rugby, region fallback). Round 2 is decided, so it supports checking that list and future funding. |
| `js/signals.js` | `Signals` | Impact > Summary, "What the public is saying" (inside the "What the $10M has delivered" card): calls `/api/signals`, links each story or post to the Legacy-funded club, town or region it names, tags themes (event-day business, rugby tourism or merchandise, funding reported), groups by impact type, and lets staff add stories to the evidence log. **Deep search** uses the team's Ollama model to plan up to 15 extra searches, review each story (relevant? impact type? one-line note) and summarise each impact; grant links stay rule-based and any number the model writes must appear in the stories. |
| `js/matchday.js` | `MatchDay` | Impact > Evidence: reads a daily CSV/Excel file (date + number column, e.g. Google Trends or council spending), compares match days with the same weekday and with all other days, adds the result to the evidence log. |
| `api/signals.js` | — | Searches Google News and Bing News RSS, plus public social media with keyless search (Reddit search feed, Bluesky public API; no usernames kept), and up to 20 extra searches written by the AI model (`extra`): statewide queries for each impact type, and each Legacy-funded town three times (general, economic words, cultural words, joined with OR), filters out other codes and match reports, sorts by impact type. Headlines and summaries only; 6-hour in-memory cache. |
| `js/activity.js` | `Activity` | Impact > Overview: people taking part, dollar value and happiness index (Sport England Active Lives life satisfaction) per facility and region, with "Survey needed" / "Activity data needed" flags. Flags stay on in the real view; Demo view fills the gaps.
| `js/demo-view.js` | `DemoView` | Top bar switch. Loads `demo/Dummy-dataset.csv` (made by `scripts/make-dummy-data.mjs`) over anything not recorded, using `Store.overlay` in the sandbox so nothing is saved. Real values win; every dummy value is tagged `[DUMMY]`. New inputs need a row in the generator. |
| `js/recommendations.js` | `Recommendations` | Insights: "Since X, we can Y", each linked to what happened, the likely cause and the page holding the figures. Calculated in code, so it works without the AI. | |
| `js/present.js` | `Present` | Top bar **▶ Present**: the 20-minute Final Pitch (CDEV6000 Assessment 2), styled on Team 1's Project Plan deck (images in `img/present/`). Follows the assessment headings, with the solution built around NSW Rugby's five deliverables. 31 timed slides add up to exactly 20:00, each with a default presenter (Xiao Yang: the story; Yinnan Hu: the framework; Bintang: the rest; about 6:40 each), plus reference list and appendix. Live figures only. `?present=N` opens at slide N. Keys: → ← P N Esc. |
| `js/nsw-boundary.js` | — | NSW outline polygon for the map. |

### How modules talk to each other

Modules communicate through **DOM events on `document`**, not direct calls, so a new module can listen without editing existing ones:

| Event | Fired by | Meaning |
|---|---|---|
| `app-ready` | app.js | Store loaded, shell ready. Modules do their first render here. |
| `data-changed` | upload.js, kpis.js, methods.js | Spend, uploads or KPI inputs changed: re-render anything derived from data. |
| `insights-changed` | app.js | The insight list changed. |
| `feedback-changed` | feedback.js | A rating or deletion was recorded. |
| `targets-changed` | app.js | A target was edited. |
| `tab` | app.js | A tab was opened (`e.detail` = tab id). |
| `ai-activity` | ollama.js | AI progress updates for the top-bar pill. |

## Data flow

1. **Seed data** (`js/data.js`) + **uploaded datasets** (Store `datasets`) → `Analytics.allGrants()` / `regionMetrics()`.
2. Every number on screen is computed from those by `Analytics` at render time. Nothing derived is stored, so fixing a formula fixes every screen.
3. **AI agents** receive `Analytics.briefing()`, a text summary of the same numbers, plus staff feedback lessons. AI output is fact-checked against the computed flags before it is shown.
4. When the AI is offline, `Analytics.ruleInsights()` produces equivalent rule-based insights.

## Stored state

`Store` collections (same names in localStorage as `tackle.<name>`, in `data-store/<name>.json`, and in Redis as `tackle:<name>`):

| Collection | Owner | Contents |
|---|---|---|
| `evidence` | impact.js / upload.js | Field evidence records (lens, region, source, text, metric, date). |
| `feedback` | feedback.js | Ratings and deletion reasons. |
| `datasets` | upload.js | Uploaded files: parsed rows, derived spend, layers, evidence. |
| `insights` | app.js | AI and rule insights, including archived ones. |
| `story` | story.js | Current story draft. |
| `quality` | upload.js | Data-quality ratings per dataset. |
| `kpis` | kpis.js | Waves (shared controls + inputs) and `comparison_approved` for each of the 27 KPIs. |
| `econ` | (legacy) | Inputs from the old 9-KPI calculator; read once and migrated into `kpis`. |
| `targets` | app.js | Staff edits to plan targets. |
| `programs` | programs.js | Recorded results per program (Demo view fills these from the dummy data set). |
| `wellbeing` | activity.js | People reached and survey results entered per facility or region. |
| `signals` | signals.js | Last public news search, and which items were added as evidence. |
| `methods` | methods.js | Inputs for the impact valuation calculators. |

Yearly measures found in uploads are stored inside each `datasets` entry as `measures`.

A new collection must be added in **both** `js/store.js` (`DEFAULTS`) and `api/_lib/store.js` (`COLLECTIONS`).

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Provider, model, reachability and storage backend. |
| `/api/models` | GET | Available models (Ollama `/api/tags` shape). |
| `/api/status` | GET | Which models are loaded (for "loading model" progress). |
| `/api/chat` | POST | Chat completion, optionally streamed as NDJSON. |
| `/api/store` | GET / PUT | Read all collections, or read/replace one (`?c=name`). |

If `APP_ACCESS_KEY` is set, every route requires the `x-app-key` header (the browser prompts once and remembers it).

## Design decisions worth keeping

- **Calculation is separate from interpretation.** Code calculates every figure; the AI only explains figures it is given; people check the AI. The "How the app works" page documents this for non-technical readers.
- **Impact methods are borrowed, never invented.** Every impact measure and valuation cites a published framework (`frameworks` in `js/data.js`).
- **Missing is never zero.** Absent data shows as "No data yet" / "Data collection required", never as 0.
- **Every number explains itself.** Key figures carry a `data-tip` tooltip saying how they were calculated. Keep this when adding numbers.
- **Plain language.** The audience is board members and funders: write in plain words, show the real figures (they asked for the detailed view, so there is no simplified mode), and say "First Nations" in UI and AI text.
- **Uploads never double count.** Rows already in the seed data are matched by amount and skipped.
