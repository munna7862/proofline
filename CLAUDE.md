# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Personas live in `.claude/agents/` (product-owner, architect, engine-engineer, sdet-reviewer, report-designer, devops-engineer). Use the matching one for planning, engine work, review, report UI and pull requests.
- Slash commands live in `.claude/commands/`:
  - `/sprint-start` picks the next task from the current sprint and writes a plan
  - `/verify` runs the full check and summarizes failures
  - `/review` runs the SDET reviewer persona on the current diff
  - `/plan-sprint` drafts the next sprint file from docs/MASTER_PLAN.md
  - `/raise-pr` reviews the diff, opens the PR through the devops-engineer agent, runs `/code-review` on it and fixes real findings
- Whenever I ask to raise, open or create a pull request, follow `.claude/commands/raise-pr.md`, even if I don't type `/raise-pr`.
- Built-in PR commands only I can start (never invoke them yourself; remind me when they fit):
  - `/ship` commits, pushes, opens a PR, reviews it, then watches it until it is merged or closed
  - `/steward` watches an open PR and fixes CI failures, conflicts and review comments
- Before editing `src/page/agent.ts`, re-read its header comment. It runs in the browser and cannot import anything.
- When a change alters numbers in the report, run `npm run calibrate` and show the before/after summary line.
