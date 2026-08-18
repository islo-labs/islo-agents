#!/usr/bin/env bash
# Bake red-team-cli harness into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/red-team-cli/harness /opt/red-team-cli/prompts
sudo rsync -a "${ROOT}/snapshot-src/harness/" /opt/red-team-cli/harness/
sudo rsync -a "${ROOT}/snapshot-src/prompts/" /opt/red-team-cli/prompts/

sudo mkdir -p /workspace/black-box/transcripts
sudo cp "${ROOT}/snapshot-src/prompts/shared-output-contract.md" /workspace/red-team-contract.md

test -f /opt/red-team-cli/harness/prepare.py
test -f /opt/red-team-cli/prompts/shared-output-contract.md
echo "red-team-cli harness installed at /opt/red-team-cli"
echo "For white-box stages, bake /workspace/islo-cli/ before capturing the snapshot."
