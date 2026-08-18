# islo-agents

Shared agent templates for Islo jobs, Factory lines, and webhook trigger-rule fragments.

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
lines/                              — deployable Factory line manifests
snapshots/                          — VM snapshot contracts (source under snapshot-src/)
factory/                            — runbooks, prompts, and tests for internal lines
webhooks/                           — assembled receivers
  github-events.toml
  linear-issues.toml
scripts/assemble-webhooks.js        — merge agents/*/trigger-rules/<source>.toml → webhooks/
```

The harness (`src/agent.ts`) requires `ISLO_API_KEY` to be set (automatic in Islo sandboxes via phantom env vars, or any valid API key). Optional `--knowledge-*` flags use the `@islo-labs/sdk` to fetch knowledge items and inject their Markdown bodies into the prompt; on failure they warn and continue.

## Factory Manager V1

Factory Manager is one Islo-owned runtime per tenant, not one manager per line.
Eligible tenant members enable it behind the `factory-manager-v1` feature flag.
Its implementation, fixed configuration, and prompt live in `islo-web-api`.
The runtime uses one stable `factory-manager` sandbox and one named Claude
session shared across decisions, failures, and provider requests. The fixed
configuration uses `claude-sonnet-5`; tenants cannot replace its prompt, model,
tools, integrations, or trigger rules in V1.

The backend owns the trigger policy:

- Slack `app_mention` events.
- Newly created GitHub issue and pull-request comments, plus pull-request
  review comments, containing the exact `@islo-agent` mention.
- Factory `decision_pending` events and terminal line or job failures.

Connecting the corresponding provider is enough. Do not assemble Manager
triggers into the legacy incoming webhook files in this repository. Direct
integration triggers on lines, such as the Linear trigger on
`feature-delivery`, continue to work independently.

Lines do not need `[manager].ref`. They may add line-specific guidance:

```toml
[manager.instructions]
type = "literal"
value = """
Retry only after the blocker has changed. Cancel when required input is
unavailable or another attempt could damage customer work.
"""
```

Instructions may instead reference an active knowledge item:

```toml
[manager.instructions]
type = "knowledge"
slug = "feature-delivery-manager-rules"
```

The Manager inspects current Factory and provider state with the existing
Islo CLI and provider access in its sandbox. At a pending decision,
`manager.instructions` guides the choice while the decision's
`allowed_actions` remains the hard server-enforced limit. For a Slack or
GitHub mention, the Manager answers in the originating thread and does not
treat the mention alone as permission to mutate Factory state.

See [Factory Manager V1](docs/factory-manager.md) for enablement, runtime,
trigger, recovery, and packaging details.

## Harnesses

Select the coding-agent runtime independently from its model. Three invocation patterns:

```bash
# First run — render template, create session
npx tsx src/agent.ts --prompt agents/review/prompt.md \
  --session-key "review-owner/repo-42" --cwd /workspace \
  --harness codex --model kimi-k2.7-code --max-budget 10

# Resume — positional text sent to existing session
npx tsx src/agent.ts --resume --session-key "review-owner/repo-42" \
  "The PR has been updated. Review the latest changes."

# One-shot (no session persistence)
npx tsx src/agent.ts --prompt agents/review/prompt.md --cwd /workspace
```

**`--prompt <path>`** renders a template file with `--var`, `--knowledge-*`, and `--context-file`. Used on first run.

**Positional argument** is literal prompt text sent to the agent. Required when `--resume` is set.

**`--resume`** explicitly resumes an existing session. Requires
`--session-key` and positional prompt text. The session file restores the
harness, model, reasoning effort, working directory, and per-invocation
limits. Any corresponding CLI flag overrides the stored value, but a harness
mismatch (resuming a Codex session as Claude) is an error.

**`--session-key <key>`** without `--resume` errors if the session file
already exists, preventing accidental overwrites. New runs require `--prompt`;
resume runs require positional prompt text.

Shared options: `--prompt`, `--cwd`, `--model`, `--max-budget`,
`--reasoning-effort`, `--session-key`, `--context-file`,
`--knowledge-*`, and `--var`. `--max-budget` defaults to **$45**. Claude
enforces it as the SDK's USD budget; Codex converts it through a
model-specific maximum-token price into an approximate rollout-token limit.
Unknown Codex models require the raw `--rollout-budget-tokens` alternative.
`--reasoning-effort` maps to `effort` in Claude and `reasoning_effort` in
Codex; levels `low`–`xhigh` work on both, `minimal` is Codex-only, and `max`
is Claude-only. Unsupported harness-specific values are rejected. Claude alone
supports `--max-turns`. Codex alone supports `--rollout-budget-tokens`.

The Codex limit applies per harness invocation. Within that invocation it
counts output and non-cached input across the root thread and subagents, and
can abort between model responses during one prompt. Codex 0.144.5 excludes
billed cached input from this counter and cannot interrupt an in-flight model
response, so `--max-budget` is not a hard USD guarantee: cached-input charges
and one completed response can exceed it. A resumed invocation gets a fresh
allowance. Job timeouts remain the hard wall-clock bound, and the Codex SDK is
pinned exactly while this experimental feature matures.

Durable worker jobs (`review`, `implementer`, and `verify`) use a unified
session file (`<session-key>.session.json`) that stores the provider session ID
and complete resumable configuration. This lets delegators continue a worker
using only its session key and a handoff prompt.

> **Note:** `harness` and `model` are independently overridable in job
> params. If you override `harness` (e.g. `claude` → `codex`), also
> override `model` to a compatible one — the SDK will reject mismatched
> model names at runtime.

Roles / job names: `review`, `implementer`, `verify`, `babysit`, `delegator`.
All jobs default to Claude: `review` on Thesean's
`ship-like/claude-opus-5` through Islo inference, `implementer` / `verify` /
`babysit` on `claude-opus-4-6`, and `delegator` on `claude-sonnet-4-5`.
Every job exposes a `harness` parameter for explicit overrides.

Jobs clone this pack at runtime via `agents_git_ref` (branch, tag, or commit; default `main`). Override with `--param agents_git_ref=…` when pinning.

## Axes

| Axis | Meaning | Lives in |
|------|---------|----------|
| **Role** | What the agent does | `agents/<role>/` + job name |
| **Source** | Which system fires the event | `trigger-rules/<source>.toml` → `webhooks/` |

## Factory line templates

Besides PR review / implement / verify (`feature-delivery`), this repo ships **example Factory lines** you can fork and adapt. Each line has a manifest under `lines/<name>/line.toml` and per-line setup notes in `lines/<name>/README.md`. Stage jobs live under `agents/<job>/job.toml`.

Reviewable snapshot source lives under `snapshots/<name>/snapshot-src/`; each
snapshot README documents the paths that must exist in the baked VM. Copy source
into those paths on a build VM, save the named snapshot, deploy every stage job,
then deploy the line last. Job manifests contain only parameters, short agent
pointers, and direct exec invocations of installed scripts.

| Line | Schedule (UTC) | Stages | Purpose |
|------|----------------|--------|---------|
| [`fullstack-qa-line`](lines/fullstack-qa-line/README.md) | Daily 07:00 | `fullstack-qa` → `fullstack-qa-collector` | Parallel black-box QA; publish deduped findings to Linear |
| [`red-team-cli`](lines/red-team-cli/README.md) | Mon 08:00 | trust-boundaries → input-abuse → black-box → report → slack | White-box + black-box CLI security review |
| [`weekly-skills-refresh`](lines/weekly-skills-refresh/README.md) | Mon 07:00 | `weekly-skills-refresh` | Refresh agent skills when stack changes would mislead agents |

Deploy all stage jobs, then the line (see each line README for prerequisites and placeholders):

```bash
islo job deploy fullstack-qa --dry-run && islo job deploy fullstack-qa
islo job deploy fullstack-qa-collector --dry-run && islo job deploy fullstack-qa-collector
islo factory line deploy lines/fullstack-qa-line/line.toml --dry-run
islo factory line deploy lines/fullstack-qa-line/line.toml
```

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
