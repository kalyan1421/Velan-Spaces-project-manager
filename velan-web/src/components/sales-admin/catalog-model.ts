/**
 * Rate card rules shared by the table, the item dialog and the template editor:
 * labels, pricing basis, search/filter/grouping and line pricing. Pure.
 */

import { formatINR } from "@/lib/format";
import {
  CATALOG_ITEM_TYPE_LABELS,
  CATALOG_ITEM_TYPE_PLURALS,
  CATALOG_ITEM_TYPES,
  pricingBasisFor,
  type CatalogItem,
  type CatalogItemType,
  type CatalogVariant,
  type PricingBasis,
  type QuoteTemplate,
} from "@/lib/api/sales-types";

/** How an item's amount is derived (mirrors the mobile `PricingBasis`). */
export const PRICING_BASIS: Record<CatalogItemType, PricingBasis> = {
  component: pricingBasisFor("component"),
  accessory: pricingBasisFor("accessory"),
  service: pricingBasisFor("service"),
};

export const TYPE_LABELS = CATALOG_ITEM_TYPE_LABELS;
export const TYPE_PLURALS = CATALOG_ITEM_TYPE_PLURALS;

export const TYPE_PRICING_COPY: Record<CatalogItemType, string> = {
  component: "Priced per sq.ft of the unit's face (length × height).",
  accessory: "Priced per unit. Each brand is its own price.",
  service: "Priced per unit of measure: sq.ft, point, number or running ft.",
};

/** What a variant is called for each type. */
export const VARIANT_NOUN: Record<CatalogItemType, string> = {
  component: "Variant",
  accessory: "Brand",
  service: "Option",
};

export const VARIANT_PLACEHOLDER: Record<CatalogItemType, string> = {
  component: "e.g. Carcass • Premium",
  accessory: "e.g. Hettich",
  service: "e.g. Standard",
};

/** "/sq.ft", "/unit", "/Point". */
export function rateUnit(type: CatalogItemType, uom?: string | null): string {
  if (type === "component") return "/sq.ft";
  if (type === "accessory") return "/unit";
  const unit = (uom ?? "").trim();
  return unit ? `/${unit}` : "/unit";
}

/** ₹1,650/sq.ft */
export function formatRate(rate: number, type: CatalogItemType, uom?: string | null): string {
  return `${formatINR(rate)}${rateUnit(type, uom)}`;
}

/** "₹1,350 – ₹1,950/sq.ft", or one rate when all variants agree; "No rates" when empty. */
export function rateRange(item: Pick<CatalogItem, "variants" | "itemType" | "uom">): string {
  const rates = item.variants.map((v) => v.rate);
  if (rates.length === 0) return "No rates";
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const unit = rateUnit(item.itemType, item.uom);
  return min === max ? `${formatINR(min)}${unit}` : `${formatINR(min)} – ${formatINR(max)}${unit}`;
}

// ---------------------------------------------------------------- filtering

export type TypeFilter = "all" | CatalogItemType;
export type StatusFilter = "all" | "active" | "inactive";

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Every word must appear in the name, description, section, UOM or a variant label. */
export function matchesSearch(item: CatalogItem, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(
    [item.name, item.description ?? "", item.defaultSection ?? "", item.uom ?? "", ...item.variants.map((v) => v.label)].join(
      " ",
    ),
  );
  return words.every((w) => haystack.includes(w));
}

export function filterCatalog(
  items: readonly CatalogItem[],
  { query = "", type = "all", status = "all" }: { query?: string; type?: TypeFilter; status?: StatusFilter },
): CatalogItem[] {
  return items.filter(
    (i) =>
      (type === "all" || i.itemType === type) &&
      (status === "all" || (status === "active" ? i.active : !i.active)) &&
      matchesSearch(i, query),
  );
}

export function countByType(items: readonly CatalogItem[]): Record<TypeFilter, number> {
  const counts: Record<TypeFilter, number> = { all: items.length, component: 0, accessory: 0, service: 0 };
  for (const i of items) counts[i.itemType] += 1;
  return counts;
}

export const NO_SECTION = "Other";

/** The item's grouping label, trimmed ("" when unset). */
export const sectionOf = (item: Pick<CatalogItem, "defaultSection">): string => (item.defaultSection ?? "").trim();

export type CatalogGroup = {
  type: CatalogItemType;
  sections: { section: string; items: CatalogItem[] }[];
  count: number;
};

const byName = (a: CatalogItem, b: CatalogItem) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/**
 * Type → section → items. Types keep their canonical order, sections are
 * alphabetical with unlabelled items last, items alphabetical. Empty types are dropped.
 */
export function groupCatalog(items: readonly CatalogItem[]): CatalogGroup[] {
  return CATALOG_ITEM_TYPES.map((type) => {
    const ofType = items.filter((i) => i.itemType === type);
    const bySection = new Map<string, CatalogItem[]>();
    for (const item of ofType) {
      const key = sectionOf(item) || NO_SECTION;
      bySection.set(key, [...(bySection.get(key) ?? []), item]);
    }
    const sections = [...bySection.entries()]
      .sort(([a], [b]) => (a === NO_SECTION ? 1 : b === NO_SECTION ? -1 : a.localeCompare(b, "en", { sensitivity: "base" })))
      .map(([section, list]) => ({ section, items: [...list].sort(byName) }));
    return { type, sections, count: ofType.length };
  }).filter((g) => g.count > 0);
}

/** Distinct section labels in use (for suggestions), alphabetical. */
export function sectionSuggestions(items: readonly CatalogItem[], type?: CatalogItemType): string[] {
  const set = new Map<string, string>();
  for (const i of items) {
    if (type && i.itemType !== type) continue;
    const s = sectionOf(i);
    if (s && !set.has(s.toLowerCase())) set.set(s.toLowerCase(), s);
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

/** Templates with at least one line pointing at this item (for the delete warning). */
export function templatesUsingItem(templates: readonly QuoteTemplate[], itemId: string): QuoteTemplate[] {
  return templates.filter((t) => t.sections.some((s) => s.lines.some((l) => l.catalogItemId === itemId)));
}

// ---------------------------------------------------------------- pricing

const SQ_MM_PER_SQ_FT = 304.8 * 304.8; // 92,903.04

/** L×H in millimetres → square feet. */
export function areaSqft(lengthMm: number, heightMm: number): number {
  return (lengthMm * heightMm) / SQ_MM_PER_SQ_FT;
}

/**
 * Amount for one line, as the quote builder computes it (mobile `QuoteCalculator.lineAmount`):
 * area → sq.ft × rate; qty/uom → qty × rate. Rounded to whole rupees by default.
 */
export function lineAmount({
  type,
  lengthMm,
  heightMm,
  qty,
  rate,
  round = true,
}: {
  type: CatalogItemType;
  lengthMm?: number | null;
  heightMm?: number | null;
  qty?: number | null;
  rate: number;
  round?: boolean;
}): number {
  const amount =
    PRICING_BASIS[type] === "area" ? areaSqft(lengthMm ?? 0, heightMm ?? 0) * rate : (qty ?? 0) * rate;
  return round ? Math.round(amount) : amount;
}

/** The variant a template line resolves to: by label, else the item's first variant. */
export function resolveVariant(item: Pick<CatalogItem, "variants"> | undefined, label: string): CatalogVariant | null {
  if (!item || item.variants.length === 0) return null;
  return item.variants.find((v) => v.label === label) ?? item.variants[0];
}
