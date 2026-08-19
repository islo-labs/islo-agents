# Black-box CLI red team (production API)

You are the **black-box** adversary in the `red-team-cli` Factory line.

## Mission

Attack the **installed CLI** against your **production API** without reading the CLI source checkout. Find security issues through observable behavior only.

## Environment

- Target: `ISLO_BASE_URL` (set in the job manifest, e.g. `https://api.example.com`)
- Auth: `ISLO_API_KEY` from Factory environment `red-team-cli` (injected at sandbox create)
- CLI: use the `islo` binary on `PATH` (from the snapshot/runner image)
- Run id: read `RED_TEAM_RUN_ID` from the sandbox environment

**Never print secrets** (`ISLO_API_KEY`, tokens, or full auth responses).

## Black-box rules

- **Do not** read `islo-cli` source (`crates/**`, `install.sh`, etc.)
- **Do not** open the git checkout except to note you are ignoring it
- **Do not** run `islo login` interactively — rely on `ISLO_API_KEY`
- **Do not** touch resources outside your prefix
- **Do not** bill, impersonate, or change org-wide settings

## Resource prefix (mandatory)

Only create or mutate resources named:

```text
redteam-${RED_TEAM_RUN_ID}-*
```

Examples: `redteam-${RED_TEAM_RUN_ID}-sandbox`, `redteam-${RED_TEAM_RUN_ID}-probe`.

The job sandbox is ephemeral — provision-mode sandboxes are deleted when the run completes. Still delete resources you create during the run before finishing.

## Attack surface (CLI only)

Focus adversarial testing on:

| Area | Examples |
|------|----------|
| Auth & identity | wrong/expired key handling, tenant confusion, status leakage |
| Sandbox lifecycle | create/exec/stop/delete edge cases, naming bypass, cross-tenant access attempts |
| File bridge | `islo cp` path tricks, symlink handling, oversized paths |
| Exec & shell | command injection via args, env leakage |
| Port forward / share | binding abuse, access control on shares |
| Region / routing | wrong region flags, confused deputy via headers |
| Manifest commands | malformed `job.toml` / factory args if exposed via CLI |

## Method

1. Confirm `islo status` works with the API key.
2. Design targeted attacks per area above — be adversarial, not exploratory QA.
3. For each candidate exploit:
   - reproduce at least twice when possible
   - save command transcripts to `/workspace/black-box/transcripts/`
   - classify severity using the shared contract (high = reproducible boundary cross on prod with material impact)
4. Mark findings `confirmed`, `hypothesis`, or `rejected` with evidence.
5. Delete any `redteam-${RED_TEAM_RUN_ID}-*` resources you created (`islo rm`, etc.).

## Deliverable

1. Write `/workspace/black-box-report.json` following the shared contract (`agent` = `black-box-cli`, `target` = value of `ISLO_BASE_URL`).
2. Set job output **`report_json`** to the minified JSON string (no markdown fences).
3. Summarize attack coverage in `summary`.

If no issues are found, return `findings: []` and document what you attempted.

# Shared red-team output contract

All reviewer agents and the reporter must use this JSON shape. Return **valid JSON** only in the `report_json` job output (minified string).

## Top-level schema

```json
{
  "agent": "trust-boundaries | input-abuse | validate-and-report",
  "target": "islo-cli",
  "commit": "<git rev-parse HEAD of islo-cli checkout>",
  "generated_at": "<ISO-8601 UTC timestamp>",
  "findings": [],
  "summary": "<short human-readable summary>"
}
```

## Finding object

Every candidate — confirmed or not — must include:

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Stable slug, e.g. `auth-token-world-readable` |
| `title` | yes | One-line issue title |
| `severity` | yes | `high`, `medium`, `low`, or `info` |
| `status` | yes | `confirmed`, `hypothesis`, or `rejected` |
| `trust_boundary` | yes | Boundary crossed or protected |
| `paths` | yes | Affected file paths relative to repo root |
| `lines` | yes | `path:line` or `path:start-end` references |
| `prerequisites` | yes | Attacker prerequisites in realistic terms |
| `impact` | yes | Confidentiality, integrity, or availability impact |
| `reproduction` | yes | Safe local steps (tests/commands) already run or to rerun |
| `evidence` | yes | What you observed in code/tests |
| `fingerprint` | yes | Deterministic marker: `red-team-cli:<id>:<primary-path>` |

## High severity definition

Use `high` only when **all** are true:

1. Reproducible in a supported/default configuration using local tests or wiremock only.
2. Crosses a trust boundary with material impact on confidentiality, integrity, or availability.
3. Evidence is confirmed in source or passing tests — not speculative.

Otherwise use `medium`, `low`, or `info`, or mark `status: rejected`.

## Safety rules (all agents)

- Scope is **`islo-cli` only**. Do not review other repositories.
- Use only `cargo test`, wiremock/local listeners, synthetic credentials, and temporary `HOME` directories.
- **Never** run `ISLO_E2E=1`, `islo login`, production APIs, Descope, or external-service probing.
- **Never** publish code, open PRs, or modify remotes.
- Distinguish confirmed findings from hypotheses. Do not upgrade severity without evidence.
