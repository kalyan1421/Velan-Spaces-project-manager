# Feature Plan — Quotation / Proposal PDF Generator (rate-card driven)

> Generate a branded, room-wise quotation PDF (à la the Ram's Group reference) from a
> per-enquiry quote where **amounts auto-calculate from an admin rate card** — the manager
> just picks an item + enters size/qty. Logo watermark on every page.
>
> **Decisions (locked):**
> - **Amount auto-calculates from an admin rate card** (price master maintained once).
> - **Costing by item type:** modular = area (L×H → sq.ft) × rate/sq.ft · accessories =
>   qty × unit price · services = qty × rate per UOM (sq.ft/point/no/rft).
> - **Room/quote templates** pre-load typical rooms + components (biggest step-reducer).
> - Totals auto-apply **discount + GST% + rounding** on top of subtotal → grand total.
> - New in-app builder · lives under **Sales/Leads per enquiry** · **admin uploads cover
>   image** · **client-side** generation (`pdf`+`printing`), **admin + manager** create,
>   clients view only (v1 out of scope).

---

## 0. Why this is "less steps" (the core idea)

The reference proves it: Kitchen Base (5044×900) and Wall (4444×600) units both price at
**~₹1,650/sq.ft**; the Loft unit at **~₹1,350/sq.ft**. Amount is **never typed** — it's
`area × rate`, rate keyed by *component + variant*. So the whole system is:

1. **Admin builds the rate card once** (catalog of items, each with a pricing basis + rates).
2. **Manager builds a quote in ~3 taps per line:** pick item → pick variant → enter size/qty.
   Amount, subtotals, discount, GST and grand total all compute live.
3. **Templates** make most lines appear automatically — manager only adjusts sizes.

---

## 1. Auto-calc formulas (the engine)

| Item type | Pricing basis | Inputs | Formula |
|-----------|---------------|--------|---------|
| Modular component | `area` | L, H (mm) + variant | `sqft = L*H/92903.04`; `amount = round(sqft × rate)` |
| Accessory | `qty` | qty + brand/variant | `amount = round(qty × unitPrice)` |
| Service | `uom` | qty + UOM | `amount = round(qty × ratePerUom)` |

Totals: `sectionSubtotal = Σ line.amount` → `subtotal = Σ sections` →
`afterDiscount = subtotal − discount(₹ or %)` → `grandTotal = round(afterDiscount × (1 + gst%))`.
(1 sq.ft = 304.8 mm/side; rounding to whole ₹ like the reference. GST/discount default on,
both editable/zeroable per quote.)

---

## 2. Data model (Firestore)

### A. Admin defaults — `orgSettings/quotation` (single doc)
```
companyName, phone, email, address · logoUrl · watermarkLogoUrl · coverImageUrl · footerText
defaultTerms · defaultNotIncluded: List<String>
quoteValidityDays · quoteNumberPrefix · defaultProjectType
defaultGstPercent · roundAmounts: bool
```

### B. Rate card / catalog — `catalogItems/{id}` (admin-maintained)
```
name, description
itemType: component | accessory | service
pricingBasis: area | qty | uom
uom?: "Sq.Ft" | "Point" | "No" | "Rft"          // services
defaultSection: "Modular Kitchen" | "Living Room" | …   // for grouping/quick-add
variants: List<{ label, rate }>                 // e.g. {"Carcass • Premium", 1650}, {"Loft • Premium", 1350}
                                                // accessory: label="Hettich", rate=unitPrice
active: bool
```

### C. Templates — `quoteTemplates/{id}` (admin-maintained)
```
name: "Standard 3BHK"
sections: List<{ title, type, lines: List<{ catalogItemId, variantLabel, defaultL, defaultH | defaultQty }> }>
```

### D. Per-quote — `leads/{leadId}/quotes/{quoteId}`
```
quoteNumber · status: draft|sent|accepted|rejected
preparedFor {name,phone,address} · handledBy · designedBy
date · validUntil · enquiryDate · enquiryNo · siteLocation · projectType
notIncluded: List<String>                       // from defaults, editable
sections: List<QuoteSection>
  QuoteSection { title, type, items: List<QuoteItem> }
    QuoteItem { catalogItemId?, name, description, variantLabel,
                L?, H?, qty?, uom?, rate, amount }   // amount stored as computed snapshot
discountType: flat|percent · discountValue · gstPercent
subtotal · grandTotal                            // computed snapshots for the PDF
createdAt · updatedAt · createdBy
```

---

## 3. Surfaces to build

1. **Admin → Rate Card / Catalog** (new): CRUD catalog items with variants + rates; mark active.
2. **Admin → Quote Templates** (new): build templates from catalog items.
3. **Admin → Quotation Settings** (new): company info, logo/watermark/cover upload, default
   terms, not-included, validity, prefix, default GST, rounding.
4. **Lead → Quotes** (admin + manager): list + "Create Quote" (optionally from a template).
5. **Quote builder** (admin + manager): header auto-filled from lead + defaults; sections;
   per line → pick catalog item (search) → variant chip → size/qty → **amount auto-fills**;
   live subtotals; discount + GST fields → live grand total; Save draft.
6. **Generate / preview / share**: "Generate PDF" → `printing` preview → share / print / save.

---

## 4. PDF generation (client-side)
- Packages `pdf` + `printing` in `pubspec.yaml`. `QuotationPdfService.build(settings, quote)`
  → `pw.MultiPage` with a `pw.PageTheme`: `buildBackground` = centered watermark image
  (~0.06 opacity, every page); footer = company line + `Page x/y`.
- Cover image prepended full-bleed. Header page = logo + Prepared By/For + metadata table +
  Not Included. Body = one styled `pw.Table` per section (columns by `section.type`).
  Summary = subtotal, discount, GST, **grand total** + terms + signature.
- Images fetched over HTTP with fallback to bundled `assets/images/logo.png`.
- **⚠️ Embed a Unicode font** (NotoSans/Roboto) — default Helvetica can't render **₹**.

---

## 5. Access control
- **Admin:** rate card + templates + settings + quotes. **Manager:** quotes only.
- **Client/Worker:** none in v1 (later: attach final PDF to project files for client download).

---

## 6. Phased delivery
- **Phase 0 — Settings + Rate Card:** `orgSettings/quotation` + `catalogItems` models,
  datasource, providers; admin Settings screen + Catalog CRUD screen.
- **Phase 1 — Quote model + builder + auto-calc:** Quote/Section/Item entities, the costing
  engine (area/qty/uom + discount/GST/round), Firestore CRUD under leads, builder screen with
  catalog pick → variant → size/qty → live amounts & totals, "Create Quote" from a lead.
- **Phase 2 — Templates:** `quoteTemplates` model + admin template builder + "start from
  template" in the quote builder.
- **Phase 3 — PDF:** add `pdf`+`printing`, embed font, `QuotationPdfService`
  (cover + header + tables + watermark + footer + totals + terms), preview/share/print.
- **Phase 4 — Polish:** quote list & statuses, duplicate, override-amount toggle, attach PDF
  to project for client download.

## 7. Assumptions to confirm during build
- A4 portrait · Indian ₹ grouping (via embedded font) · sq.ft costing (304.8 mm/side).
- Quote number auto-increments per year (`QUO-2026-033`) — counter strategy TBD.
- One global cover image (admin-managed), not per quote.
- GST + discount default on but zeroable per quote; amounts rounded to whole ₹.
