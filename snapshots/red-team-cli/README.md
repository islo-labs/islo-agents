# Snapshot contract: `red-team-cli`

| Path | Contents |
|------|----------|
| `/opt/red-team-cli/harness/prepare.py` | Pull `islo-cli`, write upstream report JSON files |
| `/opt/red-team-cli/harness/notify.py` | Post Slack summary |
| `/opt/red-team-cli/prompts/` | Agent briefs |
| `/workspace/red-team-contract.md` | Baked from shared output contract |
| `/workspace/black-box/transcripts/` | Empty dir for black-box evidence |

White-box stages need `/workspace/islo-cli/` baked separately. Black-box is agent-only.

```bash
./snapshots/red-team-cli/setup-snapshot.sh
islo snapshot save red-team-cli
```
