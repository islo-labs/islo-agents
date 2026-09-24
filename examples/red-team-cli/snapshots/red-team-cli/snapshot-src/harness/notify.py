"""Post a prebuilt Slack message. The line's slack-notify job inlines the same call.

Kept here so a snapshot bake can post `SLACK_NOTIFY_TEXT` without composing a summary.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request


def post_slack() -> int:
    channel = (os.environ.get("SLACK_NOTIFY_CHANNEL_ID") or "").strip()
    text = os.environ.get("SLACK_NOTIFY_TEXT") or ""
    token = (os.environ.get("SLACK_TOKEN") or os.environ.get("SLACK_BOT_TOKEN") or "").strip()
    if not token:
        print(
            "ERROR: SLACK_TOKEN not set (connect Slack via islo login --tool slack)",
            file=sys.stderr,
        )
        return 1
    if not channel:
        print("ERROR: SLACK_NOTIFY_CHANNEL_ID is required", file=sys.stderr)
        return 1
    if not text.strip():
        print("ERROR: SLACK_NOTIFY_TEXT is empty", file=sys.stderr)
        return 1

    payload = {"channel": channel, "text": text}
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.load(resp)
    if not body.get("ok"):
        print(json.dumps(body), file=sys.stderr)
        return 1
    print(f"Posted to {channel} (ts={body.get('ts')})")
    return 0


if __name__ == "__main__":
    raise SystemExit(post_slack())
