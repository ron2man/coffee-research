# Dual Boiler (Breville / Sage)

Sold as Breville the Dual Boiler (BES920) in the US and Sage the Dual Boiler in the UK. It has no built-in grinder. Researched for the upgrade-from-Barista-Express decision.

```json
{
  "schemaVersion": 1,
  "id": "sage-dual-boiler",
  "name": "Dual Boiler",
  "category": "machines",
  "updatedAt": "2026-11-25",
  "variants": [
    {"id": "dual-boiler-gb", "markets": ["GB"], "name": "Sage Dual Boiler", "brand": "Sage", "sku": "SES920"},
    {"id": "dual-boiler-us", "markets": ["US"], "name": "Breville Dual Boiler", "brand": "Breville", "sku": "BES920"}
  ],
  "sources": [
    {"id": "manufacturer-product", "url": "https://www.sageappliances.com/en-gb/product/bes920", "type": "manufacturer", "accessedAt": "2026-11-25"},
    {"id": "breville-us-bes920", "url": "https://www.breville.com/en-us/product/bes920", "type": "manufacturer", "accessedAt": "2026-11-25"},
    {"id": "ozbargain-956872", "url": "https://www.ozbargain.com.au/node/956872", "type": "owner-report", "accessedAt": "2026-11-25"}
  ],
  "claims": [
    {
      "id": "portafilter-diameter",
      "variantId": "dual-boiler-gb",
      "statement": "Sage lists a 58 mm stainless steel portafilter.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [{"sourceId": "manufacturer-product", "locator": "Technical Specifications — Accessories — Included Accessories"}]
    },
    {
      "id": "included-baskets",
      "variantId": "dual-boiler-gb",
      "statement": "Sage lists one-cup and two-cup baskets in both single-wall and dual-wall versions.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [{"sourceId": "manufacturer-product", "locator": "Technical Specifications — Accessories — Included Accessories"}]
    },
    {
      "id": "simultaneous-brewing-and-steaming",
      "variantId": "dual-boiler-gb",
      "statement": "Sage specifies that the dual-boiler system can brew espresso and deliver steam simultaneously.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [{"sourceId": "manufacturer-product", "locator": "The Dual Boiler heating system delivers simultaneous extraction & steam and a heated group head"}]
    },
    {
      "id": "simultaneous-us",
      "variantId": "dual-boiler-us",
      "statement": "Breville US says 'The Dual Boiler heating system delivers simultaneous extraction & steam and a heated group head', so you can pull a shot while steaming milk.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [{"sourceId": "breville-us-bes920", "locator": "Feature text 'At the heart of this machine is a dual boiler heating system'; 'delivers simultaneous extraction & steam and a heated group head'"}]
    },
    {
      "id": "pid-boilers",
      "statement": "Breville and Sage say the Dual Boiler's stainless steel boilers and heated group head are controlled with PID temperature control.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes920", "locator": "'The boiler, for the espresso shot, is PID temperature controlled'"},
        {"sourceId": "manufacturer-product", "locator": "'The stainless steel boilers and heated group head are controlled with PID temperature control'"}
      ]
    },
    {
      "id": "no-built-in-grinder",
      "statement": "The Dual Boiler has no built-in grinder in either market. The included accessories (58 mm Razor dosing tool, 58 mm portafilter, single- and dual-wall baskets, integrated tamper, milk jug, cleaning kit, water filter) include no grinder, so a Barista Express or Pro owner moving to it also needs a standalone grinder.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes920", "locator": "Included accessories list ('58mm Razor Dosing tool. 58mm Stainless Steel Portafilter. 1cup & 2cup Single and Dual Wall Filter Baskets', integrated tamper, 16oz milk jug, cleaning kit, water filter); no grinder in features"},
        {"sourceId": "manufacturer-product", "locator": "Included accessories list: '58mm Razor Dosing tool', 'Integrated Tamper', 'Water Filter Holder and Water Filter'; no grinder"}
      ]
    },
    {
      "id": "portafilter-58mm-us",
      "variantId": "dual-boiler-us",
      "statement": "Breville US lists a 'Professional 58 mm stainless steel portafilter' that 'holds a 22g dose'.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [{"sourceId": "breville-us-bes920", "locator": "'Professional 58 mm stainless steel portafilter holds a 22g dose with Dual & Single wall filter included'"}]
    },
    {
      "id": "owner-upgrade-verdicts",
      "statement": "In an April 2026 OzBargain thread, Barista Express owners considering the Dual Boiler were told it is worth it 'If you primarily make milk drinks' or if you're 'sick of the wait time for milk steaming', and that the Express's 'biggest bottleneck … is the grinder, by far'. Dual Boiler owners praised being able to 'pull the shot and steam at the same time' and its 'temperature stability', and one reported 'much more consistent shots' even without steaming milk.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [{"sourceId": "ozbargain-956872", "locator": "wintermadness 25/04/2026 20:38; iMagoo 26/04/2026 09:47; Kaidra 26/04/2026 11:27; Paudius 26/04/2026 14:19; antonenus 28/04/2026 09:21"}],
      "note": "Owner opinions from an Australian thread, not measurements. A question asking how much faster the Dual Boiler steams got no answer (kollier 27/04/2026 13:13)."
    },
    {
      "id": "owner-reliability-reports",
      "statement": "Dual Boiler owners in the same April 2026 thread reported mixed reliability. One had parts wear out after three years at a cost of a few hundred dollars. Another paid for a $400 (AUD) repair after eight years and advised regular descaling and servicing. One said 'the failure point has shifted to the level probes themselves', one said a steam leak had damaged their control board, and a local repairer was cited as recommending a service about every two years. Others called the machine 'SOLID' (about 3,000 shots) and said they would buy it again.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [{"sourceId": "ozbargain-956872", "locator": "hoxyz 25/04/2026 21:07; j1nx 26/04/2026 11:08; wintermadness 25/04/2026 22:09; rlay3 26/04/2026 10:13; shutuptakemymoney101 25/04/2026 22:00; Kaidra 25/04/2026 21:22; lethalmoney 27/04/2026 19:01"}],
      "note": "Owner reports only. Costs are in AUD and must not appear in market-neutral text."
    }
  ]
}
```
