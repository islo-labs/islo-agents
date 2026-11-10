# Red team cli line

Review CLI source, test the CLI against a target API, reconcile confirmed findings, and post a Slack report. Linear filing is optional.

## Stages

| Stage | Agent | Machine |
|-------|-------|---------|
| `trust-boundaries` | `red-team-cli-trust-boundaries` | `red-team-cli` |
| `input-abuse` | `red-team-cli-input-abuse` | `red-team-cli` |
| `black-box-cli` | `red-team-cli-black-box` | `red-team-cli` |
| `validate-and-report` | `red-team-cli-report` | `red-team-cli` |
| `slack-notify` | `red-team-cli-slack-notify` | `red-team-cli` |

## Configure

Replace `REPLACE_WITH_YOUR_SLACK_CHANNEL_ID` in `line.toml` and `REPLACE_WITH_YOUR_LINEAR_TEAM_NAME` in the report Agent. Connect Slack, and connect Linear if you enable issue filing. Configure the Factory environment `red-team-cli` with scoped credentials for your target CLI. Set `TARGET_API_URL` in the relevant Agent prompts to your authorized test API.

The report stage defaults to `linear_mode=report`. Change its stage default to `create` to file confirmed findings. Source-review stages return `report_json` and `summary`; reconciliation consumes the reports and emits `slack_text`. The script notification Agent posts that text unchanged.

## Build the Machines

Select your Factory with `islo factory set <factory>`. Follow each Machine guide and wait for successful published builds:

- [red-team-cli](machines/red-team-cli/README.md)

## Create Agents and deploy the Line

Run these commands from the repository root after configuring the placeholders and connections:

```bash
for manifest in examples/red-team-cli/agents/*/agent.toml; do
  islo agent validate "$manifest"
  islo agent create "$manifest"
done
islo factory line validate examples/red-team-cli/line.toml
islo factory line deploy examples/red-team-cli/line.toml --dry-run
islo factory line deploy examples/red-team-cli/line.toml
```

For an existing Agent, use the [update procedure](../../README.md#upgrade-an-existing-installation), then redeploy the Line. Active runs keep their pinned versions.

## Check a run

```bash
islo factory line run red-team-cli
islo factory line runs red-team-cli
islo factory line-run events <run-id>
```

Inspect the typed outputs listed in `line.toml` and the transitions they select. The schedule or integration trigger can also start the Line. A manual run uses the same stage contracts.

## Remove the example

Delete the Line first with `islo factory line delete red-team-cli`. After active runs finish, delete its Agents with `islo agent delete <name>` and its Machines with `islo factory machine delete <name>`.
