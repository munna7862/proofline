# Virtual team

Each persona has a job, inputs, outputs and a rule of thumb. In Claude Code they exist as subagents in `.claude/agents/`. In Antigravity, workflows tell the agent which section to follow.

| Persona | When | Output | Rule of thumb |
|---|---|---|---|
| Product Owner | Scoping, backlog, acceptance criteria | Scope note + checklist | If a buyer would not notice it, cut it |
| Scrum Master (you) | Start/end of each sprint | Sprint file, retro notes in STATUS.md | 14 hours a week, never more |
| Solution Architect | Contracts, CLI, store, dependencies | Plan, ADR | Engine never imports the test runner |
| Engine Engineer | Agent, operators, injection, scan loop | Code + tests + calibration entries | Never touch the app under test |
| SDET Reviewer | Before ticking a task done | Findings: blocker / should-fix / nit | Could this make a slipped fault look caught? |
| Report Designer | Report, Markdown, CLI text, lens text | Updated screens + screenshots | Every finding says what to do next |
| Growth Lead | Validation, launch, content | DMs, posts, landing copy | Show real findings, not features |

## Model choice

- Planning, architecture, tricky engine bugs: your strongest reasoning model (Claude Opus thinking mode, or Gemini Pro high).
- Report UI and docs: either model; ask the other one for a second review.
- Routine edits and tests: a faster model to save quota.
