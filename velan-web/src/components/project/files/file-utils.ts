/** Pure helpers for the Files tab. */

import type { CreateFileBody, Design, ProjectFile } from "@/lib/api/project-content";
import { extensionOf } from "@/lib/uploads";
import { designTitle, splitDocuments } from "../designs/design-utils";
import { displayFileName, fileTypeLabel, mediaKindOfFile, mediaKindOfUrl, type MediaKind } from "../media/media";

/** Best display name: title, original name, then the stored object name. */
export function fileDisplayName(file: Pick<ProjectFile, "title" | "name" | "storagePath">): string {
  const title = file.title?.trim();
  if (title) return title;
  const name = file.name?.trim();
  if (name) return name;
  return file.storagePath ? displayFileName(file.storagePath) : "Untitled file";
}

/** Name used for the type label and download (keeps the extension). */
export function fileNameWithExtension(file: Pick<ProjectFile, "name" | "title" | "storagePath">): string {
  for (const candidate of [file.name, file.title]) {
    if (candidate && extensionOf(candidate)) return candidate;
  }
  if (file.storagePath) return displayFileName(file.storagePath);
  return file.name ?? file.title ?? "file";
}

export function fileKind(file: Pick<ProjectFile, "name" | "title" | "storagePath">): MediaKind {
  const name = fileNameWithExtension(file);
  return extensionOf(name) ? mediaKindOfFile({ name, type: "" }) : mediaKindOfUrl(file.storagePath ?? "");
}

const CATEGORY_BY_KIND: Record<MediaKind, string> = {
  image: "image",
  video: "video",
  pdf: "document",
  document: "document",
};

/** `POST /projects/:id/files` body for one uploaded file. */
export function buildCreateFileBody(file: { name: string; size: number; type: string }, ref: string): CreateFileBody {
  const ext = extensionOf(file.name);
  const title = file.name.replace(/\.[a-z0-9]{1,8}$/i, "").trim() || file.name;
  return {
    name: file.name,
    title,
    storagePath: ref,
    category: CATEGORY_BY_KIND[mediaKindOfFile(file)],
    type: ext || "unknown",
    size: Math.max(0, Math.round(file.size)),
  };
}

/** Newest first; files without a date sink to the bottom. */
export function sortFilesNewestFirst(files: ProjectFile[]): ProjectFile[] {
  return [...files].sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
}

export type DocumentRow = {
  key: string;
  title: string;
  /** Name with extension, for the icon and the download. */
  fileName: string;
  label: string;
  url: string | null;
  date: string;
  /** Bytes; 0 when unknown. */
  size: number;
};

/**
 * Client "Documents": quotation PDFs attached to the project (stored as designs
 * of type Quotation) plus project files, newest first.
 */
export function documentRows(designs: Design[], files: ProjectFile[]): DocumentRow[] {
  const quotes: DocumentRow[] = splitDocuments(designs).quotations.map((d) => ({
    key: `q-${d.id}`,
    title: designTitle(d),
    fileName: d.fileUrl ? displayFileName(d.fileUrl) : `${designTitle(d)}.pdf`,
    label: "Quotation",
    url: d.fileUrl,
    date: d.createdAt,
    size: 0,
  }));
  const docs: DocumentRow[] = files.map((f) => {
    const fileName = fileNameWithExtension(f);
    return {
      key: `f-${f.id}`,
      title: fileDisplayName(f),
      fileName,
      label: fileTypeLabel(fileName),
      url: f.storagePath,
      date: f.uploadedAt,
      size: f.size,
    };
  });
  return [...quotes, ...docs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
