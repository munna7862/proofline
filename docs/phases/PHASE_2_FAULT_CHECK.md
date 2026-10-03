# Phase 2: Fault check in the real world (weeks 3–5, sprints 3–5)

Goal: `proofline scan` results a QA lead would trust and act on.

## Deliverables
1. Scan verified in the real runner (Sprint 1 smoke, Sprint 3 depth).
2. Baseline run twice; tests flaky in baseline excluded and listed (Sprint 3).
3. "No visible effect" triage: compare visible text at test end between baseline and fault runs; identical means "no visible effect", kept out of "slipped through" (Sprint 4).
4. `--budget 15m`, `--concurrency N`, progress line with time remaining (Sprint 4).
5. Report polish: per-test strength table, filters, copyable replay (Sprint 5).
6. GitHub Actions example with job summary and artifact upload (Sprint 5).

## Acceptance tests
- Demo numbers unchanged.
- On a public suite with 50+ tests: scan with defaults completes in under 20 minutes on a laptop; at least 80% of "slipped through" items are judged real gaps by a manual review of 10 samples.

## Out of scope
GraphQL field-level faults (Phase 6), WebSocket faults, server-side rendering faults.
