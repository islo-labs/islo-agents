# Snapshot contract: `qa-collector`

Lightweight collector snapshot — one Python script plus small helpers.

| Path | Contents |
|------|----------|
| `/opt/qa-harness/agent/collect_and_post.py` | Read staged knowledge, dedupe, file Linear issues |
| `/opt/qa-harness/agent/infra_classify.py` | Shared classification helpers |
| `/opt/qa-harness/agent/slack_upload.py` | Optional Slack notifications |

```bash
./snapshots/qa-collector/setup-snapshot.sh
islo snapshot save qa-collector
```
