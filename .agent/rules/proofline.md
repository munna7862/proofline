# Proofline workspace rule

Follow AGENTS.md at the repo root for every task. Key points, in case AGENTS.md is not loaded:
- Engine (src/coverage, src/proof, src/report) never imports @playwright/test; only src/playwright/* does.
- `npm run verify` must pass before a task is done. Calibration ground truth lives in demo/expected.json.
- No runtime dependencies, no telemetry, no network calls from Proofline, no user data in reports.
- Node 22.18+ runs .ts directly: erasable TypeScript only (no enum, namespace, parameter properties).
