# `islo-qa-line` template

Scheduled Factory line that runs **three parallel QA agents** against a local full-stack environment, then **deduplicates and publishes** findings to Linear.

## Stages

| Stage | Job | Snapshot |
|-------|-----|----------|
| `qa` | `islo-qa` | `islo-qa-fullstack` |
| `collect` | `islo-qa-collector` | `islo-qa-baseline` |

## Before you deploy

### 1. Build snapshots

Jobs expect harness files baked into VM snapshots — **not** embedded in `job.toml`. See:

- [`snapshots/islo-qa-fullstack/README.md`](../../snapshots/islo-qa-fullstack/README.md)
- [`snapshots/islo-qa-baseline/README.md`](../../snapshots/islo-qa-baseline/README.md)

You supply your own agent scripts, prompts, Playwright harness, and stack bootstrap under `/opt/islo-qa/` and `/workspace/islo-qa/` in the snapshot.

### 2. Factory environment: `islo-qa-fullstack`

Create a Factory environment with secrets your QA harness needs, for example:

| Variable | Purpose |
|----------|---------|
| `LINEAR_TEAM_ID` | Linear team UUID for the collector (required) |
| `DESCOPE_PROJECT_ID` | Auth provider project ID (if your app uses Descope) |
| `ISLO_QA_EMAIL` / `ISLO_QA_OTP` | Test user credentials for browser login |
| `SLACK_CHANNEL` | Optional Slack channel for collector notifications |

The collector ships with `DRY_RUN=1` so the first deploy validates without filing issues. Set `DRY_RUN=0` in the job manifest when ready.

### 3. Deploy jobs and line

```bash
islo job deploy islo-qa --dry-run && islo job deploy islo-qa
islo job deploy islo-qa-collector --dry-run && islo job deploy islo-qa-collector
islo factory line deploy lines/islo-qa-line/line.toml --dry-run
islo factory line deploy lines/islo-qa-line/line.toml
```

Adjust the schedule in `line.toml` (`cron`) for your timezone and cadence.
