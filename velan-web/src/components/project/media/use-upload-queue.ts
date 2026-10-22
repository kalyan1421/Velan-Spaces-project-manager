"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { isApiError } from "@/lib/api/errors";
import {
  UploadError,
  buildProjectObjectPath,
  compressImage,
  extensionOf,
  uploadFile,
  type ProjectBucket,
} from "@/lib/uploads";
import { mediaKindOfFile } from "./media";
import { createUploadItem, queueSummary, runPool, uploadQueueReducer, type UploadItem } from "./upload-queue";

export type UploadTarget = {
  projectId: string;
  bucket: ProjectBucket;
  /** Folder under `projects/<projectId>/`, e.g. "updates". */
  area: string;
  /** Downscale JPEG/PNG/WebP before upload (R-D4). */
  compressImages?: boolean;
};

export type UploadedItem = { item: UploadItem; ref: string };

const CONCURRENCY = 3;
/** Browsers can't render HEIC/HEIF thumbnails. */
const NO_PREVIEW = new Set(["heic", "heif"]);

let counter = 0;
const newId = () => {
  counter += 1;
  return `upload-${Date.now().toString(36)}-${counter}`;
};

function errorMessage(error: unknown): string {
  if (error instanceof UploadError) return error.message;
  if (isApiError(error)) return error.message;
  return "Upload failed. Please try again.";
}

/**
 * Upload queue for one form. `upload()` sends every item that isn't done yet
 * (so calling it again is "retry failed"), and resolves with the refs in the
 * order the files were added — or `null` if anything failed or was cancelled.
 */
export function useUploadQueue({ projectId, bucket, area, compressImages = false }: UploadTarget) {
  const [items, dispatch] = useReducer(uploadQueueReducer, []);
  const itemsRef = useRef<UploadItem[]>(items);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Unmount: stop uploads and release thumbnails.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      for (const item of itemsRef.current) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    },
    [],
  );

  const add = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const created = files.map((file) => {
      const previewable = mediaKindOfFile(file) === "image" && !NO_PREVIEW.has(extensionOf(file.name));
      return createUploadItem(file, newId(), previewable ? URL.createObjectURL(file) : null);
    });
    // Keep the ref current immediately so an upload started in the same tick sees them.
    itemsRef.current = [...itemsRef.current, ...created];
    dispatch({ type: "add", items: created });
  }, []);

  const remove = useCallback((id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    itemsRef.current = itemsRef.current.filter((i) => i.id !== id);
    dispatch({ type: "remove", id });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    for (const item of itemsRef.current) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    itemsRef.current = [];
    dispatch({ type: "reset" });
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const upload = useCallback(async (): Promise<UploadedItem[] | null> => {
    const snapshot = itemsRef.current;
    const refs = new Map<string, string>();
    for (const item of snapshot) if (item.status === "done" && item.ref) refs.set(item.id, item.ref);
    const pending = snapshot.filter((i) => !refs.has(i.id));

    const controller = new AbortController();
    abortRef.current = controller;
    let failed = 0;

    await runPool(pending, CONCURRENCY, async (item) => {
      if (controller.signal.aborted) return;
      dispatch({ type: "start", id: item.id });
      try {
        let file = item.file;
        if (compressImages && item.kind === "image") {
          const compressed = await compressImage(file).catch(() => file);
          if (compressed !== file) {
            file = compressed;
            dispatch({ type: "replaceFile", id: item.id, file });
          }
        }
        const ref = await uploadFile({
          bucket,
          path: buildProjectObjectPath(projectId, area, file.name),
          file,
          signal: controller.signal,
          onProgress: (progress) => dispatch({ type: "progress", id: item.id, progress }),
        });
        refs.set(item.id, ref);
        dispatch({ type: "succeed", id: item.id, ref });
      } catch (error) {
        failed += 1;
        dispatch({ type: "fail", id: item.id, error: errorMessage(error) });
      }
    });

    if (abortRef.current === controller) abortRef.current = null;
    if (controller.signal.aborted || failed > 0) return null;
    return snapshot.map((item) => ({ item, ref: refs.get(item.id) as string }));
  }, [area, bucket, compressImages, projectId]);

  const summary = useMemo(() => queueSummary(items), [items]);

  return { items, summary, add, remove, reset, cancel, upload };
}

export type UploadQueue = ReturnType<typeof useUploadQueue>;
