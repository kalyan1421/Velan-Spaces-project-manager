import { afterEach, describe, expect, it, vi } from "vitest";

import { apiBaseUrl, fetchPortfolioItem, fetchPortfolioList, normalizePortfolioItem } from "../api";

const BASE = "http://api.test/api/v1";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    slug: "anna-nagar-3bhk",
    title: "3BHK home",
    description: "Warm wood and white.",
    category: "residential",
    location: "Anna Nagar",
    completionYear: 2025,
    coverImageUrl: "https://x.supabase.co/storage/v1/object/public/portfolio/items/a/cover.jpg",
    imageUrls: ["https://x.supabase.co/storage/v1/object/public/portfolio/items/a/1.jpg"],
    sortOrder: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiBaseUrl", () => {
  it("defaults to the local API and strips trailing slashes", () => {
    expect(apiBaseUrl({})).toBe("http://localhost:3000/api/v1");
    expect(apiBaseUrl({ API_URL: "https://api.example.com/api/v1/" })).toBe("https://api.example.com/api/v1");
  });
});

describe("fetchPortfolioList", () => {
  it("falls back to an empty, not-ok result when the API is unreachable", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchPortfolioList(null, down, BASE)).resolves.toEqual({ ok: false, items: [] });
  });

  it("falls back when the global fetch rejects (default fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    await expect(fetchPortfolioList(null, undefined, BASE)).resolves.toEqual({ ok: false, items: [] });
  });

  it("falls back on error statuses and invalid JSON", async () => {
    await expect(fetchPortfolioList(null, respond(500, { message: "boom" }), BASE)).resolves.toEqual({ ok: false, items: [] });
    await expect(fetchPortfolioList(null, respond(200, "<html>"), BASE)).resolves.toEqual({ ok: false, items: [] });
    await expect(fetchPortfolioList(null, respond(200, { items: [] }), BASE)).resolves.toEqual({ ok: false, items: [] });
  });

  it("normalises, de-duplicates, drops malformed items and sorts by sortOrder", async () => {
    const fetchImpl = respond(200, [
      item({ slug: "b", sortOrder: 2 }),
      item({ slug: "a", sortOrder: 1, category: "unknown-category" }),
      item({ slug: "a", sortOrder: 5 }),
      { title: "no slug" },
      item({ slug: "Bad Slug!" }),
    ]);
    const result = await fetchPortfolioList(null, fetchImpl, BASE);
    expect(result.ok).toBe(true);
    expect(result.items.map((i) => i.slug)).toEqual(["a", "b"]);
    expect(result.items[0].category).toBe("other");
  });

  it("passes the category filter to the API", async () => {
    const fetchImpl = respond(200, []);
    await fetchPortfolioList("kitchen", fetchImpl, BASE);
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/public/portfolio?category=kitchen`, expect.anything());
  });
});

describe("fetchPortfolioItem", () => {
  it("returns found for a published item", async () => {
    const result = await fetchPortfolioItem("anna-nagar-3bhk", respond(200, item()), BASE);
    expect(result.status).toBe("found");
  });

  it("returns not-found on 404 and for invalid slugs (without calling the API)", async () => {
    await expect(fetchPortfolioItem("missing", respond(404, {}), BASE)).resolves.toEqual({ status: "not-found" });
    const fetchImpl = respond(200, item());
    await expect(fetchPortfolioItem("../admin", fetchImpl, BASE)).resolves.toEqual({ status: "not-found" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns error (not 404) when the API fails", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchPortfolioItem("x", down, BASE)).resolves.toEqual({ status: "error" });
    await expect(fetchPortfolioItem("x", respond(503, {}), BASE)).resolves.toEqual({ status: "error" });
  });
});

describe("normalizePortfolioItem", () => {
  it("keeps only http(s) image URLs and sane years", () => {
    const normalized = normalizePortfolioItem(
      item({ coverImageUrl: "javascript:alert(1)", imageUrls: ["ftp://x/y.jpg", "https://ok.test/a.jpg", 7], completionYear: "1066" }),
    );
    expect(normalized?.coverImageUrl).toBeNull();
    expect(normalized?.imageUrls).toEqual(["https://ok.test/a.jpg"]);
    expect(normalized?.completionYear).toBeNull();
  });
});
