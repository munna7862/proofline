# Status log

One line per finished task: date, task id, result, the verify summary line.

## Verified before handover
- Engine end-to-end on demo shop with real Chromium via playwright-core: page agent, coverage collector, aggregation, network recorder, all five fault operators, injection, planning, judging, scoring, HTML and Markdown report. `npm run calibrate` passes against demo/expected.json (UI coverage 2 of 7, faults 11 of 12 caught, the one slip is GET /api/cart "Missing text").
- 15 unit tests pass (`npm test`).
- CLI: usage, `init`, `check` exit codes.

## Log
- 2026-10-03 S1-T1 done: local env verified on Windows 11, Node 24.13, Playwright 1.63, Chromium installed. CI switched to `npm ci`; duplicate root build guide removed (canonical copy is docs/BUILD_GUIDE.*). First commit includes package-lock.json. Verify: `UI coverage 28.6% (2/7) | Fault check 91.7% (11 caught, 1 slipped, 3 n/a)`, 15/15 unit tests.
- 2026-10-03 S1-T2 done: `npm run demo` in the real runner gives UI coverage 2/7; coverage-summary.json identical to calibration. Fix: Playwright resolves reporters with `require.resolve(id, { paths: [rootDir] })`, which skips package self-reference, so demo/ is now an npm workspace package that depends on `proofline` (file:..) like a real user; one shared @playwright/test. Console paths now print with forward slashes (`displayPath`). Verify: `UI coverage 28.6% (2/7) | Fault check 91.7% (11 caught, 1 slipped, 3 n/a)`, 16/16 unit tests.
- 2026-10-03 S1-T3 done: `npm run demo:scan` gives 11 caught, 1 slipped (GET /api/cart "Missing text"), 3 n/a, matching ground truth. Added scripts/check-demo-scan.ts (`npm run demo:check`) sharing comparison rules with calibrate via scripts/ground-truth.ts; added to CI; confirmed it fails on a flipped outcome. `proofline replay` verified (fault stays green, headed). Verify: `UI coverage 28.6% (2/7) | Fault check 91.7% (11 caught, 1 slipped, 3 n/a)`, 16/16 unit tests.
- 2026-10-03 S1-T4 done: demo, demo:scan and demo:check pass in PowerShell and Git Bash on Windows 11. Added .gitattributes (LF everywhere). Verify: `UI coverage 28.6% (2/7) | Fault check 91.7% (11 caught, 1 slipped, 3 n/a)`, 16/16 unit tests.

## Sprint 2 candidates
- `replay` re-runs every test that hit the endpoint; it could default to the survivors only (the tests that stayed green), which is what the user wants to watch.

## Not yet run
- vscode-extension/ (Phase 4 skeleton).
