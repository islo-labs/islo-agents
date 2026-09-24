# QA line

Scheduled Factory line that runs **three parallel black-box QA agents** against your deployed app, deduplicates their reports, and posts one Slack message.

## Stages

| Stage | Job | Snapshot |
|-------|-----|----------|
| `qa` | `qa` | `qa` |
| `collect` | `qa-report` | `qa-report` |
| `slack-notify` | `qa-slack-notify` | none |

The QA stage emits `web_core_report_json`, `web_platform_report_json`, and `cli_cross_report_json`. Collect turns those into `slack_text`. Slack-notify posts that text and nothing else.

## Before you deploy

### 1. Bake the fan-out briefs into the `qa` snapshot

This job runs three parallel agents. Keep `web-core.md`, `web-platform.md`, and `cli-cross.md` in the snapshot (`snapshots/qa/snapshot-src/workspace/prompts/`) so the line view is not three pasted briefs. Replace the brief lists in those files with your product's flows. Bake that directory into `/workspace/prompts/` when you save the snapshot.

Also copy `snapshot-src/harness/stage.py` and `snapshot-src/harness/emit_report.py` to `/opt/qa-harness/harness/`.

### 2. Build snapshots

See `snapshots/qa/README.md` and `snapshots/qa-report/README.md`. Save snapshots as `qa` and `qa-report`.

### 3. Factory environment `qa`

Create a Factory environment named `qa` with whatever credentials your agents need (API token, test user). Do not put a channel id in the environment. The line passes the channel into `qa-slack-notify`.

Set your app URL via job param `qa_base_url` (default `https://your-app.example.com`).

### 4. Replace the Slack channel

| Placeholder | Where | Set it to |
|-------------|-------|-----------|
| `REPLACE_WITH_YOUR_SLACK_CHANNEL_ID` | `collect-to-slack` in `line.toml` | Your Slack channel ID |

Connect Slack: `islo login --tool slack`

### 5. Deploy

```bash
for job in qa qa-report qa-slack-notify; do
  islo job deploy --path "examples/qa/jobs/${job}/job.toml" --dry-run
  islo job deploy --path "examples/qa/jobs/${job}/job.toml"
done
islo factory line validate examples/qa/line.toml
islo factory line deploy examples/qa/line.toml --dry-run
islo factory line deploy examples/qa/line.toml
```

Adjust the schedule in `line.toml` (`cron`) for your timezone.

### 6. Verify

After the scheduled run (or a manual line run), inspect events:

```bash
islo factory line runs qa
islo factory line-run events <run-id>
```

Expect three report strings on `qa`, a `slack_text` on `collect`, and one Slack post from `slack-notify`.

### 7. Remove

Delete the deployed line and jobs from your tenant when you no longer need this example.

## Adoption notes for agents

Read this before copying the line into a tenant.

- Do not collapse collect and Slack back into one job. The collector's only job is `slack_text`. The notify job posts that string unchanged, so a bad message is a prompt bug, not a second rewrite.
- Each QA task must claim its own output (`web_core_report_json`, `web_platform_report_json`, `cli_cross_report_json`). The explore steps list `outputs = []` so they are not writers. `emit_report.py` writes `$ISLO_OUTPUT` from `/workspace/reports/<agent>.json`.
- Reports are optional. A missing agent still lets collect run. Collect prefers `/workspace/upstream/*.json` and only falls back to knowledge tagged `qa-findings`.
- The three briefs still describe generic product flows. Rewrite them before a real schedule. Leave the shared findings JSON contract in place so `stage.py` can validate evidence.
- `qa_base_url` is your deployed app. This line does not boot a local stack.
- Snapshot names `qa` and `qa-report` are names you create.
