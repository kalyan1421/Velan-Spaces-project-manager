/**
 * Browser uploads to Supabase Storage via API-signed URLs.
 *
 * Flow (matches the API's storage module): `POST uploads/sign {bucket, path}`
 * returns a short-lived `signedUrl`; the browser PUTs the bytes straight to
 * Storage (never through our servers), and the entity stores the reference
 * `sb://<bucket>/<path>`. The API turns refs back into signed download URLs in
 * responses, so never persist a URL you got from a response.
 *
 * The API only signs project buckets for paths shaped
 * `projects/<projectId>/<...>/<file>` with an allowed extension.
 */

import { api } from "@/lib/api/client";

export const PROJECT_BUCKETS = ["project-files", "designs", "update-images"] as const;
export type ProjectBucket = (typeof PROJECT_BUCKETS)[number];

/** Mirrors the API's ALLOWED_UPLOAD_EXTENSIONS. */
export const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "heic", "heif", "gif",
  "pdf",
  "mp4", "mov", "m4v",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv",
]);

export const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"]);
export const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v"]);

/** Hard client-side ceiling; the bucket enforces its own limit too. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Lowercase extension of the base name only; "" when absent or not alphanumeric. */
export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

export function isAllowedFile(name: string): boolean {
  return ALLOWED_EXTENSIONS.has(extensionOf(name));
}

/** `My Photo (1).JPG` -> `my-photo-1.jpg`; never empty; max 80 chars + ext. */
export function safeFileName(name: string): string {
  const ext = extensionOf(name);
  const stem = (ext ? name.slice(0, -(ext.length + 1)) : name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
  return ext ? `${stem}.${ext}` : stem;
}

/** `projects/<projectId>/<area>/<random>-<safe-name>` */
export function buildProjectObjectPath(projectId: string, area: string, fileName: string, id = randomId()): string {
  const cleanArea = area
    .split("/")
    .map((s) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("/");
  if (!cleanArea) throw new Error("Upload area is required");
  return `projects/${projectId}/${cleanArea}/${id}-${safeFileName(fileName)}`;
}

export function toStorageRef(bucket: string, path: string): string {
  return `sb://${bucket}/${path}`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

type SignUploadResponse = { bucket: string; path: string; signedUrl: string; token: string };

export type UploadOptions = {
  bucket: ProjectBucket | "quotations" | "avatars";
  path: string;
  file: Blob & { name?: string; type: string };
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

export class UploadError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "UploadError";
  }
}

/** Sign, then PUT the bytes with progress. Resolves to the `sb://` ref to store. */
export async function uploadFile({ bucket, path, file, onProgress, signal }: UploadOptions): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("File is too large (max 200 MB).");
  const signed = await api.post<SignUploadResponse>("uploads/sign", { bucket, path }, { signal });
  await putWithProgress(signed.signedUrl, file, onProgress, signal);
  return toStorageRef(signed.bucket ?? bucket, signed.path ?? path);
}

function putWithProgress(
  url: string,
  file: Blob & { type: string },
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new UploadError(`Upload failed (${xhr.status}). Please try again.`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new UploadError("Network error while uploading. Please try again."));
    xhr.onabort = () => reject(new UploadError("Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/**
 * Downscale large photos before upload (spec R-D4). Non-images, GIFs and HEIC
 * (browsers can't decode it) are returned untouched, as is anything already small.
 */
export async function compressImage(
  file: File,
  { maxDimension = 2048, quality = 0.82 }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  const ext = extensionOf(file.name);
  if (!["jpg", "jpeg", "png", "webp"].includes(ext) || typeof createImageBitmap === "undefined") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  if (blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
}
