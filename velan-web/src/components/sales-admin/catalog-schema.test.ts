import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/lib/api/sales-types";
import {
  catalogItemFormDefaults,
  catalogItemFormSchema,
  formatRateInput,
  parseRate,
  toCatalogItemBody,
  type CatalogItemFormValues,
} from "./catalog-schema";

const base = (over: Partial<CatalogItemFormValues> = {}): CatalogItemFormValues => ({
  itemType: "component",
  name: "Kitchen Base Unit",
  description: "",
  defaultSection: "Modular Kitchen",
  uom: "",
  active: true,
  variants: [{ label: "Carcass • Premium", rate: "1,650" }],
  ...over,
});

const issues = (values: CatalogItemFormValues) => {
  const r = catalogItemFormSchema.safeParse(values);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("parseRate", () => {
  it("accepts grouped, prefixed and decimal rates", () => {
    expect(parseRate("1,650")).toEqual({ ok: true, value: 1650 });
    expect(parseRate("₹ 1,950.50")).toEqual({ ok: true, value: 1950.5 });
    expect(parseRate("Rs. 300/-")).toEqual({ ok: true, value: 300 });
  });

  it("allows ₹0 but rejects empty, negative, non-numeric and over-precise rates", () => {
    expect(parseRate("0")).toEqual({ ok: true, value: 0 });
    expect(parseRate("")).toMatchObject({ ok: false, error: "Enter a rate." });
    expect(parseRate("-5")).toMatchObject({ ok: false, error: "Rate can't be negative." });
    expect(parseRate("12a")).toMatchObject({ ok: false });
    expect(parseRate("1.234")).toMatchObject({ ok: false, error: "Use at most 2 decimal places." });
    expect(parseRate("1000000001")).toMatchObject({ ok: false, error: "That rate is too large." });
  });

  it("round-trips through the input format", () => {
    expect(formatRateInput(1650)).toBe("1,650");
    expect(parseRate(formatRateInput(123456.5))).toEqual({ ok: true, value: 123456.5 });
  });
});

describe("catalogItemFormSchema", () => {
  it("accepts a valid component", () => {
    expect(issues(base())).toEqual({});
  });

  it("requires a name and at least one priced option", () => {
    const e = issues(base({ name: "  ", variants: [] }));
    expect(e.name).toBe("Enter a name.");
    expect(e.variants).toMatch(/at least one variant/);
  });

  it("uses the type's word for options (brand for accessories)", () => {
    const e = issues(base({ itemType: "accessory", variants: [{ label: "", rate: "450" }] }));
    expect(e["variants.0.label"]).toBe("Name this brand.");
  });

  it("requires a known unit of measure for services only", () => {
    expect(issues(base({ itemType: "service", uom: "" })).uom).toBe("Choose a unit of measure.");
    expect(issues(base({ itemType: "service", uom: "Point" })).uom).toBeUndefined();
    expect(issues(base({ itemType: "component", uom: "" })).uom).toBeUndefined();
  });

  it("flags duplicate option names case-insensitively and bad rates per row", () => {
    const e = issues(
      base({
        variants: [
          { label: "Premium", rate: "100" },
          { label: " premium ", rate: "abc" },
        ],
      }),
    );
    expect(e["variants.1.label"]).toMatch(/different name/);
    expect(e["variants.1.rate"]).toMatch(/Enter a number/);
    expect(e["variants.0.label"]).toBeUndefined();
  });
});

describe("defaults and body", () => {
  const item: CatalogItem = {
    id: "i1",
    name: "Electrical point",
    description: "",
    itemType: "service",
    uom: "Point",
    defaultSection: "Electrical",
    variants: [{ label: "Standard", rate: 450 }],
    active: false,
    createdAt: undefined,
  };

  it("prefills from an item and starts new items with one empty row", () => {
    expect(catalogItemFormDefaults(item)).toMatchObject({
      itemType: "service",
      uom: "Point",
      active: false,
      variants: [{ label: "Standard", rate: "450" }],
    });
    expect(catalogItemFormDefaults().variants).toEqual([{ label: "", rate: "" }]);
  });

  it("trims, parses rates and drops the UOM for non-services", () => {
    const body = toCatalogItemBody(
      base({ name: " Wall Unit ", uom: "Point", variants: [{ label: " Luxury ", rate: "₹1,950" }] }),
    );
    expect(body).toEqual({
      itemType: "component",
      name: "Wall Unit",
      description: "",
      defaultSection: "Modular Kitchen",
      uom: "",
      active: true,
      variants: [{ label: "Luxury", rate: 1950 }],
    });
    expect(toCatalogItemBody(catalogItemFormDefaults(item)).uom).toBe("Point");
  });
});
