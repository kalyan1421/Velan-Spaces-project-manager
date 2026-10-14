import { describe, expect, it } from "vitest";
import { validateBffPath } from "./bff-path";

describe("validateBffPath", () => {
  it("accepts ordinary resource paths and encodes them", () => {
    expect(validateBffPath(["projects", "0b7c6a8e-1f2d-4c3b-9a8e-7f6d5c4b3a21", "updates"])).toEqual({
      ok: true,
      path: "projects/0b7c6a8e-1f2d-4c3b-9a8e-7f6d5c4b3a21/updates",
    });
    expect(validateBffPath(["notifications", "unread-count"])).toEqual({
      ok: true,
      path: "notifications/unread-count",
    });
  });

  it("rejects an empty path", () => {
    expect(validateBffPath([])).toMatchObject({ ok: false, status: 404 });
    expect(validateBffPath(undefined)).toMatchObject({ ok: false, status: 404 });
  });

  it("rejects empty, dot and dot-dot segments", () => {
    expect(validateBffPath(["projects", ""])).toMatchObject({ ok: false, status: 400 });
    expect(validateBffPath(["projects", "."])).toMatchObject({ ok: false, status: 400 });
    expect(validateBffPath(["projects", "..", "staff"])).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects decoded or still-encoded slashes and backslashes", () => {
    expect(validateBffPath(["projects/../staff"])).toMatchObject({ ok: false });
    expect(validateBffPath(["projects%2F..%2Fstaff"])).toMatchObject({ ok: false });
    expect(validateBffPath(["projects\\staff"])).toMatchObject({ ok: false });
    expect(validateBffPath(["%2e%2e"])).toMatchObject({ ok: false });
  });

  it("rejects absolute URLs and protocol-relative tricks", () => {
    expect(validateBffPath(["http:", "", "evil.example", "x"])).toMatchObject({ ok: false });
    expect(validateBffPath(["https:evil.example"])).toMatchObject({ ok: false });
    expect(validateBffPath(["//evil.example"])).toMatchObject({ ok: false });
  });

  it("rejects query, fragment and control characters smuggled into segments", () => {
    expect(validateBffPath(["projects?x=1"])).toMatchObject({ ok: false });
    expect(validateBffPath(["projects#x"])).toMatchObject({ ok: false });
    expect(validateBffPath(["projects\u0000"])).toMatchObject({ ok: false });
    expect(validateBffPath(["pro jects"])).toMatchObject({ ok: false });
  });

  it("rejects absurdly long or deep paths", () => {
    expect(validateBffPath(["a".repeat(300)])).toMatchObject({ ok: false });
    expect(validateBffPath(Array.from({ length: 20 }, () => "a"))).toMatchObject({ ok: false });
  });

  it("blocks token-bearing auth endpoints that have dedicated handlers", () => {
    for (const path of [
      ["auth", "login"],
      ["auth", "refresh"],
      ["auth", "google"],
      ["auth", "logout"],
      ["auth", "invites", "abc123", "accept"],
      ["auth", "password-reset", "abc123"],
      ["AUTH", "Login"],
    ]) {
      expect(validateBffPath(path)).toMatchObject({ ok: false, status: 404 });
    }
  });

  it("allows the other auth endpoints the app needs", () => {
    expect(validateBffPath(["auth", "me"])).toMatchObject({ ok: true });
    expect(validateBffPath(["auth", "change-password"])).toMatchObject({ ok: true });
  });
});
