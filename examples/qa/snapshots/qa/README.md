# Snapshot contract: `qa`

Black-box QA snapshot: `stage.py` plus a minimal Playwright workspace.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/qa-harness/harness/stage.py` | Validates findings and writes a knowledge handoff |
| `/workspace/qa-harness/` | Minimal Playwright project |
| `/workspace/prompts/` | Agent briefs from this example's `prompts/` |

Source files live in `snapshot-src/`. On a build VM: copy `snapshot-src/harness/stage.py` to `/opt/qa-harness/harness/`, copy `snapshot-src/workspace/qa-harness/` to `/workspace/qa-harness/`, copy `snapshot-src/workspace/prompts/` to `/workspace/prompts/`, install Playwright deps, then:

```bash
islo snapshot save <your-build-sandbox> --name qa
```
