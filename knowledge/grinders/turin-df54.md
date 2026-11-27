# DF54 (Turin DF54 in the US)

US evidence covers Espresso Outlet's v4.1 configuration. UK evidence comes from Coffeeblog's review of the MiiCoffee DF54, updated November 2026.

```json
{
  "schemaVersion": 1,
  "id": "turin-df54",
  "name": "Turin DF54",
  "category": "grinders",
  "variants": [
    {
      "id": "df54-v4-1-us",
      "markets": [
        "US"
      ],
      "name": "Turin DF54",
      "brand": "Turin"
    },
    {
      "id": "df54-gb",
      "markets": [
        "GB"
      ],
      "name": "MiiCoffee DF54",
      "brand": "MiiCoffee"
    }
  ],
  "sources": [
    {
      "id": "espresso-outlet-us-df54",
      "url": "https://espressooutlet.com/products/turin-df54-single-dose-flat-burr-grinder",
      "type": "merchant",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "coffeeblog-df54-review",
      "url": "https://coffeeblog.co.uk/df54-grinder-review/",
      "type": "professional-test",
      "accessedAt": "2026-11-24"
    }
  ],
  "claims": [
    {
      "id": "us-stepless-adjustment",
      "variantId": "df54-v4-1-us",
      "statement": "Espresso Outlet specifies stepless adjustment on the US DF54 v4.1.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "espresso-outlet-us-df54",
          "locator": "DF54 v4.1 Specifications — Adjustment"
        }
      ]
    },
    {
      "id": "us-single-dose-workflow",
      "variantId": "df54-v4-1-us",
      "statement": "Espresso Outlet describes weighing each dose, using the bellows to clear grounds, and transferring grounds from the dosing cup.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "espresso-outlet-us-df54",
          "locator": "Single Dosing in Everyday Use"
        }
      ]
    },
    {
      "id": "us-espresso-burr-option",
      "variantId": "df54-v4-1-us",
      "statement": "The seller recommends its stainless steel espresso burr option for espresso and mixed espresso/filter use.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "espresso-outlet-us-df54",
          "locator": "Which DF54 Burrs Should I Choose?"
        }
      ]
    },
    {
      "id": "burrs-54mm-flat-stepless",
      "statement": "The DF54 is a single-dose grinder with 54 mm stainless steel flat burrs and stepless grind adjustment.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {
          "sourceId": "coffeeblog-df54-review",
          "locator": "MiiCoffee DF54 Grinder Review (Kev, updated 19 Nov 2026): burrs and grind adjustment sections ('54mm stainless steel flat burrs', stepless)"
        },
        {
          "sourceId": "espresso-outlet-us-df54",
          "locator": "DF54 v4.1 Specifications — Adjustment (stepless)"
        }
      ],
      "note": "The manufacturer's own spec page was not reached (several sellers returned HTTP 429 on 2026-11-24)."
    },
    {
      "id": "retention-review",
      "statement": "In Coffeeblog's review, total retention was about 0.3 g on first use and 0.2 g on second use. From the third use on, it was '0.1g or less' without using the bellows. The reviewer also reports about 12 seconds to grind 18 g at a mid-range setting, and that the grinder handled a hard light roast without stalling.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {
          "sourceId": "coffeeblog-df54-review",
          "locator": "Retention and grinding sections of the review (updated 19 Nov 2026)"
        }
      ],
      "note": "These are the reviewer's measurements, not ours. Reader comments on the review report clogging on some earlier versions. The reviewer says this 'seems to have been sorted with the latest version' but has not confirmed it."
    },
    {
      "id": "uk-buying-caveat",
      "variantId": "df54-gb",
      "statement": "Coffeeblog recommends buying the DF54 in the UK from a UK retailer. It warns that overseas sellers may supply an EU plug and no official UK warranty, and that the courier may charge import fees.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {
          "sourceId": "coffeeblog-df54-review",
          "locator": "Where to buy section: names BellaBarista; EU plug / no official UK warranty / import invoice warning"
        }
      ]
    },
    {
      "id": "cradle-58mm-owner-comment",
      "statement": "A reader commenting on Coffeeblog's DF54 review says the dosing cradle is designed for 58 mm portafilters, and that a 54 mm portafilter can be pushed in and held.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {
          "sourceId": "coffeeblog-df54-review",
          "locator": "Reader comments section (comment on cradle size)"
        }
      ],
      "note": "One reader's report, not a specification. The review itself doesn't state the dosing cup or cradle size, and the manufacturer's page was not read. This applies to cradle fit only; grinding into the dosing cup and transferring the coffee works regardless."
    }
  ],
  "updatedAt": "2026-11-24"
}
```
