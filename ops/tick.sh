#!/bin/bash
# One scheduled tick: run from launchd (macOS) or cron. Commits internal changes to main.
# Logs to .backoffice/tick.log in the checkout this script lives in.
set -u
SCRIPT="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$0")/.." || exit 1
# launchd starts jobs with a minimal PATH: add the usual install locations for node, claude and bws.
export PATH="$HOME/.local/bin:$HOME/.claude/local:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:/usr/bin:/bin:$PATH"
CONFIG="$HOME/.config/yourcoffeesetup"
# Secrets (search API keys, later affiliate IDs), never in the repo. Two sources:
#  - Bitwarden Secrets Manager: $CONFIG/bws holds BWS_ACCESS_TOKEN (a machine account's token) and
#    BWS_PROJECT_ID. `bws run` fetches the project's secrets and starts the tick with them as
#    environment variables (secret name = variable name, e.g. TAVILY_API_KEY). Nothing is stored.
#  - $CONFIG/env: KEY=value lines. Loaded first, so bws values win where both have a key, and the
#    tick still has these if Bitwarden can't be reached.
if [ -f "$CONFIG/env" ]; then set -a; . "$CONFIG/env"; set +a; fi
# Read without exporting: only bws itself gets the token, never the tick or the agents.
BWS_ACCESS_TOKEN="" BWS_PROJECT_ID=""
if [ -f "$CONFIG/bws" ]; then . "$CONFIG/bws"; fi
mkdir -p .backoffice
{
  # A restarted run (see the end) is marked, so it isn't counted as a second tick.
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) tick${TICK_SH_RELOADED:+ (restarted with the new ops/tick.sh)} ==="
  WRAP=()
  if [ -n "$BWS_ACCESS_TOKEN" ] && [ -n "$BWS_PROJECT_ID" ]; then
    if ! command -v bws >/dev/null 2>&1; then
      echo "secrets: bws not found on PATH; using $CONFIG/env only"
    elif BWS_ACCESS_TOKEN="$BWS_ACCESS_TOKEN" bws project get "$BWS_PROJECT_ID" >/dev/null 2>&1; then
      echo "secrets: Bitwarden project $BWS_PROJECT_ID"
      WRAP=(env "BWS_ACCESS_TOKEN=$BWS_ACCESS_TOKEN" bws run --project-id "$BWS_PROJECT_ID" --)
    else
      echo "secrets: Bitwarden not reachable or token refused; using $CONFIG/env only"
    fi
  fi
  # ${WRAP[@]+...}: an empty array is fine under set -u in macOS's bash 3.2 too.
  # Keep the Mac awake while the tick runs: a run that sleeps mid-way loses its network and times out.
  export TICK_SH=1
  if command -v caffeinate >/dev/null 2>&1; then
    caffeinate -is ${WRAP[@]+"${WRAP[@]}"} node engine/scheduler/tick.mjs --commit "$@"
  else
    ${WRAP[@]+"${WRAP[@]}"} node engine/scheduler/tick.mjs --commit "$@"
  fi
  STATUS=$?
  echo "=== exit $STATUS ==="
} >> .backoffice/tick.log 2>&1
# Exit 75: the tick's sync brought a new version of this script. Start again with it (once), so a
# change here takes effect in the same run rather than the next one.
if [ "$STATUS" = 75 ] && [ -z "${TICK_SH_RELOADED:-}" ]; then
  exec env TICK_SH_RELOADED=1 /bin/bash "$SCRIPT" "$@"
fi
exit "$STATUS"
