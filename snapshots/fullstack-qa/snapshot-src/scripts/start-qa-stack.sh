#!/usr/bin/env bash
# Boot the islo-fullstack local environment for QA agents.
set -euo pipefail

HARNESS_DIR="${HARNESS_DIR:-/workspace/qa-harness}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
ISLO_BASE_URL="${ISLO_BASE_URL:-http://localhost:${FRONTEND_PORT}}"

if [ ! -f "${HARNESS_DIR}/package.json" ]; then
  echo "ERROR: Playwright harness missing at ${HARNESS_DIR}"
  exit 1
fi

echo "==> Installing Playwright harness dependencies"
cd "${HARNESS_DIR}"
npm ci --prefer-offline --no-audit 2>/dev/null || npm install
npx playwright install chromium
mkdir -p findings/videos findings/transcripts .auth

echo "==> Starting fullstack services"
/workspace/islo-devops/scripts/fullstack/launch.sh "$@"

if [ -f /workspace/.fullstack-env ]; then
  # shellcheck disable=SC1091
  source /workspace/.fullstack-env
fi

# fullstack-env points ISLO_BASE_URL at web-api (:8000); Playwright targets the frontend.
export ISLO_BASE_URL="http://localhost:${FRONTEND_PORT}"
export ISLO_QA_EMAIL="${ISLO_QA_EMAIL:-${FULLSTACK_USER_EMAIL:-fullstack@islo.local}}"
export ISLO_QA_OTP="${ISLO_QA_OTP:-${FULLSTACK_OTP_CODE:-246810}}"

echo "==> Waiting for frontend at ${ISLO_BASE_URL}"
for _ in $(seq 1 90); do
  if curl -sf "${ISLO_BASE_URL}/" >/dev/null 2>&1; then
    echo "stack ready: ${ISLO_BASE_URL} (user ${ISLO_QA_EMAIL})"
    exit 0
  fi
  sleep 2
done

echo "ERROR: frontend did not become ready at ${ISLO_BASE_URL}"
tail -30 /tmp/islo-logs/frontend.log 2>/dev/null || true
exit 1
