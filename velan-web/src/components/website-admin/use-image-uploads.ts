"use client";

import { useEffect, useState } from "react";
import { MAX_PORTFOLIO_IMAGE_BYTES, uploadPortfolioImage } from "@/lib/api/portfolio-admin";
import { compressImage } from "@/lib/uploads";
import { resolveImageContentType, type PendingUpload, type RejectedUpload } from "./portfolio-rules";
import { createUploadQueue, type SlotLimits, type UploadFn } from "./upload-queue";
import { errorMessage } from "./use-portfolio";

/** Oversize photos are re-encoded to fit the 10 MB limit (still plenty for a full-width hero). */
const RESIZE = { maxDimension: 2560, quality: 0.85 };

const uploadFile: UploadFn<File> = async (job, { signal, onProgress }) => {
  let file = job.file;
  let contentType = job.contentType;
  if (job.resize) {
    file = await compressImage(file, RESIZE);
    if (file.size > MAX_PORTFOLIO_IMAGE_BYTES) throw new Error("This photo is over 10 MB even after resizing.");
    contentType = resolveImageContentType(file) ?? contentType;
  }
  return uploadPortfolioImage(file, contentType, { signal, onProgress });
};

/**
 * Upload state for one photo slot. Uploads keep running if the page is hidden
 * (Next keeps the route alive with Activity); the editor's unsaved-changes
 * guard warns before leaving mid-upload.
 */
export function useImageUploads({ onCommit, ...limits }: SlotLimits & { onCommit: (urls: string[]) => void }) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [queue] = useState(() =>
    createUploadQueue<File>({
      upload: uploadFile,
      onChange: setPending,
      describeError: (error) => errorMessage(error, "Upload failed. Please try again."),
      preview: (file) => URL.createObjectURL(file),
      revokePreview: (url) => URL.revokeObjectURL(url),
    }),
  );

  useEffect(() => queue.setOnCommit(onCommit), [queue, onCommit]);

  return {
    pending,
    add: (files: File[]): RejectedUpload[] => queue.add(files, limits),
    retry: (key: string) => queue.retry(key),
    dismiss: (key: string) => queue.dismiss(key),
    /** Anything still queued or uploading. */
    busy: pending.some((p) => p.status === "queued" || p.status === "uploading"),
  };
}
