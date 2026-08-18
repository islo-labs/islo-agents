#!/usr/bin/env python3
"""Verify islo CLI authentication before black-box runs."""

from __future__ import annotations

import json
import sys


def main() -> int:
    try:
        with open("/tmp/islo-status.json", encoding="utf-8") as fh:
            payload = json.load(fh)
    except (OSError, json.JSONDecodeError):
        print("ERROR: islo status failed", file=sys.stderr)
        return 1

    auth = payload.get("auth") if isinstance(payload.get("auth"), dict) else payload
    if not auth.get("authenticated"):
        print(
            "ERROR: islo CLI is not authenticated — ISLO_API_KEY must use sandbox_env placement",
            file=sys.stderr,
        )
        return 1

    print(
        f"Authenticated ({auth.get('method', 'unknown')}, region={payload.get('region', '?')})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
