# Snapshot contract: `skills-refresh`

Prompt-only snapshot for the weekly skills refresh line.

| Path | Contents |
|------|----------|
| `/opt/skills-refresh/prompts/analyze-and-update.md` | Full agent brief (checkout, diff, edit, publish) |
| `/workspace/<repo>/` | Product git repos you bake into the snapshot |

The agent clones `$SKILLS_REPO` to `/workspace/skills` at runtime. No harness scripts — git/gh work is agent-driven.

```bash
./snapshots/skills-refresh/setup-snapshot.sh
islo snapshot save skills-refresh
```
