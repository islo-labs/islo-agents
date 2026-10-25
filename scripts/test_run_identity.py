"""Guard retained sandbox and session identity examples."""

from validate_examples import LINE_RUN_SCOPE, has_run_scoped_slot


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

print("Run identity: OK")
