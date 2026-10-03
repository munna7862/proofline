# Sprint backlog (draft; refine with /plan-sprint each week)

## Sprint 2: Coverage accuracy (week 2)
Planned in [SPRINT_02.md](SPRINT_02.md): id normalization, link-click rule, phantom elements, already-failing endpoints, trial re-run, S1-T5 carry-over. Items cut from the original list are below under "Pushed out of Sprint 2".

## Sprint 3: Scale (week 3)
- `proofline merge` for CI shards
- Baseline twice, flaky-in-baseline exclusion
- Agent overhead measurement on a 100-test suite; optimize scan debounce if > 5%
- Second public suite trial

## Sprint 4: Trustworthy fault results (week 4)
- "No visible effect" triage
- `--budget`, `--concurrency`, progress with ETA
- Ground truth for triage in demo

## Sprint 5: Report and CI polish (week 5)
- Per-test strength table in the report
- GitHub Actions example + job summary
- README rewrite with real screenshots, 60-second quickstart video (OBS, free)

## Sprint 6: Launch 0.1 (week 6)
- npm publish, GitHub release, docs on GitHub Pages
- Findings write-up from a public suite (shared privately with maintainers first)
- Launch posts (see GO_TO_MARKET.md)

## Sprints 7–8: VS Code Lens
- Compile, test with Extension Development Host, publish to Marketplace + Open VSX

## Sprints 9–12: First revenue
- PR baseline gate, history, offline license keys, payments, onboarding call script, first 3 paying teams

## Pushed out of Sprint 2 (from the S1-T6 candidates in STATUS.md)
- Sprint 3: open shadow roots and same-origin iframes in the agent, with demo pages + ground truth
- Sprint 3: `proofline.config.json` (ignoreViews, ignoreElements, viewRules)
- Sprint 3: learned `:param` for endpoints, so per-user endpoint faults are reached (candidate #2, endpoint half)
- Sprint 3: `--max-mutants` ordered by number of dependent tests, round-robin across endpoints, deterministic (candidate #4)
- Sprint 3: shared header/nav elements on 3+ views grouped into one "Shared" view (candidate #6, needs approval: report layout)
- Sprint 3: default excludes for infrastructure endpoints (`/socket.io`, suite `/api/test/*` backdoors) (candidate #10)
- Sprint 3: 5 more validation conversations (booked through S1-T5)
- Sprint 4: option to stop a fault run at the first failure, alongside `--budget` (candidate #7)
- Sprint 4: investigate React Router `.data` fallbacks with `replay`; route through "no visible effect" triage (candidate #9)
- Sprint 5: `replay` defaults to survivors only
- Sprint 5: README: `mergeTests` recipe; `reporter: [['html'], ['proofline/reporter']]` for string-reporter configs; Git Bash leading-slash note for `--include`; clearer "No coverage recorded" message when every test failed to launch (candidate #10)
- Backlog (Phase 2+): turbo-stream aware body operators for React Router/Remix `.data`, or document the limitation (candidate #8)
