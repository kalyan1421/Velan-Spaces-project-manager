import { afterEach, describe, expect, it, vi } from "vitest";
import { projectOps, projectOpsKeys, projectOpsPaths, staffName } from "./project-ops";

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

describe("project create / update / delete requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(response: unknown) {
    const calls: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
        return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    return calls;
  }

  it("POST /projects with the body as given (the API's CreateProjectDto fields)", async () => {
    const calls = stubFetch({ id: "p1" });
    const body = { projectName: "Lakeview", projectCode: "VS-1", workerIds: ["w1"], budget: 100 };
    await expect(projectOps.createProject(body)).resolves.toEqual({ id: "p1" });
    expect(calls).toEqual([{ url: "/api/bff/projects", method: "POST", body }]);
  });

  it("PATCH /projects/:id with only the given fields (null clears)", async () => {
    const calls = stubFetch({ id: "p1" });
    await projectOps.updateProject("p1", { location: null });
    expect(calls).toEqual([{ url: "/api/bff/projects/p1", method: "PATCH", body: { location: null } }]);
  });

  it("DELETE /projects/:id (head only; the API answers { deleted: true })", async () => {
    const calls = stubFetch({ deleted: true });
    await expect(projectOps.deleteProject("p1")).resolves.toEqual({ deleted: true });
    expect(calls).toEqual([{ url: "/api/bff/projects/p1", method: "DELETE", body: undefined }]);
  });
});
