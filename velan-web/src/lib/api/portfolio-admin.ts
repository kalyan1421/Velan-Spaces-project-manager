/**
 * Website portfolio admin (head only) — browser-side API for `/portfolio/*`
 * (WEB_APP_PLAN §4 "Website"), the upload pipeline, and the pure guard used by
 * the `POST /api/revalidate/portfolio` route handler.
 *
 * Everything here is free of server-only imports so the guard can be unit
 * tested and the API calls can run in Client Components (through the BFF).
 */

import { api, fetchJson } from "./client";
import { isSameOriginRequest } from "./csrf";
import type { PortfolioCategory, PortfolioItem, PortfolioStatus, Role } from "./types";

// ---------------------------------------------------------------- limits (mirror the API's website.util)

export const PORTFOLIO_CATEGORIES = [
  "residential",
  "commercial",
  "office",
  "kitchen",
  "other",
] as const satisfies readonly PortfolioCategory[];
export const PORTFOLIO_STATUSES = ["draft", "published", "hidden"] as const satisfies readonly PortfolioStatus[];

export const MAX_PORTFOLIO_IMAGES = 40;
export const MAX_PORTFOLIO_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_SLUG_LENGTH = 80;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const TITLE_MIN = 2;
export const TITLE_MAX = 120;
export const LOCATION_MAX = 120;
export const DESCRIPTION_MAX = 5000;
export const YEAR_MIN = 1990;
export const YEAR_MAX = 2100;

/** Upload MIME types the API signs → accepted file extensions. */
export const PORTFOLIO_IMAGE_TYPES: Readonly<Record<string, readonly string[]>> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
};

/** TanStack Query key for the admin list (all statuses). */
export const PORTFOLIO_ADMIN_QUERY_KEY = ["portfolio", "admin"] as const;

// ---------------------------------------------------------------- request / response shapes

export type PortfolioCreateBody = {
  title: string;
  slug?: string;
  description?: string;
  category: PortfolioCategory;
  location?: string;
  completionYear?: number;
  coverImageUrl?: string;
  imageUrls: string[];
  status: PortfolioStatus;
  projectId?: string;
};

/** PATCH body: only changed keys; `null` clears a nullable column. */
export type PortfolioUpdateBody = {
  title?: string;
  slug?: string;
  description?: string | null;
  category?: PortfolioCategory;
  location?: string | null;
  completionYear?: number | null;
  coverImageUrl?: string | null;
  imageUrls?: string[];
  status?: PortfolioStatus;
  projectId?: string | null;
};

export type PortfolioUploadSign = { path: string; signedUrl: string; token: string; publicUrl: string };

const item = (id: string) => `portfolio/${encodeURIComponent(id)}`;

export const portfolioAdminApi = {
  /** Every item, all statuses, in display order. */
  list: (signal?: AbortSignal) => api.get<PortfolioItem[]>("portfolio", { signal }),
  /** 201; 409 when an explicit slug is taken. */
  create: (body: PortfolioCreateBody) => api.post<PortfolioItem>("portfolio", body),
  update: (id: string, body: PortfolioUpdateBody) => api.patch<PortfolioItem>(item(id), body),
  remove: (id: string) => api.delete<{ ok: true }>(item(id)),
  /** sortOrder = index of each id; returns the full list. */
  reorder: (ids: string[]) => api.put<PortfolioItem[]>("portfolio/order", { ids }),
  signUpload: (body: { fileName: string; contentType: string; size: number }, signal?: AbortSignal) =>
    api.post<PortfolioUploadSign>("portfolio/uploads/sign", body, { signal }),
};

// ---------------------------------------------------------------- uploads

export class PortfolioUploadError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PortfolioUploadError";
  }
}

export type PutFile = (
  url: string,
  file: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
) => Promise<void>;

/** PUT the bytes straight to Storage (never through our servers), reporting progress. */
export const putFileWithProgress: PutFile = (url, file, contentType, onProgress, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PortfolioUploadError("Upload cancelled."));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(0.99, e.loaded / e.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new PortfolioUploadError(`Upload failed (${xhr.status}). Please try again.`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new PortfolioUploadError("Network error while uploading. Please try again."));
    xhr.onabort = () => reject(new PortfolioUploadError("Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });

/**
 * Sign (`POST /portfolio/uploads/sign`), then PUT the file to the signed URL.
 * Resolves to the bucket's public URL, which is what the item stores.
 */
export async function uploadPortfolioImage(
  file: Blob & { name: string },
  contentType: string,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal; put?: PutFile } = {},
): Promise<string> {
  const signed = await portfolioAdminApi.signUpload(
    { fileName: file.name, contentType, size: file.size },
    options.signal,
  );
  await (options.put ?? putFileWithProgress)(signed.signedUrl, file, contentType, options.onProgress, options.signal);
  return signed.publicUrl;
}

// ---------------------------------------------------------------- public site revalidation

export const REVALIDATE_PORTFOLIO_PATH = "/api/revalidate/portfolio";

/**
 * Asks our route handler to drop the public site's cached portfolio so changes
 * show immediately (otherwise within ~5 minutes). Never throws.
 */
export async function revalidatePublicPortfolio(): Promise<boolean> {
  try {
    await fetchJson<unknown>(REVALIDATE_PORTFOLIO_PATH, { method: "POST" });
    return true;
  } catch (error) {
    console.warn("Public portfolio revalidation failed", error);
    return false;
  }
}

/** A refusal for the route handler to send (`null` = allowed). */
export type GuardResult = { status: 401 | 403; message: string } | null;

/** CSRF: the request must come from our own origin (Origin, else Referer). */
export function checkRevalidateOrigin(
  headers: { origin?: string | null; referer?: string | null },
  appUrl: string,
): GuardResult {
  return isSameOriginRequest(headers, appUrl) ? null : { status: 403, message: "Cross-site request blocked." };
}

/** Only an active head may revalidate the public portfolio. */
export function checkRevalidateUser(user: { role: Role; isSuspended?: boolean } | null): GuardResult {
  if (!user) return { status: 401, message: "Your session has expired. Please sign in again." };
  if (user.role !== "head" || user.isSuspended) {
    return { status: 403, message: "Only the admin can update the public website." };
  }
  return null;
}
