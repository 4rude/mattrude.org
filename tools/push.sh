#!/usr/bin/env bash
# push.sh: push main to GitHub after the checks pass. Cloudflare Pages
# deploys whatever lands on main.
#
#   tools/push.sh
#
# 1. Stops if you're not on main or have uncommitted changes.
# 2. Runs the build and every check (tools/check.js).
# 3. Shows the commits that will go out and asks before pushing.
#
# It never force-pushes. Agents: ask Matt before running this.

set -euo pipefail
cd "$(dirname "$0")/.."

branch=$(git branch --show-current)
if [ "$branch" != "main" ]; then
  echo "You're on '$branch'. Switch to main first."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "There are uncommitted changes. Commit or discard them first:"
  git status --short
  exit 1
fi

if ! node tools/check.js; then
  echo
  echo "Not pushed. Fix the problems above first."
  exit 1
fi

git fetch --quiet origin
ahead=$(git rev-list --count origin/main..HEAD)
behind=$(git rev-list --count HEAD..origin/main)

if [ "$behind" -gt 0 ]; then
  echo
  echo "GitHub has $behind commit(s) you don't have. Not pushing."
  echo "Pull first (git pull --rebase), or ask Claude to sort it out."
  exit 1
fi

if [ "$ahead" -eq 0 ]; then
  echo
  echo "Nothing to push. GitHub already has everything."
  exit 0
fi

echo
echo "These $ahead commit(s) will be pushed to GitHub and go live on mattrude.org:"
git log --oneline origin/main..HEAD
echo
read -r -p "Push now? [y/N] " answer
if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
  echo "Not pushed."
  exit 0
fi

git push origin main
echo "Pushed. Cloudflare Pages will deploy in a minute or two."
