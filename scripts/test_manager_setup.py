"""Machine prerequisites and Agent deployment are documented in dependency order."""

import tomllib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SetupTests(unittest.TestCase):
    def test_all_agents_have_build_and_deploy_instructions(self):
        for path in (ROOT / 'examples').glob('*/line.toml'):
            line = tomllib.loads(path.read_text())
            readme = (path.parent / 'README.md').read_text()
            self.assertLess(readme.index('Build the Machines'), readme.index('islo agent create'))
            self.assertLess(readme.index('islo agent create'), readme.index('islo factory line validate'))
            manifests = list(path.parent.glob('agents/*/agent.toml'))
            if 'manager' in line:
                manifests.append(path.parent / 'manager-agent.toml')
            for manifest in manifests:
                agent = tomllib.loads(manifest.read_text())
                machine = agent['machine']
                guide = (path.parent / 'machines' / machine / 'README.md').read_text()
                self.assertIn(f'islo factory machine create {machine} --repo ', guide)
                self.assertIn(f'islo factory machine get {machine}', guide)
                self.assertIn('successful published build', guide)
                self.assertIn('machines/' + machine + '/README.md', readme)


if __name__ == '__main__':
    unittest.main()
