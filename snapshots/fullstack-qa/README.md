# Snapshot contract: `fullstack-qa`

Black-box QA snapshot: `stage.py` plus a minimal Playwright workspace.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/qa-harness/harness/stage.py` | Validates findings and writes a knowledge handoff |
| `/workspace/qa-harness/` | Minimal Playwright project (`npm install` + `playwright install chromium`) |

Source files live in `snapshot-src/`. On a build VM: copy `snapshot-src/harness/stage.py` to `/opt/qa-harness/harness/`, copy `snapshot-src/workspace/qa-harness/` to `/workspace/qa-harness/`, install Playwright deps, then `islo snapshot save fullstack-qa`.

**Agent prompts** live under `agents/fullstack-qa/prompt-*.md` and bind via knowledge slugs in `agents/fullstack-qa/job.toml`.

Each fanout task is: `run_agent` → `stage.py`. The collector job reads staged knowledge.
