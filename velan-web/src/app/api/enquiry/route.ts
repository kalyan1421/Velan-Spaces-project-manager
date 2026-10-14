import { MAX_ENQUIRY_BODY_BYTES, handleEnquiry } from "@/components/marketing/enquiry-handler";

/**
 * POST /api/enquiry — public website enquiry → lead.
 * Validates with the shared zod schema, then forwards to
 * `${API_URL}/public/enquiries` with the visitor's X-Forwarded-For.
 * Responses: 200 { ok: true } | 400 field/form errors | 429 rate limited | 502 upstream failure.
 */
export async function POST(request: Request): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_ENQUIRY_BODY_BYTES) {
    return Response.json(
      { ok: false, formError: "Your message is too long. Please shorten it." },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return Response.json(
      { ok: false, formError: "Please check your details and try again." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await handleEnquiry(rawBody, request.headers);
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
