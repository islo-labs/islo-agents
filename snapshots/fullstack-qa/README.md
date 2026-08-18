# Snapshot contract: `fullstack-qa`

Black-box QA snapshot: Playwright harness, agent prompts, and one staging script.

## What belongs in the snapshot

| Path | Contents |
|------|----------|
| `/opt/qa-harness/harness/stage.py` | Validates findings and writes a knowledge handoff |
| `/opt/qa-harness/prompts/full/` | Agent briefs |
| `/workspace/qa-harness/` | Playwright tests (`npm install` + `playwright install` at bake time) |

## What does **not** belong

- Cleanup or prepare scripts — provision-mode job sandboxes are deleted when the run completes (`teardown_on_complete` defaults to true).
- Snapshot self-check steps — a missing snapshot fails the job naturally.
- Harness embedded in `job.toml`.

Each fanout task is: `run_agent` → `stage.py`. The collector job reads staged knowledge.

## Building

```bash
./snapshots/fullstack-qa/setup-snapshot.sh
islo snapshot save fullstack-qa
```
