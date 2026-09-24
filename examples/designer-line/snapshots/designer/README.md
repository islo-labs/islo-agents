# Snapshot contract: `designer`

UI sandbox for the design stage. The same sandbox is kept across follow-ups for one `work_key`.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/workspace/app/` | Your UI git checkout |
| `/workspace/scripts/start-storybook.sh` | Starts Storybook on port 6006 and writes `/workspace/design/share.json` with a `url` field |
| Browser on `PATH` | Whatever tool the design prompt should use for screenshots |

`start-storybook.sh` must be idempotent. It should not discard local design edits on later visits.

```bash
islo snapshot save <your-build-sandbox> --name designer
```

The job names the sandbox `designer-<work_key>`. Do not point `snapshot_name` at a shared internal image.
