# Snapshot contract: `qa-report`

Collector snapshot for deduplicating and publishing QA findings.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/qa-harness/agent/collect_and_post.py` | Read staged knowledge, dedupe, publish results |
| `/opt/qa-harness/agent/infra_classify.py` | Classification helpers |
| `/opt/qa-harness/agent/slack_upload.py` | Optional Slack notifications |

Copy `snapshot-src/agent/` to `/opt/qa-harness/agent/` on a build VM, then:

```bash
islo snapshot save qa-report
```
