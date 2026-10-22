import { DEFAULT_QUOTE_PREFIX, SALES_TIME_ZONE } from './sales.constants';

/**
 * Quote numbers: "<prefix>-<YYYY>-<NNNN>", e.g. "QUO-2026-0007".
 *
 * The settings prefix may already end with dashes (the default is "QUO-"), so
 * trailing dashes are dropped before joining. The sequence comes from the
 * atomic SQL function next_quote_seq(year); this file only formats.
 */
export function formatQuoteNumber(prefix: string | null | undefined, year: number, seq: number): string {
  const p = (prefix ?? '').trim().replace(/-+$/, '') || DEFAULT_QUOTE_PREFIX.replace(/-+$/, '');
  return `${p}-${year}-${String(seq).padStart(4, '0')}`;
}

/** Calendar year of `date` in the business time zone (IST). */
export function quoteYear(date: Date = new Date(), timeZone: string = SALES_TIME_ZONE): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(date));
}

/** Safe file name for a quote PDF: "QUO-2026-0007.pdf" (anything odd -> "_"). */
export function quotePdfFileName(quoteNumber: string | null | undefined): string {
  const base = (quoteNumber ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '_') || 'quotation';
  return `${base}.pdf`;
}
