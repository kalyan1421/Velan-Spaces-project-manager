import { describe, expect, it } from "vitest";
import type { Project } from "./api/types";
import { filterProjects, hasBudgetFields, isOverdue, parseProjectFilters, projectTabsFor } from "./projects";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    projectCode: "VS-001",
    projectName: "Lakeview Villa",
    clientName: "Anand",
    location: "Chennai",
    completionPercentage: 40,
    isComplete: false,
    startDate: "2026-01-10",
    targetEndDate: "2026-12-31",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("hasBudgetFields", () => {
  it("is true only when the API sent a budget field", () => {
    expect(hasBudgetFields(project())).toBe(false);
    expect(hasBudgetFields(project({ budget: "1500000.00" }))).toBe(true);
    expect(hasBudgetFields(project({ currentSpend: 0 }))).toBe(true);
  });
});

describe("projectTabsFor", () => {
  const keys = (tabs: { key: string }[]) => tabs.map((t) => t.key);

  it("gives a head every tab when budget fields are present", () => {
    expect(keys(projectTabsFor("head", project({ budget: 1 })))).toEqual([
      "overview",
      "updates",
      "designs",
      "files",
      "timeline",
      "workers",
      "rooms",
      "budget",
      "settlements",
      "support",
      "client-access",
    ]);
  });

  it("shows client access to heads and managers only", () => {
    expect(keys(projectTabsFor("head", project()))).toContain("client-access");
    expect(keys(projectTabsFor("manager", project()))).toContain("client-access");
    expect(keys(projectTabsFor("worker", project({ budget: 1 })))).not.toContain("client-access");
    expect(keys(projectTabsFor("client", project({ budget: 1 })))).not.toContain("client-access");
  });

  it("links client access under the project", () => {
    const tab = projectTabsFor("manager", project()).find((t) => t.key === "client-access");
    expect(tab).toEqual({ key: "client-access", label: "Client access", href: "/app/projects/p1/client-access" });
  });

  it("hides money tabs from a manager without budget access", () => {
    const tabs = keys(projectTabsFor("manager", project()));
    expect(tabs).toContain("workers");
    expect(tabs).toContain("rooms");
    expect(tabs).not.toContain("budget");
    expect(tabs).not.toContain("settlements");
  });

  it("hides workers, rooms and money from workers even if fields leak", () => {
    const tabs = keys(projectTabsFor("worker", project({ budget: 1 })));
    expect(tabs).toEqual(["overview", "updates", "designs", "files", "timeline", "support"]);
  });

  it("builds hrefs under the project", () => {
    const tabs = projectTabsFor("head", project());
    expect(tabs[0].href).toBe("/app/projects/p1");
    expect(tabs.find((t) => t.key === "updates")?.href).toBe("/app/projects/p1/updates");
  });
});

describe("parseProjectFilters", () => {
  it("reads q and status from search params", () => {
    expect(parseProjectFilters({ q: " villa ", status: "completed" })).toEqual({ q: "villa", status: "completed" });
  });

  it("defaults unknown status to all", () => {
    expect(parseProjectFilters({ status: "weird" })).toEqual({ q: "", status: "all" });
    expect(parseProjectFilters({ q: ["a", "b"] })).toEqual({ q: "a", status: "all" });
  });
});

describe("filterProjects", () => {
  const list = [
    project({ id: "1", projectName: "Lakeview Villa", projectCode: "VS-001" }),
    project({ id: "2", projectName: "Office Fitout", projectCode: "VS-002", isComplete: true, clientName: null }),
    project({ id: "3", projectName: "Kitchen", projectCode: "VS-003", location: "Coimbatore" }),
  ];

  it("filters by status", () => {
    expect(filterProjects(list, { q: "", status: "active" }).map((p) => p.id)).toEqual(["1", "3"]);
    expect(filterProjects(list, { q: "", status: "completed" }).map((p) => p.id)).toEqual(["2"]);
  });

  it("searches name, code, client and location case-insensitively", () => {
    expect(filterProjects(list, { q: "vs-002", status: "all" }).map((p) => p.id)).toEqual(["2"]);
    expect(filterProjects(list, { q: "coimbatore", status: "all" }).map((p) => p.id)).toEqual(["3"]);
    expect(filterProjects(list, { q: "ANAND", status: "all" }).map((p) => p.id)).toEqual(["1", "3"]);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-10-14T06:00:00Z");

  it("is true when the target date has passed and the project is open", () => {
    expect(isOverdue(project({ targetEndDate: "2026-10-13" }), now)).toBe(true);
  });

  it("is false on the target day, for completed projects, or without a date", () => {
    expect(isOverdue(project({ targetEndDate: "2026-10-14" }), now)).toBe(false);
    expect(isOverdue(project({ targetEndDate: "2026-01-01", isComplete: true }), now)).toBe(false);
    expect(isOverdue(project({ targetEndDate: null }), now)).toBe(false);
  });
});
