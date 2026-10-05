# Sprint backlog (draft; refine with /plan-sprint each week)

## Sprint 2: Coverage accuracy (week 2)
Planned in [SPRINT_02.md](SPRINT_02.md): id normalization, link-click rule, phantom elements, already-failing endpoints, trial re-run, S1-T5 carry-over. Done; results in STATUS.md "Sprint 2 demo".

## Sprint 3: Spot-check passes on epic-stack (week 3)
Planned in [SPRINT_03.md](SPRINT_03.md): prepack build, devtools exclusion, route-transition bleed, toasts and repeated lists, flaky catches as "unstable", trial re-run, S1-T5 carry-over.
Decision D-1 option B approved 2026-10-04: Phase 1 exit moves to week 4, later sprints move one week.

## Sprint 4: Phase 1 close-out (week 4)
- First: the S3-T5 trial findings S4-1 to S4-7 in STATUS.md ("Sprint 4 candidates"): per-run names (S4-1), pointer-down triggers (S4-2), learned `:param` rework incl. S3-5/S3-12 (S4-3), failing tests' coverage (S4-4), nested links (S4-5), renamed fields (S4-6), focus guards (S4-7). Several need founder approval. Re-scope the rest of this list with /plan-sprint.
- Open shadow roots and same-origin iframes in the agent, with demo pages + ground truth
- `proofline.config.json` (ignoreViews, ignoreElements, viewRules) + default infra endpoint excludes (`/socket.io`, suite `/api/test/*` backdoors)
- `proofline merge` for CI shards
- S3-5 learned `:param` applied to deeper paths; S3-6 views with inventory but no visitors
- S3-10 `schemaVersion` on both summaries (architect)

## Sprint 5: Trustworthy fault results (week 5)
- "No visible effect" triage + ground truth in demo; investigate React Router `.data` fallbacks with `replay`
- `--budget`, `--concurrency`, progress with ETA, option to stop a fault run at the first failure
- Baseline twice, reconsidered with the S3-T4 "unstable" data
- Learned `:param` for endpoints (per-user faults reached); `--max-mutants` ordered by dependent tests, round-robin, deterministic
- Agent overhead measurement on a 100-test suite (optimize scan debounce if > 5%); second public suite trial

## Sprint 6: Report and CI polish (week 6)
- Per-test strength table in the report
- Shared header/nav on 3+ views as one "Shared" view; S3-7 "Destination reached another way" copy (both need report approval)
- `replay` defaults to survivors only
- GitHub Actions example + job summary
- README rewrite with real screenshots: `mergeTests` recipe, string-reporter line, Git Bash leading-slash note, clearer "No coverage recorded" message; 60-second quickstart video (OBS, free)

## Sprint 7: Launch 0.1 (week 7)
- npm publish, GitHub release, docs on GitHub Pages
- Findings write-up from a public suite (shared privately with maintainers first)
- Launch posts (see GO_TO_MARKET.md)

## Sprints 8–9: VS Code Lens
- Compile, test with Extension Development Host, publish to Marketplace + Open VSX

## Sprints 10–13: First revenue
- PR baseline gate, history, offline license keys, payments, onboarding call script, first 3 paying teams

## Backlog (Phase 2+)
- Turbo-stream aware body operators for React Router/Remix `.data`, or document the limitation (S2 candidate #8)
- S3-9 never-enabled list flicker between runs: accepted as is (outside the score); revisit if a user reports it
- 5 more validation conversations: follow S1-T5 replies, no fixed sprint
