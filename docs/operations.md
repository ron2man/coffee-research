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

## Demand data (Reddit, autocomplete)

Before the idea agent runs, the scheduler collects demand data without AI: search-autocomplete suggestions per market for the focus products and your English seeds, and posts from the niche's subreddits (`niche.json` `demand`). It's saved in `data/demand/` and given to the idea agent.

Reddit is the hard one. Since November 2025 Reddit's Data API needs a manual approval under its Responsible Builder Policy (self-service app keys were closed), and since May 2026 its public JSON returns 403, which is what our runs see. The route that respects Reddit's rules:

1. Read the Responsible Builder Policy (Reddit Help Center) and file a Data API access request through Reddit's developer support form: a small, non-commercial-scale research use (reading public posts in r/espresso and r/Coffee to find common owner questions; low volume; no redistribution of content; links back to threads).
2. If approved, create a "script" app at https://www.reddit.com/prefs/apps (redirect URI `http://localhost`) and put its ID and secret in `~/.config/yourcoffeesetup/env` on the scheduler's Mac (never in the repo):

```sh
mkdir -p ~/.config/yourcoffeesetup
cat >> ~/.config/yourcoffeesetup/env <<'END'
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
END
chmod 600 ~/.config/yourcoffeesetup/env
```

Approval is uncertain and small projects are often refused. Until then the scheduler records Reddit as blocked (`sources` in `data/demand/*.json`, and the run traces in the dashboard), and the other sources carry the load.

## Costs

Each real run reports its usage in `.backoffice/runs.jsonl` (`usage.costUsd` is the CLI's estimate at API prices, not your subscription bill). One idea run took about 4 minutes and 44 turns. Hourly ticks mean up to 24 agent runs a day when there is work; when nothing is due a tick does nothing and uses no usage.

## Linux or cloud later

Run `ops/tick.sh` from cron in a dedicated clone, for example `0 * * * * /path/to/clone/ops/tick.sh`. The lock file and the committed schedule state (`data/scheduler/state.json`) make the move safe.
