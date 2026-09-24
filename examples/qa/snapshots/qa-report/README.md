# Snapshot contract: `qa-report`

Collector snapshot for deduplicating and publishing QA findings.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/qa-harness/agent/collect_and_post.py` | Read upstream JSON (or `qa-findings` knowledge), dedupe, write `slack_text` |
| `/opt/qa-harness/agent/infra_classify.py` | Classification helpers |
| `/opt/qa-harness/agent/slack_upload.py` | Unused by this line. `qa-slack-notify` posts `slack_text`. |

Copy `snapshot-src/agent/` to `/opt/qa-harness/agent/` on a build VM, then:

```bash
islo snapshot save <your-build-sandbox> --name qa-report
```
