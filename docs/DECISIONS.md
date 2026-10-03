# Architecture decisions

## ADR-001: Runtime injection through context.route, not source mutation
Context: research tools mutate app source and redeploy, which takes hours and needs source access.
Decision: inject faults at the network layer during the test run.
Consequences: works on any app without a build; cannot fault server-side logic directly. Fine for v1.

## ADR-002: File-based IPC through .proofline/
Context: Playwright runs tests in worker processes and often across CI shards.
Decision: each worker writes one JSON file per test; the reporter/CLI reads the folder.
Consequences: robust to crashes, parallelism and sharding (upload/download the folder). Slight disk I/O.

## ADR-003: Zero runtime dependencies
Context: enterprise security reviews count dependencies.
Decision: only node: built-ins at runtime. @playwright/test is a peer dependency.

## ADR-004: Node 22.18+ runs TypeScript directly in development
Decision: erasable TypeScript only; `tsc` builds dist/ for publishing because Node does not strip types inside node_modules.

## ADR-005: Open core boundary
Decision: anything one developer needs on a laptop is free (MIT). Anything a team needs to govern quality over time (PR baseline gate, history, hosted dashboard, SSO, support) is paid.

## ADR-006: MIT license for the core
Decision: MIT keeps adoption friction at zero. Pro code lives in a separate private package.
