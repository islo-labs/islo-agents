"""Collect stack repo changes into /workspace/changes.json."""

from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone


def collect_changes() -> int:
    since = os.environ.get("SINCE", "7 days ago").strip()
    since_iso = (
        subprocess.check_output(
            ["date", "-u", "-d", since, "+%Y-%m-%dT%H:%M:%SZ"],
            text=True,
        )
        .strip()
    )
    os.environ["SINCE_ISO"] = since_iso
    print(f"Collecting local stack changes since {since_iso}")

    from .collect_stack_changes import main as collect_main

    return collect_main()
