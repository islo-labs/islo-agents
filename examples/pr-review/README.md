# Pr review line

Review newly opened GitHub pull requests and post one advisory comment with a typed verdict.

## Stages

| Stage | Agent | Machine |
|-------|-------|---------|
| `review` | `pr-review` | `pr-review` |

## Configure

Replace `REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY` in the trigger selector with a repository you trust. Connect GitHub for that repository. Treat PR bodies and diffs as untrusted input. Only `pull_request.opened` triggers this example. The review is advisory and does not change branches.

## Build the Machines

Select your Factory with `islo factory set <factory>`. Follow each Machine guide and wait for successful published builds:

- [pr-review](machines/pr-review/README.md)

## Create Agents and deploy the Line

Run these commands from the repository root after configuring the placeholders and connections:

```bash
for manifest in examples/pr-review/agents/*/agent.toml; do
  islo agent validate "$manifest"
  islo agent create "$manifest"
done
islo factory line validate examples/pr-review/line.toml
islo factory line deploy examples/pr-review/line.toml --dry-run
islo factory line deploy examples/pr-review/line.toml
```

For an existing Agent, use the [update procedure](../../README.md#upgrade-an-existing-installation), then redeploy the Line. Active runs keep their pinned versions.

## Check a run

```bash
islo factory line run pr-review --param repository=your-org/your-repo --param pull_request_number=123 --param pull_request_url=https://github.com/your-org/your-repo/pull/123
islo factory line runs pr-review
islo factory line-run events <run-id>
```

Inspect the typed outputs listed in `line.toml` and the transitions they select. The schedule or integration trigger can also start the Line. A manual run uses the same stage contracts.

## Remove the example

Delete the Line first with `islo factory line delete pr-review`. After active runs finish, delete its Agents with `islo agent delete <name>` and its Machines with `islo factory machine delete <name>`.
