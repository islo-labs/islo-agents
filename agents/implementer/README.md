# Implementer

Implements a tracked issue from any source system: enrich context, change code, open PR(s), report back.

- **Prompt / job:** `prompt.md`, `job.toml` (job name `implementer`)
- **Triggers:** `trigger-rules/<source>.json` — Linear example ships today; add Jira/etc. the same way (map source fields → the shared `issue_*` params)

```bash
mkdir -p jobs/implementer
cp agents/implementer/job.toml jobs/implementer/job.toml
islo job deploy implementer

npm run assemble-webhooks
islo webhook incoming create --request-json @webhooks/linear-issues.json
```

## Source-specific config

Linear: replace `REPLACE_WITH_YOUR_LINEAR_LABEL_ID` in `trigger-rules/linear.json` with your label UUID, then reassemble. The job itself stays source-agnostic.
