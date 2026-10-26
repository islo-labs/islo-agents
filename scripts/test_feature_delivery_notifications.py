"""Guard against low-value kickoff comments in the feature delivery stages."""

from pathlib import Path
import tomllib


ROOT = Path(__file__).resolve().parent.parent
JOBS = ROOT / "examples" / "feature-delivery" / "jobs"

for stage in ("implement", "review", "verify"):
    manifest = JOBS / f"feature-delivery-{stage}" / "job.toml"
    prompt = tomllib.loads(manifest.read_text())["run"]["tasks"][0]["steps"][0][
        "run_agent"
    ]["prompt"]["value"]
    assert "## Acknowledge start" not in prompt, f"{stage}: kickoff instructions remain"
    assert "Starting implementation" not in prompt, f"{stage}: kickoff comment remains"
    assert "Starting automated code review" not in prompt, f"{stage}: kickoff comment remains"
    assert "Starting E2E verification" not in prompt, f"{stage}: kickoff comment remains"
    assert "## Report back" in prompt or "Post your findings" in prompt or "verification report" in prompt

print("Feature delivery notifications: OK")
