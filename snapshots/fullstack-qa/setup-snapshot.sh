#!/usr/bin/env bash
# Bake fullstack-qa harness into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="${ROOT}/snapshot-src"

sudo mkdir -p /opt/qa-harness/harness /opt/qa-harness/prompts /workspace/qa-harness
sudo rsync -a "${SRC}/harness/" /opt/qa-harness/harness/
sudo rsync -a "${SRC}/prompts/" /opt/qa-harness/prompts/
sudo rsync -a "${SRC}/workspace/islo-qa/" /workspace/qa-harness/
sudo mkdir -p /workspace/qa-harness/findings/videos /workspace/qa-harness/findings/transcripts /workspace/qa-harness/.auth

cd /workspace/qa-harness
npm install
npx playwright install chromium

echo "fullstack-qa harness installed at /opt/qa-harness and /workspace/qa-harness"
