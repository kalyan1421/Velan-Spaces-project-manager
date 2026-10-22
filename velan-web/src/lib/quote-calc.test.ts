import { describe, expect, it } from "vitest";
import type { CatalogItem, QuoteItem, QuoteTemplate } from "@/lib/api/sales-types";
import {
  SQ_MM_PER_SQ_FT,
  applyTemplate,
  areaSqft,
  blankItem,
  computeQuoteTotals,
  discountAmount,
  itemFromCatalog,
  lineAmount,
  qtyLabel,
  quoteBreakdown,
  quoteSubtotal,
  recomputeItem,
  resolveVariant,
  sectionSubtotal,
  sizeLabel,
  templateLineCount,
  unresolvedTemplateLines,
} from "./quote-calc";

describe("computeQuoteTotals (mirrors velan-backend/src/common/calc.spec.ts)", () => {
  const sections = [{ items: [{ amount: 1000 }, { amount: 500 }] }, { items: [{ amount: 250 }] }];

  it("sums item amounts into subtotal", () => {
    expect(computeQuoteTotals(sections, "amount", 0, 0).subtotal).toBe(1750);
  });

  it("applies a flat-amount discount", () => {
    expect(computeQuoteTotals(sections, "amount", 250, 0).grandTotal).toBe(1500);
  });

  it("applies a percentage discount", () => {
    expect(computeQuoteTotals(sections, "percent", 10, 0).grandTotal).toBe(1575);
  });

  it("applies GST after discount", () => {
    expect(computeQuoteTotals(sections, "amount", 0, 18).grandTotal).toBe(2065);
  });

  it("coerces string amounts and tolerates empty sections", () => {
    const { subtotal, grandTotal } = computeQuoteTotals([{ items: [{ amount: "99.5" }] }, {}], "amount", 0, 0);
    expect(subtotal).toBe(99.5);
    expect(grandTotal).toBe(99.5);
  });

  it("rounds to paise like the API", () => {
    // (1000 − 3%) × 1.18 = 1144.6
    expect(computeQuoteTotals([{ items: [{ amount: 1000 }] }], "percent", 3, 18).grandTotal).toBe(1144.6);
    expect(computeQuoteTotals([{ items: [{ amount: 333.333 }] }], "amount", 0, 0).subtotal).toBe(333.33);
  });
});

describe("line amounts", () => {
  it("converts mm² to sq.ft with 92903.04", () => {
    expect(SQ_MM_PER_SQ_FT).toBeCloseTo(92903.04, 6);
    expect(areaSqft(304.8, 304.8)).toBeCloseTo(1, 10);
    expect(areaSqft(null, 900)).toBe(0);
  });

  it("prices components by area × rate per sq.ft", () => {
    // 5044 × 900 mm = 48.8639… sq.ft × ₹1,450 = ₹70,852.58 → ₹70,853
    expect(lineAmount({ basis: "area", lengthMm: 5044, heightMm: 900, rate: 1450 })).toBe(70853);
    expect(lineAmount({ basis: "area", lengthMm: 5044, heightMm: 900, rate: 1450, round: false })).toBe(70852.58);
  });

  it("prices accessories and services by qty × rate", () => {
    expect(lineAmount({ basis: "qty", qty: 4, rate: 1250 })).toBe(5000);
    expect(lineAmount({ basis: "uom", qty: 12.5, rate: 85 })).toBe(1063); // 1062.5 → 1063
    expect(lineAmount({ basis: "uom", qty: 12.5, rate: 85, round: false })).toBe(1062.5);
  });

  it("treats missing or negative inputs as zero", () => {
    expect(lineAmount({ basis: "qty", qty: null, rate: 100 })).toBe(0);
    expect(lineAmount({ basis: "qty", qty: -2, rate: 100 })).toBe(0);
    expect(lineAmount({ basis: "area", lengthMm: 1000, heightMm: undefined, rate: 100 })).toBe(0);
  });

  it("recomputes an item from its type", () => {
    const item: QuoteItem = { ...blankItem("accessory"), qty: 3, rate: 999.5, amount: 1 };
    expect(recomputeItem(item).amount).toBe(2999); // 2998.5 → 2999
    expect(recomputeItem({ ...item, itemType: "component", lengthMm: 304.8, heightMm: 304.8 }).amount).toBe(1000);
  });
});

describe("subtotals and breakdown", () => {
  const sections = [
    { items: [{ amount: 70852 }, { amount: 5000 }] },
    { items: [{ amount: 1063 }] },
  ];

  it("sums sections", () => {
    expect(sectionSubtotal(sections[0].items)).toBe(75852);
    expect(quoteSubtotal(sections)).toBe(76915);
    expect(quoteSubtotal([])).toBe(0);
  });

  it("computes the discount in rupees", () => {
    expect(discountAmount(2000, "percent", 12.5)).toBe(250);
    expect(discountAmount(2000, "amount", 300)).toBe(300);
  });

  it("matches the API to the paise and rounds the shown total to the rupee", () => {
    const b = quoteBreakdown({ sections, discountType: "percent", discountValue: 5, gstPercent: 18 });
    const api = computeQuoteTotals(sections, "percent", 5, 18);
    expect(b.subtotal).toBe(api.subtotal);
    expect(b.grandTotal).toBe(api.grandTotal);
    expect(b.discount).toBe(3845.75);
    expect(b.taxable).toBe(73069.25);
    expect(b.gstAmount).toBe(13152.47);
    expect(b.payable).toBe(86222);
    expect(b.roundOff).toBe(0.28);
    expect(Math.abs(b.payable - api.grandTotal)).toBeLessThan(1);
  });

  it("keeps paise when rounding is off", () => {
    const b = quoteBreakdown({ sections: [{ items: [{ amount: 100 }] }], discountType: "amount", discountValue: 0, gstPercent: 18, round: false });
    expect(b.payable).toBe(118);
    expect(b.roundOff).toBe(0);
  });

  it("matches the API's quoteBreakdown spec cases", () => {
    // velan-backend/src/common/calc.spec.ts › quoteBreakdown
    const sections = [{ items: [{ amount: 1000 }, { amount: 500.5 }] }];
    expect(quoteBreakdown({ sections, discountType: "percent", discountValue: 10, gstPercent: 18, round: true })).toEqual({
      subtotal: 1500.5,
      discount: 150.05,
      taxable: 1350.45,
      gstAmount: 243.08,
      grandTotal: 1593.53,
      roundOff: 0.47,
      payable: 1594,
    });
    const flat = quoteBreakdown({ sections, discountType: "amount", discountValue: 0.5, gstPercent: 0, round: false });
    expect(flat.payable).toBe(1500);
    expect(flat.roundOff).toBe(0);
    expect(flat.gstAmount).toBe(0);
  });
});

const catalog: CatalogItem[] = [
  {
    id: "c-base",
    name: "Base unit",
    description: "BWP ply carcass",
    itemType: "component",
    uom: null,
    defaultSection: "Modular Kitchen",
    variants: [
      { label: "Carcass • Standard", rate: 1200 },
      { label: "Carcass • Premium", rate: 1450 },
    ],
    active: true,
  },
  {
    id: "c-hinge",
    name: "Soft-close hinge",
    description: null,
    itemType: "accessory",
    uom: null,
    defaultSection: null,
    variants: [{ label: "Hettich", rate: 450 }],
    active: true,
  },
  {
    id: "c-paint",
    name: "Wall painting",
    description: "Two coats",
    itemType: "service",
    uom: "Sq.Ft",
    defaultSection: "Civil",
    variants: [{ label: "Emulsion", rate: 18 }],
    active: true,
  },
];

describe("catalog picks", () => {
  it("resolves a variant by label, falling back to the first", () => {
    expect(resolveVariant(catalog[0], "Carcass • Premium")?.rate).toBe(1450);
    expect(resolveVariant(catalog[0], "Gone")?.label).toBe("Carcass • Standard");
    expect(resolveVariant({ variants: [] }, "x")).toBeNull();
  });

  it("builds a component line with size only", () => {
    const item = itemFromCatalog(catalog[0], { variantLabel: "Carcass • Premium", lengthMm: 5044, heightMm: 900, qty: 7 });
    expect(item).toMatchObject({
      catalogItemId: "c-base",
      name: "Base unit",
      description: "BWP ply carcass",
      itemType: "component",
      variantLabel: "Carcass • Premium",
      lengthMm: 5044,
      heightMm: 900,
      qty: null,
      rate: 1450,
      amount: 70853,
    });
  });

  it("builds a service line with qty and its UOM", () => {
    const item = itemFromCatalog(catalog[2], { qty: 400, lengthMm: 10 });
    expect(item).toMatchObject({ lengthMm: null, heightMm: null, qty: 400, uom: "Sq.Ft", rate: 18, amount: 7200 });
  });

  it("formats sizes and quantities", () => {
    expect(sizeLabel({ lengthMm: 5044.9, heightMm: 900 })).toBe("5044(L) × 900(H)");
    expect(sizeLabel({ lengthMm: null, heightMm: 900 })).toBe("");
    expect(qtyLabel(3)).toBe("3");
    expect(qtyLabel(2.5)).toBe("2.50");
    expect(qtyLabel(null)).toBe("");
  });
});

describe("applyTemplate", () => {
  const template: QuoteTemplate = {
    id: "t1",
    name: "Standard 2BHK",
    sections: [
      {
        title: "Modular Kitchen",
        type: "component",
        lines: [
          {
            catalogItemId: "c-base",
            name: "Base unit (old name)",
            itemType: "component",
            variantLabel: "Carcass • Premium",
            defaultLengthMm: 3000,
            defaultHeightMm: 850,
            defaultQty: null,
            uom: "",
          },
          {
            catalogItemId: "c-base",
            name: "Base unit",
            itemType: "component",
            variantLabel: "Retired variant",
            defaultLengthMm: 1000,
            defaultHeightMm: 1000,
            defaultQty: null,
            uom: "",
          },
        ],
      },
      {
        title: "Hardware",
        type: "accessory",
        lines: [
          {
            catalogItemId: "c-hinge",
            name: "Hinge",
            itemType: "accessory",
            variantLabel: "Hettich",
            defaultLengthMm: null,
            defaultHeightMm: null,
            defaultQty: 12,
            uom: "",
          },
          {
            catalogItemId: "c-deleted",
            name: "Tandem box",
            itemType: "accessory",
            variantLabel: "Blum",
            defaultLengthMm: null,
            defaultHeightMm: null,
            defaultQty: 2,
            uom: "No",
          },
        ],
      },
    ],
  };

  it("prices lines from the current rate card", () => {
    const sections = applyTemplate(template, catalog);
    expect(sections.map((s) => [s.title, s.type, s.items.length])).toEqual([
      ["Modular Kitchen", "component", 2],
      ["Hardware", "accessory", 2],
    ]);
    const [kitchen, hardware] = sections;
    // 3000 × 850 / 92903.04 = 27.448… sq.ft × 1450 = 39,799.56 → 39,800
    expect(kitchen.items[0]).toMatchObject({ name: "Base unit", rate: 1450, amount: 39800, lengthMm: 3000, qty: null });
    // Unknown variant → first variant (₹1,200 × 10.7639 sq.ft = 12,916.69 → 12,917)
    expect(kitchen.items[1]).toMatchObject({ variantLabel: "Carcass • Standard", rate: 1200, amount: 12917 });
    expect(hardware.items[0]).toMatchObject({ name: "Soft-close hinge", qty: 12, rate: 450, amount: 5400, lengthMm: null });
  });

  it("keeps a missing catalog item as a zero-rate snapshot", () => {
    const missing = applyTemplate(template, catalog)[1].items[1];
    expect(missing).toMatchObject({ catalogItemId: "c-deleted", name: "Tandem box", qty: 2, uom: "No", rate: 0, amount: 0 });
    expect(unresolvedTemplateLines(template, catalog)).toEqual(["Tandem box"]);
  });

  it("follows the rounding setting", () => {
    const exact = applyTemplate(template, catalog, { round: false });
    expect(exact[0].items[0].amount).toBe(39799.56);
  });

  it("counts lines", () => {
    expect(templateLineCount(template)).toBe(4);
    expect(applyTemplate({ sections: [] }, catalog)).toEqual([]);
  });
});
