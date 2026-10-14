import type { User } from "@/lib/api/types";
import { roleLabel } from "./roles";

/** Best human name for a user: display name, then username, then email local part. */
export function displayNameOf(user: Pick<User, "displayName" | "username" | "email">): string {
  const name = user.displayName?.trim();
  if (name) return name;
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0];
  return "Account";
}

/** The minimal, serialisable user the client-side shell needs. */
export function toShellUser(user: User) {
  return {
    name: displayNameOf(user),
    handle: user.email ?? user.username ?? null,
    roleLabel: roleLabel(user.role),
  };
}
