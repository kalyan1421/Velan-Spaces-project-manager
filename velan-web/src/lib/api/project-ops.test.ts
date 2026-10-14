import { describe, expect, it } from "vitest";
import { projectOpsKeys, projectOpsPaths, staffName } from "./project-ops";

describe("projectOpsPaths", () => {
  it("builds the timeline routes the API exposes (no legacy POST /timeline)", () => {
    expect(projectOpsPaths.timeline("p1")).toBe("projects/p1/timeline");
    expect(projectOpsPaths.timelineTask("p1", "t1")).toBe("projects/p1/timeline/tasks/t1");
  });

  it("encodes ids so a crafted id can't escape its path segment", () => {
    expect(projectOpsPaths.room("p1", "../staff")).toBe("projects/p1/rooms/..%2Fstaff");
    expect(projectOpsPaths.complaint("p 1", "c?x=1")).toBe("projects/p%201/complaints/c%3Fx%3D1");
  });
});

describe("projectOpsKeys", () => {
  it("nests every project resource under the project key so one invalidation can cover them", () => {
    expect(projectOpsKeys.timeline("p1").slice(0, 2)).toEqual(projectOpsKeys.project("p1"));
    expect(projectOpsKeys.chat("p1").slice(0, 2)).toEqual(projectOpsKeys.project("p1"));
  });
});

describe("staffName", () => {
  it("prefers the display name, then username, then the email local part", () => {
    expect(staffName({ displayName: " Ravi ", email: "r@x.in", username: "ravi" })).toBe("Ravi");
    expect(staffName({ displayName: "", email: null, username: "ravi.k" })).toBe("ravi.k");
    expect(staffName({ displayName: null, email: "meena@velan.in" })).toBe("meena");
    expect(staffName({ displayName: null, email: null })).toBe("Unnamed");
    expect(staffName(undefined)).toBe("Unknown");
  });
});
