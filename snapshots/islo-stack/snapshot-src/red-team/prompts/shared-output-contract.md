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
