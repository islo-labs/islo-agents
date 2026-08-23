# Red-team CLI line

Weekly Factory line for **white-box source review** + **black-box CLI adversarial testing**, with optional Linear filing and Slack notification.

## Stages

| Stage | Job | Notes |
|-------|-----|-------|
| `trust-boundaries` | `red-team-cli-trust-boundaries` | Auth, tokens, SSH, update trust |
| `input-abuse` | `red-team-cli-input-abuse` | Transport, shell quoting, manifest parsing |
| `black-box-cli` | `red-team-cli-black-box` | Live CLI against production API |
| `validate-and-report` | `red-team-cli-report` | Re-verify, dedupe, summarize |
| `slack-notify` | `red-team-cli-slack-notify` | Post summary to Slack |

All stages use snapshot **`red-team-cli`**. White-box stages need your CLI checkout at `/workspace/your-cli/` in that snapshot.

## Before you deploy

### 1. Bake prompts into the snapshot

Copy this example's `prompts/` directory to `/workspace/prompts/` in the `red-team-cli` snapshot (see `snapshots/red-team-cli/snapshot-src/workspace/prompts/`).

### 2. Build snapshot `red-team-cli`

See `snapshots/red-team-cli/README.md`. Clone your CLI repo to `/workspace/your-cli/` and copy `snapshot-src/harness/notify.py` before saving the snapshot.

### 3. Factory environment `red-team-cli`

Create a Factory environment named `red-team-cli` with a scoped API key for black-box testing:

```bash
islo environment patch red-team-cli --secret ISLO_API_KEY=<your-scoped-key>
```

Set `ISLO_BASE_URL` in `jobs/red-team-cli-black-box/job.toml` to your production API URL.

### 4. Replace placeholders

| Location | Placeholder | Action |
|----------|-------------|--------|
| `line.toml` | `REPLACE_WITH_YOUR_SLACK_CHANNEL_ID` | Your Slack channel ID |
| `jobs/red-team-cli-report/job.toml` | `REPLACE_WITH_YOUR_LINEAR_TEAM_NAME` | The Linear team that findings are filed against, set as `LINEAR_TEAM_NAME` in the sandbox env |
| `jobs/red-team-cli-report/job.toml` | `LINEAR_LABEL_NAME` | Label applied to filed issues. Already set to `security-review`, change it if your team uses another label |
| First report transition `linear_mode` | default `report` | Change to `create` when ready to file Linear issues |

Connect Slack: `islo login --tool slack`

### 5. Deploy

```bash
for job in red-team-cli-trust-boundaries red-team-cli-input-abuse red-team-cli-black-box red-team-cli-report red-team-cli-slack-notify; do
  islo job deploy --path "examples/red-team-cli/jobs/${job}/job.toml" --dry-run
  islo job deploy --path "examples/red-team-cli/jobs/${job}/job.toml"
done
islo factory line validate examples/red-team-cli/line.toml
islo factory line deploy examples/red-team-cli/line.toml --dry-run
islo factory line deploy examples/red-team-cli/line.toml
```

### 6. Verify

After the scheduled run (Monday 08:00 UTC) or a manual line run:

```bash
islo factory line runs red-team-cli
islo factory line-run events <run-id>
```

Expect Slack summary from `slack-notify` and JSON reports on earlier stages.

### 7. Remove

Delete the deployed line and jobs from your tenant when you no longer need this example.
