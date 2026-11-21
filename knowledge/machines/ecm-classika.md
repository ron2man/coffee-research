# ECM Classika

```json
{
  "schemaVersion": 1,
  "id": "ecm-classika",
  "name": "ECM Classika",
  "category": "machines",
  "updatedAt": "2026-11-21",
  "variants": [],
  "sources": [
    {
      "id": "manufacturer-product",
      "url": "https://www.ecm.de/en/products/classika-pid/",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "boiler-and-temperature-control",
      "statement": "ECM specifies a single boiler on the Classika PID, with PID adjustment of the boiler temperature for espresso and steam.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical Data — System and Details — PID control"
        }
      ]
    },
    {
      "id": "included-baskets",
      "statement": "ECM lists a 7 g single basket, a 14 g double basket, and a blind basket for the Classika PID.",
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
      "id": "shot-timer",
      "statement": "ECM says the Classika PID display shows espresso shot time in seconds.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Details — espresso shot time display"
        }
      ]
    }
  ]
}
```
