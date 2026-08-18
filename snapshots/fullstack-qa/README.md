# Snapshot contract: `fullstack-qa`

<!-- PLACEHOLDER: build a VM snapshot named `fullstack-qa` with the paths below.
     Do not embed harness assets in job.toml — bake them into the snapshot. -->

## Required paths

| Path in snapshot | Contents |
|------------------|----------|
| `/opt/qa-harness/agent/` | Python helpers: `cleanup.py`, `stage_findings.py`, etc. |
| `/opt/qa-harness/prompts/full/` | Composed agent briefs (`agent-web-core.md`, `agent-web-platform.md`, `agent-cli-cross.md`) |
| `/opt/qa-harness/scripts/` | `start-qa-stack.sh` — boots your local app stack |
| `/workspace/qa-harness/` | Browser test harness (e.g. Playwright `package.json`, tests, config) |

The `fullstack-qa` job runs snapshot check scripts, `start-stack`, three parallel `run_agent` tasks, then cleanup/staging scripts. Harness source lives in `snapshot-src/` — build with `setup-snapshot.sh`, not in `job.toml`.

## Building

```bash
./snapshots/fullstack-qa/setup-snapshot.sh
islo snapshot save fullstack-qa
```

See [`lines/fullstack-qa-line/README.md`](../../lines/fullstack-qa-line/README.md) for deploy steps.
