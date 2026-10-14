import { describe, expect, it, vi } from "vitest";

import { forwardedFor, handleEnquiry } from "../enquiry-handler";

const BASE = "http://api.test/api/v1";

const body = JSON.stringify({
  name: "Arun",
  phone: "+91 98765 43210",
  consent: true,
});

function mockFetch(status: number, json: unknown = {}) {
  return vi.fn(async () => new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } }));
}

describe("forwardedFor", () => {
  it("passes X-Forwarded-For through unchanged", () => {
    const value = "203.0.113.7, 10.0.0.2, 10.0.0.3, 10.0.0.4, 10.0.0.5, 10.0.0.6, 10.0.0.7, 10.0.0.8, 10.0.0.9, 10.0.0.10, 10.0.0.11";
    expect(forwardedFor(new Headers({ "x-forwarded-for": value }))).toBe(value);
  });

  it("is absent when the request has no X-Forwarded-For (x-real-ip is not used)", () => {
    expect(forwardedFor(new Headers({ "x-real-ip": "203.0.113.7" }))).toBeNull();
  });
});

describe("handleEnquiry", () => {
  it("maps API 201 to 200 { ok: true } and forwards payload + X-Forwarded-For", async () => {
    const fetchImpl = mockFetch(201, { ok: true });
    const result = await handleEnquiry(body, new Headers({ "x-forwarded-for": "203.0.113.7" }), fetchImpl, BASE);

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/public/enquiries`);
    expect((init.headers as Record<string, string>)["X-Forwarded-For"]).toBe("203.0.113.7");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Arun", phone: "+919876543210" });
  });

  it("omits X-Forwarded-For when the request has none", async () => {
    const fetchImpl = mockFetch(201);
    await handleEnquiry(body, new Headers(), fetchImpl, BASE);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("X-Forwarded-For");
  });

  it("forwards a filled honeypot so the API can silently drop it", async () => {
    const fetchImpl = mockFetch(201);
    const withHoneypot = JSON.stringify({ name: "Bot", phone: "9876543210", consent: true, company: "Spam Ltd" });
    const result = await handleEnquiry(withHoneypot, new Headers(), fetchImpl, BASE);
    expect(result.status).toBe(200);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).company).toBe("Spam Ltd");
  });

  it("rejects invalid input locally without calling the API", async () => {
    const fetchImpl = mockFetch(201);
    const result = await handleEnquiry(JSON.stringify({ name: "A", phone: "123" }), new Headers(), fetchImpl, BASE);
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    if (result.body.ok) return;
    expect(result.body.fieldErrors).toHaveProperty("phone");
    expect(result.body.fieldErrors).toHaveProperty("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const result = await handleEnquiry("not json", new Headers(), mockFetch(201), BASE);
    expect(result.status).toBe(400);
  });

  it("maps API 400 validation messages to field errors", async () => {
    const fetchImpl = mockFetch(400, { statusCode: 400, message: ["phone must be a valid phone number"] });
    const result = await handleEnquiry(body, new Headers(), fetchImpl, BASE);
    expect(result).toEqual({ status: 400, body: { ok: false, fieldErrors: { phone: "Please check your mobile number" } } });
  });

  it("maps API 429 to the rate-limit message", async () => {
    const result = await handleEnquiry(body, new Headers(), mockFetch(429), BASE);
    expect(result).toEqual({
      status: 429,
      body: { ok: false, formError: "Too many requests, please try again in a minute." },
    });
  });

  it("returns 502 when the API is unreachable or fails", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect((await handleEnquiry(body, new Headers(), down, BASE)).status).toBe(502);
    expect((await handleEnquiry(body, new Headers(), mockFetch(500), BASE)).status).toBe(502);
  });

  it("refuses oversized bodies", async () => {
    const huge = JSON.stringify({ name: "A", phone: "9876543210", consent: true, message: "x".repeat(20_000) });
    const result = await handleEnquiry(huge, new Headers(), mockFetch(201), BASE);
    expect(result.status).toBe(413);
  });
});
