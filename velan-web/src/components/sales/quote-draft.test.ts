import { describe, expect, it } from "vitest";
import { normalizeQuote, normalizeSettings, type CatalogItem, type Lead } from "@/lib/api/sales-types";
import { applyTemplate, itemFromCatalog, quoteBreakdown } from "@/lib/quote-calc";
import {
  addDays,
  addLine,
  addSection,
  draftFingerprint,
  draftFromQuote,
  draftToInput,
  duplicateLine,
  insertSections,
  lineCount,
  moveSection,
  newQuoteInput,
  previewQuote,
  removeLine,
  removeSection,
  splitLines,
  updateLine,
  updateSection,
  type QuoteDraft,
} from "./quote-draft";
import { quoteDraftIssues } from "./quote-form-schema";

const base: CatalogItem = {
  id: "c-base",
  name: "Base unit",
  description: "BWP ply",
  itemType: "component",
  uom: null,
  defaultSection: "Kitchen",
  variants: [
    { label: "Standard", rate: 1200 },
    { label: "Premium", rate: 1450 },
  ],
  active: true,
};
const hinge: CatalogItem = { ...base, id: "c-hinge", name: "Hinge", description: null, itemType: "accessory", variants: [{ label: "Hettich", rate: 450 }] };

// Shape as the API returns it: numerics as strings, mobile's `flat` discount, camelCase jsonb.
const apiRow = {
  id: "q1",
  leadId: "l1",
  quoteNumber: "QUO-2026-0007",
  status: "draft",
  preparedForName: "Asha",
  preparedForPhone: "98765 43210",
  quoteDate: "2026-10-22T00:00:00+00:00",
  validUntil: "2026-11-06T00:00:00+00:00",
  enquiryDate: null,
  projectType: "Residential",
  notIncluded: ["Electrical work", "Civil work"],
  sections: [
    {
      title: "Modular Kitchen",
      type: "component",
      items: [{ catalogItemId: "c-base", name: "Base unit", itemType: "component", variantLabel: "Premium", lengthMm: 3000, heightMm: 850, qty: null, rate: 1450, amount: 39800 }],
    },
  ],
  discountType: "flat",
  discountValue: "500.00",
  gstPercent: "18.00",
  subtotal: "39800.00",
  grandTotal: "46374.00",
  createdAt: "2026-10-22T06:00:00Z",
};

function draft(): QuoteDraft {
  return draftFromQuote(normalizeQuote(apiRow));
}

describe("draftFromQuote / draftToInput", () => {
  it("normalizes an API row into an editable draft", () => {
    const d = draft();
    expect(d).toMatchObject({
      status: "draft",
      preparedForName: "Asha",
      quoteDate: "2026-10-22",
      validUntil: "2026-11-06",
      enquiryDate: "",
      notIncludedText: "Electrical work\nCivil work",
      discountType: "amount",
      discountValue: 500,
      gstPercent: 18,
    });
    expect(d.sections[0].items[0].key).toBeTruthy();
  });

  it("round-trips to a PATCH body without React keys", () => {
    const input = draftToInput(draft());
    expect(input.sections?.[0].items[0]).not.toHaveProperty("key");
    expect(input).toMatchObject({
      quoteDate: "2026-10-22",
      enquiryDate: null,
      notIncluded: ["Electrical work", "Civil work"],
      discountType: "amount",
      discountValue: 500,
    });
  });

  it("drops unpicked lines and recomputes amounts on save", () => {
    let d = draft();
    const sectionKey = d.sections[0].key;
    d = addLine(d, sectionKey).draft;
    const stale = { ...d.sections[0].items[0], amount: 1 };
    d = { ...d, sections: [{ ...d.sections[0], items: [stale, d.sections[0].items[1]] }] };
    const items = draftToInput(d).sections![0].items;
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(39800);
  });

  it("splits not-included lines and strips bullets", () => {
    expect(splitLines(" - Electrical\n\n• Civil work \n* Loft")).toEqual(["Electrical", "Civil work", "Loft"]);
  });

  it("fingerprint ignores keys and empty lines", () => {
    const d = draft();
    const withBlank = addLine(d, d.sections[0].key).draft;
    expect(draftFingerprint(withBlank)).toBe(draftFingerprint(d));
    expect(draftFingerprint(updateSection(d, d.sections[0].key, { title: "Kitchen" }))).not.toBe(draftFingerprint(d));
  });
});

describe("section and line edits", () => {
  it("adds, renames, moves and removes sections", () => {
    let d = addSection(draft(), "  Hardware ", "accessory");
    expect(d.sections.map((s) => s.title)).toEqual(["Modular Kitchen", "Hardware"]);
    expect(d.sections[1].items).toHaveLength(1);
    expect(d.sections[1].items[0].qty).toBe(1);
    const hw = d.sections[1].key;
    d = moveSection(d, hw, -1);
    expect(d.sections[0].title).toBe("Hardware");
    expect(moveSection(d, hw, -1)).toBe(d);
    d = removeSection(d, hw);
    expect(d.sections.map((s) => s.title)).toEqual(["Modular Kitchen"]);
  });

  it("inserts a line after another and returns its key", () => {
    const d = draft();
    const s = d.sections[0];
    const { draft: next, key } = addLine(d, s.key, s.items[0].key);
    expect(next.sections[0].items[1].key).toBe(key);
    expect(addLine(d, "nope")).toEqual({ draft: d, key: null });
  });

  it("updates a line from a rate-card pick and recomputes", () => {
    let d = addSection(draft(), "Hardware", "accessory");
    const s = d.sections[1];
    d = updateLine(d, s.key, s.items[0].key, itemFromCatalog(hinge, { qty: 4 }));
    expect(d.sections[1].items[0]).toMatchObject({ name: "Hinge", qty: 4, rate: 450, amount: 1800 });
    d = updateLine(d, s.key, s.items[0].key, { qty: 10 });
    expect(d.sections[1].items[0].amount).toBe(4500);
    expect(d.sections[1].items[0].key).toBe(s.items[0].key);
  });

  it("duplicates and removes lines", () => {
    let d = draft();
    const s = d.sections[0];
    d = duplicateLine(d, s.key, s.items[0].key);
    expect(d.sections[0].items).toHaveLength(2);
    expect(d.sections[0].items[1].key).not.toBe(s.items[0].key);
    expect(lineCount(d)).toBe(2);
    d = removeLine(d, s.key, s.items[0].key);
    expect(d.sections[0].items).toHaveLength(1);
  });

  it("appends or replaces template sections", () => {
    const sections = applyTemplate(
      { sections: [{ title: "Wardrobe", type: "component", lines: [{ catalogItemId: "c-base", name: "", itemType: "component", variantLabel: "Standard", defaultLengthMm: 1000, defaultHeightMm: 2100, defaultQty: null, uom: "" }] }] },
      [base],
    );
    expect(insertSections(draft(), sections, "append").sections.map((s) => s.title)).toEqual(["Modular Kitchen", "Wardrobe"]);
    expect(insertSections(draft(), sections, "replace").sections.map((s) => s.title)).toEqual(["Wardrobe"]);
  });

  it("live totals follow the draft", () => {
    const d = draft();
    const b = quoteBreakdown({ sections: d.sections, discountType: d.discountType, discountValue: d.discountValue, gstPercent: d.gstPercent });
    // (39800 − 500) × 1.18 = 46374
    expect(b.payable).toBe(46374);
  });
});

describe("previewQuote", () => {
  it("applies the draft over the saved quote with API totals", () => {
    const saved = normalizeQuote(apiRow);
    const d = { ...draft(), preparedForName: "Asha R", discountValue: 0, gstPercent: 0, projectType: "" };
    const p = previewQuote(saved, d);
    expect(p).toMatchObject({
      id: "q1",
      quoteNumber: "QUO-2026-0007",
      preparedForName: "Asha R",
      projectType: "Residential",
      quoteDate: "2026-10-22",
      subtotal: 39800,
      grandTotal: 39800,
    });
    expect(p.sections[0].items[0]).not.toHaveProperty("key");
  });
});

describe("quoteDraftIssues", () => {
  it("passes a valid draft", () => {
    expect(quoteDraftIssues(draft(), 39800)).toEqual({});
  });

  it("flags missing prepared-for name, bad email and date order", () => {
    const issues = quoteDraftIssues({ ...draft(), preparedForName: " ", preparedForEmail: "nope", validUntil: "2026-10-01" }, 39800);
    expect(Object.keys(issues).sort()).toEqual(["preparedForEmail", "preparedForName", "validUntil"]);
  });

  it("requires a project type and caps not-included items", () => {
    expect(quoteDraftIssues({ ...draft(), projectType: " " }, 39800).projectType).toBeDefined();
    const many = Array.from({ length: 51 }, (_, i) => `Item ${i}`).join("\n");
    expect(quoteDraftIssues({ ...draft(), notIncludedText: many }, 39800).notIncludedText).toMatch(/50/);
    expect(draftToInput({ ...draft(), projectType: "" })).not.toHaveProperty("projectType");
  });

  it("checks discount and GST ranges", () => {
    expect(quoteDraftIssues({ ...draft(), discountType: "percent", discountValue: 120 }, 39800).discountValue).toMatch(/100/);
    expect(quoteDraftIssues({ ...draft(), discountValue: 50000 }, 39800).discountValue).toMatch(/larger/);
    expect(quoteDraftIssues({ ...draft(), discountValue: -1 }, 39800).discountValue).toMatch(/negative/);
    expect(quoteDraftIssues({ ...draft(), gstPercent: 101 }, 39800).gstPercent).toMatch(/100/);
    expect(quoteDraftIssues({ ...draft(), gstPercent: Number.NaN }, 39800).gstPercent).toBeDefined();
  });

  it("flags unnamed sections and lines without size or qty", () => {
    let d = updateSection(draft(), draft().sections[0].key, { title: "" });
    d = { ...d, sections: [{ ...d.sections[0], title: "" }] };
    const sKey = d.sections[0].key;
    const iKey = d.sections[0].items[0].key;
    d = updateLine(d, sKey, iKey, { lengthMm: null });
    d = addSection(d, "Hardware", "accessory");
    const hw = d.sections[1];
    d = updateLine(d, hw.key, hw.items[0].key, { ...itemFromCatalog(hinge), qty: 0 });
    const issues = quoteDraftIssues(d, 0);
    expect(issues[`section:${sKey}`]).toBeDefined();
    expect(issues[`line:${iKey}:lengthMm`]).toBeDefined();
    expect(issues[`line:${iKey}:heightMm`]).toBeUndefined();
    expect(issues[`line:${hw.items[0].key}:qty`]).toBeDefined();
  });

  it("ignores unpicked lines", () => {
    const d = draft();
    expect(quoteDraftIssues(addLine(d, d.sections[0].key).draft, 39800)).toEqual({});
  });
});

describe("newQuoteInput", () => {
  const lead: Lead = {
    id: "l1",
    clientName: " Asha ",
    clientPhone: "98765 43210",
    area: "Adyar",
    projectType: "",
    source: "website",
    estimatedBudget: null,
    notes: null,
    status: "new",
    assignedManagerId: null,
    createdAt: "2026-10-20T20:00:00Z",
  };

  it("prefills from the lead and the quotation settings", () => {
    const settings = normalizeSettings({ quoteValidityDays: 15, defaultGstPercent: "18", defaultNotIncluded: ["Civil"], defaultProjectType: "Residential" });
    expect(newQuoteInput({ lead, settings, handledBy: "Meena", today: "2026-10-22" })).toEqual({
      leadId: "l1",
      status: "draft",
      preparedForName: "Asha",
      preparedForPhone: "98765 43210",
      preparedForEmail: "",
      preparedForAddress: "",
      handledBy: "Meena",
      designedBy: "",
      quoteDate: "2026-10-22",
      validUntil: "2026-11-06",
      // 20:00 UTC on the 20th is the 21st in India.
      enquiryDate: "2026-10-21",
      enquiryNo: "",
      siteLocation: "Adyar",
      projectType: "Residential",
      notIncluded: ["Civil"],
      sections: [],
      discountType: "amount",
      discountValue: 0,
      gstPercent: 18,
    });
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-25", 15)).toBe("2027-01-09");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
