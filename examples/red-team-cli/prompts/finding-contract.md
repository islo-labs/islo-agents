# Shared red-team output contract

All reviewer agents and the reporter must use this JSON shape. Return **valid JSON** only in the `report_json` job output (minified string).

## Top-level schema

```json
{
  "agent": "trust-boundaries | input-abuse | black-box | validate-and-report",
  "target": "your-cli",
  "commit": "<git rev-parse HEAD of the CLI checkout>",
  "generated_at": "<ISO-8601 UTC timestamp>",
  "findings": [],
  "summary": "<short human-readable summary>"
}
```

## Finding object

Every candidate, confirmed or not, must include:

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
3. Evidence is confirmed in source or passing tests, not speculative.

Otherwise use `medium`, `low`, or `info`, or mark `status: rejected`.

## Safety rules (all agents)

- Scope is **your CLI only**. Do not review other repositories.
- Use only unit/integration tests, wiremock/local listeners, synthetic credentials, and temporary `HOME` directories.
- **Never** run production logins, live tenant probing, or billing mutations.
- **Never** publish code, open PRs, or modify remotes from hunter stages.
- Distinguish confirmed findings from hypotheses. Do not upgrade severity without evidence.
