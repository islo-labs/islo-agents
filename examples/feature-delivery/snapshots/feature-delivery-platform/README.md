# Snapshot contract: `feature-delivery-platform`

Full-stack sandbox for the **verify** stage. Should include your app stack, browser tooling, and a boot script.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/workspace/` | Product repos or monorepo checkout |
| `/workspace/prompts/` | Verify brief from this example's `prompts/` |
| `/workspace/scripts/boot-stack.sh` | Boots integrated stack with PR branch pins |
| `/workspace/.platform-env` | Written by boot script, holds URLs and credentials |

Copy `snapshot-src/workspace/prompts/` into `/workspace/prompts/`, bake service dependencies, then:

```bash
islo snapshot save <your-build-sandbox> --name feature-delivery-platform
```
