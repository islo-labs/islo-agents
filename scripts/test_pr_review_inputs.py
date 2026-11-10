"""Check PR identity delivery; optionally exercise the API's session renderer.

Run with the API's Python environment and --api-repo /path/to/islo-web-api
for the runtime check. The default CI check requires only the standard library.
"""

import argparse
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-repo", type=Path)
    args = parser.parse_args()
    example = ROOT / "examples/pr-review"
    agent_config = tomllib.loads((example / "agents/pr-review.toml").read_text())
    line = tomllib.loads((example / "line.toml").read_text())
    stage = line["stages"][0]
    references = set(re.findall(r"\{\{\s*([a-z_]+)\s*\}\}", agent_config["prompt"]))
    expected = {"repository", "pull_request_number", "pull_request_url"}
    assert expected <= stage["params"].keys(), "PR identifiers must be declared stage params"
    if args.api_repo is None:
        assert expected <= references, f"Agent prompt drops PR identifiers: {sorted(expected - references)}"
        assert references <= stage["params"].keys(), "Prompt references undeclared stage params"
        print("PR-review prompt input contract: OK")
        return

    sys.path.insert(0, str(args.api_repo.resolve()))
    from src.agents.models import Agent, AgentVersion
    from src.agents.services.manifest import agent_manifest
    from src.manifest.templating import substitute_params, unresolved_placeholders
    from src.workflow_handlers.templating import render_template, session_prompt_binding

    agent = Agent(
        tenant_id=1, factory_id=1, name=agent_config["name"],
        type=agent_config["type"], machine=agent_config["machine"],
    )
    definition = AgentVersion(
        tenant_id=1, agent_id=1, version=1, type=agent_config["type"],
        harness=agent_config["harness"], model=agent_config["model"],
        prompt=agent_config["prompt"],
    )
    manifest = agent_manifest(
        agent, definition, params=stage["params"], outputs=stage["outputs"],
    )
    action = manifest["run"]["tasks"][0]["steps"][0]["run_agent"]
    manual = {
        "repository": "sample-tools/payment-service",
        "pull_request_number": 247,
        "pull_request_url": "https://github.com/sample-tools/payment-service/pull/247",
    }
    raw = {
        "repository": {"full_name": "example-org/backend"},
        "pull_request": {"number": 918, "html_url": "https://github.com/example-org/backend/pull/918"},
    }
    trigger_inputs = {}
    for name, binding in line["trigger"]["outputs"].items():
        value = raw
        for part in binding["path"].removeprefix("trigger.raw.").split("."):
            value = value[part]
        trigger_inputs[name] = value
    entry = next(edge for edge in line["transitions"] if edge["from"] == "trigger")
    triggered = {name: trigger_inputs[binding["name"]] for name, binding in entry["params"].items()}
    for origin, params in (("manual", manual), ("integration trigger", triggered)):
        for continuation in (False, True):
            key, _ = session_prompt_binding(action, params, continuation=continuation)
            rendered = render_template(
                action[key]["value"], run_params=params,
                task_name="review", step_name="agent", label=key,
                substitute_params=substitute_params,
                unresolved_placeholders=unresolved_placeholders,
            )
            for name, value in params.items():
                assert str(value) in rendered, f"{origin} {key} drops {name}={value}"
            assert not unresolved_placeholders(rendered), rendered
    print("API-generated initial and resumed prompts contain all manual and trigger PR identifiers: OK")


if __name__ == "__main__":
    main()
