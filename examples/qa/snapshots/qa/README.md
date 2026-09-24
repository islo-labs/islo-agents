# Snapshot contract: `qa`

Black-box QA snapshot: `stage.py` plus a minimal Playwright workspace.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/qa-harness/harness/stage.py` | Validates findings, writes `/workspace/reports/<agent>.json`, and a `qa-findings` knowledge handoff |
| `/opt/qa-harness/harness/emit_report.py` | Publishes that JSON file as the task's job output |
| `/workspace/qa-harness/` | Minimal Playwright project |
| `/workspace/prompts/` | Fan-out agent briefs (`web-core.md`, `web-platform.md`, `cli-cross.md`) |

Source files live in `snapshot-src/`. On a build VM: copy `snapshot-src/harness/stage.py` and `snapshot-src/harness/emit_report.py` to `/opt/qa-harness/harness/`, copy `snapshot-src/workspace/qa-harness/` to `/workspace/qa-harness/`, copy `snapshot-src/workspace/prompts/` to `/workspace/prompts/`, install Playwright deps, then:

```bash
islo snapshot save <your-build-sandbox> --name qa
```
