# Snapshot contract: `skills-refresh`

Bake a VM snapshot named `skills-refresh` with the weekly skills refresh harness plus your product repos.

## What this repo ships

| Path in snapshot | Contents |
|------------------|----------|
| `/opt/skills-refresh-harness/scripts/` | Checkout, change collection, publish helpers |
| `/opt/skills-refresh-harness/prompts/` | Agent brief for analyze-and-update |

## What you bake separately

| Path in snapshot | Contents |
|------------------|----------|
| `/workspace/<repo>/` | Git checkouts the job scans for weekly changes (each with a `.git` directory) |

## Building

```bash
# Clone your stack repos under /workspace/ on the build VM
./snapshots/skills-refresh/setup-snapshot.sh
islo snapshot save skills-refresh
```

Used by: `weekly-skills-refresh`.
