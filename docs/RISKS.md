# Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Microsoft, Cypress or a funded startup ships the same thing | Medium | Ship fast, build an audience, focus on the fault check (harder to copy well), stay local-first for enterprises |
| Noise: faults that change nothing visible show as "slipped through" | High | "No visible effect" triage (Phase 2); clear wording; replay for every item |
| Long scan times on large suites | High | Targeted reruns only, `--max-mutants`, `--budget`, concurrency, CI shards |
| Flaky tests distort scores | Medium | Retries 0 for faults, baseline twice, flaky-in-baseline excluded and listed |
| Suites with custom fixtures | High | `mergeTests` recipe; adapter stays tiny |
| Apps that fetch data server-side | Medium | Documented limit; resilience module and API-level operators later |
| Name or trademark clash | Low | Check npm, GitHub, domain and trademark databases before launch |
| Employment conflict (IP, moonlighting) | Real | See checklist below |

## Employment and IP checklist (not legal advice)
- [ ] Read your employment agreement's IP assignment and outside-work clauses.
- [ ] Build only on your personal laptop, personal GitHub, personal AI subscriptions, outside work hours.
- [ ] Never use employer code, test suites, data, tickets or internal knowledge. Never run Proofline on employer repos without written permission.
- [ ] Consider asking HR for written approval for an open-source side project. Get it before any paid client work.
- [ ] If anything is unclear, a one-hour consult with an employment lawyer is cheap insurance.
