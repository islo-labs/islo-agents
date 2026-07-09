# Babysit

Fixes CI failures on PR branches.

- **Prompt / job:** `prompt.md`, `job.toml` (deployed as `islo-babysit`)
- **GitHub trigger:** `trigger-rules/github.json` → assembled into `webhooks/github-events.json`

## Trigger scope

Only failed `workflow_run` events from **allowlisted workflow names**, with `event == pull_request`.

This starter pack ships a minimal example allowlist (`"CI"` only). Edit `trigger-rules/github.json` to match the workflow names in your repos, then reassemble webhooks:

```bash
npm run assemble-webhooks
```

Fork PRs are skipped in the job via `head_repository`.
