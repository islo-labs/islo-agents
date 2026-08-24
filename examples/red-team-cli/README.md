# Red-team CLI line

Weekly factory line for **white-box source review** + **black-box CLI adversarial testing**, with optional Linear filing and Slack notification.

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

### 1. Bake the shared finding contract into the snapshot

Stage briefs live in each job's `run_agent` prompt. The shared finding contract lives only in `snapshots/red-team-cli/snapshot-src/workspace/prompts/finding-contract.md`; bake it into `/workspace/prompts/` when you save the snapshot.

### 2. Build snapshot `red-team-cli`

See `snapshots/red-team-cli/README.md`. Clone your CLI repo to `/workspace/your-cli/` and copy `snapshot-src/harness/notify.py` before saving the snapshot.

### 3. factory environment `red-team-cli`

Create a factory environment named `red-team-cli` with a scoped API key for the **target** CLI (not an Islo key):

```bash
islo environment patch red-team-cli --secret TARGET_API_KEY=<your-scoped-key>
```

Set `TARGET_API_URL` in `jobs/red-team-cli-black-box/job.toml` to that CLI's production API URL.

Bake `your-cli` onto `PATH` in the snapshot (the binary the black-box stage runs).

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
