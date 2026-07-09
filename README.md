# islo-agents

Reusable agent templates for Islo jobs. Each role owns a prompt, a job manifest, and optional webhook rule fragments. Triggers are Islo incoming webhooks (not GitHub Actions). All roles share `src/agent.ts`.

## Structure

```
src/agent.ts                 — generic harness (prompt + vars → Claude Agent SDK)
agents/                      — one directory per role
  <role>/
    prompt.md                — agent behavior
    job.toml                 — durable job (sandbox + steps)
    rules/<source>.json      — webhook rule fragments for that source
webhooks/                    — assembled receivers (one URL per source)
  github-events.json
  linear-issues.json
scripts/assemble-webhooks.js — merge agents/*/rules/<source>.json → webhooks/
```

Roles today: `review`, `implementor`, `verify`, `babysit`, `delegator`.

## Axes

| Axis | Meaning | Lives in |
|------|---------|----------|
| **Role** | What the agent does | `agents/<role>/` |
| **Source** | Which system fires the event | `webhooks/<source>-….json` + `rules/<source>.json` |

A role can have rules for many sources. A source receiver merges every role’s fragments for that source.

## Quick start

### Deploy a job

```bash
mkdir -p jobs/islo-review
cp agents/review/job.toml jobs/islo-review/job.toml
islo job deploy islo-review
```

Same pattern for `implementor` → `jobs/linear-implementor`, `delegator`, `verify`, `babysit`.

### Wire webhooks

```bash
node scripts/assemble-webhooks.js
islo webhook incoming create --request-json @webhooks/github-events.json
islo webhook incoming create --request-json @webhooks/linear-issues.json
```

See `webhooks/README.md` for HMAC and GitHub/Linear setup.

### Manual run

```bash
islo job run islo-review --param repo=islo-labs/islo-cli --param pr_number=1 …
islo job run linear-implementor --param issue_id=… …
```

## Customizing context

Create a `REVIEW.md` at your repo root for review/babysit. For verify, add `VERIFY.md`.
