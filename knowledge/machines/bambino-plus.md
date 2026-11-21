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
      "url": "https://www.breville.com/content/dam/breville/us/en/assets/miscellaneous/instruction-manual/espresso/BES500-instruction-manual.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "breville-us-bambino-plus-sku",
      "url": "https://www.breville.com/en-us/product/bes500?sku=BES500BSS1BUS1",
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
          "locator": "Bambino Plus Features — Automatic Hands Free Milk Texturing, page 8"
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
    }
  ]
}
```
