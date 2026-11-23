#!/bin/bash
# One scheduled tick: run from launchd (macOS) or cron. Commits internal changes to main.
# Logs to .backoffice/tick.log in the checkout this script lives in.
set -u
cd "$(dirname "$0")/.." || exit 1
# launchd starts jobs with a minimal PATH: add the usual install locations for node and claude.
export PATH="$HOME/.local/bin:$HOME/.claude/local:/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:/usr/bin:/bin:$PATH"
# Optional secrets for demand collection (e.g. REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET), never in the repo.
if [ -f "$HOME/.config/yourcoffeesetup/env" ]; then set -a; . "$HOME/.config/yourcoffeesetup/env"; set +a; fi
mkdir -p .backoffice
{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) tick ==="
  node engine/scheduler/tick.mjs --commit "$@"
  echo "=== exit $? ==="
} >> .backoffice/tick.log 2>&1
