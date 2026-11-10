"""The package validator rejects broken Agent references and routing contracts."""

import shutil
import tempfile
import unittest
from pathlib import Path

import validate_examples as validator

ROOT = Path(__file__).resolve().parents[1]


class ValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.example = Path(self.temp.name) / 'pr-review'
        shutil.copytree(ROOT / 'examples/pr-review', self.example)
        validator.errors.clear()

    def check_invalid(self, old, new, message):
        path = self.example / 'line.toml'
        text = path.read_text()
        self.assertIn(old, text)
        path.write_text(text.replace(old, new, 1))
        validator.validate_example(self.example)
        self.assertTrue(any(message in e for e in validator.errors), validator.errors)

    def test_real_package_passes(self):
        validator.validate_example(self.example)
        self.assertEqual(validator.errors, [])

    def test_legacy_stage_rejected(self):
        self.check_invalid('agent = "pr-review"', 'job = "pr-review"', 'unknown stage key')

    def test_unknown_agent_rejected(self):
        self.check_invalid('agent = "pr-review"', 'agent = "missing"', 'missing Agent')

    def test_missing_required_binding_rejected(self):
        self.check_invalid('[transitions.params.repository]\ntype = "input"\nname = "repository"', '', 'requires param')

    def test_undeclared_target_rejected(self):
        self.check_invalid('to = "review"', 'to = "missing"', 'undeclared stage')

    def test_unknown_output_rejected(self):
        self.check_invalid('type = "input"\nname = "repository"', 'type = "output"\nstage = "review"\nname = "missing"', 'does not declare')

    def test_machine_guide_required(self):
        (self.example / 'machines/pr-review/README.md').unlink()
        validator.validate_example(self.example)
        self.assertTrue(any('Machine setup guide' in e for e in validator.errors))

    def test_legacy_directory_rejected(self):
        (self.example / 'jobs').mkdir()
        validator.validate_example(self.example)
        self.assertTrue(any('legacy jobs/' in e for e in validator.errors))

    def test_script_interpolation_rejected(self):
        validator.validate_agent(Path('notify/agent.toml'), {
            'name': 'notify', 'machine': 'notify', 'type': 'script',
            'commands': ['echo {{slack_text}}'],
        })
        self.assertTrue(any('inputs as data' in e for e in validator.errors))


if __name__ == '__main__':
    unittest.main()
