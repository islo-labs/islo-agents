#!/usr/bin/env bash
set -euo pipefail

mkdir -p /workspace/black-box/transcripts
/opt/red-team-harness/scripts/install_contract.sh

cat > /workspace/black-box-run.txt <<EOF
run_id=${RED_TEAM_RUN_ID}
prefix=redteam-${RED_TEAM_RUN_ID}-
target=${ISLO_BASE_URL:-https://app.islo.dev}
EOF

if [ -z "${ISLO_API_KEY:-}" ]; then
  echo "ERROR: ISLO_API_KEY missing in sandbox env — add ISLO_API_KEY as a sandbox secret in your Factory environment" >&2
  exit 1
fi

islo status -o json > /tmp/islo-status.json 2>/dev/null || true
python3 /opt/red-team-harness/scripts/verify_islo_auth.py
echo "Black-box prep ok (prefix=redteam-${RED_TEAM_RUN_ID}-)"
