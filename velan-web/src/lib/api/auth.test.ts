import { describe, expect, it } from "vitest";
import { isSessionPayload, loginRequest, splitSessionPayload } from "./auth";

describe("loginRequest", () => {
  it("sends an email login when the identifier contains @", () => {
    expect(loginRequest("head@velanspaces.com", "secret123")).toEqual({
      email: "head@velanspaces.com",
      password: "secret123",
    });
  });

  it("sends an identifier login for usernames", () => {
    expect(loginRequest("ravi.k", "secret123")).toEqual({
      identifier: "ravi.k",
      password: "secret123",
    });
  });

  it("trims the identifier and lower-cases emails, but never touches the password", () => {
    expect(loginRequest("  Head@VelanSpaces.com ", " pass word ")).toEqual({
      email: "head@velanspaces.com",
      password: " pass word ",
    });
  });

  it("keeps username case as typed", () => {
    expect(loginRequest(" Ravi ", "x")).toEqual({ identifier: "Ravi", password: "x" });
  });
});

describe("isSessionPayload", () => {
  const session = {
    accessToken: "a",
    refreshToken: "r",
    expiresAt: 1_800_000_000,
    user: { id: "u1", email: null, role: "worker", displayName: "Ravi", isSuspended: false },
  };

  it("accepts a well-formed session", () => {
    expect(isSessionPayload(session)).toBe(true);
  });

  it("rejects missing tokens or unknown roles", () => {
    expect(isSessionPayload({ ...session, accessToken: "" })).toBe(false);
    expect(isSessionPayload({ ...session, user: { ...session.user, role: "admin" } })).toBe(false);
    expect(isSessionPayload({ accountExists: true })).toBe(false);
  });
});

describe("splitSessionPayload", () => {
  it("separates tokens from the rest of a JSON body", () => {
    const { tokens, rest } = splitSessionPayload({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 1_800_000_000,
      changed: true,
    });
    expect(tokens).toEqual({ accessToken: "a", refreshToken: "r", expiresAt: 1_800_000_000 });
    expect(rest).toEqual({ changed: true });
  });

  it("strips stray token fields even when the set is incomplete", () => {
    const { tokens, rest } = splitSessionPayload({ refreshToken: "r", ok: true });
    expect(tokens).toBeNull();
    expect(rest).toEqual({ ok: true });
  });

  it("leaves non-objects and arrays untouched", () => {
    expect(splitSessionPayload([1, 2]).rest).toEqual([1, 2]);
    expect(splitSessionPayload("text").rest).toBe("text");
    expect(splitSessionPayload(null).tokens).toBeNull();
  });
});
