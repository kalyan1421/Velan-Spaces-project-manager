import { describe, expect, it } from "vitest";
import { isSafeMethod, isSameOriginRequest } from "./csrf";

const APP_URL = "https://app.velanspaces.com";

describe("isSafeMethod", () => {
  it("treats GET/HEAD/OPTIONS as safe", () => {
    expect(isSafeMethod("GET")).toBe(true);
    expect(isSafeMethod("head")).toBe(true);
    expect(isSafeMethod("OPTIONS")).toBe(true);
    expect(isSafeMethod("POST")).toBe(false);
    expect(isSafeMethod("DELETE")).toBe(false);
  });
});

describe("isSameOriginRequest", () => {
  it("accepts a matching Origin", () => {
    expect(isSameOriginRequest({ origin: "https://app.velanspaces.com" }, APP_URL)).toBe(true);
  });

  it("rejects a foreign Origin even with a matching Referer", () => {
    expect(
      isSameOriginRequest(
        { origin: "https://evil.example", referer: "https://app.velanspaces.com/app" },
        APP_URL,
      ),
    ).toBe(false);
  });

  it("falls back to the Referer when Origin is absent", () => {
    expect(isSameOriginRequest({ referer: "https://app.velanspaces.com/app/projects?x=1" }, APP_URL)).toBe(true);
    expect(isSameOriginRequest({ referer: "https://evil.example/app" }, APP_URL)).toBe(false);
  });

  it("rejects requests with neither header", () => {
    expect(isSameOriginRequest({}, APP_URL)).toBe(false);
  });

  it("rejects the opaque null origin", () => {
    expect(isSameOriginRequest({ origin: "null" }, APP_URL)).toBe(false);
  });

  it("does not accept look-alike hosts", () => {
    expect(isSameOriginRequest({ origin: "https://app.velanspaces.com.evil.example" }, APP_URL)).toBe(false);
    expect(isSameOriginRequest({ origin: "https://evilapp.velanspaces.com" }, APP_URL)).toBe(false);
  });

  it("compares the port as part of the host", () => {
    expect(isSameOriginRequest({ origin: "http://localhost:3100" }, "http://localhost:3100")).toBe(true);
    expect(isSameOriginRequest({ origin: "http://localhost:4000" }, "http://localhost:3100")).toBe(false);
  });

  it("ignores scheme differences introduced by TLS-terminating proxies", () => {
    expect(isSameOriginRequest({ origin: "https://app.velanspaces.com" }, "http://app.velanspaces.com")).toBe(true);
  });

  it("rejects malformed headers", () => {
    expect(isSameOriginRequest({ origin: "not a url" }, APP_URL)).toBe(false);
    expect(isSameOriginRequest({ referer: "::::" }, APP_URL)).toBe(false);
  });
});
