/**
 * Pure helpers for project media: what kind a file/URL is, labels, sizes,
 * download links and the attach rules for updates, designs and files.
 */

import {
  ALLOWED_EXTENSIONS,
  IMAGE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  VIDEO_EXTENSIONS,
  extensionOf,
  isAllowedFile,
} from "@/lib/uploads";

export type MediaKind = "image" | "video" | "pdf" | "document";

/** Anything with a name, size and MIME type (File, or a test double). */
export type FileLike = { name: string; size: number; type: string };

function kindOfExtension(ext: string): MediaKind | null {
  if (!ext) return null;
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return null;
}

/** Last path segment of a URL (query/hash removed, percent-decoded); "" when unparseable. */
function urlBaseName(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return "";
  }
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // keep the raw path
  }
  return decoded.split("/").filter(Boolean).pop() ?? "";
}

/** Extension of a file name or URL. */
function extOf(nameOrUrl: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(nameOrUrl) ? extensionOf(urlBaseName(nameOrUrl)) : extensionOf(nameOrUrl);
}

/**
 * Kind of a (signed) media URL. `typeHint` is the update's `type`
 * ("photo" / "video") for URLs without a usable extension.
 */
export function mediaKindOfUrl(url: string, typeHint?: string | null): MediaKind {
  const kind = kindOfExtension(extOf(url));
  if (kind) return kind;
  if (typeHint === "video") return "video";
  if (typeHint === "photo" || typeHint === "image") return "image";
  return "document";
}

export function mediaKindOfFile(file: Pick<FileLike, "name" | "type">): MediaKind {
  const kind = kindOfExtension(extensionOf(file.name));
  if (kind) return kind;
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "document";
}

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 1536 → "1.5 KB". Unknown/negative sizes → "—". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return `${text} ${UNITS[unit]}`;
}

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  doc: "Word",
  docx: "Word",
  xls: "Excel",
  xlsx: "Excel",
  csv: "CSV",
  ppt: "PowerPoint",
  pptx: "PowerPoint",
  txt: "Text",
};

/** Human file type for tables: "PDF", "Excel", "Image", "Video", "File". */
export function fileTypeLabel(nameOrUrl: string): string {
  const ext = extOf(nameOrUrl);
  if (TYPE_LABELS[ext]) return TYPE_LABELS[ext];
  const kind = kindOfExtension(ext);
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  return "File";
}

/** Our uploads are stored as `<8 hex>-<safe-name>`; show just the name. */
export function displayFileName(url: string): string {
  const base = urlBaseName(url) || url.split(/[?#]/, 1)[0].split("/").pop() || "";
  return base.replace(/^[0-9a-f]{8}-(?=.)/, "") || "file";
}

const SUPABASE_SIGNED = "/storage/v1/object/sign/";

/**
 * Link that downloads instead of opening. Supabase signed URLs honour
 * `download=<file name>` (Content-Disposition: attachment); other URLs
 * (legacy Firebase) are returned unchanged — the browser opens them.
 */
export function downloadUrl(url: string, fileName: string): string {
  if (!url.includes(SUPABASE_SIGNED)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(fileName || "download")}`;
}

// ------------------------------------------------------------------ attach rules

export type Rejected<F> = { file: F; reason: string };
export type FilePlan<F> = { accepted: F[]; rejected: Rejected<F>[] };

/** Design documents: images the browser can show, and PDFs (as on mobile). */
export const DESIGN_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
export const DESIGN_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
export const FILE_EXTENSIONS = ALLOWED_EXTENSIONS;
export const FILE_ACCEPT = [...ALLOWED_EXTENSIONS].map((e) => `.${e}`).join(",");
export const UPDATE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.m4v";

export const MAX_DESIGN_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_BYTES = MAX_UPLOAD_BYTES;
export const MAX_UPDATE_PHOTOS = 20;
/** Raw photo limit; photos are compressed in the browser before upload. */
export const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
export const MAX_VIDEO_BYTES = MAX_UPLOAD_BYTES;

const tooLarge = (max: number) => `File is too large (max ${formatBytes(max)}).`;

/** Generic accept/reject by extension (within the API's allow-list) and size. */
export function validateFiles<F extends FileLike>(
  files: F[],
  { extensions, maxBytes, label }: { extensions: ReadonlySet<string>; maxBytes: number; label: string },
): FilePlan<F> {
  const accepted: F[] = [];
  const rejected: Rejected<F>[] = [];
  for (const file of files) {
    if (!isAllowedFile(file.name) || !extensions.has(extensionOf(file.name))) {
      rejected.push({ file, reason: `This file type can't be added to ${label}.` });
    } else if (file.size > maxBytes) {
      rejected.push({ file, reason: tooLarge(maxBytes) });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

const ONE_VIDEO = "An update can have one video, or photos — not both.";
/** Most browsers can't display HEIC/HEIF, so other viewers would see broken images. */
const NOT_ON_WEB = new Set(["heic", "heif"]);

/**
 * Update attachments (R-D4): several photos, or exactly one video.
 * `existing` are the kinds already in the composer.
 */
export function planUpdateMedia<F extends FileLike>(existing: readonly MediaKind[], incoming: F[]): FilePlan<F> {
  let photos = existing.filter((k) => k === "image").length;
  let hasVideo = existing.includes("video");
  const accepted: F[] = [];
  const rejected: Rejected<F>[] = [];

  for (const file of incoming) {
    if (!isAllowedFile(file.name)) {
      rejected.push({ file, reason: "This file type isn't supported." });
      continue;
    }
    if (NOT_ON_WEB.has(extensionOf(file.name))) {
      rejected.push({ file, reason: "HEIC photos can't be shown in most browsers. Export them as JPEG and try again." });
      continue;
    }
    const kind = mediaKindOfFile(file);
    if (kind !== "image" && kind !== "video") {
      rejected.push({ file, reason: "Only photos or a video can be attached to an update." });
      continue;
    }
    const max = kind === "video" ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (file.size > max) {
      rejected.push({ file, reason: tooLarge(max) });
      continue;
    }
    if (kind === "video") {
      if (hasVideo || photos > 0) {
        rejected.push({ file, reason: ONE_VIDEO });
        continue;
      }
      hasVideo = true;
    } else {
      if (hasVideo) {
        rejected.push({ file, reason: ONE_VIDEO });
        continue;
      }
      if (photos >= MAX_UPDATE_PHOTOS) {
        rejected.push({ file, reason: `An update can have up to ${MAX_UPDATE_PHOTOS} photos.` });
        continue;
      }
      photos += 1;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}
