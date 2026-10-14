"use client";

import { buildProjectObjectPath, compressImage, uploadFile } from "@/lib/uploads";

/**
 * Uploads support attachments to the `project-files` bucket (the only bucket the
 * API accepts for chat/complaints) under `projects/<id>/<area>/…`, one at a time,
 * and resolves to the `sb://` refs to send. Photos are downscaled first.
 */
export async function uploadAttachments(
  projectId: string,
  area: string,
  files: File[],
  { onProgress, signal }: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<string[]> {
  const refs: string[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = await compressImage(files[i]);
    const ref = await uploadFile({
      bucket: "project-files",
      path: buildProjectObjectPath(projectId, area, file.name),
      file,
      signal,
      onProgress: (f) => onProgress?.((i + f) / files.length),
    });
    refs.push(ref);
  }
  onProgress?.(1);
  return refs;
}
