# Snapshot contract: `feature-delivery-code`

Code snapshot for the **implement** and **review** stages. Each stage restores its own sandbox, and that sandbox persists across repeated visits in one line run.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/workspace/<repo-name>/` | Git clones of every repository this line may modify |
| `/workspace/prompts/` | Gateway credential notes (`integrations.md`) |

Copy `snapshot-src/workspace/prompts/` into `/workspace/prompts/`, clone each repo your team implements under `/workspace/`, configure `gh` auth, then:

```bash
islo snapshot save <your-build-sandbox> --name feature-delivery-code
```

The implement and review agents use separate `ensure` sandbox slots suffixed by `{{line_run_id}}`, so each stage keeps its checkout across review loops without sharing it with another line run.
