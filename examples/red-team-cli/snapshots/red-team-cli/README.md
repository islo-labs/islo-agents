# Snapshot contract: `red-team-cli`

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/red-team-cli/harness/notify.py` | Post Slack summary |
| `/workspace/black-box/transcripts/` | Empty dir for black-box evidence |
| `/workspace/islo-cli/` | Your CLI git checkout (white-box stages only) |

Copy `snapshot-src/harness/notify.py` to `/opt/red-team-cli/harness/`, create `/workspace/black-box/transcripts/`, clone your CLI repo to `/workspace/islo-cli/`, then:

```bash
islo snapshot save <your-build-sandbox> --name red-team-cli
```

**Agent prompts** are published as knowledge items from `prompts/` — not baked into the VM.

Black-box is agent-only (no prepare step).
