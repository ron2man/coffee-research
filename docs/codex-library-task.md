# Task for Codex: build the manufacturer document library

You are filling a local library of **manufacturer documents** (instruction manuals, quick-start guides, spec sheets, support/how-to pages, parts pages, recall notices) for home espresso equipment, so this repo's research agents read them locally instead of searching the web. You only find the right official URLs and add them with the repo's command; the command downloads, converts and indexes. You write no prose and no code.

## Setup (once)

1. Work in **your own clone**. Never touch `~/Projects/coffee-research-bot` (the scheduler; files changing there break its runs) or `~/Projects/Coffee-research-codex` (the owner's working copy).
   ```sh
   git clone git@github.com:ron2man/coffee-research.git ~/Projects/coffee-research-library
   cd ~/Projects/coffee-research-library && npm install
   ```
2. Check the repository is private before you push anything: `gh repo view ron2man/coffee-research --json visibility -q .visibility` must print `PRIVATE`. If it doesn't, **stop and report**; the text of manuals must not be published.
3. `pdftotext -v` must work (`brew install poppler` if not).

## The command

```sh
npm run library -- add --product <product-id> --market <US|GB|US,GB> --kind <manual|quick-start|spec-sheet|support|parts|recall> --url <https URL> --title "<Brand Model, document name (market)>"
npm run library -- list
npm run library -- check
```

- `--product`: the product id. Use the existing id when the product has a card in `knowledge/<category>/<id>.md`. For a product without a card, make a new kebab-case id `brand-model` (e.g. `timemore-black-mirror-basic-2`) and use it consistently.
- `--market`: where that document applies. If one document covers both markets (same model, same language), use `US,GB` once instead of adding it twice.
- One `add` per document. The command refuses mirrors, duplicates, non-https URLs and scanned PDFs without text; when it refuses, find another official copy or skip and note it.

## Where documents may come from

- **Only the manufacturer's own sites and CDNs** (e.g. breville.com, assets.breville.com, sageappliances.com, baratza.com, eureka.co.it, fellowproducts.com, 1zpresso.coffee, lelit.com, ecm.de, lamarzoccohome.com), or an official national distributor's site when the manufacturer links to it.
- Never manual mirror sites (ManualsLib, ManualZZ, manua.ls and the like), retailer copies, forums or archive.org.
- Prefer the **current** edition. If a model has several editions (e.g. a booklet revised in a later year), add the current one; add an older one only if it covers a variant that's still common (say why in `--notes`).
- English only. For the UK (GB), use the UK/EU edition when the manufacturer publishes one (Breville machines are sold as **Sage** in the UK and EU: look on sageappliances.com).

## Order of work

**1. The focus cluster (do this first, completely):**

| product-id | US | GB |
|---|---|---|
| barista-express | Breville Barista Express BES870 | Sage the Barista Express SES875 / BES875UK |
| barista-pro | Breville Barista Pro BES878 | Sage the Barista Pro SES878 |
| breville-smart-grinder-pro | Breville Smart Grinder Pro BCG820 | Sage the Smart Grinder Pro SCG820 |
| turin-df54 | Turin DF54 | (same document if sold as the same model) |
| baratza-encore-esp | Baratza Encore ESP | (same, if the manufacturer uses one manual) |
| baratza-encore-esp-pro | Baratza Encore ESP Pro | (same, if one manual) |

For each: the instruction manual (kind `manual`), plus the quick-start guide, the manufacturer's troubleshooting or support pages (descaling, cleaning, grind adjustment, burr replacement) as `support`, and a spec sheet if there is one. Breville/Sage support articles are often HTML pages: add them as `support` if the command gets real text out of them.

**2. Every other product with a card** (`knowledge/machines/`, `knowledge/grinders/`): their manuals, US and GB.

1zpresso-j-ultra, baratza-encore, baratza-forte-ap, baratza-forte-bg, baratza-sette-270, baratza-sette-270wi, baratza-sette-30, baratza-vario-plus, baratza-vario-w-plus, baratza-virtuoso-plus, df64-gen-2, eureka-mignon-silenzio, eureka-mignon-specialita, fellow-ode-gen-2, fellow-opus, fellow-opus-2, niche-zero, bambino-plus, sage-bambino, sage-dual-boiler, ecm-classika, ecm-classika-iii, ecm-puristika, ecm-synchronika-ii, la-marzocco-linea-micra, lelit-bianca, lelit-elizabeth, lelit-marax.

**3. Accessories owners of the focus machines actually buy** (new ids): popular espresso scales, 54 mm accessories for Breville/Sage portafilters (bottomless portafilters, baskets, tampers, distribution/WDT tools), the manufacturer's own descaler and cleaning tablets. Only products whose manufacturer publishes a manual or a spec/support page.

## Committing

Commit **only** `library/index.json` and `library/docs/` (PDFs stay in the ignored `library/pdf/`). One commit per product, message `library: <product-id> (<n> documents)`. Before each push:

```sh
npm run library -- check
npm run validate
git pull --rebase origin main && git push origin main
```

The scheduler also pushes to `main`; if the rebase conflicts on anything other than `library/`, stop and report.

## Report when you finish (or stop)

A short table: product, market, documents added (kind and URL), and anything you couldn't find or that was refused (with the reason). List products where the US and UK models differ in ways the manuals show (different model numbers, parts or features): that's useful to the research agent.
