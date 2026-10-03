# AGENTS.md: Proofline

Read this before every task. It is the contract for any AI agent (Claude Code, Antigravity/Gemini) and any human working here.

## What we are building

Proofline proves that a Playwright test suite actually works.

1. **UI coverage**: which buttons, links and inputs the tests touch, per page, with the untouched ones listed.
2. **Fault check**: Proofline breaks each API the tests depend on (500 error, network failure, empty result, wrong numbers, missing text), re-runs only the tests that call that API, and lists the tests that stay green while the app is broken.

Users change one import and add one reporter. Nothing in their app changes.

## Commands

| Task | Command |
|---|---|
| Unit tests | `npm test` |
| Engine calibration (end-to-end, no test runner) | `npm run calibrate` |
| Typecheck | `npm run typecheck` |
| Everything that must pass before a commit | `npm run verify` |
| Demo suite with coverage report | `npm run demo` |
| Demo fault check | `npm run demo:scan` |
| Real runner vs ground truth (after demo + demo:scan) | `npm run demo:check` |
| Run the demo shop by hand | `npm run shop` then open http://localhost:4173 |

## Map

```
src/page/agent.ts           runs INSIDE the browser; self-contained; never throws into the app
src/coverage/collector.ts   attaches the agent to a BrowserContext, records one test
src/coverage/aggregate.ts   merges tests into the coverage summary (scoring rules live here)
src/proof/operators.ts      the five fault operators
src/proof/inject.ts         baseline network recorder + runtime fault injection (context.route)
src/proof/plan.ts           which faults to run, how to judge them, scoring
src/report/*                HTML report (the product's main screen), Markdown summary, writer
src/playwright/*            thin adapter: auto fixture + reporter
src/cli.ts                  proofline report | scan | replay | check | init
demo/                       calibration app with known ground truth (demo/expected.json)
scripts/calibrate.ts        runs the engine on the demo and compares with ground truth
docs/                       Master Plan, phase plans, sprints, architecture, decisions, GTM
```

## Build rules (non-negotiable)

1. **Engine and adapters stay separate.** Anything in `src/coverage`, `src/proof`, `src/report` takes a `BrowserContext` or plain data. Only `src/playwright/*` imports `@playwright/test`. A WebdriverIO adapter must be possible later without touching the engine.
2. **Calibration first.** Every new operator, scoring rule or agent change gets a ground-truth entry in `demo/expected.json` before or with the code. `npm run calibrate` must pass. If the numbers change, explain why in the commit.
3. **Never touch the user's app source.** Faults are injected at runtime only.
4. **Local-first and private.** No telemetry, no network calls from Proofline itself, no response bodies or user data in reports. Reports open offline. This is a sales feature for enterprise buyers.
5. **Zero runtime dependencies.** Use `node:` built-ins. Adding a dependency needs an ADR in `docs/DECISIONS.md`.
6. **Deterministic.** No randomness in planning; retries are 0 for fault runs; tests that fail the baseline are excluded, never scored.
7. **Honest numbers.** Always show the denominator ("11 of 12"). Keep "not reached" and "not applicable" out of the score and visible in the report.
8. **Every finding is reproducible.** Each slipped fault has an id and `npx proofline replay <id>` shows it headed.
9. **Zero config first run.** One import change and one reporter line. New options need sensible defaults.
10. **Small vertical slices.** One task = one working, tested change you can demo. No half-built layers.
11. **Windows works.** Use `path` helpers, forward-slash normalization for display, and spawn Node directly, never `.cmd` shims without `shell`.
12. **Free stack only.** Nothing in the build, test or release path may require a paid service.

## TypeScript style

- Node 22.18+ runs `.ts` directly. Use erasable syntax only: no `enum`, no `namespace`, no constructor parameter properties.
- Relative imports use the `.ts` extension. `npm run build` rewrites them for `dist/`.
- Prefer small pure functions; keep side effects at the edges (`cli.ts`, adapter, `store.ts`).
- Public behaviour gets a unit test in `test/` (node:test, no extra libs).

## Workflow for every task

1. Read the current sprint file in `docs/sprints/` and pick the next unchecked task.
2. Write a short plan (files to touch, test to add, how you will verify). Wait for approval if the change touches scoring, the report layout or the public API.
3. Implement the smallest slice. Add or update tests and ground truth.
4. Run `npm run verify`. Paste the summary line.
5. Tick the task in the sprint file and add one line to `docs/STATUS.md`.

## Definition of Done

- `npm run verify` passes locally.
- New behaviour has a unit test or a calibration entry.
- Docs updated where users would notice (README, report copy, CLI help).
- No new dependency without an ADR. No data leaves the machine.

## Never

- Commit secrets, customer data, or any code or data from an employer.
- Add analytics, phone-home checks or remote fonts to the report.
- Mark a sprint task done without running `npm run verify`.
