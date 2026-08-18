# `fullstack-qa-line` template

Scheduled Factory line that runs **three parallel black-box QA agents** against a deployed app URL, then **deduplicates and publishes** findings to Linear.

## Stages

| Stage | Job | Snapshot |
|-------|-----|----------|
| `qa` | `fullstack-qa` | `fullstack-qa` |
| `collect` | `fullstack-qa-collector` | `qa-collector` |

## Before you deploy

### 1. Build snapshots

Jobs expect harness files baked into VM snapshots — **not** embedded in `job.toml`. See:

- [`snapshots/fullstack-qa/README.md`](../../snapshots/fullstack-qa/README.md)
- [`snapshots/qa-collector/README.md`](../../snapshots/qa-collector/README.md)

### 2. Factory environment: `fullstack-qa`

Create a Factory environment with secrets your QA harness needs:

| Variable | Purpose |
|----------|---------|
| `ISLO_QA_EMAIL` | Test user email for browser login |
| `ISLO_QA_OTP` | Fixed OTP for that test user |
| `LINEAR_TEAM_ID` | Linear team UUID for the collector (required) |
| `SLACK_CHANNEL` | Optional Slack channel for collector notifications |

Set the deployed URL via the job parameter `qa_base_url` (default `https://app.islo.dev`) or override `ISLO_BASE_URL` in the line manifest.

The collector ships with `DRY_RUN=1` so the first deploy validates without filing issues. Set `DRY_RUN=0` in the job manifest when ready.

### 3. Deploy jobs and line

```bash
islo job deploy fullstack-qa --dry-run && islo job deploy fullstack-qa
islo job deploy fullstack-qa-collector --dry-run && islo job deploy fullstack-qa-collector
islo factory line deploy lines/fullstack-qa-line/line.toml --dry-run
islo factory line deploy lines/fullstack-qa-line/line.toml
```

Adjust the schedule in `line.toml` (`cron`) for your timezone and cadence.
