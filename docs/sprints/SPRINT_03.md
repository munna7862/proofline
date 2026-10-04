# Sprint 3: Pass the spot-check on a real React Router app

**Goal:** close the Phase 1 coverage bar on the suite that failed it. On epic-stack, two identical runs print the same denominator and a hand spot-check of 20 elements is at least 19 correct, because devtools overlays, toasts, the previous route's leftovers and per-run list items no longer enter the inventory. buggy-books stays at 20/20. A fault "caught" only by a flaky test is reported as unstable, not as a catch.
**Capacity:** 14 hours (7 days × 2 h). Planned: 12.75 h + 1.25 h buffer.
**Demo at the end:** re-run buggy-books and epic-stack (`C:\Workspace\proofline-trials`, branch `proofline-trial`, Proofline from a fresh `npm pack` tarball) and show a before/after table against the S2 columns in docs/STATUS.md: coverage % and denominator for two runs each, caught / slipped / unstable / n/a / not reached. Hand spot-check of 20 elements per suite, at least 19 correct each; epic-stack denominator identical across the two runs.

**Priority call:** fix what the trial proved is wrong, nothing else. The 11 epic-stack spot-check misses map to S3-1 (8 devtools rows), S3-4 (toast, nameless span) and S3-2 (route bleed); the 12-row run-to-run gap maps to the same three. S3-3 is the one fault-check item in: the S1 headline true positive is currently hidden behind a flaky "catch", which breaks rule 7 (honest numbers). Shadow DOM, iframes, the config file and `proofline merge` have no trial evidence against them and move to Sprint 4; Phase 1 closes one week late (decision D-1).

## Decisions (founder approved 2026-10-04: all four as recommended)
D-1: option B. S3-T1: yes. S3-T3: yes, both parts. S3-T4: yes.

| Task | Decision | Recommendation |
|---|---|---|
| D-1 (schedule) | Phase 1 was due to end this sprint. Its exit criteria still list shadow DOM, iframes, repeated lists and shard merge. Option A: keep the date and squeeze all of it in (nothing gets proven on the trials). Option B: this sprint closes "runs on 2 public repos" and "repeated lists"; shadow DOM, iframes, config and merge become Sprint 4, Phase 1 exit moves to end of week 4, and every later phase moves one week. | B. Passing the spot-check on a real suite is the thing a buyer checks first; four new features on a suite that scores 9/20 would not be believed. |
| S3-T1 | Elements inside known dev-only overlays are never inventoried: TanStack Devtools, TanStack Query devtools, react-router-devtools (matched by their root element ids/classes/`data-*` markers, list kept in one constant in the agent). Changes the denominator. No user option this sprint; `ignoreElements` arrives with the config file in Sprint 4. | Yes. They are not part of the app under test and only appear in dev mode; a QA lead would strike them by hand. |
| S3-T3 | (a) Elements inside toast/live regions (`role=status`, `role=alert`, `aria-live` regions, `ol[data-sonner-toaster]`/`.toaster`) are not inventoried. (b) Three or more siblings in one list with the same DOM path shape, tag and role collapse into one element named `<role> in list (N seen)`; tested when any one of them is interacted with. Changes the denominator and how the untested list reads. | Yes to both, minimum 3 siblings, and the report shows "N seen" so nothing is hidden. Same logic as the learned `:param` the founder approved for views in S2-T1. |
| S3-T4 | A fault whose only killers (1 or 2 tests) pass when re-run once with the same fault is reported as **"unstable: flaky test"**: outside the score, listed in the report with the test names, and the CLI line gains an `unstable` count. Faults killed by 3+ tests are not re-checked (cost). This replaces Phase 2's "baseline twice" as the first flake defence; baseline twice is reconsidered in Sprint 5 with data from this rule. Changes fault scoring, report layout and the CLI summary line. | Yes. Re-running the fault (not the baseline) is the better test: a real kill fails again every time, a flaky one usually recovers, and it costs only the killers of 1–2-test catches. Retries stay 0; the rule is deterministic. |

## Tasks

- [x] **S3-T0 `npm pack` always builds (0.25 h)**
  S3-11: the first S2-T5 tarball shipped a stale `dist/` without the ENOBUFS fix. `package.json` has no `prepack` script.
  Accept:
  - `package.json` has `"prepack": "npm run build"`.
  - `npm pack` on a clean checkout prints the `tsc` build before the tarball list, and the tarball's `dist/cli.js` matches a fresh build.
  - `npm run verify` passes.
  Prompt:
  > Add "prepack": "npm run build" to package.json scripts. Delete dist/, run npm pack, and confirm the tarball contains a freshly built dist/cli.js. Delete the tarball. Run npm run verify and paste the summary line.

- [x] **S3-T1 Devtools overlays are not app elements; fix the element path (2 h, needs approval: inventory rule)**
  S3-1: 8 of 20 epic-stack spot-check rows were TanStack/React Router devtools buttons, about 10 per view, captured or not depending on timing (`/signup` 19 vs 10 elements between runs). Folds in S3-8: `<input name="id">` clobbers `form.id`, so paths read `form#[object HTMLInputElement]`.
  Accept:
  - The agent skips any element whose ancestor matches the devtools root list (one constant in `src/page/agent.ts`, commented with where each marker comes from).
  - The agent's path builder uses `getAttribute('id')`; a form containing `<input name="id">` gets a path with the form's real id or none.
  - Demo: a page with a fake devtools root holding 3 buttons, and a form with an `<input name="id">`. Ground truth in `demo/expected.json`: the devtools buttons are absent, the form path is clean.
  - `npm run calibrate` passes; commit shows the before/after summary line and says why it moved. The agent still never throws into the page.
  Prompt:
  > Read AGENTS.md, the founder's decision for S3-T1 in docs/sprints/SPRINT_03.md and the header comment of src/page/agent.ts (it runs in the browser and cannot import). Add a DEVTOOLS_ROOTS constant (TanStack Devtools, TanStack Query devtools, react-router-devtools; check each package's root markers and cite them in a comment) and skip any element inside one at capture time. Change the path builder to read ids with getAttribute('id'). Add a demo page with a fake devtools root and a form containing <input name="id">, ground truth in demo/expected.json, and unit tests for any logic testable outside the browser. Run npm run calibrate (before/after summary line) and npm run verify.

- [x] **S3-T2 No route-transition bleed (2.5 h)**
  S3-2: elements of the previous route are recorded under the new URL. epic-stack: the note editor's "Add image" on the note detail view after submit; buggy-books: +6 catalog rows under `/cart` in the flaky run (133 vs 139). This is a capture-timing bug, not a scoring rule.
  Accept:
  - A snapshot is discarded when the URL changed between the start and the end of the capture, and the agent captures again once the DOM has been quiet for the existing debounce after a URL change.
  - Demo: a client-side route change where the old view's button stays in the DOM for ~300 ms after `pushState`. Ground truth: that button belongs only to the old view.
  - Unit test for the "URL changed during capture" decision if it can live outside the agent; otherwise the calibration entry is the test.
  - `npm run calibrate` passes; `npm run demo` twice prints the same denominator.
  - **Done 2026-10-04, different mechanism:** a capture cannot straddle a URL change (the scan is synchronous), so instead elements present at the route change are held 600 ms and recorded only if still there. Limit: leftovers that linger longer than 600 ms still bleed; S3-T5 checks the buggy-books `/cart` and epic-stack "Add image" cases. Also: interacted elements are recorded at once, so a view left within the scan debounce keeps the elements its test used.
  Prompt:
  > Read AGENTS.md and the header comment of src/page/agent.ts. Reproduce route-transition bleed in the demo: a client-side navigation where the previous view's button stays mounted for about 300 ms after pushState. Fix capture so a snapshot whose URL changed during capture is dropped and retaken after the DOM settles. Add ground truth in demo/expected.json. Run npm run calibrate (before/after summary line), npm run demo twice to confirm a stable denominator, and npm run verify.

- [ ] **S3-T3 Toasts and repeated list items (2.5 h, needs approval: inventory + report)**
  S3-4: epic-stack has 26 faker-named note links whose keys are new every run, and a toast `Connected Your "<faker name>" GitHub account…` recorded as an element. Phase 1 exit also lists "repeated lists handled". The nameless `<span>` spot-check miss is checked here too (it sat in a toast region).
  Accept:
  - No element inside a toast/live region is inventoried (list per decision).
  - 3+ siblings with the same path shape, tag and role in one list become one element `<role> in list (N seen)`, tested when any member was interacted with. The grouping is a pure function in `src/coverage/aggregate.ts`, sorted input, no randomness.
  - HTML report and Markdown show the "N seen" count; the headline still reads "X of Y".
  - Demo: a toast after an action, and a list of 5 links with generated names where a test clicks one. Ground truth: no toast element; one list element, tested, 5 seen.
  - Unit tests for the grouping (2 siblings stay separate; different roles stay separate); `npm run calibrate` passes; commit explains the number change.
  Prompt:
  > Read AGENTS.md and the founder's decision for S3-T3 in docs/sprints/SPRINT_03.md. In src/page/agent.ts, skip elements inside role=status, role=alert, aria-live regions and known toaster roots. In src/coverage/aggregate.ts, add a pure function that collapses 3+ siblings with the same path shape, tag and role into one "<role> in list (N seen)" element, tested if any member was. Show N in the HTML report and Markdown summary. Add a demo toast and a generated-name list, ground truth in demo/expected.json, and unit tests including the negative cases. Run npm run calibrate (before/after summary line) and npm run verify.

- [ ] **S3-T4 Flaky catches become "unstable" (2 h, needs approval: fault scoring + report + CLI)**
  S3-3: buggy-books `GET /api/books` "Wrong numbers" shows as caught, but its only killer passes 3/3 with the fault and fails 1/3 without it. The real finding (no catalog test checks prices) is hidden.
  Accept:
  - `src/proof/plan.ts`: a fault killed by 1 or 2 tests re-runs those tests once with the same fault (retries 0). If any killer passes on the re-run, the fault is `unstable` with reason "flaky test: <name> passed on re-run"; it is outside the score.
  - Report and Markdown list unstable faults with test names and the replay id; the CLI line reads e.g. `Fault check 92.3% (12 caught, 1 slipped, 1 unstable, 8 n/a)`.
  - Demo: a test that fails only on its second invocation (counter file under the demo's test-results folder, deterministic), killing a fault on the first fault run. Ground truth `unstable`; `npm run demo:check` agrees.
  - Unit tests for the judging rule (1 killer flaky, 2 killers one flaky, 3 killers not re-checked); `npm run calibrate` passes.
  Prompt:
  > Read AGENTS.md and the founder's decision for S3-T4 in docs/sprints/SPRINT_03.md. In src/proof/plan.ts and the scan loop in src/cli.ts, re-run the killing tests of any fault caught by 1 or 2 tests once with the same fault and retries 0; if a killer passes, mark the fault unstable ("flaky test: <name> passed on re-run"), outside the score. Show unstable faults in the HTML report, the Markdown summary and the CLI summary line. Add a deterministic flaky demo test (fails only on its second invocation), ground truth in demo/expected.json, update scripts/check-demo-scan.ts, and add unit tests. Run npm run calibrate, npm run demo:scan, npm run demo:check and npm run verify.

- [ ] **S3-T5 Sprint demo: re-run both trials, before/after (1.5 h)**
  Fresh tarball (S3-T0 makes `npm pack` build), reinstall in both trial branches, coverage twice per suite (epic-stack with `--workers=1` as in S2), `npx proofline scan --max-mutants 20` once per suite. Start the buggy-books scan first (about 45 min machine time).
  Accept:
  - STATUS.md gets a before/after table per suite against the S2 columns: coverage % and denominator (both runs), caught / slipped / unstable / n/a / not reached.
  - epic-stack: denominator identical across the two runs; spot-check ≥ 19/20. buggy-books: spot-check still ≥ 19/20; denominator identical across runs in which the same tests pass.
  - buggy-books `GET /api/books` "Wrong numbers" reads unstable or slipped, not caught.
  - Misses logged as Sprint 4 candidates. Nothing pushed or published; trial branches stay local.
  Prompt:
  > Run npm pack in C:\Workspace\proofline and install the tarball in both repos under C:\Workspace\proofline-trials on branch proofline-trial. Run each suite's coverage twice (epic-stack with --workers=1) and npx proofline scan --max-mutants 20 once. Compare with the S2 columns in docs/STATUS.md and add a before/after table. Spot-check 20 elements per suite by reading the tests; log any miss as a Sprint 4 candidate. Do not push or publish anything.

- [ ] **S1-T5 Validation kit, carried over again (2 h, founder only, no agent)**
  Phase 0 exit; GTM and pricing depend on it. Screenshot the demo report (after S3-T1 to S3-T3 if possible, so the sample is the honest one). Create a free waitlist form (Google Forms or Tally). Send 10 DMs with docs/GO_TO_MARKET.md template A. Log replies in STATUS.md and book up to 5 conversations.
  Accept: waitlist link live; 10 DMs sent; reply count logged in STATUS.md.

**Total: 12.75 h** (S3-T0 0.25 + S3-T1 2 + S3-T2 2.5 + S3-T3 2.5 + S3-T4 2 + S3-T5 1.5 + S1-T5 2) + 1.25 h buffer.
Order: S3-T0 and S3-T2 on day 1 while approvals come in (neither needs one), then S3-T1, S3-T3, S3-T4, then S3-T5. S1-T5 any day. If the buffer runs out, S3-T4 moves to Sprint 4 before anything else is cut; the coverage tasks are the Phase 1 exit.

## Cut from this sprint (moved, see BACKLOG.md)
- Open shadow roots, same-origin iframes → Sprint 4. Still no trial evidence they cost accuracy.
- `proofline.config.json` (ignoreViews, ignoreElements, viewRules, infra endpoint excludes) → Sprint 4. Devtools and toasts get zero-config defaults first.
- `proofline merge` for CI shards → Sprint 4 (Phase 1 exit, per D-1).
- S3-5 learned `:param` for deeper paths, S3-6 views with inventory but no visitors → Sprint 4. Neither is among the 11 spot-check misses; S3-5 is first in line for the buffer if the demo shows it moves the denominator.
- S3-10 summary `schemaVersion` → Sprint 4 (needs architect; the crash is already fixed).
- S3-7 "reached another way" copy, Shared header/nav view → Sprint 6 report polish (both need report approval; the tested/untested state is already right).
- S3-9 never-enabled list flicker → backlog. Outside the score; accept as is.
- Baseline twice → Sprint 5, reconsidered with S3-T4 data. Agent overhead measurement, second public suite beyond the two trials → Sprint 5.
- Learned `:param` for endpoints, `--max-mutants` by impact → Sprint 5 (fault check).
- 5 more validation conversations → follow S1-T5.

## Risks this sprint
- Three of six tasks need founder approval. Mitigation: one approval message on day 1 covering D-1 and the three task rows; S3-T0 and S3-T2 need none.
- Every engine task moves the demo numbers (today `UI coverage 41.7% (5/12) | Fault check 92.9% (13 caught, 1 slipped, 8 n/a)`). Every commit shows the before/after calibrate line and says why.
- Devtools markers change between package versions. Mitigation: one constant with cited sources, and `ignoreElements` arrives in Sprint 4.
- List grouping can merge items that are genuinely different actions. Mitigation: same role and tag required, minimum 3, "N seen" visible, negative unit tests.
- epic-stack dev-server timeouts (7–8 of 24 tests at 4 workers in S2). Mitigation: `--workers=1` as in S2; a run where different tests fail does not count for the stability check.
- S3-T4 adds machine time to scans. Bounded to 1–2-test catches; the S3-T5 table records scan duration so the cost is visible.
- S1-T5 has slipped twice. If it slips again, Phase 0 is still open at the Phase 1 exit and pricing questions stay unanswered.
