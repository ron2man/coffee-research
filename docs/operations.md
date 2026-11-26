# Operations: running the system unattended

The scheduler runs one tick at a time. Each tick runs one agent (or the critic or tuner), validates its output, and commits internal files to `main`. Reader-facing paths (`content/published/`, `site/`, `data/offers/`) are never committed by a tick.

## One-time setup on the Mac

The scheduler gets **its own clone** on `main`. Your working copy stays yours: the tick fails a run if files change underneath it, so the two must not share a folder.

```sh
# 1. Claude CLI, signed in with the subscription (not an API key)
claude auth status            # authMethod must be "claude.ai"

# 2. A dedicated clone for the scheduler
git clone git@github.com:ron2man/coffee-research.git ~/Projects/coffee-research-bot
cd ~/Projects/coffee-research-bot
npm install
npm test

# 3. Check git can push without a prompt (launchd has no terminal)
git push --dry-run origin main

# 4. Install the hourly job
npm run schedule -- install            # or --interval-minutes 120
npm run schedule -- run-now            # one tick now, through launchd
npm run schedule -- logs               # what happened
npm run schedule -- status
```

If step 3 asks for a passphrase, add the key to the macOS keychain (`ssh-add --apple-use-keychain ~/.ssh/id_ed25519`) and put `UseKeychain yes` and `AddKeysToAgent yes` under `Host github.com` in `~/.ssh/config`.

The Mac must be awake. launchd runs a missed interval when the Mac wakes. To pause: `npm run schedule -- uninstall`.

## The dashboard

```sh
npm run dashboard        # http://127.0.0.1:4173
```

It finds the scheduler's clone next to your working copy and reads the live state from there. From it you can open each article (rendered, with the judge's scores and fixes, checks and history), add a comment for the writer, send a passed article back to the writer, resume or reject stuck items, apply or reject prompt proposals, and add topic seeds. Every action goes through the status machine, waits if a tick is running, and is committed and pushed to `main` from the scheduler's clone. Set `BACKOFFICE_NO_COMMIT=1` to act without committing.

## Publishing

**Auto-publishing with a veto window** (`niches/coffee/niche.json` `publishing`, decision 2026-11-24): with the GitHub CLI signed in (`gh auth status`), each tick queues every passed article that nothing blocks, pushes `publish/<slug>` and opens its pull request. The PR merges itself after 24 hours if its checks are green, unless it has the `hold` label (the dashboard's **Hold publishing** button adds it) or was closed. Merged posts go live through Cloudflare, and the next tick marks them `published`. Set `autoMerge` to false to go back to merging by hand.

A passed article also has an **Approve for publishing** button in the dashboard. It pushes branch `publish/<slug>` with `content/published/<slug>.md` (and its claims file) on top of `main`, without touching either checkout, and opens the pull request with the GitHub CLI if `gh` is installed and signed in (otherwise the dashboard links to GitHub's "open a pull request" page). The GitHub checks run on the PR; merging it publishes the guide (Cloudflare deploys `main`), and the next tick marks the item `published`.

The button stays disabled while something blocks publishing: the draft fails today's writer checks, or `niches/coffee/niche.json` has no disclosure text for a market (the live site refuses to build without it; add it once each market's affiliate terms are checked).

## Your daily loop (in your own working copy)

```sh
git pull
npm run item -- list                       # where every item is
npm run feedback -- list                   # open feedback per agent
npm run prompt -- list                     # prompt proposals waiting for you
npm run prompt -- show <id>                # summary + diff
npm run prompt -- apply <id> --commit      # or: reject <id> --reason "..." --commit
npm run feedback -- add writer "Openings still bury the recommendation" --commit
npm run seed -- add "I have a capsule machine and want better coffee. Where do I start?" --commit
npm run item -- resume <id> --reason "..." --commit
```

`--commit` pushes the change to `main`; the scheduler picks it up at its next tick.

## The feedback loop

1. **Checks** (code, every run): evidence and honesty rules (thin or reused demand signals, unsupported claim IDs, more than 2 inline links, "we tested" without human data). Blocking checks fail the run; warnings become feedback entries.
2. **Critic** (agent): when an agent has 3 new outputs (or one waiting 24h), the critic reviews them against that agent's prompt, spot-checks sources, and records findings in `data/feedback/<agent>/`.
3. **Tuner** (agent): when an agent has at least 2 open feedback entries (or any human note) and no open proposal, it proposes a prompt change in `data/prompt-proposals/`. Shared prompts stay niche-agnostic; niche advice goes to `niches/<niche>/agents/<agent>.md`.
4. **You** apply or reject the proposal. Applied proposals close the feedback they address; rejected ones are shown to the tuner next time.

## Pace and budget

The target is one guide a day: about 6 agent runs per guide (research, angle, toolsmith when a tool is needed, writer, post judge, plus a share of idea and judge runs).

- Install the job every 20 minutes while you're working toward that pace: `npm run schedule -- install --interval-minutes 20`. A tick with nothing due uses nothing.
- **Daily budget:** a tick doesn't start an agent once 12 agent runs happened in the last 24 hours (each is about 8% of a usage window). Change it with `TICK_MAX_RUNS_PER_DAY` in `~/.config/yourcoffeesetup/env`.
- The critic and tuner run only when the pipeline has nothing else to do; the idea agent runs when fewer than 4 ideas are waiting (seeds bring it forward).

## Demand data (autocomplete, community search, YouTube)

Before the idea agent runs, the scheduler collects demand data without AI and saves it in `data/demand/` (`niche.json` `demand`):

- **Search autocomplete** per market for the focus products and your English seeds. No key.
- **Community threads through web search** (`demand.webSearch.sites`: r/espresso, r/Coffee, Home-Barista, CoffeeGeek, Coffee Forums UK). A search API (Brave Search) is asked `<query> site:<site>`; we keep the result's title, URL, date and snippet and never open the site itself. Queries rotate daily across product × site pairs, at most `maxQueries` per run and `monthlyMax` per month (counted from earlier `data/demand/` files). Brave charges about $5 per 1,000 searches and gives $5 of credit a month (a card is required), so the default 900 a month stays inside the credit.
- **YouTube**: videos for the focus products and the question-like comments under them (YouTube Data API, free quota of 10,000 units a day; one run uses about 300).

Reddit itself is closed to us: its Data API needs approval and stopped taking new requests on 2026-10-31, the public JSON returns 403, RSS ended on 2026-11-13, and the remaining public API ends in March 2027. Search results that point at Reddit threads are the route that's left, plus your own seeds from the dashboard.

Keys live on the scheduler's Mac, never in the repo:

```sh
mkdir -p ~/.config/yourcoffeesetup
cat >> ~/.config/yourcoffeesetup/env <<'END'
BRAVE_SEARCH_API_KEY=...
YOUTUBE_API_KEY=...
END
chmod 600 ~/.config/yourcoffeesetup/env
```

- Brave: sign up at https://api-dashboard.search.brave.com, pick the Search plan, create a key. Set a spending limit of $5 in the dashboard so it can't bill beyond the free credit.
- YouTube: in Google Cloud Console create a project, enable "YouTube Data API v3", create an API key and restrict it to that API.

A missing key isn't an error: the source shows as `skipped` in `sources`, and the other sources carry the load.

## Costs

Each real run reports its usage in `.backoffice/runs.jsonl` (`usage.costUsd` is the CLI's estimate at API prices, not your subscription bill). One idea run took about 4 minutes and 44 turns. Hourly ticks mean up to 24 agent runs a day when there is work; when nothing is due a tick does nothing and uses no usage.

## Linux or cloud later

Run `ops/tick.sh` from cron in a dedicated clone, for example `0 * * * * /path/to/clone/ops/tick.sh`. The lock file and the committed schedule state (`data/scheduler/state.json`) make the move safe.
