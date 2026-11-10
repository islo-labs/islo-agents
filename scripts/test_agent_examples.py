"""Exercise Agent-backed package validation and transition contracts."""

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

AGENT = '''name = "reviewer"
machine = "review-machine"
type = "prompt"
harness = "claude"
model = "claude-sonnet-4-5"
prompt = "Review the input and return summary."
'''
LINE = '''[line]
name = "agent-check"
[trigger]
type = "manual"
[[stages]]
id = "review"
agent = "reviewer"
[stages.params.input]
type = "string"
required = true
[stages.outputs.summary]
type = "string"
required = true
[[transitions]]
id = "start"
from = "trigger"
to = "review"
type = "conditional"
when = { op = "always" }
params = { input = { type = "input", name = "input" } }
[[transitions]]
id = "finish"
from = "review"
to = "done"
type = "conditional"
when = { op = "always" }
'''


def validate(line=LINE, agent=AGENT):
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        example = root / "examples/agent-check"
        (example / "agents").mkdir(parents=True)
        (example / "README.md").write_text("# Agent check\n")
        (example / "agents/reviewer.toml").write_text(agent)
        (example / "line.toml").write_text(line)
        return subprocess.run(
            [sys.executable, str(ROOT / "scripts/validate_examples.py"), str(root)],
            capture_output=True, text=True,
        )


valid = validate()
assert valid.returncode == 0, valid.stderr
missing = validate(LINE.replace('agent = "reviewer"', 'agent = "absent"'))
assert missing.returncode != 0 and "missing Agent" in missing.stderr, missing.stderr
both = validate(LINE.replace('agent = "reviewer"', 'agent = "reviewer"\njob = "reviewer"'))
assert both.returncode != 0 and "exactly one" in both.stderr, both.stderr
unbound = validate(LINE.replace('params = { input = { type = "input", name = "input" } }', ''))
assert unbound.returncode != 0 and "requires param 'input'" in unbound.stderr, unbound.stderr
undeclared = validate(LINE.replace('params = { input =', 'params = { unknown ='))
assert undeclared.returncode != 0 and "does not declare" in undeclared.stderr, undeclared.stderr
bad_output = validate(LINE.replace(
    'type = "input", name = "input"',
    'type = "output", stage = "review", name = "missing"',
))
assert bad_output.returncode != 0 and "does not declare" in bad_output.stderr, bad_output.stderr
bad_agent = validate(agent=AGENT.replace('prompt = "Review the input and return summary."', ''))
assert bad_agent.returncode != 0 and "prompt" in bad_agent.stderr, bad_agent.stderr
print("Agent example packages and contracts: OK")
