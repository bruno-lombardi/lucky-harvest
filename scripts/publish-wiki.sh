#!/usr/bin/env bash
# Mirrors docs/ to the GitHub Wiki of this repo, so the wiki and the in-repo docs never drift.
# One-time setup: on GitHub, open the repo's Wiki tab and save any first page (this creates the wiki repository).
# Then run:  bash scripts/publish-wiki.sh
set -euo pipefail
REPO_URL="$(git config --get remote.origin.url)"
WIKI_URL="${REPO_URL%.git}.wiki.git"
TMP="$(mktemp -d)"
git clone "$WIKI_URL" "$TMP"
find "$TMP" -maxdepth 1 -name '*.md' -delete
cp docs/*.md "$TMP"/
cd "$TMP"
git add -A
if git diff --cached --quiet; then echo "Wiki already up to date."; exit 0; fi
git commit -m "Sync wiki from docs/"
git push
echo "Wiki updated."
