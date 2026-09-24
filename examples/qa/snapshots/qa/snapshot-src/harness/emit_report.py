#!/usr/bin/env python3
"""Publish one agent's staged report as a job output string."""

from __future__ import annotations

import json
import os
import sys


def main() -> int:
    agent = (os.environ.get("QA_AGENT_ID") or "qa-agent").strip()
    key = (os.environ.get("QA_OUTPUT_KEY") or "").strip()
    out_path = (os.environ.get("ISLO_OUTPUT") or "").strip()
    if not key:
        print("QA_OUTPUT_KEY unset", file=sys.stderr)
        return 1
    if not out_path or out_path == "/dev/null":
        print("ISLO_OUTPUT unset", file=sys.stderr)
        return 1

    path = f"/workspace/reports/{agent}.json"
    payload = None
    if os.path.isfile(path) and os.path.getsize(path) > 2:
        try:
            payload = json.dumps(json.load(open(path, encoding="utf-8")), separators=(",", ":"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"could not parse {path}: {exc}", file=sys.stderr)
    if payload is None:
        payload = json.dumps(
            {
                "agent": agent,
                "target": os.environ.get("QA_BASE_URL") or os.environ.get("ISLO_BASE_URL") or "",
                "run_ok": False,
                "findings": [],
                "summary": "agent did not write a report",
            },
            separators=(",", ":"),
        )

    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(key + "=" + payload + "\n")
    print(f"emitted {key} bytes={len(payload)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
