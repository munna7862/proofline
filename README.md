# Proofline

[![ci](https://github.com/munna7862/proofline/actions/workflows/ci.yml/badge.svg)](https://github.com/munna7862/proofline/actions/workflows/ci.yml)

Proofline checks whether your Playwright tests would actually catch a broken app. Code coverage tells you what your tests ran; Proofline tells you what they would notice.

- **UI coverage**: which buttons, links and inputs your tests interact with, page by page. Only passing tests count.
- **Fault check**: Proofline breaks each API call your tests depend on (server error, network failure, empty result, wrong numbers, missing text), re-runs only the tests that make that call, and lists the tests that stay green while the app is broken.

Everything runs locally. Nothing is sent anywhere.

## Status

Version `0.1.0`, pre-release. **Not published to npm yet** (the unscoped name `proofline` on npm belongs to an unrelated package; install from source as shown below).

- Phase 0 (foundations) is done: the engine runs end to end in the real Playwright runner and matches the ground truth in `demo/expected.json` in CI.
- Phase 1 (UI coverage on real suites) is in progress, in Sprint 4. Trials run against two real suites: [buggy-books](https://github.com/munna7862/buggy-books) and epic-stack.
- Later phases (npm release, VS Code extension, paid tier) are planned. `vscode-extension/` is a skeleton and has not been run.

`docs/STATUS.md` logs every verified task and its result. The roadmap is in `docs/MASTER_PLAN.md`.

## Tech stack

- TypeScript (ESM), Node.js 22.18+ (runs `.ts` scripts directly with Node's type stripping)
- Playwright Test as a peer dependency (`>=1.45`), `playwright-core` for calibration
- `node:test` for unit tests
- GitHub Actions

## Use it in a Playwright project

1. Build a tarball and install it:
   ```bash
   git clone https://github.com/munna7862/proofline.git
   cd proofline && npm ci && npm pack          # prepack builds dist/
   cd ../your-project
   npm i -D ../proofline/proofline-0.1.0.tgz
   ```
2. Change the import in your tests:
   ```ts
   import { test, expect } from 'proofline/playwright';
   ```
3. Add the reporter in `playwright.config.ts`:
   ```ts
   reporter: [['list'], ['proofline/reporter']],
   ```
4. Run:
   ```bash
   npx playwright test                                   # UI coverage -> .proofline/report/index.html
   npx proofline scan                                    # adds the fault check
   npx proofline replay <id>                             # watch one fault in a headed browser
   npx proofline check --min-coverage 50 --min-proof 70  # CI gate, exits 1 below the thresholds
   ```

`npx proofline init` prints these steps. If you already have custom fixtures, merge them:

```ts
import { mergeTests } from '@playwright/test';
import { test as proofline } from 'proofline/playwright';
import { test as mine } from './fixtures';
export const test = mergeTests(mine, proofline);
```

## Develop

```bash
npm install
npx playwright install chromium
npm run verify       # typecheck + unit tests + engine calibration on the demo shop
npm run demo         # coverage on the demo suite in the real runner
npm run demo:scan    # fault check on the demo suite
npm run demo:check   # compare real-runner results with demo/expected.json
npm run shop         # start the demo shop on its own
```

## Project structure

```
src/
  cli.ts               proofline report | scan | replay | check | init
  playwright/          test fixture and reporter (the public entry points)
  page/agent.ts        in-browser agent that inventories elements and records interactions
  coverage/            collector and aggregation into per-view coverage
  proof/               network recorder, fault operators, injection, planning and scoring
  report/              HTML and Markdown reports
demo/                  demo shop, its Playwright suite and expected results (npm workspace)
scripts/               calibration and ground-truth checks
test/                  unit tests (node:test)
vscode-extension/      VS Code extension skeleton (Phase 4)
docs/                  architecture, decisions, master plan, sprints, status log
```

`docs/ARCHITECTURE.md` explains how the adapter, coverage engine and proof engine fit together.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. `npm run verify`: typecheck, unit tests and engine calibration.
2. `npm run demo` and `npm run demo:scan`: Proofline run against its own demo suite.
3. `npm run demo:check`: the real-runner results must match `demo/expected.json`.

The HTML reports are uploaded as the `proofline-report` artifact.

## Working with AI agents

Claude Code reads `CLAUDE.md`; other agents read `AGENTS.md` or `GEMINI.md`. Start with `AGENTS.md`, then `docs/MASTER_PLAN.md` and the current sprint in `docs/sprints/`.

## License

MIT
