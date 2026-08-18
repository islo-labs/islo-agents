# Snapshot contract: `red-team-cli`

| Path | Contents |
|------|----------|
| `/opt/red-team-harness/harness/` | `prepare-cli`, `prepare-report`, `notify-slack` only |
| `/opt/red-team-harness/prompts/` | Agent briefs |
| `/workspace/red-team-contract.md` | Baked from shared output contract |
| `/workspace/black-box/transcripts/` | Empty dir for black-box evidence |

White-box stages need `/workspace/islo-cli/` baked separately. Black-box needs only the harness — no prepare/cleanup steps; the job sandbox is ephemeral.

```bash
./snapshots/red-team-cli/setup-snapshot.sh
islo snapshot save red-team-cli
```
