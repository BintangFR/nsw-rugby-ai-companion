# Tackle AI

AI companion for NSW Rugby Union's Rugby World Cup Legacy Program. It brings the program data together and gives insight on three pillars:

1. **Facilities & Equipment**
2. **Programs & Workforce**
3. **Inclusion** (women & girls, First Nations, Pasifika/CALD, people with disability)

## Features

| Tab | What it does |
|---|---|
| **Overview** | NSW map heatmap of spend by region (switch metric: total, facilities, workforce, inclusion, $ per resident, over/under-spend, inclusion index). Region heatmap table, centralisation check (statewide vs Greater Sydney vs regional), over/under-served flags, KPI progress and spend by pillar. |
| **Insights** | Four local AI agents (Facilities, Workforce, Inclusion, Centralisation) run on Ollama and post insight bubbles. Ask follow-up questions. A rule engine fills in when Ollama is offline. |
| **Data Studio** | Upload any file (Excel, CSV, JSON, PDF, Word, text). Tables are profiled, formatted and charted automatically; documents are cleaned up. A column of NSW regions, LGAs or towns can be added to the heatmap as a new layer. "Summarise with AI" turns the file into insight bubbles. |
| **Story** | Generates a narrative from the insights for the yearly report (annual report chapter, board summary, funding acquittal, community story, media release). Edit the text in place, then **Export PDF**. |

## Run it

Requirements: Windows PowerShell and [Ollama](https://ollama.com). No Node or Python needed. Libraries load from a CDN, so the browser needs internet access.

```powershell
ollama pull qwen2.5:7b        # recommended; see "Choosing a model" below
powershell -ExecutionPolicy Bypass -File serve.ps1
```

This opens http://localhost:5173. Click the **Ollama** pill in the top bar to choose the model.

If the browser can't reach Ollama because of CORS, allow the site's origin and restart Ollama:

```powershell
setx OLLAMA_ORIGINS "http://localhost:5173"
```

## Choosing a model

The agents need reliable JSON output, and the story needs fluent long-form writing. On a 32 GB laptop with no dedicated GPU (CPU inference):

| Model | Size | Use |
|---|---|---|
| `qwen2.5:7b` | ~4.7 GB | **Default.** Most reliable JSON for the agents, good with numbers, quick enough on CPU. |
| `gemma3:12b` | ~8 GB | Better report writing for the Story tab. About half the speed. |
| `llama3.2:3b` | ~2 GB | Fast drafts and testing. Weaker reasoning. |

You can switch models at any time from the Ollama pill, for example `qwen2.5:7b` for insights and `gemma3:12b` for the final story.

## Data

Seed data is in [js/data.js](js/data.js). It was compiled from `Dataset/RWC_Legacy_Data_Compilation.xlsx` and `Dataset/RWC Dashboard 010926 (2).xlsx`: 38 Round 1 Legacy grants with locations, 24 dashboard budget lines, KPI baselines and targets, and context from the Annual Report and Program Logic.

- Spend is **known allocations** (3-year dashboard budgets plus Round 1 grants), not audited expenditure.
- Region **population** and **First Nations share** are indicative ABS 2021 approximations. They are used only to normalise spend. You can replace them by uploading your own figures.
- "Spend vs population" = a region's share of spend ÷ its share of population. 1.75x or more is flagged as overspend risk; 0.5x or less as under-served.

## Files

```
index.html        app shell
css/styles.css    styles (light and dark)
js/data.js        seed data
js/analytics.js   region metrics, centralisation, rule-based insights
js/ollama.js      Ollama client and AI agents
js/app.js         overview, map, heatmap, insights
js/upload.js      Data Studio
js/story.js       story generator and PDF export
serve.ps1         local static server
```
