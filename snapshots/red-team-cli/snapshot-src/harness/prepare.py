"""Prepare steps for red-team-cli Factory jobs."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

PROMPTS = Path("/opt/red-team-harness/prompts")
WORKSPACE = Path("/workspace")


def install_contract() -> None:
    dest = WORKSPACE / "red-team-contract.md"
    dest.write_text((PROMPTS / "shared-output-contract.md").read_text(encoding="utf-8"))


def prepare_cli() -> int:
    install_contract()
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


def prepare_black_box() -> int:
    install_contract()
    (WORKSPACE / "black-box" / "transcripts").mkdir(parents=True, exist_ok=True)
    run_id = os.environ.get("RED_TEAM_RUN_ID", "")
    target = os.environ.get("ISLO_BASE_URL", "https://app.islo.dev")
    (WORKSPACE / "black-box-run.txt").write_text(
        f"run_id={run_id}\nprefix=redteam-{run_id}-\ntarget={target}\n"
    )
    if not os.environ.get("ISLO_API_KEY", "").strip():
        print(
            "ERROR: ISLO_API_KEY missing — add it as a sandbox secret in your Factory environment",
            file=sys.stderr,
        )
        return 1

    proc = subprocess.run(
        ["islo", "status", "-o", "json"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print("ERROR: islo status failed", file=sys.stderr)
        return 1
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        print("ERROR: islo status returned invalid JSON", file=sys.stderr)
        return 1

    auth = payload.get("auth") if isinstance(payload.get("auth"), dict) else payload
    if not auth.get("authenticated"):
        print("ERROR: islo CLI is not authenticated", file=sys.stderr)
        return 1

    print(
        f"Authenticated ({auth.get('method', 'unknown')}, region={payload.get('region', '?')})"
    )
    print(f"Black-box prep ok (prefix=redteam-{run_id}-)")
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
