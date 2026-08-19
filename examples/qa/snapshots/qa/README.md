# Snapshot contract: `qa`

Black-box QA snapshot: `stage.py` plus a minimal Playwright workspace.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/qa-harness/harness/stage.py` | Validates findings and writes a knowledge handoff |
| `/workspace/qa-harness/` | Minimal Playwright project |

Source files live in `snapshot-src/`. On a build VM: copy `snapshot-src/harness/stage.py` to `/opt/qa-harness/harness/`, copy `snapshot-src/workspace/qa-harness/` to `/workspace/qa-harness/`, install Playwright deps, then:

```bash
islo snapshot save qa
```

Prompts live in `examples/qa/prompts/` and bind via knowledge slugs in `jobs/qa/job.toml`.
