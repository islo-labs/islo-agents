# Snapshot contract: `feature-delivery-code`

Code sandbox for **implement** and **review** stages. Repos persist across iterations on the same Linear issue.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/workspace/<repo-name>/` | Git clones of every repository this line may modify |

Clone each repo your team implements in under `/workspace/`, configure `gh` auth, then:

```bash
islo snapshot save <your-build-sandbox> --name feature-delivery-code
```

The implement and review agents use `ensure` sandboxes named per issue so checkouts survive review loops.

Prompts are not baked into the VM. Each job clones them from your own repository into `/workspace/.islo-prompts/` at run time, which is a separate directory from the working clones above so the prompt refresh can never touch a feature branch.
