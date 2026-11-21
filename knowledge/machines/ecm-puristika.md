# ECM Puristika

```json
{
  "schemaVersion": 1,
  "id": "ecm-puristika",
  "name": "ECM Puristika",
  "category": "machines",
  "updatedAt": "2026-11-21",
  "variants": [],
  "sources": [
    {
      "id": "manufacturer-product",
      "url": "https://www.ecm.de/en/products/puristika/",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "water-tank",
      "statement": "ECM describes the external glass water tank as freely positionable.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Details — glass water container"
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
      "id": "boiler-and-temperature-control",
      "statement": "ECM specifies a single stainless steel boiler of approximately 0.75 L and PID control.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical Data — System, Hardware — Stainless steel boiler, and Software — PID control"
        }
      ]
    }
  ]
}
```
