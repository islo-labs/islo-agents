"""Slack notification for red-team-cli line completion."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def post_slack() -> int:
    channel = (os.environ.get("SLACK_NOTIFY_CHANNEL_ID") or "").strip()
    summary = os.environ.get("SLACK_NOTIFY_SUMMARY") or ""
    status = (os.environ.get("SLACK_NOTIFY_LINE_STATUS") or "succeeded").strip()
    raw_urls = os.environ.get("SLACK_NOTIFY_LINEAR_ISSUE_URLS") or "[]"
    try:
        issues = json.loads(raw_urls)
    except json.JSONDecodeError:
        issues = []

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

    emoji = ":white_check_mark:" if status == "succeeded" else ":x:"
    lines = [f"{emoji} *red-team-cli* ({status})", "", summary.strip()]
    if issues:
        lines.extend(["", "*Linear issues filed:*", *(f"• {url}" for url in issues)])

    payload = {"channel": channel, "text": "\n".join(lines)}
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.load(resp)
    except urllib.error.HTTPError as exc:
        body = json.loads(exc.read().decode() or "{}")

    if not body.get("ok"):
        print(json.dumps(body), file=sys.stderr)
        return 1

    print(f"Posted to {channel} (ts={body.get('ts')})")
    return 0


if __name__ == "__main__":
    raise SystemExit(post_slack())
