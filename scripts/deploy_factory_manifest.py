#!/usr/bin/env python3
"""Deploy one Factory manager or line manifest through the control-plane API."""

from __future__ import annotations

import json
import os
import sys
import tomllib
import urllib.error
import urllib.request
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] not in {"manager", "line"}:
        raise SystemExit(
            "usage: deploy_factory_manifest.py <manager|line> <manifest.toml>"
        )

    kind = sys.argv[1]
    path = Path(sys.argv[2])
    with path.open("rb") as manifest_file:
        manifest = tomllib.load(manifest_file)

    section = manifest.get(kind)
    name = section.get("name") if isinstance(section, dict) else None
    if not isinstance(name, str) or not name:
        raise SystemExit(f"{path} must define [{kind}].name")

    token = os.environ.get("ISLO_API_KEY")
    if not token:
        raise SystemExit("ISLO_API_KEY is required")

    collection = "managers" if kind == "manager" else "lines"
    api_url = os.environ.get("ISLO_API_URL", "https://api.islo.dev").rstrip("/")
    request = urllib.request.Request(
        f"{api_url}/factory/{collection}/{name}/deploy",
        data=json.dumps({"manifest": manifest}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            print(response.read().decode())
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        raise SystemExit(
            f"failed to deploy {kind} {name}: HTTP {error.code}: {detail}"
        ) from error


if __name__ == "__main__":
    main()
