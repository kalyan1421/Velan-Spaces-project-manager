/** Pure helpers for the updates feed and composer. */

import type { ContentPerson, CreateUpdateBody } from "@/lib/api/project-content";
import type { MediaKind } from "../media/media";

/** Same list as the mobile composer (create_update_form.dart). */
export const UPDATE_CATEGORIES = [
  "General",
  "Civil",
  "Electrical",
  "Carpentry",
  "Painting",
  "Glass Work",
  "Deco Work",
  "Tiles",
  "Granite",
  "Plumbing",
  "Welding",
  "Fall Ceiling",
  "AC Works",
  "Solar Works",
  "Lighting Works",
] as const;

export const MAX_UPDATE_TEXT = 5000;
/** API: `CreateCommentDto.text` MaxLength(2000). */
export const MAX_COMMENT_TEXT = 2000;

export type ComposerValues = {
  text: string;
  category: string | null;
  roomId: string | null;
  workerIds: string[];
  clientVisible: boolean;
};

export function updateTypeFor(kinds: readonly MediaKind[]): "message" | "photo" | "video" {
  if (kinds.includes("video")) return "video";
  if (kinds.length > 0) return "photo";
  return "message";
}

export function canSubmitUpdate(text: string, attachmentCount: number): boolean {
  return text.trim().length > 0 || attachmentCount > 0;
}

/** The `POST /projects/:id/updates` body; only call once every upload has a ref. */
export function buildCreateUpdateBody(
  values: ComposerValues,
  refs: string[],
  kinds: readonly MediaKind[],
  { canSetVisibility = true }: { canSetVisibility?: boolean } = {},
): CreateUpdateBody {
  const body: CreateUpdateBody = { type: updateTypeFor(kinds), content: values.text.trim() };
  if (values.category) body.category = values.category;
  if (values.roomId) body.roomId = values.roomId;
  const workers = [...new Set(values.workerIds)];
  if (workers.length > 0) body.associatedWorkerIds = workers;
  if (refs.length > 0) body.mediaUrls = refs;
  if (canSetVisibility) body.isClientViewable = values.clientVisible;
  return body;
}

/** Tagged worker ids → names we can show (+ how many we couldn't resolve). */
export function taggedPeople(
  ids: readonly string[],
  directory: ReadonlyMap<string, ContentPerson>,
): { people: ContentPerson[]; unknown: number } {
  const people: ContentPerson[] = [];
  let unknown = 0;
  for (const id of ids) {
    const person = directory.get(id);
    if (person) people.push(person);
    else unknown += 1;
  }
  return { people, unknown };
}
