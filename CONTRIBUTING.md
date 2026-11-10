# Contributing

Thank you for improving Islo Factory examples.

## Example contract

New examples use Machines, reusable Agents, and Agent-backed Line stages. Each package under `examples/<name>/` includes:

- `README.md` with Machine readiness, provider prerequisites, placeholders, Agent and Line validation/deployment, approved effects, verification, and cleanup.
- `line.toml` whose `[line].name` matches the example directory.
- `agents/<agent-name>.toml` whose immutable `name` matches the file stem.
- Reusable prompts and supported harness, model, provider, Skills, and MCP settings in the Agent. Stage params and outputs belong in the Line.

Existing Job-based packages retain their `jobs/`, snapshot recipes, and `run_agent` briefs for compatibility. Their maintenance checks remain in place.

## Validator

Run locally before opening a pull request:

```bash
python3 scripts/validate_examples.py
```

The validator checks Agent and Job references, stage transition contracts, TOML structure, placeholders, snapshot prerequisites for existing Job packages, and forbidden internal identifiers. Regression checks cover both package styles.

CI runs the validator and its focused regression scripts on every pull request, including forks. This public repo does not call the Islo API in GitHub Actions.

`validate_examples.py` checks naming, file layout, and forbidden strings — it does **not** validate manifests against the API schema. Passing the script is necessary but not sufficient.

## Agent stage outputs

Declare typed params and outputs on the Line stage. Prompt Agent stages should include a required string `summary` output alongside their machine-readable verdict. Tell the Agent to return each declared output. The run chat shows `summary` or `*_summary` as the stage reply.

## Compatibility Job outputs

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
   islo agent validate examples/<name>/agents/<agent>.toml
   islo factory line validate examples/<name>/line.toml
   ```
   The Line validator resolves saved Agents. If they are not deployed, report the missing-resource lookup separately from schema results. For compatibility Job edits, retain the Job deploy dry-run check.
4. Describe how you verified the example and whether inference or external effects were exercised.

Do not add tenant-specific secrets, internal Islo URLs, or workflows that mutate production tenants.

## New examples

Follow an existing example's shape. Prefer:

- Public runner image `ghcr.io/islo-labs/islo-runner:latest`
- Explicit placeholders (`REPLACE_WITH_*`, `your-org/`, `api.example.com`)
- Typed stage outputs where the Line consumes results
- One README per example — customers should not need cross-directory context
