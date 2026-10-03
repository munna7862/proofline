# Status log

One line per finished task: date, task id, result, the verify summary line.

## Verified before handover
- Engine end-to-end on demo shop with real Chromium via playwright-core: page agent, coverage collector, aggregation, network recorder, all five fault operators, injection, planning, judging, scoring, HTML and Markdown report. `npm run calibrate` passes against demo/expected.json (UI coverage 2 of 7, faults 11 of 12 caught, the one slip is GET /api/cart "Missing text").
- 15 unit tests pass (`npm test`).
- CLI: usage, `init`, `check` exit codes.

## Log
- 2026-10-03 S1-T1 done: local env verified on Windows 11, Node 24.13, Playwright 1.63, Chromium installed. CI switched to `npm ci`; duplicate root build guide removed (canonical copy is docs/BUILD_GUIDE.*). First commit includes package-lock.json. Verify: `UI coverage 28.6% (2/7) | Fault check 91.7% (11 caught, 1 slipped, 3 n/a)`, 15/15 unit tests.

## Written but not yet run (Sprint 1 verifies)
- src/playwright/index.ts (fixture) and src/playwright/reporter.ts inside the real Playwright test runner.
- `proofline scan` and `replay` spawning Playwright.
- `npm run build` (tsc with rewriteRelativeImportExtensions) and the package self-reference used by demo/.
- vscode-extension/ (Phase 4 skeleton).
