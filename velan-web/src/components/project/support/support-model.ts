/**
 * Pure rules for project support: chat polling (R-F1), message merging,
 * attachments (images/PDF), and complaint status transitions (R-D14, R-E2).
 */

import { z } from "zod";
import { isApiError } from "@/lib/api/errors";
import {
  ATTACHMENTS_MAX,
  COMPLAINT_DESCRIPTION_MAX,
  COMPLAINT_STATUSES,
  COMPLAINT_TITLE_MAX,
  RESOLUTION_NOTE_MAX,
  type ChatMessage,
  type ComplaintStatus,
  type MessageType,
} from "@/lib/api/project-ops";
import type { Role } from "@/lib/api/types";
import { IMAGE_EXTENSIONS, extensionOf } from "@/lib/uploads";

// ------------------------------------------------------------------ chat polling

/** Chat freshness without websockets: poll every 8 s while visible (spec R-F1: 5–10 s). */
export const CHAT_POLL_MS = 8_000;
/** Complaints change rarely: 60 s. */
export const COMPLAINTS_POLL_MS = 60_000;

const STOP_STATUSES = new Set([401, 403, 404]);

/**
 * `refetchInterval` for the chat query. Hidden tab → paused; auth/access errors →
 * stop (retrying can't fix them); rate limited → back off; anything else keeps polling.
 */
export function chatRefetchInterval({ visible, error }: { visible: boolean; error?: unknown }): number | false {
  if (!visible) return false;
  if (isApiError(error)) {
    if (STOP_STATUSES.has(error.status)) return false;
    if (error.status === 429) return CHAT_POLL_MS * 3;
  }
  return CHAT_POLL_MS;
}

/** Union of message lists by id (first occurrence wins), oldest first. */
export function mergeMessages(...lists: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const list of lists) for (const m of list) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => {
    const t = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return t !== 0 && Number.isFinite(t) ? t : a.id.localeCompare(b.id);
  });
}

const SENDER_ROLE_LABEL: Record<string, string> = {
  head: "Admin",
  manager: "Manager",
  worker: "Worker",
  client: "Client",
};

export function senderRoleLabel(role: string | null | undefined): string {
  return role ? (SENDER_ROLE_LABEL[role.toLowerCase()] ?? "") : "";
}

// ------------------------------------------------------------------ attachments

export const ATTACHMENT_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "pdf"] as const;
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",") + ",image/*,application/pdf";
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
/** Upload area under `projects/<id>/` (same folders the mobile app uses). */
export const CHAT_UPLOAD_AREA = "support/chat";
export const COMPLAINT_UPLOAD_AREA = "support/complaints";

export function checkAttachment(file: { name: string; size: number }): string | null {
  const ext = extensionOf(file.name);
  if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    return `${file.name}: only images or PDF files can be attached.`;
  }
  if (file.size > ATTACHMENT_MAX_BYTES) return `${file.name} is too large (max 25 MB).`;
  return null;
}

/** text when nothing is attached, image when every file is a photo, file otherwise. */
export function messageTypeFor(fileNames: string[]): MessageType {
  if (fileNames.length === 0) return "text";
  return fileNames.every((n) => IMAGE_EXTENSIONS.has(extensionOf(n))) ? "image" : "file";
}

/** Last path segment of a (signed) URL, decoded, without the upload helper's random prefix. */
export function attachmentName(url: string): string {
  const path = url.split(/[?#]/, 1)[0];
  let last = path.split("/").pop() ?? "";
  try {
    last = decodeURIComponent(last);
  } catch {
    // keep the raw segment
  }
  last = last.split("/").pop() ?? last; // Firebase-style encoded paths
  return last.replace(/^[a-z0-9]{8}-(?=.)/, "") || "Attachment";
}

export function attachmentKind(url: string): "image" | "pdf" | "file" {
  const ext = extensionOf(attachmentName(url));
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return ext === "pdf" ? "pdf" : "file";
}

// ------------------------------------------------------------------ complaints

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: "Open",
  inProgress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export function normalizeComplaintStatus(value: string | null | undefined): ComplaintStatus {
  return value && (COMPLAINT_STATUSES as readonly string[]).includes(value) ? (value as ComplaintStatus) : "open";
}

const TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  open: ["inProgress", "resolved", "closed"],
  inProgress: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

export function nextComplaintStatuses(current: ComplaintStatus): ComplaintStatus[] {
  return TRANSITIONS[current];
}

export function complaintNoteRequired(next: ComplaintStatus): boolean {
  return next === "resolved" || next === "closed";
}

/** null when the update may be sent; otherwise a user-facing reason. */
export function validateComplaintUpdate({
  current,
  next,
  note,
  previousNote = "",
}: {
  current: ComplaintStatus;
  next: ComplaintStatus;
  note: string;
  previousNote?: string | null;
}): string | null {
  const trimmed = note.trim();
  if (trimmed.length > RESOLUTION_NOTE_MAX) return `Keep the note under ${RESOLUTION_NOTE_MAX} characters.`;
  if (next === current) {
    return trimmed === (previousNote ?? "").trim() ? "Nothing to update — change the status or the note." : null;
  }
  if (!TRANSITIONS[current].includes(next)) {
    return `A complaint can't move from ${COMPLAINT_STATUS_LABEL[current]} to ${COMPLAINT_STATUS_LABEL[next]}.`;
  }
  if (complaintNoteRequired(next) && !trimmed) {
    return "Add a resolution note so the client knows what was done.";
  }
  return null;
}

export function complaintCounts(list: { status: string | null }[]): Record<ComplaintStatus, number> {
  const counts: Record<ComplaintStatus, number> = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
  for (const c of list) counts[normalizeComplaintStatus(c.status)] += 1;
  return counts;
}

/** PATCH /complaints/:id is head/manager only on the API. */
export function canManageComplaints(role: Role): boolean {
  return role === "head" || role === "manager";
}

/** Clients raise complaints; staff can log one on a client's behalf. */
export function canRaiseComplaint(role: Role): boolean {
  return role === "client" || role === "head" || role === "manager";
}

/**
 * Adds picked / pasted / dropped files to the pending list: rejects wrong types
 * and oversize files, and stops at the API's limit of 10 attachments.
 */
export function acceptAttachments<F extends { name: string; size: number }>(
  current: F[],
  incoming: F[],
  max = ATTACHMENTS_MAX,
): { files: F[]; errors: string[] } {
  const files = [...current];
  const errors: string[] = [];
  for (const file of incoming) {
    const problem = checkAttachment(file);
    if (problem) errors.push(problem);
    else if (files.length >= max) {
      errors.push(`You can attach up to ${max} files.`);
      break;
    } else files.push(file);
  }
  return { files, errors };
}

export const complaintFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Add a short title, e.g. “Water leak in kitchen”.")
    .max(COMPLAINT_TITLE_MAX, `Use at most ${COMPLAINT_TITLE_MAX} characters.`),
  description: z.string().trim().max(COMPLAINT_DESCRIPTION_MAX, `Use at most ${COMPLAINT_DESCRIPTION_MAX} characters.`),
});

export type ComplaintFormValues = z.infer<typeof complaintFormSchema>;

/** Active complaints first (open, in progress), newest first within each group. */
export function sortComplaints<C extends { status: string | null; createdAt: string }>(list: C[]): C[] {
  const rank = (c: C) => (["open", "inProgress"].includes(normalizeComplaintStatus(c.status)) ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
