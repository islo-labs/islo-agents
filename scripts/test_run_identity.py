"""Agent stages retain their workspace without sharing across Line Runs."""

import tomllib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RunIdentityTests(unittest.TestCase):
    def test_stage_workspaces_and_machine_compatibility(self):
        for path in sorted((ROOT / 'examples').glob('*/line.toml')):
            line = tomllib.loads(path.read_text())
            agents = {
                doc['name']: doc for doc in (
                    tomllib.loads(p.read_text()) for p in path.parent.glob('agents/*/agent.toml')
                )
            }
            shared = {}
            for stage in line['stages']:
                identity = stage.get('sandbox_name', stage['agent'] + '-{{line_run_id}}')
                first = identity.replace('{{line_run_id}}', 'run-a')
                retry = identity.replace('{{line_run_id}}', 'run-a')
                other = identity.replace('{{line_run_id}}', 'run-b')
                self.assertEqual(first, retry)
                self.assertNotEqual(first, other)
                machine = agents[stage['agent']]['machine']
                self.assertEqual(shared.setdefault(first, machine), machine)

    def test_delivery_stages_stay_separate(self):
        path = ROOT / 'examples/feature-delivery/line.toml'
        stages = tomllib.loads(path.read_text())['stages']
        self.assertEqual(len({s['sandbox_name'] for s in stages}), 3)

    def test_qa_exploration_and_report_share_only_their_workspace(self):
        stages = tomllib.loads((ROOT / 'examples/qa/line.toml').read_text())['stages']
        by_id = {s['id']: s for s in stages}
        slots = []
        for brief in ('web-core', 'web-platform', 'cli-cross'):
            slot = by_id[brief]['sandbox_name']
            self.assertEqual(slot, by_id[brief + '-report']['sandbox_name'])
            slots.append(slot)
        self.assertEqual(len(set(slots)), 3)


if __name__ == '__main__':
    unittest.main()
