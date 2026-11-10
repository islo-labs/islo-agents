# Qa line

Run three black-box QA Agents against a deployed app, validate each report, deduplicate the results, and post the resulting Slack message.

## Stages

| Stage | Agent | Machine |
|-------|-------|---------|
| `web-core` | `qa-web-core` | `qa` |
| `web-core-report` | `qa-web-core-report` | `qa` |
| `web-platform` | `qa-web-platform` | `qa` |
| `web-platform-report` | `qa-web-platform-report` | `qa` |
| `cli-cross` | `qa-cli-cross` | `qa` |
| `cli-cross-report` | `qa-cli-cross-report` | `qa` |
| `collect` | `qa-report` | `qa-report` |
| `slack-notify` | `qa-slack-notify` | `qa` |

## Configure

Replace `REPLACE_WITH_YOUR_SLACK_CHANNEL_ID` in the final notification transition and connect Slack. Create the Factory environment `qa` for test credentials. Set `qa_base_url` on a manual run or change its default for scheduled runs.

The native Line runs `web-core`, `web-platform`, and `cli-cross` in order, each followed by a script Agent that validates findings. This replaces the previous parallel execution. Each exploration and its report share one run-scoped workspace; the three explorations stay isolated. Missing findings produce a `run_ok=false` report so collection can continue.

The collector consumes all three report strings and emits `slack_text` and `summary`. The notify Agent posts `slack_text` unchanged. It does not compose another summary. Customize the product flow briefs in the QA Machine files before scheduling.

## Build the Machines

Select your Factory with `islo factory set <factory>`. Follow each Machine guide and wait for successful published builds:

- [qa](machines/qa/README.md)
- [qa-report](machines/qa-report/README.md)

## Create Agents and deploy the Line

Run these commands from the repository root after configuring the placeholders and connections:

```bash
for manifest in examples/qa/agents/*/agent.toml; do
  islo agent validate "$manifest"
  islo agent create "$manifest"
done
islo factory line validate examples/qa/line.toml
islo factory line deploy examples/qa/line.toml --dry-run
islo factory line deploy examples/qa/line.toml
```

For an existing Agent, use the [update procedure](../../README.md#upgrade-an-existing-installation), then redeploy the Line. Active runs keep their pinned versions.

## Check a run

```bash
islo factory line run qa --param qa_base_url=https://your-app.example.com
islo factory line runs qa
islo factory line-run events <run-id>
```

Inspect the typed outputs listed in `line.toml` and the transitions they select. The schedule or integration trigger can also start the Line. A manual run uses the same stage contracts.

## Remove the example

Delete the Line first with `islo factory line delete qa`. After active runs finish, delete its Agents with `islo agent delete <name>` and its Machines with `islo factory machine delete <name>`.
