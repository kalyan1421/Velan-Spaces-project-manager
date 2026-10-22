import { describe, expect, it } from "vitest";
import type { StaffMember } from "@/lib/api/project-ops";
import { availableWorkers, filterPeople, toPeople, withWorkers, withoutWorker } from "./workers-model";

const staff = (id: string, overrides: Partial<StaffMember> = {}): StaffMember => ({
  id,
  email: null,
  role: "worker",
  displayName: id,
  phone: null,
  trade: null,
  isSuspended: false,
  ...overrides,
});

describe("toPeople", () => {
  it("keeps only what the UI shows, sorted by name, with blank fields as null", () => {
    const people = toPeople([
      staff("w2", { displayName: "Zubair", trade: "  ", email: "z@velan.in" }),
      staff("w1", { displayName: null, email: "arun@velan.in", phone: " 98400 11111 " }),
    ]);
    expect(people).toEqual([
      { id: "w1", name: "arun", role: "worker", trade: null, phone: "98400 11111", suspended: false },
      { id: "w2", name: "Zubair", role: "worker", trade: null, phone: null, suspended: false },
    ]);
  });
});

describe("availableWorkers", () => {
  it("lists active workers who aren't on the project yet", () => {
    const people = toPeople([
      staff("w2", { displayName: "Zubair" }),
      staff("w1", { displayName: "Arun" }),
      staff("w3", { isSuspended: true }),
      staff("m1", { role: "manager" }),
      staff("w4", { displayName: "Bala" }),
    ]);
    expect(availableWorkers(people, ["w4"]).map((s) => s.id)).toEqual(["w1", "w2"]);
  });
});

describe("withWorkers / withoutWorker", () => {
  it("adds without duplicates and removes one id", () => {
    expect(withWorkers(["w1"], ["w1", "w2"])).toEqual(["w1", "w2"]);
    expect(withoutWorker(["w1", "w2"], "w1")).toEqual(["w2"]);
  });
});

describe("filterPeople", () => {
  it("matches name, trade or phone, case-insensitively", () => {
    const people = toPeople([
      staff("w1", { displayName: "Arun", trade: "Electrician" }),
      staff("w2", { displayName: "Bala", phone: "98400 11111" }),
      staff("w3", { displayName: "Chitra" }),
    ]);
    expect(filterPeople(people, "ELEC").map((s) => s.id)).toEqual(["w1"]);
    expect(filterPeople(people, "98400").map((s) => s.id)).toEqual(["w2"]);
    expect(filterPeople(people, " ")).toHaveLength(3);
  });
});
