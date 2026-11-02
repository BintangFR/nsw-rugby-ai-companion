# Tackle AI

AI companion for NSW Rugby Union's Rugby World Cup Legacy Program. It brings the program data together and gives insight on three pillars:

1. **Facilities & Equipment**
2. **Programs & Workforce**
3. **Inclusion** (women & girls, First Nations, Pasifika/CALD, people with disability)

It measures impact through three lenses: **social**, **economic** and **cultural**.

## Quick start

1. Install [Node.js](https://nodejs.org) 18+ and [Ollama](https://ollama.com), then run `ollama pull qwen2.5:7b` once.
2. Start the app:
   - **Windows:** double-click **`boot.cmd`**
   - **Mac / Linux:** run `./boot.sh` (first time: `chmod +x boot.sh`)
3. The browser opens at http://localhost:5173. Open **▶ Tour** in the top bar and choose **Guided demo**.

Closing the window (or `Ctrl+C`) stops the app and the Ollama it started. More detail is in [Run it locally](#run-it-locally).

**New to the project?** Read [docs/HANDOVER.md](docs/HANDOVER.md) first, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/MAINTAINING.md](docs/MAINTAINING.md). Run `npm run check` before every deploy.

## Features

| Tab | What it does |
|---|---|
| **Overview** | NSW-only map with a heatmap of spend by region. You can switch the metric: total, facilities, workforce, inclusion, $ per resident, over/under-spend, inclusion index, or social/economic/cultural impact. Also includes a region heatmap table, a centralisation check, over/under-served flags (one scrollable row per region, split into To review / Rated, with 👍/👎 rating), and spend by pillar. |
| **Programs** | Zero in on any single grant or 3-year budget line (62 in total, plus uploads). Search, filter by pillar, source or region, and sort by cost, return or flags. Each program shows **what it costs** (budget, yearly split, share of its pillar, spent so far), **what it returns** (cost per person reached, per new coach or referee, per session, and co-funding per $1, each compared with the median of similar programs), **what it contributes to** (linked targets and impact lenses), and **what's driving this?**, a root-cause list that covers cost outliers against similar programs, budget overruns, the region's fair-share status, centrally held money that can't be traced, targets that are behind, and missing results or evidence. Staff record results and evidence per program, and **Explain with AI** gives a short value-for-money and root-cause summary. Results are never estimated: no results recorded means "can't judge yet". |
| **Targets** | 39 plan targets across all five pillars from the project brief (1 Facilities & Equipment, 2 Priority Regions & Pathways, 3 Programs & Workforce, 4 Inclusion, 5 RWC Activation), taken from the Project Plan, RWC Dashboard performance measures, Program Logic and partner slides. Pillars flow through balanced columns; Inclusion is split by community (women & girls, First Nations, Pasifika, people with disability, Pride, integrity & safeguarding). Ratio and churn targets can go down as well as up. Plan aims with no number set yet sit in a collapsed watch list (they reappear under "Adjust targets" so staff can set one). Each target is judged Ahead / Close / Behind against the pace needed to hit it by its target year, with a status summary and a pillar filter at the top. **Adjust targets** lets staff change any target or target year, and the status recalculates. |
| **Impact** | Social / Economic / Cultural impact measured **only with published methods** (NSW Treasury TPG22-22 and TPG23-08, OECD social cohesion with ABS General Social Survey benchmarks, the Rugby For Good Benefits Realisation Framework and cost-benefit analysis, NSW Rugby League's 2026 community impact study, Cultural Development Network outcomes, eventIMPACTS, Rugby Australia participation definitions). Each lens shows which of its established measures have data; **impact valuation calculators** apply the published formulas (health benefit per participant, DALYs × VSLY, economic contribution, event visitor spending, social capital vs ABS benchmarks, CDN cultural outcomes) with present values under TPG23-08. Also an **evidence log** for field notes (e.g. "women feel safe with the new changerooms", "takeaway shop busy on game days", "Pasifika families gather at the ground"). Also has an Impact agent, plus the **Economic KPIs** calculator: the nine formulas from `Dataset/NSW_Rugby_Economic_KPI_Formula_Summary.xlsx` (facility utilisation, realised co-investment, cost recovery, workforce retention, training cost per qualification, volunteer hours, inclusion cost per participant, out-of-pocket cost change, participation support). Enter baseline and follow-up totals and each KPI is calculated with its documented formula, edge-case rules and official source links, then fed to the AI agents and Story. Missing data shows as "Data collection required", never as zero. |
| **Insights** | Five local AI agents (Facilities, Workforce, Inclusion, Centralisation, Impact) post insight bubbles into a review queue: **To review / Verified / Disputed / Archived**. Rating an insight moves it out of To review, and disputed ones are kept out of the Story report. Re-running the agents archives the previous run's unrated insights (rated ones are kept, and archived ones can be restored), and new insights that repeat a kept one are hidden. Rate each one 👍/👎, delete it (a reason is required first) and ask follow-up questions. A rule engine fills in when the AI is offline. **Live progress** shows each agent's phase (loading model → reading data → writing, with token count and insight number), overall %, elapsed time and an ETA learned from your machine's speed, the model's live output, a "may be stuck" warning, and a Cancel button. |
| **Data Studio** | Upload any file (Excel, CSV, JSON, PDF, Word, text). Tables are profiled, formatted and charted. **Uploads update the dashboard**: region + amount columns become spend, other numeric region columns become map layers, and a `lens`/`impact` column becomes impact evidence. Every file gets a **data quality rating** (green / amber / red). Red means "too high level", and the AI explains what better data would look like. A data-quality panel tracks disputes and deletions and gives advice for collecting accurate data next time. |
| **Framework** | The project deliverable: the whole impact measurement framework as a tool-independent specification (structure, principles, input contract, result statuses, all 27 KPIs with formulas, inputs, rules, survey wording, baselines and sources, valuation methods, targets, data governance, and a build guide). Download it as a standalone document, `framework.json` or `input-fields.csv` to rebuild it in a spreadsheet, survey platform, BI tool or another app. Generated from the same definitions the app calculates with. |
| **Methodology** | Plain-language explanation, generated from the live app, of how every figure is calculated, how the AI writes and checks its insights (including the exact briefing it reads), the impact methods and their sources, how Targets are judged, and which screening indicators are prototypes awaiting review. |
| **Story** | Impact reports built from nine 16:9 page templates (cover, investment drives impact, pillar overview, pillar chapter, outcome data, region / deliverable, estimated value, impact recap, formula appendix) plus a one-page media release, in NSW Rugby navy and red. Choose a **report type** and the pages assemble themselves: Board Summary (3 pages), Funding Acquittal (6, with sign-off), Annual Report Chapter (8+, one chapter per pillar), Community Story (3) or Media Release (1). Choose a **scope**: whole program, one pillar, one region or one deliverable. Every figure comes from the app's data and missing data shows as "NO DATA"; the AI can rewrite the narrative sentences. All text is editable on the page, photos are added by clicking a photo slot, and **Export PDF** prints one 16:9 page per template page. Design: [css/report-pages.css](css/report-pages.css). |

### One detailed view

Every screen shows the real figures and every column. There is no simplified view: at the feedback session NSW Rugby preferred seeing the detailed figures. Hover any underlined number, column heading or status for how it is calculated.

### Look and feel

- **Theme:** a blocky cyan "Pip-Boy" terminal, with square panels, a pixel font for headings and numbers, and segmented progress bars. The ☾ / ☀ switch in the top bar changes between dark and light mode. Light mode is a clean, glow-free version that suits projectors and printing.
- **Screen effects** (in the ▶ Tour menu): turns the soft phosphor glow and screen-edge vignette on or off. There are no scanlines, flicker or animated transitions.
- **Mascot:** "Tackle", a rugby ball in a scrum cap and footy boots. It welcomes people in the demo, cheers at the end, and appears on empty screens and in the footer.
- **Print and PDF:** decorations never appear in print or PDF exports.

### Demo mode (guided tour and pitching)

Choose **▶ Tour → Guided demo** in the top bar, or open http://localhost:5173/?demo to start straight into the tour. It walks through every feature in 20 steps. Each step opens the right tab, highlights the feature and explains it in plain, non-technical language with a "Why it matters" line, so it works as a pitch to board members, funders or community partners.

- **Controls:** `→` / `Enter` next, `←` back, `Esc` exit. Click the progress dots to jump to a step.
- **Live features:** some steps run the feature for real (KPIs calculated from sample inputs labelled "Hypothetical Example", a sample evidence record, rule-based insights). Everything is labelled `DEMO SAMPLE`.
- **Safe to run anytime:** demo mode turns saving off, and exiting reloads the page, so no sample data reaches your real records.
- **Presentation mode (▶ Tour → 15-minute presentation, or `?present`):** a 15-minute talk with 17 timed slides (pain points, walkthrough, how feedback changed the prototype, recommendations, next session: testing and handover). The card shows the total clock against 15:00, time on the current slide, and whether you are on pace, tight or behind. Speaker notes open with `N`; `P` pauses the clock.
- **For a pitch:** use full-screen (`F11` on Windows, `Ctrl + Cmd + F` on Mac). The AI steps work without Ollama because the rule engine fills in.

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
- Uploaded yearly counts (e.g. the Rugby Analytics participation export) update Targets: with two consecutive years from one file, the actual becomes latest year ÷ previous year − 1, and the target is marked "from upload".
- Hover any underlined number, table header or status for how it is calculated.
- The 27 KPIs follow the evaluation team's KPI Formula Web Handover exactly, including its input contract: every result is labelled Verified, Estimated or Hypothetical, missing data is never zero, inactive KPIs never show a value, and KPIs are never added together. They are descriptive monitoring indicators, not net economic benefit. Planned budgets and commitments (e.g. Holroyd's $561k project cost) are shown as "indicative only" and never counted as KPI results.

## Files

```
index.html            app shell
css/styles.css        app styles (cyan phosphor "Pip-Boy" terminal theme, light variant)
css/report-pages.css  impact report page templates (Story tab; 16:9 pages for print / PDF)
css/reportstyle.css   earlier A4 report stylesheet (no longer linked; kept for reference)
js/store.js           persistence (backend API or browser storage)
js/data.js            seed data and impact framework
js/nsw-boundary.js    NSW outline for the map
js/analytics.js       region metrics, centralisation, impact, rule-based insights
js/ollama.js          AI client and agents
js/app.js             overview, map, heatmap, insights
js/feedback.js        👍/👎 ratings, deletion reasons, data-quality advice
js/impact.js          Impact tab and evidence log
js/kpi-framework.js   NSW Rugby KPI Framework engine: the 27 KPIs from the evaluation team's handover
js/kpis.js            KPI Framework screen on the Impact tab (data entry, results, CSV)
js/framework.js       Framework tab: tool-independent specification (HTML / JSON / CSV downloads)
js/methods.js         impact valuation calculators (published formulas) and the "How the app works" page (inside the Framework tab)
js/programs.js        Programs tab: per-program cost, return, root-cause drill-down
js/upload.js          Data Studio, dashboard integration, quality rating
js/story.js           story generator and PDF export
js/demo.js            demo mode: guided tour / pitch walkthrough
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
