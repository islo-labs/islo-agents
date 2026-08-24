# QA line

Scheduled Factory line that runs **three parallel black-box QA agents** against your deployed app, then **deduplicates and publishes** findings.

## Stages

| Stage | Job | Snapshot |
|-------|-----|----------|
| `qa` | `qa` | `qa` |
| `report` | `qa-report` | `qa-report` |

## Before you deploy

### 1. Bake the fan-out briefs into the `qa` snapshot

This job runs three parallel agents. Keep `web-core.md`, `web-platform.md`, and `cli-cross.md` in the snapshot (`snapshots/qa/snapshot-src/workspace/prompts/`) so the line/job view is not three pasted briefs. Bake that directory into `/workspace/prompts/` when you save the snapshot.

### 2. Build snapshots

See `snapshots/qa/README.md` and `snapshots/qa-report/README.md`. Save snapshots as `qa` and `qa-report`.

### 3. Factory environment `qa`

Create a Factory environment named `qa` with:

| Variable | Purpose |
|----------|---------|
| `ISLO_API_KEY` | CLI auth for QA agents |
| `SLACK_CHANNEL` or `SLACK_CHANNEL_ID` | Optional Slack channel for reporter notifications |

Set your app URL via job param `qa_base_url` (default `https://your-app.example.com`) or override `ISLO_BASE_URL` in the job manifest.

The reporter ships with `DRY_RUN=1` in `jobs/qa-report/job.toml` so the first scheduled run collects and logs findings without posting to Slack. Set `DRY_RUN=0` when you are ready to notify a channel.

### 4. Deploy

```bash
islo job deploy --path examples/qa/jobs/qa/job.toml --dry-run
islo job deploy --path examples/qa/jobs/qa/job.toml
islo job deploy --path examples/qa/jobs/qa-report/job.toml --dry-run
islo job deploy --path examples/qa/jobs/qa-report/job.toml
islo factory line validate examples/qa/line.toml
islo factory line deploy examples/qa/line.toml --dry-run
islo factory line deploy examples/qa/line.toml
```

Adjust the schedule in `line.toml` (`cron`) for your timezone.

### 5. Verify

After the scheduled run (or a manual line run), inspect events:

```bash
islo factory line runs qa
islo factory line-run events <run-id>
```

### 6. Remove

Delete the deployed line and jobs from your tenant when you no longer need this example.
