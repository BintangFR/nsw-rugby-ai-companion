# Tackle AI

AI companion for NSW Rugby Union's Rugby World Cup Legacy Program. It brings the program data together and gives insight on three pillars:

1. **Facilities & Equipment**
2. **Programs & Workforce**
3. **Inclusion** (women & girls, First Nations, Pasifika/CALD, people with disability)

It measures impact through three lenses: **social**, **economic** and **cultural**.

## Features

| Tab | What it does |
|---|---|
| **Overview** | NSW-only map with a heatmap of spend by region. You can switch the metric: total, facilities, workforce, inclusion, $ per resident, over/under-spend, inclusion index, or social/economic/cultural impact. Also includes a region heatmap table, a centralisation check, over/under-served flags (one scrollable row per region, split into To review / Rated, with 👍/👎 rating), **targets** for facilities, workforce and inclusion (inclusion split by community: women & girls, First Nations, Pasifika, people with disability, Pride, integrity & safeguarding) (each judged against the pace needed to hit it by its target year; **Adjust targets** lets staff change any target or target year and the status recalculates), and spend by pillar. |
| **Impact** | Social / Economic / Cultural lenses: spend expected to drive each one, which indicators are measured today, and an **evidence log** for field notes (e.g. "women feel safe with the new changerooms", "takeaway shop busy on game days", "Pasifika families gather at the ground"). Also has an Impact agent, plus the **Economic KPIs** calculator: the nine formulas from `Dataset/NSW_Rugby_Economic_KPI_Formula_Summary.xlsx` (facility utilisation, realised co-investment, cost recovery, workforce retention, training cost per qualification, volunteer hours, inclusion cost per participant, out-of-pocket cost change, participation support). Enter baseline and follow-up totals and each KPI is calculated with its documented formula, edge-case rules and official source links, then fed to the AI agents and Story. Missing data shows as "Data collection required", never as zero. |
| **Insights** | Five local AI agents (Facilities, Workforce, Inclusion, Centralisation, Impact) post insight bubbles into a review queue: **To review / Verified / Disputed / Archived**. Rating an insight moves it out of To review, and disputed ones are kept out of the Story report. Re-running the agents archives the previous run's unrated insights (rated ones are kept, and archived ones can be restored), and new insights that repeat a kept one are hidden. Rate each one 👍/👎, delete it (a reason is required first) and ask follow-up questions. A rule engine fills in when the AI is offline. **Live progress** shows each agent's phase (loading model → reading data → writing, with token count and insight number), overall %, elapsed time and an ETA learned from your machine's speed, the model's live output, a "may be stuck" warning, and a Cancel button. |
| **Data Studio** | Upload any file (Excel, CSV, JSON, PDF, Word, text). Tables are profiled, formatted and charted. **Uploads update the dashboard**: region + amount columns become spend, other numeric region columns become map layers, and a `lens`/`impact` column becomes impact evidence. Every file gets a **data quality rating** (green / amber / red). Red means "too high level", and the AI explains what better data would look like. A data-quality panel tracks disputes and deletions and gives advice for collecting accurate data next time. |
| **Story** | Writes the yearly-report narrative from the insights and evidence in five formats (annual report chapter, board summary, funding acquittal, community story, media release). It is laid out with [css/reportstyle.css](css/reportstyle.css): cover page, numbered sections, stat grid and insight register. The text is editable. **Export PDF** prints to PDF with page numbers and running headers; **Quick download** saves a PDF in one click. |

### Simple / Detailed view

The **Simple | Detailed** switch in the top bar controls how much detail is shown (Simple is the default, and the choice is remembered).

- **Simple** scales the region heatmap: every column becomes a **0–100 score**, where 100 is the region with the highest value, so a region on 50 has half as much. Different units ($, per resident, audit gaps, inclusion index) can then be compared at a glance. Fairness is shown in words ("3.4× over", "Balanced"), flags read as plain sentences, and secondary detail is hidden.
- **Detailed** shows every raw figure and column, as before. Hovering a cell in Simple view also shows its exact value.
- The AI agents, Story generator and exports always use the full raw data, whichever view is on.

### Screen effects (FX)

The **FX** button in the top bar turns the cogitator / CRT look on or off. It is on by default and the choice is remembered. The effects are faint scanlines, a slow VHS tracking band, film grain, a slight colour fringe on headings, a short "signal jump" when you switch tabs, and a boot sequence once per browser session (click or press any key to skip).

They are purely decorative: they never block clicks, are turned off automatically for anyone with "reduce motion" set, are toned down in light mode, and never appear in print or PDF exports.

### Demo mode (guided tour and pitching)

Press **▶ Demo** in the top bar, or open http://localhost:5173/?demo to start straight into the tour. It walks through every feature in 18 steps. Each step opens the right tab, highlights the feature and shows a short talking point, so it can be presented as a pitch.

- **Controls:** `→` / `Enter` next, `←` back, `Esc` exit. Click the progress dots to jump to a step.
- **Live features:** some steps run the feature for real (economic KPIs calculated from sample inputs, a sample evidence record, rule-based insights). Everything is labelled `DEMO SAMPLE`.
- **Safe to run anytime:** demo mode turns saving off, and exiting reloads the page, so no sample data reaches your real records.
- **For a pitch:** use full-screen (`F11` on Windows, `Ctrl + Cmd + F` on Mac). The AI steps work without Ollama because the rule engine fills in.

### Prototype data

The files in `Dataset/` are treated as **already uploaded**. They load into Data Studio automatically, feed the dashboard (rows already in the built-in data are skipped, so nothing is double counted) and get quality-rated. Currently only `RWC_Legacy_Data_Compilation.xlsx` is row-level with regions. The dashboard workbook and the PDFs/Word documents are flagged red as too high level.

## Run it locally

You need [Node.js](https://nodejs.org) 18+ (no `npm install` required) and [Ollama](https://ollama.com).

### Windows

```powershell
winget install OpenJS.NodeJS.LTS     # once, if Node isn't installed
ollama pull qwen2.5:7b               # once
node server.js                       # then open http://localhost:5173
```

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
4. **Start the site.** In Terminal, go to the project folder and start the server:

   ```bash
   cd ~/Downloads/Project/nsw-rugby-ai-companion   # wherever you saved the project
   node server.js
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

## Data notes

- Seed data in [js/data.js](js/data.js) was compiled from `Dataset/RWC_Legacy_Data_Compilation.xlsx` and `Dataset/RWC Dashboard 010926 (2).xlsx`.
- Spend is **known allocations** (3-year dashboard budgets plus Round 1 grants), not audited expenditure.
- Region **population** and **First Nations share** are indicative ABS 2021 approximations, used only to normalise spend.
- "Spend vs population" = a region's share of spend ÷ its share of population. 1.75x or more is flagged as overspend risk; 0.5x or less as under-served.
- Impact lenses overlap: one dollar can count toward social, economic and cultural impact.
- Economic KPIs follow the workbook's rules: they are descriptive monitoring indicators, not net economic benefit, and the pillars are never added together. Planned budgets and commitments (e.g. Holroyd's $561k project cost) are shown as "indicative only" and never counted as KPI results.

## Files

```
index.html            app shell
css/styles.css        app styles (dark green terminal theme, light variant)
css/reportstyle.css   report / PDF template
js/store.js           persistence (backend API or browser storage)
js/data.js            seed data and impact framework
js/nsw-boundary.js    NSW outline for the map
js/analytics.js       region metrics, centralisation, impact, rule-based insights
js/ollama.js          AI client and agents
js/app.js             overview, map, heatmap, insights
js/feedback.js        👍/👎 ratings, deletion reasons, data-quality advice
js/impact.js          Impact tab and evidence log
js/econ.js            economic KPI formulas (9-KPI framework) and calculator
js/upload.js          Data Studio, dashboard integration, quality rating
js/story.js           story generator and PDF export
js/demo.js            demo mode: guided tour / pitch walkthrough
api/                  backend (Vercel functions; also used by server.js)
server.js             local server
serve.ps1             fallback static server (no Node)
```
