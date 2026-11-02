# Handover: Tackle AI

Tackle AI is a working prototype for NSW Rugby Union's Rugby World Cup Legacy Program. It brings the program's spend, targets and evidence together, shows impact across social, economic and cultural lenses, and uses AI to suggest insights and draft the yearly report.

This page is for whoever takes the project over. Start here, then read:

1. [README.md](../README.md): what the app does and how to run it.
2. [ARCHITECTURE.md](ARCHITECTURE.md): how the code fits together.
3. [MAINTAINING.md](MAINTAINING.md): how to make common changes safely.

## First hour checklist

- [ ] Install [Node.js](https://nodejs.org) 18+ and [Ollama](https://ollama.com), then run `ollama pull qwen2.5:7b`.
- [ ] Start the app: double-click `boot.cmd` (Windows) or run `./boot.sh` (Mac/Linux).
- [ ] Open **▶ Tour → Guided demo** in the top bar and walk through the tour. It is the fastest way to see every feature.
- [ ] Run `npm run check` to confirm your copy is healthy.
- [ ] Read the "Known limitations" section below.

## Status at handover

| Area | State |
|---|---|
| Overview: map, heatmap, centralisation, flags | Working |
| Programs: cost, return and root cause per program | Working |
| Targets: status against plan, editable targets | Working |
| Impact: established-framework measures, valuation calculators, evidence log, NSW Rugby KPI Framework (27 KPIs) | Working. Only published methods are used; every number explains itself on hover. |
| "How the app works" page (Framework tab): how figures and AI insights are produced | Working (generated from the live app) |
| Targets read uploaded yearly data (e.g. Rugby Analytics export) | Working |
| Presentation mode (15 timed slides, speaker notes) | Working |
| Insights: five AI agents, review queue, rule-based fallback | Working (local Ollama or hosted AI) |
| Data Studio: uploads, quality rating, dashboard integration | Working |
| Story: report drafts and PDF export | Working |
| Demo mode | Working (sandboxed, never saves) |
| Vercel deployment | Configured (`vercel.json`, `api/`). Needs AI provider, Redis and access-key settings; see the README. |
| Automated checks | `npm run check` (syntax, file references, seed data) runs on every GitHub push. No browser UI tests yet. |

## Where the data comes from

- Built-in data in `js/data.js` was compiled from `Dataset/RWC_Legacy_Data_Compilation.xlsx` and `Dataset/RWC Dashboard 010926 (2).xlsx` (compiled 24 Sep 2026).
- KPI formulas, input rules, baselines and sources come from `Dataset/NSW_Rugby_KPI_Formula_Web_Handover.xlsx` (27 KPIs; it supersedes `NSW_Rugby_Economic_KPI_Formula_Summary.xlsx`).
- The **Framework** tab is the project deliverable in tool-independent form; download it as a document, `framework.json` or `input-fields.csv` to rebuild it elsewhere.
- Region populations and First Nations shares are **indicative** ABS 2021 approximations, used only to compare spend fairly between regions.
- Spend is **known allocations** (budgets and grants), not audited expenditure.

## Known limitations

- **Single shared password.** `APP_ACCESS_KEY` protects the API, but there are no individual user accounts or audit trail of who changed what.
- **Last write wins.** Each collection (e.g. all evidence) is saved as a whole. Two people editing the same thing at once can overwrite each other.
- **`Dataset/` is public on Vercel.** Anyone with the URL can download those files. Use Deployment Protection or remove the folder before sharing a link.
- **AI accuracy.** The default local model (`qwen2.5:7b`) sometimes mixes up figures. Insights are fact-checked against computed flags, and staff can dispute them with 👎, but they should still be reviewed before publishing.
- **Local AI speed.** On a laptop without a graphics card, the first AI answer takes 2–3 minutes. A hosted provider or a GPU machine is much faster.
- **Internet needed.** Libraries and map tiles load from CDNs, so the app does not work fully offline.
- **Seed data is in code.** Updating grants or budgets means editing `js/data.js` (or uploading a spreadsheet in Data Studio).

## Suggested next steps

1. **Collect the missing evidence.** Many impact indicators show "No data yet" (e.g. women feeling safe at the ground, local business turnover on game days, First Nations cultural safety). Adding those survey questions has the biggest effect on the report.
2. **Collect KPI baselines**: no verified baseline exists yet for any of the 27 KPIs (handover, "Baseline Requirements"). Enter them on the Impact tab once custodians have checked them.
3. **Deploy to Vercel** with Upstash Redis, a hosted AI provider and an access key, so staff can use one shared copy.
4. **Real sign-in** before wider rollout (see "When the project grows" in [MAINTAINING.md](MAINTAINING.md)).

## Accounts and secrets to hand over

Nothing secret is stored in the repository. Make sure the new owner has access to:

- [ ] The GitHub repository (admin).
- [ ] The Vercel project, if deployed (environment variables are set there).
- [ ] Upstash Redis, if used (holds all saved data on Vercel).
- [ ] The AI provider account and API key, if a hosted provider is used.
- [ ] The value of `APP_ACCESS_KEY`, shared privately, not in the repo.
- [ ] A copy of `data-store/` from any machine that ran the app locally with real data.
