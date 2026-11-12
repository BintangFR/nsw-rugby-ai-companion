# Tackle AI

AI companion for finding the impact of NSW Rugby's **$10M Rugby World Cup Legacy Program**. Every impact figure traces back to Legacy money or to people reached by Legacy-funded work, across three kinds of impact: **economic**, **social** and **cultural**. Rugby-wide numbers are labelled as context, and other programs' results (such as Rugby For Good) are not measured.

## Running with an empty Dataset folder

Partner data is not committed, so `Dataset/` may be empty. Everything still runs: the built-in program data loads, and the parts that need partner files say what to upload. Upload these in **Data Studio** (they are kept in your browser, so they survive a reload):

- Rugby Analytics association exports: *Hierarchy Churn*, *Hierarchy Metrics*, *Heritage*, *Key Stats by Age Group* (zone view)
- NSW Rugby's club list (*List of all NSW RU Clubs.xlsx*) (zone view)
- AusPlay NSW data tables from the Clearinghouse for Sport (independent baseline)
- Participation dashboard data and any grant or survey files (map, baselines, impact)

Demo view's made-up data lives in `demo/Dummy-dataset.csv`, not in `Dataset/`.

## Quick start

1. Install [Node.js](https://nodejs.org) 18+ and [Ollama](https://ollama.com), then run `ollama pull qwen2.5:7b` once.
2. Start the app:
   - **Windows:** double-click **`boot.cmd`**
   - **Mac / Linux:** run `./boot.sh` (first time: `chmod +x boot.sh`)
3. The browser opens at http://localhost:5173 on the Dashboard. Switch on **Demo view** in the top bar to see every page filled with tagged sample data.

Closing the window (or `Ctrl+C`) stops the app and the Ollama it started. More detail is in [Run it locally](#run-it-locally).

**New to the project?** Read [docs/HANDOVER.md](docs/HANDOVER.md) first, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/MAINTAINING.md](docs/MAINTAINING.md). Run `npm run check` before every deploy.

## Features

| Page | What it does |
|---|---|
| **Dashboard** | One page with three parts. **Map:** NSW map of known Legacy spend by region, beside **Recommendations** that link what happened, the likely cause and what we can do ("Since X, we can Y"). **Round 2:** for each rugby zone, Round 1 Legacy money, money per participant, participation trend, churn, players per coach and First Nations, Pasifika and female shares, with notes on what stands out (no combined score; zone mapping in `Dataset/round2-zones.csv`, provisional). **Impact of the $10M:** the funding traced so far, what it has delivered (economic contribution per $1, health value of people reached, event spending, First Nations and Pasifika investment), results by facility and region (people reached, dollar value, happiness index), measures by impact type, the 27 KPIs, value calculators, and evidence with **What the public is saying** on the Impact summary (public news, plus Reddit and Bluesky posts, about Legacy-funded towns: each linked to the club, town or region it names, tagged for themes such as event-day business and rugby tourism or merchandise, grouped into economic, social and cultural; **Deep search with AI** has your Ollama model plan extra searches, review each story and summarise each impact, for staff to check) and a **Match-day check** (upload a daily file such as a Google Trends download or council spending data, enter match dates, and compare match days with the same weekday). **Insights:** five AI agents post findings into a review queue, with a rule engine when the AI is offline, and a box for follow-up questions. |
| **Data Studio** | **Files:** upload Excel, CSV, JSON, PDF, Word or text. Region + amount columns become spend, other numeric region columns become map layers, and a `lens`/`impact` column becomes evidence. Each file gets a data quality rating. **History:** a GitHub-style log of every data change, what it affects, and a Revert button, plus whether the AI insights are older than the data. **Reset** clears changes for the next demo, with backup and restore. |
| **Story** | Impact reports built from nine 16:9 page templates plus a one-page media release, in NSW Rugby navy and red. Choose a **report type** (Board Summary with an expenditure page and regional reach, Funding Acquittal, Annual Report Chapter, Community Story, Media Release) and a **scope** (whole program, pillar, region or deliverable). Every figure comes from the app's data and missing data shows as "NO DATA". Text is editable on the page, and **Export PDF** prints one page per template. |
| **Framework** | The project deliverable: the impact measurement framework as a tool-independent specification (principles, input contract, result statuses, all 27 KPIs, valuation methods, plan targets, data governance, every formula we adapted or created with its reason and research, and a build guide), with a step-by-step guide and downloads. **How the app works** explains how every figure is calculated and how the AI writes and checks its findings. |

### One detailed view

Every screen shows the real figures and every column. There is no simplified view: at the feedback session NSW Rugby preferred seeing the detailed figures. Hover any underlined number, column heading or status for how it is calculated.

### Look and feel

- **Theme:** a Power BI-style report workspace in NSW Rugby colours: a navy header with a red stripe, a "Pages" pane on the left, a light-grey canvas with white tiles, and high-contrast text. Light mode is the default; the ☾ / ☀ switch in the top bar changes to dark mode. On narrow screens the Pages pane becomes a scrolling strip under the header.
- **Mascot:** "Tackle", a rugby ball in a scrum cap and footy boots. It welcomes people in the demo, cheers at the end, and appears on empty screens and in the footer.
- **Print and PDF:** decorations never appear in print or PDF exports.

### Demo view

Switch on **Demo view** in the top bar (or open `?demoview=on`) to fill everything not recorded or measured yet with made-up figures from `demo/Dummy-dataset.csv`, so every page shows working data. Every such figure is tagged `[DUMMY]`, each report page says so, and the AI is told. Nothing is saved while it is on, and with it off only real data appears. Regenerate the file with `node scripts/make-dummy-data.mjs`.

### Prototype data

The files in `Dataset/` are treated as **already uploaded**. They load into Data Studio automatically, feed the dashboard (rows already in the built-in data are skipped, so nothing is double counted) and get quality-rated. Currently only `RWC_Legacy_Data_Compilation.xlsx` is row-level with regions. The dashboard workbook and the PDFs/Word documents are flagged red as too high level.

## Run it locally

You need [Node.js](https://nodejs.org) 18+ (no `npm install` required) and [Ollama](https://ollama.com).

### Windows

```powershell
winget install OpenJS.NodeJS.LTS     # once, if Node isn't installed
ollama pull qwen2.5:7b               # once
.\boot.cmd                           # or double-click it; or: node server.js
```

`boot.cmd` starts Ollama if it isn't already running, starts the server and opens the browser. Everything it started is stopped when its window closes, however it closes. An Ollama you started yourself is left running. Without Node it falls back to `serve.ps1`.

### macOS

1. **Install Node.js** (once). Use either:
   - [Homebrew](https://brew.sh): `brew install node`
   - or the macOS installer (`.pkg`, LTS) from [nodejs.org](https://nodejs.org)

   Check it with `node -v` (it should show v18 or later).
2. **Install Ollama** (once). Download the Mac app from [ollama.com/download](https://ollama.com/download), move it to Applications and open it. A llama icon appears in the menu bar. With Homebrew you can run `brew install ollama` and then `ollama serve` instead.
3. **Download the AI model** (once, ~4.7 GB):

   ```bash
   ollama pull qwen2.5:7b
   ```
4. **Start the site.** In Terminal, go to the project folder and start it:

   ```bash
   cd ~/Downloads/Project/nsw-rugby-ai-companion   # wherever you saved the project
   ./boot.sh                                        # or: node server.js
   ```
5. **Open** http://localhost:5173 in Safari or Chrome. Leave Terminal open while you use the site, and press `Ctrl + C` in Terminal to stop it.

Mac tips:
- **Port already in use?** Run `PORT=5174 node server.js` and open http://localhost:5174.
- **Apple Silicon (M1–M4)** runs Ollama on the GPU, so it is much faster than a CPU-only laptop. With 16 GB+ memory, `gemma3:12b` is a good upgrade for the Story tab (see [Choosing a model](#choosing-a-model)).
- **"node: command not found"** after installing: close and reopen Terminal. With Homebrew on Apple Silicon, also check that `/opt/homebrew/bin` is on your `PATH` (`brew doctor` will tell you).
- `serve.ps1` is Windows-only. On a Mac, always use `node server.js`.

### How it works

`server.js` serves the site and the API. It calls Ollama from the server side, so there are no browser CORS problems, and it saves shared state (evidence, ratings, insights, story drafts, quality ratings) to `data-store/`.

To change settings, copy `.env.example` to `.env.local`.

**Without Node:** `powershell -ExecutionPolicy Bypass -File serve.ps1` still works. The browser then talks to Ollama directly and saves to its own local storage.

**"Ollama: offline"?** Check that Ollama is running (the llama icon in the system tray, or `ollama serve`) and that `ollama list` shows a model. Also make sure the page is open at http://localhost:5173 while `node server.js` is running.

## Deploy to Vercel

The `api/` folder holds Vercel serverless functions; the static site deploys from the project root. `vercel.json` is already set up.

1. Push to GitHub and import the repo in Vercel (framework preset: **Other**), or run `npx vercel`.
2. Vercel can't reach the Ollama on your laptop. In **Settings → Environment Variables**, set up one of these:
   - **Ollama Cloud:** `OLLAMA_URL=https://ollama.com`, `OLLAMA_API_KEY=…`, `OLLAMA_MODEL=…`
   - **Any OpenAI-compatible API** (Groq, OpenRouter, Together, OpenAI): `LLM_PROVIDER=openai`, `LLM_BASE_URL=…`, `LLM_MODEL=…`, `LLM_API_KEY=…`
3. **Storage:** add **Upstash Redis** from the Vercel Marketplace (it sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`). Without it, saved data resets whenever the function restarts.
4. **Access:** set `APP_ACCESS_KEY`. The browser asks for it once, and the API rejects requests without it.

⚠️ The `Dataset/` folder is deployed as static files so the prototype can preload it. Anyone with the URL can download them, and `APP_ACCESS_KEY` does not protect them. Turn on Vercel **Deployment Protection** or remove `Dataset/` before sharing a public link.

## Choosing a model

| Model | Size | Use |
|---|---|---|
| `qwen2.5:7b` | ~4.7 GB | **Default.** Reliable JSON for the agents and fast enough on a CPU-only laptop. Expect some mixed-up figures, so use 👎 to flag them. |
| `gemma3:12b` | ~8 GB | More accurate and better writing for the Story tab. About half the speed. |
| `llama3.2:3b` | ~2 GB | Fast drafts and testing. Weaker reasoning. |

Switch models from the AI pill in the top bar.

**Speed on a laptop without a graphics card:** the AI reads about 30 tokens a second, and every question starts with about 4,000 tokens of program data, so reading that from scratch takes 2–3 minutes. To hide this, the app **pre-reads** the data in the background when you open the Insights tab or click into the question box. Ollama keeps it in memory for 30 minutes, so questions then answer in about 10–30 seconds. The agents and the Story generator start with the same data, so they speed up too. For faster answers overall, use `llama3.2:3b`, or run Ollama on a computer with a graphics card.

## Data notes

- Seed data in [js/data.js](js/data.js) was compiled from `Dataset/RWC_Legacy_Data_Compilation.xlsx` and `Dataset/RWC Dashboard 010926 (2).xlsx`.
- Spend is **known allocations** (3-year dashboard budgets plus Round 1 grants), not audited expenditure.
- Region **population** and **First Nations share** are indicative ABS 2021 approximations, used only to normalise spend.
- "Spend vs population" = a region's share of spend ÷ its share of population. 1.75x or more is flagged as overspend risk; 0.5x or less as under-served.
- Impact is never estimated from spend. Every impact measure and valuation cites the organisation that published the method; new formulas are left to the evaluation team.
- Uploaded yearly counts (e.g. the Rugby Analytics participation export) feed the recommendations, the reports and the AI. They cover all NSW rugby, so they are context and not Legacy impact.
- Hover any underlined number, table header or status for how it is calculated.
- The 27 KPIs follow the evaluation team's KPI Formula Web Handover exactly, including its input contract: every result is labelled Verified, Estimated or Hypothetical, missing data is never zero, inactive KPIs never show a value, and KPIs are never added together. They are descriptive monitoring indicators, not net economic benefit. Planned budgets and commitments (e.g. Holroyd's $561k project cost) are shown as "indicative only" and never counted as KPI results.

## Files

```
index.html            app shell
css/styles.css        app styles (the final "Power BI layer" at the end sets the current look: NSW Rugby navy/red, light default, dark variant)
css/report-pages.css  impact report page templates (Story tab; 16:9 pages for print / PDF)
js/store.js           persistence (backend API or browser storage)
js/data.js            seed data and impact framework
js/nsw-boundary.js    NSW outline for the map
js/analytics.js       region metrics, centralisation, impact, rule-based insights
js/ollama.js          AI client and agents
js/app.js             overview, map, heatmap, insights
js/feedback.js        👍/👎 ratings, deletion reasons, data-quality advice
js/impact.js          Impact: measures by impact type and the evidence log
js/kpi-framework.js   NSW Rugby KPI Framework engine: the 27 KPIs from the evaluation team's handover
js/kpis.js            KPI Framework screen (data entry, results, CSV)
js/framework.js       Framework tab: tool-independent specification (HTML / JSON / CSV downloads)
js/methods.js         impact valuation calculators (published formulas) and the "How the app works" page (inside the Framework tab)
js/programs.js        every Legacy grant and budget line with its recorded results (data only, no page)
js/activity.js        Impact: people reached, dollar value and happiness index by facility and region
js/signals.js         Impact > Evidence: public news about Legacy-funded places
js/history.js         Data Studio > History: log of every data change, revert, AI refresh
api/signals.js        public news search behind Public signals
js/recommendations.js Dashboard: what happened, likely cause, what we can do
js/demo-view.js       Demo view: fills gaps from demo/Dummy-dataset.csv, tagged [DUMMY]
js/reset.js           Data Studio > Reset, with backup and restore
js/upload.js          Data Studio, dashboard integration, quality rating
js/story.js           story generator and PDF export
api/                  backend (Vercel functions; also used by server.js)
server.js             local server
serve.ps1             fallback static server (no Node)
boot.cmd / boot.ps1   one-click start on Windows (stops everything on close)
boot.sh               one-click start on macOS / Linux
scripts/check.mjs     pre-deploy check: syntax, file references, seed data (npm run check)
docs/                 handover, architecture and maintenance guides
.github/workflows/    runs npm run check on every push
Dataset/              source documents and spreadsheets (preloaded as "already uploaded")
```
