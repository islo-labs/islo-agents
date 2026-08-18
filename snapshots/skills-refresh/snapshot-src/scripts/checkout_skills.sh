#!/usr/bin/env bash
set -euo pipefail

mkdir -p /workspace
cd /workspace
if [ ! -d skills/.git ]; then
  rm -rf skills
  gh repo clone "$SKILLS_REPO" skills
else
  cd skills
  git checkout main || git checkout master
  git pull --ff-only
fi
