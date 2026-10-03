# Phase 1: UI coverage in the real world (weeks 1–3, sprints 1–3)

Goal: the coverage report is right on real suites, not only on the demo.

## Deliverables
1. Adapter verified in the real runner (Sprint 1).
2. Two public Playwright suites run end to end, misses logged and fixed (Sprints 1–2).
3. Agent handles open shadow roots, same-origin iframes, elements revealed by hover, virtualized lists (Sprint 2).
4. Optional `proofline.config.json`: ignoreViews, ignoreElements, viewRules (regex → view name) (Sprint 2).
5. `proofline merge <dirs...>` combines raw folders from CI shards (Sprint 3).
6. Performance: agent overhead under 5% of suite time on a 100-test suite (Sprint 3).

## Acceptance tests
- demo/expected.json still passes.
- New ground-truth pages added to demo for shadow DOM and iframe cases.
- On each public suite, spot-check 20 elements by hand; at least 19 classified correctly.

## Out of scope
Cross-origin iframes, canvas apps, native mobile.
