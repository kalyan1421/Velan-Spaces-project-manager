/**
 * Options for the project form's member pickers. Staff come from `GET /staff`
 * (head: managers + workers; manager: workers only); names of people already
 * on the project come from `GET /projects/:id/members`, so an assigned account
 * that the staff list doesn't include (e.g. a manager, as seen by a manager)
 * still shows a name instead of disappearing from the list.
 */

import type { PickerPerson } from "./member-picker";

/** The staff fields the form needs (a subset of the workers tab's `Person`). */
export type FormStaff = {
  id: string;
  name: string;
  role: "manager" | "worker";
  trade: string | null;
  phone: string | null;
  suspended: boolean;
};

const detailFor = (p: FormStaff): string | null => {
  const parts = [p.role === "worker" ? p.trade : null, p.phone].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join(" · ") : null;
};

/**
 * Picker rows for one role: every staff member of that role, plus any selected
 * id the staff list doesn't know (named from `names`, else "Unknown account"),
 * so it can still be seen and unticked.
 */
export function pickerOptions(
  staff: readonly FormStaff[],
  role: FormStaff["role"],
  selected: readonly string[],
  names: ReadonlyMap<string, string>,
): PickerPerson[] {
  const options: PickerPerson[] = staff
    .filter((p) => p.role === role)
    .map((p) => ({ id: p.id, name: p.name, detail: detailFor(p), suspended: p.suspended }));
  const known = new Set(options.map((o) => o.id));
  for (const id of selected) {
    if (known.has(id)) continue;
    known.add(id);
    options.push({ id, name: names.get(id) ?? "Unknown account", detail: "Not in your staff list", suspended: false });
  }
  return options;
}

/** Budget access can only go to managers selected above; keep the picker in step with them. */
export function budgetAccessOptions(managerOptions: readonly PickerPerson[], managerIds: readonly string[]): PickerPerson[] {
  const selected = new Set(managerIds);
  return managerOptions.filter((p) => selected.has(p.id));
}

/** Dropping a manager also drops their budget access. */
export function pruneBudgetAccess(budgetAccessIds: readonly string[], managerIds: readonly string[]): string[] {
  const managers = new Set(managerIds);
  return budgetAccessIds.filter((id) => managers.has(id));
}
