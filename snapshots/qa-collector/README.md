# Snapshot contract: `qa-collector`

Lightweight collector snapshot — Python scripts for dedupe and Linear filing.

## Layout (after bake)

| Path | Contents |
|------|----------|
| `/opt/qa-harness/agent/collect_and_post.py` | Read staged knowledge, dedupe, file Linear issues |
| `/opt/qa-harness/agent/infra_classify.py` | Shared classification helpers |
| `/opt/qa-harness/agent/slack_upload.py` | Optional Slack notifications |

Copy `snapshot-src/agent/` to `/opt/qa-harness/agent/` on a build VM, then `islo snapshot save qa-collector`.
