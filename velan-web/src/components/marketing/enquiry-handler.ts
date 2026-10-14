// Server-side logic for POST /api/enquiry, kept framework-free so it can be
// unit-tested. The route file only wires it to the request.

import { apiBaseUrl } from "./api";
import {
  GENERIC_FAILURE_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
  enquirySchema,
  fieldErrorsFromApi,
  fieldErrorsFromZod,
  toEnquiryApiPayload,
  type EnquiryResponse,
} from "./enquiry-schema";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const MAX_ENQUIRY_BODY_BYTES = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;

export type EnquiryResult = { status: number; body: EnquiryResponse };

/**
 * X-Forwarded-For to send to the API, passed through exactly as received.
 * The production reverse proxy overwrites XFF with the single client IP and
 * the API trusts exactly one hop (TRUST_PROXY_HOPS), so rewriting, truncating
 * or reordering it here would break per-visitor rate limiting or make it
 * spoofable. Absent → omitted.
 */
export function forwardedFor(headers: Headers): string | null {
  return headers.get("x-forwarded-for");
}

export async function handleEnquiry(
  rawBody: string,
  headers: Headers,
  fetchImpl: FetchLike = fetch,
  baseUrl: string = apiBaseUrl(),
): Promise<EnquiryResult> {
  if (new TextEncoder().encode(rawBody).byteLength > MAX_ENQUIRY_BODY_BYTES) {
    return { status: 413, body: { ok: false, formError: "Your message is too long. Please shorten it." } };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, formError: "Please check your details and try again." } };
  }

  const parsed = enquirySchema.safeParse(json);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) } };
  }

  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const xff = forwardedFor(headers);
  if (xff) upstreamHeaders["X-Forwarded-For"] = xff;

  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}/public/enquiries`, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(toEnquiryApiPayload(parsed.data)),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { status: 502, body: { ok: false, formError: GENERIC_FAILURE_MESSAGE } };
  }

  if (res.status === 201 || res.status === 200) {
    return { status: 200, body: { ok: true } };
  }

  if (res.status === 429) {
    return { status: 429, body: { ok: false, formError: TOO_MANY_REQUESTS_MESSAGE } };
  }

  if (res.status === 400) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const { fieldErrors } = fieldErrorsFromApi(body);
    return Object.keys(fieldErrors).length > 0
      ? { status: 400, body: { ok: false, fieldErrors } }
      : { status: 400, body: { ok: false, formError: "Please check your details and try again." } };
  }

  return { status: 502, body: { ok: false, formError: GENERIC_FAILURE_MESSAGE } };
}
