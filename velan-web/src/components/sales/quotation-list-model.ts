import { QUOTE_STATUSES, quoteStatusLabel, type Quote } from "@/lib/api/sales-types";

export type QuoteStatusFilter = "all" | (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_TABS: { value: QuoteStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...QUOTE_STATUSES.map((s) => ({ value: s, label: quoteStatusLabel(s) })),
];

/** Name shown for a quotation: who it's prepared for. */
export const quotationPerson = (q: Pick<Quote, "preparedForName">): string => q.preparedForName?.trim() || "No name";

const haystack = (q: Quote) =>
  [q.quoteNumber, q.preparedForName, q.preparedForPhone, q.siteLocation, q.projectType, q.handledBy]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

/** Search by number, person, phone, location, type or handler; filter by status; newest first. */
export function filterQuotations(quotes: Quote[], text: string, status: QuoteStatusFilter): Quote[] {
  const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
  return quotes
    .filter((q) => status === "all" || q.status === status)
    .filter((q) => {
      const h = haystack(q);
      return terms.every((t) => h.includes(t));
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function countQuotationsByStatus(quotes: Quote[]): Record<QuoteStatusFilter, number> {
  const out = { all: quotes.length, draft: 0, sent: 0, accepted: 0, rejected: 0 } as Record<QuoteStatusFilter, number>;
  for (const q of quotes) if (q.status in out) out[q.status as QuoteStatusFilter] += 1;
  return out;
}
