#!/usr/bin/env bash
set -euo pipefail

cd /workspace
CLI_DIR=""
for gitdir in $(find /workspace -maxdepth 5 -type d -name .git 2>/dev/null | sort); do
  root=$(dirname "$gitdir")
  if [ "$(basename "$root")" = "islo-cli" ]; then
    CLI_DIR="$root"
    break
  fi
done
if [ -z "$CLI_DIR" ]; then
  echo "ERROR: islo-cli not found in islo-stack snapshot" >&2
  exit 1
fi
cd "$CLI_DIR"
git fetch --quiet origin
BRANCH=$(git remote show origin | awk '/HEAD branch/ {print $NF}')
git checkout -q "$BRANCH" 2>/dev/null || git checkout -q main || git checkout -q master
git pull --ff-only origin "$BRANCH" 2>/dev/null || true
echo "$CLI_DIR" > /workspace/islo-cli-path.txt
git rev-parse HEAD > /workspace/islo-cli-commit.txt
echo "Prepared islo-cli at $CLI_DIR ($(cat /workspace/islo-cli-commit.txt))"
