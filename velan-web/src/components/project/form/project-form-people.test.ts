import { describe, expect, it } from "vitest";
import { budgetAccessOptions, pickerOptions, pruneBudgetAccess, type FormStaff } from "./project-form-people";

const staff: FormStaff[] = [
  { id: "m1", name: "Meera", role: "manager", trade: null, phone: "+91 90000 00001", suspended: false },
  { id: "m2", name: "Arun", role: "manager", trade: "Carpentry", phone: null, suspended: true },
  { id: "w1", name: "Ravi", role: "worker", trade: "Electrician", phone: "98400 11111", suspended: false },
  { id: "w2", name: "Selva", role: "worker", trade: null, phone: null, suspended: false },
];

describe("pickerOptions", () => {
  it("lists staff of one role with a short detail line", () => {
    expect(pickerOptions(staff, "worker", [], new Map())).toEqual([
      { id: "w1", name: "Ravi", detail: "Electrician · 98400 11111", suspended: false },
      { id: "w2", name: "Selva", detail: null, suspended: false },
    ]);
    // A manager's trade isn't shown; suspension is carried so the picker can lock the row.
    expect(pickerOptions(staff, "manager", [], new Map())).toEqual([
      { id: "m1", name: "Meera", detail: "+91 90000 00001", suspended: false },
      { id: "m2", name: "Arun", detail: null, suspended: true },
    ]);
  });

  it("keeps selected ids the staff list doesn't know, named from the project's members", () => {
    const options = pickerOptions(staff, "manager", ["m1", "m9", "m8", "m9"], new Map([["m9", "Kavya"]]));
    expect(options.slice(2)).toEqual([
      { id: "m9", name: "Kavya", detail: "Not in your staff list", suspended: false },
      { id: "m8", name: "Unknown account", detail: "Not in your staff list", suspended: false },
    ]);
  });
});

describe("budget access", () => {
  it("offers only the selected managers", () => {
    const managers = pickerOptions(staff, "manager", [], new Map());
    expect(budgetAccessOptions(managers, ["m2"]).map((p) => p.id)).toEqual(["m2"]);
    expect(budgetAccessOptions(managers, [])).toEqual([]);
  });

  it("drops budget access when its manager is removed", () => {
    expect(pruneBudgetAccess(["m1", "m2"], ["m2", "m3"])).toEqual(["m2"]);
  });
});
