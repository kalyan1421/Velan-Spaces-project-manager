/**
 * Notifications: payload contract, query keys, browser calls, deep-link routing
 * and the pure list transforms used for optimistic updates.
 *
 * API (all owner-only, camelCase):
 *   GET    notifications                 latest 100, newest first
 *   GET    notifications/unread-count    { unread }
 *   PATCH  notifications/:id/read        { ok }
 *   POST   notifications/read-all        { ok, updated }
 *   DELETE notifications/:id             { deleted: true }   (404 if not yours)
 *   DELETE notifications                 { deleted: n }      (clears READ ones only)
 */

import { api } from "./client";
import type { Notification, UnreadCount } from "./types";

export const NOTIFICATION_TYPES = [
  "update",
  "design",
  "design_approval",
  "chat",
  "complaint",
  "task",
  "lead",
  "invite",
  "system",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** A row as `GET /notifications` returns it. Legacy rows can carry other `type` strings. */
export type AppNotification = Notification & {
  leadId?: string | null;
  entityId?: string | null;
};

/** Staff use the `/app` shell (heads, managers, workers); clients the `/portal`. */
export type NotificationAudience = "staff" | "client";

export const notificationKeys = {
  /** Prefix: invalidating it refreshes the list and the unread badge. */
  all: ["notifications"] as const,
  list: ["notifications", "list"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

const seg = (id: string) => encodeURIComponent(id);

export const notificationPaths = {
  list: "notifications",
  unreadCount: "notifications/unread-count",
  read: (id: string) => `notifications/${seg(id)}/read`,
  readAll: "notifications/read-all",
  one: (id: string) => `notifications/${seg(id)}`,
  clearRead: "notifications",
};

export const notificationsApi = {
  list: (signal?: AbortSignal) => api.get<AppNotification[]>(notificationPaths.list, { signal }),
  unreadCount: (signal?: AbortSignal) => api.get<UnreadCount>(notificationPaths.unreadCount, { signal }),
  markRead: (id: string) => api.patch<{ ok: boolean }>(notificationPaths.read(id)),
  markAllRead: () => api.post<{ ok: boolean; updated: number }>(notificationPaths.readAll),
  remove: (id: string) => api.delete<{ deleted: boolean }>(notificationPaths.one(id)),
  clearRead: () => api.delete<{ deleted: number }>(notificationPaths.clearRead),
};

// ------------------------------------------------------------------ types + routing

/** Legacy (Firestore-era) types mapped onto the contract; unknown -> null. */
const LEGACY_TYPES: Record<string, NotificationType> = {
  assignment: "task",
  approval: "design_approval",
  message: "chat",
};

export function normalizeNotificationType(type: string | null | undefined): NotificationType | null {
  if (!type) return null;
  if ((NOTIFICATION_TYPES as readonly string[]).includes(type)) return type as NotificationType;
  return LEGACY_TYPES[type] ?? null;
}

/** Project tab a notification type opens (same names in `/app` and `/portal`). */
const PROJECT_TAB: Partial<Record<NotificationType, "updates" | "designs" | "support" | "timeline">> = {
  update: "updates",
  design: "designs",
  design_approval: "designs",
  chat: "support",
  complaint: "support",
  task: "timeline",
};

/**
 * Where clicking a notification goes, or null when it has nowhere to go.
 * Staff: lead -> /app/sales/<leadId>, project items -> /app/projects/<id>/<tab>.
 * Client: /portal/projects/<id>/<tab>, chat/complaints -> the home chat box (#chat); never leads.
 */
export function notificationHref(
  n: Pick<AppNotification, "type" | "projectId" | "leadId">,
  audience: NotificationAudience,
): string | null {
  const type = normalizeNotificationType(n.type);

  if (type === "lead") {
    if (audience !== "staff") return null;
    return n.leadId ? `/app/sales/${seg(n.leadId)}` : "/app/sales";
  }
  if (!n.projectId) return null;

  const base = `${audience === "staff" ? "/app/projects" : "/portal/projects"}/${seg(n.projectId)}`;
  const tab = type ? PROJECT_TAB[type] : undefined;
  // The client portal has no support page: chat lives in a box on the project home.
  if (tab === "support" && audience !== "staff") return `${base}#chat`;
  if (tab) return `${base}/${tab}`;
  // Legacy settlement notifications: staff have a settlements tab, clients don't.
  if (n.type === "settlement" && audience === "staff") return `${base}/settlements`;
  return base;
}

// ------------------------------------------------------------------ optimistic transforms

export const countUnread = (list: readonly AppNotification[]) => list.filter((n) => !n.isRead).length;

export function withRead<T extends AppNotification>(list: readonly T[], ids: readonly string[]): T[] {
  const set = new Set(ids);
  return list.map((n) => (set.has(n.id) && !n.isRead ? { ...n, isRead: true } : n));
}

export function withAllRead<T extends AppNotification>(list: readonly T[]): T[] {
  return list.map((n) => (n.isRead ? n : { ...n, isRead: true }));
}

export function without<T extends AppNotification>(list: readonly T[], id: string): T[] {
  return list.filter((n) => n.id !== id);
}

export function withoutRead<T extends AppNotification>(list: readonly T[]): T[] {
  return list.filter((n) => !n.isRead);
}

/** New unread count after an optimistic change, from the list when we have it. */
export function nextUnread(
  previous: UnreadCount | undefined,
  before: readonly AppNotification[] | undefined,
  after: readonly AppNotification[] | undefined,
): UnreadCount | undefined {
  if (!previous) return undefined;
  if (!before || !after) return previous;
  const delta = countUnread(before) - countUnread(after);
  return { unread: Math.max(0, previous.unread - delta) };
}
