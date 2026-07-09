# Implementor

Implements a tracked issue: enrich context from the trigger source, change code, open PR(s), report back.

- **Prompt / job:** `prompt.md`, `job.toml` (deployed as `linear-implementor` today)
- **Linear trigger:** `trigger-rules/linear.json` → assembled into `webhooks/linear-issues.json`

```bash
mkdir -p jobs/linear-implementor
cp agents/implementor/job.toml jobs/linear-implementor/job.toml
islo job deploy linear-implementor

npm run assemble-webhooks
islo webhook incoming create --request-json @webhooks/linear-issues.json
```

## Label ID

Replace `REPLACE_WITH_YOUR_LINEAR_LABEL_ID` in `trigger-rules/linear.json` with the UUID of the label that should start the implementor (e.g. your workspace’s `islo` label). Then reassemble webhooks.
