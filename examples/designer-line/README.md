# Designer line line

Design one UI request in Storybook and return a public share. Publish only when a later steer of the same design stage requests it.

## Stages

| Stage | Agent | Machine |
|-------|-------|---------|
| `design` | `designer-design` | `designer` |

## Configure

The design Agent starts the idempotent Storybook script at every visit. It returns `design_result`, `share_url`, `sandbox_name`, `pr_url`, `linear_issue_id`, and `summary`. The last two identifiers stay empty until publishing creates them.

The happy path completes on `done`. A follow-up steers `design` on the same run with `resume_prompt`. Include the full instruction; the first visit ignores this parameter. Publishing requires an explicit instruction to commit, push, and open the PR. The retained workspace and conversation belong to that Line Run.

The backend delivers all conversational text. Reviewed PNG, MP4, or WebM evidence may be uploaded only to the trusted Slack origin resolved from the Line Run. Manual runs have no such origin and return the share URL.

## Build the Machines

Select your Factory with `islo factory set <factory>`. Follow each Machine guide and wait for successful published builds:

- [designer](machines/designer/README.md)
- [designer-line-manager](machines/designer-line-manager/README.md)

## Create Agents and deploy the Line

Run these commands from the repository root after configuring the placeholders and connections:

```bash
for manifest in examples/designer-line/agents/*/agent.toml; do
  islo agent validate "$manifest"
  islo agent create "$manifest"
done
islo agent validate examples/designer-line/manager-agent.toml
islo agent create examples/designer-line/manager-agent.toml
islo factory line validate examples/designer-line/line.toml
islo factory line deploy examples/designer-line/line.toml --dry-run
islo factory line deploy examples/designer-line/line.toml
```

For an existing Agent, use the [update procedure](../../README.md#upgrade-an-existing-installation), then redeploy the Line. Active runs keep their pinned versions.

## Check a run

```bash
islo factory line run designer-line --param task='Make the empty state match the settings screen.'
islo factory line runs designer-line
islo factory line-run events <run-id>
```

Inspect the typed outputs listed in `line.toml` and the transitions they select. The schedule or integration trigger can also start the Line. A manual run uses the same stage contracts.

## Remove the example

Delete the Line first with `islo factory line delete designer-line`. After active runs finish, delete its Agents with `islo agent delete <name>` and its Machines with `islo factory machine delete <name>`.
