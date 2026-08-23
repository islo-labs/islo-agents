# Snapshot contract: `red-team-cli`

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/red-team-cli/harness/notify.py` | Post Slack summary |
| `/workspace/black-box/transcripts/` | Empty dir for black-box evidence |
| `/workspace/your-cli/` | Your CLI git checkout (white-box stages only) |
| `/workspace/prompts/` | Review briefs from this example's `prompts/` |

Copy `snapshot-src/harness/notify.py` to `/opt/red-team-cli/harness/`, create `/workspace/black-box/transcripts/`, copy `snapshot-src/workspace/prompts/` to `/workspace/prompts/`, clone your CLI repo to `/workspace/your-cli/`, then:

```bash
islo snapshot save <your-build-sandbox> --name red-team-cli
```

Black-box is agent-only (no prepare step).
