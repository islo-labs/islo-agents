#!/usr/bin/env bash
# Bake red-team-cli harness into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/red-team-harness/scripts /opt/red-team-harness/prompts
sudo rsync -a "${ROOT}/snapshot-src/scripts/" /opt/red-team-harness/scripts/
sudo rsync -a "${ROOT}/snapshot-src/prompts/" /opt/red-team-harness/prompts/
sudo chmod +x /opt/red-team-harness/scripts/*.sh 2>/dev/null || true

echo "red-team-cli harness installed at /opt/red-team-harness"
echo "For white-box stages, also bake /workspace/islo-cli/ (git checkout) before capturing the snapshot."
