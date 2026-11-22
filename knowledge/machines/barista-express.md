# Barista Express

These claims were researched for the built-in grinder troubleshooter. Breville's instruction booklets could not be read in this research pass because the PDFs failed to extract. The upper-burr procedure is recorded as a gap.

```json
{
  "schemaVersion": 1,
  "id": "barista-express",
  "name": "Barista Express",
  "category": "machines",
  "updatedAt": "2026-11-22",
  "variants": [
    {
      "id": "bes870xl-us",
      "sku": "BES870XL",
      "markets": ["US"]
    }
  ],
  "sources": [
    {
      "id": "breville-us-manual-x26",
      "url": "https://assets.breville.com/BES870/BES870_USCM_IB_X26_LR.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "breville-us-manual-o21",
      "url": "https://assets.breville.com/BES870/BES870_USCM_IB_O21.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "scg-top-burr-blog",
      "url": "https://www.seattlecoffeegear.com/blogs/scg-blog/adjusting-the-top-burr-on-the-breville-barista-express",
      "type": "merchant",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "scg-product-guide",
      "url": "https://www.seattlecoffeegear.com/pages/product-resources/breville-barista-express-espresso-machine-product-guide",
      "type": "merchant",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "ricambi-upper-burr-sp0027464",
      "url": "https://www.ricambi.com.au/breville-barista-express-upper-burr-from-pdc-1926",
      "type": "merchant",
      "accessedAt": "2026-11-22"
    }
  ],
  "claims": [
    {
      "id": "upper-burr-part-sp0027464",
      "statement": "An Australian parts seller lists a Breville upper (outer) burr, part SP0027464, for Barista Express BES870 and Barista Pro BES878 variants, among others. It is only for machines with a 1926 PDC batch date or later (2019 week 26 onwards). The batch date is on the model sticker underneath the machine.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "ricambi-upper-burr-sp0027464",
          "locator": "Product listing: Part No. SP0027464; compatibility list includes 'Breville the Barista Express BES870'; 'MAKE SURE ITS FROM 1926 PDC (2019 Week 26 onwards)'"
        }
      ],
      "note": "This is merchant evidence for a listing only. Search results point to an earlier upper burr (SP0001801) for machines made before July 2019 and to matching lower-burr variants, but I did not fetch those pages. Breville US availability and fitment were not checked."
    },
    {
      "id": "upper-burr-procedure",
      "variantId": "bes870xl-us",
      "statement": "Breville's documented procedure for repositioning the Barista Express upper burr, including the steps, the range of numbered positions, the factory position and any warnings.",
      "status": "unknown",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Not read: PDF text could not be extracted"
        },
        {
          "sourceId": "breville-us-manual-o21",
          "locator": "Not read: PDF text could not be extracted"
        },
        {
          "sourceId": "scg-top-burr-blog",
          "locator": "Steps section (Jan 22, 2025): remove hopper, rotate burr counterclockwise by wire handle, lift out, remove handle, rotate top ring to desired number at red dot, reinstall aligned at 'align' point"
        }
      ],
      "note": "I could not read the Breville booklets. The only readable procedure is from retailer Seattle Coffee Gear, which states no range, no factory default and no warnings. It also says that at the finest setting with fast shots 'you'll want to adjust the burr coarser', which contradicts the purpose of the adjustment. A human needs to supply the booklet page text with page numbers."
    },
    {
      "id": "upper-burr-tool",
      "statement": "Whether repositioning the Barista Express upper burr needs a tool.",
      "status": "disputed",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "scg-product-guide",
          "locator": "Upper burr section: 'using the included Allen key'"
        },
        {
          "sourceId": "scg-top-burr-blog",
          "locator": "Steps: burr is turned with its wire handle, 'with two fingers'; no tool mentioned"
        }
      ],
      "note": "Two Seattle Coffee Gear pages disagree. The product guide mentions an included Allen key, and the blog describes a tool-free wire-handle procedure. This may reflect a difference between production versions. The manufacturer booklet was unreadable."
    }
  ]
}
```
