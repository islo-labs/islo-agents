# Snapshot contract: `red-team-cli`

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/red-team-cli/harness/notify.py` | Post Slack summary |
| `/workspace/black-box/transcripts/` | Empty dir for black-box evidence |
| `/workspace/islo-cli/` | CLI checkout (white-box stages only) |

Copy `snapshot-src/harness/notify.py` to `/opt/red-team-cli/harness/`, create `/workspace/black-box/transcripts/`, bake `islo-cli` for white-box stages, then `islo snapshot save red-team-cli`.

**Agent prompts** live under `agents/red-team-cli-*/prompt.md` and are embedded in each job's `run_agent` step. Prep work (git pull `islo-cli`, writing path/commit files, upstream JSON for report) is described in those prompts — not a separate harness script.

Black-box is agent-only (no prepare step).
