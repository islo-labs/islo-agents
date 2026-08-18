#!/usr/bin/env bash
set -euo pipefail

cd /workspace/skills

gh auth setup-git
git config user.email "$GIT_COMMITTER_EMAIL"
git config user.name "$GIT_COMMITTER_NAME"

if git diff --cached --quiet && git diff --quiet; then
  echo "No changes to publish"
  echo "NO_CHANGES" > /workspace/publish-result.txt
  exit 0
fi

BRANCH="${BRANCH_PREFIX}/$(date -u +%Y-%m-%d-%H%M%S)"
git checkout -b "$BRANCH"
git add plugins/ README.md 2>/dev/null || git add -A
git commit -m "chore: weekly skills refresh from stack changes"

if [ "$PUBLISH_MODE" = "commit" ]; then
  git push origin HEAD:main
  URL="https://github.com/$SKILLS_REPO/commit/$(git rev-parse HEAD)"
elif [ "$PUBLISH_MODE" = "pr" ]; then
  git push origin "$BRANCH"
  URL=$(gh pr create --repo "$SKILLS_REPO" --title "Weekly skills refresh $(date -u +%Y-%m-%d)" --body "Automated refresh from stack changes over $SINCE." --head "$BRANCH")
else
  URL="report-only"
fi

echo "$URL" > /workspace/publish-result.txt
