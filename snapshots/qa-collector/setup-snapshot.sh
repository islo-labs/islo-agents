#!/usr/bin/env bash
# Bake qa-collector harness into a snapshot VM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

sudo mkdir -p /opt/qa-harness/agent
sudo rsync -a "${ROOT}/snapshot-src/agent/" /opt/qa-harness/agent/

echo "qa-collector harness installed at /opt/qa-harness/agent"
