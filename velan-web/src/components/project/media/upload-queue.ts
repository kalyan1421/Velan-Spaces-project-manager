/**
 * Upload queue state (pure). Each picked file becomes an item that moves
 * queued → uploading → done | error. Failed items keep their File so they can
 * be retried without re-picking, and finished items keep their `sb://` ref so
 * a retry never re-uploads them (R-D4: "failed files can be retried without
 * re-posting").
 */

import { mediaKindOfFile, type MediaKind } from "./media";

export type UploadStatus = "queued" | "uploading" | "done" | "error";

export type UploadItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  kind: MediaKind;
  status: UploadStatus;
  /** 0..1 */
  progress: number;
  /** `sb://bucket/path` once uploaded. */
  ref: string | null;
  error: string | null;
  /** `blob:` URL for a local thumbnail (images only); owned by the hook. */
  previewUrl: string | null;
};

export type UploadAction =
  | { type: "add"; items: UploadItem[] }
  | { type: "remove"; id: string }
  | { type: "start"; id: string }
  | { type: "progress"; id: string; progress: number }
  | { type: "replaceFile"; id: string; file: File }
  | { type: "succeed"; id: string; ref: string }
  | { type: "fail"; id: string; error: string }
  | { type: "retry"; id: string }
  | { type: "retryAll" }
  | { type: "reset" };

export function createUploadItem(file: File, id: string, previewUrl: string | null = null): UploadItem {
  return {
    id,
    file,
    name: file.name,
    size: file.size,
    kind: mediaKindOfFile(file),
    status: "queued",
    progress: 0,
    ref: null,
    error: null,
    previewUrl,
  };
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function patch(state: UploadItem[], id: string, fn: (item: UploadItem) => UploadItem): UploadItem[] {
  const index = state.findIndex((i) => i.id === id);
  if (index === -1) return state;
  const current = state[index];
  const next = fn(current);
  if (next === current) return state;
  const copy = state.slice();
  copy[index] = next;
  return copy;
}

export function uploadQueueReducer(state: UploadItem[], action: UploadAction): UploadItem[] {
  switch (action.type) {
    case "add":
      return action.items.length === 0 ? state : [...state, ...action.items];
    case "remove":
      return state.some((i) => i.id === action.id) ? state.filter((i) => i.id !== action.id) : state;
    case "start":
      return patch(state, action.id, (i) =>
        i.status === "done" ? i : { ...i, status: "uploading", progress: 0, error: null },
      );
    case "progress":
      return patch(state, action.id, (i) =>
        i.status === "done" || i.status === "error" ? i : { ...i, progress: clamp01(action.progress) },
      );
    case "replaceFile":
      return patch(state, action.id, (i) => ({ ...i, file: action.file, name: action.file.name, size: action.file.size }));
    case "succeed":
      return patch(state, action.id, (i) => ({ ...i, status: "done", progress: 1, ref: action.ref, error: null }));
    case "fail":
      return patch(state, action.id, (i) => ({ ...i, status: "error", error: action.error }));
    case "retry":
      return patch(state, action.id, (i) => (i.status === "error" ? { ...i, status: "queued", progress: 0, error: null } : i));
    case "retryAll":
      return state.some((i) => i.status === "error")
        ? state.map((i) => (i.status === "error" ? { ...i, status: "queued", progress: 0, error: null } : i))
        : state;
    case "reset":
      return state.length === 0 ? state : [];
  }
}

export type QueueSummary = {
  total: number;
  done: number;
  failed: number;
  /** Something is uploading right now. */
  busy: boolean;
  /** Every item uploaded (and there is at least one). */
  allDone: boolean;
  /** Overall 0..1, weighted by file size. */
  progress: number;
  /** Refs of finished items, in queue order. */
  refs: string[];
};

export function queueSummary(items: UploadItem[]): QueueSummary {
  let done = 0;
  let failed = 0;
  let busy = false;
  let totalBytes = 0;
  let sentBytes = 0;
  const refs: string[] = [];
  for (const item of items) {
    const weight = Math.max(1, item.size);
    totalBytes += weight;
    sentBytes += weight * (item.status === "done" ? 1 : item.progress);
    if (item.status === "done") {
      done += 1;
      if (item.ref) refs.push(item.ref);
    } else if (item.status === "error") {
      failed += 1;
    } else if (item.status === "uploading") {
      busy = true;
    }
  }
  return {
    total: items.length,
    done,
    failed,
    busy,
    allDone: items.length > 0 && done === items.length,
    progress: totalBytes === 0 ? 0 : sentBytes / totalBytes,
    refs,
  };
}

/** Runs `worker` over `items` with at most `limit` in flight. `worker` should not throw. */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.max(0, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
}
