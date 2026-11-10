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

PLACEHOLDER_TOKEN = re.compile(r"REPLACE_WITH_[A-Z_]+")

CONDITION_OPERANDS = {
    "always": (), "eq": ("left", "right"), "ne": ("left", "right"),
    "contains": ("left", "right"), "not_contains": ("left", "right"),
    "exists": ("operand",), "missing": ("operand",), "truthy": ("operand",), "falsy": ("operand",),
    "all": ("conditions",), "any": ("conditions",), "not": ("condition",),
}
BINDING_TYPES = {"input", "output", "literal"}
RESERVED_STAGE_IDS = {"trigger", "done", "wait"}
RESERVED_OPTION_NAMES = {"cancel", "stop"}
EM_DASH = "—"
SWEPT_SUFFIXES = {".md", ".toml", ".py", ".ts", ".json", ".sh", ".yml", ".yaml"}
LINE_RUN_SCOPE = "{{line_run_id}}"
Edge = namedtuple("Edge", "transition_id origin source target params")
Stage = namedtuple("Stage", "path name text doc")
errors: list[str] = []


def stage_params(doc: dict) -> dict:
    return table(doc, "params")


def stage_outputs(doc: dict) -> dict:
    return table(doc, "outputs")


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
    stage_agents: dict[str, object] = {}
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
        stage_agents[stage_id] = stage.get("agent")

    for stage_id, count in stage_ids.items():
        if count > 1:
            fail(f"{path}: stage id {stage_id!r} declared {count} times")

    sources = set(stage_agents) | {"trigger", "wait"}
    targets = set(stage_agents) | {"done", "wait"}
    for edge in edges:
        if edge.source not in sources:
            fail(f"{path}: {edge_label(edge)} leaves undeclared stage {edge.source!r}")
        if edge.target not in targets:
            fail(f"{path}: {edge_label(edge)} targets undeclared stage {edge.target!r}")

    return stage_agents


def check_binding(path: Path, edge: Edge, param: str, binding: object,
                  stage_agents: dict[str, object], stage_docs: dict[str, Stage],
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
        if stage not in stage_agents:
            fail(f"{path}: {where} reads an output of undeclared stage {stage!r}")
            return
        agent = stage_docs.get(stage)
        if agent is not None and name not in stage_outputs(agent.doc):
            fail(f"{path}: {where} reads output {name!r}, which stage {stage!r} agent "
                 f"{agent.name!r} does not declare")
    elif binding_type == "input":
        # Line inputs are the entry stage's params. An integration trigger maps
        # only the event fields it has; manual runs and later stages still pass
        # the other params (task, origin, pull_requests) with type = "input".
        # trigger_outputs is intentionally not required to list those names.
        _ = trigger_outputs


def validate_contracts(path: Path, doc: dict, edges: list[Edge],
                       stage_agents: dict[str, object]) -> None:
    trigger_outputs = table(table(doc, "trigger"), "outputs")
    stage_docs = {
        stage["id"]: Stage(path, stage["agent"], "", stage)
        for stage in rows(doc, "stages") if isinstance(stage, dict) and "id" in stage and "agent" in stage
    }

    for edge in edges:
        target_agent = stage_docs.get(edge.target)
        declared = stage_params(target_agent.doc) if target_agent else {}
        for param, binding in edge.params.items():
            if target_agent is not None and param not in declared:
                fail(f"{path}: {edge_label(edge)} binds param {param!r}, which stage "
                     f"{edge.target!r} agent {target_agent.name!r} does not declare")
            check_binding(path, edge, param, binding, stage_agents, stage_docs, trigger_outputs)

    for stage_id, agent in stage_docs.items():
        inbound = [edge for edge in edges if edge.target == stage_id]
        for param, block in stage_params(agent.doc).items():
            if not isinstance(block, dict):
                continue
            if block.get("required") is not True or "default" in block:
                continue
            for edge in inbound:
                if param not in edge.params:
                    fail(f"{path}: stage {stage_id!r} agent {agent.name!r} requires param "
                         f"{param!r}, which {edge_label(edge)} does not bind")


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


def validate_agent(path: Path, doc: dict, expected_name: str | None = None) -> None:
    check_forbidden_text(path, path.read_text() if path.is_file() else "")
    common = {'name', 'description', 'machine', 'type', 'icon', 'color'}
    variants = {
        'prompt': {'harness', 'model', 'model_provider', 'effort', 'prompt', 'skills', 'mcp'},
        'script': {'commands'},
    }
    kind = doc.get('type')
    if kind not in variants:
        fail(f'{path}: type must be prompt or script')
        return
    for key in set(doc) - common - variants[kind]:
        fail(f'{path}: unknown Agent key {key!r}')
    for key in ('name', 'machine'):
        if not isinstance(doc.get(key), str) or not re.fullmatch(r'[a-z][a-z0-9-]{0,62}', doc[key]):
            fail(f'{path}: {key} must be a Factory resource name')
    if doc.get('name') != (expected_name or path.parent.name):
        fail(f'{path}: Agent name must match its directory')
    if kind == 'prompt':
        for key in ('model', 'prompt'):
            if not isinstance(doc.get(key), str) or not doc[key].strip():
                fail(f'{path}: {key} must be nonblank')
        harness = doc.get('harness')
        if harness not in {'codex', 'cursor', 'claude', 'opencode', 'grok'}:
            fail(f'{path}: invalid harness')
        provider = doc.get('model_provider')
        providers = {'islo': {'codex', 'grok'}, 'islo_inference': {'codex', 'claude'}, 'subscription': {'codex', 'claude', 'grok'}}
        if provider is not None and harness not in providers.get(provider, set()):
            fail(f'{path}: invalid model_provider for harness')
    elif not isinstance(doc.get('commands'), list) or not doc['commands'] or any(not isinstance(c, str) or not c.strip() for c in doc['commands']):
        fail(f'{path}: commands must be a nonempty list of nonblank strings')
    elif any('{{' in c for c in doc['commands']):
        fail(f'{path}: script commands must read inputs as data through runtime/stages.py')


def validate_example(example_dir: Path) -> None:
    readme = example_dir / 'README.md'
    readme_text = readme.read_text() if readme.is_file() else ''
    if not readme_text:
        fail(f'{example_dir}: missing README.md')
    check_forbidden_text(readme, readme_text)
    for legacy in ('jobs', 'snapshots'):
        if (example_dir / legacy).exists():
            fail(f'{example_dir}: remove legacy {legacy}/; use Agents and Machines')
    agents = {}
    manifests = []
    for path in sorted(example_dir.glob('agents/*/agent.toml')):
        doc = load_toml(path)
        if doc is None:
            continue
        validate_agent(path, doc)
        agents[doc.get('name')] = doc
        manifests.append((path, path.read_text()))
    if not agents:
        fail(f'{example_dir}: no Agents under agents/')
    manager_path = example_dir / 'manager-agent.toml'
    if manager_path.exists():
        manager = load_toml(manager_path)
        if manager:
            validate_agent(manager_path, manager, expected_name=f"{example_dir.name}-manager")
            manager_name = manager.get('name')
            if manager.get('type') != 'prompt':
                fail(f'{manager_path}: Manager must be a prompt Agent')
            agents[manager_name] = manager
    path = example_dir / 'line.toml'
    doc = load_toml(path) if path.is_file() else None
    if doc is None:
        fail(f'{path}: missing or invalid line.toml')
        return
    manifests.append((path, path.read_text()))
    check_forbidden_text(path, path.read_text())
    if table(doc, 'line').get('name') != example_dir.name:
        fail(f'{path}: [line].name must match its directory')
    if not rows(doc, 'stages'):
        fail(f'{path}: no stages')
    allowed_stage = {'id', 'agent', 'description', 'params', 'outputs', 'sandbox_name', 'max_attempts', 'prompt', 'harness', 'model', 'model_provider', 'effort', 'machine', 'skills', 'mcp'}
    used = set()
    for stage in rows(doc, 'stages'):
        if not isinstance(stage, dict):
            continue
        for key in set(stage) - allowed_stage:
            fail(f'{path}: unknown stage key {key!r}; use agent stages')
        name = stage.get('agent')
        used.add(name)
        if name not in agents:
            fail(f'{path}: stage {stage.get("id")!r} references missing Agent {name!r}')
        identity = stage.get('sandbox_name')
        if identity is not None and (not isinstance(identity, str) or identity.count(LINE_RUN_SCOPE) != 1 or '{{' in identity.replace(LINE_RUN_SCOPE, '')):
            fail(f'{path}: sandbox_name must contain exactly one {LINE_RUN_SCOPE}')
        for category in ('params', 'outputs'):
            for key, spec in table(stage, category).items():
                if not isinstance(spec, dict) or spec.get('type') not in {'string', 'integer', 'number', 'boolean', 'array', 'object'}:
                    fail(f'{path}: stage {category}.{key} needs a valid type')
                elif spec['type'] == 'array' and spec.get('items') not in {'string', 'integer', 'number', 'boolean', 'object'}:
                    fail(f'{path}: stage {category}.{key} needs array items')
        if agents.get(name, {}).get('type') == 'prompt' and 'summary' not in table(stage, 'outputs'):
            fail(f'{path}: prompt stage {stage.get("id")} needs a summary output')
    manager = table(doc, 'manager')
    if manager:
        if set(manager) - {'agent', 'prompt'} or agents.get(manager.get('agent'), {}).get('type') != 'prompt':
            fail(f'{path}: manager must reference a local prompt Agent')
        used.add(manager.get('agent'))
    for name, agent in agents.items():
        if name not in used:
            fail(f'{path}: Agent {name!r} is not used by the line')
        machine_readme = example_dir / 'machines' / str(agent.get('machine')) / 'README.md'
        if not machine_readme.is_file():
            fail(f'{path}: missing Machine setup guide {machine_readme}')
    trigger = table(doc, 'trigger')
    if trigger.get('type') == 'integration_trigger' and not trigger.get('outputs'):
        fail(f'{path}: integration trigger must declare outputs')
    for index, condition in enumerate(rows(trigger, 'filters')):
        check_condition(path, f'trigger.filters[{index}]', condition)
    edges = validate_transitions(path, doc)
    stage_agents = validate_stage_graph(path, doc, edges)
    validate_contracts(path, doc, edges, stage_agents)
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
