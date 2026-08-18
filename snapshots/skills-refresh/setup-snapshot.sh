#!/usr/bin/env bash
# Bake skills-refresh harness into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/skills-refresh-harness/scripts /opt/skills-refresh-harness/prompts
sudo rsync -a "${ROOT}/snapshot-src/scripts/" /opt/skills-refresh-harness/scripts/
sudo rsync -a "${ROOT}/snapshot-src/prompts/" /opt/skills-refresh-harness/prompts/
sudo chmod +x /opt/skills-refresh-harness/scripts/*.sh 2>/dev/null || true

echo "skills-refresh harness installed at /opt/skills-refresh-harness"
echo "Bake product git checkouts under /workspace/ before capturing the snapshot."
