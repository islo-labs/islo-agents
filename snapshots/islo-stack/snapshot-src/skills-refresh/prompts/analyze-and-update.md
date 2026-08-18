You are running inside the Islo Factory job `weekly-skills-refresh`.

## Purpose of this repo

`your agent skills repository` teaches coding agents **how to work with your product correctly**. It is not a changelog, release notes feed, or mirror of stack development activity.

Only update skill docs when a stack change would cause an agent to **work differently** than the current skill text says — wrong commands, missing workflows, outdated manifest fields, deprecated patterns, or absent guidance for a capability agents now need.

## Context

- Target repo: `/workspace/skills`
- Stack activity: `/workspace/changes.json` (commits/files from islo-stack repos over the lookback window)
- Parameters: skills_repo=$SKILLS_REPO, since=$SINCE, publish_mode=$PUBLISH_MODE, branch_prefix=$BRANCH_PREFIX

## Decision rules

**Edit only if ALL are true:**
1. A concrete stack change (commit/diff) affects agent-facing behavior: CLI, manifests, APIs, gateway/auth, sandbox lifecycle, Factory lines, jobs, webhooks, SDK, or skill routing.
2. The current skill text would mislead an agent or omit a workflow they need.
3. The fix is durable guidance (how/when to do something), not a note about what shipped recently.

**Do NOT edit for:**
- Release notes, timelines, observability, or "now you can see X" UX improvements
- Internal refactors, tests, CI, performance, or repo hygiene with no agent impact
- Restating commands or docs that are already correct in the skill
- Speculative updates from commit titles without verifying agent impact
- Duplicating Islo product docs — skills stay concise and action-oriented

**Allowed paths:** `plugins/islo/**`, `README.md`, plugin metadata only.

**Default when uncertain:** make **no** file edits.

## Workflow

1. Read `/workspace/changes.json` and identify commits that plausibly affect agent workflows.
2. For each candidate, read the relevant skill files and verify the gap is real.
3. Make minimal, surgical edits — update wrong guidance, add missing workflow steps, mark deprecations. Do not append changelog paragraphs.
4. Do NOT run git commit, push, or open a PR.
5. Return JSON:
   {
     "summary": "what you did or why no edits were needed",
     "files_changed": ["relative/path/to/file1"]
   }

If no agent-actionable skill gap exists, return `files_changed: []` and explain why in `summary`.
