# Snapshot contract: `red-team-cli`

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/red-team-cli/harness/notify.py` | Post Slack summary |
| `/workspace/black-box/transcripts/` | Empty dir for black-box evidence |
| `/workspace/islo-cli/` | CLI checkout (white-box stages only) |

Copy `snapshot-src/harness/notify.py` to `/opt/red-team-cli/harness/`, create `/workspace/black-box/transcripts/`, bake `islo-cli` for white-box stages, then `islo snapshot save red-team-cli`.

**Agent prompts** live under `agents/<job>/prompt.md` and bind via `run_agent.prompt` knowledge slugs — not baked into the VM.

Black-box is agent-only (no prepare step).
