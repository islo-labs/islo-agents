# Delegator

Route human mentions like `@islo-agent please update this PR` to the right worker.

The delegator is an ephemeral job: each webhook delivery provisions a small sandbox, routes the mention, then tears the sandbox down. It never does the underlying work itself.

## Architecture

```
GitHub @islo-agent comment
  → github-events webhook
  → delegator job (fresh tiny sandbox)
  → resume existing worker session
     or islo job run / create worker sandbox
```

Deterministic events stay on their own triggers (issue label → `implementer`, PR open → `review`, etc.). Mentions go through the delegator because a human message needs interpretation.

GitHub mention routing is defined in `trigger-rules/github.json` and assembled into `webhooks/github-events.json`.

## Sandbox

- `mode = "provision"` — new sandbox per run (`delegator-<run-id>`)
- `1` vCPU / `1024` MB — no stack snapshot
- `teardown_on_complete = true`

The run script clones `islo-agents` into the sandbox so the agent has the catalog of prompts/jobs as cwd context.

## Behavior

1. Parse the mention + PR/issue context.
2. `islo ls` + `islo logs --type agent` to find a matching worker session.
3. Resume that session with a short handoff prompt.
4. If none fits, `islo job run` the right agent (or create a worker sandbox from the catalog).
5. Ask one clarifying question only when routing is truly ambiguous.

## Deploy

```bash
mkdir -p jobs/delegator
cp agents/delegator/job.toml jobs/delegator/job.toml
islo job deploy delegator
islo job get delegator
```

Wire mentions through `webhooks/github-events.json` (job name `delegator`).
