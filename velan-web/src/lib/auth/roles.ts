import type { Role } from "@/lib/api/types";
import { ROLES } from "@/lib/api/types";
import { safeNextPath } from "./redirects";

export const STAFF_ROLES: readonly Role[] = ["head", "manager", "worker"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/** Where each role lands after login. */
export function landingFor(role: Role): string {
  return role === "client" ? "/portal" : "/app/projects";
}

function inArea(path: string, area: "/app" | "/portal"): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  return pathname === area || pathname.startsWith(`${area}/`);
}

/** The post-login destination: a safe `next` inside the role's own area, else the landing. */
export function postLoginRedirect(role: Role, next: unknown): string {
  const safe = safeNextPath(next);
  if (safe) {
    const area = role === "client" ? "/portal" : "/app";
    if (inArea(safe, area)) return safe;
  }
  return landingFor(role);
}

const ROLE_LABELS: Record<Role, string> = {
  head: "Admin",
  manager: "Manager",
  worker: "Worker",
  client: "Client",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
