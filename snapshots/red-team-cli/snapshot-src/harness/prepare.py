"""Prepare steps for red-team-cli Factory jobs."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

WORKSPACE = Path("/workspace")


def prepare_cli() -> int:
    cli_dir = _find_islo_cli()
    if cli_dir is None:
        print(
            "ERROR: islo-cli not found — bake /workspace/islo-cli/ into the red-team-cli snapshot",
            file=sys.stderr,
        )
        return 1

    subprocess.run(["git", "-C", str(cli_dir), "fetch", "--quiet", "origin"], check=False)
    branch = _default_branch(cli_dir)
    for candidate in (branch, "main", "master"):
        if subprocess.run(
            ["git", "-C", str(cli_dir), "checkout", "-q", candidate],
            capture_output=True,
        ).returncode == 0:
            branch = candidate
            break
    subprocess.run(
        ["git", "-C", str(cli_dir), "pull", "--ff-only", "origin", branch],
        check=False,
    )
    (WORKSPACE / "islo-cli-path.txt").write_text(str(cli_dir))
    commit = subprocess.check_output(
        ["git", "-C", str(cli_dir), "rev-parse", "HEAD"], text=True
    ).strip()
    (WORKSPACE / "islo-cli-commit.txt").write_text(commit + "\n")
    print(f"Prepared islo-cli at {cli_dir} ({commit})")
    return 0


def prepare_report() -> int:
    rc = prepare_cli()
    if rc != 0:
        return rc
    upstream = WORKSPACE / "upstream"
    upstream.mkdir(parents=True, exist_ok=True)
    for name, env_key in (
        ("trust-boundaries.json", "TRUST_BOUNDARIES_REPORT_JSON"),
        ("input-abuse.json", "INPUT_ABUSE_REPORT_JSON"),
        ("black-box.json", "BLACK_BOX_REPORT_JSON"),
    ):
        (upstream / name).write_text(os.environ.get(env_key, ""))
    mode = os.environ.get("LINEAR_MODE", "report")
    print(f"Prepared islo-cli with upstream reports (linear_mode={mode})")
    return 0


def _find_islo_cli() -> Path | None:
    for gitdir in sorted(WORKSPACE.glob("**/.git")):
        if len(gitdir.parts) - len(WORKSPACE.parts) > 5:
            continue
        root = gitdir.parent
        if root.name == "islo-cli":
            return root
    return None


def _default_branch(repo: Path) -> str:
    proc = subprocess.run(
        ["git", "-C", str(repo), "remote", "show", "origin"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return "main"
    for line in proc.stdout.splitlines():
        if "HEAD branch:" in line:
            return line.split()[-1]
    return "main"
