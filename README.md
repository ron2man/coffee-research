# Coffee research

An autonomous research and content system: it finds what coffee lovers struggle with, researches it, and writes guides a person would send to a friend. The site is [yourcoffeesetup.com](https://yourcoffeesetup.com).

- [rebuild-spec.md](rebuild-spec.md): what the system is and why (principles, agents, data contracts, milestones).
- [CLAUDE.md](CLAUDE.md): repo layout, commands and working rules.
- [docs/operations.md](docs/operations.md): running it unattended, the dashboard, publishing, the feedback loop.
- [docs/learnings.md](docs/learnings.md): what we tried, what we saw, decisions and open questions.
- [knowledge/README.md](knowledge/README.md): the evidence layer (product cards).

```sh
npm install
npm test
npm run validate
npm run dashboard            # http://127.0.0.1:4173
npm run site:preview         # http://127.0.0.1:4321
npm run tick -- --dry-run    # what the scheduler would run next
```

The legacy Codex editorial pipeline (`agent/`) was removed on 2026-11-23; it is in Git history. Its drafts and commissioning decisions are in `content/archive/`.
