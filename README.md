# Islo Factory examples

Runnable **Factory line** templates for Islo sandboxes. Each example is a self-contained package: `line.toml`, jobs, optional prompts, and snapshot recipes.

## Quick start (PR review)

The fastest path to a working line:

1. Install the CLI: `curl -fsSL https://islo.dev/install.sh | bash`
2. Log in: `islo login`
3. Connect GitHub in the Islo console and select your repository.
4. Edit `examples/pr-review/line.toml` — replace `REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY`.
5. Deploy:

```bash
islo job deploy --path examples/pr-review/jobs/pr-review/job.toml --dry-run
islo job deploy --path examples/pr-review/jobs/pr-review/job.toml
islo factory line validate examples/pr-review/line.toml
islo factory line deploy examples/pr-review/line.toml
```

6. Open a pull request and inspect `islo factory line runs pr-review`.

See [examples/pr-review/README.md](examples/pr-review/README.md) for details.

## Examples

| Example | Trigger | Outcome |
|---------|---------|---------|
| [pr-review](examples/pr-review/) | GitHub PR opened | Advisory review comment + typed verdict |
| [feature-delivery](examples/feature-delivery/) | Linear label on issue | Implement → review → verify across PR set |
| [qa](examples/qa/) | Schedule | Parallel black-box QA agents + deduplicated report |
| [red-team-cli](examples/red-team-cli/) | Schedule | White-box + black-box CLI security review |
| [weekly-skills-refresh](examples/weekly-skills-refresh/) | Schedule | Refresh agent skills repo from product changes |

Each example README covers snapshot build, environment variables, placeholders, deploy order, and cleanup.

## Repository layout

```text
examples/<name>/
  README.md          # How to deploy this example
  line.toml          # Factory line manifest
  jobs/<job>/job.toml
  prompts/           # Stage briefs (inlined into jobs) and snapshot-only supporting docs
  snapshots/<name>/  # Snapshot bake contract + snapshot-src/
scripts/
  validate_examples.py
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). CI runs `scripts/validate_examples.py` on every pull request.

## License

Apache-2.0 — see [LICENSE](LICENSE).
