#!/usr/bin/env python3
"""Validate customer example packages under examples/."""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, namedtuple
from pathlib import Path

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore[no-redef]

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

PLACEHOLDER_TOKEN = re.compile(r"REPLACE_WITH_[A-Z_]+")

# Examples still binding prompts through Islo Knowledge. Each entry owes the
# same conversion feature-delivery, pr-review and qa already have: an
# exec step that clones the user's own repo, and a literal prompt naming a file
# inside that checkout. Until an entry converts, its jobs fail `islo job deploy
# --dry-run` on any tenant that has not hand-published the slugs, so CI cannot
# gate them at all and the repo is not the single source of truth for its own
# prompts. The set must reach empty.
PENDING_PROMPT_SOURCE_MIGRATION = {"red-team-cli", "weekly-skills-refresh"}

# Only [[run.tasks.steps]] and run_agent are extra="forbid" in the live API, so
# everything else here is the repo's own gate: a typo'd `memory_mb` deploys
# silently with the default.
# `timeout` is the live step field. `islo schema job` still lists `timeout_secs`,
# which the API rejects as an extra input; a reader checking the dump will think
# this allow-list is wrong, and the dump is what is stale (both measured by
# --dry-run probe). `sandbox.sources` and `sandbox.setup_scripts` are the mirror
# image: absent from the dump, accepted by the API.
JOB_SECTION_KEYS = {
    "": {"job", "outputs", "run", "schedule", "verification"},
    "job": {"name", "version", "description", "params"},
    "job.params.*": {"type", "required", "default", "description", "enum", "pattern", "prefix", "items"},
    "outputs.*": {"type", "required", "description", "enum", "items", "reduce"},
    "run": {"concurrency", "fail_fast", "fanout", "region", "resume_on_start",
            "teardown_on_complete", "timeout", "workdir", "sandbox", "tasks"},
    "run.sandbox": {"cache_key", "disk_gb", "env", "environment",
                    "gateway_profile", "image", "init", "internet_enabled", "memory_mb",
                    "mode", "name", "snapshot_name", "vcpus", "workdir",
                    "lifecycle", "sources", "setup_scripts"},
    "run.sandbox.lifecycle": {"auto_resume", "delete_after", "pause_after", "pause_after_idle"},
    "run.tasks[]": {"name", "sandbox", "steps"},
    "run.tasks[].steps[]": {"name", "timeout", "user", "workdir",
                            "exec", "pause", "resume", "delete", "snapshot", "run_agent",
                            "upload", "download", "outputs"},
    "run.tasks[].steps[].run_agent": {"mode", "harness", "model", "prompt", "resume_prompt",
                                      "knowledge", "session", "command"},
}

JOB_SECTION_COLLECTIONS = {
    "job.params": "job.params.*",
    "outputs": "outputs.*",
    "run.tasks": "run.tasks[]",
    "run.tasks[].steps": "run.tasks[].steps[]",
}

# A per-task sandbox override carries the same field set as the shared sandbox.
JOB_SECTION_ALIASES = {"run.tasks[].sandbox": "run.sandbox"}

CONDITION_OPERANDS = {
    "always": (), "eq": ("left", "right"), "ne": ("left", "right"),
    "contains": ("left", "right"), "not_contains": ("left", "right"),
    "exists": ("operand",), "missing": ("operand",), "truthy": ("operand",), "falsy": ("operand",),
    "all": ("conditions",), "any": ("conditions",), "not": ("condition",),
}

TRANSITION_TYPES = {"conditional", "agentic"}
BINDING_TYPES = {"input", "output", "literal"}
RESERVED_STAGE_IDS = {"trigger", "done", "wait"}

# The API rejects these as agentic option names ("reserved for line controls").
# Measured one name at a time against `islo factory line validate`; the rest of
# the line-control vocabulary (retry, steer, follow-up, ask) is accepted.
RESERVED_OPTION_NAMES = {"cancel", "stop"}

# The skill repo syncs these examples verbatim and bans the character, so a
# stray em-dash here fails a downstream drift check rather than this one.
EM_DASH = "—"
SWEPT_SUFFIXES = {".md", ".toml", ".py", ".ts", ".json", ".sh", ".yml", ".yaml"}

Edge = namedtuple("Edge", "transition_id origin source target params")
Job = namedtuple("Job", "path name text doc")

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def load_toml(path: Path) -> dict | None:
    try:
        with path.open("rb") as f:
            return tomllib.load(f)
    except tomllib.TOMLDecodeError as exc:
        fail(f"{path}: invalid TOML: {exc}")
        return None


def table(parent: dict, key: str) -> dict:
    value = parent.get(key)
    return value if isinstance(value, dict) else {}


def rows(parent: dict, key: str) -> list:
    value = parent.get(key)
    return value if isinstance(value, list) else []


def edge_label(edge: Edge) -> str:
    return f"transition {edge.transition_id!r} ({edge.origin})"


def check_forbidden_text(path: Path, text: str) -> None:
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(text):
            fail(f"{path}: forbidden pattern {pattern.pattern}")


def walk_job_sections(path: Path, section: str, display: str, doc: dict) -> None:
    allowed = JOB_SECTION_KEYS.get(section)
    for key, value in doc.items():
        if allowed is not None and key not in allowed:
            where = f"in [{display}]" if display else "at top level"
            fail(f"{path}: unknown key {key!r} {where}")
        child = f"{section}.{key}" if section else key
        child_display = f"{display}.{key}" if display else key
        member = JOB_SECTION_COLLECTIONS.get(child)
        if member is None:
            target = JOB_SECTION_ALIASES.get(child, child)
            if target in JOB_SECTION_KEYS and isinstance(value, dict):
                walk_job_sections(path, target, child_display, value)
        elif isinstance(value, dict):
            for name, item in value.items():
                if isinstance(item, dict):
                    walk_job_sections(path, member, f"{child_display}.{name}", item)
        elif isinstance(value, list):
            for index, item in enumerate(value):
                if isinstance(item, dict):
                    walk_job_sections(path, member, f"{child_display}[{index}]", item)


def check_condition(path: Path, label: str, cond: object) -> None:
    if not isinstance(cond, dict):
        fail(f"{path}: {label} must be a condition table")
        return
    op = cond.get("op")
    if op not in CONDITION_OPERANDS:
        legal = ", ".join(sorted(CONDITION_OPERANDS))
        fail(f"{path}: {label} has unknown op {op!r}; legal ops are {legal}")
        return
    for operand in CONDITION_OPERANDS[op]:
        if operand not in cond:
            fail(f"{path}: {label} op {op!r} requires {operand!r}")
    if op in ("all", "any"):
        for index, nested in enumerate(rows(cond, "conditions")):
            check_condition(path, f"{label}.conditions[{index}]", nested)
    elif op == "not" and "condition" in cond:
        check_condition(path, f"{label}.condition", cond["condition"])


def job_params(doc: dict) -> dict:
    return table(table(doc, "job"), "params")


def job_outputs(doc: dict) -> dict:
    return table(doc, "outputs")


def iter_run_agents(doc: dict):
    for task in rows(table(doc, "run"), "tasks"):
        if not isinstance(task, dict):
            continue
        for step in rows(task, "steps"):
            if not isinstance(step, dict):
                continue
            agent = step.get("run_agent")
            if isinstance(agent, dict):
                yield step.get("name") or "?", agent


def declares_checkout_step(doc: dict) -> bool:
    for task in rows(table(doc, "run"), "tasks"):
        if not isinstance(task, dict):
            continue
        for step in rows(task, "steps"):
            if not isinstance(step, dict):
                continue
            command = step.get("exec")
            joined = " ".join(command) if isinstance(command, list) else str(command or "")
            if "git clone" in joined or ("git" in joined and "fetch" in joined):
                return True
    return False


def validate_job(path: Path, example_dir: Path, text: str, doc: dict) -> str | None:
    check_forbidden_text(path, text)
    walk_job_sections(path, "", "", doc)

    job = table(doc, "job")
    name = job.get("name")
    if not name:
        fail(f"{path}: missing [job].name")
        name = None
    elif name != path.parent.name:
        fail(f"{path}: [job].name {name!r} must match directory {path.parent.name!r}")

    for param_name, param_block in job_params(doc).items():
        if not isinstance(param_block, dict):
            continue
        param_type = param_block.get("type")
        if param_type is None:
            fail(f"{path}: job.params.{param_name} missing type")
        if param_type == "array" and "items" not in param_block:
            fail(f"{path}: job.params.{param_name} is an array param and requires items")
        if "items" in param_block and param_type != "array":
            fail(f"{path}: job.params.{param_name} sets items, which is only valid for array params")

    for out_name, out_block in job_outputs(doc).items():
        if isinstance(out_block, dict) and "type" not in out_block:
            fail(f"{path}: outputs.{out_name} missing type")

    sandbox = table(table(doc, "run"), "sandbox")
    image = sandbox.get("image")
    if image and image not in PUBLIC_RUNNER_IMAGES:
        fail(f"{path}: image must be a public runner image, got {image!r}")

    snapshot = sandbox.get("snapshot_name")
    if snapshot:
        snap_readme = example_dir / "snapshots" / snapshot / "README.md"
        if not snap_readme.is_file():
            fail(f"{path}: snapshot {snapshot!r} missing {snap_readme}")

    # Fresh provision clones [[run.sandbox.sources]]. Exec clone remains valid
    # for snapshot-restore jobs until compute restore-checkout lands.

    if "npx tsx" in text or "git clone https://github.com/islo-labs/islo-agents" in text:
        fail(f"{path}: must not clone this pack at runtime")

    return name


def collect_jobs(example_dir: Path) -> list[Job]:
    jobs_root = example_dir / "jobs"
    if not jobs_root.is_dir():
        return []
    found: list[Job] = []
    for job_dir in sorted(jobs_root.iterdir()):
        job_toml = job_dir / "job.toml"
        if not job_toml.is_file():
            continue
        text = job_toml.read_text()
        doc = load_toml(job_toml)
        if doc is None:
            continue
        found.append(Job(job_toml, validate_job(job_toml, example_dir, text, doc), text, doc))
    return found


def validate_line(path: Path, text: str, doc: dict, job_names: set[str]) -> None:
    check_forbidden_text(path, text)
    line_name = table(doc, "line").get("name")
    if not line_name:
        fail(f"{path}: missing [line].name")
    if line_name != path.parent.name:
        fail(f"{path}: [line].name {line_name!r} must match directory {path.parent.name!r}")

    stages = rows(doc, "stages")
    if not stages:
        fail(f"{path}: no [[stages]]")
    for stage in stages:
        if not isinstance(stage, dict):
            continue
        job = stage.get("job")
        if job not in job_names:
            fail(f"{path}: stage {stage.get('id')!r} references missing job {job!r}")

    trigger = table(doc, "trigger")
    if trigger.get("type") == "integration_trigger" and not trigger.get("outputs"):
        fail(f"{path}: integration trigger must declare [trigger.outputs]")

    if not rows(doc, "transitions"):
        fail(f"{path}: no [[transitions]]")

    if "manager" in doc:
        fail(f"{path}: [manager] is not a line section; put routing guidance in "
             f"[agent.instructions] and express the decision as an 'agentic' transition")
    if "decisions" in doc:
        fail(f"{path}: [[decisions]] is not a line section; express the decision as an "
             f"'agentic' transition with [[transitions.options]]")

    for index, filt in enumerate(rows(trigger, "filters")):
        label = f"trigger.filters[{index}]"
        if not isinstance(filt, dict):
            fail(f"{path}: {label} must be a table")
        elif "path" in filt or "value" in filt:
            fail(f"{path}: {label} uses the legacy {{path, op, value}} form; use the condition "
                 f"AST, e.g. {{ op = \"eq\", left = {{ type = \"trigger\", path = \"$.action\" }}, "
                 f"right = {{ type = \"literal\", value = \"opened\" }} }}")
        else:
            check_condition(path, label, filt)


def validate_transitions(path: Path, doc: dict) -> list[Edge]:
    edges: list[Edge] = []
    transition_ids: Counter = Counter()
    agentic_sources: Counter = Counter()
    trigger_entries = 0

    for index, transition in enumerate(rows(doc, "transitions")):
        if not isinstance(transition, dict):
            fail(f"{path}: transitions[{index}] must be a table")
            continue
        tid = transition.get("id")
        if not tid:
            fail(f"{path}: transitions[{index}] missing id")
            tid = f"transitions[{index}]"
        else:
            transition_ids[tid] += 1

        source = transition.get("from")
        if source == "done":
            fail(f"{path}: transition {tid!r} has from = 'done'; done is terminal")
        if source == "trigger":
            trigger_entries += 1
            when = transition.get("when")
            if isinstance(when, dict) and when.get("op") != "always":
                fail(f"{path}: entry transition {tid!r} must use when.op = 'always', "
                     f"got {when.get('op')!r}")

        transition_type = transition.get("type")
        if transition_type == "conditional":
            when = transition.get("when")
            if when is None:
                fail(f"{path}: conditional transition {tid!r} requires a [transitions.when] table")
            else:
                check_condition(path, f"transition {tid!r} when", when)
            target = transition.get("to")
            if not target:
                fail(f"{path}: conditional transition {tid!r} missing to")
            else:
                edges.append(Edge(tid, "conditional", source, target, table(transition, "params")))
        elif transition_type == "agentic":
            agentic_sources[source] += 1
            if not transition.get("instructions"):
                fail(f"{path}: agentic transition {tid!r} requires instructions")
            options = rows(transition, "options")
            if not options:
                fail(f"{path}: agentic transition {tid!r} requires at least one "
                     f"[[transitions.options]]")
            option_names: Counter = Counter()
            for option_index, option in enumerate(options):
                if not isinstance(option, dict):
                    fail(f"{path}: transition {tid!r} options[{option_index}] must be a table")
                    continue
                option_name = option.get("name")
                if not option_name:
                    fail(f"{path}: transition {tid!r} options[{option_index}] missing name")
                    option_name = f"options[{option_index}]"
                else:
                    option_names[option_name] += 1
                    if option_name in RESERVED_OPTION_NAMES:
                        fail(f"{path}: transition {tid!r} option name {option_name!r} is "
                             f"reserved for line controls and the API rejects the manifest; "
                             f"use a name like 'retry' or 'cancel-run'")
                target = option.get("to")
                if not target:
                    fail(f"{path}: transition {tid!r} option {option_name!r} missing to")
                else:
                    edges.append(Edge(tid, f"option {option_name!r}", source, target,
                                      table(option, "params")))
            for option_name, count in option_names.items():
                if count > 1:
                    fail(f"{path}: transition {tid!r} declares option {option_name!r} {count} times")
        else:
            fail(f"{path}: transition {tid!r} has type {transition_type!r}; must be "
                 f"'conditional' or 'agentic'")

    for tid, count in transition_ids.items():
        if count > 1:
            fail(f"{path}: transition id {tid!r} declared {count} times")

    if trigger_entries == 0:
        fail(f"{path}: missing entry transition from trigger")
    elif trigger_entries > 1:
        fail(f"{path}: {trigger_entries} transitions have from = 'trigger'; exactly one "
             f"entry transition is allowed")

    for source, count in agentic_sources.items():
        if count > 1:
            fail(f"{path}: {count} agentic transitions leave {source!r}; at most one is allowed")

    for edge in edges:
        if edge.target == "trigger":
            fail(f"{path}: {edge_label(edge)} targets 'trigger'; the trigger is never a target")
        if edge.source == "wait" and edge.target == "wait" and edge.origin != "conditional":
            fail(f"{path}: {edge_label(edge)} targets 'wait' from 'wait'")

    if not any(edge.target == "done" for edge in edges):
        fail(f"{path}: no transition targets 'done'")

    if any(edge.target == "wait" for edge in edges) and agentic_sources["wait"] != 1:
        fail(f"{path}: transitions target 'wait' but {agentic_sources['wait']} agentic "
             f"transitions leave 'wait'; exactly one is required")

    return edges


def validate_stage_graph(path: Path, doc: dict, edges: list[Edge]) -> dict[str, object]:
    stage_jobs: dict[str, object] = {}
    stage_ids: Counter = Counter()
    for index, stage in enumerate(rows(doc, "stages")):
        if not isinstance(stage, dict):
            fail(f"{path}: stages[{index}] must be a table")
            continue
        stage_id = stage.get("id")
        if not stage_id:
            fail(f"{path}: stages[{index}] missing id")
            continue
        stage_ids[stage_id] += 1
        if stage_id in RESERVED_STAGE_IDS:
            fail(f"{path}: stage id {stage_id!r} is reserved")
        stage_jobs[stage_id] = stage.get("job")

    for stage_id, count in stage_ids.items():
        if count > 1:
            fail(f"{path}: stage id {stage_id!r} declared {count} times")

    sources = set(stage_jobs) | {"trigger", "wait"}
    targets = set(stage_jobs) | {"done", "wait"}
    for edge in edges:
        if edge.source not in sources:
            fail(f"{path}: {edge_label(edge)} leaves undeclared stage {edge.source!r}")
        if edge.target not in targets:
            fail(f"{path}: {edge_label(edge)} targets undeclared stage {edge.target!r}")

    return stage_jobs


def check_binding(path: Path, edge: Edge, param: str, binding: object,
                  stage_jobs: dict[str, object], stage_docs: dict[str, Job],
                  trigger_outputs: dict) -> None:
    where = f"{edge_label(edge)} param {param!r}"
    if not isinstance(binding, dict):
        fail(f"{path}: {where} must be a binding table")
        return
    binding_type = binding.get("type")
    if binding_type not in BINDING_TYPES:
        legal = ", ".join(sorted(BINDING_TYPES))
        fail(f"{path}: {where} has type {binding_type!r}; must be one of {legal}")
        return
    if binding_type == "output":
        stage = binding.get("stage")
        name = binding.get("name")
        if stage not in stage_jobs:
            fail(f"{path}: {where} reads an output of undeclared stage {stage!r}")
            return
        job = stage_docs.get(stage)
        if job is not None and name not in job_outputs(job.doc):
            fail(f"{path}: {where} reads output {name!r}, which stage {stage!r} job "
                 f"{job.name!r} does not declare")
    elif binding_type == "input":
        name = binding.get("name")
        if trigger_outputs and name not in trigger_outputs:
            fail(f"{path}: {where} reads trigger input {name!r}, which [trigger.outputs] "
                 f"does not declare")


def validate_contracts(path: Path, doc: dict, edges: list[Edge],
                       stage_jobs: dict[str, object], jobs_by_name: dict[str, Job]) -> None:
    trigger_outputs = table(table(doc, "trigger"), "outputs")
    stage_docs = {
        stage_id: jobs_by_name[job_name]
        for stage_id, job_name in stage_jobs.items()
        if job_name in jobs_by_name
    }

    for edge in edges:
        target_job = stage_docs.get(edge.target)
        declared = job_params(target_job.doc) if target_job else {}
        for param, binding in edge.params.items():
            if target_job is not None and param not in declared:
                fail(f"{path}: {edge_label(edge)} binds param {param!r}, which stage "
                     f"{edge.target!r} job {target_job.name!r} does not declare")
            check_binding(path, edge, param, binding, stage_jobs, stage_docs, trigger_outputs)

    for stage_id, job in stage_docs.items():
        inbound = [edge for edge in edges if edge.target == stage_id]
        for param, block in job_params(job.doc).items():
            if not isinstance(block, dict):
                continue
            if block.get("required") is not True or "default" in block:
                continue
            for edge in inbound:
                if param not in edge.params:
                    fail(f"{path}: stage {stage_id!r} job {job.name!r} requires param "
                         f"{param!r}, which {edge_label(edge)} does not bind")


def validate_prompt_bindings(example_dir: Path, jobs: list[Job], readme_text: str) -> None:
    if not (example_dir / "prompts").is_dir():
        return
    for job in jobs:
        for slug_match in re.finditer(r'slug = "([^"]+)"', job.text):
            slug = slug_match.group(1)
            if slug not in readme_text:
                fail(f"{example_dir}: knowledge slug {slug!r} not documented in README.md")


def validate_prompt_policy(example_dir: Path, jobs: list[Job], readme_text: str) -> None:
    prompts_dir = example_dir / "prompts"
    prompt_files = sorted(p for p in prompts_dir.iterdir() if p.is_file()) if prompts_dir.is_dir() else []
    exempt = example_dir.name in PENDING_PROMPT_SOURCE_MIGRATION
    literal_prompts: list[str] = []
    checkout_declared = False

    for job in jobs:
        checkout_declared = checkout_declared or declares_checkout_step(job.doc)
        for step_name, agent in iter_run_agents(job.doc):
            for field in ("prompt", "resume_prompt"):
                binding = agent.get(field)
                if not isinstance(binding, dict):
                    continue
                if binding.get("type") == "literal":
                    literal_prompts.append(str(binding.get("value", "")))
                elif binding.get("type") == "knowledge" and not exempt:
                    fail(f"{job.path}: step {step_name!r} {field} binds knowledge slug "
                         f"{binding.get('slug')!r}; the template is undeployable until someone "
                         f"hand-publishes that slug. Use {{ type = \"literal\", ... }} pointing "
                         f"into a repo checked out by an exec step")
            if exempt:
                continue
            for item in rows(agent, "knowledge"):
                if isinstance(item, dict) and item.get("type") == "knowledge":
                    fail(f"{job.path}: step {step_name!r} knowledge binds slug "
                         f"{item.get('slug')!r}; the template is undeployable until someone "
                         f"hand-publishes that slug. Check the material out through a "
                         f"checked-out file instead")

    if prompt_files and not exempt and not checkout_declared:
        fail(f"{example_dir}: ships prompts/ but no job has an exec step that clones the user's "
             f"repo, so a literal prompt has no checked-out file to point at")

    for prompt_file in prompt_files:
        if prompt_file.name in readme_text:
            continue
        if any(prompt_file.name in prompt for prompt in literal_prompts):
            continue
        fail(f"{prompt_file}: unreferenced by any job prompt or by "
             f"{example_dir / 'README.md'}; it may be stale")


def validate_placeholders(manifests: list[tuple[Path, str]], readme: Path, readme_text: str) -> None:
    for path, text in manifests:
        for token in sorted(set(PLACEHOLDER_TOKEN.findall(text))):
            if token not in readme_text:
                fail(f"{path}: placeholder {token} is not documented in {readme}")


def validate_em_dashes(example_dir: Path) -> None:
    for path in sorted(example_dir.rglob("*")):
        if not path.is_file() or path.suffix not in SWEPT_SUFFIXES:
            continue
        if "__pycache__" in path.parts:
            continue
        try:
            text = path.read_text()
        except UnicodeDecodeError:
            continue
        lines = [str(i) for i, line in enumerate(text.splitlines(), 1) if EM_DASH in line]
        if lines:
            fail(f"{path}: em-dash on line(s) {', '.join(lines)}; use a period or comma")


def validate_example(example_dir: Path) -> None:
    readme = example_dir / "README.md"
    line_path = example_dir / "line.toml"
    readme_text = readme.read_text() if readme.is_file() else ""
    if not readme.is_file():
        fail(f"{example_dir}: missing README.md")
    else:
        check_forbidden_text(readme, readme_text)

    jobs = collect_jobs(example_dir)
    if not jobs:
        fail(f"{example_dir}: no jobs under jobs/")
    jobs_by_name = {job.name: job for job in jobs if job.name}

    manifests = [(job.path, job.text) for job in jobs]
    if not line_path.is_file():
        fail(f"{example_dir}: missing line.toml")
    else:
        line_text = line_path.read_text()
        manifests.append((line_path, line_text))
        line_doc = load_toml(line_path)
        if line_doc is not None:
            validate_line(line_path, line_text, line_doc, set(jobs_by_name))
            edges = validate_transitions(line_path, line_doc)
            stage_jobs = validate_stage_graph(line_path, line_doc, edges)
            validate_contracts(line_path, line_doc, edges, stage_jobs, jobs_by_name)

    validate_prompt_bindings(example_dir, jobs, readme_text)
    validate_prompt_policy(example_dir, jobs, readme_text)
    validate_placeholders(manifests, readme, readme_text)
    validate_em_dashes(example_dir)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "repo",
        nargs="?",
        default=None,
        help="Repository root (defaults to the parent of scripts/)",
    )
    args = parser.parse_args(argv[1:])
    root = (
        Path(args.repo).resolve()
        if args.repo
        else Path(__file__).resolve().parent.parent
    )
    examples_root = root / "examples"
    example_dirs: list[Path] = []
    if not examples_root.is_dir():
        fail(f"{examples_root}: examples directory missing")
    else:
        example_dirs = sorted(p for p in examples_root.iterdir() if p.is_dir())
        if not example_dirs:
            fail(f"{examples_root}: no examples found")

    for example_dir in example_dirs:
        validate_example(example_dir)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"validate_examples: {len(errors)} error(s)", file=sys.stderr)
        return 1

    print(f"validate_examples: OK ({len(example_dirs)} example(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
