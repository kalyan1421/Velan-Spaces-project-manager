/**
 * Pure rules for the website admin: slugs (mirroring the API's
 * `website.util.ts` so previews match what the server generates), status
 * counts, reordering and upload checks. No React, no I/O.
 */

import {
  MAX_PORTFOLIO_IMAGE_BYTES,
  MAX_PORTFOLIO_IMAGES,
  MAX_SLUG_LENGTH,
  PORTFOLIO_IMAGE_TYPES,
  SLUG_RE,
} from "@/lib/api/portfolio-admin";
import type { PortfolioCategory, PortfolioItem, PortfolioStatus } from "@/lib/api/types";

// ---------------------------------------------------------------- labels

export const CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  residential: "Residential",
  commercial: "Commercial",
  office: "Office",
  kitchen: "Kitchen",
  other: "Other",
};

export const STATUS_LABELS: Record<PortfolioStatus, string> = {
  published: "Published",
  draft: "Draft",
  hidden: "Hidden",
};

export const STATUS_DESCRIPTIONS: Record<PortfolioStatus, string> = {
  draft: "Not on the website yet.",
  published: "Shown on the website.",
  hidden: "Taken off the website, kept here.",
};

// ---------------------------------------------------------------- slugs

const SLUG_FALLBACK = "project";

function stripDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Same algorithm as the API: accents folded, `&` → `and`, other runs → one dash. */
export function slugify(input: string, maxLength = MAX_SLUG_LENGTH): string {
  const s = stripDiacritics(String(input ?? ""))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength).replace(/-+$/g, "");
}

/** `base`, else `base-2`, `base-3`, … trimmed to fit (API's `uniqueSlug`). */
export function uniqueSlug(base: string, taken: Iterable<string>, maxLength = MAX_SLUG_LENGTH): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n <= used.size + 2; n++) {
    const suffix = `-${n}`;
    const head = base.slice(0, maxLength - suffix.length).replace(/-+$/g, "");
    const candidate = `${head}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base.slice(0, maxLength - 9)}-${Date.now().toString(36)}`;
}

/** The slug the API will generate for a new item with this title. */
export function previewSlug(title: string, takenSlugs: Iterable<string>): string {
  return uniqueSlug(slugify(title) || SLUG_FALLBACK, takenSlugs);
}

/** Error message for an explicit slug, or null when valid. */
export function validateSlug(slug: string): string | null {
  if (slug.length === 0) return "Enter a web address for this project.";
  if (slug.length > MAX_SLUG_LENGTH) return `Use at most ${MAX_SLUG_LENGTH} characters.`;
  if (!SLUG_RE.test(slug)) return "Use lowercase letters and numbers separated by single dashes (e.g. modern-villa-adyar).";
  return null;
}

export function publicPath(slug: string): string {
  return `/portfolio/${slug}`;
}

export function canViewOnSite(item: Pick<PortfolioItem, "status">): boolean {
  return item.status === "published";
}

/** The image the public site shows on cards: cover, else the first gallery photo. */
export function coverOf(item: Pick<PortfolioItem, "coverImageUrl" | "imageUrls">): string | null {
  return item.coverImageUrl ?? item.imageUrls[0] ?? null;
}

// ---------------------------------------------------------------- status filter

export type StatusFilter = "all" | PortfolioStatus;
export const STATUS_FILTERS: readonly StatusFilter[] = ["all", "published", "draft", "hidden"];
export type StatusCounts = Record<StatusFilter, number>;

export function countByStatus(items: readonly Pick<PortfolioItem, "status">[]): StatusCounts {
  const counts: StatusCounts = { all: items.length, published: 0, draft: 0, hidden: 0 };
  for (const i of items) counts[i.status] += 1;
  return counts;
}

export function filterByStatus<T extends Pick<PortfolioItem, "status">>(items: readonly T[], filter: StatusFilter): T[] {
  return filter === "all" ? [...items] : items.filter((i) => i.status === filter);
}

// ---------------------------------------------------------------- reordering

/**
 * Moves `id` one step up/down. With `visibleIds` (a filtered view), it moves
 * past the neighbouring *visible* item so the change is visible in that view.
 * Returns the full id list (what `PUT /portfolio/order` expects).
 */
export function moveId(
  ids: readonly string[],
  id: string,
  direction: "up" | "down",
  visibleIds: readonly string[] = ids,
): string[] {
  const v = visibleIds.indexOf(id);
  if (v < 0 || ids.indexOf(id) < 0) return [...ids];
  const neighbour = visibleIds[direction === "up" ? v - 1 : v + 1];
  if (neighbour === undefined) return [...ids];

  const rest = ids.filter((x) => x !== id);
  const at = rest.indexOf(neighbour);
  if (at < 0) return [...ids];
  rest.splice(direction === "up" ? at : at + 1, 0, id);
  return rest;
}

/** Drag and drop: `fromId` takes `toId`'s place (array-move semantics). */
export function moveToTarget(ids: readonly string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

/** Items in `ids` order with `sortOrder` = index (unknown items keep their place at the end). */
export function applyOrder<T extends Pick<PortfolioItem, "id" | "sortOrder">>(items: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered: T[] = [];
  for (const id of ids) {
    const found = byId.get(id);
    if (found) {
      ordered.push(found);
      byId.delete(id);
    }
  }
  ordered.push(...byId.values());
  return ordered.map((i, index) => (i.sortOrder === index ? i : { ...i, sortOrder: index }));
}

/** Swap the element at `index` with its neighbour `delta` (−1/+1) away. */
export function moveInArray<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ---------------------------------------------------------------- uploads

export type FileLike = { name: string; type: string; size: number; lastModified: number };

const EXTENSION_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(PORTFOLIO_IMAGE_TYPES).flatMap(([type, exts]) => exts.map((ext) => [ext, type])),
);

/** Types the browser can re-encode smaller (AVIF can't be reliably decoded/encoded everywhere). */
const RESIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const ACCEPT_IMAGES = Object.keys(PORTFOLIO_IMAGE_TYPES).join(",");
export const UNSUPPORTED_TYPE = "Only JPEG, PNG, WebP or AVIF photos can be uploaded.";

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** The upload content type for a file, or null when the API won't accept it. */
export function resolveImageContentType(file: Pick<FileLike, "name" | "type">): string | null {
  const type = file.type.toLowerCase();
  if (type) return PORTFOLIO_IMAGE_TYPES[type] ? type : null;
  return EXTENSION_TYPES[extension(file.name)] ?? null;
}

/** Identifies "the same file picked twice". */
export function fileKey(file: FileLike): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export type PlannedUpload<F extends FileLike> = { file: F; key: string; contentType: string; resize: boolean };
export type RejectedUpload = { name: string; reason: string };

/**
 * Splits a selection into uploads and rejections: type, size (oversize
 * JPEG/PNG/WebP are flagged for resizing instead), duplicates, and the
 * 40-photo gallery limit (or `max` for single-photo slots like the cover).
 */
export function planImageUploads<F extends FileLike>(
  files: readonly F[],
  options: { existingCount: number; seenKeys: ReadonlySet<string>; max?: number },
): { accepted: PlannedUpload<F>[]; rejected: RejectedUpload[] } {
  const max = options.max ?? MAX_PORTFOLIO_IMAGES;
  let room = Math.max(0, max - options.existingCount);
  const seen = new Set(options.seenKeys);
  const accepted: PlannedUpload<F>[] = [];
  const rejected: RejectedUpload[] = [];

  for (const file of files) {
    const key = fileKey(file);
    const contentType = resolveImageContentType(file);
    if (!contentType) {
      rejected.push({ name: file.name, reason: UNSUPPORTED_TYPE });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ name: file.name, reason: "This file is empty." });
      continue;
    }
    const oversize = file.size > MAX_PORTFOLIO_IMAGE_BYTES;
    if (oversize && !RESIZABLE_TYPES.has(contentType)) {
      rejected.push({ name: file.name, reason: "Photos must be 10 MB or smaller." });
      continue;
    }
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: "Already added." });
      continue;
    }
    if (room === 0) {
      rejected.push({
        name: file.name,
        reason: max === MAX_PORTFOLIO_IMAGES ? `A project can have at most ${MAX_PORTFOLIO_IMAGES} photos.` : "Only one photo can be used here.",
      });
      continue;
    }
    seen.add(key);
    room -= 1;
    accepted.push({ file, key, contentType, resize: oversize });
  }

  return { accepted, rejected };
}

export type PendingUpload = {
  key: string;
  name: string;
  status: "queued" | "uploading" | "done" | "error";
  /** 0–1. */
  progress: number;
  url?: string;
  error?: string;
  previewUrl?: string;
};

/**
 * Moves finished uploads into the gallery in the order they were picked:
 * a finished upload waits while an earlier one is still in flight; failed
 * ones stay listed (with their error) but don't block the rest.
 */
export function commitFinishedUploads(pending: readonly PendingUpload[]): {
  committed: string[];
  remaining: PendingUpload[];
} {
  const committed: string[] = [];
  const remaining: PendingUpload[] = [];
  let blocked = false;
  for (const p of pending) {
    if (p.status === "queued" || p.status === "uploading") blocked = true;
    if (p.status === "done" && p.url && !blocked) committed.push(p.url);
    else remaining.push(p);
  }
  return { committed, remaining };
}
