import { describe, expect, it } from "vitest";
import { isNavItemActive, navFor } from "./nav";

describe("navFor", () => {
  const labels = (role: Parameters<typeof navFor>[0]) => navFor(role).map((i) => i.label);

  it("gives the head every section", () => {
    expect(labels("head")).toEqual(["Projects", "Sales", "Staff", "Website", "Notifications", "Profile"]);
    const sales = navFor("head").find((i) => i.label === "Sales");
    expect(sales?.children?.map((c) => c.label)).toEqual(["Quotations", "Rate card", "Templates", "Quotation settings"]);
  });

  it("gives managers projects and sales without admin sections", () => {
    expect(labels("manager")).toEqual(["Projects", "Sales", "Notifications", "Profile"]);
    expect(navFor("manager").find((i) => i.label === "Sales")?.children?.map((c) => c.label)).toEqual(["Quotations"]);
  });

  it("gives workers the minimum", () => {
    expect(labels("worker")).toEqual(["Projects", "Notifications", "Profile"]);
  });

  it("gives clients nothing in the staff shell", () => {
    expect(navFor("client")).toEqual([]);
  });
});

describe("isNavItemActive", () => {
  const sales = navFor("head").find((i) => i.label === "Sales")!;
  const projects = navFor("head").find((i) => i.label === "Projects")!;

  it("matches the section root and its children", () => {
    expect(isNavItemActive(projects, "/app/projects")).toBe(true);
    expect(isNavItemActive(projects, "/app/projects/abc/updates")).toBe(true);
  });

  it("matches extra prefixes owned by the section", () => {
    expect(isNavItemActive(sales, "/app/quotes/q1")).toBe(true);
  });

  it("does not match look-alike prefixes", () => {
    expect(isNavItemActive(projects, "/app/projectsx")).toBe(false);
    expect(isNavItemActive(sales, "/app/projects")).toBe(false);
  });
});
