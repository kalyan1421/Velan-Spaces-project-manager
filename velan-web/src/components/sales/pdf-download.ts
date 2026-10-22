/**
 * Quote PDF downloads. Two routes to the same document:
 * - client: rendered in the browser with @react-pdf/renderer (lazy-loaded, so the
 *   ~1 MB renderer never ships with other pages) from the builder's live state;
 * - server: `GET /api/quotes/:id/pdf` (route handler → API `pdfkit`), from the
 *   saved quote.
 */

import { loginUrl } from "@/lib/auth/redirects";
import { ApiError, apiErrorFromBody, readBody } from "@/lib/api/errors";
import { serverPdfUrl } from "@/lib/api/sales";
import type { QuotationSettings, Quote } from "@/lib/api/sales-types";

/** "QUO-2026-0007-Asha-Raman.pdf" — safe on every OS. */
export function pdfFileName(quote: Pick<Quote, "quoteNumber" | "preparedForName">): string {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);
  const parts = [clean(quote.quoteNumber ?? "") || "Quote", clean(quote.preparedForName ?? "")].filter(Boolean);
  return `${parts.join("-")}.pdf`;
}

/** Triggers a browser download for a Blob. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Downloads the server-generated PDF of the saved quote. Throws ApiError. */
export async function downloadServerPdf(quote: Pick<Quote, "id" | "quoteNumber" | "preparedForName">): Promise<void> {
  let res: Response;
  try {
    res = await fetch(serverPdfUrl(quote.id), { credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "");
  }
  if (res.status === 401) {
    window.location.assign(loginUrl(`${window.location.pathname}${window.location.search}`, "expired"));
    throw new ApiError(401, "");
  }
  if (!res.ok) throw apiErrorFromBody(res.status, await readBody(res));
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("pdf")) throw new ApiError(502, "The server didn't return a PDF.");
  saveBlob(await res.blob(), pdfFileName(quote));
}

/** Renders the quote in the browser and downloads it. */
export async function downloadClientPdf(quote: Quote, settings: QuotationSettings): Promise<void> {
  const { renderQuotePdf } = await import("./quote-pdf-document");
  const blob = await renderQuotePdf(quote, settings);
  saveBlob(blob, pdfFileName(quote));
}
