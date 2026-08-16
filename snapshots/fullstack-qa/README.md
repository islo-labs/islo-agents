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

The `fullstack-qa` job runs `check-snapshot`, `start-stack`, three parallel `run_agent` tasks, then cleanup/staging scripts. It does **not** ship harness source in this repo.

## Credentials

Auth and third-party IDs (`DESCOPE_PROJECT_ID`, test user OTP, `LINEAR_TEAM_ID`, etc.) belong in the Factory environment **`fullstack-qa`** at job runtime — not in the snapshot tree.

## Building

1. Start from a base snapshot that already contains your application stack (or install it in a fresh sandbox).
2. Copy your harness into `/opt/qa-harness/` and `/workspace/qa-harness/`.
3. Run `npm ci` / install browsers in `/workspace/qa-harness/` if needed.
4. Capture snapshot **`fullstack-qa`**.

See [`lines/fullstack-qa-line/README.md`](../../lines/fullstack-qa-line/README.md) for deploy steps.
