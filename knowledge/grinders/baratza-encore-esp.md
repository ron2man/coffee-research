# Baratza Encore ESP

Initial research covers the grind setting range identified by Baratza.

```json
{
  "schemaVersion": 1,
  "id": "baratza-encore-esp",
  "name": "Baratza Encore ESP",
  "category": "grinders",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "zcg495blk1auc1a",
      "markets": [
        "US"
      ],
      "sku": "ZCG495BLK1AUC1A"
    }
  ],
  "sources": [
    {
      "id": "baratza-dialing-guide",
      "url": "https://www.baratza.com/en-gb/blog/product-guides/dialing-in-espresso",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "baratza-us-encore-esp",
      "url": "https://www.baratza.com/en-us/product/zcg495?sku=ZCG495BLK1AUC1A",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "espresso-settings",
      "statement": "Baratza identifies settings 1 through 20 as the Encore ESP's espresso range.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-dialing-guide",
          "locator": "Grinder-Specific Tips — Encore ESP"
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
      ]
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
    }
  ]
}
```
