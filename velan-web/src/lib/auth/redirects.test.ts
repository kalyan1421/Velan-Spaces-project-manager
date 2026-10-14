import { describe, expect, it } from "vitest";
import { loginUrl, safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it("accepts same-origin relative paths with query strings", () => {
    expect(safeNextPath("/app/projects")).toBe("/app/projects");
    expect(safeNextPath("/app/projects?status=active&q=villa")).toBe("/app/projects?status=active&q=villa");
    expect(safeNextPath("/portal")).toBe("/portal");
  });

  it("takes the first value of an array param", () => {
    expect(safeNextPath(["/app/profile", "/evil"])).toBe("/app/profile");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example/app")).toBeNull();
    expect(safeNextPath("//evil.example/app")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath("\\\\evil.example")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("rejects paths that are not rooted", () => {
    expect(safeNextPath("app/projects")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });

  it("rejects control characters and encoded slashes that browsers may normalise", () => {
    expect(safeNextPath("/\t/evil.example")).toBeNull();
    expect(safeNextPath("/%2F%2Fevil.example")).toBeNull();
    expect(safeNextPath("/%5Cevil.example")).toBeNull();
  });

  it("rejects auth pages and API routes as destinations", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=/app")).toBeNull();
    expect(safeNextPath("/api/auth/logout")).toBeNull();
  });

  it("rejects absurdly long values", () => {
    expect(safeNextPath(`/app/${"a".repeat(3000)}`)).toBeNull();
  });
});

describe("loginUrl", () => {
  it("builds a login URL with an encoded next param", () => {
    expect(loginUrl("/app/projects?status=active")).toBe("/login?next=%2Fapp%2Fprojects%3Fstatus%3Dactive");
  });

  it("drops unsafe next values", () => {
    expect(loginUrl("https://evil.example")).toBe("/login");
    expect(loginUrl(null)).toBe("/login");
  });

  it("adds a reason when given", () => {
    expect(loginUrl("/app", "suspended")).toBe("/login?next=%2Fapp&reason=suspended");
    expect(loginUrl(null, "expired")).toBe("/login?reason=expired");
  });
});
