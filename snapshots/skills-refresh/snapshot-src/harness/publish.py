"""Publish skills repo changes via commit, PR, or report-only."""

from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def publish_skills() -> int:
    skills = Path("/workspace/skills")
    repo = os.environ.get("SKILLS_REPO", "").strip()
    publish_mode = os.environ.get("PUBLISH_MODE", "pr").strip()
    branch_prefix = os.environ.get("BRANCH_PREFIX", "factory/weekly-skills-refresh").strip()
    since = os.environ.get("SINCE", "7 days ago").strip()
    result_path = Path("/workspace/publish-result.txt")

    subprocess.run(["gh", "auth", "setup-git"], check=True)
    subprocess.run(
        ["git", "-C", str(skills), "config", "user.email", os.environ["GIT_COMMITTER_EMAIL"]],
        check=True,
    )
    subprocess.run(
        ["git", "-C", str(skills), "config", "user.name", os.environ["GIT_COMMITTER_NAME"]],
        check=True,
    )

    if (
        subprocess.run(["git", "-C", str(skills), "diff", "--cached", "--quiet"]).returncode == 0
        and subprocess.run(["git", "-C", str(skills), "diff", "--quiet"]).returncode == 0
    ):
        print("No changes to publish")
        result_path.write_text("NO_CHANGES\n")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
    branch = f"{branch_prefix}/{stamp}"
    subprocess.run(["git", "-C", str(skills), "checkout", "-b", branch], check=True)
    subprocess.run(
        ["git", "-C", str(skills), "add", "plugins/", "README.md"],
        check=False,
    )
    subprocess.run(["git", "-C", str(skills), "add", "-A"], check=False)
    subprocess.run(
        ["git", "-C", str(skills), "commit", "-m", "chore: weekly skills refresh from stack changes"],
        check=True,
    )

    if publish_mode == "commit":
        subprocess.run(["git", "-C", str(skills), "push", "origin", "HEAD:main"], check=True)
        head = subprocess.check_output(
            ["git", "-C", str(skills), "rev-parse", "HEAD"], text=True
        ).strip()
        url = f"https://github.com/{repo}/commit/{head}"
    elif publish_mode == "pr":
        subprocess.run(["git", "-C", str(skills), "push", "origin", branch], check=True)
        url = subprocess.check_output(
            [
                "gh",
                "pr",
                "create",
                "--repo",
                repo,
                "--title",
                f"Weekly skills refresh {datetime.now(timezone.utc):%Y-%m-%d}",
                "--body",
                f"Automated refresh from stack changes over {since}.",
                "--head",
                branch,
            ],
            text=True,
        ).strip()
    else:
        url = "report-only"

    result_path.write_text(url + "\n")
    print(url)
    return 0
