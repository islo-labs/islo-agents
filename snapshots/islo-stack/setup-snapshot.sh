#!/usr/bin/env bash
# Bake islo-stack harness scripts into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/red-team-harness/scripts /opt/red-team-harness/prompts
sudo mkdir -p /opt/skills-refresh-harness/scripts /opt/skills-refresh-harness/prompts

sudo rsync -a "${ROOT}/snapshot-src/red-team/scripts/" /opt/red-team-harness/scripts/
sudo rsync -a "${ROOT}/snapshot-src/red-team/prompts/" /opt/red-team-harness/prompts/
sudo rsync -a "${ROOT}/snapshot-src/skills-refresh/scripts/" /opt/skills-refresh-harness/scripts/
sudo rsync -a "${ROOT}/snapshot-src/skills-refresh/prompts/" /opt/skills-refresh-harness/prompts/

sudo chmod +x /opt/red-team-harness/scripts/*.sh /opt/skills-refresh-harness/scripts/*.sh 2>/dev/null || true

echo "islo-stack harness installed:"
echo "  /opt/red-team-harness"
echo "  /opt/skills-refresh-harness"
echo "Bake product git checkouts under /workspace/ separately before capturing the snapshot."
