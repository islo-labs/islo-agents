#!/usr/bin/env bash
# Bake red-team-cli harness into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/red-team-harness/harness /opt/red-team-harness/prompts
sudo rsync -a "${ROOT}/snapshot-src/harness/" /opt/red-team-harness/harness/
sudo rsync -a "${ROOT}/snapshot-src/prompts/" /opt/red-team-harness/prompts/

echo "red-team-cli harness installed at /opt/red-team-harness"
echo "For white-box stages, bake /workspace/islo-cli/ before capturing the snapshot."
