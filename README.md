# Tackle AI

AI companion for NSW Rugby Union's Rugby World Cup Legacy Program. It brings the program data together and gives insight on three pillars:

1. **Facilities & Equipment**
2. **Programs & Workforce**
3. **Inclusion** (women & girls, First Nations, Pasifika/CALD, people with disability)

It measures impact through three lenses: **social**, **economic** and **cultural**.

## Features

| Tab | What it does |
|---|---|
| **Overview** | NSW-only map with a heatmap of spend by region. You can switch the metric: total, facilities, workforce, inclusion, $ per resident, over/under-spend, inclusion index, or social/economic/cultural impact. Also includes a region heatmap table, a centralisation check, over/under-served flags with 👍/👎 rating, KPI progress and spend by pillar. |
| **Impact** | Social / Economic / Cultural lenses: spend expected to drive each one, which indicators are measured today, and an **evidence log** for field notes (e.g. "women feel safe with the new changerooms", "takeaway shop busy on game days", "Pasifika families gather at the ground"). Also has an Impact agent. |
| **Insights** | Five local AI agents (Facilities, Workforce, Inclusion, Centralisation, Impact) post insight bubbles. Rate each one 👍/👎, delete it (a reason is required first) and ask follow-up questions. A rule engine fills in when the AI is offline. |
| **Data Studio** | Upload any file (Excel, CSV, JSON, PDF, Word, text). Tables are profiled, formatted and charted. **Uploads update the dashboard**: region + amount columns become spend, other numeric region columns become map layers, and a `lens`/`impact` column becomes impact evidence. Every file gets a **data quality rating** (green / amber / red). Red means "too high level", and the AI explains what better data would look like. A data-quality panel tracks disputes and deletions and gives advice for collecting accurate data next time. |
| **Story** | Writes the yearly-report narrative from the insights and evidence in five formats (annual report chapter, board summary, funding acquittal, community story, media release). It is laid out with [css/reportstyle.css](css/reportstyle.css): cover page, numbered sections, stat grid and insight register. The text is editable. **Export PDF** prints to PDF with page numbers and running headers; **Quick download** saves a PDF in one click. |

### Prototype data

The files in `Dataset/` are treated as **already uploaded**. They load into Data Studio automatically, feed the dashboard (rows already in the built-in data are skipped, so nothing is double counted) and get quality-rated. Currently only `RWC_Legacy_Data_Compilation.xlsx` is row-level with regions. The dashboard workbook and the PDFs/Word documents are flagged red as too high level.

## Run it locally

You need [Node.js](https://nodejs.org) 18+ (no `npm install` required) and [Ollama](https://ollama.com).

```powershell
winget install OpenJS.NodeJS.LTS     # once, if Node isn't installed
ollama pull qwen2.5:7b               # once
node server.js                       # then open http://localhost:5173
```

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

## Files

```
index.html            app shell
css/styles.css        app styles (light and dark)
css/reportstyle.css   report / PDF template
js/store.js           persistence (backend API or browser storage)
js/data.js            seed data and impact framework
js/nsw-boundary.js    NSW outline for the map
js/analytics.js       region metrics, centralisation, impact, rule-based insights
js/ollama.js          AI client and agents
js/app.js             overview, map, heatmap, insights
js/feedback.js        👍/👎 ratings, deletion reasons, data-quality advice
js/impact.js          Impact tab and evidence log
js/upload.js          Data Studio, dashboard integration, quality rating
js/story.js           story generator and PDF export
api/                  backend (Vercel functions; also used by server.js)
server.js             local server
serve.ps1             fallback static server (no Node)
```
