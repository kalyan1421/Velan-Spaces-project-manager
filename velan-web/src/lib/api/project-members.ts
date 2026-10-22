/**
 * `GET /projects/:id/members` — the people on a project, with names, for any
 * member of it (workers and clients can't list staff via `GET /staff`).
 *
 * One entry per membership, plus a `budgetAccess` entry for each manager who
 * holds budget access. Workers and clients only receive manager and worker
 * entries, and never contact details; head and managers also get email
 * (never the internal worker sign-in address), phone, login name and suspension.
 */

import { api } from "./client";
import type { ContentPerson } from "./project-content";
import type { Role } from "./types";

export const PROJECT_MEMBER_TYPES = ["manager", "worker", "client", "budgetAccess"] as const;
export type ProjectMemberType = (typeof PROJECT_MEMBER_TYPES)[number];

export type ProjectMember = {
  userId: string;
  fullName: string;
  /** The account's role. */
  role: Role | null;
  memberType: ProjectMemberType;
  trade: string | null;
  avatarUrl: string | null;
  /** Head / manager viewers only. */
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  isSuspended?: boolean;
};

const seg = (id: string) => encodeURIComponent(id);

export const projectMembersPath = (projectId: string) => `projects/${seg(projectId)}/members`;
export const projectMembersKey = (projectId: string) => ["project", projectId, "members"] as const;

// ------------------------------------------------------------------ normalising

type Raw = Record<string, unknown>;
const asObject = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const ROLES = new Set<string>(["head", "manager", "worker", "client"]);
const TYPES = new Set<string>(PROJECT_MEMBER_TYPES);

const GENERIC_NAME: Record<ProjectMemberType, string> = {
  manager: "Project manager",
  worker: "Worker",
  client: "Client",
  budgetAccess: "Project manager",
};

/** Defensive read of the API response: drops malformed rows, keeps optional staff fields only when sent. */
export function normalizeProjectMembers(raw: unknown): ProjectMember[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectMember[] = [];
  for (const item of raw) {
    const o = asObject(item);
    const userId = str(o.userId);
    const memberType = str(o.memberType);
    if (!userId || !memberType || !TYPES.has(memberType)) continue;
    const type = memberType as ProjectMemberType;
    const role = str(o.role);
    const member: ProjectMember = {
      userId,
      fullName: str(o.fullName) ?? GENERIC_NAME[type],
      role: role && ROLES.has(role) ? (role as Role) : null,
      memberType: type,
      trade: str(o.trade),
      avatarUrl: str(o.avatarUrl),
    };
    if ("email" in o) member.email = str(o.email);
    if ("phone" in o) member.phone = str(o.phone);
    if ("username" in o) member.username = str(o.username);
    if ("isSuspended" in o) member.isSuspended = o.isSuspended === true;
    out.push(member);
  }
  return out;
}

// ------------------------------------------------------------------ helpers

/** Members of one type, in API order (sorted by name). */
export function membersOfType(members: readonly ProjectMember[], type: ProjectMemberType): ProjectMember[] {
  return members.filter((m) => m.memberType === type);
}

/** userId → display name (first entry wins; a user may hold several member types). */
export function memberNames(members: readonly ProjectMember[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const m of members) if (!names.has(m.userId)) names.set(m.userId, m.fullName);
  return names;
}

/** Minimal people for tags/labels (e.g. the updates feed), optionally limited to one member type. */
export function toContentPeople(members: readonly ProjectMember[], type?: ProjectMemberType): ContentPerson[] {
  const seen = new Set<string>();
  const out: ContentPerson[] = [];
  for (const m of members) {
    if (type && m.memberType !== type) continue;
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    out.push({ id: m.userId, name: m.fullName });
  }
  return out;
}

/** "Meera, Arun and 2 others". */
export function namesSummary(names: readonly string[], max = 3): string {
  if (names.length === 0) return "";
  if (names.length <= max) {
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

// ------------------------------------------------------------------ browser call (via the BFF)

export const projectMembersApi = {
  list: async (projectId: string, signal?: AbortSignal) =>
    normalizeProjectMembers(await api.get<unknown>(projectMembersPath(projectId), { signal })),
};
