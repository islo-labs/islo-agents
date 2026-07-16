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

Select the coding-agent runtime independently from its model. Three invocation patterns:

```bash
# First run — render template, create session
npx tsx src/agent.ts --prompt agents/review/prompt.md \
  --session-key "review-owner/repo-42" --cwd /workspace \
  --harness codex --model gpt-5.6 --max-budget 10

# Resume — positional text sent to existing session
npx tsx src/agent.ts --resume --session-key "review-owner/repo-42" \
  "The PR has been updated. Review the latest changes."

# One-shot (no session persistence)
npx tsx src/agent.ts --prompt agents/review/prompt.md --cwd /workspace
```

**`--prompt <path>`** renders a template file with `--var`, `--knowledge-*`, and `--context-file`. Used on first run.

**Positional argument** is literal prompt text sent to the agent. Required when `--resume` is set.

**`--resume`** explicitly resumes an existing session. Requires `--session-key`. Errors if the session file does not exist. On resume, harness and model are auto-detected from the session file; `--harness` and `--model` can override stored values, but a harness mismatch (resuming a Codex session as Claude) is an error.

**`--session-key <key>`** without `--resume` errors if the session file already exists, preventing accidental overwrites. At least one of `--prompt` or positional text must be provided.

Shared options: `--prompt`, `--cwd`, `--model`, `--max-budget`,
`--reasoning-effort`, `--session-key`, `--context-file`,
`--knowledge-*`, and `--var`. `--max-budget` sets a USD spending cap
(default **$15** when not specified). Codex converts this internally
via `CODEX_TOKENS_PER_USD`. `--reasoning-effort` maps to `effort` in
Claude and `reasoning_effort` in Codex; levels `low`–`xhigh` work on
both, `minimal` is Codex-only, and `max` is Claude-only. Claude alone
supports `--max-turns`. Codex alone supports `--rollout-budget-tokens`
(raw weighted-token override).

Codex rollout budgets count weighted tokens across the thread and any
subagents. The feature is currently marked under development by Codex and may
overshoot by one completed model response, so job timeouts remain the hard
wall-clock bound. The Codex SDK is pinned exactly while this feature matures.

All harnesses use a unified session file (`<session-key>.session.json`)
that stores the provider session ID, harness type, and model.

> **Note:** `harness` and `model` are independently overridable in job
> params. If you override `harness` (e.g. `claude` → `codex`), also
> override `model` to a compatible one — the SDK will reject mismatched
> model names at runtime.

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
