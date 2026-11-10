# Weekly skills refresh line

Inspect product changes and refresh agent guidance. Separate script Agents prepare the checkout and publish changes after the edit Agent succeeds.

## Stages

| Stage | Agent | Machine |
|-------|-------|---------|
| `prepare` | `skills-refresh-prepare` | `skills-refresh` |
| `refresh` | `weekly-skills-refresh` | `skills-refresh` |
| `publish` | `skills-refresh-publish` | `skills-refresh` |

## Configure

Set stage defaults for `skills_repo`, `since`, `skills_globs`, `branch_prefix`, and `commit_message` in `line.toml`. Use the same defaults on prepare, refresh, and publish. Pass a manual Line input to override a value consistently for all stages.

`publish_mode` supports `pr`, `commit`, or `report`. The default opens a PR when guidance changed. Report mode performs no commit or push. The edit Agent only changes files matching `skills_globs`; the publish script checks that allowlist again. Product checkouts come from the Machine build; rebuild it for newer product revisions.

All three stages share `skills-refresh-{{line_run_id}}`, but the edit Agent has its own conversation. The publish transition requires a successful edit stage. Preparation refuses to discard uncommitted changes on retries.

## Build the Machines

Select your Factory with `islo factory set <factory>`. Follow each Machine guide and wait for successful published builds:

- [skills-refresh](machines/skills-refresh/README.md)

## Create Agents and deploy the Line

Run these commands from the repository root after configuring the placeholders and connections:

```bash
for manifest in examples/weekly-skills-refresh/agents/*/agent.toml; do
  islo agent validate "$manifest"
  islo agent create "$manifest"
done
islo factory line validate examples/weekly-skills-refresh/line.toml
islo factory line deploy examples/weekly-skills-refresh/line.toml --dry-run
islo factory line deploy examples/weekly-skills-refresh/line.toml
```

For an existing Agent, use the [update procedure](../../README.md#upgrade-an-existing-installation), then redeploy the Line. Active runs keep their pinned versions.

## Check a run

```bash
islo factory line run weekly-skills-refresh --param publish_mode=report --param skills_repo=your-org/agent-skills
islo factory line runs weekly-skills-refresh
islo factory line-run events <run-id>
```

Inspect the typed outputs listed in `line.toml` and the transitions they select. The schedule or integration trigger can also start the Line. A manual run uses the same stage contracts.

## Remove the example

Delete the Line first with `islo factory line delete weekly-skills-refresh`. After active runs finish, delete its Agents with `islo agent delete <name>` and its Machines with `islo factory machine delete <name>`.
