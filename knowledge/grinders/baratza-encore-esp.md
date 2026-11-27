# Baratza Encore ESP

Covers the espresso grind range, burrs and dosing cup as stated by Baratza, for the US and UK.

```json
{
  "schemaVersion": 1,
  "id": "baratza-encore-esp",
  "name": "Baratza Encore ESP",
  "category": "grinders",
  "updatedAt": "2026-11-24",
  "variants": [
    {
      "id": "zcg495blk1auc1a",
      "markets": [
        "US"
      ],
      "sku": "ZCG495BLK1AUC1A",
      "name": "Baratza Encore ESP",
      "brand": "Baratza"
    },
    {
      "id": "zcg495blk4guk1a",
      "markets": [
        "GB"
      ],
      "sku": "ZCG495BLK4GUK1A",
      "name": "Baratza Encore ESP",
      "brand": "Baratza"
    }
  ],
  "sources": [
    {
      "id": "baratza-dialing-guide",
      "url": "https://www.baratza.com/en-gb/blog/product-guides/dialing-in-espresso",
      "type": "manufacturer",
      "accessedAt": "2026-11-24"
    },
    {
      "id": "baratza-us-encore-esp",
      "url": "https://www.baratza.com/en-us/product/zcg495?sku=ZCG495BLK1AUC1A",
      "type": "manufacturer",
      "accessedAt": "2026-11-24"
    },
    {
      "id": "baratza-gb-encore-esp",
      "url": "https://www.baratza.com/en-gb/product/zcg495",
      "type": "manufacturer",
      "accessedAt": "2026-11-24"
    }
  ],
  "claims": [
    {
      "id": "espresso-settings",
      "statement": "Baratza identifies settings 1 through 20 as the Encore ESP's espresso range.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {
          "sourceId": "baratza-dialing-guide",
          "locator": "Grinder-Specific Tips — Encore ESP: 'Stay within the espresso range (1–20) and start at the coarse end, slowly moving finer'"
        }
      ]
    },
    {
      "id": "us-dosing-cup",
      "variantId": "zcg495blk1auc1a",
      "statement": "Baratza lists an included dosing cup intended for 54 mm portafilters and an adapter for 58 mm.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-encore-esp",
          "locator": "Product features — Dosing Cup"
        }
      ],
      "note": "Supported from the 2026-11-21 read. A re-read on 2026-11-24 only found 'dosing cup included' with no size, possibly because the feature section is dynamic. The GB page also gives no size. Re-check against the Encore ESP manual."
    },
    {
      "id": "us-adjustment-ranges",
      "variantId": "zcg495blk1auc1a",
      "statement": "Baratza assigns settings 1–20 to espresso and 21–40 to coarser brewing methods.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-encore-esp",
          "locator": "Product features — Dual-Range Adjustment System"
        }
      ]
    },
    {
      "id": "burrs-40mm-m2",
      "statement": "Baratza's US and GB product pages specify 40 mm conical steel (M2) burrs with a quick-release burr mount and manual dosing.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {
          "sourceId": "baratza-us-encore-esp",
          "locator": "Specifications: Burrs '40mm conical steel (M2)'; Dosing 'Manual'"
        },
        {
          "sourceId": "baratza-gb-encore-esp",
          "locator": "Specifications: Burrs '40mm conical steel (M2)', quick-release burr mount; Dosing 'Manual'"
        }
      ]
    }
  ]
}
```
