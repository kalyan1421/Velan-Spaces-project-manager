/**
 * Notification payload contract shared by the API, the web app and the
 * Flutter app.
 *
 * Stored row (`notifications`, camelCase over the API):
 *   { id, recipientId, title, body, type, projectId, projectName, leadId,
 *     entityId, senderId, senderName, isRead, createdAt }
 *
 * `type` is one of NOTIFICATION_TYPES for everything the server creates.
 * Legacy rows migrated from Firestore can hold other strings (settlement,
 * status_change, assignment, worker), so readers must tolerate unknown types.
 *
 * Push (FCM) `data` carries the same routing keys as strings:
 *   { type, projectId?, leadId?, entityId? }
 */
export const NOTIFICATION_TYPES = [
  'update',
  'design',
  'design_approval',
  'chat',
  'complaint',
  'task',
  'lead',
  'invite',
  'system',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export interface NotifyPayload {
  title: string;
  body: string;
  /** One of NOTIFICATION_TYPES; free string kept for older callers. */
  type?: NotificationType | (string & {});
  projectId?: string;
  projectName?: string;
  /** Sales lead the notification links to (`lead` notifications). */
  leadId?: string;
  /** Row that triggered it: update, design, chat message, complaint, task… */
  entityId?: string;
  /** Who caused it (shown as "from"); never notified about their own action. */
  senderId?: string;
  senderName?: string;
}

/** Which members of a project receive a notification. Heads see every project. */
export interface ProjectAudience {
  clients?: boolean;
  managers?: boolean;
  workers?: boolean;
  heads?: boolean;
}

export interface NotifyOptions {
  /** Never notify these users (typically the actor). */
  excludeUserIds?: (string | null | undefined)[];
}
