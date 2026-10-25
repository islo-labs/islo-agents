"""Guard retained sandbox and session identity examples."""

from pathlib import Path

from validate_examples import (
    LINE_RUN_SCOPE,
    errors,
    has_run_scoped_slot,
    validate_retained_identity,
)


def render(template: str, line_run_id: str) -> str:
    return template.replace(LINE_RUN_SCOPE, line_run_id)


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

implement = "feature-delivery-implement-{{line_run_id}}"
review = "feature-delivery-review-{{line_run_id}}"
line_a = "01a11111-1111-7111-8111-111111111111"
line_b = "01a22222-2222-7222-8222-222222222222"

assert render(implement, line_a) == render(implement, line_a)
assert render(implement, line_a) != render(implement, line_b)
assert render(implement, line_a) != render(review, line_a)

job_a = "job-run-id-01a33333-3333-7333-8333-333333333333"
job_b = "job-run-id-01a44444-4444-7444-8444-444444444444"
assert render(implement, job_a) == render(implement, job_a)
assert render(implement, job_a) != render(implement, job_b)

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
