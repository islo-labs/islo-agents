"""Collect product repo changes since SINCE into /workspace/changes.json."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


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
    print(f"Collecting product repo changes since {since_iso}")
    return collect_repo_changes(since_iso)


def collect_repo_changes(since: str | None = None) -> int:
    since = since or os.environ["SINCE_ISO"]
    repos: list[dict] = []
    seen: set[str] = set()

    def add_repo(root: Path) -> None:
        if root.name == "skills" or str(root) in seen:
            return
        seen.add(str(root))
        name = root.name
        try:
            subprocess.run(
                ["git", "-C", str(root), "fetch", "--quiet", "origin"],
                check=False,
            )
            remote = subprocess.check_output(
                ["git", "-C", str(root), "remote", "show", "origin"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            head = "main"
            for line in remote.splitlines():
                if "HEAD branch:" in line:
                    head = line.split()[-1]
                    break
            ref = f"origin/{head}"
            if (
                subprocess.run(
                    ["git", "-C", str(root), "rev-parse", "--verify", ref],
                    capture_output=True,
                ).returncode
                != 0
            ):
                ref = head
            log = subprocess.check_output(
                [
                    "git",
                    "-C",
                    str(root),
                    "log",
                    f"--since={since}",
                    ref,
                    "--pretty=format:%h\t%s\t%an\t%aI",
                    "-n",
                    "100",
                ],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
            if not log:
                return
            commits = []
            for line in log.splitlines():
                parts = line.split("\t", 3)
                if len(parts) != 4:
                    continue
                sha, msg, author, date = parts
                commits.append(
                    {"sha": sha, "message": msg, "author": author, "date": date}
                )
            files = subprocess.check_output(
                [
                    "git",
                    "-C",
                    str(root),
                    "log",
                    f"--since={since}",
                    ref,
                    "--name-only",
                    "--pretty=format:",
                ],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            touched = sorted({f.strip() for f in files.splitlines() if f.strip()})[:200]
            repos.append(
                {"repo": name, "path": str(root), "commits": commits, "files": touched}
            )
        except Exception:
            return

    for pattern in ("*/.git", "*/*/.git"):
        for gitdir in sorted(Path("/workspace").glob(pattern)):
            if gitdir.is_dir():
                add_repo(gitdir.parent)

    Path("/workspace/changes.json").write_text(
        json.dumps({"since": since, "repos": repos}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Collected {len(repos)} repos into /workspace/changes.json")
    return 0
