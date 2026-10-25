# Snapshot contract: `designer`

UI snapshot for the design stage. One line run keeps the same sandbox across follow-ups.

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

The job names the sandbox `designer-<line-run-id>`. Do not point `snapshot_name` at a shared internal image.
