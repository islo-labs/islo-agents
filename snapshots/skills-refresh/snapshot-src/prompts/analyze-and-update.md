You are running a scheduled **agent skills refresh** Factory job.

## Purpose of the skills repo

`/workspace/skills` teaches coding agents **how to work with your product correctly**. It is not a changelog, release notes feed, or mirror of product development activity.

Only update skill docs when a product change would cause an agent to **work differently** than the current skill text says — wrong commands, missing workflows, outdated config fields, deprecated patterns, or absent guidance for a capability agents now need.

## Context

- Skills repo (checkout target): `/workspace/skills`
- Product activity: `/workspace/changes.json` (commits/files from git repos under `/workspace/` over the lookback window; excludes the skills repo itself)
- Parameters: `skills_repo=$SKILLS_REPO`, `since=$SINCE`, `publish_mode=$PUBLISH_MODE`, `branch_prefix=$BRANCH_PREFIX`, `skills_globs=$SKILLS_GLOBS`

## Decision rules

**Edit only if ALL are true:**
1. A concrete product change (commit/diff) affects agent-facing behavior: CLIs, APIs, SDKs, config manifests, auth flows, deployment, integrations, or documented agent workflows.
2. The current skill text would mislead an agent or omit a workflow they need.
3. The fix is durable guidance (how/when to do something), not a note about what shipped recently.

**Do NOT edit for:**
- Release notes, timelines, observability, or cosmetic UX improvements with no workflow change
- Internal refactors, tests, CI, performance, or repo hygiene with no agent impact
- Restating commands or docs that are already correct in the skill
- Speculative updates from commit titles without verifying agent impact
- Duplicating official product documentation — skills stay concise and action-oriented

**Allowed paths:** under `/workspace/skills`, only files matching `$SKILLS_GLOBS` (space-separated globs, relative to the skills repo root). Do not edit files outside those globs.

**Default when uncertain:** make **no** file edits.

## Workflow

1. Read `/workspace/changes.json` and identify commits that plausibly affect agent workflows.
2. For each candidate, read the relevant skill files and verify the gap is real.
3. Make minimal, surgical edits — update wrong guidance, add missing workflow steps, mark deprecations. Do not append changelog paragraphs.
4. Do NOT run git commit, push, or open a PR (the publish step handles that).
5. Return JSON:
   ```json
   {
     "summary": "what you did or why no edits were needed",
     "files_changed": ["relative/path/to/file1"]
   }
   ```

If no agent-actionable skill gap exists, return `files_changed: []` and explain why in `summary`.
