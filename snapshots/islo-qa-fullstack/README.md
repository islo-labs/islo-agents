# Snapshot contract: `islo-qa-fullstack`

<!-- PLACEHOLDER: build a VM snapshot named `islo-qa-fullstack` with the paths below.
     Do not embed harness assets in job.toml — bake them into the snapshot. -->

## Required paths

| Path in snapshot | Contents |
|------------------|----------|
| `/opt/islo-qa/agent/` | Python helpers: `cleanup.py`, `stage_findings.py`, etc. |
| `/opt/islo-qa/prompts/full/` | Composed agent briefs (`agent-web-core.md`, `agent-web-platform.md`, `agent-cli-cross.md`) |
| `/opt/islo-qa/scripts/` | `start-qa-stack.sh` — boots your local app stack |
| `/workspace/islo-qa/` | Browser test harness (e.g. Playwright `package.json`, tests, config) |

The `islo-qa` job runs `check-snapshot`, `start-stack`, three parallel `run_agent` tasks, then cleanup/staging scripts. It does **not** ship harness source in this repo.

## Credentials

Auth and third-party IDs (`DESCOPE_PROJECT_ID`, test user OTP, `LINEAR_TEAM_ID`, etc.) belong in the Factory environment **`islo-qa-fullstack`** at job runtime — not in the snapshot tree.

## Building

1. Start from a base snapshot that already contains your application stack (or install it in a fresh sandbox).
2. Copy your harness into `/opt/islo-qa/` and `/workspace/islo-qa/`.
3. Run `npm ci` / install browsers in `/workspace/islo-qa/` if needed.
4. Capture snapshot **`islo-qa-fullstack`**.

See [`lines/islo-qa-line/README.md`](../../lines/islo-qa-line/README.md) for deploy steps.
