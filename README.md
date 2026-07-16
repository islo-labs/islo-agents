# islo-agents

Shared agent templates for Islo jobs: prompts, durable job manifests, and webhook trigger-rule fragments. Deploy jobs and assemble webhooks from this checkout.

**Role vs source:** roles (`review`, `implementer`, …) are source-agnostic. Source systems only appear under `trigger-rules/<source>.toml` and assembled `webhooks/`. Workspace-specific values that cannot be generalized (e.g. a Linear label UUID) ship as placeholders.

## Structure

```
src/agent.ts                        — generic prompt/context harness
src/runtimes/                       — Claude and Codex SDK adapters
agents/                             — one directory per role
  <role>/
    prompt.md                       — agent behavior
    job.toml                        — durable job (sandbox + steps); job name = role name
    trigger-rules/<source>.toml     — webhook rule fragments for that source
webhooks/                           — assembled receivers
  github-events.toml
  linear-issues.toml
scripts/assemble-webhooks.js        — merge agents/*/trigger-rules/<source>.toml → webhooks/
```

The harness (`src/agent.ts`) requires `ISLO_API_KEY` to be set (automatic in Islo sandboxes via phantom env vars, or any valid API key). Optional `--knowledge-*` flags use the `@islo-labs/sdk` to fetch knowledge items and inject their Markdown bodies into the prompt; on failure they warn and continue.

## Harnesses

Select the coding-agent runtime independently from its model:

```bash
npx tsx src/agent.ts --harness claude --model claude-opus-4-6 \
  --prompt agents/review/prompt.md --max-turns 50 --max-budget 10

npx tsx src/agent.ts --harness codex --model gpt-5.6 \
  --prompt agents/review/prompt.md \
  --rollout-budget-tokens 200000 --reasoning-effort high
```

Shared options include `--prompt`, `--cwd`, `--model`, `--session-key`,
`--context-file`, `--knowledge-*`, and `--var`. Claude alone supports
`--max-turns` and `--max-budget`. Codex alone supports
`--rollout-budget-tokens` and `--reasoning-effort`.

Codex rollout budgets count weighted tokens across the thread and any
subagents. The feature is currently marked under development by Codex and may
overshoot by one completed model response, so job timeouts remain the hard
wall-clock bound. The Codex SDK is pinned exactly while this feature matures.

Claude keeps the original `<session-key>.json` session file. Codex uses
`<session-key>.codex.json`, preventing provider-native session IDs from being
mixed when a durable sandbox changes harness.

Roles / job names: `review`, `implementer`, `verify`, `babysit`, `delegator`.
The review job defaults to Codex with `gpt-5.6`; the other jobs default to
Claude. Every job exposes a `harness` parameter for explicit overrides.

Jobs clone this pack at runtime via `agents_git_ref` (branch, tag, or commit; default `main`). Override with `--param agents_git_ref=…` when pinning.

## Axes

| Axis | Meaning | Lives in |
|------|---------|----------|
| **Role** | What the agent does | `agents/<role>/` + job name |
| **Source** | Which system fires the event | `trigger-rules/<source>.toml` → `webhooks/` |

## Quick start

### 1. Replace placeholders

- **Implementer (Linear example):** in `agents/implementer/trigger-rules/linear.toml`, replace `REPLACE_WITH_YOUR_LINEAR_LABEL_ID` with your label UUID, then reassemble:

```bash
npm run assemble-webhooks
```

Babysit triggers on any failed PR `workflow_run` (no workflow-name allowlist). GitHub PR labels `islo-review` / `islo-verify` are example trigger labels in the GitHub fragments — rename them in `trigger-rules` if you prefer different labels.

### 2. Deploy a job

```bash
mkdir -p jobs/review
cp agents/review/job.toml jobs/review/job.toml
islo job deploy review
```

Same pattern for `implementer`, `delegator`, `verify`, `babysit` (directory name = job name).

### 3. Wire webhooks

```bash
islo webhook incoming create --request-toml @webhooks/github-events.toml
islo webhook incoming create --request-toml @webhooks/linear-issues.toml
```

See `webhooks/README.md` for HMAC and GitHub/Linear setup.

### Manual run

```bash
islo job run review --param repo=owner/repo --param repo_name=repo --param pr_number=1
islo job run implementer --param issue_id=…
```

## Customizing context

Create a `REVIEW.md` at your repo root for review/babysit. For verify, add `VERIFY.md`.
