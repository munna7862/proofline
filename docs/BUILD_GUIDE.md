# Proofline: the complete build guide

**Proof that your Playwright tests work.** Coverage tells you what your tests ran. Proofline tells you what they'd catch.

This guide is the plan, the rules and the manual for building Proofline from the starter repo to first paying customers, at 2 hours a day, spending ₹0 on tools.

What you have in this package:

| File | What it is |
|---|---|
| `docs/BUILD_GUIDE.md` | This guide |
| `docs/BUILD_GUIDE.html` | The same guide with rendered screens (open in a browser) |
| `proofline-starter.zip` | The starter repo: working engine, demo app, tests, CI, Claude Code and Antigravity setup, all plans |

---

## 1. What we are building

### The problem
Teams run hundreds of Playwright tests and see green. Nobody can say whether those tests would catch a real bug. AI now writes many tests, which makes this worse: an AI-written test can click through four screens and check nothing. Code coverage doesn't help; it shows what ran, not what was checked.

### The product
Proofline gives two numbers and a to-do list.

1. **UI coverage.** Which buttons, links, inputs and menus your tests actually touch, page by page, and which ones no test ever touches.
2. **Fault check.** Proofline breaks each API your tests depend on, one way at a time (server error, network failure, empty result, wrong numbers, missing text). It re-runs only the tests that call that API. A fault "slips through" when every test stays green while the app is visibly broken. Those tests are the hollow ones.

Then **"Fix these first"**: the weakest tests (with file and line) and the pages with the most untouched elements.

### Who pays and why
- **User:** SDETs and QA engineers on Playwright.
- **Buyer:** QA leads and engineering managers who must justify automation spend and trust AI-written tests.
- **Proof of demand:** Cypress sells UI Coverage as a separate paid add-on. No Playwright equivalent was found. E2E mutation testing exists only as research prototypes.

### Why it can win
- One import change, no app changes, no account, runs offline. Enterprise security teams say yes faster.
- The fault check is hard to fake. The numbers are reproducible: every finding has a replay command.
- You are the ideal builder: 8 years of SDET work across Selenium, WebdriverIO and Playwright.

---

## 2. How it works

```
npx playwright test
   └─ page agent inside the browser records: every interactive element on each page
      and every trusted click/type/change your tests make
   └─ reporter builds .proofline/report/index.html  →  UI coverage

npx proofline scan
   1. baseline run: record which APIs each passing test calls
   2. plan faults: each API × each fault type (5 types)
   3. for each fault: re-run only the tests that call that API, with the fault injected
      through Playwright's network routing (your app's code is never touched)
   4. judge: any test failed → caught. All passed while the response changed → slipped through
   └─ report adds the fault check + "Fix these first"

npx proofline replay <id>     watch one fault happen, headed
npx proofline check --min-coverage 50 --min-proof 70     CI gate, exits 1 below thresholds
```

### The five faults (each one is a real bug class)

| Fault | Models | Applies to |
|---|---|---|
| Server error (500) | Backend crash, unhandled exception | Every API |
| Network failure | Timeout, DNS, CORS, offline | Every API |
| Empty result | Wrong filter, empty table | JSON with arrays |
| Wrong numbers (+1) | Off-by-one, wrong total, wrong price | JSON numbers (ids skipped) |
| Missing text | Null names, blank labels | JSON strings (ids skipped) |

### Scoring rules (fixed, documented, tested)
- **UI coverage** = elements touched ÷ interactive elements seen, across visited pages. Repeated rows with the same role and name count once. Links count only when clicked; a link whose page was opened by URL is listed as "Destination visited by URL, link never clicked".
- **Fault check** = caught ÷ (caught + slipped through). "Not reached", "not applicable" and errors are shown but never counted.
- Only tests that pass the baseline are used. Fault runs use zero retries.

---

## 3. Screens

The HTML version shows these rendered. The first two are real screenshots of the report the starter already generates on the demo shop.

**3.1 Report, desktop.** Two score cards with denominators ("2 of 7 interactive elements touched by 3 tests", "11 of 12 injected faults caught"). "Fix these first" list. Fault table: endpoint, fault, result badge (Caught / Slipped through), the tests involved, copyable replay id. UI coverage per page with red chips for untouched elements. Pages no test visits.

**3.2 Report, mobile and dark mode.** Same content; the fault table becomes stacked rows.

**3.3 Terminal during a scan.**
```
1/3 Baseline run: recording which APIs each test depends on…
2/3 Planned 15 faults across 3 endpoints for 3 passing tests.
   [1/15] GET /api/cart Server error (500): killed
   [2/15] GET /api/cart Missing text: survived
   …
3/3 Fault check 92%: 11 caught, 1 slipped through.
Report: .proofline/report/index.html
```

**3.4 Pull request summary (GitHub job summary or PR comment).**
```
## Proofline
UI coverage 29% · 2 of 7 interactive elements touched by 3 tests
Fault check 92% · 11 of 12 injected faults caught

### Faults no test noticed
| Endpoint      | Fault        | Tests that stayed green     | Replay                       |
| GET /api/cart | Missing text | adds a product to the cart  | npx proofline replay 1e65wvm |
```

**3.5 VS Code lens (Phase 4).** Above each test:
```
⚠ Proofline: caught 0 of 8 faults · replay one it missed
test('search box accepts input', async ({ page }) => {
```

**3.6 Landing page (Phase 3).** Headline "Your tests are green. Would they catch a bug?", the quick start in three lines, the real report screenshot, a waitlist/Get started button. Hosted free on GitHub Pages.

---

## 4. Architecture

```
            your Playwright tests
                    │  import { test } from 'proofline/playwright'
                    ▼
   ┌──────────── adapter (src/playwright) ─────────────┐
   │ auto fixture: mode from PROOFLINE_MODE            │
   │ reporter: builds coverage report at end of run    │
   └───────┬──────────────────────┬────────────────────┘
           ▼                      ▼
   coverage engine           proof engine
   page/agent.ts (browser)   inject.ts  NetworkRecorder + injectMutant
   collector.ts              plan.ts    plan, judge, score
   aggregate.ts              operators.ts
           └────► .proofline/raw/*.json ◄────┘   one file per test: safe across workers and CI shards
                            ▼
              report/  HTML · Markdown · JSON    ◄── cli.ts
```

Key design decisions (full list in `docs/DECISIONS.md`):
- **Runtime injection** with `context.route`, never source mutation. Works on any web app.
- **File-based IPC** through `.proofline/`. Survives parallel workers, crashes and CI sharding.
- **Engine never imports the test runner.** A WebdriverIO adapter can be added later without touching the engine.
- **Zero runtime dependencies.** Only `node:` built-ins. Enterprise reviews love this.
- **Node 22.18+ runs TypeScript directly** during development; `tsc` builds `dist/` for publishing.

---

## 5. Zero-cost stack

Nothing here needs to be bought to build, test or launch.

| Need | Tool | Cost |
|---|---|---|
| Runtime | Node.js 22 LTS (22.18 or newer) | Free |
| Language | TypeScript | Free |
| Browser automation | Playwright | Free, open source |
| Unit tests | `node:test` (built into Node) | Free |
| AI coding | Claude Code (your Claude plan), Antigravity with Gemini (your plan) | Already paid |
| Editor | VS Code or Antigravity | Free |
| Code hosting + CI | GitHub public repo + GitHub Actions | Free for public repos |
| Package registry | npm (public packages) | Free |
| Docs + landing page | GitHub Pages | Free |
| Waitlist | Google Forms or Tally free plan | Free |
| Diagrams, mockups | Excalidraw, Penpot | Free |
| Screen recording | OBS Studio | Free |
| VS Code extension publishing | VS Code Marketplace, Open VSX | Free accounts |
| Local AI for later features | Ollama | Free |

**Do not pay for, yet:** a domain (use `<you>.github.io/proofline`), hosting (no server needed until the Team plan), payment provider (merchant-of-record services charge per sale, nothing up front; set up only when a customer says yes). Watch out for free tiers that forbid commercial use (for example, check the terms before putting a paid product on a hobby hosting plan).

---

## 6. My build rules

These are in `AGENTS.md`, so both Claude Code and Antigravity follow them on every task.

1. **Engine and adapters stay separate.** Only `src/playwright/*` imports `@playwright/test`.
2. **Calibration first.** Every new operator or scoring rule gets a ground-truth entry in `demo/expected.json`; `npm run calibrate` must pass.
3. **Never touch the user's app source.**
4. **Local-first and private.** No telemetry, no network calls from Proofline, no response bodies or user data in reports. Reports open offline.
5. **Zero runtime dependencies.** A new dependency needs an ADR.
6. **Deterministic.** No randomness; zero retries in fault runs; baseline failures excluded, never scored.
7. **Honest numbers.** Always show the denominator. Not-reached and not-applicable are visible but outside the score.
8. **Every finding is reproducible** with `npx proofline replay <id>`.
9. **Zero config first run.** One import and one reporter line.
10. **Small vertical slices.** Each task is a working, tested, demoable change.
11. **Windows works.** Spawn Node directly; normalize paths.
12. **Free stack only.**

---

## 7. Day 0: setup, step by step

**Windows (PowerShell) or macOS/Linux, same steps:**

1. Install Node.js 22 LTS (22.18 or newer) from nodejs.org. Check: `node -v`.
2. Install Git. Check: `git --version`.
3. Install VS Code and/or Antigravity. Install Claude Code following Anthropic's docs and sign in with your plan.
4. Unzip `proofline-starter.zip` into a folder on your **personal** laptop, for example `~/code/proofline`.
5. In that folder:
   ```bash
   git init
   npm install
   npx playwright install chromium
   npm run verify
   ```
   Expected last lines:
   ```
   UI coverage 28.6% (2/7) | Fault check 91.7% (11 caught, 1 slipped, 3 n/a)
   Calibration passed: engine matches demo/expected.json
   ```
6. Open `.proofline-calibration/report/index.html` in your browser. That is the product.
7. Create a **personal** GitHub repo (public), push, and watch the CI workflow run.

If step 5 fails, start Claude Code in the folder and run `/verify`. It will explain and propose a fix.

---

## 8. Working with Claude Code and Antigravity

### What's already set up in the starter

| File | Used by | Purpose |
|---|---|---|
| `AGENTS.md` | Both | The rules, commands, code map, Definition of Done |
| `CLAUDE.md` | Claude Code | Imports AGENTS.md, lists personas and commands |
| `.claude/agents/*.md` | Claude Code | Personas: product-owner, architect, engine-engineer, sdet-reviewer, report-designer |
| `.claude/commands/*.md` | Claude Code | `/sprint-start`, `/verify`, `/review`, `/plan-sprint` |
| `GEMINI.md` | Antigravity | Points to AGENTS.md, Antigravity-specific notes |
| `.agent/rules/proofline.md` | Antigravity | Short workspace rule, in case AGENTS.md is not loaded |
| `.agent/workflows/*.md` | Antigravity | sprint-start, verify, review, plan-sprint |
| `docs/PERSONAS.md` | Both | The virtual team, one table |

Antigravity reads `AGENTS.md` in recent versions. Some versions use `.agents/` instead of `.agent/` for rules and workflows; if yours doesn't pick them up, rename the folder or add them in the Agent panel's Customizations.

### Who does what
- **Claude Code** (terminal, repo-wide changes, tests): engine work, CLI, adapter, debugging failing runs, reviews of diffs.
- **Antigravity** (editor + browser agent): report UI work, where the browser agent can open the report and screenshot it at desktop and mobile widths; landing page; a second opinion on plans.
- Use your strongest reasoning setting (Claude Opus thinking, or Gemini Pro high) for planning and engine bugs; a faster model for routine edits.
- **Rule:** one agent edits at a time. Commit before switching tools.

### Your 2-hour daily loop
| Minutes | Step |
|---|---|
| 0–10 | Open the sprint file, pick the next task |
| 10–25 | `/sprint-start` (or the sprint-start workflow). Read the plan, push back, approve |
| 25–85 | Let the agent implement. Watch, steer, keep the slice small |
| 85–105 | `/verify`, then `/review`. Fix blockers |
| 105–120 | Commit, tick the task, one line in `docs/STATUS.md`. If something interesting happened, draft a LinkedIn post |

---

## 9. Master plan

| Phase | Weeks | Goal | Exit criteria |
|---|---|---|---|
| 0. Foundations and validation | 1 | Starter runs on your machine; 10 QA leads saw a real report | `npm run verify` green; 10 DMs sent; waitlist live |
| 1. UI coverage, real world | 1–3 | Correct on real suites | 2 public suites run; shadow DOM, iframes, hover menus handled; shard merge |
| 2. Fault check, real world | 3–5 | Results a QA lead trusts | Under 20 min for a 100-test suite with defaults; "no visible effect" triage; replay works |
| 3. Launch 0.1 | 6 | Public and findable | npm publish; docs on GitHub Pages; launch post with real findings |
| 4. VS Code lens | 7–8 | Findings next to the code | Extension on Marketplace and Open VSX |
| 5. First revenue | 9–12 | Paying teams | Pro features behind offline license keys; 3 paying teams; 1 case study |
| 6. Expand | Month 4+ | More products from the same engine | Resilience score, WebdriverIO adapter, "migration with proof" service, TestPulse dashboard |

Detailed phase plans: `docs/MASTER_PLAN.md`, `docs/phases/`.

---

## 10. Sprint 1, day by day (14 hours)

| Day | Task | Hours | Done when |
|---|---|---|---|
| 1 | S1-T1 Setup and verify | 2 | `npm run verify` passes; lockfile committed |
| 2 | S1-T2 Adapter in the real runner | 2 | `npm run demo` shows 2 of 7 in the report |
| 3 | S1-T3 Scan in the real runner | 2 | `npm run demo:scan` = 11 of 12; CI check added |
| 4 | S1-T4 Windows pass + S1-T5 validation kit (start) | 2 | Works in PowerShell; waitlist live; 5 DMs sent |
| 5 | S1-T5 validation kit (finish) | 1 | 10 DMs sent, replies logged |
| 5–6 | S1-T6 First real-world trial | 3 | Coverage + 20-fault scan on a public suite; misclassifications logged |
| 7 | S1-T7 Retro and plan Sprint 2 | 1 | `docs/sprints/SPRINT_02.md` exists |

Every task in `docs/sprints/SPRINT_01.md` has a ready-to-paste prompt. Example for Day 3:

> Run npm run demo:scan and compare the outcomes with demo/expected.json. If they differ, debug the fixture's mutant mode first (testInfo.status in teardown, file:line filters). Then write scripts/check-demo-scan.ts that fails when the real-runner results disagree with ground truth, and add it to .github/workflows/ci.yml.

---

## 11. Sprints 2–12 at a glance

| Sprint | Week | Focus |
|---|---|---|
| 2 | 2 | Coverage accuracy: fix trial findings, shadow DOM, iframes, config file, `mergeTests` recipe |
| 3 | 3 | Scale: shard merge, baseline twice, overhead under 5% |
| 4 | 4 | Trust: "no visible effect" triage, time budget, concurrency |
| 5 | 5 | Polish: per-test strength table, GitHub Actions example, README with real screenshots |
| 6 | 6 | Launch 0.1 |
| 7–8 | 7–8 | VS Code lens |
| 9–12 | 9–12 | PR baseline gate, history, license keys, payments, first 3 paying teams |

Run `/plan-sprint` at the end of each week; the Product Owner persona cuts scope to 14 hours.

---

## 12. Quality gates

**Definition of Done for every task**
- `npm run verify` passes (typecheck, unit tests, engine calibration).
- New behaviour has a unit test or a ground-truth entry in `demo/expected.json`.
- `/review` has no blockers.
- User-visible text updated (README, report copy, CLI help).
- No new dependency without an ADR. No data leaves the machine.

**The calibration idea, in one paragraph.** The demo shop has three tests with known quality: two strong, one hollow on purpose. We know in advance which faults each should catch. `scripts/calibrate.ts` runs the whole engine against it in a real browser and compares every number with `demo/expected.json`. If a change makes the hollow test look good, or a strong test look weak, CI goes red. Proofline tests itself the way it tests others.

---

## 13. Validation and launch

**Signal to keep going:** 3 of 10 QA leads say "I'd run this on my suite this week."

**DM template (LinkedIn):**
> Hi <name>, I'm an SDET building a small tool for Playwright suites. It breaks your APIs on purpose during a test run and shows which tests still pass. On a demo app, one test "passed" through 8 different faults. Screenshot attached. Would you try it on your suite if it took one import change? Not selling anything yet, just checking if this is useful.

**Launch (week 6):** findings from a public suite (shared with maintainers first, lead with what they do well), a 60-second video, posts on LinkedIn, dev.to, r/QualityAssurance, r/softwaretesting and Playwright community channels, plus free "suite check" calls for the first 20 teams.

**Pricing hypothesis** (validate in calls):

| Plan | Price | Includes |
|---|---|---|
| Community | Free, MIT | Coverage, fault check, HTML report, CLI gate, VS Code lens |
| Pro | $29 / ₹1,999 per repo per month | PR gate vs main baseline, history, shard merge, AI fix suggestions |
| Team | $199 / ₹14,999 per month | Hosted dashboard (TestPulse), alerts, 10 repos |
| Enterprise | Custom | Self-hosted, audit export, SSO, support SLA |

Open-core boundary: anything one developer needs on a laptop is free; anything a team needs to govern quality over time is paid.

---

## 14. Money: honest milestones

| By | Target |
|---|---|
| Week 2 | 10 conversations, 3 "I'd try it" |
| Week 6 | Published; 100 GitHub stars or 300 weekly npm downloads |
| Week 12 | 3 paying teams |
| Month 6 | ₹1 lakh monthly recurring revenue |
| Month 12 | ₹5 lakh monthly recurring revenue, if the product keeps proving itself |

These are targets for a bet, not promises. The milestones exist so you can decide early whether to push harder, change direction, or move on.

---

## 15. Risks and the employment checklist

| Risk | Mitigation |
|---|---|
| A big player ships the same thing | Move fast, build an audience, focus on the fault check, stay local-first |
| Noise from faults that change nothing visible | "No visible effect" triage (Sprint 4), replay for every item |
| Long scans on big suites | Targeted reruns, `--max-mutants`, time budget, concurrency, shards |
| Flaky tests distort scores | Zero retries in faults, baseline twice, flaky-in-baseline excluded |
| Suites with custom fixtures | `mergeTests` recipe |
| Server-side data fetching | Documented limit; API-level operators later |

**Employment and IP checklist (not legal advice):**
- Read your agreement's IP assignment and outside-work clauses.
- Personal laptop, personal GitHub, personal AI subscriptions, outside work hours only.
- No employer code, suites, data, tickets or internal knowledge. Don't run Proofline on employer repos without written permission.
- Get written approval for the open-source project if your agreement is unclear, and always before paid client work.
- If in doubt, a one-hour employment-lawyer consult is cheap insurance.

---

## 16. What's verified and what Sprint 1 verifies

**Verified before handover (in a real Chromium browser):**
- Page agent, coverage collector and aggregation; network recorder; all five fault operators; runtime injection; planning, judging and scoring; HTML and Markdown reports. `npm run calibrate` matches ground truth: UI coverage 2 of 7, fault check 11 of 12, the one slip being `GET /api/cart` "Missing text" (the cart's item names are never shown, so no test can notice; a good example of why "no visible effect" triage comes in Sprint 4).
- 15 unit tests pass. CLI usage, `init` and `check` work.

**Written, not yet run (Sprint 1, tasks 2–3):**
- The Playwright fixture and reporter inside the real test runner.
- `proofline scan` and `replay` spawning Playwright.
- `npm run build` and the package self-reference used by `demo/`.
- The VS Code extension skeleton (Phase 4).

These were written against Playwright's documented APIs; the sandbox used to build the starter had no access to the `@playwright/test` runner. Sprint 1 is planned around closing exactly this gap.

---

## 17. After Proofline: a product family that helps both AI and humans

The same engine (watch a real browser, inject faults, judge outcomes) powers several products:

1. **Resilience score:** does the app show a helpful error and a retry, or a blank screen, when an API fails? Different buyer (engineering managers), same code.
2. **Agent-written test verifier:** an MCP server so coding agents can call Proofline after writing tests and fix hollow ones before a human ever sees them. Helps AI do better work and humans trust it.
3. **Migration with proof:** Selenium-to-Playwright migrations where the fault check proves the new suite catches what the old one did. A service first, product later.
4. **TestPulse integration:** history, trends and team dashboards for paying teams.

---

## Appendix A: starter file tree

```
proofline/
├── AGENTS.md  CLAUDE.md  GEMINI.md  README.md  LICENSE
├── package.json  tsconfig.json  tsconfig.build.json  .gitignore
├── .claude/agents/      product-owner, architect, engine-engineer, sdet-reviewer, report-designer
├── .claude/commands/    sprint-start, verify, review, plan-sprint
├── .agent/rules/        proofline.md
├── .agent/workflows/    sprint-start, verify, review, plan-sprint
├── .github/workflows/   ci.yml
├── src/
│   ├── page/agent.ts            in-browser agent
│   ├── coverage/                collector.ts, aggregate.ts
│   ├── proof/                   operators.ts, inject.ts, plan.ts
│   ├── report/                  html.ts, markdown.ts, write.ts
│   ├── playwright/              index.ts (fixture), reporter.ts
│   ├── util/                    normalize.ts, store.ts
│   ├── types.ts
│   └── cli.ts
├── demo/                shop/server.ts, tests/shop.spec.ts, playwright.config.ts, expected.json
├── scripts/calibrate.ts
├── test/                4 unit test files, 15 tests
├── vscode-extension/    Phase 4 skeleton
└── docs/                MASTER_PLAN, PERSONAS, ARCHITECTURE, DECISIONS, STATUS,
                         GO_TO_MARKET, RISKS, phases/, sprints/
```

## Appendix B: CLI reference

| Command | Does |
|---|---|
| `proofline init` | Prints the two setup changes |
| `proofline report` | Rebuilds the HTML report from `.proofline/raw` |
| `proofline scan [--max-mutants 60] [--operators http-500,empty-json] [--include /api/] [--exclude /health] [--workers 2] [--min-proof 70] [-- <playwright args>]` | Fault check |
| `proofline replay <id> [-- <playwright args>]` | Re-runs one fault headed |
| `proofline check [--min-coverage N] [--min-proof N]` | CI gate, exit 1 below thresholds |

Environment: `PROOFLINE_MODE` (coverage, record, mutant, off), `PROOFLINE_DIR` (default `.proofline`).
