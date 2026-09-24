# Snapshot contract: `skills-refresh`

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/workspace/<product-repo>/` | One or more product git checkouts the agent compares against |
| `gh` authenticated | For cloning and opening PRs on the skills repo |

Follow `snapshot-src/README.md` for setup steps, then:

```bash
islo snapshot save <your-build-sandbox> --name skills-refresh
```

The stage brief lives in the job `run_agent` prompt, not in this snapshot.
