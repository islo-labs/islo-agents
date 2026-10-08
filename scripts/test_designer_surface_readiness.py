#!/usr/bin/env python3
"""Exercise designer prep against controlled frontend and Storybook responses."""

import json
import os
import subprocess
import tempfile
import tomllib
from pathlib import Path


JOB = Path(__file__).resolve().parent.parent / "examples/designer-line/jobs/designer-design/job.toml"


def executable(path: Path, body: str) -> None:
    path.write_text("#!/bin/sh\n" + body)
    path.chmod(0o755)


def run_prep(frontend: str, storybook: str) -> tuple[list[str], dict, str]:
    with JOB.open("rb") as source:
        job = tomllib.load(source)
    prep = job["run"]["tasks"][0]["steps"][0]["exec"][-1]

    with tempfile.TemporaryDirectory() as temporary_dir:
        root = Path(temporary_dir)
        design = root / "design"
        app = root / "app"
        bin_dir = root / "bin"
        app.mkdir()
        bin_dir.mkdir()
        prep = (
            prep.replace("/workspace/design", str(design))
            .replace("/workspace/app", str(app))
            .replace("/workspace/scripts/start-storybook.sh", str(root / "start-storybook.sh"))
        )
        executable(root / "start-storybook.sh", "exit 0\n")
        executable(bin_dir / "hostname", "printf '127.0.0.1\\n'\n")
        executable(bin_dir / "sleep", "/bin/sleep 0.01\n")
        executable(bin_dir / "npm", 'touch "$FRONTEND_STATE"\n')
        executable(
            bin_dir / "curl",
            '''case "$*" in
  *:3000/*)
    if [ "$FRONTEND_CASE" = start ] && [ ! -f "$FRONTEND_STATE" ]; then exit 7; fi
    case "$*" in
      *"Host: designer-probe.share.islo.dev"*)
        if [ "$FRONTEND_CASE" = blocked ]; then exit 22; fi
        if [ "$FRONTEND_CASE" = wrong ]; then printf '<title>other</title>'; exit 0; fi
        ;;
    esac
    printf '<title>islo</title><div id="root"></div>'
    ;;
  *:6006/index.json)
    if [ "$STORYBOOK_CASE" = wrong ]; then printf '{"ready":true}';
    else printf '{"v":5,"entries":{"story":{}}}'; fi
    ;;
  *) exit 7 ;;
esac
''',
        )
        executable(
            bin_dir / "islo",
            '''printf '%s\\n' "$*" >> "$SURFACE_LOG"
if [ "$3" = 3000 ]; then printf 'https://front.share.islo.dev\\n';
else printf 'https://story.share.islo.dev\\n'; fi
''',
        )
        env = {
            **os.environ,
            "PATH": f"{bin_dir}:{os.environ['PATH']}",
            "FRONTEND_CASE": frontend,
            "STORYBOOK_CASE": storybook,
            "FRONTEND_STATE": str(root / "frontend-started"),
            "SURFACE_LOG": str(root / "surface.log"),
        }
        result = subprocess.run(["bash", "-c", prep], env=env, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        calls = (root / "surface.log").read_text().splitlines() if (root / "surface.log").exists() else []
        share = json.loads((design / "share.json").read_text())
        return calls, share, (design / "PREP.md").read_text()


def main() -> None:
    expected = ['surface web 3000 --label Frontend', 'surface web 6006 --label Storybook']
    for frontend in ("valid", "start"):
        calls, share, _ = run_prep(frontend, "valid")
        assert calls == expected, (frontend, calls)
        assert share["frontend_url"] == "https://front.share.islo.dev"
        assert share["url"] == "https://story.share.islo.dev"
    for frontend, storybook in (("wrong", "valid"), ("blocked", "valid"), ("valid", "wrong")):
        calls, share, prep = run_prep(frontend, storybook)
        assert calls == [], (frontend, storybook, calls)
        assert share["frontend_url"] == share["url"] == ""
        assert "no Surface was opened" in prep


if __name__ == "__main__":
    main()
    print("validated designer readiness and share-host rejection")
