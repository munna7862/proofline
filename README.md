# Proofline

**Proof that your Playwright tests work.**
Coverage tells you what your tests ran. Proofline tells you what they'd catch.

- **UI coverage:** which buttons, links and inputs your tests actually touch, page by page.
- **Fault check:** Proofline breaks each API your tests depend on (server error, network failure, empty result, wrong numbers, missing text), re-runs only the tests that call it, and lists the tests that stay green while the app is broken.

Everything runs locally. Nothing leaves your machine.

## Quick start

```bash
npm i -D proofline
```

1. Change the import in your tests:
   ```ts
   import { test, expect } from 'proofline/playwright';
   ```
2. Add the reporter in `playwright.config.ts`:
   ```ts
   reporter: [['list'], ['proofline/reporter']],
   ```
3. Run:
   ```bash
   npx playwright test     # UI coverage → .proofline/report/index.html
   npx proofline scan      # adds the fault check
   npx proofline replay <id>   # watch one fault, headed
   npx proofline check --min-coverage 50 --min-proof 70   # CI gate
   ```

Already have your own fixtures? Combine them:
```ts
import { mergeTests } from '@playwright/test';
import { test as proofline } from 'proofline/playwright';
import { test as mine } from './fixtures';
export const test = mergeTests(mine, proofline);
```

## Developing Proofline

Requirements: Node 22.18+, Git. No paid services.

```bash
npm install
npx playwright install chromium
npm run verify        # typecheck + unit tests + engine calibration on the demo shop
npm run demo          # coverage on the demo suite in the real runner
npm run demo:scan     # fault check on the demo suite
npm run demo:check    # real-runner results vs demo/expected.json
```

Start with `AGENTS.md`, then `docs/MASTER_PLAN.md` and `docs/sprints/SPRINT_01.md`.
Working with AI agents: Claude Code reads `CLAUDE.md` (personas in `.claude/agents`, commands in `.claude/commands`). Antigravity reads `AGENTS.md`/`GEMINI.md` and workflows in `.agent/workflows`.

## Status
See `docs/STATUS.md` for exactly what has been verified and what Sprint 1 verifies.

## License
MIT
