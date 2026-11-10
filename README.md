# Islo Factory examples

Deployable Factory lines built from Agents and Machines. A Machine builds the workspace, an Agent defines the work, and a Line connects agent stages through typed inputs, outputs, and transitions.

## Start with PR review

1. Install the [Islo CLI](https://islo.dev) and connect GitHub in your Factory.
2. Follow the [PR review Machine setup](examples/pr-review/machines/pr-review/README.md). Wait for its successful build.
3. Replace `REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY` in [line.toml](examples/pr-review/line.toml).
4. Create the Agent and deploy the Line:

```bash
islo agent validate examples/pr-review/agents/pr-review/agent.toml
islo agent create examples/pr-review/agents/pr-review/agent.toml
islo factory line validate examples/pr-review/line.toml
islo factory line deploy examples/pr-review/line.toml --dry-run
islo factory line deploy examples/pr-review/line.toml
```

Open a pull request and inspect `islo factory line runs pr-review`.

## Examples

| Example | Trigger | Outcome |
|---------|---------|---------|
| [pr-review](examples/pr-review/) | GitHub PR opened | Advisory review comment and typed verdict |
| [feature-delivery](examples/feature-delivery/) | Linear label on issue, or manual task | Implement, review, and verify a complete PR set |
| [designer-line](examples/designer-line/) | Manual | Storybook design, then publish on a later steer |
| [qa](examples/qa/) | Schedule | Three QA agent stages, validated reports, and a Slack message |
| [red-team-cli](examples/red-team-cli/) | Schedule | Source review, CLI testing, and reconciled findings |
| [weekly-skills-refresh](examples/weekly-skills-refresh/) | Schedule | Refresh agent guidance from product changes |

## Layout

```text
examples/<name>/
  README.md
  line.toml                 # Stage contracts and routing
  agents/<name>/agent.toml   # Prompt or script Agent
  manager-agent.toml        # Optional prompt Agent for Manager turns
  machines/<name>/README.md # Build instructions and workspace contract
  machines/<name>/files/    # Supporting files to install during the build
runtime/stages.py            # Deterministic reporting and publishing
scripts/validate_examples.py # Secret-free package validation
```

## Upgrade an existing installation

Build the Machines and create the Agents before deploying the replacement Line. Existing runs keep their pinned versions. Let those runs finish before deleting their old resources. Prompt changes belong in `agent.toml`; parameter and output changes belong in `line.toml`.

For an existing Agent, copy its manifest to an update file, remove the top-level `name`, and run `islo agent update <name> <update-file>`. Deploy the Line again to use the updated Agent version.

See [CONTRIBUTING.md](CONTRIBUTING.md) for validation and contribution rules.

## License

[Apache-2.0](LICENSE).
