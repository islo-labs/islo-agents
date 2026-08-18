#!/usr/bin/env bash
set -euo pipefail

if [ ! -f /opt/qa-harness/agent/cleanup.py ]; then
  echo "ERROR: fullstack-qa snapshot is missing /opt/qa-harness — see lines/fullstack-qa-line/README.md" >&2
  exit 1
fi
if [ ! -f /workspace/qa-harness/package.json ]; then
  echo "ERROR: fullstack-qa snapshot is missing /workspace/qa-harness Playwright harness" >&2
  exit 1
fi
