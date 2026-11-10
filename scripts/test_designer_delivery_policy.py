"""Preserve the Designer's retained workspace and trusted visual delivery."""

import tomllib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DesignerDeliveryTests(unittest.TestCase):
    def test_delivery_contract(self):
        path = ROOT / 'examples/designer-line/agents/designer-design/agent.toml'
        manifest = tomllib.loads(path.read_text())
        prompt = manifest['prompt']
        for required in (
            '$ISLO_LINE_RUN_ID', 'files.getUploadURLExternal', 'files.completeUploadExternal',
            'screenshots', 'screen recordings', 'Omit `initial_comment`',
            'Do not call `chat.postMessage` or `chat.update`',
            '/workspace/scripts/start-storybook.sh',
        ):
            self.assertIn(required, prompt)
        line = tomllib.loads((ROOT / 'examples/designer-line/line.toml').read_text())
        self.assertEqual([s['id'] for s in line['stages']], ['design'])
        self.assertNotIn('origin', line['stages'][0]['params'])
        self.assertIn('resume_prompt', line['stages'][0]['params'])


if __name__ == '__main__':
    unittest.main()
