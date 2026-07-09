# Implementor

Implements a tracked issue: enrich context from the trigger source, change code, open PR(s), report back.

- **Prompt / job:** `prompt.md`, `job.toml` (deployed as `linear-implementor` today)
- **Linear trigger:** `rules/linear.json` → assembled into `webhooks/linear-issues.json`

```bash
mkdir -p jobs/linear-implementor
cp agents/implementor/job.toml jobs/linear-implementor/job.toml
islo job deploy linear-implementor

node scripts/assemble-webhooks.js
islo webhook incoming create --request-json @webhooks/linear-issues.json
```

Update the `islo` label UUID in `rules/linear.json` if your workspace differs, then reassemble.
