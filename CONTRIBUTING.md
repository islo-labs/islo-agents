# Contributing

Thank you for improving Islo Factory examples.

## Example contract

Every example under `examples/<name>/` must be a **complete deployable package**:

- `README.md` — prerequisites, knowledge publication, snapshot steps, placeholders, deploy commands, verification, cleanup
- `line.toml` — `[line].name` matches the directory name
- `jobs/<job-name>/job.toml` — `[job].name` matches the job directory name
- `snapshots/<snapshot-name>/README.md` when a job references `snapshot_name`
- `prompts/` when jobs bind knowledge slugs — every slug must appear in the example README

## Validator

Run locally before opening a pull request:

```bash
python3 scripts/validate_examples.py
```

The validator checks TOML structure, line-to-job references, snapshot READMEs, forbidden internal IDs/domains, and knowledge slug documentation.

CI runs **only** `validate_examples.py` on every pull request (including forks). This public repo does not call the Islo API in GitHub Actions — no tenant secrets, no `islo factory line validate` in CI.

To validate against your own tenant before deploy, run locally:

```bash
islo job deploy --path examples/<name>/jobs/<job>/job.toml --dry-run
islo factory line validate examples/<name>/line.toml
```

## Pull requests

1. Add or update one example directory under `examples/`.
2. Run `python3 scripts/validate_examples.py` — must pass.
3. Optionally run CLI dry-run / line validate against your tenant.
4. Describe how you verified the example.

Do not add tenant-specific secrets, internal Islo URLs, or workflows that mutate production tenants.

## New examples

Follow an existing example's shape. Prefer:

- Public runner image `ghcr.io/islo-labs/islo-runner:latest`
- Explicit placeholders (`REPLACE_WITH_*`, `your-org/`, `api.example.com`)
- Typed job outputs where the line consumes stage results
- One README per example — customers should not need cross-directory context
