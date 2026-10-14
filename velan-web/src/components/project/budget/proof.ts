/** Proof attachments (photo of a bill, PDF receipt) for expenses and settlements. */

import { extensionOf } from "@/lib/uploads";

export const PROOF_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "pdf"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"]);

/** `accept` for the file picker (HEIC listed explicitly for iPhone photos). */
export const PROOF_ACCEPT = "image/*,application/pdf,.pdf,.heic,.heif";
export const MAX_PROOF_BYTES = 20 * 1024 * 1024;

export function validateProofFile(file: { name: string; size: number }): string | null {
  if (!PROOF_EXTENSIONS.has(extensionOf(file.name))) return "Attach an image or a PDF.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_PROOF_BYTES) return "That file is larger than 20 MB.";
  return null;
}

/** What a stored proof is, judged from its (signed) URL's path. */
export function proofKind(url: string | null | undefined): "image" | "pdf" | "file" | null {
  if (!url) return null;
  let path = url;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    path = url.split(/[?#]/, 1)[0];
  }
  const ext = extensionOf(path);
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "file";
}

/** How a save should treat the proof field (see `expensePayload` / `settlementPayload`). */
export type ProofChange = { kind: "keep" } | { kind: "remove" } | { kind: "upload"; ref: string };

export function resolveProofChange({
  hadProof,
  removed,
  uploadedRef,
}: {
  hadProof: boolean;
  removed: boolean;
  uploadedRef: string | null;
}): ProofChange {
  if (uploadedRef) return { kind: "upload", ref: uploadedRef };
  if (hadProof && removed) return { kind: "remove" };
  return { kind: "keep" };
}

/** The `proofUrl` part of a request body for a proof change. */
export function proofBody(change: ProofChange, mode: "create" | "update"): { proofUrl?: string } {
  if (change.kind === "upload") return { proofUrl: change.ref };
  if (change.kind === "remove" && mode === "update") return { proofUrl: "" };
  return {};
}
