# Barista Express

These claims were researched for the built-in grinder troubleshooter. The current US instruction booklet (BES870 USCM X26) was read page by page. It documents the upper-burr adjustment, but it does not give the number range, a factory position or a burr-contact warning.

```json
{
  "schemaVersion": 1,
  "id": "barista-express",
  "name": "Barista Express",
  "category": "machines",
  "updatedAt": "2026-11-23",
  "variants": [
    {
      "id": "bes870xl-us",
      "sku": "BES870XL",
      "markets": [
        "US"
      ],
      "name": "Breville Barista Express",
      "brand": "Breville"
    },
    {
      "id": "ses875-gb",
      "sku": "SES875",
      "markets": [
        "GB"
      ],
      "name": "Sage the Barista Express",
      "brand": "Sage"
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
    },
    {
      "id": "ricambi-upper-burr-sp0001801",
      "url": "https://www.ricambi.com.au/breville-coffee-machine-outer-upper-burr-grinder-k",
      "type": "merchant",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "sage-uk-bes875",
      "url": "https://www.sageappliances.com/en-gb/product/BES875",
      "type": "manufacturer",
      "accessedAt": "2026-11-23"
    }
  ],
  "claims": [
    {
      "id": "grind-dial-1-finest-16-coarsest",
      "variantId": "bes870xl-us",
      "statement": "On the Barista Express GRIND SIZE selector, a smaller number is finer and a larger number is coarser. Setting 1 is the finest and 16 is the coarsest. Breville recommends starting at setting 5 and adjusting as required.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 12, 'Setting the Grind Size' ('We recommend you start at setting 5'); page 24, 'Advanced Cleaning' steps 2 and 4 ('1' (finest), '16' (coarsest))"
        }
      ]
    },
    {
      "id": "upper-burr-adjustment-documented",
      "variantId": "bes870xl-us",
      "statement": "Breville's US booklet calls the adjustable upper burr 'a feature of your Barista Express' that extends the grind range, because 'some types of coffee may require a wider grind range'. Its 15-step illustrated procedure is: unlock the hopper, empty the beans into a container, refit the hopper and run the grinder empty, remove the hopper, remove the upper burr, remove its wire handle, move the adjustable top burr one number coarser or finer, align the number with the handle opening, refit the handle, push the burr in firmly and lock it, refit and lock the hopper, then check the extraction. Breville recommends making only one adjustment at a time.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 21, 'Adjusting Conical Burrs': intro text and illustrated steps 1–15"
        }
      ],
      "note": "The booklet text gives no number range, factory position or burr-contact warning."
    },
    {
      "id": "baskets-single-vs-dual-wall",
      "variantId": "bes870xl-us",
      "statement": "Breville says to use single-wall filter baskets when grinding fresh whole beans, because they let you experiment with grind, dose and tamp. Dual-wall baskets are for pre-ground coffee and 'regulate the pressure and help to optimize the extraction regardless of the grind, dose, tamp pressure or freshness'. Its troubleshooting table lists single-wall baskets used with pre-ground coffee as a cause of no crema.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 17, 'Selecting a Filter Basket'; page 30, Troubleshooting 'No crema'"
        }
      ]
    },
    {
      "id": "dose-and-extraction-targets",
      "variantId": "bes870xl-us",
      "statement": "Breville's extraction guide gives a balanced dose of 8–11 g (1 cup) or 16–19 g (2 cup), a 22–33 lb tamp and a 25–30 second shot. An under-extracted shot starts flowing after 1–6 seconds, runs fast like water and finishes in up to 20 seconds, tasting bitter or sharp, weak and watery. The fixes are a finer grind size and a larger grind amount. As a dose guide, the tamper's metal cap should sit level with the basket rim after tamping.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 20, 'Extraction Guide' (Under Extraction column and summary table); page 13, Note on tamper cap level"
        }
      ]
    },
    {
      "id": "troubleshooting-runs-too-quickly",
      "variantId": "bes870xl-us",
      "statement": "The Barista Express troubleshooting table lists three causes for 'Espresso runs out too quickly': coffee ground too coarsely (use a slightly finer grind), not enough coffee in the basket (increase the dose, then trim with the Razor tool), and coffee tamped too lightly (tamp at 22–33 lb). It does not list the burrs or the upper-burr position as a cause.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 28, Troubleshooting, 'Espresso runs out too quickly'"
        }
      ]
    },
    {
      "id": "beans-roasted-on-5-20-days",
      "variantId": "bes870xl-us",
      "statement": "In its 'No crema' troubleshooting row, Breville advises using freshly roasted beans with a 'Roasted On' date and consuming them 5–20 days after that date. For pre-ground coffee, it says to use it within a week of grinding.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 30, Troubleshooting 'No crema', cause 'Coffee beans or pre-ground coffee are not fresh'"
        }
      ]
    },
    {
      "id": "burr-cleaning-cycle",
      "variantId": "bes870xl-us",
      "statement": "Breville's grinder cleaning procedure involves emptying and running the grinder empty, then removing the top burr and brushing both burrs and the chute. Breville says it 'removes oil build-up on the burrs which can impede performance'. Advanced cleaning (removing the lower burr with a 10 mm socket) is 'only required if there is a blockage', and the booklet warns that the burrs are extremely sharp.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 24, 'Cleaning the Conical Burr Grinder' steps 1–12, 'Advanced Cleaning' intro, steps and Warning"
        }
      ]
    },
    {
      "id": "no-green-or-under-roasted-beans",
      "variantId": "bes870xl-us",
      "statement": "Breville says the machine is designed only for whole roasted beans. It warns against grinding unroasted green or under-roasted beans, which can damage or break burr grinders.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 12, 'Setting the Grind Size' Note"
        }
      ]
    },
    {
      "id": "warranty-scope",
      "variantId": "bes870xl-us",
      "statement": "The booklet's Limited Product Warranty paragraph says Breville's warranty 'covers the repair or replacement if it's found to be defective due to faulty materials, workmanship, or function within the warranty period'. For the warranty length and full terms, it refers owners to breville.com or the Breville Service Center.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 2, 'Limited Product Warranty'"
        }
      ],
      "note": "The booklet says nothing about whether adjusting or replacing the burrs affects the warranty, and the full terms on breville.com were not read."
    },
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
      "note": "This is merchant evidence for a listing only. Breville US availability and fitment were not checked. For older machines, see upper-burr-part-sp0001801."
    },
    {
      "id": "upper-burr-part-sp0001801",
      "statement": "The same Australian parts seller lists an earlier upper burr kit, part SP0001801, as 'the PRE 1926 PDC burr', and tells buyers to check the production date code before purchasing. Its 'Suits' list includes the Barista Express BES870. Barista Express owners therefore need to know their batch date before ordering an upper burr.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "ricambi-upper-burr-sp0001801",
          "locator": "Product listing: 'Part No: SP0001801'; 'This is the PRE 1926 PDC burr, please check your production date code before purchasing'; Suits list includes 'Breville the Barista Express BES870'"
        }
      ],
      "note": "This is merchant evidence only (AUD RRP $184.95 at access). Search snippets say other sellers (PartSelect, ECS US) list SP0001801 for the BES870XL, but those pages were not read (ECS returned 429), so US price and availability are unverified."
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
          "locator": "Page 21, 'Adjusting Conical Burrs'"
        },
        {
          "sourceId": "breville-us-manual-o21",
          "locator": "Not read: PDF text could not be extracted (earlier pass)"
        },
        {
          "sourceId": "scg-top-burr-blog",
          "locator": "Steps section (Jan 22, 2025): remove hopper, rotate burr counterclockwise by wire handle, lift out, remove handle, rotate top ring to desired number at red dot, reinstall aligned at 'align' point"
        }
      ],
      "note": "Partly resolved on 2026-11-22. The steps and the one-adjustment-at-a-time advice are now supported in upper-burr-adjustment-documented. The X26 booklet still gives no number range, factory position or warnings, so this claim stays unknown for those parts. The Seattle Coffee Gear blog also says to go 'coarser' when shots are fast at the finest setting, which contradicts the purpose of the adjustment."
    },
    {
      "id": "upper-burr-factory-position",
      "variantId": "bes870xl-us",
      "statement": "The factory upper-burr position on the Barista Express.",
      "status": "unknown",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 21, 'Adjusting Conical Burrs': no factory position stated"
        }
      ],
      "note": "The booklet does not state it. Search snippets (Tom's Guide, Home-Barista) say 6, but those pages were not readable and are not manufacturer sources. A snippet attributed to PERC Coffee says older Barista Express units had a non-adjustable upper burr, but the fetched PERC page did not contain that text."
    },
    {
      "id": "upper-burr-tool",
      "statement": "Repositioning the Barista Express upper burr needs no tool: Breville's procedure uses the burr's own wire handle. The Allen key included with the machine is described in the booklet for replacing the shower-screen seal.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-x26",
          "locator": "Page 21, 'Adjusting Conical Burrs' steps 6–12 (no tool shown); page 26, 'Using the Allen Key' (shower screen seal)"
        },
        {
          "sourceId": "scg-top-burr-blog",
          "locator": "Steps: burr is turned with its wire handle, 'with two fingers'; no tool mentioned"
        }
      ],
      "note": "This claim was previously disputed between two Seattle Coffee Gear pages: the product guide mentions using 'the included Allen key' for the upper burr, and the blog describes a tool-free procedure. The manufacturer booklet resolves it in favour of tool-free; in the booklet the Allen key is for the shower-screen seal."
    }
  ]
}
```
