# Snapshot contract: `red-team-cli`

Bake a VM snapshot named `red-team-cli` with the red-team harness from this directory.

## What this repo ships

| Path in snapshot | Contents |
|------------------|----------|
| `/opt/red-team-harness/scripts/` | Prepare, auth check, cleanup, Slack notify helpers |
| `/opt/red-team-harness/prompts/` | Agent briefs and shared output contract |

## What you bake separately (white-box stages only)

| Path in snapshot | Contents |
|------------------|----------|
| `/workspace/islo-cli/` | Git checkout of the CLI under test |

Black-box and Slack notify stages need only the harness — no source checkout.

## Building

```bash
# Optional for white-box: clone islo-cli under /workspace/ on the build VM
./snapshots/red-team-cli/setup-snapshot.sh
islo snapshot save red-team-cli
```

Used by: all `red-team-cli-*` jobs.
