# Breville / Sage Smart Grinder Pro

Researched for the standalone-grinder guide for Barista Express and Pro owners. Manufacturer pages give settings, cradles and dosing. The burr-group comparison with the Barista Express comes from a professional review and a retailer comparison.

```json
{
  "schemaVersion": 1,
  "id": "breville-smart-grinder-pro",
  "name": "Smart Grinder Pro",
  "category": "grinders",
  "updatedAt": "2026-11-24",
  "variants": [
    {"id": "bcg820-us", "sku": "BCG820BSSXL", "markets": ["US"], "name": "Breville Smart Grinder Pro", "brand": "Breville"},
    {"id": "bcg820-gb", "sku": "BCG820BSSUK", "markets": ["GB"], "name": "Sage Smart Grinder Pro", "brand": "Sage"}
  ],
  "sources": [
    {"id": "breville-us-bcg820", "url": "https://www.breville.com/en-us/product/bcg820", "type": "manufacturer", "accessedAt": "2026-11-24"},
    {"id": "sage-uk-bcg820", "url": "https://www.sageappliances.com/en-gb/product/BCG820", "type": "manufacturer", "accessedAt": "2026-11-24"},
    {"id": "coffeegeek-sgp-review", "url": "https://coffeegeek.com/reviews/fullreview/breville-smart-grinder-pro-full-review/", "type": "professional-test", "accessedAt": "2026-11-24"},
    {"id": "scg-express-vs-sgp", "url": "https://www.seattlecoffeegear.com/blogs/scg-blog/crew-comparison-breville-barista-express-vs-smart-grinder-pro", "type": "merchant", "accessedAt": "2026-11-24"},
    {"id": "ozbargain-899121", "url": "https://www.ozbargain.com.au/node/899121", "type": "owner-report", "accessedAt": "2026-11-24"},
    {"id": "breville-us-bes878", "url": "https://www.breville.com/en-us/product/bes878", "type": "manufacturer", "accessedAt": "2026-11-24"}
  ],
  "claims": [
    {
      "id": "sixty-settings-conical",
      "statement": "Breville (US) and Sage (UK) both list 60 grind settings and stainless steel conical burrs for the Smart Grinder Pro, covering espresso to French press. Neither page states a burr diameter.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {"sourceId": "breville-us-bcg820", "locator": "'With 60 unique settings, this programmable conical burr grinder...'; spec 'Stainless Steel Conical Burrs'"},
        {"sourceId": "sage-uk-bcg820", "locator": "'60 grind settings'; 'Stainless Steel Conical Burrs'"}
      ]
    },
    {
      "id": "portafilter-cradles",
      "statement": "The Smart Grinder Pro comes with two portafilter cradles, a small one for 50–54 mm portafilters and a large one for 58 mm, and can grind directly into a portafilter.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {"sourceId": "breville-us-bcg820", "locator": "Accessories: 'Portafilter Cradle–Small 50-54mm', 'Portafilter Cradle–Large 58mm'"},
        {"sourceId": "sage-uk-bcg820", "locator": "Accessories: 'Portafilter Cradle–Small 50-54mm', 'Portafilter Cradle–Large 58mm'; 'Grind directly into a portafilter'"}
      ]
    },
    {
      "id": "timed-dosing-us",
      "variantId": "bcg820-us",
      "statement": "Breville describes Dosing iQ with grind time adjustable and programmable in 0.2-second increments, and a choice between 'shots' for espresso and 'cups' for French press or filter.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {"sourceId": "breville-us-bcg820", "locator": "'Precision Digital Time allows you to adjust and program grind time in 0.2 second increments'; \"'cups' for French Press or Filter and 'shots' for Espresso\""}
      ]
    },
    {
      "id": "burr-group-shared-with-barista-express",
      "statement": "CoffeeGeek's review (Mark Prince, 1 Nov 2023) says the Smart Grinder Pro uses a 40 mm conical burr and a burr group that 'first showed up in the Dose Control Pro and Barista Express espresso machine', 'the same one that was in the Barista Express espresso machine'. Seattle Coffee Gear's 2016 comparison also found the Barista Express burrs were 'conical stainless steel like the Smart Grinder Pro'.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {"sourceId": "coffeegeek-sgp-review", "locator": "'The main conical burr (40mm) and vane system sits below this top carrier'; 'New burr group, the same one that was in the Barista Express espresso machine'"},
        {"sourceId": "scg-express-vs-sgp", "locator": "Published Jul 8, 2016: 'We still checked out the burrs and found they were conical stainless steel like the Smart Grinder Pro!'"}
      ],
      "note": "Breville does not state this itself. It applies to the Barista Express only; see burr-group-shared-with-barista-pro."
    },
    {
      "id": "burr-group-shared-with-barista-pro",
      "statement": "Whether the Smart Grinder Pro uses the same burrs as the Barista Pro's built-in grinder.",
      "status": "unknown",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {"sourceId": "breville-us-bes878", "locator": "Heading 'Baratza European Precision Burrs with 30 grind settings'"},
        {"sourceId": "breville-us-bcg820", "locator": "Spec 'Stainless Steel Conical Burrs' (no Baratza mention, no size)"}
      ],
      "note": "Breville markets the Barista Pro grinder with Baratza burrs but not the Smart Grinder Pro. No source compares the two. Don't extend the Express burr-sharing claim to the Pro."
    },
    {
      "id": "espresso-limitations-review",
      "statement": "CoffeeGeek's reviewer calls the Smart Grinder Pro 'a clumpy, clumpy grinder for espresso' that 'retains a lot of grinds', says 'you should never, ever single dose a Smart Grinder Pro', and notes that the adjustment doesn't lock positively into each click.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {"sourceId": "coffeegeek-sgp-review", "locator": "Espresso section: 'This is a clumpy, clumpy grinder for espresso.'; 'It also retains a lot of grinds.'; 'You should never, ever single dose a Smart Grinder Pro.'"}
      ]
    },
    {
      "id": "owner-not-an-upgrade",
      "statement": "In an OzBargain thread (March 2025) where a Barista Express owner asked about a standalone grinder, one owner said the Smart Grinder Pro 'wont be an upgrade from the built in grinder you have in barista express'. Others suggested a DF54 or a Eureka Mignon at a similar price.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {"sourceId": "ozbargain-899121", "locator": "laydownyourtongs, 28/03/2025 16:37; voo123, 25/03/2025 15:33 (DF54); laydownyourtongs, 25/03/2025 14:33 ('Eureka Mignon Manual, or DF54')"}
      ],
      "note": "This is owner opinion, not a measurement. It is the only comment in the thread that directly says the Smart Grinder Pro is no upgrade."
    }
  ]
}
```
