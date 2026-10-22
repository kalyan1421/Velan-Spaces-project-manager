/**
 * The quote builder's editable state and its pure transitions. The builder keeps
 * one `QuoteDraft`; every edit goes through these helpers so they stay testable.
 * `draftToInput` produces the PATCH body (server recomputes totals).
 */

import { todayIST, toDateKey } from "@/lib/api/money";
import {
  isQuoteStatus,
  type CatalogItemType,
  type DiscountType,
  type Lead,
  type QuotationSettings,
  type Quote,
  type QuoteInput,
  type QuoteItem,
  type QuoteSection,
  type QuoteStatus,
} from "@/lib/api/sales-types";
import { blankItem, computeQuoteTotals, recomputeItem } from "@/lib/quote-calc";

export type DraftItem = QuoteItem & { key: string };
export type DraftSection = { key: string; title: string; type: CatalogItemType; items: DraftItem[] };

export type QuoteDraft = {
  status: QuoteStatus;
  preparedForName: string;
  preparedForPhone: string;
  preparedForEmail: string;
  preparedForAddress: string;
  handledBy: string;
  designedBy: string;
  /** `yyyy-mm-dd` (IST) or "". */
  quoteDate: string;
  validUntil: string;
  enquiryDate: string;
  enquiryNo: string;
  siteLocation: string;
  projectType: string;
  /** One item per line, as typed. */
  notIncludedText: string;
  discountType: DiscountType;
  discountValue: number;
  gstPercent: number;
  sections: DraftSection[];
};

let counter = 0;
/** Stable React keys for sections/lines (never sent to the API). */
export function newKey(prefix = "k"): string {
  counter += 1;
  return `${prefix}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const keyed = (item: QuoteItem): DraftItem => ({ ...item, key: newKey("i") });

export function toDraftSection(section: QuoteSection): DraftSection {
  return { key: newKey("s"), title: section.title, type: section.type, items: section.items.map(keyed) };
}

export function draftFromQuote(quote: Quote): QuoteDraft {
  return {
    status: isQuoteStatus(quote.status) ? quote.status : "draft",
    preparedForName: quote.preparedForName ?? "",
    preparedForPhone: quote.preparedForPhone ?? "",
    preparedForEmail: quote.preparedForEmail ?? "",
    preparedForAddress: quote.preparedForAddress ?? "",
    handledBy: quote.handledBy ?? "",
    designedBy: quote.designedBy ?? "",
    quoteDate: toDateKey(quote.quoteDate ?? ""),
    validUntil: toDateKey(quote.validUntil ?? ""),
    enquiryDate: toDateKey(quote.enquiryDate ?? ""),
    enquiryNo: quote.enquiryNo ?? "",
    siteLocation: quote.siteLocation ?? "",
    projectType: quote.projectType ?? "",
    notIncludedText: quote.notIncluded.join("\n"),
    discountType: quote.discountType,
    discountValue: quote.discountValue,
    gstPercent: quote.gstPercent,
    sections: quote.sections.map(toDraftSection),
  };
}

/** Non-empty trimmed lines. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function stripKey(item: DraftItem): QuoteItem {
  const copy: Partial<DraftItem> = { ...item };
  delete copy.key;
  return copy as QuoteItem;
}

/** Lines that were never picked from the rate card are dropped on save. */
export function isEmptyLine(item: QuoteItem): boolean {
  return !item.catalogItemId && item.name.trim() === "";
}

/**
 * The `PATCH /quotes/:id` body. Amounts are recomputed; unpicked lines are left
 * out; a blank project type is not sent (the column is NOT NULL).
 */
export function draftToInput(draft: QuoteDraft, { round = true }: { round?: boolean } = {}): QuoteInput {
  const projectType = draft.projectType.trim();
  return {
    status: draft.status,
    preparedForName: draft.preparedForName.trim(),
    preparedForPhone: draft.preparedForPhone.trim(),
    preparedForEmail: draft.preparedForEmail.trim(),
    preparedForAddress: draft.preparedForAddress.trim(),
    handledBy: draft.handledBy.trim(),
    designedBy: draft.designedBy.trim(),
    quoteDate: draft.quoteDate || null,
    validUntil: draft.validUntil || null,
    enquiryDate: draft.enquiryDate || null,
    enquiryNo: draft.enquiryNo.trim(),
    siteLocation: draft.siteLocation.trim(),
    ...(projectType ? { projectType } : {}),
    notIncluded: splitLines(draft.notIncludedText),
    discountType: draft.discountType,
    discountValue: Number.isFinite(draft.discountValue) ? draft.discountValue : 0,
    gstPercent: Number.isFinite(draft.gstPercent) ? draft.gstPercent : 0,
    sections: draft.sections.map((s) => ({
      title: s.title.trim(),
      type: s.type,
      items: s.items.filter((i) => !isEmptyLine(i)).map((i) => recomputeItem(stripKey(i), round)),
    })),
  };
}

/** Stable fingerprint for dirty-checking (ignores React keys and unpicked lines). */
export function draftFingerprint(draft: QuoteDraft, round = true): string {
  return JSON.stringify(draftToInput(draft, { round }));
}

// ------------------------------------------------------------------ section edits

export function addSection(draft: QuoteDraft, title: string, type: CatalogItemType): QuoteDraft {
  const section: DraftSection = { key: newKey("s"), title: title.trim(), type, items: [{ ...blankItem(type), key: newKey("i") }] };
  return { ...draft, sections: [...draft.sections, section] };
}

export function updateSection(draft: QuoteDraft, key: string, patch: Partial<Pick<DraftSection, "title">>): QuoteDraft {
  return { ...draft, sections: draft.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)) };
}

export function removeSection(draft: QuoteDraft, key: string): QuoteDraft {
  return { ...draft, sections: draft.sections.filter((s) => s.key !== key) };
}

export function moveSection(draft: QuoteDraft, key: string, delta: -1 | 1): QuoteDraft {
  const from = draft.sections.findIndex((s) => s.key === key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= draft.sections.length) return draft;
  const sections = [...draft.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);
  return { ...draft, sections };
}

/** Appends (or replaces with) sections, e.g. from a template. */
export function insertSections(draft: QuoteDraft, sections: QuoteSection[], mode: "append" | "replace"): QuoteDraft {
  const next = sections.map(toDraftSection);
  return { ...draft, sections: mode === "replace" ? next : [...draft.sections, ...next] };
}

// ------------------------------------------------------------------ line edits

function mapSection(draft: QuoteDraft, sectionKey: string, fn: (s: DraftSection) => DraftSection): QuoteDraft {
  return { ...draft, sections: draft.sections.map((s) => (s.key === sectionKey ? fn(s) : s)) };
}

/** Adds an unpicked line (after `afterKey`, else at the end). Returns the draft and the new line's key. */
export function addLine(
  draft: QuoteDraft,
  sectionKey: string,
  afterKey?: string,
): { draft: QuoteDraft; key: string | null } {
  const section = draft.sections.find((s) => s.key === sectionKey);
  if (!section) return { draft, key: null };
  const line: DraftItem = { ...blankItem(section.type), key: newKey("i") };
  const next = mapSection(draft, sectionKey, (s) => {
    const at = afterKey ? s.items.findIndex((i) => i.key === afterKey) : -1;
    const items = [...s.items];
    items.splice(at >= 0 ? at + 1 : items.length, 0, line);
    return { ...s, items };
  });
  return { draft: next, key: line.key };
}

/** Replaces/merges a line and recomputes its amount. */
export function updateLine(
  draft: QuoteDraft,
  sectionKey: string,
  itemKey: string,
  patch: Partial<QuoteItem>,
  round = true,
): QuoteDraft {
  return mapSection(draft, sectionKey, (s) => ({
    ...s,
    items: s.items.map((i) => (i.key === itemKey ? recomputeItem({ ...i, ...patch, key: i.key }, round) : i)),
  }));
}

export function removeLine(draft: QuoteDraft, sectionKey: string, itemKey: string): QuoteDraft {
  return mapSection(draft, sectionKey, (s) => ({ ...s, items: s.items.filter((i) => i.key !== itemKey) }));
}

export function duplicateLine(draft: QuoteDraft, sectionKey: string, itemKey: string): QuoteDraft {
  return mapSection(draft, sectionKey, (s) => {
    const at = s.items.findIndex((i) => i.key === itemKey);
    if (at < 0) return s;
    const items = [...s.items];
    items.splice(at + 1, 0, { ...s.items[at], key: newKey("i") });
    return { ...s, items };
  });
}

/** Re-prices every line (e.g. after the rounding setting loads). */
export function recomputeDraft(draft: QuoteDraft, round = true): QuoteDraft {
  return {
    ...draft,
    sections: draft.sections.map((s) => ({ ...s, items: s.items.map((i) => recomputeItem(i, round)) })),
  };
}

export function lineCount(draft: QuoteDraft): number {
  return draft.sections.reduce((n, s) => n + s.items.filter((i) => !isEmptyLine(i)).length, 0);
}

// ------------------------------------------------------------------ new quotes

/** Adds whole days to a `yyyy-mm-dd` key. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * `POST /quotes` body for a new quote on a lead: prepared-for details from the
 * lead, defaults (GST, validity, project type, not-included) from the quotation
 * settings, optional sections (from a template). The server assigns the number.
 */
export function newQuoteInput({
  lead,
  settings,
  sections = [],
  handledBy = "",
  today = todayIST(),
}: {
  lead: Lead;
  settings: QuotationSettings;
  sections?: QuoteSection[];
  handledBy?: string;
  today?: string;
}): QuoteInput {
  const enquiryDate = toDateKey(lead.createdAt) || today;
  return {
    leadId: lead.id,
    status: "draft",
    preparedForName: lead.clientName?.trim() ?? "",
    preparedForPhone: lead.clientPhone?.trim() ?? "",
    preparedForEmail: "",
    preparedForAddress: "",
    handledBy,
    designedBy: "",
    quoteDate: today,
    validUntil: addDays(today, settings.quoteValidityDays),
    enquiryDate,
    enquiryNo: "",
    siteLocation: lead.area?.trim() ?? "",
    projectType: lead.projectType?.trim() || settings.defaultProjectType,
    notIncluded: settings.defaultNotIncluded,
    sections,
    discountType: "amount",
    discountValue: 0,
    gstPercent: settings.defaultGstPercent,
  };
}

/**
 * The quote as it would be after saving the draft — for the client-side PDF,
 * which renders the live state. Server-owned fields (number, created) are kept;
 * totals are recomputed the API's way.
 */
export function previewQuote(saved: Quote, draft: QuoteDraft, round = true): Quote {
  const input = draftToInput(draft, { round });
  const sections = input.sections ?? [];
  const totals = computeQuoteTotals(sections, draft.discountType, input.discountValue ?? 0, input.gstPercent ?? 0);
  return {
    ...saved,
    status: draft.status,
    preparedForName: input.preparedForName ?? null,
    preparedForPhone: input.preparedForPhone ?? null,
    preparedForEmail: input.preparedForEmail ?? null,
    preparedForAddress: input.preparedForAddress ?? null,
    handledBy: input.handledBy ?? null,
    designedBy: input.designedBy ?? null,
    quoteDate: input.quoteDate ?? null,
    validUntil: input.validUntil ?? null,
    enquiryDate: input.enquiryDate ?? null,
    enquiryNo: input.enquiryNo ?? null,
    siteLocation: input.siteLocation ?? null,
    projectType: input.projectType ?? saved.projectType,
    notIncluded: input.notIncluded ?? [],
    sections,
    discountType: draft.discountType,
    discountValue: input.discountValue ?? 0,
    gstPercent: input.gstPercent ?? 0,
    subtotal: totals.subtotal,
    grandTotal: Math.max(0, totals.grandTotal),
  };
}
