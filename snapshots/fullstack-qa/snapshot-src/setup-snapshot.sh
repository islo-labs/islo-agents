#!/usr/bin/env bash
# Build the islo-qa-baseline snapshot contents on a runner VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE="/workspace"

sudo mkdir -p "${WORKSPACE}"
sudo rsync -a "${ROOT}/workspace/islo-qa/" "${WORKSPACE}/islo-qa/"
sudo mkdir -p "${WORKSPACE}/islo-qa/findings/videos" "${WORKSPACE}/islo-qa/findings/transcripts" "${WORKSPACE}/islo-qa/.auth"

cd "${WORKSPACE}/islo-qa"
npm install
npx playwright install chromium

echo "Snapshot workspace ready at ${WORKSPACE}/islo-qa"
