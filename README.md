# islo-agents

Shared agent templates for Islo jobs: prompts, durable job manifests, and webhook trigger-rule fragments. Deploy jobs and assemble webhooks from this checkout. Workspace-specific values that cannot be generalized (today: the Linear label UUID) ship as placeholders — replace them before deploy, or override in a thin private overlay later.

## Structure

```
src/agent.ts                        — generic harness (prompt + vars → Claude Agent SDK)
agents/                             — one directory per role
  <role>/
    prompt.md                       — agent behavior
    job.toml                        — durable job (sandbox + steps)
    trigger-rules/<source>.json     — webhook rule fragments for that source
webhooks/                           — assembled receivers
  github-events.json
  linear-issues.json
scripts/assemble-webhooks.js        — merge agents/*/trigger-rules/<source>.json → webhooks/
```

Roles: `review`, `implementor`, `verify`, `babysit`, `delegator`.

Jobs clone this pack at runtime via `agents_git_ref` (branch, tag, or commit; default `main`). Override with `--param agents_git_ref=…` when pinning.

## Axes

| Axis | Meaning | Lives in |
|------|---------|----------|
| **Role** | What the agent does | `agents/<role>/` |
| **Source** | Which system fires the event | `webhooks/<source>-….json` + `trigger-rules/<source>.json` |

## Quick start

### 1. Replace placeholders

- **Implementor:** in `agents/implementor/trigger-rules/linear.json`, replace `REPLACE_WITH_YOUR_LINEAR_LABEL_ID` with your Linear label UUID, then reassemble:

```bash
npm run assemble-webhooks
```

Babysit triggers on any failed PR `workflow_run` (no workflow-name allowlist).

### 2. Deploy a job

```bash
mkdir -p jobs/islo-review
cp agents/review/job.toml jobs/islo-review/job.toml
islo job deploy islo-review
```

Same pattern for `implementor` → `jobs/linear-implementor`, `delegator`, `verify`, `babysit`.

### 3. Wire webhooks

```bash
islo webhook incoming create --request-json @webhooks/github-events.json
islo webhook incoming create --request-json @webhooks/linear-issues.json
```

See `webhooks/README.md` for HMAC and GitHub/Linear setup.

### Manual run

```bash
islo job run islo-review --param repo=owner/repo --param repo_name=repo --param pr_number=1
islo job run linear-implementor --param issue_id=…
```

## Customizing context

Create a `REVIEW.md` at your repo root for review/babysit. For verify, add `VERIFY.md`.
