#!/usr/bin/env python3
"""Validate example manifests against the current control-plane OpenAPI schema.

Run with: uv run --with jsonschema python scripts/validate_api_schemas.py
Use --openapi <file> to validate offline against a previously captured schema.
"""

import argparse
import json
from pathlib import Path
import subprocess
import tomllib

from jsonschema import Draft202012Validator


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--openapi', type=Path)
    args = parser.parse_args()
    schema = json.loads(args.openapi.read_text() if args.openapi else subprocess.check_output(
        ['islo', 'api', '/openapi.json', '-o', 'json'], text=True,
    ))
    root = Path(__file__).resolve().parents[1]
    paths = sorted((root / 'examples').glob('*/line.toml')) + sorted((root / 'examples').rglob('*agent.toml'))
    for path in paths:
        doc = tomllib.loads(path.read_text())
        name = 'LineManifest-Input' if path.name == 'line.toml' else {
            'prompt': 'PromptAgentCreate', 'script': 'ScriptAgentCreate',
        }[doc['type']]
        validator = Draft202012Validator({
            '$ref': f'#/components/schemas/{name}', 'components': schema['components'],
        })
        problems = list(validator.iter_errors(doc))
        if problems:
            raise SystemExit(f'{path.relative_to(root)}: ' + '; '.join(e.message for e in problems))
    print(f'API schemas: OK ({len(paths)} Line and Agent manifests)')


if __name__ == '__main__':
    main()
