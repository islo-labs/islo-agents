#!/usr/bin/env python3
"""Keep the designer line's live surfaces limited to frontend and Storybook."""

import re
import subprocess
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
EXAMPLE = ROOT / "examples/designer-line"


def main() -> None:
    with (EXAMPLE / "line.toml").open("rb") as source:
        line = tomllib.load(source)
    with (EXAMPLE / "jobs/designer-design/job.toml").open("rb") as source:
        job = tomllib.load(source)

    assert [stage["id"] for stage in line["stages"]] == ["design"]
    assert [stage["job"] for stage in line["stages"]] == ["designer-design"]

    steps = job["run"]["tasks"][0]["steps"]
    commands = [" ".join(step["exec"]) for step in steps if "exec" in step]
    assert len(commands) == 1
    prep = commands[0]
    subprocess.run(["bash", "-n"], input=prep, text=True, check=True)
    surface_calls = re.findall(r"islo surface [^\n)]+", prep)
    assert surface_calls == [
        'islo surface web 3000 --label "Frontend"',
        'islo surface web 6006 --label "Storybook"',
    ], surface_calls
    assert prep.index("npm run start -- --host 0.0.0.0 --strictPort") < prep.index(
        surface_calls[0]
    )
    assert prep.index("\nSTORYBOOK_SHARE=1 /workspace/scripts/start-storybook.sh\n") < prep.index(
        surface_calls[0]
    )
    assert prep.index("http://127.0.0.1:3000/") < prep.index(surface_calls[0])
    assert prep.index("http://127.0.0.1:6006/index.json") < prep.index(
        surface_calls[0]
    )
    assert "frontend_url" in prep and "share.json" in prep
    assert prep.index(surface_calls[1]) < prep.rindex("share.json")

    agent = next(step["run_agent"] for step in steps if "run_agent" in step)
    assert "Do not open any additional Surface." in agent["prompt"]["value"]
    snapshot_contract = (EXAMPLE / "snapshots/designer/README.md").read_text()
    assert "It must not call `islo surface` or create public shares." in snapshot_contract


if __name__ == "__main__":
    main()
    print("validated designer frontend and Storybook surfaces")
