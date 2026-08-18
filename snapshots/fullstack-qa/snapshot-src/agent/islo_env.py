#!/usr/bin/env python3
"""Load fullstack sandbox CLI credentials written by start.sh."""

from __future__ import annotations

import os

FULLSTACK_ENV = "/workspace/.fullstack-env"
CONTROL_PLANE_KEY_FILE = "/tmp/qa/control-plane-api-key"
CONTROL_PLANE_ISLO = "/tmp/qa/islo-control-plane"
QA_FRONTEND_URL = os.environ.get("ISLO_QA_FRONTEND_URL", "http://localhost:5173")


def control_plane_env() -> dict[str, str]:
    """Restore the gateway-backed credential captured before fullstack startup."""
    env = os.environ.copy()
    try:
        with open(CONTROL_PLANE_KEY_FILE, encoding="utf-8") as fh:
            api_key = fh.read().strip()
    except OSError:
        api_key = ""
    if api_key:
        env["ISLO_API_KEY"] = api_key
    return env


def activate_fullstack_env() -> None:
    """Source /workspace/.fullstack-env if present, then restore QA frontend URL."""
    if not os.path.isfile(FULLSTACK_ENV):
        return
    with open(FULLSTACK_ENV, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line.startswith("export "):
                continue
            key, _, value = line[7:].partition("=")
            key = key.strip()
            if not key:
                continue
            value = value.strip().strip('"').strip("'")
            if key == "ISLO_API_KEY":
                os.environ["ISLO_FULLSTACK_API_KEY"] = value
                continue
            os.environ[key] = value
    # fullstack-env points ISLO_BASE_URL at in-VM web-api; QA targets the frontend.
    os.environ["ISLO_BASE_URL"] = QA_FRONTEND_URL
