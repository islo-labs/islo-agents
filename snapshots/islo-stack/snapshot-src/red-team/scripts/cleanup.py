#!/usr/bin/env python3
"""Force-delete red-team prod sandboxes left under redteam-{run_id}-*."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

SAFE_PREFIX = re.compile(r"^redteam-[a-zA-Z0-9][a-zA-Z0-9_-]*$")


def log(msg: str) -> None:
    print(f"[red-team-cleanup] {msg}", flush=True)


def main() -> int:
    run_id = (os.environ.get("REDTEAM_RUN_ID") or "").strip()
    if not run_id:
        raise RuntimeError("REDTEAM_RUN_ID is required for red-team cleanup")

    prefix = f"redteam-{run_id}-"
    proc = subprocess.run(
        ["islo", "ls", "--all", "-o", "json"], capture_output=True, text=True
    )
    if proc.returncode != 0:
        log(proc.stderr[-400:] if proc.stderr else "islo ls failed")
        return 1

    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        log("islo ls returned invalid JSON")
        return 1

    sandboxes = payload if isinstance(payload, list) else []
    deleted = 0
    for entry in sandboxes:
        name = str(entry.get("name") or entry.get("sandbox_name") or "")
        if not name.startswith(prefix) or not SAFE_PREFIX.match(name):
            continue
        rm = subprocess.run(["islo", "rm", name, "--force"], capture_output=True, text=True)
        log(f"rm {name}: rc={rm.returncode}")
        if rm.returncode == 0:
            deleted += 1

    remaining = sum(
        1
        for entry in sandboxes
        if str(entry.get("name") or entry.get("sandbox_name") or "").startswith(prefix)
    )
    log(f"deleted={deleted} remaining={remaining}")
    return 1 if remaining else 0


if __name__ == "__main__":
    raise SystemExit(main())
