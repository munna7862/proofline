# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Personas live in `.claude/agents/` (product-owner, architect, engine-engineer, sdet-reviewer, report-designer). Use the matching one for planning, engine work, review and report UI.
- Slash commands live in `.claude/commands/`:
  - `/sprint-start` picks the next task from the current sprint and writes a plan
  - `/verify` runs the full check and summarizes failures
  - `/review` runs the SDET reviewer persona on the current diff
  - `/plan-sprint` drafts the next sprint file from docs/MASTER_PLAN.md
- Before editing `src/page/agent.ts`, re-read its header comment. It runs in the browser and cannot import anything.
- When a change alters numbers in the report, run `npm run calibrate` and show the before/after summary line.
