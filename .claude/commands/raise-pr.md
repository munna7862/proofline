Raise a pull request for the current task. Extra notes for the PR, if any: $ARGUMENTS

1. **Review first.** If there are uncommitted changes, use the sdet-reviewer agent on them. Any blocker stops here: list it and wait for me.
2. **Open the PR.** Use the devops-engineer agent to branch, verify, commit, push and open the PR. Pass it my notes above.
3. **Code review.** Run the `/code-review` skill at `high` on the new PR number. Fix the findings that are real bugs, run `npm run verify` again, and push the fixes to the same branch. List any finding you chose not to fix, with the reason.
4. **Hand over.** Give me the PR link, the verify summary line and what the review changed. Then remind me that I can type `/steward` to have Claude watch this PR's CI, conflicts and comments until it is merged or closed. You cannot start `/steward` or `/ship` yourself; only I can type them.

Never merge the PR.
