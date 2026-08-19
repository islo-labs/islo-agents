#!/usr/bin/env python3
"""Validate customer example packages under examples/."""

from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore[no-redef]

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES = ROOT / "examples"

FORBIDDEN_PATTERNS = [
    re.compile(r"app\.islo\.dev"),
    re.compile(r"5e83752c-0783-4f1e-adbe-3b17e007518a"),
    re.compile(r"02cad9f0-86c4-4cb5-8cbc-24265895608c"),
    re.compile(r"ship-like/"),
    re.compile(r"agents_git_ref"),
    re.compile(r"assemble-webhooks"),
    re.compile(r"src/agent\.ts"),
    re.compile(r"fullstack-qa"),
    re.compile(r"qa-collector"),
]

ALLOWED_PLACEHOLDER_MARKERS = [
    "REPLACE_WITH_OWNER",
    "REPLACE_WITH_REPOSITORY",
    "REPLACE_WITH_YOUR_SLACK_CHANNEL_ID",
    "REPLACE_WITH_YOUR_LINEAR_TEAM_NAME",
    "REPLACE_WITH_YOUR_LINEAR_LABEL_NAME",
    "your-org/",
]

PUBLIC_RUNNER_IMAGES = {
    "ghcr.io/islo-labs/islo-runner:latest",
    "docker.io/library/islo-runner:latest",
}


def load_toml(path: Path) -> dict:
    with path.open("rb") as f:
        return tomllib.load(f)


def fail(msg: str) -> None:
    errors.append(msg)


errors: list[str] = []


def check_forbidden_text(path: Path, text: str) -> None:
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(text):
            fail(f"{path}: forbidden pattern {pattern.pattern}")


def validate_job(path: Path, example_dir: Path) -> str | None:
    text = path.read_text()
    check_forbidden_text(path, text)
    doc = load_toml(path)
    job = doc.get("job", {})
    name = job.get("name")
    if not name:
        fail(f"{path}: missing [job].name")
        return None
    if name != path.parent.name:
        fail(f"{path}: [job].name {name!r} must match directory {path.parent.name!r}")

    params = doc.get("job", {}).get("params", {})
    if isinstance(params, dict):
        for param_name, param_block in params.items():
            if isinstance(param_block, dict) and "type" not in param_block:
                fail(f"{path}: job.params.{param_name} missing type")

    outputs = doc.get("outputs", {})
    if isinstance(outputs, dict):
        for out_name, out_block in outputs.items():
            if isinstance(out_block, dict) and "type" not in out_block:
                fail(f"{path}: outputs.{out_name} missing type")

    sandbox = doc.get("run", {}).get("sandbox", {})
    image = sandbox.get("image")
    if image and image not in PUBLIC_RUNNER_IMAGES:
        fail(f"{path}: image must be a public runner image, got {image!r}")

    snapshot = sandbox.get("snapshot_name")
    if snapshot:
        snap_readme = example_dir / "snapshots" / snapshot / "README.md"
        if not snap_readme.is_file():
            fail(f"{path}: snapshot {snapshot!r} missing {snap_readme}")

    if "npx tsx" in text or "git clone https://github.com/islo-labs/islo-agents" in text:
        fail(f"{path}: must not clone this pack at runtime")

    return name


def collect_job_names(example_dir: Path) -> set[str]:
    names: set[str] = set()
    jobs_root = example_dir / "jobs"
    if not jobs_root.is_dir():
        return names
    for job_dir in jobs_root.iterdir():
        job_toml = job_dir / "job.toml"
        if job_toml.is_file():
            name = validate_job(job_toml, example_dir)
            if name:
                names.add(name)
    return names


def validate_line(path: Path, job_names: set[str]) -> None:
    text = path.read_text()
    check_forbidden_text(path, text)
    doc = load_toml(path)
    line_name = doc.get("line", {}).get("name")
    if not line_name:
        fail(f"{path}: missing [line].name")
    if line_name != path.parent.name:
        fail(f"{path}: [line].name {line_name!r} must match directory {path.parent.name!r}")

    stages = doc.get("stages", [])
    if not stages:
        fail(f"{path}: no [[stages]]")
    for stage in stages:
        job = stage.get("job")
        if job not in job_names:
            fail(f"{path}: stage {stage.get('id')!r} references missing job {job!r}")

    trigger = doc.get("trigger", {})
    if trigger.get("type") == "integration_trigger":
        if not trigger.get("outputs"):
            fail(f"{path}: integration trigger must declare [trigger.outputs]")

    transitions = doc.get("transitions", [])
    if not transitions:
        fail(f"{path}: no [[transitions]]")
    has_trigger_entry = any(t.get("from") == "trigger" for t in transitions)
    if not has_trigger_entry:
        fail(f"{path}: missing entry transition from trigger")


def validate_prompt_bindings(example_dir: Path) -> None:
    prompts_dir = example_dir / "prompts"
    if not prompts_dir.is_dir():
        return
    for job_dir in (example_dir / "jobs").iterdir():
        job_toml = job_dir / "job.toml"
        if not job_toml.is_file():
            continue
        text = job_toml.read_text()
        for slug_match in re.finditer(r'slug = "([^"]+)"', text):
            slug = slug_match.group(1)
            readme = example_dir / "README.md"
            if readme.is_file() and slug not in readme.read_text():
                fail(f"{example_dir}: knowledge slug {slug!r} not documented in README.md")


def main() -> int:
    if not EXAMPLES.is_dir():
        fail("examples/ directory missing")
        return 1

    example_dirs = sorted([p for p in EXAMPLES.iterdir() if p.is_dir()])
    if not example_dirs:
        fail("no examples found under examples/")
        return 1

    for example_dir in example_dirs:
        readme = example_dir / "README.md"
        line_toml = example_dir / "line.toml"
        if not readme.is_file():
            fail(f"{example_dir}: missing README.md")
        if not line_toml.is_file():
            fail(f"{example_dir}: missing line.toml")

        check_forbidden_text(readme, readme.read_text())
        job_names = collect_job_names(example_dir)
        if not job_names:
            fail(f"{example_dir}: no jobs under jobs/")
        validate_line(line_toml, job_names)
        validate_prompt_bindings(example_dir)

    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        print(f"validate_examples: {len(errors)} error(s)", file=sys.stderr)
        return 1

    print(f"validate_examples: OK ({len(example_dirs)} example(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
