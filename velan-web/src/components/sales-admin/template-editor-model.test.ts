import { describe, expect, it } from "vitest";
import type { CatalogItem, QuoteTemplate, QuoteTemplateLine } from "@/lib/api/sales-types";
import {
  buildLine,
  copyTitle,
  emptyLineForm,
  estimateLine,
  estimateTemplate,
  hasErrors,
  lineFormFromLine,
  lineSizeLabel,
  moveByKey,
  parseOptionalPositive,
  serializeDraft,
  templateReducer,
  toDraft,
  toTemplateBody,
  validateTemplate,
  type DraftLine,
  type TemplateDraft,
} from "./template-editor-model";

const base: CatalogItem = {
  id: "base",
  name: "Kitchen Base Unit",
  description: "",
  itemType: "component",
  uom: "",
  defaultSection: "Modular Kitchen",
  variants: [
    { label: "Carcass • Premium", rate: 1650 },
    { label: "Carcass • Luxury", rate: 1950 },
  ],
  active: true,
  createdAt: undefined,
};
const hinge: CatalogItem = {
  ...base,
  id: "hinge",
  name: "Soft-close hinge",
  itemType: "accessory",
  variants: [{ label: "Hettich", rate: 450 }],
};
const point: CatalogItem = {
  ...base,
  id: "point",
  name: "Electrical point",
  itemType: "service",
  uom: "Point",
  variants: [{ label: "Standard", rate: 450 }],
  active: false,
};
const catalogById = new Map([base, hinge, point].map((i) => [i.id, i]));

const line = (over: Partial<QuoteTemplateLine> = {}): QuoteTemplateLine => ({
  catalogItemId: "base",
  name: "Kitchen Base Unit",
  itemType: "component",
  variantLabel: "Carcass • Premium",
  defaultLengthMm: 600,
  defaultHeightMm: 720,
  defaultQty: null,
  uom: "",
  ...over,
});

const template: QuoteTemplate = {
  id: "t1",
  name: "Standard 2BHK",
  createdAt: undefined,
  sections: [
    { title: "Kitchen", type: "component", lines: [line(), line({ variantLabel: "Carcass • Luxury" })] },
    {
      title: "Hardware",
      type: "accessory",
      lines: [line({ catalogItemId: "hinge", name: "Soft-close hinge", itemType: "accessory", variantLabel: "Hettich", defaultLengthMm: null, defaultHeightMm: null, defaultQty: 8 })],
    },
  ],
};

const run = (draft: TemplateDraft, ...actions: Parameters<typeof templateReducer>[1][]) =>
  actions.reduce(templateReducer, draft);

describe("toDraft / toTemplateBody", () => {
  it("keys rows by position and round-trips to the same body", () => {
    const draft = toDraft(template);
    expect(draft.sections.map((s) => s.key)).toEqual(["s0", "s1"]);
    expect(draft.sections[0].lines.map((l) => l.key)).toEqual(["s0l0", "s0l1"]);
    expect(toTemplateBody(draft)).toEqual({ name: template.name, sections: template.sections });
  });

  it("starts empty for a new template", () => {
    expect(toDraft(null)).toEqual({ name: "", sections: [] });
  });

  it("trims titles and clears dimensions that don't apply to the line's type", () => {
    const draft = toDraft({
      name: "  Villa  ",
      sections: [{ title: " Kitchen ", type: "component", lines: [line({ defaultQty: 3 })] }],
    });
    const body = toTemplateBody(draft);
    expect(body.name).toBe("Villa");
    expect(body.sections[0].title).toBe("Kitchen");
    expect(body.sections[0].lines[0].defaultQty).toBeNull();
  });

  it("is dirty only when the saved shape changes", () => {
    const draft = toDraft(template);
    const baseline = serializeDraft(draft);
    expect(serializeDraft(run(draft, { type: "rename", name: "Standard 2BHK " }))).toBe(baseline);
    expect(serializeDraft(run(draft, { type: "rename", name: "Standard 3BHK" }))).not.toBe(baseline);
  });
});

describe("templateReducer", () => {
  const draft = toDraft(template);

  it("adds, renames and removes rooms", () => {
    let d = run(draft, { type: "addSection", key: "n1", title: "Bedroom", sectionType: "component" });
    expect(d.sections.map((s) => s.title)).toEqual(["Kitchen", "Hardware", "Bedroom"]);
    d = run(d, { type: "updateSection", key: "n1", title: "Master bedroom" });
    expect(d.sections[2].title).toBe("Master bedroom");
    d = run(d, { type: "removeSection", key: "s0" });
    expect(d.sections.map((s) => s.key)).toEqual(["s1", "n1"]);
  });

  it("only changes a room's type while it has no lines", () => {
    let d = run(draft, { type: "updateSection", key: "s0", sectionType: "service" });
    expect(d.sections[0].type).toBe("component");
    d = run(d, { type: "addSection", key: "n1", title: "Electrical", sectionType: "component" });
    d = run(d, { type: "updateSection", key: "n1", sectionType: "service" });
    expect(d.sections[2].type).toBe("service");
  });

  it("reorders rooms and lines, ignoring moves past the ends", () => {
    let d = run(draft, { type: "moveSection", key: "s1", direction: -1 });
    expect(d.sections.map((s) => s.key)).toEqual(["s1", "s0"]);
    expect(run(d, { type: "moveSection", key: "s1", direction: -1 })).toBe(d);
    d = run(draft, { type: "moveLine", sectionKey: "s0", lineKey: "s0l0", direction: 1 });
    expect(d.sections[0].lines.map((l) => l.key)).toEqual(["s0l1", "s0l0"]);
  });

  it("adds, edits and removes lines, refusing lines of another type", () => {
    const newLine: DraftLine = { ...line({ defaultLengthMm: 900 }), key: "n2" };
    let d = run(draft, { type: "addLine", sectionKey: "s0", line: newLine });
    expect(d.sections[0].lines).toHaveLength(3);
    expect(run(d, { type: "addLine", sectionKey: "s1", line: newLine }).sections[1].lines).toHaveLength(1);
    d = run(d, { type: "updateLine", sectionKey: "s0", lineKey: "n2", line: line({ defaultLengthMm: 1200 }) });
    expect(d.sections[0].lines[2]).toMatchObject({ key: "n2", defaultLengthMm: 1200 });
    d = run(d, { type: "removeLine", sectionKey: "s0", lineKey: "s0l0" });
    expect(d.sections[0].lines.map((l) => l.key)).toEqual(["s0l1", "n2"]);
  });

  it("duplicates a room right after the original with fresh keys", () => {
    const d = run(draft, { type: "duplicateSection", key: "s0", newKey: "c1", title: "Kitchen (copy)", lineKeys: ["c1a", "c1b"] });
    expect(d.sections.map((s) => s.title)).toEqual(["Kitchen", "Kitchen (copy)", "Hardware"]);
    expect(d.sections[1].lines.map((l) => l.key)).toEqual(["c1a", "c1b"]);
    expect(toTemplateBody(d).sections[1].lines).toEqual(template.sections[0].lines);
  });

  it("resets to a template", () => {
    const d = run(draft, { type: "rename", name: "x" }, { type: "reset", template });
    expect(d).toEqual(toDraft(template));
  });
});

describe("moveByKey", () => {
  it("swaps neighbours", () => {
    const list = [{ key: "a" }, { key: "b" }, { key: "c" }];
    expect(moveByKey(list, "b", 1).map((x) => x.key)).toEqual(["a", "c", "b"]);
    expect(moveByKey(list, "zz", 1)).toBe(list);
  });
});

describe("validateTemplate", () => {
  it("requires a name and titled rooms", () => {
    const d = run(toDraft(null), { type: "addSection", key: "n1", title: " ", sectionType: "component" });
    const e = validateTemplate(d);
    expect(e.name).toBe("Give the template a name.");
    expect(e.sections.n1).toBe("Name this room or section.");
    expect(hasErrors(e)).toBe(true);
    expect(hasErrors(validateTemplate(toDraft(template)))).toBe(false);
  });

  it("suggests a free copy title", () => {
    expect(copyTitle("Kitchen", ["Kitchen"])).toBe("Kitchen (copy)");
    expect(copyTitle("Kitchen", ["Kitchen", "kitchen (copy)"])).toBe("Kitchen (copy 2)");
  });
});

describe("line form", () => {
  it("parses optional positive numbers", () => {
    expect(parseOptionalPositive("", 10, "length")).toEqual({ ok: true, value: null });
    expect(parseOptionalPositive("1,200", 5000, "length")).toEqual({ ok: true, value: 1200 });
    expect(parseOptionalPositive("0", 10, "quantity")).toMatchObject({ ok: false });
    expect(parseOptionalPositive("x", 10, "quantity")).toMatchObject({ ok: false });
    expect(parseOptionalPositive("11", 10, "quantity")).toMatchObject({ ok: false });
  });

  it("builds a component line from the chosen item and variant", () => {
    const r = buildLine({ ...emptyLineForm(), catalogItemId: "base", variantLabel: "Carcass • Luxury", lengthMm: "600", heightMm: "720" }, base, "component");
    expect(r).toEqual({ ok: true, line: line({ variantLabel: "Carcass • Luxury" }) });
  });

  it("allows leaving the size for the quote, but not half of it", () => {
    const empty = buildLine({ ...emptyLineForm(), catalogItemId: "base", variantLabel: "Carcass • Premium" }, base, "component");
    expect(empty).toMatchObject({ ok: true, line: { defaultLengthMm: null, defaultHeightMm: null } });
    const half = buildLine({ ...emptyLineForm(), catalogItemId: "base", variantLabel: "Carcass • Premium", lengthMm: "600" }, base, "component");
    expect(half).toMatchObject({ ok: false, errors: { heightMm: expect.stringMatching(/both/) } });
  });

  it("builds quantity lines for accessories and services, snapshotting the UOM", () => {
    const r = buildLine({ ...emptyLineForm(), catalogItemId: "point", variantLabel: "Standard", qty: "12" }, point, "service");
    expect(r).toMatchObject({ ok: true, line: { itemType: "service", uom: "Point", defaultQty: 12, defaultLengthMm: null } });
  });

  it("rejects a missing item, a wrong type and an unknown variant", () => {
    expect(buildLine(emptyLineForm(), undefined, "component")).toMatchObject({ ok: false, errors: { catalogItemId: expect.any(String) } });
    const r = buildLine({ ...emptyLineForm(), catalogItemId: "hinge", variantLabel: "Nope" }, hinge, "component");
    expect(r).toMatchObject({
      ok: false,
      errors: { catalogItemId: "This room takes components only.", variantLabel: "Choose a default option." },
    });
  });

  it("prefills the form from a line", () => {
    expect(lineFormFromLine(line())).toEqual({
      catalogItemId: "base",
      variantLabel: "Carcass • Premium",
      lengthMm: "600",
      heightMm: "720",
      qty: "",
    });
  });
});

describe("estimates", () => {
  it("prices lines at today's rates and flags problems", () => {
    expect(estimateLine(line(), catalogById)).toEqual({ status: "ok", rate: 1650, variantLabel: "Carcass • Premium", amount: 7673 });
    expect(estimateLine(line({ catalogItemId: "gone" }), catalogById)).toMatchObject({ status: "missing", amount: 0, rate: null });
    expect(estimateLine(line({ variantLabel: "Old finish" }), catalogById)).toMatchObject({
      status: "variant-missing",
      variantLabel: "Carcass • Premium",
      amount: 7673,
    });
    expect(estimateLine(line({ defaultLengthMm: null }), catalogById)).toMatchObject({ status: "no-size", amount: 0 });
    const svc = line({ catalogItemId: "point", itemType: "service", variantLabel: "Standard", defaultQty: 10, defaultLengthMm: null, defaultHeightMm: null });
    expect(estimateLine(svc, catalogById)).toMatchObject({ status: "inactive", amount: 4500 });
  });

  it("sums rooms and the template, counting lines that need attention", () => {
    const d = toDraft(template);
    const e = estimateTemplate(d.sections, catalogById);
    // Kitchen: 4.65001 sq.ft × 1650 = 7673, × 1950 = 9068; Hardware: 8 × 450 = 3600
    expect(e.sections).toEqual({ s0: 7673 + 9068, s1: 3600 });
    expect(e.total).toBe(7673 + 9068 + 3600);
    expect(e.attention).toBe(0);
    const withGone = run(d, { type: "addLine", sectionKey: "s0", line: { ...line({ catalogItemId: "gone" }), key: "g" } });
    expect(estimateTemplate(withGone.sections, catalogById).attention).toBe(1);
  });

  it("describes the default size", () => {
    expect(lineSizeLabel(line())).toBe("600 × 720 mm · 4.65 sq.ft");
    expect(lineSizeLabel(line({ defaultHeightMm: null }))).toBe("Size set on each quote");
    expect(lineSizeLabel(line({ itemType: "service", uom: "Point", defaultQty: 12 }))).toBe("12 Point");
    expect(lineSizeLabel(line({ itemType: "accessory", defaultQty: 1 }))).toBe("1 unit");
    expect(lineSizeLabel(line({ itemType: "accessory", defaultQty: null }))).toBe("Quantity set on each quote");
  });
});
