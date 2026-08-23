#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://slack.com/api"
RETRY_DELAYS = (1, 2, 4, 8)
RETRYABLE_ERRORS = {
    "fatal_error",
    "internal_error",
    "rate_limited",
    "request_timeout",
    "service_unavailable",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", required=True)
    parser.add_argument("--timestamp", required=True)
    parser.add_argument("--emoji", required=True)
    return parser.parse_args()


def token() -> str:
    value = (os.environ.get("SLACK_TOKEN") or "").strip()
    if not value:
        raise RuntimeError("SLACK_TOKEN is not set")
    return value


def request_reaction(channel: str, timestamp: str, emoji: str) -> tuple[dict, int | None]:
    body = urllib.parse.urlencode(
        {"channel": channel, "timestamp": timestamp, "name": emoji}
    ).encode()
    request = urllib.request.Request(
        f"{API}/reactions.add",
        data=body,
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response), None
    except urllib.error.HTTPError as error:
        retry_after = error.headers.get("Retry-After")
        if error.code == 429 and retry_after:
            return {"ok": False, "error": "rate_limited"}, int(retry_after)
        if 500 <= error.code < 600:
            return {"ok": False, "error": "service_unavailable"}, None
        raise


def add_reaction(channel: str, timestamp: str, emoji: str) -> None:
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            payload, retry_after = request_reaction(channel, timestamp, emoji)
        except (socket.timeout, TimeoutError, urllib.error.URLError):
            payload, retry_after = {"ok": False, "error": "request_timeout"}, None

        if payload.get("ok") or payload.get("error") == "already_reacted":
            return

        error = str(payload.get("error") or "unknown_error")
        if error not in RETRYABLE_ERRORS or attempt == len(RETRY_DELAYS):
            raise RuntimeError(f"reactions.add failed: {error}")
        delay = retry_after if retry_after is not None else RETRY_DELAYS[attempt]
        time.sleep(delay)


def main() -> int:
    args = parse_args()
    add_reaction(args.channel, args.timestamp, args.emoji)
    print(f"reacted :{args.emoji}: on {args.channel} ts={args.timestamp}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
