# Babysit

Fixes CI failures on PR branches.

- **Prompt / job:** `prompt.md`, `job.toml` (deployed as `islo-babysit`)
- **GitHub trigger:** `trigger-rules/github.json` → assembled into `webhooks/github-events.json`

## Trigger scope

Only failed `workflow_run` events from **allowlisted workflow names** (mirrors the old per-repo GHA `on.workflow_run.workflows` lists):

- `CI`, `Test`, `Build`, `PR Title Lint`
- `Terraform Validate`, `Ansible`
- `Lint, Format, and Unit Tests`, `Storybook Tests`

Also requires `event == pull_request`. Fork PRs are skipped in the job via `head_repository`.

If a repo adds a new CI workflow name, add it to the allowlist in `trigger-rules/github.json` and reassemble.
