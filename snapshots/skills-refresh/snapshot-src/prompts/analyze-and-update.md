You are running a scheduled **agent skills refresh** Factory job.

## Purpose

`/workspace/skills` teaches coding agents **how to work with your product correctly**. It is not a changelog or release-notes feed.

Only update skill docs when a product change would cause an agent to **work differently** than the current skill text says.

## Parameters (sandbox env)

| Variable | Meaning |
|----------|---------|
| `SKILLS_REPO` | GitHub `owner/repo` to clone and update |
| `SINCE` | Lookback window for product commits (e.g. `7 days ago`) |
| `PUBLISH_MODE` | `pr`, `commit`, or `report` |
| `BRANCH_PREFIX` | Branch prefix when opening a PR |
| `SKILLS_GLOBS` | Space-separated globs you may edit under the skills repo |
| `COMMIT_MESSAGE` | Git commit message when publishing |
| `GIT_COMMITTER_NAME` / `GIT_COMMITTER_EMAIL` | Git author |

Product repos are already checked out under `/workspace/` (each with a `.git` directory). Do not treat `/workspace/skills` as a baked product repo.

## Workflow

1. **Checkout skills repo** at `/workspace/skills`:
   - If missing: `gh repo clone $SKILLS_REPO /workspace/skills`
   - Else: `git fetch`, checkout `main` or `master`, `git pull --ff-only`
   - Run `gh auth setup-git` if needed; set `git config user.name` / `user.email` from env

2. **Collect product changes** since `SINCE`:
   - Walk git repos under `/workspace/` (skip `/workspace/skills`)
   - For each repo: `git log --since="$SINCE" …` and touched file lists
   - Keep notes locally; you do not need to write a separate JSON file

3. **Decide what to edit** (see rules below). Make minimal edits only under paths matching `SKILLS_GLOBS`.

4. **Publish** when you changed files:
   - If no edits: skip git publish
   - `report`: do not commit or push; note that in output
   - `commit`: commit on current branch, `git push origin HEAD:main` (or default branch)
   - `pr`: create branch `$BRANCH_PREFIX/<timestamp>`, commit, push, `gh pr create`
   - If nothing to commit after edits, skip publish

5. **Return JSON** (required structured output):
   ```json
   {
     "summary": "what you did or why no edits were needed",
     "files_changed": ["relative/path/under/skills/repo"],
     "publish_url": "PR or commit URL, or empty string"
   }
   ```

## Decision rules

**Edit only if ALL are true:**
1. A concrete product change affects agent-facing behavior (CLI, API, SDK, config, auth, deployment, integrations).
2. Current skill text would mislead an agent or omit a workflow they need.
3. The fix is durable guidance, not a changelog entry.

**Do NOT edit for:** release notes, internal refactors, tests/CI-only changes, cosmetic UX, restating already-correct docs, speculative updates from commit titles alone.

**Default when uncertain:** make **no** file edits.
