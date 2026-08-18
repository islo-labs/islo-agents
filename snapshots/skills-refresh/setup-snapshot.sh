#!/usr/bin/env bash
# Bake skills-refresh prompt into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/skills-refresh/prompts
sudo rsync -a "${ROOT}/snapshot-src/prompts/" /opt/skills-refresh/prompts/

test -f /opt/skills-refresh/prompts/analyze-and-update.md
echo "skills-refresh prompt installed at /opt/skills-refresh/prompts"
