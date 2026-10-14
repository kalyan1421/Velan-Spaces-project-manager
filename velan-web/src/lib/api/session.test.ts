import { afterEach, describe, expect, it, vi } from "vitest";
import { isTerminalRefreshFailure, refreshTokens } from "./session";

function tokenResponse(n: number) {
  return new Response(JSON.stringify({ accessToken: `at-${n}`, refreshToken: `rt-${n}`, expiresAt: 1_900_000_000 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshTokens", () => {
  it("shares one upstream call between concurrent requests with the same refresh token", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 5));
        return tokenResponse(calls);
      }),
    );

    const [a, b, c] = await Promise.all([
      refreshTokens("rt-shared-1"),
      refreshTokens("rt-shared-1"),
      refreshTokens("rt-shared-1"),
    ]);

    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a).toMatchObject({ ok: true, tokens: { accessToken: "at-1" } });
  });

  it("reuses a just-settled result for late requests carrying the old token", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return tokenResponse(calls);
      }),
    );

    await refreshTokens("rt-late-1");
    const late = await refreshTokens("rt-late-1");
    expect(calls).toBe(1);
    expect(late).toMatchObject({ ok: true });
  });

  it("does not pin transient failures", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new TypeError("network down");
        return tokenResponse(calls);
      }),
    );

    const first = await refreshTokens("rt-flaky-1");
    expect(first).toEqual({ ok: false, status: 0 });
    expect(isTerminalRefreshFailure(first)).toBe(false);

    const second = await refreshTokens("rt-flaky-1");
    expect(second).toMatchObject({ ok: true });
    expect(calls).toBe(2);
  });

  it("reports a rejected refresh token as terminal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ statusCode: 401, message: "Invalid refresh token" }, { status: 401 })),
    );
    const outcome = await refreshTokens("rt-revoked-1");
    expect(outcome).toMatchObject({ ok: false, status: 401 });
    expect(isTerminalRefreshFailure(outcome)).toBe(true);
  });

  it("treats a malformed success body as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ hello: "world" })));
    expect(await refreshTokens("rt-weird-1")).toMatchObject({ ok: false, status: 502 });
  });

  it("never treats rate limiting as terminal", () => {
    expect(isTerminalRefreshFailure({ ok: false, status: 429 })).toBe(false);
    expect(isTerminalRefreshFailure({ ok: false, status: 403 })).toBe(true);
  });
});
