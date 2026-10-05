# Sprint 4: Trial numbers a QA lead can be shown

**Goal:** both trial suites pass the Phase 1 bar, and the results are written up for the leads.
- On buggy-books and epic-stack, two identical runs print the same denominator. Only passing tests count.
- A hand spot-check of 20 elements per suite gets at least 19 right.
- Every remaining S3-T5 cause is fixed:
  - per-run names (S4-1)
  - pointer-down menus (S4-2)
  - learned `:param` gaps and over-matches (S4-3)
  - failing tests' coverage (S4-4)
  - nested links and renamed fields (S4-5, S4-6)
  - focus guards (S4-7)
- The trial results are written up as a short document the QA leads can read. S1-T5 showed this is what they will decide on.

**Capacity:** 14 hours (7 days × 2 h). Planned: 13.5 h + 0.5 h buffer.

**Demo at the end:**
- Re-run buggy-books and epic-stack (`C:\Workspace\proofline-trials`, branch `proofline-trial`, Proofline from a fresh `npm pack` tarball).
- Show a before/after table against the S3 columns in docs/STATUS.md.
- Hand spot-check 20 elements per suite, at least 19 correct each.
- Hand the leads' write-up (S4-T7) to the founder.

**Priority call:**
- The leads (S1-T5) will judge Proofline on the trial runs, so this sprint fixes only what the S3-T5 trial proved wrong, then writes it up.
- Shadow DOM, same-origin iframes, `proofline.config.json` and `proofline merge` have no trial evidence against them and move to Sprint 5. As a result, Phase 1 closes at the end of week 5 instead of week 4, and every later sprint moves one week.
- S4-8 (not-reached flips with dev-server timing) is a fault-check item and goes with "baseline twice" in Sprint 6.

## Decisions (founder approved 2026-10-05: S4-1 to S4-4 as recommended, schedule as proposed)

| Task | Decision | Recommendation |
|---|---|---|
| Schedule | Shadow DOM, iframes, config file and `merge` move from Sprint 4 to Sprint 5; Phase 1 exit moves to the end of week 5. | Yes. The leads asked to see trial runs; four features nobody has asked for would not move that. |
| S4-T1 (S4-1) | In one view, elements with the same path, tag and role, whose names each come from a single test, become one element when there are 3+ names (`<role> per test (N seen)`). Tested when any of them was. Changes the denominator. | Yes. Same reasoning as learned `:param` (S2-T1) and list grouping (S3-T3). Names seen by 2+ tests (real, fixed labels) are never merged. |
| S4-T2 (S4-2) | A trusted `pointerdown` on an element with `aria-haspopup` or `aria-expanded` counts as an interaction. Changes the definition of "tested". | Yes, only for those menu and disclosure triggers. A general `pointerdown` rule would also count drag starts. |
| S4-T3 (S4-3) | Learned `:param`: (a) never learn the first path segment unless the values look generated (contain a digit, or have 20+ characters); (b) once a position is learned under a parent, apply it to every descendant view of that parent; (c) a test's own page (`/users/<that test's user>`) joins the learned view when its parent was learned. Changes views and the denominator. | Yes. (a) fixes the S3-12 over-match, (b) and (c) fix the epic-stack gaps. |
| S4-T4 (S4-4) | Coverage counts only the inventory and interactions of tests that passed, the rule the fault check already uses. The report and the reporter line say "N tests failed, their coverage is not counted". Changes scoring. | Yes. A timed-out test's partial coverage changes between runs and is not a stable fact about the suite. |

S4-T0, S4-T5 and S4-T6 need no new rule:
- S4-T0 adds focus guards to the existing "not app elements" list.
- S4-T5 makes the agent follow the documented "on it or inside it" rule and stop recording one node under two keys.
- S4-T6 is the trial re-run.

## Tasks

- [ ] **S4-T0 Focus guards are not app elements (0.5 h)**
  S4-7: a nameless `body > span` on epic-stack, Radix's invisible `tabindex=0` focus-guard. It was a spot-check miss in S2 and S3.
  Accept:
  - The agent's ignore list skips `[data-radix-focus-guard]`, `[data-focus-guard]` and Headless UI's focus guard. Each marker is checked in the package source and cited in a comment, as `DEVTOOLS_ROOTS` was.
  - Demo: the help page gets a focus-guard span. Ground truth keeps both help views' exact element lists, so it must be absent.
  - `npm run calibrate` passes. Numbers do not move.
  Prompt:
  > Read AGENTS.md and the header comment of src/page/agent.ts. Add focus-guard markers (Radix data-radix-focus-guard, Headless UI focus guard, generic data-focus-guard; read each in the package source and cite it) to the agent's ignore selector. Add a focus-guard span to the demo help page; ground truth already pins its elements. Run npm run calibrate (before/after line) and npm run verify.

- [ ] **S4-T1 Elements named by per-run data count once (2.5 h, approved: inventory rule)**
  S4-1: every row that differs between two passing epic-stack runs is a name built from faker data. Examples: "<name>'s Notes", "Change email from <email>", "<name> profile", note titles.
  Accept:
  - A pure function in `src/coverage/aggregate.ts` (sorted, deterministic) groups elements in one view with the same path, tag and role.
    - The group collapses when 3+ distinct names each come from exactly one test.
    - The result is one element, key `<role>|per test|<path>`, named `per test (N seen)`.
    - It is tested if any member was.
  - Names seen by 2+ tests are never merged.
  - It runs after list grouping (S3-T3) and does not merge list groups.
  - HTML report and Markdown show it like the list element ("link per test (N seen)").
  - Demo: a page where each of 3 tests sees a link named after its own generated user, plus a fixed link at the same path seen by all 3. Ground truth: one per-test element (3 seen), and the fixed link stays separate.
  - Unit tests:
    - 2 names stay separate.
    - A name seen by 2 tests stays separate.
    - Different paths stay separate.
    - Input order does not change the result.
  - `npm run calibrate` passes; the commit explains the number change.
  Prompt:
  > Read AGENTS.md, the founder's decision for S4-T1 in docs/sprints/SPRINT_04.md, and groupListItems/learnViewParams in src/coverage/aggregate.ts. Add a pure function that merges, within one view, elements with the same path, tag and role whose names each come from a single test, when there are 3 or more, into one "<role> per test (N seen)" element, tested if any member was. Never merge names seen by 2+ tests. Show it in the HTML report and Markdown. Add a demo page with per-test names plus a shared fixed link, ground truth in demo/expected.json, unit tests including the negative cases. Run npm run calibrate (before/after line), npm run demo twice, npm run verify.

- [ ] **S4-T2 Menu triggers that open on pointerdown count as tested (1.5 h, approved: definition of tested)**
  S4-2: Radix's "User menu" on epic-stack opens on `pointerdown`; the modal menu then blocks the `click`. Three tests click it, yet it shows untested on 10 views.
  Accept:
  - The agent records an interaction on a trusted `pointerdown` whose closest interactive element has `aria-haspopup` or `aria-expanded`. Every other element still needs click, input or change.
  - Demo: a menu button with `aria-haspopup="menu"` that opens on pointerdown and sets `pointer-events: none` on the body while open (the Radix pattern); a test opens it and picks an item. Ground truth: the trigger is tested. The old agent fails it.
  - `docs/ARCHITECTURE.md` "Tested =" line updated; `npm run calibrate` passes.
  Prompt:
  > Read AGENTS.md, the founder's decision for S4-T2 and the header comment of src/page/agent.ts. Count a trusted pointerdown as an interaction only when the closest interactive element has aria-haspopup or aria-expanded. Add a demo menu that opens on pointerdown and blocks the following click (pointer-events: none on body while open), a test that opens it and picks an item, and ground truth in demo/expected.json. Update the "Tested =" rule in docs/ARCHITECTURE.md. Run npm run calibrate (before/after line) and npm run verify.

- [ ] **S4-T3 Learned `:param` rework (2.5 h, approved: view rule)**
  S4-3, folding in S3-5 and S3-12. epic-stack's `/users/<test user>` stays verbatim. In the S3-T4 demo, three unlinked top-level pages merged into `/:param`.
  Accept:
  - `learnViewParams`:
    - It never learns the first path segment unless every value contains a digit or has 20+ characters.
    - A position learned under a parent applies to every descendant view of that parent, including views visited by 1 or 2 tests.
  - Demo:
    - Three unlinked top-level pages, each visited by one test, stay separate.
    - `/users/<name>/notes` pages for the 3 profile users join `/users/:param/notes`.
    - Move the tips page back to `/tips` to prove (a).
  - Unit tests for (a) and (b), including the negative case of a real top-level page with a digit-free name.
  - `npm run calibrate` passes; the views list in ground truth is exact.
  Prompt:
  > Read AGENTS.md, the founder's decision for S4-T3 and learnViewParams in src/coverage/aggregate.ts. Never learn :param at the first path segment unless every value contains a digit or is 20+ characters; once a position is learned under a parent, apply it to every descendant view of that parent. Add demo cases (three unlinked top-level pages stay separate; per-user subpages join the learned view; move /help/tips back to /tips), exact views in demo/expected.json, and unit tests. Run npm run calibrate (before/after line) and npm run verify.

- [ ] **S4-T4 Only passing tests count toward coverage (1.5 h, approved: scoring)**
  S4-4: the epic-stack 2FA test times out at a different step in each run. Its partial coverage added 4 rows and 2 views to one run only.
  Accept:
  - `aggregateCoverage` ignores records whose status is set and is not `passed`. A record with no status, from an older Proofline, still counts.
  - `CoverageSummary` gains `testsExcluded`.
  - The HTML report, Markdown and reporter line say "N tests failed; their coverage is not counted" when N > 0.
  - Demo: a test that fails after visiting a page no other test visits. Ground truth: that view is absent, and the summary says 1 excluded.
  - Unit test; `docs/ARCHITECTURE.md` scoring rule updated; `npm run calibrate` passes.
  Prompt:
  > Read AGENTS.md and the founder's decision for S4-T4. In src/coverage/aggregate.ts, count only records with status "passed" (records without a status still count); add testsExcluded to CoverageSummary and show "N tests failed; their coverage is not counted" in the HTML report, Markdown and reporter line. Add a demo test that fails after visiting a page nobody else visits, ground truth, and a unit test. Update docs/ARCHITECTURE.md. Run npm run calibrate (before/after line), npm run demo, npm run verify.

- [ ] **S4-T5 Nested links and renamed fields (2 h)**
  S4-5: on buggy-books, the "Proceed to Checkout" `<a>` wraps a `<button>`. The click credits only the button, although the documented rule is "an event on it (or inside it)".
  S4-6: `/login` records the password field twice. Once as `txt_pwd_#`, before the app sets its id, and once as "Password".
  Accept:
  - Nested elements: an interaction also credits an ancestor link or button whose only interactive descendant is the clicked element (a link that just wraps one button). Both are recorded as tested.
  - Renamed fields:
    - The agent remembers the key it first sent for each node (WeakMap).
    - When the same node later gets a different name, it sends a `rename` message, and the collector replaces the old key in that test's inventory and interactions.
    - Only the final name reaches the report.
  - Demo:
    - a link wrapping a button that a test clicks
    - an input whose id (and so its label) is set 300 ms after load, and a test fills it
  - Ground truth: the link is tested, and the input appears once under its label.
  - `npm run calibrate` passes; the agent never throws into the page.
  Prompt:
  > Read AGENTS.md and the header comment of src/page/agent.ts. (1) When a trusted interaction hits an element whose ancestor link or button has no other interactive descendant, credit that ancestor too. (2) Keep a WeakMap from node to the key first sent; when a node's key changes, emit a rename message and make the collector replace the old key in that test's inventory and interactions. Add demo cases (link wrapping a button; input whose id/label is set after 300 ms), ground truth, and collector unit tests for rename. Run npm run calibrate (before/after line) and npm run verify.

- [ ] **S4-T6 Sprint demo: re-run both trials, before/after (1.5 h)**
  Steps:
  - Pack a fresh tarball and reinstall it in both trial branches.
  - Run coverage twice per suite (epic-stack with `--workers=1`).
  - Run `npx proofline scan --max-mutants 20` once per suite. Start the buggy-books scan first; it took about 45 min in S3.
  Accept:
  - STATUS.md gets a before/after table per suite against the S3 columns: coverage % and denominator for both runs, tests excluded, and caught / slipped / unstable / n/a / not reached.
  - Both suites print the same denominator across the two runs.
  - Spot-check of 20 elements per suite, at least 19 correct each.
  - Misses are logged as Sprint 5 candidates. Nothing pushed or published.
  Prompt:
  > Run npm pack in C:\Workspace\proofline and install the tarball in both repos under C:\Workspace\proofline-trials on branch proofline-trial. Run each suite's coverage twice (epic-stack with --workers=1) and npx proofline scan --max-mutants 20 once. Compare with the S3 columns in docs/STATUS.md and add a before/after table. Spot-check 20 elements per suite by reading the tests; log any miss as a Sprint 5 candidate. Do not push or publish anything.

- [ ] **S4-T7 Trial write-up for the QA leads (1.5 h)**
  S1-T5: the leads want to see the trial runs before deciding.
  Accept:
  - `docs/trials/TRIALS_2026-10.md`, one page per suite. Each page covers:
    - What Proofline was given: the two-line integration.
    - Coverage with its denominator, and what the untested list shows.
    - The fault check, with 2–3 concrete slipped faults: which tests stayed green and what that means. Examples: no catalog test checks prices; the cart "Missing text".
    - What "unstable" caught.
    - The spot-check method and score.
    - Known limits, stated plainly.
  - Numbers only from S4-T6, each with its denominator. No response bodies, no user data, and nothing from an employer.
  - The public projects are named with credit and without mockery. The document is for private sharing; nothing is posted.
  - The report-designer persona reviews the wording.
  Prompt:
  > Read AGENTS.md, docs/GO_TO_MARKET.md and the S4-T6 results in docs/STATUS.md. Write docs/trials/TRIALS_2026-10.md for QA leads: per suite, what Proofline was given, coverage with denominator, the most telling slipped faults (which tests stayed green and why it matters), what "unstable" caught, the spot-check method and score, and the known limits. Every number with its denominator, no response bodies or user data, credit the projects, no mockery. Do not publish or post anything.

**Total: 13.5 h**:

| Task | Hours |
|---|---|
| S4-T0 | 0.5 |
| S4-T1 | 2.5 |
| S4-T2 | 1.5 |
| S4-T3 | 2.5 |
| S4-T4 | 1.5 |
| S4-T5 | 2 |
| S4-T6 | 1.5 |
| S4-T7 | 1.5 |

That leaves 0.5 h of buffer.

**Order:**
1. S4-T0 and S4-T4 on day 1: S4-T4 removes failing-test noise before the other fixes are measured.
2. S4-T3, then S4-T1, both of which change keys and views.
3. S4-T2 and S4-T5.
4. S4-T6, then S4-T7.

If the buffer runs out, S4-T5's renamed-field half moves to Sprint 5 first. It caused 1 of 4 misses.

## Cut from this sprint (moved, see BACKLOG.md)
- **To Sprint 5 (Phase 1 close-out, per the schedule decision):**
  - Open shadow roots and same-origin iframes, `proofline.config.json` with infra endpoint excludes, `proofline merge`.
  - S3-6 views with inventory but no visitors; S3-10 summary `schemaVersion` (architect).
- **To Sprint 6, with "baseline twice":** S4-8 not-reached flips with dev-server timing (fault check).
- **To Sprint 7 report polish:** S3-7 "reached another way" wording, Shared header/nav view.

## Risks this sprint
- **Moving numbers.** Six engine tasks, and every one moves the demo numbers. Today's line is `UI coverage 55.6% (10/18) | Fault check 93.8% (15 caught, 1 slipped, 1 unstable, 10 n/a)`. Each commit shows the before/after line and says why.
- **Over-merging in S4-T1.** It could merge genuinely different single-test elements that share a path, such as a one-off form in one test. Mitigation: 3+ names, each from exactly one test, same path, tag and role; the merged element shows "N seen".
- **Fewer tested elements in S4-T4.** It lowers the tested count on suites with failing tests. That is the honest number, and the report says how many tests were excluded.
- **Stale views in S4-T3.** It changes the view keys, so old summaries and report links built from earlier views no longer match. Old summaries still render; the views are recomputed from raw records.
- **No margin for slippage.** The buffer is 0.5 h; if anything slips, S4-T5's rename half is cut first.
- **The write-up depends on the re-run.** S4-T7 can't start until S4-T6 finishes. If S4-T6 misses the bar, the write-up says so plainly instead of waiting.
