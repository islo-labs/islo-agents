"""Check rendered identities from the first-party job manifests."""

import tomllib
from pathlib import Path

from validate_examples import (
    LINE_RUN_SCOPE,
    errors,
    has_run_scoped_slot,
    validate_retained_identity,
)


def render(template: str, line_run_id: str) -> str:
    return template.replace(LINE_RUN_SCOPE, line_run_id)


def identities(job_name: str) -> tuple[str, str]:
    path = (
        Path(__file__).resolve().parents[1]
        / "examples"
        / ("designer-line" if job_name == "designer-design" else "feature-delivery")
        / "jobs"
        / job_name
        / "job.toml"
    )
    with path.open("rb") as source:
        job = tomllib.load(source)
    assert "work_key" not in job["job"].get("params", {})
    sandbox = job["run"]["sandbox"]
    assert sandbox["mode"] == "ensure"
    sessions = [
        step["run_agent"]["session"]
        for task in job["run"]["tasks"]
        for step in task["steps"]
        if "run_agent" in step and "session" in step["run_agent"]
    ]
    assert len(sessions) == 1, job_name
    return sandbox["name"], sessions[0]


valid = [
    "designer-{{line_run_id}}",
    "feature-delivery-implement-{{line_run_id}}",
    "{{line_run_id}}-review",
]
invalid = [
    "{{line_run_id}}",
    "feature-delivery-{{issue_id}}",
    "feature-delivery-{{run_id}}",
    "feature-delivery-static",
    "feature-{{line_run_id}}-{{line_run_id}}",
    "{{issue_id}}-{{line_run_id}}",
]

assert all(has_run_scoped_slot(value) for value in valid)
assert not any(has_run_scoped_slot(value) for value in invalid)

jobs = {
    name: identities(name)
    for name in (
        "feature-delivery-implement",
        "feature-delivery-review",
        "feature-delivery-verify",
        "designer-design",
    )
}
assert all(has_run_scoped_slot(name) for pair in jobs.values() for name in pair)
line_a = "01a11111-1111-7111-8111-111111111111"
line_b = "01a22222-2222-7222-8222-222222222222"

# A retry or re-entry keeps both resources, while a new or concurrent line
# run for the same issue receives different resources despite identical inputs.
for sandbox, session in jobs.values():
    first_visit = (render(sandbox, line_a), render(session, line_a))
    stage_reentry = (render(sandbox, line_a), render(session, line_a))
    assert stage_reentry == first_visit
    assert render(sandbox, line_a) != render(sandbox, line_b)
    assert render(session, line_a) != render(session, line_b)

# Stages with different environment slots cannot converge within one line run.
for index, (sandbox, session) in enumerate(jobs.values()):
    for other_sandbox, other_session in list(jobs.values())[index + 1 :]:
        assert render(sandbox, line_a) != render(other_sandbox, line_a)
        assert render(session, line_a) != render(other_session, line_a)

job_a = "job-run-id-01a33333-3333-7333-8333-333333333333"
job_b = "job-run-id-01a44444-4444-7444-8444-444444444444"
for sandbox, session in jobs.values():
    assert render(sandbox, job_a) != render(sandbox, job_b)
    assert render(session, job_a) != render(session, job_b)
    assert render(sandbox, job_a).endswith(job_a)
    assert render(session, job_a).endswith(job_a)

named_session_without_ensure = {
    "run": {
        "sandbox": {"mode": "provision", "name": "temporary"},
        "tasks": [
            {
                "steps": [
                    {
                        "name": "agent",
                        "run_agent": {
                            "mode": "session",
                            "session": "shared-session",
                        },
                    }
                ]
            }
        ],
    }
}
errors.clear()
validate_retained_identity(Path("fixture.toml"), named_session_without_ensure)
assert errors == [
    "fixture.toml: step 'agent' named session must combine an explicit slot "
    "with {{line_run_id}}"
]
errors.clear()

print("Run identity: OK")
