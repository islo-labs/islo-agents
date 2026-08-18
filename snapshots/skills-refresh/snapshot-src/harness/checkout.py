"""Clone or update the target skills repository."""

from __future__ import annotations

import subprocess
from pathlib import Path


def checkout_skills() -> int:
    workspace = Path("/workspace")
    workspace.mkdir(parents=True, exist_ok=True)
    skills = workspace / "skills"
    repo = _env("SKILLS_REPO")
    if not repo:
        print("SKILLS_REPO is required", flush=True)
        return 1

    if not (skills / ".git").is_dir():
        if skills.exists():
            subprocess.run(["rm", "-rf", str(skills)], check=True)
        subprocess.run(["gh", "repo", "clone", repo, str(skills)], check=True)
        return 0

    for branch in ("main", "master"):
        if subprocess.run(
            ["git", "-C", str(skills), "checkout", branch],
            capture_output=True,
        ).returncode == 0:
            break
    subprocess.run(["git", "-C", str(skills), "pull", "--ff-only"], check=True)
    return 0


def _env(name: str) -> str:
    import os

    return os.environ.get(name, "").strip()
