import { describe, expect, it } from "vitest";
import { isRole, isStaffRole, landingFor, postLoginRedirect, roleLabel } from "./roles";

describe("landingFor", () => {
  it("sends staff to the projects list", () => {
    expect(landingFor("head")).toBe("/app/projects");
    expect(landingFor("manager")).toBe("/app/projects");
    expect(landingFor("worker")).toBe("/app/projects");
  });

  it("sends clients to the portal", () => {
    expect(landingFor("client")).toBe("/portal");
  });
});

describe("postLoginRedirect", () => {
  it("honours a next path inside the role's own area", () => {
    expect(postLoginRedirect("manager", "/app/sales")).toBe("/app/sales");
    expect(postLoginRedirect("client", "/portal/projects/abc")).toBe("/portal/projects/abc");
  });

  it("ignores a next path in another role's area", () => {
    expect(postLoginRedirect("client", "/app/projects")).toBe("/portal");
    expect(postLoginRedirect("worker", "/portal")).toBe("/app/projects");
  });

  it("ignores unsafe or public next paths", () => {
    expect(postLoginRedirect("head", "https://evil.example/app")).toBe("/app/projects");
    expect(postLoginRedirect("head", "/about")).toBe("/app/projects");
    expect(postLoginRedirect("head", null)).toBe("/app/projects");
  });

  it("does not treat look-alike prefixes as the area", () => {
    expect(postLoginRedirect("head", "/application")).toBe("/app/projects");
    expect(postLoginRedirect("client", "/portals")).toBe("/portal");
  });
});

describe("role helpers", () => {
  it("recognises roles", () => {
    expect(isRole("head")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("separates staff from clients", () => {
    expect(isStaffRole("worker")).toBe(true);
    expect(isStaffRole("client")).toBe(false);
  });

  it("labels roles for people", () => {
    expect(roleLabel("head")).toBe("Admin");
    expect(roleLabel("manager")).toBe("Manager");
    expect(roleLabel("worker")).toBe("Worker");
    expect(roleLabel("client")).toBe("Client");
  });
});
