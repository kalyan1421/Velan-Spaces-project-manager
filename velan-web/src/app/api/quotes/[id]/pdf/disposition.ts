/** Content-Disposition for the proxied quote PDF (pure, unit-tested). */

const FALLBACK = "quote.pdf";

/** The filename from an upstream `Content-Disposition`, reduced to safe characters. */
export function safePdfFileName(upstream: string | null | undefined): string {
  if (!upstream) return FALLBACK;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(upstream);
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(upstream);
  let raw = (star?.[1] ?? plain?.[1] ?? "").trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep as-is
  }
  const base = raw
    .replace(/^.*[\\/]/, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  if (!base) return FALLBACK;
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

/** `attachment` when the caller asked to download, else `inline` (open in the browser's viewer). */
export function pdfDisposition(upstream: string | null | undefined, download: boolean): string {
  return `${download ? "attachment" : "inline"}; filename="${safePdfFileName(upstream)}"`;
}
