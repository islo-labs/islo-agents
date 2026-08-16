# `red-team-cli` template

Weekly Factory line for **white-box source review** + **black-box CLI adversarial testing**, with optional Linear filing and Slack notification.

## Stages

| Stage | Job | Notes |
|-------|-----|-------|
| `trust-boundaries` | `red-team-cli-trust-boundaries` | Auth, tokens, SSH, update trust |
| `input-abuse` | `red-team-cli-input-abuse` | Transport, shell quoting, manifest parsing |
| `black-box-cli` | `red-team-cli-black-box` | Live CLI against production API |
| `validate-and-report` | `red-team-cli-report` | Re-verify, dedupe, summarize |
| `slack-notify` | `red-team-cli-slack-notify` | Post summary to Slack |

All white-box stages use snapshot **`islo-stack`** (your monorepo checkout with the CLI under test).

## Before you deploy

### 1. Snapshot `islo-stack`

Bake a snapshot that includes your CLI repository (convention: a top-level `islo-cli/` git checkout). White-box jobs locate it automatically.

### 2. Factory environment: `red-team-cli-prod` (black-box only)

The black-box stage sets `environment = "red-team-cli-prod"`. Add a scoped API key as a **sandbox secret**:

```bash
islo environment patch red-team-cli-prod --secret ISLO_API_KEY=<your-scoped-key>
```

Set `ISLO_BASE_URL` in the job manifest to your production API URL.

### 3. Replace placeholders

| Location | Placeholder | Action |
|----------|-------------|--------|
| `lines/red-team-cli/line.toml` | `REPLACE_WITH_YOUR_SLACK_CHANNEL_ID` | Your Slack channel ID |
| `agents/red-team-cli-report/job.toml` | `LINEAR_TEAM_NAME`, `LINEAR_LABEL_NAME` | Team and label names for filing |
| First transition `linear_mode` | default `report` | Change to `create` when ready to file Linear issues |

Connect Slack: `islo login --tool slack`

### 4. Deploy

```bash
for job in red-team-cli-trust-boundaries red-team-cli-input-abuse red-team-cli-black-box red-team-cli-report red-team-cli-slack-notify; do
  islo job deploy "$job" --dry-run && islo job deploy "$job"
done
islo factory line deploy lines/red-team-cli/line.toml --dry-run
islo factory line deploy lines/red-team-cli/line.toml
```
