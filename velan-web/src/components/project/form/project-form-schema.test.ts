import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { Project } from "@/lib/api/types";
import {
  canConfirmDelete,
  isDuplicateCodeError,
  memberPermissionsFor,
  projectFormDefaults,
  projectFormSchema,
  toProjectPayload,
  type ProjectFormValues,
} from "./project-form-schema";

function values(overrides: Partial<ProjectFormValues> = {}): ProjectFormValues {
  return {
    ...projectFormDefaults(),
    projectName: "Lakeview Villa",
    projectCode: "VS-101",
    ...overrides,
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    projectCode: "VS-101",
    projectName: "Lakeview Villa",
    clientName: "Anand",
    clientPhone: "+91 98400 12345",
    clientEmail: "anand@example.com",
    location: "Chennai",
    completionPercentage: 0,
    isComplete: false,
    startDate: "2026-10-01",
    targetEndDate: "2027-03-31",
    createdAt: "2026-10-01T00:00:00Z",
    managerIds: ["m1"],
    workerIds: ["w1"],
    clientIds: [],
    budgetAccessManagerIds: ["m1"],
    ...overrides,
  };
}

const errorPaths = (result: ReturnType<ReturnType<typeof projectFormSchema>["safeParse"]>) =>
  result.success ? [] : result.error.issues.map((i) => i.path.join("."));

describe("memberPermissionsFor", () => {
  it("lets the head set every member list and the money fields", () => {
    expect(memberPermissionsFor("head", { mode: "edit", canSeeBudget: true })).toEqual({
      managers: true,
      workers: true,
      budgetAccess: true,
      money: true,
    });
  });

  it("lets a manager set only workers; money on create (they get budget access) or with budget access", () => {
    expect(memberPermissionsFor("manager", { mode: "create", canSeeBudget: false })).toEqual({
      managers: false,
      workers: true,
      budgetAccess: false,
      money: true,
    });
    expect(memberPermissionsFor("manager", { mode: "edit", canSeeBudget: false }).money).toBe(false);
    expect(memberPermissionsFor("manager", { mode: "edit", canSeeBudget: true }).money).toBe(true);
  });

  it("gives workers and clients nothing", () => {
    for (const role of ["worker", "client"] as const) {
      expect(memberPermissionsFor(role, { mode: "create", canSeeBudget: true })).toEqual({
        managers: false,
        workers: false,
        budgetAccess: false,
        money: false,
      });
    }
  });
});

describe("projectFormSchema", () => {
  const schema = projectFormSchema({ money: true });

  it("accepts a minimal valid project", () => {
    expect(schema.safeParse(values()).success).toBe(true);
  });

  it("requires a name and a code", () => {
    expect(errorPaths(schema.safeParse(values({ projectName: " ", projectCode: "" })))).toEqual([
      "projectName",
      "projectCode",
    ]);
  });

  it("rejects codes with characters that break links and searches", () => {
    expect(errorPaths(schema.safeParse(values({ projectCode: "VS 101?" })))).toEqual(["projectCode"]);
    expect(errorPaths(schema.safeParse(values({ projectCode: "-VS" })))).toEqual(["projectCode"]);
    expect(schema.safeParse(values({ projectCode: "VEL/2026/014" })).success).toBe(true);
  });

  it("keeps an unchanged legacy code valid when editing", () => {
    const edit = projectFormSchema({ money: true, originalCode: "Old code #1!" });
    expect(edit.safeParse(values({ projectCode: "Old code #1!" })).success).toBe(true);
    expect(errorPaths(edit.safeParse(values({ projectCode: "New code!" })))).toEqual(["projectCode"]);
  });

  it("validates client email and phone only when given", () => {
    expect(schema.safeParse(values({ clientEmail: "", clientPhone: "" })).success).toBe(true);
    expect(errorPaths(schema.safeParse(values({ clientEmail: "anand@", clientPhone: "12" })))).toEqual([
      "clientPhone",
      "clientEmail",
    ]);
    expect(schema.safeParse(values({ clientPhone: "+91 (984) 001-2345" })).success).toBe(true);
  });

  it("requires the target date to be on or after the start date", () => {
    expect(errorPaths(schema.safeParse(values({ startDate: "2026-10-10", targetEndDate: "2026-10-01" })))).toEqual([
      "targetEndDate",
    ]);
    expect(schema.safeParse(values({ startDate: "2026-10-10", targetEndDate: "2026-10-10" })).success).toBe(true);
  });

  it("validates money (₹, commas, 2 decimals, non-negative) when money fields are shown", () => {
    expect(schema.safeParse(values({ budget: "15,00,000", estimatedCost: "1250000.50" })).success).toBe(true);
    expect(errorPaths(schema.safeParse(values({ budget: "-5", estimatedCost: "12.345" })))).toEqual([
      "budget",
      "estimatedCost",
    ]);
  });

  it("ignores money values entirely when the role may not see money", () => {
    const noMoney = projectFormSchema({ money: false });
    expect(noMoney.safeParse(values({ budget: "not a number" })).success).toBe(true);
  });

  it("only allows budget access for selected managers", () => {
    const result = schema.safeParse(values({ managerIds: ["m1"], budgetAccessManagerIds: ["m1", "m2"] }));
    expect(errorPaths(result)).toEqual(["budgetAccessManagerIds"]);
  });
});

describe("toProjectPayload", () => {
  it("head create: every member list, budget access limited to managers, money as numbers, empties omitted", () => {
    const body = toProjectPayload(
      values({
        projectName: "  Lakeview Villa ",
        managerIds: ["m1", "m2"],
        workerIds: ["w1"],
        budgetAccessManagerIds: ["m2"],
        budget: "15,00,000",
        estimatedCost: "",
        location: " ",
      }),
      { mode: "create", permissions: memberPermissionsFor("head", { mode: "create", canSeeBudget: true }) },
    );
    expect(body).toEqual({
      projectName: "Lakeview Villa",
      projectCode: "VS-101",
      managerIds: ["m1", "m2"],
      workerIds: ["w1"],
      budgetAccessManagerIds: ["m2"],
      budget: 1500000,
    });
  });

  it("manager create: only workers and money — never managers, clients or budget access", () => {
    const body = toProjectPayload(values({ managerIds: ["m9"], workerIds: ["w1"], budget: "100" }), {
      mode: "create",
      permissions: memberPermissionsFor("manager", { mode: "create", canSeeBudget: false }),
    });
    expect(body).toMatchObject({ workerIds: ["w1"], budget: 100 });
    expect(body).not.toHaveProperty("managerIds");
    expect(body).not.toHaveProperty("budgetAccessManagerIds");
    expect(body).not.toHaveProperty("clientIds");
  });

  it("manager edit without budget access: no money keys at all", () => {
    const body = toProjectPayload(values({ budget: "999", estimatedCost: "5" }), {
      mode: "edit",
      permissions: memberPermissionsFor("manager", { mode: "edit", canSeeBudget: false }),
    });
    expect(body).not.toHaveProperty("budget");
    expect(body).not.toHaveProperty("estimatedCost");
  });

  it("edit: cleared optional fields are sent as null and cleared money as 0", () => {
    const body = toProjectPayload(values({ clientEmail: "", startDate: "", budget: "" }), {
      mode: "edit",
      permissions: memberPermissionsFor("head", { mode: "edit", canSeeBudget: true }),
    });
    expect(body).toMatchObject({ clientEmail: null, startDate: null, targetEndDate: null, budget: 0, estimatedCost: 0 });
  });
});

describe("projectFormDefaults", () => {
  it("fills the form from a project (money only when present, date keys for inputs)", () => {
    const v = projectFormDefaults(project({ budget: "1500000.00", targetEndDate: "2027-03-31T00:00:00+00:00" }));
    expect(v).toMatchObject({
      projectCode: "VS-101",
      clientPhone: "+91 98400 12345",
      budget: "1500000",
      estimatedCost: "",
      targetEndDate: "2027-03-31",
      managerIds: ["m1"],
      workerIds: ["w1"],
      budgetAccessManagerIds: ["m1"],
    });
  });
});

describe("delete confirmation", () => {
  it("needs the exact project code", () => {
    expect(canConfirmDelete("VS-101", "VS-101")).toBe(true);
    expect(canConfirmDelete(" VS-101 ", "VS-101")).toBe(true);
    expect(canConfirmDelete("vs-101", "VS-101")).toBe(false);
    expect(canConfirmDelete("", "")).toBe(false);
  });
});

describe("isDuplicateCodeError", () => {
  it("recognises the API's 409 for a taken code", () => {
    expect(isDuplicateCodeError(new ApiError(409, "project_code already exists"))).toBe(true);
    expect(isDuplicateCodeError(new ApiError(400, "bad"))).toBe(false);
    expect(isDuplicateCodeError(new Error("x"))).toBe(false);
  });
});
