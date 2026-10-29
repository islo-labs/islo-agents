"""Check the Designer's centralized-text and direct-visual delivery contract."""

from pathlib import Path

job_path = (
    Path(__file__).resolve().parents[1]
    / "examples"
    / "designer-line"
    / "jobs"
    / "designer-design"
    / "job.toml"
)
manifest = job_path.read_text()

for required in (
    "$ISLO_LINE_RUN_ID",
    "files.getUploadURLExternal",
    "files.completeUploadExternal",
    "screenshots",
    "screen recordings",
    "Omit `initial_comment`",
    "Do not call `chat.postMessage` or `chat.update`",
):
    assert required in manifest, required

assert "[job.params.origin]" not in manifest

print("Designer delivery policy: OK")
