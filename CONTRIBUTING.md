# Contributing

Thank you for improving Islo Factory examples.

## Example contract

Every example under `examples/<name>/` must be a **complete deployable package**:

- `README.md` — prerequisites, knowledge publication, snapshot steps, placeholders, deploy commands, verification, cleanup
- `line.toml` — `[line].name` matches the directory name
- `jobs/<job-name>/job.toml` — `[job].name` matches the job directory name
- `snapshots/<snapshot-name>/README.md` when a job references `snapshot_name`
- Stage briefs in the job `run_agent` literal (not a parallel `prompts/` tree). Snapshot-only supporting docs live under `snapshots/*/snapshot-src/workspace/prompts/`

## Validator

Run locally before opening a pull request:

```bash
python3 scripts/validate_examples.py
```

The validator checks TOML structure, line-to-job references, snapshot READMEs, forbidden internal IDs/domains, and that stage briefs are not duplicated under `prompts/`.

CI runs **only** `validate_examples.py` on every pull request (including forks). This public repo does not call the Islo API in GitHub Actions.

`validate_examples.py` checks naming, file layout, and forbidden strings — it does **not** validate manifests against the API schema. Passing the script is necessary but not sufficient.

## Job outputs

Every job that runs an agent should declare a `summary` output (or `<name>_summary`, such as `root_cause_summary`):

```toml
[outputs.summary]
type = "string"
required = true
description = "Short human-readable summary of what the job did and its verdict."
```

- Tell the agent to return it in the prompt's output section, for example: "Always return `summary`: two to four sentences on what you did and the outcome."
- The Islo run chat shows an output whose key is `summary` or ends in `_summary` as the stage's reply. Keep the machine-readable verdict in a separate typed output such as `review_result`. A job that declares only a `*_result` ends on an almost empty stage.
- Put the summary at the top level of the job outputs. A `summary` field inside a JSON blob output (for example `report_json`) is not shown; return it as its own output as well.
- Jobs with no agent, such as a Slack notify job that only posts a string, do not need one.

## Pull requests

1. Add or update one example directory under `examples/`.
2. Run `python3 scripts/validate_examples.py` — must pass.
3. Run against your tenant (required for manifest changes):
   ```bash
   islo job deploy --path examples/<name>/jobs/<job>/job.toml --dry-run
   islo factory line validate examples/<name>/line.toml
   ```
4. Describe how you verified the example.

Do not add tenant-specific secrets, internal Islo URLs, or workflows that mutate production tenants.

## New examples

Follow an existing example's shape. Prefer:

- Public runner image `ghcr.io/islo-labs/islo-runner:latest`
- Explicit placeholders (`REPLACE_WITH_*`, `your-org/`, `api.example.com`)
- Typed job outputs where the line consumes stage results
- One README per example — customers should not need cross-directory context
