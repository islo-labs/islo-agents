# Feature delivery line

Implement, review, and verify one Linear issue or standalone task across its complete pull-request set. Failed reviews and verification route back to implementation.

## Stages

| Stage | Agent | Machine |
|-------|-------|---------|
| `implement` | `feature-delivery-implement` | `feature-delivery-code` |
| `review` | `feature-delivery-review` | `feature-delivery-code` |
| `verify` | `feature-delivery-verify` | `feature-delivery-platform` |

## Configure

Replace `REPLACE_WITH_YOUR_LINEAR_LABEL_NAME` in the trigger selector and connect Linear. Ticket-backed runs set `issue_id`; standalone runs leave it empty and pass the complete request in `task`. Implement returns `pull_requests` and `acceptance_criteria`, which review and verify consume. Each prompt stage returns a top-level `summary`.

The stage-specific workspaces include `{{line_run_id}}`. Retries and steering resume the same stage conversation and checkout. New runs receive separate workspaces. All three stages use Codex on Islo inference. Configure the Agent manifests to use your chosen model provider.

## Steer a delivery stage

Every visit sends the full Agent prompt with the current PR list, requirements,
and verification criteria. Use `follow_up` for an additional instruction:

```bash
islo factory line-run steer <run-id> review --param follow_up='Focus on the queue retry change.'
```

If the PR set changed, pass the complete current list with
`--param-json 'pull_requests=["https://github.com/your-org/your-repo/pull/123"]'`.
When steering `verify`, also pass updated `acceptance_criteria` if they changed.
The instruction applies on initial visits and continuations. With no instruction,
the Agent follows its normal workflow using the current inputs.

New deployments use `follow_up`. Existing runs pinned to the previous manifests
keep their `resume_prompt` contract until they finish.

## Build the Machines

Select your Factory with `islo factory set <factory>`. Follow each Machine guide and wait for successful published builds:

- [feature-delivery-code](machines/feature-delivery-code/README.md)
- [feature-delivery-manager](machines/feature-delivery-manager/README.md)
- [feature-delivery-platform](machines/feature-delivery-platform/README.md)

## Create Agents and deploy the Line

Run these commands from the repository root after configuring the placeholders and connections:

```bash
for manifest in examples/feature-delivery/agents/*/agent.toml; do
  islo agent validate "$manifest"
  islo agent create "$manifest"
done
islo agent validate examples/feature-delivery/manager-agent.toml
islo agent create examples/feature-delivery/manager-agent.toml
islo factory line validate examples/feature-delivery/line.toml
islo factory line deploy examples/feature-delivery/line.toml --dry-run
islo factory line deploy examples/feature-delivery/line.toml
```

For an existing Agent, use the [update procedure](../../README.md#upgrade-an-existing-installation), then redeploy the Line. Active runs keep their pinned versions.

## Check a run

```bash
islo factory line run feature-delivery --param task='Implement the requested feature.'
islo factory line runs feature-delivery
islo factory line-run events <run-id>
```

Inspect the typed outputs listed in `line.toml` and the transitions they select. The schedule or integration trigger can also start the Line. A manual run uses the same stage contracts.

## Remove the example

Delete the Line first with `islo factory line delete feature-delivery`. After active runs finish, delete its Agents with `islo agent delete <name>` and its Machines with `islo factory machine delete <name>`.
