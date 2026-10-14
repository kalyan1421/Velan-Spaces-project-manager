import { describe, expect, it } from "vitest";
import { isExpired, isValidLinkToken, linkProblemFrom } from "./links";

describe("isValidLinkToken", () => {
  it("accepts url-safe tokens", () => {
    expect(isValidLinkToken("abcDEF123_-xyz")).toBe(true);
    expect(isValidLinkToken("a1b2c3d4.e5f6")).toBe(true);
  });

  it("rejects short, empty or path-like values", () => {
    expect(isValidLinkToken("abc")).toBe(false);
    expect(isValidLinkToken("")).toBe(false);
    expect(isValidLinkToken("../../auth/login")).toBe(false);
    expect(isValidLinkToken("abc/def/ghi")).toBe(false);
    expect(isValidLinkToken("abc%2Fdefghi")).toBe(false);
    expect(isValidLinkToken(undefined)).toBe(false);
  });
});

describe("linkProblemFrom", () => {
  it("treats a missing route as unavailable", () => {
    expect(linkProblemFrom(404, "Cannot GET /api/v1/auth/invites/abc")).toBe("unavailable");
    expect(linkProblemFrom(501, null)).toBe("unavailable");
  });

  it("treats a missing token as invalid and gone as expired", () => {
    expect(linkProblemFrom(404, "Invite not found")).toBe("invalid");
    expect(linkProblemFrom(410, "Invite expired")).toBe("expired");
  });

  it("falls back to a generic error", () => {
    expect(linkProblemFrom(500, null)).toBe("error");
    expect(linkProblemFrom(0, null)).toBe("error");
  });
});

describe("isExpired", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("compares against now", () => {
    expect(isExpired("2026-10-14T11:59:59Z", now)).toBe(true);
    expect(isExpired("2026-10-15T00:00:00Z", now)).toBe(false);
  });

  it("treats missing or invalid dates as not expired", () => {
    expect(isExpired(null, now)).toBe(false);
    expect(isExpired("nope", now)).toBe(false);
  });
});
