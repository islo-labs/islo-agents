#!/usr/bin/env bash
# Bake skills-refresh harness into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/skills-refresh-harness/harness /opt/skills-refresh-harness/prompts
sudo rsync -a "${ROOT}/snapshot-src/harness/" /opt/skills-refresh-harness/harness/
sudo rsync -a "${ROOT}/snapshot-src/prompts/" /opt/skills-refresh-harness/prompts/

echo "skills-refresh harness installed at /opt/skills-refresh-harness"
echo "Bake product git checkouts under /workspace/ before capturing the snapshot."
