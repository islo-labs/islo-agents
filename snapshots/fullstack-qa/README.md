# Snapshot contract: `fullstack-qa`

Black-box QA snapshot: Playwright harness and one staging script.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/qa-harness/harness/stage.py` | Validates findings and writes a knowledge handoff |
| `/workspace/qa-harness/` | Playwright tests (`npm install` + `playwright install chromium`) |

Source files live in `snapshot-src/`. On a build VM: copy `snapshot-src/harness/stage.py` to `/opt/qa-harness/harness/`, copy `snapshot-src/workspace/islo-qa/` to `/workspace/qa-harness/`, install Playwright deps, then `islo snapshot save fullstack-qa`.

**Agent prompts** live under `agents/fullstack-qa/prompt-*.md` and are embedded in `agents/fullstack-qa/job.toml`.

Each fanout task is: `run_agent` → `stage.py`. The collector job reads staged knowledge.
