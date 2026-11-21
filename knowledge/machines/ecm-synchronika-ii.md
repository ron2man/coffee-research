# ECM Synchronika II

```json
{
  "schemaVersion": 1,
  "id": "ecm-synchronika-ii",
  "name": "ECM Synchronika II",
  "category": "machines",
  "updatedAt": "2026-11-21",
  "variants": [],
  "sources": [
    {
      "id": "manufacturer-product",
      "url": "https://www.ecm.de/en/products/synchronika-ii/",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "water-supply",
      "statement": "ECM specifies that the machine can switch between its water tank and a direct water connection.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical Data — Hardware — Switchable water tank / direct water connection"
        }
      ]
    },
    {
      "id": "included-baskets",
      "statement": "ECM lists a 7 g single basket, a 14 g double basket, and a blind basket.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Included in the box — baskets"
        }
      ]
    },
    {
      "id": "group-heating",
      "statement": "ECM specifies heating cartridges in the brew group.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical Data — Hardware — Brew group with heating cartridges (Core Heat)"
        }
      ]
    }
  ]
}
```
