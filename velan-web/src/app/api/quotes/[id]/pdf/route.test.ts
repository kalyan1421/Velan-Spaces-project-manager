import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  readSessionTokens: vi.fn(),
  refreshAndPersist: vi.fn(),
}));

vi.mock("@/lib/api/session", () => ({
  readSessionTokens: session.readSessionTokens,
  refreshAndPersist: session.refreshAndPersist,
  isTerminalRefreshFailure: (o: { ok: boolean; status?: number }) =>
    !o.ok && (o.status ?? 0) >= 400 && (o.status ?? 0) < 500 && o.status !== 429,
}));

vi.mock("@/lib/api/server", () => ({
  apiUrl: (path: string) => `http://api.test/api/v1/${path}`,
  networkError: () => ({ status: 502, message: "We couldn't reach the server. Please try again." }),
}));

const { GET } = await import("./route");

const ID = "0b9f7c2e-4c4e-4a8e-9d55-2f4a3f1b6c11";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // "%PDF-1.7"

function request(id = ID, query = "") {
  return [
    new NextRequest(`http://localhost:3100/api/quotes/${id}/pdf${query}`),
    { params: Promise.resolve({ id }) },
  ] as unknown as Parameters<typeof GET>;
}

const pdfResponse = () =>
  new Response(PDF, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(PDF.length),
      "Content-Disposition": 'inline; filename="QUO-2026-0007.pdf"',
    },
  });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  session.readSessionTokens.mockResolvedValue({ accessToken: "at-1", refreshToken: "rt-1" });
  session.refreshAndPersist.mockResolvedValue({ ok: true, tokens: { accessToken: "at-2", refreshToken: "rt-2", expiresAt: 0 } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  session.readSessionTokens.mockReset();
  session.refreshAndPersist.mockReset();
});

describe("GET /api/quotes/:id/pdf", () => {
  it("streams the API's PDF bytes with the session token", async () => {
    fetchMock.mockResolvedValueOnce(pdfResponse());
    const res = await GET(...request(ID, "?download=1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="QUO-2026-0007.pdf"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-length")).toBe("8");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.test/api/v1/quotes/${ID}/pdf`);
    expect(init.headers.Authorization).toBe("Bearer at-1");
    expect(init.headers.Accept).toContain("application/pdf");
  });

  it("opens inline without ?download=1", async () => {
    fetchMock.mockResolvedValueOnce(pdfResponse());
    const res = await GET(...request());
    expect(res.headers.get("content-disposition")).toBe('inline; filename="QUO-2026-0007.pdf"');
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(pdfResponse());
    const res = await GET(...request());
    expect(res.status).toBe(200);
    expect(session.refreshAndPersist).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer at-2");
  });

  it("refreshes first when only the refresh cookie is left", async () => {
    session.readSessionTokens.mockResolvedValue({ accessToken: null, refreshToken: "rt-1" });
    fetchMock.mockResolvedValueOnce(pdfResponse());
    const res = await GET(...request());
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer at-2");
  });

  it("answers 401 without a session or when the refresh is rejected", async () => {
    session.readSessionTokens.mockResolvedValue({ accessToken: null, refreshToken: null });
    expect((await GET(...request())).status).toBe(401);

    session.readSessionTokens.mockResolvedValue({ accessToken: "at-1", refreshToken: "rt-1" });
    session.refreshAndPersist.mockResolvedValue({ ok: false, status: 401 });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await GET(...request())).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects ids that can't exist without calling the API", async () => {
    expect((await GET(...request("not-a-uuid"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes API 4xx messages through and hides 5xx details", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ statusCode: 404, message: "Quote not found" }, { status: 404 }));
    const notFound = await GET(...request());
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toMatchObject({ message: "Quote not found" });

    fetchMock.mockResolvedValueOnce(new Response("stack trace", { status: 500 }));
    const broken = await GET(...request());
    expect(broken.status).toBe(502);
    expect(JSON.stringify(await broken.json())).not.toContain("stack trace");
  });

  it("refuses a non-PDF success body", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));
    expect((await GET(...request())).status).toBe(502);
  });

  it("maps network failures to 502", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await GET(...request())).status).toBe(502);
  });
});
