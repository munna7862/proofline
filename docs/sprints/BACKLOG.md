# Sprint backlog (draft; refine with /plan-sprint each week)

## Sprint 2: Coverage accuracy (week 2)
Planned in [SPRINT_02.md](SPRINT_02.md): id normalization, link-click rule, phantom elements, already-failing endpoints, trial re-run, S1-T5 carry-over. Done; results in STATUS.md "Sprint 2 demo".

## Sprint 3: Spot-check passes on epic-stack (week 3)
Planned in [SPRINT_03.md](SPRINT_03.md): prepack build, devtools exclusion, route-transition bleed, toasts and repeated lists, flaky catches as "unstable", trial re-run, S1-T5 carry-over.
Decision D-1 option B approved 2026-10-04: Phase 1 exit moves to week 4, later sprints move one week.

## Sprint 4: Trial numbers a QA lead can be shown (week 4)
Planned in [SPRINT_04.md](SPRINT_04.md): focus guards, per-run names, pointer-down menus, learned `:param` rework, passing tests only, nested links and renamed fields, trial re-run, trial write-up for the leads. Founder approved 2026-10-05: Phase 1 exit moves to week 5, later sprints move one week.

## Sprint 5: Phase 1 close-out (week 5)
- Open shadow roots and same-origin iframes in the agent, with demo pages + ground truth
- `proofline.config.json` (ignoreViews, ignoreElements, viewRules) + default infra endpoint excludes (`/socket.io`, suite `/api/test/*` backdoors)
- `proofline merge` for CI shards
- S3-6 views with inventory but no visitors
- S3-10 `schemaVersion` on both summaries (architect)

## Sprint 6: Trustworthy fault results (week 6)
- "No visible effect" triage + ground truth in demo; investigate React Router `.data` fallbacks with `replay`
- `--budget`, `--concurrency`, progress with ETA, option to stop a fault run at the first failure
- Baseline twice, reconsidered with the S3-T4 "unstable" data; S4-8 not-reached flips with dev-server timing
- Learned `:param` for endpoints (per-user faults reached); `--max-mutants` ordered by dependent tests, round-robin, deterministic
- Agent overhead measurement on a 100-test suite (optimize scan debounce if > 5%); second public suite trial

## Sprint 7: Report and CI polish (week 7)
- Per-test strength table in the report
- Shared header/nav on 3+ views as one "Shared" view; S3-7 "Destination reached another way" copy (both need report approval)
- `replay` defaults to survivors only
- GitHub Actions example + job summary
- README rewrite with real screenshots: `mergeTests` recipe, string-reporter line, Git Bash leading-slash note, clearer "No coverage recorded" message; 60-second quickstart video (OBS, free)

## Sprint 8: Launch 0.1 (week 8)
- npm publish, GitHub release, docs on GitHub Pages
- Findings write-up from a public suite (shared privately with maintainers first)
- Launch posts (see GO_TO_MARKET.md)

## Sprints 9–10: VS Code Lens
- Compile, test with Extension Development Host, publish to Marketplace + Open VSX

## Sprints 11–14: First revenue
- PR baseline gate, history, offline license keys, payments, onboarding call script, first 3 paying teams

## Backlog (Phase 2+)
- Turbo-stream aware body operators for React Router/Remix `.data`, or document the limitation (S2 candidate #8)
- S3-9 never-enabled list flicker between runs: accepted as is (outside the score); revisit if a user reports it
- 5 more validation conversations: follow S1-T5 replies, no fixed sprint
