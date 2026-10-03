# Master Plan: Proofline

**One line:** Proofline proves your Playwright tests work. It shows which UI your tests touch, then breaks your APIs on purpose and lists the tests that stay green anyway.

**Capacity:** 2 hours a day, about 14 hours a week. Every estimate below assumes that.
**Budget:** ₹0. Every tool in the build, test and launch path is free (see guide, "Zero-cost stack").

## Why this, why now

- AI now writes a large share of tests. Teams can no longer tell a real test from one that only clicks around. Proofline answers that with evidence, not opinion.
- Cypress sells UI Coverage as a paid add-on, which proves teams pay for "what did my tests touch". Playwright users have no equivalent.
- E2E mutation testing exists only as research prototypes. There is no product a QA lead can run in one command.

## Phases

| Phase | Weeks | Goal | Exit criteria |
|---|---|---|---|
| 0. Foundations and validation | 1 | Starter runs on your machine; 10+ QA leads have seen a sample report | `npm run verify` green locally; 10 DMs sent; waitlist live |
| 1. UI coverage, real world | 1–3 | Coverage works on real suites, not just the demo | Runs on 2 public Playwright repos; SPA, iframes and repeated lists handled; shard merge works |
| 2. Fault check, real world | 3–5 | `proofline scan` gives trustworthy results on real suites | Scan finishes under 20 min on a 100-test suite with defaults; "no visible effect" triage cuts noise; replay works |
| 3. Launch 0.1 | 6 | Public, installable, findable | npm package published; README + docs site on GitHub Pages; launch post with real findings from a public repo |
| 4. VS Code Lens | 7–8 | Findings show up where people write tests | Extension on VS Code Marketplace and Open VSX; lens shows "caught X of Y faults" with replay |
| 5. First revenue | 9–12 | Paying teams | Pro features shipped behind offline license keys; payments live; 3 paying teams; 1 case study |
| 6. Expand | Month 4+ | Grow the engine into more products | Resilience score, WebdriverIO adapter, "migration with proof" service, TestPulse dashboard integration |

## Phase details

### Phase 0: Foundations and validation (week 1)
- Verify the starter on your machine (Sprint 1, tasks 1–3).
- Validation: send the demo report screenshot to 15–20 QA leads. Ask one question: "Would you run this on your suite, and what would you pay for it on CI?"
- Decide the name after checking npm, GitHub and a trademark search. "Proofline" is a working name.

### Phase 1: UI coverage, real world (weeks 1–3)
- Run on two public Playwright repos with real backends. Log every miss in docs/STATUS.md.
- Handle: shadow DOM (open roots), same-origin iframes, virtualized lists, elements that appear only after hover.
- Config file `proofline.config.json` (optional): ignoreViews, ignoreElements, view grouping rules.
- `proofline merge` for sharded CI: combine `.proofline/raw` from several jobs.

### Phase 2: Fault check, real world (weeks 3–5)
- Baseline twice (`--baseline-runs 2`) and drop tests that are flaky in baseline.
- "No visible effect" triage: snapshot visible text at end of each test in baseline and mutant runs; if identical, label the fault "no visible effect" instead of "slipped through". This removes most noise.
- Time budget (`--budget 15m`) and parallel mutants (`--concurrency 2`).
- DOM operators (optional): hide an element, disable a button.

### Phase 3: Launch 0.1 (week 6)
- `npm publish`, GitHub release, docs site on GitHub Pages.
- Run Proofline on a well-known public Playwright suite and publish what it finds (with care and credit, never mocking the project).
- Post on LinkedIn, the Playwright community channels, r/QualityAssurance, r/softwaretesting, dev.to.

### Phase 4: VS Code Lens (weeks 7–8)
- Ship vscode-extension/ to VS Code Marketplace and Open VSX (both free to publish).
- Lens text: "Caught 0 of 8 faults · replay one it missed". Free forever; it brings users to the CLI.

### Phase 5: First revenue (weeks 9–12)
- Pro features: PR gate against the main-branch baseline ("this PR added 3 untested buttons"), trend history, shard merge in CI, AI fix suggestions using the customer's own model key or local Ollama.
- Offline license keys signed with Ed25519 (node:crypto). No license server.
- Payments only when the first customer says yes (no cost before that).

### Phase 6: Expand (month 4+)
- Resilience score: same injection engine, different question: does the app show a useful error, a retry, no blank screens?
- WebdriverIO adapter (engine stays unchanged; adapter attaches via CDP).
- "Migration with proof": fixed-price Selenium-to-Playwright migrations where the fault check proves the new suite catches what the old one did. Needs written employer approval while employed.
- Hosted dashboard in TestPulse for teams.

## Success metrics

| By | Metric |
|---|---|
| Week 2 | 10 validation conversations, 3 "I'd try this on my suite" |
| Week 6 | Published; 100 GitHub stars or 300 weekly npm downloads |
| Week 12 | 3 paying teams |
| Month 6 | ₹1 lakh monthly recurring revenue |
