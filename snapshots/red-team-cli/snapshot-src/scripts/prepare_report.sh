#!/usr/bin/env bash
set -euo pipefail

/opt/red-team-harness/scripts/prepare_islo_cli.sh
mkdir -p /workspace/upstream
printf '%s' "${TRUST_BOUNDARIES_REPORT_JSON:-}" > /workspace/upstream/trust-boundaries.json
printf '%s' "${INPUT_ABUSE_REPORT_JSON:-}" > /workspace/upstream/input-abuse.json
printf '%s' "${BLACK_BOX_REPORT_JSON:-}" > /workspace/upstream/black-box.json
echo "Prepared islo-cli with upstream reports (linear_mode=${LINEAR_MODE:-report})"
