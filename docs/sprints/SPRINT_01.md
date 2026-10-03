# Sprint 1: Make it run on your machine, start validation

**Goal:** the starter runs end to end on your laptop, inside the real Playwright runner, and 10 QA leads have seen a real report.
**Capacity:** 14 hours (7 days × 2 h). Planned: 13 h + 1 h buffer.
**Demo at the end:** `npm run demo` and `npm run demo:scan` on your machine produce the same numbers as calibration.

## Tasks

- [x] **S1-T1 Setup and verify (2 h)**
  Install Node 22.18+ LTS, Git, VS Code or Antigravity. Unzip, `git init`, `npm install`, `npx playwright install chromium`, `npm run verify`.
  Accept: verify passes; commit `package-lock.json`; switch CI to `npm ci`.
  Prompt (Claude Code or Antigravity):
  > Read AGENTS.md and docs/STATUS.md. Run npm install, npx playwright install chromium, then npm run verify. If anything fails, find the root cause and propose the smallest fix. Do not edit demo/expected.json.

- [ ] **S1-T2 Adapter in the real runner (2 h)**
  `npm run demo`. Expect a report at demo/.proofline/report/index.html with UI coverage 2 of 7.
  Likely snags: tsc options for `.ts` import rewriting, package self-reference from demo/, reporter path.
  Prompt:
  > Run npm run demo. The goal is the coverage report in demo/.proofline/report with 2 of 7 elements touched, matching .proofline-calibration. If build or import resolution fails, fix it in tsconfig.build.json or package.json exports, keeping the demo importing 'proofline/playwright' exactly like a real user would.

- [ ] **S1-T3 Scan in the real runner (2 h)**
  `npm run demo:scan`. Expect 11 of 12 caught, the slip being GET /api/cart "Missing text".
  Then add `scripts/check-demo-scan.ts` that reads demo/.proofline/report/proof-summary.json and compares it with demo/expected.json; add it to CI.
  Prompt:
  > Run npm run demo:scan and compare the outcomes with demo/expected.json. If they differ, debug the fixture's mutant mode first (testInfo.status in teardown, file:line filters). Then write scripts/check-demo-scan.ts that fails when the real-runner results disagree with ground truth, and add it to .github/workflows/ci.yml.

- [ ] **S1-T4 Windows pass (1 h, skip if you are on macOS/Linux only)**
  Run S1-T2 and S1-T3 in PowerShell. Fix path separators and spawn issues.

- [ ] **S1-T5 Validation kit (2 h)**
  Screenshot the demo report (desktop). Create a free waitlist form (Google Forms or Tally). Send 10 DMs using docs/GO_TO_MARKET.md template A. Log replies in STATUS.md.

- [ ] **S1-T6 First real-world trial (3 h)**
  Pick a public repo with a Playwright suite and a real backend. Add the import + reporter in a local branch, run coverage, then `proofline scan --max-mutants 20`. Log every wrong classification in STATUS.md as a Sprint 2 candidate. Do not publish findings yet.
  Prompt:
  > I cloned <repo>. Add Proofline the way docs say (change the test import, add the reporter) on a local branch only. Run coverage, then npx proofline scan --max-mutants 20. Make a table of anything that looks misclassified, with evidence, and add it to docs/STATUS.md under "Sprint 2 candidates".

- [ ] **S1-T7 Retro and plan Sprint 2 (1 h)**
  `/plan-sprint` (Claude Code) or the plan-sprint workflow (Antigravity).

## Risks this sprint
- Build config needs a tweak (TypeScript version). Budgeted in S1-T2.
- Real suite uses its own fixtures file: use `mergeTests` from @playwright/test to combine theirs with Proofline's.
