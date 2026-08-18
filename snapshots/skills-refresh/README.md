# Snapshot contract: `skills-refresh`

| Path | Contents |
|------|----------|
| `/opt/skills-refresh-harness/harness/` | `checkout`, `collect`, `publish` |
| `/opt/skills-refresh-harness/prompts/` | Agent brief |
| `/workspace/<repo>/` | Product git repos you bake into the snapshot (not the skills repo — that is cloned at runtime) |

```bash
./snapshots/skills-refresh/setup-snapshot.sh
islo snapshot save skills-refresh
```
