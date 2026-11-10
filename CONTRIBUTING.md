# Contributing

Each example is a complete Factory Line package. Keep its Agent manifests, Machine build instructions, supporting files, and deployment guide together under `examples/<name>/`.

## Package contract

- `[line].name` matches the example directory.
- Each stage uses `agent` to reference `agents/<name>/agent.toml`.
- Agent `name` matches its directory, and `machine` has a guide under `machines/<name>/README.md`.
- Parameter and output definitions live on the stage in `line.toml`. Transition bindings must reference those definitions.
- Prompt Agents keep the stage brief in their `prompt`. Supporting documents live under `machines/*/files/`.
- Script Agents use static commands. Read resolved inputs with `runtime/stages.py`; never interpolate report text into shell commands.
- Prompt stages declare a top-level `summary` output and tell the Agent to return it. The run chat displays that summary.
- Repeated visits retain the Agent workspace and session. An explicit `sandbox_name` includes `{{line_run_id}}`. Stages that share a workspace must use the same Machine.

## Validate a change

Run the secret-free checks used by CI:

```bash
python3 scripts/validate_examples.py
python3 -m unittest discover -s scripts -p 'test_*.py'
```

The delivery continuation regression also supports the real native adapter in
an `islo-web-api` checkout. Run it with that checkout's Python environment:

```bash
ISLO_WEB_API_ROOT=/workspace/islo-web-api \
  /workspace/islo-web-api/.venv/bin/python -m unittest discover -s scripts -p 'test_delivery_resume.py'
```

This exercises prompt selection and parameter substitution before inference.
CI runs the secret-free contract checks and skips the native adapter test when
`ISLO_WEB_API_ROOT` is absent.

The package validator checks local Agent references, Machine guides, stage contracts, transition graphs, placeholders, and forbidden internal values. It rejects legacy resource layouts. It does not replace the live API schema.

When the CLI is available, validate each Agent:

```bash
islo agent validate examples/<name>/agents/<agent>/agent.toml
```

Check all manifests against the live API schema without creating resources or calling a model:

```bash
uv run --with jsonschema python scripts/validate_api_schemas.py
```

Use `--openapi <file>` with a captured `/openapi.json` response for an offline schema check.

After building Machines and creating Agents in your development Factory, validate and dry-run the Line:

```bash
islo factory line validate examples/<name>/line.toml
islo factory line deploy examples/<name>/line.toml --dry-run
```

Describe the checks you ran in your PR. CI needs no credentials and never creates Factory resources. Use explicit `REPLACE_WITH_*`, `your-org/`, and `api.example.com` placeholders. Keep tenant IDs, secrets, and internal URLs out of examples.
