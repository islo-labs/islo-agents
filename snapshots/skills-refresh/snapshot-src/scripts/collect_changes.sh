#!/usr/bin/env bash
set -euo pipefail
export SINCE_ISO
SINCE_ISO=$(date -u -d "$SINCE" +%Y-%m-%dT%H:%M:%SZ)
echo "Collecting local stack changes since $SINCE_ISO"
python3 /opt/skills-refresh-harness/scripts/collect_stack_changes.py
