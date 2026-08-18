# Snapshot contract: `islo-stack`

Bake a VM snapshot named `islo-stack` with product git checkouts under `/workspace/` plus harness scripts from this directory.

## What this repo ships

| Path in snapshot | Contents |
|------------------|----------|
| `/opt/red-team-harness/scripts/` | Red-team prepare, auth check, cleanup, Slack notify helpers |
| `/opt/red-team-harness/prompts/` | Red-team agent briefs and shared output contract |
| `/opt/skills-refresh-harness/scripts/` | Weekly skills refresh checkout, change collection, publish |
| `/opt/skills-refresh-harness/prompts/` | Skills refresh agent brief |

## What you bake separately

| Path in snapshot | Contents |
|------------------|----------|
| `/workspace/islo-cli/` | Git checkout of the CLI under test (white-box stages) |
| `/workspace/<other-repos>/` | Additional stack repos for `weekly-skills-refresh` |

## Building

```bash
# On a runner VM with your stack repos cloned under /workspace/
./snapshots/islo-stack/setup-snapshot.sh
islo snapshot save islo-stack
```

Used by: `red-team-cli-*` jobs and `weekly-skills-refresh`.
