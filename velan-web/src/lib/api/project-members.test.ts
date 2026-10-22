import { describe, expect, it } from "vitest";
import {
  memberNames,
  membersOfType,
  namesSummary,
  normalizeProjectMembers,
  projectMembersKey,
  projectMembersPath,
  toContentPeople,
  type ProjectMember,
} from "./project-members";

const m = (userId: string, memberType: ProjectMember["memberType"], fullName = userId): ProjectMember => ({
  userId,
  fullName,
  role: memberType === "budgetAccess" ? "manager" : memberType,
  memberType,
  trade: null,
  avatarUrl: null,
});

describe("paths and keys", () => {
  it("encodes the project id and nests the key under the project", () => {
    expect(projectMembersPath("p 1/..")).toBe("projects/p%201%2F../members");
    expect(projectMembersKey("p1").slice(0, 2)).toEqual(["project", "p1"]);
  });
});

describe("normalizeProjectMembers", () => {
  it("keeps valid rows and only the staff fields the API sent", () => {
    const list = normalizeProjectMembers([
      { userId: "w1", fullName: " Ravi ", role: "worker", memberType: "worker", trade: "Electrician", avatarUrl: null },
      {
        userId: "m1",
        fullName: "Meera",
        role: "manager",
        memberType: "manager",
        trade: null,
        avatarUrl: null,
        email: "meera@velan.test",
        phone: "",
        username: null,
        isSuspended: false,
      },
    ]);
    expect(list).toEqual([
      { userId: "w1", fullName: "Ravi", role: "worker", memberType: "worker", trade: "Electrician", avatarUrl: null },
      {
        userId: "m1",
        fullName: "Meera",
        role: "manager",
        memberType: "manager",
        trade: null,
        avatarUrl: null,
        email: "meera@velan.test",
        phone: null,
        username: null,
        isSuspended: false,
      },
    ]);
    expect(list[0]).not.toHaveProperty("email");
  });

  it("drops malformed rows and fills a generic name", () => {
    expect(
      normalizeProjectMembers([
        null,
        { userId: "x", memberType: "owner" },
        { memberType: "worker" },
        { userId: "c1", memberType: "client", role: "superuser" },
      ]),
    ).toEqual([{ userId: "c1", fullName: "Client", role: null, memberType: "client", trade: null, avatarUrl: null }]);
    expect(normalizeProjectMembers({ not: "a list" })).toEqual([]);
  });
});

describe("helpers", () => {
  const members = [m("m1", "manager", "Meera"), m("w1", "worker", "Ravi"), m("m1", "budgetAccess", "Meera"), m("u1", "manager", "Uma"), m("u1", "worker", "Uma")];

  it("filters by member type", () => {
    expect(membersOfType(members, "worker").map((x) => x.userId)).toEqual(["w1", "u1"]);
  });

  it("maps ids to names once per user", () => {
    expect([...memberNames(members)]).toEqual([
      ["m1", "Meera"],
      ["w1", "Ravi"],
      ["u1", "Uma"],
    ]);
  });

  it("builds tag/label people, deduped, optionally by type", () => {
    expect(toContentPeople(members, "worker")).toEqual([
      { id: "w1", name: "Ravi" },
      { id: "u1", name: "Uma" },
    ]);
    expect(toContentPeople(members)).toHaveLength(3);
  });

  it("summarises names for a sentence", () => {
    expect(namesSummary([])).toBe("");
    expect(namesSummary(["Meera"])).toBe("Meera");
    expect(namesSummary(["Meera", "Arun"])).toBe("Meera and Arun");
    expect(namesSummary(["A", "B", "C"])).toBe("A, B and C");
    expect(namesSummary(["A", "B", "C", "D"])).toBe("A, B, C and 1 other");
    expect(namesSummary(["A", "B", "C", "D", "E"], 2)).toBe("A, B and 3 others");
  });
});
