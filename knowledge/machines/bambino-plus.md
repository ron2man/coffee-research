# Bambino Plus

Initial research covers the Breville US brushed stainless steel SKU.

```json
{
  "schemaVersion": 1,
  "id": "bambino-plus",
  "name": "Bambino Plus",
  "category": "machines",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "bes500bss1bus1",
      "sku": "BES500BSS1BUS1",
      "markets": [
        "US"
      ]
    }
  ],
  "sources": [
    {
      "id": "breville-us-product",
      "url": "https://www.breville.com/en-us/product/bes500?sku=BES500BSS1BUS1",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "breville-us-manual",
      "url": "https://assets.breville.com/BES500/BES500_USCM_IB_Y25_LR.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "breville-us-bambino-plus-sku",
      "url": "https://www.breville.com/en-us/product/bes500?sku=BES500BSS1BUS1",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "breville-us-older-manual",
      "url": "https://www.breville.com/content/dam/breville/us/assets/miscellaneous/instruction-manual/espresso/BES500-instruction-manual.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "portafilter-diameter",
      "variantId": "bes500bss1bus1",
      "statement": "Breville lists a 54 mm portafilter assembly for this SKU.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-product",
          "locator": "Specifications — Included Accessories"
        }
      ]
    },
    {
      "id": "automatic-milk-texturing",
      "variantId": "bes500bss1bus1",
      "statement": "The machine offers automatic milk texturing at a selected temperature and texture.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-manual",
          "locator": "English p. 9, Bambino Plus Features — Automatic Hands Free Milk Texturing"
        }
      ]
    },
    {
      "id": "us-included-baskets",
      "variantId": "bes500bss1bus1",
      "statement": "Breville lists one- and two-cup single- and dual-wall baskets for this US Bambino Plus SKU.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-bambino-plus-sku",
          "locator": "Technical Specifications — Accessories"
        }
      ]
    },
    {
      "id": "us-cleaning-alert",
      "variantId": "bes500bss1bus1",
      "statement": "The Y25 booklet describes a group-head flush alert after 200 extractions since the last cleaning cycle. The 1 CUP and 2 CUP buttons flash in alternation.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-manual",
          "locator": "English p. 17, Cleaning Cycle"
        }
      ]
    },
    {
      "id": "us-prompted-cleaning-cycle",
      "variantId": "bes500bss1bus1",
      "statement": "For the prompted cleaning cycle, the Y25 booklet specifies a cleaning disc and tablet in the portafilter, a tank filled to MAX, and a 2 L container under both outlets. Hold both cup buttons for five seconds, then press either once both lights are steady. The cup buttons alternate during the flush, and the machine returns to ready mode when finished.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-manual",
          "locator": "English p. 17, To Perform a Cleaning Cycle, steps 1–9"
        }
      ]
    },
    {
      "id": "us-early-cleaning-entry",
      "variantId": "bes500bss1bus1",
      "statement": "The Y25 booklet documents entering cleaning mode before the alert by holding 2 CUP and STEAM for five seconds with the machine off and all lights dark.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-manual",
          "locator": "English p. 17, note after To Perform a Cleaning Cycle"
        }
      ]
    },
    {
      "id": "us-descale-alert",
      "variantId": "bes500bss1bus1",
      "statement": "The Y25 booklet describes a 15-second descale alert in which 1 CUP and STEAM flash as a group alternating with 2 CUP. Pressing any of these buttons dismisses the alert and returns the machine to ready mode.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-manual",
          "locator": "English p. 17, Descaling"
        }
      ]
    },
    {
      "id": "us-descale-setup",
      "variantId": "bes500bss1bus1",
      "statement": "The Y25 booklet describes descaling for internal mineral buildup. It instructs users to remove the water filter before adding descaling powder, use the DESCALE fill line and a 2 L waste container, and let the machine cool fully. From off, hold 1 CUP and STEAM for five seconds and press either once both are steady.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-manual",
          "locator": "English pp. 17–18, Descaling note and To Descale, steps 1–7"
        }
      ]
    },
    {
      "id": "us-descale-rinse-and-finish",
      "variantId": "bes500bss1bus1",
      "statement": "During descaling the 1 CUP and STEAM buttons alternate. The machine pauses after using the solution. At that pause, refill with fresh water to MAX and empty the waste container. Once 1 CUP and STEAM are steady, press either to resume. Alternating lights followed by standby indicate completion.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-manual",
          "locator": "English p. 18, To Descale, steps 7–11"
        }
      ]
    },
    {
      "id": "us-malfunction-support",
      "variantId": "bes500bss1bus1",
      "statement": "Breville instructs owners to stop using a malfunctioning machine and call Consumer Support.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-manual",
          "locator": "English p. 3, Important Safeguards, appliance inspection and malfunction bullet"
        }
      ]
    },
    {
      "id": "us-early-cleaning-coverage",
      "variantId": "bes500bss1bus1",
      "statement": "The older US BES500 booklet omits the pre-alert cleaning shortcut documented in Y25.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-older-manual",
          "locator": "English p. 15, complete Cleaning Cycle section"
        },
        {
          "sourceId": "breville-us-manual",
          "locator": "English p. 17, note after To Perform a Cleaning Cycle"
        }
      ],
      "note": "A difference in documentation does not establish hardware or firmware applicability across production runs."
    }
  ]
}
```
