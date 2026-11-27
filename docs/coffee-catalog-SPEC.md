# Coffee Catalog: specification

You are building and maintaining **Coffee Catalog**, a self-contained, private dataset of home coffee equipment as the manufacturers describe it: every product, every regional version, the manufacturer's specifications, documents and images. This repository is the whole project. Nothing outside it depends on how you work, only on the **output contract** below. Keep it accurate, sourced and stable.

Put this file at the repo root as `SPEC.md`, and keep an `AGENTS.md` that says: "Read SPEC.md before any change. The output contract (section 4) is stable; breaking it needs a major schema version and a CHANGELOG entry."

---

## 1. Scope

**In scope**

- **Subcategories** (each is a value of `category`, see 4.2):
  - `espresso-machine`, `grinder` (electric), `manual-grinder`, `scale`
  - accessories: `tamper`, `distribution-tool` (WDT/needle tools that break up clumps, spinning distributors, levellers), `portafilter` (bottomless and spouted, aftermarket), `basket` (precision and stock baskets), `puck-screen`, `dosing-cup` (and dosing funnels), `tamping-station` (mats and stands), `knock-box`, `milk-jug`, `cup` (espresso and cappuccino cups, glasses), `shot-glass` (and measuring jugs), `thermometer`, `bean-storage`, `cleaning` (brushes, descalers, cleaning tablets and powders), `water` (filters, water minerals)
- For each product: identity, **every regional version and every target market where it's sold**, manufacturer specifications, manufacturer documents (manuals, quick-start guides, spec sheets, support and troubleshooting pages, parts lists, recall notices) and manufacturer images with their usage terms.
- **Target markets** (ISO 3166-1 alpha-2): the United States and every European country with its own Amazon store: `US`, `GB`, `DE`, `FR`, `IT`, `ES`, `NL`, `BE`, `SE`, `PL`, `IE`. Record other markets too when the manufacturer's sources show them, but don't spend effort hunting for them.
- **No market comes first.** Work brand by brand (section 6): for each product, find its versions across all target markets in the same pass. A problem with a machine, or its spec, usually isn't specific to one country.

**Out of scope (never add)**

- Prices, retailers, stock, affiliate links.
- Reviews, opinions, ratings, owner reports, "best" lists, comparisons.
- Compatibility judgements ("works well with"). Record facts (e.g. portafilter diameter, and what the manufacturer itself says a product fits); never conclusions.
- Anything not published by the manufacturer or its official national distributor (except brand **discovery leads**, section 6.1, which are never stored as data).

## 2. Sources

- **Allowed:** the manufacturer's own websites and CDNs (e.g. breville.com, assets.breville.com, sageappliances.com, baratza.com, fellowproducts.com, eureka.co.it, 1zpresso.coffee, lelit.com, ecm.de, lamarzoccohome.com, timemore.com, acaia.co), official national distributors linked from the manufacturer, official press/media centers, and government recall databases (e.g. cpsc.gov, gov.uk product safety).
- **Never as a source of data:** manual mirror sites (ManualsLib, ManualZZ, manua.ls, device.report and the like), retailers, marketplaces, review sites, forums, social media, archive.org. Retailer and marketplace pages may be used only as brand discovery leads (6.1).
- Prefer the **current** edition of a document. Keep an older edition only if it covers a version that's still sold or widely owned; say why in `notes`.
- **Language:** prefer the English edition. Store a local-language edition (`language` field, ISO 639-1) only when no English edition covers that version, or when the local edition differs in content (different parts, features or safety notes).
- Every stored value and file records where it came from (`url`), when (`retrievedAt`, ISO date) and, for documents, exactly where inside (`locator`: "p. 12", a section heading, or a table name).
- Never invent. If the manufacturer doesn't state something, it is `unknown` (see 4.3), not a guess, and not filled in from a third party.

---

## 3. Repository layout

```
SPEC.md  AGENTS.md  CHANGELOG.md  README.md
schemas/                     JSON Schemas for every file type below (the contract, machine-checkable)
brands/<brand-id>.json       brand: name, country, official sites, press/media center URL, notes
products/<product-id>/
  product.json               identity and versions (4.1, 4.2)
  specs.json                 structured specifications (4.3)
  troubleshooting.json       manufacturer troubleshooting tables (4.4), if any
  documents.json             document records (4.5)
  docs/<doc-id>.md           document text with page markers
  images.json                image records with usage terms (4.6)
  images/<image-id>.<jpg|webp|png>
cache/pdf/<product-id>/<doc-id>.pdf   original PDFs: NOT committed (gitignored), re-downloadable from url
catalog.json                 generated index of everything (4.7). Never edit by hand
queue.json                   work queue (section 6)
coverage.md                  generated coverage report (section 6)
scripts/                     the tooling (section 5)
.backoffice/                 job logs and lock (gitignored)
```

---

## 4. Output contract (stable)

All files are UTF-8 JSON (2-space indent, sorted keys not required) or Markdown. Every JSON file has `"schemaVersion": 1` and validates against `schemas/`.

### 4.1 Identifiers

- `brand-id`: kebab-case brand (`breville`, `sage`, `baratza`). Breville and Sage are one company: use brand `breville` for the product, and record `Sage` as the market brand on the versions sold under that name.
- `product-id`: kebab-case `brand-model` for the **model family** (`breville-barista-pro`, `baratza-encore-esp`). Regional and colour variants are versions, not products.
- IDs are **permanent**. Never rename or reuse one. If you got one wrong, add the correct product and set `"replacedBy"` on the old one; never delete it.
- `doc-id`, `image-id`, `version-id`: kebab-case, unique within the product.

### 4.2 `product.json`

```json
{
  "schemaVersion": 1,
  "id": "breville-barista-pro",
  "brand": "breville",
  "name": "Barista Pro",
  "category": "espresso-machine",
  "aliases": ["the Barista Pro", "BES878", "SES878"],
  "status": "current",
  "introduced": "2019",
  "officialPages": [{ "market": "US", "url": "https://www.breville.com/…" }],
  "versions": [
    {
      "id": "bes878-us",
      "marketBrand": "Breville",
      "marketName": "Breville Barista Pro",
      "modelNumbers": ["BES878BSS", "BES878BTR"],
      "markets": ["US"],
      "voltage": "120V 60Hz",
      "plug": "NEMA 5-15",
      "status": "current",
      "officialPage": "https://www.breville.com/…",
      "source": { "url": "https://…", "retrievedAt": "2026-11-25" }
    },
    {
      "id": "ses878-eu",
      "marketBrand": "Sage",
      "marketName": "Sage the Barista Pro",
      "modelNumbers": ["SES878…"],
      "markets": ["DE", "FR", "IT", "ES", "NL", "BE", "SE", "PL", "IE"],
      "voltage": "220-240V 50-60Hz",
      "plug": "Type F",
      "status": "current",
      "officialPage": "https://www.sageappliances.com/de-de/…",
      "source": { "url": "https://…", "retrievedAt": "2026-11-25" }
    }
  ],
  "replacedBy": null,
  "notes": ""
}
```

- `category`: one subcategory from section 1 (`espresso-machine`, `grinder`, `manual-grinder`, `scale`, `tamper`, `distribution-tool`, `portafilter`, `basket`, `puck-screen`, `dosing-cup`, `tamping-station`, `knock-box`, `milk-jug`, `cup`, `shot-glass`, `thermometer`, `bean-storage`, `cleaning`, `water`). Keep the list in `schemas/categories.json`.
- `status`: `current`, `discontinued`, `unknown`.
- A version lists only markets where the manufacturer (or its official distributor) sells or sold it, with the source that shows it. Check each target market's official site or store locator (most brands have country pages); don't assume "EU" means every EU country.
- If a version is sold under different names in different markets, split it, or add `marketNames: { "DE": "…", "FR": "…" }`; `marketName` stays the English/default one.
- `marketName` is the full name as sold in that market (this matters: the same machine is "Breville Barista Pro" in the US and "Sage the Barista Pro" in the UK and EU).
- Versions differ by voltage and plug almost everywhere; note real differences (parts, features, accessories included) in `notes` on the version.

### 4.3 `specs.json`

```json
{
  "schemaVersion": 1,
  "productId": "breville-barista-pro",
  "fields": {
    "portafilterDiameter": { "value": 54, "unit": "mm", "versions": "all", "source": { "docId": "manual-us-2024", "locator": "p. 6" } },
    "heating": { "value": "thermojet", "versions": "all", "source": { "url": "https://…", "retrievedAt": "2026-11-25", "locator": "Specifications" } },
    "waterTankCapacity": { "value": 2, "unit": "L", "versions": "all", "source": { "docId": "manual-us-2024", "locator": "p. 4" } },
    "pumpPressure": { "unknown": true, "checked": ["manual-us-2024", "https://…/specs"] }
  }
}
```

- Use the **field vocabulary** in `schemas/spec-fields.json`, one list per category. Start with at least the lists below; add the small accessory subcategories as you meet them (e.g. tamper: `baseDiameter`, `baseProfile`, `calibrated`, `forceKg`; distribution-tool: `needleCount`, `needleDiameter`, `fitsDiameter`; cup: `volume`, `material`, `wallType`; milk-jug: `volume`, `spoutType`, `material`):
  - espresso-machine: `portafilterDiameter` (mm), `basketsIncluded`, `pressurizedBasketsIncluded`, `heating` (`single-boiler`, `dual-boiler`, `heat-exchanger`, `thermoblock`, `thermocoil`, `thermojet`), `pid` (bool), `preinfusion`, `builtInGrinder` (bool), `grindSettings` (count), `steamWand` (`manual`, `automatic`, `none`), `waterTankCapacity` (L), `beanHopperCapacity` (g), `power` (W), `dimensions` (W×D×H mm), `weight` (kg), `cupClearance` (mm), `warranty`.
  - grinder: `burrType` (`flat`, `conical`), `burrDiameter` (mm), `burrMaterial`, `adjustment` (`stepped`, `stepless`), `grindSettings` (count), `singleDose` (bool), `hopperCapacity` (g), `motorPower` (W), `rpm`, `portafilterHolder`, `dimensions`, `weight`, `warranty`.
  - scale: `capacity` (g), `resolution` (g), `timer` (bool), `flowRate` (bool), `waterResistance`, `battery`, `dimensions`, `weight`.
  - accessory: `fits` (a fact, e.g. `{"portafilterDiameter": 54}` or listed compatible models **as the manufacturer states them**), `diameter` (mm), `material`, `dimensions`, `weight`.
- Add a new field only by adding it to the vocabulary file with its unit and meaning (and a CHANGELOG line).
- `versions`: `"all"` or a list of version ids when a value differs by version.
- Units are SI (`mm`, `g`, `kg`, `L`, `W`, `bar`, `°C`). Convert if the source uses other units and say so in `note`.
- `unknown: true` with `checked` (what you looked at) when the manufacturer doesn't state it. A missing field means "not checked yet"; `unknown` means "checked, not published".

### 4.4 `troubleshooting.json`

The manufacturer's own troubleshooting tables, verbatim in meaning (paraphrase lightly, never add):

```json
{ "schemaVersion": 1, "productId": "breville-barista-pro",
  "entries": [{ "problem": "Espresso runs out too quickly", "causes": ["Grind too coarse", "Not enough coffee in the filter basket"], "fixes": ["Adjust to a finer grind", "Increase the dose"], "versions": "all", "source": { "docId": "manual-us-2024", "locator": "p. 31" } }] }
```

### 4.5 `documents.json` and `docs/`

```json
{ "schemaVersion": 1, "productId": "breville-barista-pro",
  "documents": [{
    "id": "manual-us-2024", "kind": "manual", "title": "Barista Pro BES878 Instruction Book",
    "markets": ["US"], "versions": ["bes878-us"], "edition": "Q24", "language": "en",
    "url": "https://assets.breville.com/…pdf", "finalUrl": "https://…", "format": "pdf",
    "pages": 40, "sha256": "…", "bytes": 4194304, "retrievedAt": "2026-11-25",
    "mdPath": "docs/manual-us-2024.md", "cachePath": "cache/pdf/breville-barista-pro/manual-us-2024.pdf",
    "notes": "" }] }
```

- `kind`: `manual`, `quick-start`, `spec-sheet`, `support`, `parts`, `recall`, `warranty`.
- `docs/<doc-id>.md` starts with a header (title, source URL, retrieved date, pages) and then the full text. For PDFs, mark every page: a line `--- page N ---` before the text of page N (N is the PDF page index, starting at 1), so anyone can cite "p. N". Use `pdftotext -layout`. HTML pages become clean text (headings, lists, tables as rows; no navigation, scripts or cookie banners).
- A PDF whose text extraction is empty (scanned) is recorded with `"textAvailable": false`; no OCR for now.
- Original PDFs go to `cache/` (gitignored). `sha256` lets anyone verify a re-download.

### 4.6 `images.json` and `images/`

```json
{ "schemaVersion": 1, "productId": "breville-barista-pro",
  "images": [{
    "id": "front-brushed-steel", "file": "images/front-brushed-steel.jpg",
    "versions": ["bes878-us", "ses878-gb"], "view": "front", "colour": "brushed stainless steel",
    "width": 1600, "height": 1600, "sha256": "…",
    "source": { "url": "https://…/press/…jpg", "page": "https://…/press-kit", "retrievedAt": "2026-11-25" },
    "license": { "type": "press-editorial", "terms": "https://…/media-terms", "credit": "Breville", "restrictions": "Editorial use; no alteration of the product", "verifiedAt": "2026-11-25" } }] }
```

- **Only images with usage terms you can point to**: a manufacturer press or media kit with stated terms, an explicit permission page, or a license that allows reuse. Record the terms URL and any restrictions. If you can't find terms, **don't store the image**; list it in `coverage.md` as "image terms unknown".
- Never store images from retailers, marketplaces, reviews, forums or search results, and never images supplied through an affiliate or retail API.
- Store a web-sized copy: longest side ≤ 1600 px, ≤ 500 KB, JPEG or WebP; keep the original aspect ratio; don't edit the product.

### 4.7 `catalog.json` (generated)

One index for consumers, rebuilt by `scripts/build-index` and never edited by hand:

```json
{ "schemaVersion": 1, "generatedAt": "…",
  "brands": [{ "id": "breville", "name": "Breville" }],
  "products": [{ "id": "breville-barista-pro", "brand": "breville", "name": "Barista Pro", "category": "espresso-machine", "status": "current",
    "versions": [{ "id": "bes878-us", "marketName": "Breville Barista Pro", "markets": ["US", "CA"], "modelNumbers": ["BES878BSS"] }],
    "specFields": 14, "unknownFields": 2, "documents": 5, "images": 3, "troubleshooting": 12,
    "updatedAt": "2026-11-25", "path": "products/breville-barista-pro/" }] }
```

### 4.8 Stability

- `schemaVersion` is 1. Adding optional fields or vocabulary entries is a minor change (CHANGELOG). Renaming or removing fields, changing types or meanings is a **major** change: bump `schemaVersion`, keep the old files valid until migrated, and write the migration in CHANGELOG.
- Every commit leaves the repository valid (`scripts/validate` passes).

---

## 5. Tooling

Build these scripts yourself (Node 22 or Python 3.12, your choice; no heavy frameworks). Each is idempotent and safe to re-run.

| Command | Does |
|---|---|
| `scripts/add-product <brand> <model>` | creates `products/<id>/` with a valid empty skeleton and a queue entry |
| `scripts/fetch-doc <product-id> --url … --kind … --markets … --versions …` | downloads, refuses forbidden hosts (section 2) and non-https, records sha256, extracts text with page markers, writes `docs/` and `documents.json`; refuses duplicates (same url or same sha256) |
| `scripts/add-image <product-id> --url … --terms … …` | downloads, refuses without terms, resizes, records `images.json` |
| `scripts/check-links` | re-checks every recorded URL (HEAD, then GET); marks moved/broken; never deletes |
| `scripts/check-updates` | re-downloads documents, compares sha256; a changed document becomes a new edition entry (old one kept, `supersededBy` set) |
| `scripts/build-index` | rebuilds `catalog.json` and `coverage.md` |
| `scripts/validate` | schema-validates every file, checks references (docId exists, version ids exist, files exist, locators present, no forbidden hosts, image terms present), and fails on any problem |

Include tests for the scripts (fixtures, no network) and run them in `scripts/validate --tests` or `npm test`.

---

## 6. Work plan and queue

The order is **brand → products → markets**, never market first.

### 6.1 Brand discovery

For each subcategory in section 1, list the **top 20 brands** sold in the target markets, in `brands/_ranking.json`:

```json
{ "schemaVersion": 1, "updatedAt": "2026-11-25",
  "subcategories": { "grinder": [{ "rank": 1, "brandId": "baratza", "markets": ["US", "GB", "DE"], "leads": ["https://…", "https://…"] }] } }
```

- Rank by how widely the brand is present in that subcategory across the target markets: how often it appears in the best-seller and category pages of the Amazon stores of the target markets and of major specialist retailers, and how many target markets carry it. This is a **lead**: record the pages you looked at in `leads` (URL only), and never take product data from them.
- Brands appear in several subcategories (a grinder brand may also make scales); count them once per subcategory.
- For each ranked brand, create `brands/<brand-id>.json`: legal name, country, official sites per market, product-range page, press/media center (and its terms URL), support/manuals page.
- Refresh the ranking every 90 days.

### 6.2 Brand lineups

For each brand, in ranking order (alternate subcategories so all of them advance), use the brand's own sites to list **its whole current lineup in our subcategories**, plus discontinued models that are still widely owned (sold in the last 5 years). Add each as a product (`scripts/add-product`) with a queue entry. A brand found through one subcategory often has products in others (an espresso-machine brand's tampers, jugs and cleaning products): include them.

### 6.3 Products

`queue.json` holds the work: `{ "items": [{ "productId", "stage", "priority", "lastAttempt", "notes" }] }`, with stages:

`identify` → `versions` (every target market, in one pass) → `documents` → `specs` → `troubleshooting` → `images` → `done`, plus `blocked` (with the reason).

Priority: products of higher-ranked brands first; within a brand, the products with the largest owner base (current flagship models before niche ones); machines and grinders before small accessories of the same brand.

`coverage.md` (generated) shows per subcategory, brand and product: versions and markets found, documents, spec fields filled / unknown / missing, troubleshooting entries, images (and "terms unknown"), broken links and blocked items; plus, per subcategory, how many of the top 20 brands are done.

## 7. The scheduled job (every few hours)

A job runs unattended every **3 hours** on the owner's Mac (`launchd`; on Linux use cron). It must be safe to run while nobody watches.

`scripts/job.sh`:

1. Take a lock (`.backoffice/job.lock`; skip if another run holds it and is younger than 3 hours).
2. `git pull --rebase` (stop on conflict and log it).
3. **Deterministic upkeep (no AI):** `check-links`, `check-updates` for documents older than 30 days, `build-index`, `validate`.
4. **One batch of AI work:** run Codex non-interactively (`codex exec` with a workspace-write sandbox, network access enabled, and no approval prompts; check `codex exec --help` and `~/.codex/config.toml` for the current flags) with this instruction: *"Read SPEC.md. If brands/_ranking.json is missing or older than 90 days, refresh the brand discovery first (section 6.1). Otherwise take the top items from queue.json (at most 3 products or 45 minutes, whichever comes first), advance each through its next stages following the spec (versions across all target markets in one pass), then run scripts/build-index and scripts/validate. Do not change SPEC.md, schemas or scripts in this run."*
5. If `validate` passes: commit only `products/`, `brands/`, `catalog.json`, `coverage.md`, `queue.json` with a message like `catalog: <product-ids> (<stages>)`, then `git push`. If it fails: don't commit; log the errors; leave the working tree for the next run to fix (or `git stash` it with a dated name).
6. Write a one-line summary to `.backoffice/job.log` (time, products touched, docs/images added, validation result, duration).
7. Release the lock.

Provide `scripts/install-job` (writes and loads the launchd plist: every 3 hours at fixed minutes, catching up after sleep) and `scripts/job-status` (last runs from the log).

Budget: one batch per run, at most 3 products. Never run two batches at once.

---

## 8. Quality bar

- Every value, document and image traces to an allowed source, with date and locator.
- No guesses: `unknown` is a valid, useful answer.
- `marketName`, `modelNumbers` and `markets` are right for each version, **across all target markets**. This is the most important data in the catalog; check it against the manufacturer's country sites.
- Documents keep their page numbers, so "p. N" in `specs.json` and `troubleshooting.json` points to the right page of the right edition.
- Images are only stored with terms that allow it.
- `scripts/validate` passes on every commit.
- With 19 subcategories and 20 brands each, the list is long and brands overlap. Breadth comes from the job running for weeks: never trade accuracy for speed.

## 9. First milestone (acceptance)

- Tooling (section 5) built and tested, `scripts/install-job` done and the job running every 3 hours.
- **Brand discovery done:** `brands/_ranking.json` with the top 20 brands for every subcategory, and a `brands/<id>.json` for each.
- **The first 5 brands complete, brand → products → markets:** the top-ranked espresso-machine brand, the top two grinder brands, the top scale brand and the top distribution-tool brand. For each: the whole lineup in our subcategories, every version with its markets across all target markets, current manuals and quick-start guides with page markers, spec fields filled or `unknown`, troubleshooting tables, and images where press terms exist.
- `catalog.json` and `coverage.md` generated; `validate` green.
- A short report in `README.md`: what's covered, what's blocked and why, image terms found per brand, and versions that differ between markets in ways the manuals show (different model numbers, parts or features).
