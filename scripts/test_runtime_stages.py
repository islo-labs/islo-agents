"""Exercise script Agents without providers or external writes."""

import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stages', ROOT / 'runtime/stages.py')
stages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stages)
RUN_ID = '01a11111-1111-7111-8111-111111111111'


def event(sequence, params, stage='slack-notify'):
    return {'sequence': sequence, 'event_type': 'stage_started', 'payload': {
        'stage_name': stage, 'input_payload': {'params': params},
    }}


class RuntimeTests(unittest.TestCase):
    def test_latest_stage_visit_and_pagination(self):
        first = [event(1, {'slack_text': 'old'})] + [
            {'sequence': n, 'event_type': 'log', 'payload': {}} for n in range(2, 201)
        ]
        text = 'A quote: \'\nEOF\n$(touch /tmp/should-not-exist)\nUnicode: café'
        second = [event(201, {'slack_channel_id': 'C123', 'slack_text': text})]
        with patch.dict(os.environ, ISLO_LINE_RUN_ID=RUN_ID), patch.object(
            stages.subprocess, 'check_output', side_effect=[json.dumps({'items': first}), json.dumps({'items': second})]
        ) as command:
            self.assertEqual(stages.stage_params('qa', 'slack-notify')['slack_text'], text)
        self.assertIn('after_sequence=200', command.call_args.args[0][2])
        self.assertNotIn(text, repr(command.call_args_list))

    def test_missing_stage_fails_instead_of_using_another_stage(self):
        with patch.dict(os.environ, ISLO_LINE_RUN_ID=RUN_ID), patch.object(
            stages.subprocess, 'check_output', return_value=json.dumps({'items': [event(1, {}, 'collect')]})
        ), self.assertRaisesRegex(RuntimeError, 'No stage_started'):
            stages.stage_params('qa', 'slack-notify')

    def test_defaults_are_applied_to_script_inputs(self):
        with patch.dict(os.environ, ISLO_LINE_RUN_ID=RUN_ID), patch.object(
            stages.subprocess, 'check_output', return_value=json.dumps({'items': [event(1, {}, 'prepare')]})
        ):
            self.assertEqual(stages.stage_params('weekly-skills-refresh', 'prepare')['publish_mode'], 'pr')

    def test_multiline_output_roundtrips(self):
        text = 'One\nTwo "quotes"\n$(echo untrusted)'
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'outputs'
            with patch.dict(os.environ, ISLO_OUTPUT=str(path)):
                stages.output(summary=text)
            records = path.read_text().splitlines()
            self.assertEqual(len(records), 1)
            self.assertEqual(json.loads(records[0].split('=', 1)[1]), text)

    def test_notifier_sends_text_unchanged_as_json(self):
        from unittest.mock import MagicMock
        text = 'Exact message\n\' " $()`\nEOF'
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok":true}'
        with patch.dict(os.environ, SLACK_TOKEN='test-placeholder'), patch('urllib.request.urlopen', return_value=response) as post:
            stages.notify({'slack_channel_id': 'C123', 'slack_text': text})
        self.assertEqual(json.loads(post.call_args.args[0].data), {'channel': 'C123', 'text': text})

    def test_report_mode_never_runs_git_or_github(self):
        with patch.object(stages, 'git') as git, patch.object(stages.subprocess, 'check_output') as command, patch.object(stages, 'output') as output:
            stages.publish_skills({'publish_mode': 'report'})
        git.assert_not_called()
        command.assert_not_called()
        self.assertIn('No changes', output.call_args.kwargs['summary'])

    def test_staged_files_outside_allowlist_are_rejected(self):
        # Use a real Git index: staged files can be invisible to unstaged diff checks.
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp) / 'skills'
            repo.mkdir()
            subprocess.run(['git', 'init', '-q', str(repo)], check=True)
            (repo / 'outside.md').write_text('unauthorized edit')
            subprocess.run(['git', '-C', str(repo), 'add', 'outside.md'], check=True)
            real_path = stages.Path
            def local_path(value):
                return repo if value == '/workspace/skills' else real_path(value)
            with patch.dict(os.environ, ISLO_LINE_RUN_ID=RUN_ID), patch.object(stages, 'Path', side_effect=local_path), self.assertRaisesRegex(RuntimeError, 'outside skills_globs'):
                stages.publish_skills({'publish_mode': 'pr', 'skills_globs': 'skills/**', 'branch_prefix': 'factory/skills-refresh'})

    def test_publication_retry_keeps_commit_and_existing_pr(self):
        # Git really commits and pushes to a local bare remote; only GitHub is stubbed.
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            repo, remote = base / 'skills', base / 'remote.git'
            subprocess.run(['git', 'init', '-q', '--bare', str(remote)], check=True)
            subprocess.run(['git', 'clone', '-q', str(remote), str(repo)], check=True, capture_output=True)
            stages.git(repo, 'config', 'user.name', 'Fixture')
            stages.git(repo, 'config', 'user.email', 'fixture@example.com')
            (repo / 'skills').mkdir()
            (repo / 'skills/guide.md').write_text('old guidance')
            stages.git(repo, 'add', '.')
            stages.git(repo, 'commit', '-qm', 'fixture')
            stages.git(repo, 'push', '-q', 'origin', 'HEAD')
            (repo / 'skills/guide.md').write_text('updated guidance')
            params = {
                'publish_mode': 'pr', 'skills_globs': 'skills/**',
                'branch_prefix': 'factory/skills-refresh', 'commit_message': 'docs: update guidance',
                'skills_repo': 'your-org/skills', 'since': '7 days ago',
            }
            real_path, real_command = stages.Path, subprocess.check_output
            def local_path(value):
                if value == '/workspace/skills':
                    return repo
                if value == '/workspace/skills-refresh-pr.md':
                    return base / 'pr.md'
                return real_path(value)
            prs = []
            def command(args, **kwargs):
                if args[:3] == ['gh', 'pr', 'list']:
                    return json.dumps(prs)
                if args[:3] == ['gh', 'pr', 'create']:
                    prs.append({'url': 'https://github.com/your-org/skills/pull/1'})
                    return prs[0]['url']
                return real_command(args, **kwargs)
            with patch.dict(os.environ, ISLO_LINE_RUN_ID=RUN_ID), patch.object(
                stages, 'Path', side_effect=local_path
            ), patch.object(stages.subprocess, 'check_output', side_effect=command), patch.object(stages, 'output') as output:
                stages.publish_skills(params)
                commit = stages.git(repo, 'rev-parse', 'HEAD')
                stages.publish_skills(params)
                self.assertEqual(stages.git(repo, 'rev-parse', 'HEAD'), commit)
                self.assertEqual(len(prs), 1)
                self.assertEqual(output.call_args_list[0], output.call_args_list[1])
                self.assertEqual(stages.git(remote, 'rev-parse', f'refs/heads/factory/skills-refresh/{RUN_ID}'), commit)

    def test_invalid_publish_mode_is_rejected(self):
        with self.assertRaises(ValueError):
            stages.publish_skills({'publish_mode': 'typo'})


if __name__ == '__main__':
    unittest.main()
