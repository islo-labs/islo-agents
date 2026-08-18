#!/usr/bin/env bash
set -euo pipefail

PREFIX="redteam-${RED_TEAM_RUN_ID}-"
LEFT=$(islo ls -o json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(sum(1 for s in d if str(s.get('name','')).startswith('${PREFIX}')))" 2>/dev/null || echo 0)
if [ "$LEFT" != "0" ]; then
  echo "WARNING: $LEFT sandbox(es) still match $PREFIX — agent should have cleaned up" >&2
fi
echo "cleanup-check done (remaining=$LEFT)"
