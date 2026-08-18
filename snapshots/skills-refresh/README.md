# Snapshot contract: `skills-refresh`

Product-repo snapshot for the weekly skills refresh line. **Agent prompts live in `agents/weekly-skills-refresh/prompt.md`** and bind via a knowledge slug in the job manifest — not baked into the VM.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/workspace/<repo>/` | Product git repos you bake in (not the skills repo) |

There is no harness under `/opt/` for this snapshot. On a build VM: clone or update product repos under `/workspace/`, then `islo snapshot save skills-refresh`.

The agent clones `$SKILLS_REPO` to `/workspace/skills` at runtime and handles checkout, edits, and publish.
