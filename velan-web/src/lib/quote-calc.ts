/**
 * Pure costing engine for quotations — the web twin of the mobile app's
 * `QuoteCalculator` / `TemplateApplier` and the API's `computeQuoteTotals`
 * (`velan-backend/src/common/calc.ts`). No I/O, no React.
 *
 * The server recomputes totals on every write and is the source of truth; these
 * functions only drive the live figures while a quote is being edited.
 *
 * Line formulas (by catalog item type):
 * - component (area): amount = (L × H mm ÷ 92,903.04 → sq.ft) × rate per sq.ft
 * - accessory (qty) : amount = qty × unit price
 * - service   (uom) : amount = qty × rate per UOM (Sq.Ft / Point / No / Rft)
 *
 * Totals: subtotal = Σ line amounts → − discount (₹ or % of subtotal) → + GST %
 * → rounded to whole ₹ when the quotation settings say so.
 */

import { toNumber } from "@/lib/format";
import {
  pricingBasisFor,
  type CatalogItem,
  type CatalogItemType,
  type CatalogVariant,
  type DiscountType,
  type PricingBasis,
  type QuoteItem,
  type QuoteSection,
  type QuoteTemplate,
} from "@/lib/api/sales-types";

export const MM_PER_FOOT = 304.8;
/** 304.8² — square millimetres in one square foot. */
export const SQ_MM_PER_SQ_FT = MM_PER_FOOT * MM_PER_FOOT;

/** Same rounding as the API (`round2` in calc.ts). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const finite = (v: unknown): number => {
  const n = typeof v === "number" ? v : toNumber(v, Number.NaN);
  return Number.isFinite(n) ? n : 0;
};

/** L × H in millimetres → square feet. */
export function areaSqft(lengthMm: number | null | undefined, heightMm: number | null | undefined): number {
  return (finite(lengthMm) * finite(heightMm)) / SQ_MM_PER_SQ_FT;
}

export type LineInput = {
  basis: PricingBasis;
  lengthMm?: number | null;
  heightMm?: number | null;
  qty?: number | null;
  rate: number;
  /** Whole rupees (quotation settings `roundAmounts`, default on); otherwise paise. */
  round?: boolean;
};

/** One line's amount for its pricing basis. Negative inputs count as zero. */
export function lineAmount({ basis, lengthMm, heightMm, qty, rate, round = true }: LineInput): number {
  const r = Math.max(0, finite(rate));
  const raw =
    basis === "area"
      ? areaSqft(Math.max(0, finite(lengthMm)), Math.max(0, finite(heightMm))) * r
      : Math.max(0, finite(qty)) * r;
  return round ? Math.round(raw) : round2(raw);
}

/** Pricing basis of a quote line (from its catalog item type). */
export function itemBasis(item: Pick<QuoteItem, "itemType">): PricingBasis {
  return pricingBasisFor(item.itemType);
}

/** The line with `amount` recomputed from its current inputs. */
export function recomputeItem<T extends QuoteItem>(item: T, round = true): T {
  return {
    ...item,
    amount: lineAmount({
      basis: itemBasis(item),
      lengthMm: item.lengthMm,
      heightMm: item.heightMm,
      qty: item.qty,
      rate: item.rate,
      round,
    }),
  };
}

type AmountLike = { amount?: number | string | null };
type SectionLike = { items?: AmountLike[] | null };

export function sectionSubtotal(items: AmountLike[] | null | undefined): number {
  let sum = 0;
  for (const item of items ?? []) sum += finite(item.amount);
  return round2(sum);
}

export function quoteSubtotal(sections: SectionLike[] | null | undefined): number {
  let sum = 0;
  for (const section of sections ?? []) for (const item of section.items ?? []) sum += finite(item.amount);
  return round2(sum);
}

/** Discount in ₹ for the chosen type. */
export function discountAmount(subtotal: number, type: DiscountType, value: number): number {
  const v = finite(value);
  return type === "percent" ? (subtotal * v) / 100 : v;
}

/**
 * Exact mirror of the API's `computeQuoteTotals` (velan-backend/src/common/calc.ts):
 * subtotal = Σ item.amount; grand = (subtotal − discount) × (1 + gst%), both to paise.
 */
export function computeQuoteTotals(
  sections: SectionLike[],
  discountType: DiscountType,
  discountValue: number,
  gstPercent: number,
): { subtotal: number; grandTotal: number } {
  let subtotal = 0;
  for (const section of sections ?? []) {
    for (const item of section.items ?? []) subtotal += Number(item.amount) || 0;
  }
  const discount = discountType === "percent" ? (subtotal * (discountValue || 0)) / 100 : discountValue || 0;
  const grandTotal = (subtotal - discount) * (1 + (gstPercent || 0) / 100);
  return { subtotal: round2(subtotal), grandTotal: round2(grandTotal) };
}

/** Same fields and maths as the API's `quoteBreakdown` (velan-backend/src/common/calc.ts). */
export type QuoteBreakdown = {
  /** Σ item.amount. */
  subtotal: number;
  /** ₹ taken off (a percent discount resolved against the subtotal). */
  discount: number;
  /** subtotal − discount. */
  taxable: number;
  /** grandTotal − taxable, so the lines always add up. */
  gstAmount: number;
  /** What the quotes row stores (computeQuoteTotals, to paise). */
  grandTotal: number;
  /** payable − grandTotal (0 unless rounding). */
  roundOff: number;
  /** grandTotal to whole rupees when rounding — the "Grand Total" shown on the quote. */
  payable: number;
};

/** Live totals block for the builder and the PDF (subtotal → discount → GST → round-off → payable). */
export function quoteBreakdown({
  sections,
  discountType,
  discountValue,
  gstPercent,
  round = true,
}: {
  sections: SectionLike[];
  discountType: DiscountType;
  discountValue: number;
  gstPercent: number;
  round?: boolean;
}): QuoteBreakdown {
  const { subtotal, grandTotal } = computeQuoteTotals(sections, discountType, finite(discountValue), finite(gstPercent));
  const discount = round2(discountAmount(subtotal, discountType, discountValue));
  const taxable = round2(subtotal - discount);
  const gstAmount = round2(grandTotal - taxable);
  const payable = round ? Math.round(grandTotal) : grandTotal;
  return { subtotal, discount, taxable, gstAmount, grandTotal, roundOff: round2(payable - grandTotal), payable };
}

// ------------------------------------------------------------------ catalog picks

/** The variant with this label, else the item's first variant, else null. */
export function resolveVariant(item: Pick<CatalogItem, "variants">, label?: string | null): CatalogVariant | null {
  const exact = label ? item.variants.find((v) => v.label === label) : undefined;
  return exact ?? item.variants[0] ?? null;
}

/**
 * A quote line priced from the rate card. Area inputs are kept only for
 * components; qty only for accessories/services (as the mobile app stores them).
 */
export function itemFromCatalog(
  catalogItem: CatalogItem,
  options: {
    variantLabel?: string | null;
    lengthMm?: number | null;
    heightMm?: number | null;
    qty?: number | null;
    round?: boolean;
  } = {},
): QuoteItem {
  const variant = resolveVariant(catalogItem, options.variantLabel);
  const basis = pricingBasisFor(catalogItem.itemType);
  const item: QuoteItem = {
    catalogItemId: catalogItem.id,
    name: catalogItem.name,
    description: catalogItem.description ?? "",
    itemType: catalogItem.itemType,
    variantLabel: variant?.label ?? "",
    lengthMm: basis === "area" ? (options.lengthMm ?? null) : null,
    heightMm: basis === "area" ? (options.heightMm ?? null) : null,
    qty: basis === "area" ? null : (options.qty ?? null),
    uom: catalogItem.uom ?? "",
    rate: variant?.rate ?? 0,
    amount: 0,
  };
  return recomputeItem(item, options.round ?? true);
}

/** An unpicked line for a section of this type. */
export function blankItem(type: CatalogItemType): QuoteItem {
  return {
    catalogItemId: null,
    name: "",
    description: "",
    itemType: type,
    variantLabel: "",
    lengthMm: null,
    heightMm: null,
    qty: type === "component" ? null : 1,
    uom: "",
    rate: 0,
    amount: 0,
  };
}

// ------------------------------------------------------------------ templates

/**
 * Instantiates a template into quote sections, pulling the *current* rate for each
 * line from the rate card (the rate card is the source of truth). A line whose
 * variant no longer exists falls back to the item's first variant; a line whose
 * catalog item is gone keeps its snapshot name with a zero rate.
 */
export function applyTemplate(
  template: Pick<QuoteTemplate, "sections">,
  catalog: CatalogItem[],
  { round = true }: { round?: boolean } = {},
): QuoteSection[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return template.sections.map((section) => ({
    title: section.title,
    type: section.type,
    items: section.lines.map((line): QuoteItem => {
      const catalogItem = byId.get(line.catalogItemId);
      if (catalogItem) {
        const basis = pricingBasisFor(catalogItem.itemType);
        const variant = resolveVariant(catalogItem, line.variantLabel);
        return recomputeItem(
          {
            catalogItemId: catalogItem.id,
            name: catalogItem.name,
            description: catalogItem.description ?? "",
            itemType: catalogItem.itemType,
            variantLabel: variant?.label ?? line.variantLabel,
            lengthMm: basis === "area" ? line.defaultLengthMm : null,
            heightMm: basis === "area" ? line.defaultHeightMm : null,
            qty: basis === "area" ? null : line.defaultQty,
            uom: catalogItem.uom ?? line.uom,
            rate: variant?.rate ?? 0,
            amount: 0,
          },
          round,
        );
      }
      return {
        catalogItemId: line.catalogItemId || null,
        name: line.name,
        description: "",
        itemType: line.itemType,
        variantLabel: line.variantLabel,
        lengthMm: line.defaultLengthMm,
        heightMm: line.defaultHeightMm,
        qty: line.defaultQty,
        uom: line.uom,
        rate: 0,
        amount: 0,
      };
    }),
  }));
}

/** Names of template lines whose catalog item is no longer in the (active) rate card. */
export function unresolvedTemplateLines(template: Pick<QuoteTemplate, "sections">, catalog: CatalogItem[]): string[] {
  const ids = new Set(catalog.map((c) => c.id));
  return template.sections.flatMap((s) =>
    s.lines.filter((l) => !ids.has(l.catalogItemId)).map((l) => l.name || "Unnamed item"),
  );
}

export function templateLineCount(template: Pick<QuoteTemplate, "sections">): number {
  return template.sections.reduce((n, s) => n + s.lines.length, 0);
}

// ------------------------------------------------------------------ display helpers

/** "5044(L) × 900(H)" for area lines; "" otherwise (whole mm, truncated — same as the app and API PDFs). */
export function sizeLabel(item: Pick<QuoteItem, "lengthMm" | "heightMm">): string {
  if (item.lengthMm === null || item.heightMm === null) return "";
  return `${Math.trunc(item.lengthMm)}(L) × ${Math.trunc(item.heightMm)}(H)`;
}

/** "3" / "2.50" — integers bare, fractions to 2 places (same as the app and API PDFs). */
export function qtyLabel(qty: number | null | undefined): string {
  if (qty === null || qty === undefined || !Number.isFinite(qty)) return "";
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
}
