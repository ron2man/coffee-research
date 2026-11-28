# Sage Bambino

UK brushed stainless steel variant.

```json
{
  "schemaVersion": 1,
  "id": "sage-bambino",
  "name": "Sage Bambino",
  "category": "machines",
  "updatedAt": "2026-11-28",
  "variants": [
    {
      "id": "ses450bss4guk1",
      "sku": "SES450BSS4GUK1",
      "markets": [
        "GB"
      ],
      "name": "Sage Bambino",
      "brand": "Sage"
    },
    {
      "id": "bes450bss1bus1",
      "markets": [
        "US"
      ],
      "sku": "BES450BSS1BUS1",
      "name": "Breville Bambino",
      "brand": "Breville"
    }
  ],
  "sources": [
    {
      "id": "sage-gb-product",
      "url": "https://www.sageappliances.com/en-gb/product/bes450?sku=SES450BSS4GUK1",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "breville-us-bambino",
      "url": "https://www.breville.com/en-us/product/bes450?sku=BES450BSS1BUS1",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "breville-us-bambino-manual",
      "url": "https://assets.breville.com/BES450/BES450_USCM_IB_M26_LR.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "portafilter-diameter",
      "variantId": "ses450bss4guk1",
      "statement": "Sage specifies a 54 mm portafilter.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "sage-gb-product",
          "locator": "Product features — 54 mm portafilter"
        }
      ]
    },
    {
      "id": "included-baskets",
      "variantId": "ses450bss4guk1",
      "statement": "Sage lists one-cup and two-cup filter baskets in both single-wall and dual-wall versions as included accessories.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "sage-gb-product",
          "locator": "Technical Specifications — Accessories — Included Accessories"
        }
      ]
    },
    {
      "id": "manual-milk-texturing",
      "variantId": "ses450bss4guk1",
      "statement": "Sage specifies a steam wand for manual milk texturing.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "sage-gb-product",
          "locator": "Product features — Manual hand-crafted microfoam"
        }
      ]
    },
    {
      "id": "us-basket-options",
      "variantId": "bes450bss1bus1",
      "statement": "Breville lists a 54 mm portafilter and single- and dual-wall filters for this US Bambino SKU.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-bambino",
          "locator": "Product features — 54 mm portafilter"
        }
      ]
    },
    {
      "id": "us-basket-use",
      "variantId": "bes450bss1bus1",
      "statement": "Breville recommends the single-wall basket for freshly ground whole beans and the dual-wall basket for pre-ground coffee.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-bambino-manual",
          "locator": "Filter Baskets, printed page 10"
        }
      ]
    },
    {
      "id": "us-grind-flow",
      "variantId": "bes450bss1bus1",
      "statement": "Breville explains that a coarser grind can make the shot flow too fast and an excessively fine grind can restrict flow.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "breville-us-bambino-manual",
          "locator": "The Grind, printed page 11"
        }
      ]
    }
  ]
}
```
