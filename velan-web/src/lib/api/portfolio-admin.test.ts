import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRevalidateOrigin,
  checkRevalidateUser,
  portfolioAdminApi,
  revalidatePublicPortfolio,
  uploadPortfolioImage,
} from "./portfolio-admin";

const APP_URL = "https://app.velanspaces.com";

// ---------------------------------------------------------------- revalidate route guard

describe("checkRevalidateOrigin", () => {
  it("allows a same-origin request", () => {
    expect(checkRevalidateOrigin({ origin: "https://app.velanspaces.com" }, APP_URL)).toBeNull();
  });

  it("falls back to the Referer when there is no Origin", () => {
    expect(checkRevalidateOrigin({ referer: "https://app.velanspaces.com/app/website" }, APP_URL)).toBeNull();
  });

  it("blocks a cross-site request with 403", () => {
    expect(checkRevalidateOrigin({ origin: "https://evil.example" }, APP_URL)).toEqual({
      status: 403,
      message: expect.stringMatching(/cross-site/i),
    });
  });

  it("blocks a request with neither Origin nor Referer", () => {
    expect(checkRevalidateOrigin({}, APP_URL)?.status).toBe(403);
  });

  it("blocks the opaque 'null' origin", () => {
    expect(checkRevalidateOrigin({ origin: "null" }, APP_URL)?.status).toBe(403);
  });
});

describe("checkRevalidateUser", () => {
  it("allows the head", () => {
    expect(checkRevalidateUser({ role: "head", isSuspended: false })).toBeNull();
  });

  it("answers 401 when there is no session", () => {
    expect(checkRevalidateUser(null)?.status).toBe(401);
  });

  it.each(["manager", "worker", "client"] as const)("answers 403 for a %s", (role) => {
    expect(checkRevalidateUser({ role, isSuspended: false })?.status).toBe(403);
  });

  it("answers 403 for a suspended head", () => {
    expect(checkRevalidateUser({ role: "head", isSuspended: true })?.status).toBe(403);
  });
});

// ---------------------------------------------------------------- API wrappers (through the BFF)

type Call = { url: string; method: string; body: unknown };

function mockFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const next = responses.shift() ?? { status: 200, body: {} };
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

describe("portfolioAdminApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists, creates, updates, deletes and reorders via /api/bff/portfolio", async () => {
    const calls = mockFetch([
      { status: 200, body: [] },
      { status: 201, body: { id: "1" } },
      { status: 200, body: { id: "1" } },
      { status: 200, body: { ok: true } },
      { status: 200, body: [] },
    ]);

    await portfolioAdminApi.list();
    await portfolioAdminApi.create({ title: "Villa", category: "residential", status: "draft", imageUrls: [] });
    await portfolioAdminApi.update("1", { status: "published" });
    await portfolioAdminApi.remove("1");
    await portfolioAdminApi.reorder(["2", "1"]);

    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["GET", "/api/bff/portfolio"],
      ["POST", "/api/bff/portfolio"],
      ["PATCH", "/api/bff/portfolio/1"],
      ["DELETE", "/api/bff/portfolio/1"],
      ["PUT", "/api/bff/portfolio/order"],
    ]);
    expect(calls[2].body).toEqual({ status: "published" });
    expect(calls[4].body).toEqual({ ids: ["2", "1"] });
  });

  it("encodes the id in the path", async () => {
    const calls = mockFetch([{ status: 200, body: {} }]);
    await portfolioAdminApi.update("a/../b", { title: "x" });
    expect(calls[0].url).toBe("/api/bff/portfolio/a%2F..%2Fb");
  });

  it("surfaces API errors (e.g. 409 slug clash) as ApiError", async () => {
    mockFetch([{ status: 409, body: { statusCode: 409, message: "Slug already in use" } }]);
    await expect(portfolioAdminApi.create({ title: "Villa", category: "other", status: "draft", imageUrls: [] }))
      .rejects.toMatchObject({ status: 409, message: "Slug already in use" });
  });
});

describe("uploadPortfolioImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("signs the upload, PUTs the bytes, and resolves to the public URL", async () => {
    const calls = mockFetch([
      {
        status: 201,
        body: {
          path: "items/u/living-room.jpg",
          signedUrl: "https://x.supabase.co/storage/v1/object/upload/sign/portfolio/items/u/living-room.jpg?token=t",
          token: "t",
          publicUrl: "https://x.supabase.co/storage/v1/object/public/portfolio/items/u/living-room.jpg",
        },
      },
    ]);
    const put = vi.fn(async () => undefined);
    const file = new Blob(["abc"], { type: "image/jpeg" });

    const url = await uploadPortfolioImage(Object.assign(file, { name: "Living Room.jpg" }), "image/jpeg", { put });

    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "/api/bff/portfolio/uploads/sign",
      body: { fileName: "Living Room.jpg", contentType: "image/jpeg", size: 3 },
    });
    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("/object/upload/sign/"),
      expect.any(Blob),
      "image/jpeg",
      undefined,
      undefined,
    );
    expect(url).toBe("https://x.supabase.co/storage/v1/object/public/portfolio/items/u/living-room.jpg");
  });
});

describe("revalidatePublicPortfolio", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs to the same-origin route handler and reports success", async () => {
    const calls = mockFetch([{ status: 200, body: { revalidated: true } }]);
    await expect(revalidatePublicPortfolio()).resolves.toBe(true);
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/revalidate/portfolio" });
  });

  it("never throws: failures resolve to false", async () => {
    mockFetch([{ status: 403, body: { statusCode: 403, message: "nope" } }]);
    await expect(revalidatePublicPortfolio()).resolves.toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(revalidatePublicPortfolio()).resolves.toBe(false);
  });
});
