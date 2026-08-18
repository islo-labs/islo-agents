"""Cleanup helpers for red-team-cli."""

from __future__ import annotations

import json
import os
import subprocess
import sys


def cleanup_check() -> int:
    run_id = os.environ.get("RED_TEAM_RUN_ID", "")
    prefix = f"redteam-{run_id}-"
    proc = subprocess.run(["islo", "ls", "-o", "json"], capture_output=True, text=True)
    remaining = 0
    if proc.returncode == 0:
        try:
            sandboxes = json.loads(proc.stdout)
            if isinstance(sandboxes, list):
                remaining = sum(
                    1
                    for entry in sandboxes
                    if str(entry.get("name") or entry.get("sandbox_name") or "").startswith(
                        prefix
                    )
                )
        except json.JSONDecodeError:
            remaining = 0

    if remaining:
        print(
            f"WARNING: {remaining} sandbox(es) still match {prefix} — agent should have cleaned up",
            file=sys.stderr,
        )
    print(f"cleanup-check done (remaining={remaining})")
    return 0


def cleanup_run_resources() -> int:
    """Force-delete sandboxes left under redteam-{run_id}-*."""
    run_id = (os.environ.get("REDTEAM_RUN_ID") or os.environ.get("RED_TEAM_RUN_ID") or "").strip()
    if not run_id:
        print("REDTEAM_RUN_ID or RED_TEAM_RUN_ID is required", file=sys.stderr)
        return 1

    prefix = f"redteam-{run_id}-"
    proc = subprocess.run(["islo", "ls", "--all", "-o", "json"], capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stderr[-400:] if proc.stderr else "islo ls failed", file=sys.stderr)
        return 1

    try:
        sandboxes = json.loads(proc.stdout)
    except json.JSONDecodeError:
        print("islo ls returned invalid JSON", file=sys.stderr)
        return 1

    deleted = 0
    for entry in sandboxes if isinstance(sandboxes, list) else []:
        name = str(entry.get("name") or entry.get("sandbox_name") or "")
        if not name.startswith(prefix):
            continue
        rm = subprocess.run(["islo", "rm", name, "--force"], capture_output=True, text=True)
        print(f"rm {name}: rc={rm.returncode}")
        if rm.returncode == 0:
            deleted += 1

    remaining = sum(
        1
        for entry in sandboxes if isinstance(sandboxes, list)
        if str(entry.get("name") or entry.get("sandbox_name") or "").startswith(prefix)
    )
    print(f"deleted={deleted} remaining={remaining}")
    return 1 if remaining else 0
