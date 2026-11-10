# Islo Factory examples

Runnable Factory examples for Islo. Machines provide the environment, reusable Agents define execution and prompts, and Lines orchestrate Agent-backed stages. Start with the migrated [PR-review example](examples/pr-review/).

## Quick start (PR review)

1. Install the CLI and authenticate locally.
2. Connect GitHub and select your Factory and repository.
3. Follow [PR-review setup](examples/pr-review/README.md) to create a Machine and wait for its published version.
4. Edit the repository selector in `examples/pr-review/line.toml`.
5. Validate and create the reusable Agent, then validate and deploy the Line:

```bash
islo agent validate examples/pr-review/agents/pr-review.toml
islo agent create examples/pr-review/agents/pr-review.toml
islo factory line validate examples/pr-review/line.toml
islo factory line deploy examples/pr-review/line.toml
```

Approve the expected advisory comment before the manual Line check and one GitHub trigger event. Inspect each run with `islo factory line-run status`, `stages`, and `events`.

## Agent-backed example

| Example | Trigger | Outcome |
|---------|---------|---------|
| [pr-review](examples/pr-review/) | GitHub PR opened | Advisory review comment + typed verdict |

## Existing Job-based examples

The following templates retain their existing Job and snapshot configuration for compatibility. They have not migrated to Agent stages. Use PR review above for new Agent-backed Line setup.

| Example | Trigger | Outcome |
|---------|---------|---------|
| [feature-delivery](examples/feature-delivery/) | Linear label on issue | Implement, review, and verify across a PR set |
| [designer-line](examples/designer-line/) | Manual | Storybook design in a retained sandbox, publish on a later steer |
| [qa](examples/qa/) | Schedule | Parallel black-box QA agents, then a Slack message |
| [red-team-cli](examples/red-team-cli/) | Schedule | White-box + black-box CLI security review |
| [weekly-skills-refresh](examples/weekly-skills-refresh/) | Schedule | Refresh agent skills repo from product changes |

Each example README covers its prerequisites, placeholders, validation, verification, and cleanup.

## Repository layout

```text
examples/<name>/
  README.md          # How to deploy this example
  line.toml          # Factory line manifest
  agents/<agent>.toml # Reusable Agent configuration
scripts/
  validate_examples.py
```

Existing Job-based examples retain `jobs/` and `snapshots/` for compatibility.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). CI runs `scripts/validate_examples.py` on every pull request.

## License

Apache-2.0 — see [LICENSE](LICENSE).
