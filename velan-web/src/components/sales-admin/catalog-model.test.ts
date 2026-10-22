import { describe, expect, it } from "vitest";
import type { CatalogItem, QuoteTemplate } from "@/lib/api/sales-types";
import {
  areaSqft,
  countByType,
  filterCatalog,
  formatRate,
  groupCatalog,
  lineAmount,
  rateRange,
  resolveVariant,
  sectionSuggestions,
  templatesUsingItem,
} from "./catalog-model";

const item = (over: Partial<CatalogItem>): CatalogItem => ({
  id: "x",
  name: "Item",
  description: "",
  itemType: "component",
  uom: "",
  defaultSection: "",
  variants: [{ label: "Carcass • Premium", rate: 1650 }],
  active: true,
  createdAt: undefined,
  ...over,
});

const catalog: CatalogItem[] = [
  item({ id: "c1", name: "Wall Unit", defaultSection: "Modular Kitchen" }),
  item({ id: "c2", name: "Base Unit", defaultSection: "Modular Kitchen", description: "Lower cabinet" }),
  item({ id: "c3", name: "Wardrobe", defaultSection: "Bedroom", active: false }),
  item({ id: "c4", name: "Loose shelf", defaultSection: "" }),
  item({ id: "a1", name: "Hinge", itemType: "accessory", variants: [{ label: "Hettich", rate: 450 }, { label: "Hafele", rate: 380 }] }),
  item({ id: "s1", name: "Electrical point", itemType: "service", uom: "Point", variants: [{ label: "Standard", rate: 450 }] }),
];

describe("filterCatalog", () => {
  it("matches every word across name, description, section and variant labels (accent/case-insensitive)", () => {
    expect(filterCatalog(catalog, { query: "kitchen lower" }).map((i) => i.id)).toEqual(["c2"]);
    expect(filterCatalog(catalog, { query: "HETTICH" }).map((i) => i.id)).toEqual(["a1"]);
    expect(filterCatalog(catalog, { query: "  " })).toHaveLength(catalog.length);
  });

  it("filters by type and status", () => {
    expect(filterCatalog(catalog, { type: "service" }).map((i) => i.id)).toEqual(["s1"]);
    expect(filterCatalog(catalog, { status: "inactive" }).map((i) => i.id)).toEqual(["c3"]);
    expect(filterCatalog(catalog, { type: "component", status: "active" })).toHaveLength(3);
  });

  it("counts by type", () => {
    expect(countByType(catalog)).toEqual({ all: 6, component: 4, accessory: 1, service: 1 });
  });
});

describe("groupCatalog", () => {
  it("groups by type then section, unlabelled last, items alphabetical, empty types dropped", () => {
    const groups = groupCatalog(catalog.filter((i) => i.itemType !== "accessory"));
    expect(groups.map((g) => g.type)).toEqual(["component", "service"]);
    expect(groups[0].sections.map((s) => s.section)).toEqual(["Bedroom", "Modular Kitchen", "Other"]);
    expect(groups[0].sections[1].items.map((i) => i.name)).toEqual(["Base Unit", "Wall Unit"]);
    expect(groups[0].count).toBe(4);
  });

  it("suggests distinct sections, optionally per type", () => {
    expect(sectionSuggestions(catalog)).toEqual(["Bedroom", "Modular Kitchen"]);
    expect(sectionSuggestions(catalog, "service")).toEqual([]);
  });
});

describe("rates", () => {
  it("formats per-unit rates by type", () => {
    expect(formatRate(1650, "component")).toBe("₹1,650/sq.ft");
    expect(formatRate(450, "accessory")).toBe("₹450/unit");
    expect(formatRate(45, "service", "Rft")).toBe("₹45/Rft");
  });

  it("shows a range across variants", () => {
    expect(rateRange(catalog[4])).toBe("₹380 – ₹450/unit");
    expect(rateRange(catalog[0])).toBe("₹1,650/sq.ft");
    expect(rateRange(item({ variants: [] }))).toBe("No rates");
  });
});

describe("pricing (matches the mobile QuoteCalculator)", () => {
  it("converts mm² to sq.ft", () => {
    expect(areaSqft(304.8, 304.8)).toBeCloseTo(1, 10);
  });

  it("prices components by area and the rest by quantity, rounded to rupees", () => {
    // 600 × 720 mm = 4.65001 sq.ft × 1650 = 7672.515… → 7673
    expect(lineAmount({ type: "component", lengthMm: 600, heightMm: 720, rate: 1650 })).toBe(7673);
    expect(lineAmount({ type: "component", lengthMm: 600, heightMm: 720, rate: 1650, round: false })).toBeCloseTo(7672.515, 3);
    expect(lineAmount({ type: "accessory", qty: 4, rate: 450 })).toBe(1800);
    expect(lineAmount({ type: "service", qty: 12, rate: 450 })).toBe(5400);
    expect(lineAmount({ type: "component", rate: 1650 })).toBe(0);
  });

  it("resolves a variant by label, falling back to the first", () => {
    expect(resolveVariant(catalog[4], "Hafele")?.rate).toBe(380);
    expect(resolveVariant(catalog[4], "Gone")?.label).toBe("Hettich");
    expect(resolveVariant(item({ variants: [] }), "x")).toBeNull();
    expect(resolveVariant(undefined, "x")).toBeNull();
  });
});

describe("templatesUsingItem", () => {
  it("finds templates with a line for the item", () => {
    const t = (id: string, ids: string[]): QuoteTemplate => ({
      id,
      name: id,
      createdAt: undefined,
      sections: [
        {
          title: "Kitchen",
          type: "component",
          lines: ids.map((catalogItemId) => ({
            catalogItemId,
            name: "",
            itemType: "component",
            variantLabel: "",
            defaultLengthMm: null,
            defaultHeightMm: null,
            defaultQty: null,
            uom: "",
          })),
        },
      ],
    });
    expect(templatesUsingItem([t("a", ["c1"]), t("b", ["c2"]), t("c", ["c1", "c2"])], "c1").map((x) => x.id)).toEqual([
      "a",
      "c",
    ]);
  });
});
