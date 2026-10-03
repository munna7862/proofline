# Architecture

```
            your Playwright tests
                    │  import { test } from 'proofline/playwright'
                    ▼
   ┌──────────── adapter (src/playwright) ─────────────┐
   │ auto fixture: picks mode from PROOFLINE_MODE      │
   │ reporter: builds coverage report at end of run    │
   └───────┬──────────────────────┬────────────────────┘
           │ BrowserContext        │ BrowserContext
           ▼                       ▼
   coverage engine           proof engine
   page/agent.ts (browser)   inject.ts: NetworkRecorder (baseline)
   collector.ts              inject.ts: injectMutant (context.route)
   aggregate.ts              plan.ts: plan, judge, score
           │                       │
           └──────► .proofline/raw/*.json ◄──────┘   (one file per test; works across workers and shards)
                            │
                            ▼
                  report/ (HTML, Markdown, JSON)  ◄── cli.ts (report | scan | replay | check | init)
```

## Modes (PROOFLINE_MODE)

| Mode | Set by | Fixture does | Output |
|---|---|---|---|
| coverage (default) | normal `npx playwright test` | page agent records inventory + trusted interactions | raw/coverage/<testId>.json |
| record | `proofline scan` step 1 | records fetch/xhr endpoints and whether they return JSON | raw/network/<testId>.json |
| mutant | `proofline scan` step 2, `replay` | injects one fault, records hit/changed + final status | raw/mutants/<id>/<testId>.json |
| off | user | nothing | nothing |

## Scoring rules

**UI coverage**
- Interactive element = link, button, input, select, textarea, summary, contenteditable, ARIA widget roles, positive tabindex. Hidden elements are ignored.
- Identity = role + accessible name (digits replaced by #) + test id, per view. Repeated rows with the same identity count once. Form fields (text, file and other inputs, textarea, select) are named by label, then `name`/`id`, then placeholder, never by their value, so a typed search term or a picked file (`C:\fakepath\...`) never becomes an element.
- Not applicable, never enabled = an element no test ever saw enabled (only `disabled` or inside `aria-busy="true"`, such as a "Processing..." label). Listed per view in the report, outside the score. Seen enabled once, or interacted with, it is scored.
- Tested = a trusted click, double-click, context-menu, input or change event on it (or inside it). File inputs also count on untrusted input/change, because Playwright's `setInputFiles` dispatches those untrusted. Links count only when clicked; a link whose destination some test opened by URL stays untested and is marked "Destination visited by URL, link never clicked".
- View = path with ids, uuids and hashes normalized (numbers and cuid/cuid2/nanoid/ulid shapes become `:id`); hash-router paths included. Per-test segments are learned at aggregation: when 3+ values under the same parent each come from a different single test and none is a link shared by 2+ tests, that segment becomes `:param` (`/users/:param`).
- Score = tested / total, across all visited views.

**Fault check**
- Faults are planned only for endpoints that tests which PASSED the baseline called.
- One fault = one endpoint × one operator. Only tests that called that endpoint run.
- Killed = at least one of those tests failed while the fault was active.
- Survived = the fault changed a response and every test that received it passed.
- Not reached / not applicable / error are shown but excluded from the score.
- Score = killed / (killed + survived).

## Known limits (see RISKS.md)
- Requests made by Node (`request` fixture) are not injected, only browser fetch/xhr.
- Tests that create their own contexts with `browser.newContext()` are not covered yet.
- Server-side rendering that fetches data on the server cannot be faulted from the browser.
