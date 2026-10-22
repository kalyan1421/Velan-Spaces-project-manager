/**
 * Quote template editor: the whole template is edited locally (pure reducer)
 * and saved with one POST/PATCH. Also the line/room form rules and the
 * "estimate at today's rates" selectors. No DOM, fully unit-tested.
 *
 * `key` is list identity only (never sent): derived from position on load,
 * random for rows added in the editor.
 */

import type {
  CatalogItem,
  CatalogItemType,
  QuoteTemplate,
  QuoteTemplateInput,
  QuoteTemplateLine,
} from "@/lib/api/sales-types";
import { PRICING_BASIS, TYPE_LABELS, areaSqft, lineAmount, resolveVariant } from "./catalog-model";

/** Within the API's limits (name 200, 100 sections, 300 lines, title 300). */
export const TEMPLATE_LIMITS = {
  name: 200,
  sectionTitle: 120,
  sections: 60,
  linesPerSection: 150,
  /** 100 m — larger than any cabinet face. */
  maxMm: 100_000,
  maxQty: 100_000,
} as const;

export type DraftLine = QuoteTemplateLine & { key: string };
export type DraftSection = { key: string; title: string; type: CatalogItemType; lines: DraftLine[] };
export type TemplateDraft = { name: string; sections: DraftSection[] };

export type Direction = -1 | 1;

export type TemplateAction =
  | { type: "reset"; template: Pick<QuoteTemplate, "name" | "sections"> | null }
  | { type: "rename"; name: string }
  | { type: "addSection"; key: string; title: string; sectionType: CatalogItemType }
  | { type: "updateSection"; key: string; title?: string; sectionType?: CatalogItemType }
  | { type: "removeSection"; key: string }
  | { type: "moveSection"; key: string; direction: Direction }
  | { type: "duplicateSection"; key: string; newKey: string; title: string; lineKeys: string[] }
  | { type: "addLine"; sectionKey: string; line: DraftLine }
  | { type: "updateLine"; sectionKey: string; lineKey: string; line: QuoteTemplateLine }
  | { type: "removeLine"; sectionKey: string; lineKey: string }
  | { type: "moveLine"; sectionKey: string; lineKey: string; direction: Direction };

export function newKey(prefix = "n"): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${id}`;
}

export function toDraft(template: Pick<QuoteTemplate, "name" | "sections"> | null): TemplateDraft {
  if (!template) return { name: "", sections: [] };
  return {
    name: template.name,
    sections: template.sections.map((s, i) => ({
      key: `s${i}`,
      title: s.title,
      type: s.type,
      lines: s.lines.map((l, j) => ({ ...l, key: `s${i}l${j}` })),
    })),
  };
}

/** Swap an element with its neighbour; out-of-range moves return the same array. */
export function moveByKey<T extends { key: string }>(list: readonly T[], key: string, direction: Direction): T[] {
  const from = list.findIndex((x) => x.key === key);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= list.length) return list as T[];
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function mapSection(draft: TemplateDraft, key: string, fn: (s: DraftSection) => DraftSection): TemplateDraft {
  return { ...draft, sections: draft.sections.map((s) => (s.key === key ? fn(s) : s)) };
}

export function templateReducer(draft: TemplateDraft, action: TemplateAction): TemplateDraft {
  switch (action.type) {
    case "reset":
      return toDraft(action.template);
    case "rename":
      return { ...draft, name: action.name };
    case "addSection":
      return {
        ...draft,
        sections: [...draft.sections, { key: action.key, title: action.title, type: action.sectionType, lines: [] }],
      };
    case "updateSection":
      return mapSection(draft, action.key, (s) => ({
        ...s,
        title: action.title ?? s.title,
        // A room's lines all share its type: the type is fixed once it has lines.
        type: action.sectionType !== undefined && s.lines.length === 0 ? action.sectionType : s.type,
      }));
    case "removeSection":
      return { ...draft, sections: draft.sections.filter((s) => s.key !== action.key) };
    case "moveSection": {
      const sections = moveByKey(draft.sections, action.key, action.direction);
      return sections === draft.sections ? draft : { ...draft, sections };
    }
    case "duplicateSection": {
      const index = draft.sections.findIndex((s) => s.key === action.key);
      if (index < 0) return draft;
      const source = draft.sections[index];
      const copy: DraftSection = {
        key: action.newKey,
        title: action.title,
        type: source.type,
        lines: source.lines.map((l, i) => ({ ...l, key: action.lineKeys[i] ?? `${action.newKey}-l${i}` })),
      };
      const sections = [...draft.sections];
      sections.splice(index + 1, 0, copy);
      return { ...draft, sections };
    }
    case "addLine":
      return mapSection(draft, action.sectionKey, (s) =>
        action.line.itemType === s.type ? { ...s, lines: [...s.lines, action.line] } : s,
      );
    case "updateLine":
      return mapSection(draft, action.sectionKey, (s) => ({
        ...s,
        lines: s.lines.map((l) => (l.key === action.lineKey ? { ...action.line, key: l.key } : l)),
      }));
    case "removeLine":
      return mapSection(draft, action.sectionKey, (s) => ({
        ...s,
        lines: s.lines.filter((l) => l.key !== action.lineKey),
      }));
    case "moveLine":
      return mapSection(draft, action.sectionKey, (s) => ({
        ...s,
        lines: moveByKey(s.lines, action.lineKey, action.direction),
      }));
  }
}

// ---------------------------------------------------------------- save / dirty

/** Strips editor keys and clears the dimension fields that don't apply to the line's type. */
export function toTemplateLine(line: QuoteTemplateLine): QuoteTemplateLine {
  const area = PRICING_BASIS[line.itemType] === "area";
  return {
    catalogItemId: line.catalogItemId,
    name: line.name,
    itemType: line.itemType,
    variantLabel: line.variantLabel,
    defaultLengthMm: area ? line.defaultLengthMm : null,
    defaultHeightMm: area ? line.defaultHeightMm : null,
    defaultQty: area ? null : line.defaultQty,
    uom: line.uom,
  };
}

export function toTemplateBody(draft: TemplateDraft): QuoteTemplateInput {
  return {
    name: draft.name.trim(),
    sections: draft.sections.map((s) => ({
      title: s.title.trim(),
      type: s.type,
      lines: s.lines.map(toTemplateLine),
    })),
  };
}

/** Stable snapshot for "has anything changed?" comparisons. */
export function serializeDraft(draft: TemplateDraft): string {
  return JSON.stringify(toTemplateBody(draft));
}

export type TemplateErrors = { name?: string; sections: Record<string, string> };

export function validateTemplate(draft: TemplateDraft): TemplateErrors {
  const errors: TemplateErrors = { sections: {} };
  const name = draft.name.trim();
  if (!name) errors.name = "Give the template a name.";
  else if (name.length > TEMPLATE_LIMITS.name) errors.name = `Keep the name under ${TEMPLATE_LIMITS.name} characters.`;
  if (draft.sections.length > TEMPLATE_LIMITS.sections) {
    errors.name ??= `A template can have at most ${TEMPLATE_LIMITS.sections} rooms.`;
  }
  for (const s of draft.sections) {
    const problem = sectionTitleProblem(s.title);
    if (problem) errors.sections[s.key] = problem;
    else if (s.lines.length > TEMPLATE_LIMITS.linesPerSection) {
      errors.sections[s.key] = `A room can have at most ${TEMPLATE_LIMITS.linesPerSection} lines.`;
    }
  }
  return errors;
}

export function hasErrors(errors: TemplateErrors): boolean {
  return Boolean(errors.name) || Object.keys(errors.sections).length > 0;
}

export function sectionTitleProblem(title: string): string | null {
  const t = title.trim();
  if (!t) return "Name this room or section.";
  if (t.length > TEMPLATE_LIMITS.sectionTitle) return `Keep it under ${TEMPLATE_LIMITS.sectionTitle} characters.`;
  return null;
}

/** "Bedroom" → "Bedroom (copy)", avoiding titles already in the draft. */
export function copyTitle(title: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((t) => t.trim().toLowerCase()));
  const base = `${title.trim() || "Room"} (copy)`.slice(0, TEMPLATE_LIMITS.sectionTitle);
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${title.trim() || "Room"} (copy ${n})`.slice(0, TEMPLATE_LIMITS.sectionTitle);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}

export function lineCount(sections: readonly { lines: readonly unknown[] }[]): number {
  return sections.reduce((n, s) => n + s.lines.length, 0);
}

// ---------------------------------------------------------------- line form

export type LineFormValues = {
  catalogItemId: string;
  variantLabel: string;
  lengthMm: string;
  heightMm: string;
  qty: string;
};

export type LineFormErrors = Partial<Record<keyof LineFormValues, string>>;

/** "" → null (fill in on the quote); otherwise a positive number up to `max`. */
export function parseOptionalPositive(
  input: string,
  max: number,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const cleaned = input.trim().replace(/[,\s]/g, "");
  if (!cleaned) return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { ok: false, error: `Enter the ${label} as a number.` };
  const value = Number(cleaned);
  if (!(value > 0)) return { ok: false, error: `The ${label} must be more than 0.` };
  if (value > max) return { ok: false, error: `That ${label} is too large.` };
  if ((cleaned.split(".")[1]?.length ?? 0) > 2) return { ok: false, error: "Use at most 2 decimal places." };
  return { ok: true, value };
}

export function emptyLineForm(): LineFormValues {
  return { catalogItemId: "", variantLabel: "", lengthMm: "", heightMm: "", qty: "1" };
}

const plain = (n: number | null) => (n === null ? "" : String(n));

export function lineFormFromLine(line: QuoteTemplateLine): LineFormValues {
  return {
    catalogItemId: line.catalogItemId,
    variantLabel: line.variantLabel,
    lengthMm: plain(line.defaultLengthMm),
    heightMm: plain(line.defaultHeightMm),
    qty: plain(line.defaultQty),
  };
}

/**
 * Validates the line dialog against the chosen catalog item and builds the
 * template line (name/type/uom snapshotted from the item).
 */
export function buildLine(
  values: LineFormValues,
  item: CatalogItem | undefined,
  sectionType: CatalogItemType,
): { ok: true; line: QuoteTemplateLine } | { ok: false; errors: LineFormErrors } {
  const errors: LineFormErrors = {};
  if (!item) {
    errors.catalogItemId = "Choose an item from the rate card.";
    return { ok: false, errors };
  }
  if (item.itemType !== sectionType) {
    errors.catalogItemId = `This room takes ${TYPE_LABELS[sectionType].toLowerCase()}s only.`;
  }
  if (item.variants.length > 0 && !item.variants.some((v) => v.label === values.variantLabel)) {
    errors.variantLabel = "Choose a default option.";
  }

  let lengthMm: number | null = null;
  let heightMm: number | null = null;
  let qty: number | null = null;
  if (PRICING_BASIS[item.itemType] === "area") {
    const l = parseOptionalPositive(values.lengthMm, TEMPLATE_LIMITS.maxMm, "length");
    const h = parseOptionalPositive(values.heightMm, TEMPLATE_LIMITS.maxMm, "height");
    if (!l.ok) errors.lengthMm = l.error;
    else lengthMm = l.value;
    if (!h.ok) errors.heightMm = h.error;
    else heightMm = h.value;
    if (l.ok && h.ok && (l.value === null) !== (h.value === null)) {
      const missing = l.value === null ? "lengthMm" : "heightMm";
      errors[missing] = "Enter both length and height, or leave both empty.";
    }
  } else {
    const q = parseOptionalPositive(values.qty, TEMPLATE_LIMITS.maxQty, "quantity");
    if (!q.ok) errors.qty = q.error;
    else qty = q.value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    line: {
      catalogItemId: item.id,
      name: item.name,
      itemType: item.itemType,
      variantLabel: item.variants.length > 0 ? values.variantLabel : "",
      defaultLengthMm: lengthMm,
      defaultHeightMm: heightMm,
      defaultQty: qty,
      uom: item.uom ?? "",
    },
  };
}

// ---------------------------------------------------------------- display + estimates

const mm = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const sqft = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** "600 × 720 mm · 4.65 sq.ft", "2 No", "Size set on each quote". */
export function lineSizeLabel(line: QuoteTemplateLine): string {
  if (PRICING_BASIS[line.itemType] === "area") {
    if (line.defaultLengthMm === null || line.defaultHeightMm === null) return "Size set on each quote";
    const area = areaSqft(line.defaultLengthMm, line.defaultHeightMm);
    return `${mm.format(line.defaultLengthMm)} × ${mm.format(line.defaultHeightMm)} mm · ${sqft.format(area)} sq.ft`;
  }
  if (line.defaultQty === null) return "Quantity set on each quote";
  const unit = line.itemType === "service" ? line.uom.trim() || "units" : line.defaultQty === 1 ? "unit" : "units";
  return `${mm.format(line.defaultQty)} ${unit}`;
}

export type LineStatus = "ok" | "missing" | "inactive" | "variant-missing" | "no-size";

export type LineEstimate = {
  status: LineStatus;
  /** The current rate (₹) the line resolves to; null when the item is gone or has no rates. */
  rate: number | null;
  /** The label the quote builder would use (falls back to the item's first option). */
  variantLabel: string;
  amount: number;
};

export function estimateLine(
  line: QuoteTemplateLine,
  catalogById: ReadonlyMap<string, CatalogItem>,
  round = true,
): LineEstimate {
  const item = catalogById.get(line.catalogItemId);
  if (!item) return { status: "missing", rate: null, variantLabel: line.variantLabel, amount: 0 };
  const variant = resolveVariant(item, line.variantLabel);
  const rate = variant?.rate ?? null;
  const amount =
    rate === null
      ? 0
      : lineAmount({
          type: item.itemType,
          lengthMm: line.defaultLengthMm,
          heightMm: line.defaultHeightMm,
          qty: line.defaultQty,
          rate,
          round,
        });
  const sizeMissing =
    PRICING_BASIS[item.itemType] === "area"
      ? line.defaultLengthMm === null || line.defaultHeightMm === null
      : line.defaultQty === null;
  const status: LineStatus = !item.active
    ? "inactive"
    : !variant || variant.label !== line.variantLabel
      ? "variant-missing"
      : sizeMissing
        ? "no-size"
        : "ok";
  return { status, rate, variantLabel: variant?.label ?? line.variantLabel, amount };
}

export type TemplateEstimate = {
  sections: Record<string, number>;
  total: number;
  /** Lines whose item left the rate card, was deactivated, or lost its option. */
  attention: number;
};

export function estimateTemplate(
  sections: readonly DraftSection[],
  catalogById: ReadonlyMap<string, CatalogItem>,
  round = true,
): TemplateEstimate {
  const result: TemplateEstimate = { sections: {}, total: 0, attention: 0 };
  for (const s of sections) {
    let subtotal = 0;
    for (const line of s.lines) {
      const e = estimateLine(line, catalogById, round);
      subtotal += e.amount;
      if (e.status === "missing" || e.status === "inactive" || e.status === "variant-missing") result.attention += 1;
    }
    result.sections[s.key] = subtotal;
    result.total += subtotal;
  }
  return result;
}
