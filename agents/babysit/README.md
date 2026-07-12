# Babysit

Fixes CI failures on PR branches.

- **Prompt / job:** `prompt.md`, `job.toml` (job name `babysit`)
- **GitHub trigger:** `trigger-rules/github.json` → assembled into `webhooks/github-events.json`

## Trigger scope

Fires on any completed `workflow_run` with `conclusion == failure` and `event == pull_request` — one babysit per failed workflow (not per job inside a workflow). Multiple failing workflows on the same PR can start multiple babysit runs.

Fork PRs are skipped in the job via `head_repository`.
