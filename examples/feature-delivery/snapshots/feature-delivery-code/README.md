# Snapshot contract: `feature-delivery-code`

Code sandbox for **implement** and **review** stages. Repos persist across iterations on the same Linear issue.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/workspace/<repo-name>/` | Git clones of every repository this line may modify |
| `/workspace/prompts/` | Stage briefs from this example's `prompts/` directory |

Copy `snapshot-src/workspace/prompts/` into `/workspace/prompts/`, clone each repo your team implements under `/workspace/`, configure `gh` auth, then:

```bash
islo snapshot save <your-build-sandbox> --name feature-delivery-code
```

The implement and review agents use `ensure` sandboxes named per issue so checkouts survive review loops.
