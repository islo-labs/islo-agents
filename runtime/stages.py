#!/usr/bin/env python3
"""Deterministic script Agent stages. Stage inputs stay data, never shell text."""

from __future__ import annotations

import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tomllib
from urllib.parse import urlencode
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]


def stage_params(example: str, stage: str) -> dict:
    """Read resolved inputs from this Line Run's newest visit to this stage."""
    run_id = str(UUID(os.environ['ISLO_LINE_RUN_ID']))
    sequence = 0
    latest = None
    while True:
        query = urlencode({'limit': 200, 'after_sequence': sequence})
        response = subprocess.check_output(
            ['islo', 'api', f'/factory/line-runs/{run_id}/events?{query}', '-o', 'json'],
            text=True,
        )
        events = json.loads(response)['items']
        if not events:
            break
        for event in events:
            sequence = max(sequence, event['sequence'])
            payload = event.get('payload', {})
            if event['event_type'] == 'stage_started' and payload.get('stage_name') == stage:
                latest = payload['input_payload']['params']
        if len(events) < 200:
            break
    if latest is None:
        raise RuntimeError(f'No stage_started inputs for {stage}')
    line = tomllib.loads((ROOT / 'examples' / example / 'line.toml').read_text())
    contract = next(s for s in line['stages'] if s['id'] == stage).get('params', {})
    defaults = {k: v['default'] for k, v in contract.items() if 'default' in v}
    return defaults | latest


def output(**values) -> None:
    with open(os.environ['ISLO_OUTPUT'], 'w') as stream:
        for key, value in values.items():
            # String outputs use JSON escaping so multiline text stays one record.
            stream.write(f'{key}={json.dumps(value, separators=(",", ":"))}\n')


def notify(params: dict) -> None:
    import urllib.request

    channel, text = params['slack_channel_id'], params['slack_text']
    if not channel.strip() or not text.strip():
        raise ValueError('slack_channel_id and slack_text must be nonempty')
    token = os.environ.get('SLACK_TOKEN') or os.environ.get('SLACK_BOT_TOKEN')
    if not token:
        raise RuntimeError('Connect Slack before running the notification Agent')
    request = urllib.request.Request(
        'https://slack.com/api/chat.postMessage',
        data=json.dumps({'channel': channel, 'text': text}).encode(),
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if not result.get('ok'):
        raise RuntimeError(f'Slack notification failed: {result.get("error")}')


def qa_report(stage: str, params: dict) -> None:
    brief = stage.removesuffix('-report')
    key = brief.replace('-', '_') + '_report_json'
    os.environ.update(
        QA_AGENT_ID=f'qa-agent-{brief}', QA_BRIEF_LABEL=brief,
        QA_BASE_URL=params['qa_base_url'], ISLO_BASE_URL=params['qa_base_url'],
        QA_RUN_ID=os.environ['ISLO_LINE_RUN_ID'], QA_OUTPUT_KEY=key,
    )
    harness = ROOT / 'examples/qa/machines/qa/files/harness'
    # stage.py publishes a validated report, including a missing-report fallback.
    namespace = runpy.run_path(str(harness / 'stage.py'))
    namespace['main']()
    emit = runpy.run_path(str(harness / 'emit_report.py'))
    if emit['main']() != 0:
        raise RuntimeError('Could not emit QA report')


def collect(params: dict) -> None:
    upstream = Path('/workspace/upstream')
    upstream.mkdir(parents=True, exist_ok=True)
    for brief in ('web-core', 'web-platform', 'cli-cross'):
        value = params.get(brief.replace('-', '_') + '_report_json', '')
        if value:
            json.loads(value)
        (upstream / f'{brief}.json').write_text(value)
    os.environ.update(LOOKBACK_HOURS='6', MAX_ISSUES='8')
    script = ROOT / 'examples/qa/machines/qa-report/files/agent/collect_and_post.py'
    namespace = runpy.run_path(str(script))
    result = namespace['main']()
    if result not in (None, 0):
        raise RuntimeError('QA collection failed')


def git(path: Path, *args: str) -> str:
    return subprocess.check_output(['git', '-C', str(path), *args], text=True).strip()


def prepare_skills(params: dict) -> None:
    workspace = Path('/workspace')
    skills = workspace / 'skills'
    if not (skills / '.git').is_dir():
        if skills.exists():
            raise RuntimeError('/workspace/skills exists without a Git checkout')
        subprocess.run(['gh', 'repo', 'clone', params['skills_repo'], str(skills)], check=True)
    git(skills, 'fetch', 'origin')
    branch = git(skills, 'symbolic-ref', 'refs/remotes/origin/HEAD').removeprefix('refs/remotes/origin/')
    if git(skills, 'status', '--porcelain'):
        raise RuntimeError('Skills checkout has uncommitted changes; inspect before retrying prepare')
    git(skills, 'checkout', branch)
    git(skills, 'pull', '--ff-only', 'origin', branch)
    repos = []
    for root in sorted(workspace.iterdir()):
        if root.name in ('skills', 'islo-agents') or not (root / '.git').exists():
            continue
        commits = git(root, 'log', f'--since={params["since"]}', '--format=%H%x09%s%x09%an%x09%aI', '-n', '100')
        if commits:
            repos.append({'repo': root.name, 'path': str(root), 'commits': [
                dict(zip(('sha', 'message', 'author', 'date'), row.split('\t', 3)))
                for row in commits.splitlines()
            ]})
    (workspace / 'changes.json').write_text(json.dumps({'since': params['since'], 'repos': repos}, indent=2))


def publish_skills(params: dict) -> None:
    skills = Path('/workspace/skills')
    mode = params['publish_mode']
    if mode not in ('pr', 'commit', 'report'):
        raise ValueError('publish_mode must be pr, commit, or report')
    if mode == 'report':
        output(summary='Report only. No changes were committed or pushed.')
        return
    branch = f'{params["branch_prefix"]}/{os.environ["ISLO_LINE_RUN_ID"]}'
    git(skills, 'check-ref-format', '--branch', branch)
    changed = git(skills, 'status', '--porcelain')
    if not changed and git(skills, 'branch', '--show-current') != branch:
        output(summary='No changes to publish.')
        return
    if changed:
        allowed = params['skills_globs'].split()
        if not allowed or any(path.startswith(('-', '/', ':')) or '..' in Path(path).parts for path in allowed):
            raise ValueError('skills_globs must contain relative Git globs')
        import fnmatch
        paths = []
        for args in (
            ('diff', '--name-only', '-z'),
            ('diff', '--cached', '--name-only', '-z'),
            ('ls-files', '--others', '--exclude-standard', '-z'),
        ):
            paths.extend(subprocess.check_output(['git', '-C', str(skills), *args]).decode().split('\0'))
        if any(path and not any(fnmatch.fnmatchcase(path, pattern) for pattern in allowed) for path in paths):
            raise RuntimeError('Edits outside skills_globs; refusing to publish')
        git(skills, 'checkout', '-B', branch)
        git(skills, 'config', 'user.name', 'Factory Agent')
        git(skills, 'config', 'user.email', 'factory-agent@users.noreply.github.com')
        git(skills, 'add', '--', *allowed)
        git(skills, 'commit', '-m', params['commit_message'])
    if mode == 'commit':
        default = git(skills, 'symbolic-ref', 'refs/remotes/origin/HEAD').removeprefix('refs/remotes/origin/')
        git(skills, 'push', 'origin', f'HEAD:{default}')
        url = f'https://github.com/{params["skills_repo"]}/commit/{git(skills, "rev-parse", "HEAD")}'
    else:
        git(skills, 'push', '-u', 'origin', branch)
        existing = json.loads(subprocess.check_output([
            'gh', 'pr', 'list', '--repo', params['skills_repo'], '--head', branch,
            '--state', 'all', '--json', 'url',
        ], text=True))
        if existing:
            url = existing[0]['url']
        else:
            body = Path('/workspace/skills-refresh-pr.md')
            body.write_text(f'Updates agent guidance from product changes over {params["since"]}.\n')
            url = subprocess.check_output(['gh', 'pr', 'create', '--repo', params['skills_repo'], '--head', branch,
                '--title', 'chore: refresh agent skills', '--body-file', str(body)], text=True).strip()
    output(summary=f'Published skills refresh: {url}')


def main() -> None:
    example, stage = sys.argv[1:]
    params = stage_params(example, stage)
    if stage == 'slack-notify':
        notify(params)
    elif example == 'qa':
        if stage == 'collect':
            collect(params)
        else:
            qa_report(stage, params)
    elif example == 'weekly-skills-refresh':
        if stage == 'prepare':
            prepare_skills(params)
        elif stage == 'publish':
            publish_skills(params)
        else:
            raise ValueError(stage)
    else:
        raise ValueError((example, stage))


if __name__ == '__main__':
    main()
