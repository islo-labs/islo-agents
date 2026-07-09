# islo-agents

**Starter pack** for Islo agent jobs: prompts, durable job manifests, and example webhook trigger rules. Fork or copy this repo, personalize prompts and triggers for your org, then deploy jobs and assemble webhooks from *your* checkout.

Islo Labs production uses a separate internal pack (`islo-agents-internal`). Customers should treat this public repo as the template.

## Structure

```
src/agent.ts                        — generic harness (prompt + vars → Claude Agent SDK)
agents/                             — one directory per role
  <role>/
    prompt.md                       — agent behavior
    job.toml                        — durable job (sandbox + steps)
    trigger-rules/<source>.json     — webhook rule fragments for that source
webhooks/                           — assembled receivers (example configs)
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

### 1. Personalize triggers

- **Babysit:** edit `agents/babysit/trigger-rules/github.json` — replace the example `"CI"` allowlist with your workflow names.
- **Implementor:** edit `agents/implementor/trigger-rules/linear.json` — replace `REPLACE_WITH_YOUR_LINEAR_LABEL_ID` with your Linear label UUID.

Then rebuild example receivers:

```bash
npm run assemble-webhooks
```

Assembled files under `webhooks/` are **examples** built from those fragments — not live Islo Labs config. Deploy *your* assembled JSON to your tenant.

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
