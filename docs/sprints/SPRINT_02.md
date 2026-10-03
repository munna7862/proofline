# Sprint 2: A coverage number a QA lead can trust

**Goal:** the number on the first screen survives a QA lead's spot-check. On the two Sprint 1 trial suites, the coverage denominator stays the same between identical runs, links count only when a test clicks them, no phantom elements appear in the report, and already-failing endpoints are not reported as slipped faults.
**Capacity:** 14 hours (7 days × 2 h). Planned: 13 h + 1 h buffer.
**Demo at the end:** re-run buggy-books and epic-stack (`C:\Workspace\proofline-trials`, branch `proofline-trial`, Proofline from a fresh `npm pack` tarball) and show a before/after table on the same suites: coverage %, denominator, and scan results. Hand spot-check of 20 elements per suite with at least 19 correct (Phase 1 acceptance test).

**Priority call:** coverage trust first, then fault-check trust. Four fixes finished and proven on real suites beat eight half-built ones. Shadow DOM, iframes and the config file move to Sprint 3 (see BACKLOG.md).

## Decisions (founder approved 2026-10-03: all four as recommended)
S2-T1: yes, views only, minimum 3 values. S2-T2: option A. S2-T3: yes. S2-T4: yes, both parts.

**S2-T3 follow-up (founder approved 2026-10-03, as recommended):** Playwright's `setInputFiles` dispatches untrusted `input`/`change` events, so filled file inputs were always untested. The agent now accepts untrusted `input`/`change` on `input[type=file]` only; every other element still needs a trusted event. Demo 4/12 → 5/12.

| Task | Decision | Recommendation |
|---|---|---|
| S2-T1 | Collapse a path segment into `:param` when the baseline shows the same parent with 3+ different values, each seen in only one test (catches faker usernames)? Risk: merges genuinely different pages such as `/docs/intro` and `/docs/api`. | Yes for views only, minimum 3 values, never for segments that also appear as fixed links in the inventory. Endpoints keep shape-based rules only this sprint. |
| S2-T2 | A link whose destination was visited but which no test clicked: (A) counts as untested, report adds "reached by URL" note; (B) removed from the denominator as an unscored "reached by URL" state; (C) keep today's rule. Changes scoring and report layout. | A. The link was never exercised; B inflates the percentage. |
| S2-T3 | Elements that are `disabled` or `aria-busy="true"` at capture time are not recorded. An element never seen enabled is listed as "not applicable: never enabled", outside the score but visible. Changes the denominator. | Yes. |
| S2-T4 | `http-500` and `network-fail` on an endpoint whose every baseline response was already 4xx/5xx become "not applicable: already failing in baseline". Changes fault scoring and the weakest-test pick. Also: CLI prints "Fault check n/a (0 judged)" instead of "0%" when nothing was judged. | Yes, both. |

## Tasks

- [x] **S2-T1 Normalize generated ids and per-user segments (3 h, learned-param rule needs approval)**
  Root cause of the unstable denominator (epic-stack 554 → 680 between identical runs) and of 4 of 4 per-user endpoint faults being "not reached".
  Part 1 (no approval): in `src/util/normalize.ts` and the agent's copy in `src/page/agent.ts`, map cuid/cuid2/nanoid/ulid shapes (mixed letters and digits, length ≥ 20) to `:id`, alongside existing numeric/uuid rules. Because `inject.ts` matches through `normalizePath`, fault injection follows automatically.
  Part 2 (after approval): learned `:param` for view keys in `src/coverage/aggregate.ts`, pure and deterministic (sorted input, no randomness).
  Demo: add a route with a cuid in the path and two tests that each visit a different `/users/<name>` page; add a `views` ground-truth entry to `demo/expected.json` (extend `scripts/ground-truth.ts` if needed).
  Accept:
  - Unit tests: `normalizePath('/notes/cmusge6wr0004pndce18dw4iq')` → `/notes/:id`; `/users/ag_theodora_conroy` stays verbatim through `normalizePath`; plain words like `/settings/notifications` are never collapsed.
  - `npm run calibrate` passes; the views list matches ground truth; commit message states the old and new demo summary line.
  - epic-stack: two identical coverage runs print the same denominator. *(Trial repos are on the founder's machine; checked in S2-T5.)*
  Prompt:
  > Read AGENTS.md, then src/util/normalize.ts and the header comment of src/page/agent.ts. Add cuid/cuid2/nanoid/ulid shape normalization to both copies of normalizePath (letters+digits mixed, length >= 20, never a plain word). Add unit tests in test/ for positive and negative cases. Add a demo route with a cuid in the path, a test that visits it, and a views entry in demo/expected.json. Run npm run calibrate and npm run verify and paste the summary lines. Do not implement learned :param collapsing until the founder approves the rule in docs/sprints/SPRINT_02.md; then implement it as a pure function in src/coverage/aggregate.ts with its own unit tests and demo case.

- [x] **S2-T2 Links count only when clicked (2.5 h, needs approval: scoring + report layout)**
  buggy-books: 59 of 106 "tested" elements had no interaction; interaction-only coverage is 33.3%, not 75%.
  Accept (assuming decision A):
  - `src/coverage/aggregate.ts`: a link is tested only on interaction. A link whose destination was visited is untested and carries `reachedByUrl: true`.
  - Report shows the link in the untested list with the note "Destination visited by URL, link never clicked". The headline still reads "X of Y" with the same denominator.
  - Demo: add a link whose destination a test opens with `page.goto`; ground truth lists it as untested with `reachedByUrl`.
  - Unit test for the rule; `npm run calibrate` passes; commit explains the number change.
  Prompt:
  > Read AGENTS.md and the founder's decision for S2-T2 in docs/sprints/SPRINT_02.md. In src/coverage/aggregate.ts, remove the rule that marks a link tested when its destination view was visited; keep that fact as reachedByUrl on the untested entry. Show it in the HTML report and Markdown summary as "Destination visited by URL, link never clicked". Add a demo link reached only via page.goto, a ground-truth entry in demo/expected.json and a unit test. Run npm run calibrate (show before/after summary line) and npm run verify.

- [x] **S2-T3 No phantom elements from busy states and file inputs (2 h, needs approval: inventory rule)**
  buggy-books: "Authenticating...", "Creating account...", "Processing..." (×2), "Uploading Picture..." appear as untested elements; the file input appears as 4 elements named `C:\fakepath\...`.
  Accept:
  - Agent never uses `value` as the accessible name for `input[type=file]` (or any input whose value is user-typed); falls back to label, then `id`/`name`, then placeholder.
  - Elements that are `disabled` or `aria-busy="true"` at capture time are not added to the inventory; per decision, elements never seen enabled are listed as "not applicable: never enabled".
  - Demo: a button that becomes disabled with text "Processing..." while a request runs, and a file input a test fills; ground truth has exactly one entry for each.
  - `npm run calibrate` passes; agent still never throws into the page.
  Prompt:
  > Read AGENTS.md and the header comment of src/page/agent.ts (it runs in the browser and cannot import). Change element naming so input values are never used as names for file inputs, and skip disabled or aria-busy elements at capture time. Add a demo page with a busy-state submit button and a file input, ground truth in demo/expected.json, and unit tests where the logic is testable outside the browser. Run npm run calibrate (before/after summary line) and npm run verify.

- [ ] **S2-T4 Already-failing endpoints are not slipped faults (2 h, needs approval: fault scoring)**
  buggy-books `POST /api/auth/refresh`: baseline 401, so 500 and network-fail "survived" and made UI_REF_02 the weakest test.
  Accept:
  - Baseline recorder stores the response status per endpoint per test (status only, never bodies).
  - `src/proof/plan.ts`: `http-500` and `network-fail` are "not applicable: already failing in baseline" when every baseline response for that endpoint was ≥ 400. Mixed endpoints are still faulted.
  - Report and Markdown show the reason next to the n/a fault; n/a stays out of the score.
  - CLI prints `Fault check n/a (0 judged)` instead of `0%` when no fault was judged.
  - Demo: an endpoint that returns 401 in baseline (for example `GET /api/account` without login) with ground truth `not-applicable` for both operators; existing 11 caught / 1 slipped unchanged.
  Prompt:
  > Read AGENTS.md and the founder's decision for S2-T4 in docs/sprints/SPRINT_02.md. Record the baseline status per endpoint in src/proof/inject.ts (status code only). In src/proof/plan.ts, mark http-500 and network-fail not-applicable with reason "already failing in baseline" when every baseline status for the endpoint is >= 400. Make the CLI print "n/a (0 judged)" when nothing was judged. Add a demo endpoint that returns 401 in baseline, ground truth in demo/expected.json, and unit tests. Run npm run calibrate, npm run demo:check and npm run verify.

- [ ] **S2-T5 Sprint demo: re-run both trials, before/after (1.5 h)**
  Pack a fresh tarball, reinstall in both trial branches, run coverage twice and `npx proofline scan --max-mutants 20` once per suite (start the buggy-books scan first; it takes about 45 min of machine time).
  Accept:
  - STATUS.md gets a before/after table per suite: coverage % and denominator (both runs), caught / slipped / n/a / not reached.
  - Expected direction: buggy-books coverage drops from 75% toward the interaction-only figure; epic-stack denominator identical across runs; buggy-books `POST /api/auth/refresh` faults move to n/a.
  - 20 elements per suite spot-checked by hand, at least 19 correct; misses logged as Sprint 3 candidates.
  - Nothing published; trial branches stay local.
  Prompt:
  > Run npm pack in C:\Workspace\proofline and install the tarball in both repos under C:\Workspace\proofline-trials on branch proofline-trial. Run each suite's coverage twice and npx proofline scan --max-mutants 20 once. Compare with the S1-T6 numbers in docs/STATUS.md and add a before/after table. Pick 20 elements per suite from the report and check each by reading the tests; list any misclassification as a Sprint 3 candidate. Do not push or publish anything.

- [ ] **S1-T5 Validation kit, carried over (2 h, founder only, no agent)**
  Screenshot the demo report (desktop; ideally after S2-T2 so the number is the honest one). Create a free waitlist form (Google Forms or Tally). Send 10 DMs with docs/GO_TO_MARKET.md template A. Log replies in STATUS.md and book up to 5 conversations for Sprint 3.
  Accept: waitlist link live; 10 DMs sent; reply count logged in STATUS.md.

**Total: 13 h** (S2-T1 3 + S2-T2 2.5 + S2-T3 2 + S2-T4 2 + S2-T5 1.5 + S1-T5 2) + 1 h buffer.
Order: S2-T1 part 1 on day 1 while approvals come in, then T2, T3, T4, then T5. S1-T5 any day.

## Cut from this sprint (moved, see BACKLOG.md)
- Open shadow roots and same-origin iframes → Sprint 3. No trial evidence that they cost accuracy yet; the trial misclassifications did.
- `proofline.config.json` (ignoreViews, ignoreElements, viewRules) → Sprint 3. Zero config must be right first; config is the escape hatch, not the fix.
- Learned `:param` for endpoints (per-user faults on epic-stack) → Sprint 3. Needs the baseline's learned patterns passed into fault runs.
- Candidate #4 `--max-mutants` ordering by impact → Sprint 3 (Scale). Denominators are already honest; this changes which faults run, and doing it now would blur the before/after demo.
- Candidate #6 shared header/nav as one "Shared" view → Sprint 3 (report layout, needs approval).
- Candidates #7 scan time and #9 framework fallbacks → Sprint 4.
- Candidate #8 turbo-stream body operators → backlog (Phase 2+).
- Candidate #10 small items (infra endpoint excludes, launch-failure message, string-reporter README line, Git Bash slash note) → Sprint 3 excludes, Sprint 5 docs. The "0%" CLI line is fixed in S2-T4.
- `replay` defaulting to survivors → Sprint 5.
- `mergeTests` recipe → Sprint 5 README rewrite (neither trial needed it).
- 5 more validation conversations → Sprint 3; this sprint books them via S1-T5.

## Risks this sprint
- Four of five engine tasks need founder approval. Mitigation: one approval message on day 1; S2-T1 part 1 needs none.
- Each task moves the demo numbers (today `UI coverage 28.6% (2/7) | Fault check 91.7% (11 caught, 1 slipped, 3 n/a)`). Every commit must show the before/after calibrate line and say why.
- Shape-based id rules can over-match real words. Mitigation: negative unit tests and the mixed letters+digits requirement.
- S2-T5 machine time (buggy-books scan about 45 min). Start it first and run epic-stack coverage meanwhile.
- Phase 1 exit (week 3) now depends on Sprint 3 delivering shadow DOM, iframes, config and merge together. Re-check scope at the Sprint 3 plan.
