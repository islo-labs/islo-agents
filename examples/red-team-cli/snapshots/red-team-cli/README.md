# Snapshot contract: `red-team-cli`

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/red-team-cli/harness/notify.py` | Optional. Posts `SLACK_NOTIFY_TEXT`. The line's slack job inlines the same call and does not use this snapshot. |
| `/workspace/black-box/transcripts/` | Empty dir for black-box evidence |
| `/workspace/your-cli/` | Your CLI git checkout (white-box stages) |
| `PATH` | `your-cli` binary for the black-box stage |
| `/workspace/prompts/` | Shared finding contract (`finding-contract.md`) |

Copy `snapshot-src/harness/notify.py` to `/opt/red-team-cli/harness/`, create `/workspace/black-box/transcripts/`, copy `snapshot-src/workspace/prompts/` to `/workspace/prompts/`, clone your CLI repo to `/workspace/your-cli/`, then:

```bash
islo snapshot save <your-build-sandbox> --name red-team-cli
```

Black-box is agent-only (no prepare step).
