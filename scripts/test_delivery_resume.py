"""Keep current delivery inputs in every native Agent continuation.

The contract checks run in secret-free CI. To exercise the real native adapter,
set ISLO_WEB_API_ROOT to an islo-web-api checkout and use its Python environment.
"""

import os
from pathlib import Path
from types import SimpleNamespace
import sys
import tomllib
import unittest
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / 'examples/feature-delivery'


def delivery_stages():
    line = tomllib.loads((EXAMPLE / 'line.toml').read_text())
    for stage in line['stages']:
        agent = tomllib.loads((EXAMPLE / 'agents' / stage['agent'] / 'agent.toml').read_text())
        yield stage, agent


class DeliveryResumeContractTests(unittest.TestCase):
    def test_every_visit_replays_current_inputs_and_follow_up(self):
        # These native parameter names replace the full prompt on continuations.
        for stage, agent in delivery_stages():
            with self.subTest(stage=stage['id']):
                self.assertFalse({'input', 'resume_prompt'} & stage['params'].keys(),
                                 'Delivery must resend its full prompt on every visit')
                for name in ('issue_id', 'task', 'pull_requests', 'follow_up'):
                    self.assertIn(name, stage['params'])
                    self.assertIn('{{' + name + '}}', agent['prompt'])
                if stage['id'] == 'verify':
                    self.assertIn('{{acceptance_criteria}}', agent['prompt'])

    def test_manager_and_guide_use_the_declared_steering_parameter(self):
        manager = tomllib.loads((EXAMPLE / 'manager-agent.toml').read_text())
        self.assertIn('--param follow_up=', manager['prompt'])
        self.assertIn('--param follow_up=', (EXAMPLE / 'README.md').read_text())


@unittest.skipUnless(os.environ.get('ISLO_WEB_API_ROOT'), 'Set ISLO_WEB_API_ROOT to test the native adapter')
class NativeDeliveryResumeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, os.environ['ISLO_WEB_API_ROOT'])
        from src.agents.services.manifest import agent_manifest
        from src.manifest.templating import substitute_params
        from src.workflow_handlers.templating import session_prompt_binding
        cls.agent_manifest = staticmethod(agent_manifest)
        cls.substitute_params = staticmethod(substitute_params)
        cls.session_prompt_binding = staticmethod(session_prompt_binding)

    def test_first_visit_retry_and_explicit_steer_receive_current_feature(self):
        for stage, config in delivery_stages():
            definition = SimpleNamespace(
                **(dict(params={}, questions=None, model_provider=None, effort=None, skills=[], mcp=[]) | config)
            )
            agent = SimpleNamespace(name=config['name'], machine=config['machine'],
                                    public_id=UUID('00000000-0000-4000-8000-000000000001'))
            manifest = self.agent_manifest(agent, definition, stage_id=stage['id'],
                                           params=stage['params'], outputs=stage['outputs'])
            action = manifest['run']['tasks'][0]['steps'][0]['run_agent']
            defaults = {key: spec['default'] for key, spec in stage['params'].items() if 'default' in spec}
            visits = (
                (False, ['https://github.com/your-org/api/pull/1'], '', 'Original task', 'Initial criterion'),
                (False, ['https://github.com/your-org/api/pull/1'], 'Inspect the first implementation.', 'Original task', 'Initial criterion'),
                (True, ['https://github.com/your-org/api/pull/2', 'https://github.com/your-org/ui/pull/3'], '', 'Updated task', 'Updated criterion'),
                (True, ['https://github.com/your-org/worker/pull/4'], 'Focus on the queue retry change.', 'Steered task', 'Steered criterion'),
                (True, ['https://github.com/your-org/worker/pull/5'], '', 'Next task', 'Next criterion'),
            )
            for continuation, prs, follow_up, task, criterion in visits:
                with self.subTest(stage=stage['id'], continuation=continuation, follow_up=follow_up):
                    params = defaults | {
                        'issue_id': 'EXAMPLE-123', 'task': task, 'pull_requests': prs,
                        'follow_up': follow_up, 'acceptance_criteria': [criterion],
                    }
                    field, _ = self.session_prompt_binding(action, params, continuation=continuation)
                    text = self.substitute_params(action[field]['value'], run_params=params)
                    for current in (*prs, 'EXAMPLE-123', task):
                        self.assertIn(current, text)
                    for previous in {url for visit in visits for url in visit[1]} - set(prs):
                        self.assertNotIn(previous, text)
                    if follow_up:
                        self.assertIn(follow_up, text)
                    for previous in {visit[2] for visit in visits} - {follow_up, ''}:
                        self.assertNotIn(previous, text)
                    if stage['id'] == 'verify':
                        self.assertIn(criterion, text)


if __name__ == '__main__':
    unittest.main()
