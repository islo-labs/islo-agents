# islo-agents

Shared agent templates for Islo jobs: prompts, durable job manifests, and webhook trigger-rule fragments. Deploy jobs and assemble webhooks from this checkout.

**Role vs source:** roles (`review`, `implementer`, …) are source-agnostic. Source systems only appear under `trigger-rules/<source>.json` and assembled `webhooks/`. Workspace-specific values that cannot be generalized (e.g. a Linear label UUID) ship as placeholders.

## Structure

```
src/agent.ts                        — generic harness (prompt + vars → Claude Agent SDK)
agents/                             — one directory per role
  <role>/
    prompt.md                       — agent behavior
    job.toml                        — durable job (sandbox + steps); job name = role name
    trigger-rules/<source>.json     — webhook rule fragments for that source
webhooks/                           — assembled receivers
  github-events.json
  linear-issues.json
scripts/assemble-webhooks.js        — merge agents/*/trigger-rules/<source>.json → webhooks/
```

The harness (`src/agent.ts`) is meant to run inside an authenticated Islo sandbox (or any environment where `islo` is logged in). Optional `--knowledge-*` flags shell out to `islo knowledge render` / `get` and inject Markdown into the prompt; if `islo` is unavailable they warn and continue.

Roles / job names: `review`, `implementer`, `verify`, `babysit`, `delegator`.

Jobs clone this pack at runtime via `agents_git_ref` (branch, tag, or commit; default `main`). Override with `--param agents_git_ref=…` when pinning.

## Axes

| Axis | Meaning | Lives in |
|------|---------|----------|
| **Role** | What the agent does | `agents/<role>/` + job name |
| **Source** | Which system fires the event | `trigger-rules/<source>.json` → `webhooks/` |

## Quick start

### 1. Replace placeholders

- **Implementer (Linear example):** in `agents/implementer/trigger-rules/linear.json`, replace `REPLACE_WITH_YOUR_LINEAR_LABEL_ID` with your label UUID, then reassemble:

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
islo webhook incoming create --request-json @webhooks/github-events.json
islo webhook incoming create --request-json @webhooks/linear-issues.json
```

See `webhooks/README.md` for HMAC and GitHub/Linear setup.

### Manual run

```bash
islo job run review --param repo=owner/repo --param repo_name=repo --param pr_number=1
islo job run implementer --param issue_id=…
```

## Customizing context

Create a `REVIEW.md` at your repo root for review/babysit. For verify, add `VERIFY.md`.
