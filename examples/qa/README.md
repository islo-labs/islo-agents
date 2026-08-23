# QA line

Scheduled Factory line that runs **three parallel black-box QA agents** against your deployed app, then **deduplicates and publishes** findings.

## Stages

| Stage | Job | Snapshot |
|-------|-----|----------|
| `qa` | `qa` | `qa` |
| `report` | `qa-report` | `qa-report` |

## Before you deploy

### 1. Commit the prompts into your own repository

Nothing here goes into Islo Knowledge. Copy this example's `prompts/` directory into your own repository under `.islo/prompts/`, on the branch the job clones:

```bash
mkdir -p .islo/prompts
cp <this-repo>/examples/qa/prompts/*.md .islo/prompts/
git add .islo && git commit -m "Add qa line prompts" && git push
```

Your repository then contains `.islo/prompts/{web-core,web-platform,cli-cross}.md`, one brief per parallel agent.

Each of the three fanout tasks in `jobs/qa/job.toml` clones that repository into `/workspace/.islo-prompts/REPLACE_WITH_REPOSITORY` in a `checkout-prompts` step, then hands its agent a one-line prompt naming the brief to read. The agent reads the brief fresh on every run, so tightening a brief in your repository changes the next run with no job redeploy, and your repository stays the single source of truth.

The clone needs no extra wiring. `gateway_profile = "default"` injects `GH_TOKEN`, which the step uses, so private repositories work.

Point the manifest at that repository by filling in both placeholders:

| Placeholder | Where | Set it to |
|-------------|-------|-----------|
| `REPLACE_WITH_OWNER` | the clone URL in all three tasks of `jobs/qa/job.toml` | the GitHub organisation or user that owns the repository holding your `.islo/prompts/` |
| `REPLACE_WITH_REPOSITORY` | the clone URL, the checkout path, and every prompt path in `jobs/qa/job.toml` | that repository's name |

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
