#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

API = "https://slack.com/api"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", required=True)
    parser.add_argument("--timestamp", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args()


def token() -> str:
    value = (os.environ.get("SLACK_TOKEN") or "").strip()
    if not value:
        raise RuntimeError("SLACK_TOKEN is not set")
    return value


def slack_call(method: str, params: dict[str, str]) -> dict[str, Any]:
    body = urllib.parse.urlencode(params).encode()
    request = urllib.request.Request(
        f"{API}/{method}",
        data=body,
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.load(response)
    if not payload.get("ok"):
        raise RuntimeError(f"{method} failed: {payload.get('error', 'unknown_error')}")
    return payload


def safe_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", name).strip("._")[:120] or "file"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, destination: Path) -> None:
    part = destination.with_suffix(destination.suffix + ".part")
    part.unlink(missing_ok=True)
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token()}"})
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            with part.open("wb") as file:
                while chunk := response.read(1024 * 1024):
                    file.write(chunk)
        part.replace(destination)
    except Exception:
        part.unlink(missing_ok=True)
        raise


def message(channel: str, timestamp: str) -> dict[str, Any]:
    payload = slack_call(
        "conversations.history",
        {
            "channel": channel,
            "latest": timestamp,
            "oldest": timestamp,
            "inclusive": "true",
            "limit": "1",
        },
    )
    messages = payload.get("messages") or []
    if not messages:
        raise RuntimeError("triggering Slack message was not found")
    return messages[0]


def reconcile(channel: str, timestamp: str, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    for part in output_dir.glob("*.part"):
        part.unlink()

    previous_entries: dict[str, dict[str, Any]] = {}
    previous_manifest = output_dir / "manifest.json"
    if previous_manifest.exists():
        parsed = json.loads(previous_manifest.read_text())
        previous_entries = {
            str(entry["id"]): entry
            for entry in parsed.get("files", [])
            if isinstance(entry, dict) and entry.get("id")
        }

    slack_message = message(channel, timestamp)
    entries: list[dict[str, Any]] = []
    expected_paths: set[Path] = set()

    for attached in sorted(slack_message.get("files") or [], key=lambda item: str(item.get("id"))):
        file_id = str(attached.get("id") or "")
        if not file_id:
            raise RuntimeError("Slack returned an attachment without an id")
        info = slack_call("files.info", {"file": file_id}).get("file") or {}
        url = info.get("url_private_download") or info.get("url_private")
        if not url:
            raise RuntimeError(f"Slack file {file_id} has no download URL")

        destination = output_dir / f"{file_id}-{safe_name(str(info.get('name') or file_id))}"
        expected_paths.add(destination)
        expected_size = info.get("size")
        previous = previous_entries.get(file_id, {})
        reusable = (
            destination.exists()
            and isinstance(expected_size, int)
            and destination.stat().st_size == expected_size
            and previous.get("path") == str(destination)
            and previous.get("sha256") == sha256(destination)
        )
        if not reusable:
            download(str(url), destination)

        entries.append(
            {
                "id": file_id,
                "name": info.get("name"),
                "mimetype": info.get("mimetype"),
                "path": str(destination),
                "sha256": sha256(destination),
                "size": destination.stat().st_size,
            }
        )

    for path in output_dir.iterdir():
        if (
            path.is_file()
            and path.name not in {"manifest.json", "message.txt"}
            and path not in expected_paths
        ):
            path.unlink()

    (output_dir / "message.txt").write_text(str(slack_message.get("text") or ""))
    manifest = {
        "channel": channel,
        "complete": True,
        "files": entries,
        "timestamp": timestamp,
    }
    temporary = output_dir / "manifest.json.tmp"
    temporary.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    temporary.replace(output_dir / "manifest.json")
    return manifest


def main() -> int:
    args = parse_args()
    manifest = reconcile(args.channel, args.timestamp, args.output_dir)
    print(f"saved {len(manifest['files'])} Slack attachment(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
