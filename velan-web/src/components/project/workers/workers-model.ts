import { staffName, type StaffMember } from "@/lib/api/project-ops";

const collator = new Intl.Collator("en-IN", { sensitivity: "base", numeric: true });

/** Minimal, serialisable person for client components (what the timeline/rooms/workers views show). */
export type Person = {
  id: string;
  name: string;
  role: StaffMember["role"];
  trade: string | null;
  phone: string | null;
  suspended: boolean;
};

/** Staff rows → people sorted by name (drops emails and other fields the UI doesn't need). */
export function toPeople(staff: StaffMember[]): Person[] {
  return staff
    .map((s) => ({
      id: s.id,
      name: staffName(s),
      role: s.role,
      trade: s.trade?.trim() || null,
      phone: s.phone?.trim() || null,
      suspended: Boolean(s.isSuspended),
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** Active workers not yet on the project (suspended accounts can't be assigned). */
export function availableWorkers(people: Person[], assignedIds: readonly string[]): Person[] {
  const assigned = new Set(assignedIds);
  return people.filter((p) => p.role === "worker" && !p.suspended && !assigned.has(p.id));
}

export function withWorkers(current: readonly string[], add: readonly string[]): string[] {
  return [...new Set([...current, ...add])];
}

export function withoutWorker(current: readonly string[], id: string): string[] {
  return current.filter((w) => w !== id);
}

/** Case-insensitive match on name, trade or phone. */
export function filterPeople(people: Person[], query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter((p) => [p.name, p.trade, p.phone].some((f) => (f ?? "").toLowerCase().includes(q)));
}
