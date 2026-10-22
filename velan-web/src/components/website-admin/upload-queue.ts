/**
 * Framework-free upload queue for one photo slot (gallery or cover):
 * validation via `planImageUploads`, at most `concurrency` uploads at a time,
 * per-file progress, retry / dismiss, and in-order hand-off of finished URLs.
 * The React hook (`useImageUploads`) only mirrors `pending` into state.
 */

import {
  commitFinishedUploads,
  planImageUploads,
  type FileLike,
  type PendingUpload,
  type RejectedUpload,
} from "./portfolio-rules";

export type UploadJob<F extends FileLike> = { file: F; contentType: string; resize: boolean };

export type UploadFn<F extends FileLike> = (
  job: UploadJob<F>,
  options: { signal: AbortSignal; onProgress: (fraction: number) => void },
) => Promise<string>;

export type SlotLimits = {
  /** Slot capacity (40 for the gallery, 1 for the cover). */
  max: number;
  /** Photos already in the slot. */
  existingCount: number;
  /** True when a URL is still in the slot (so re-adding that same file counts as a duplicate). */
  isTaken: (url: string) => boolean;
};

export function createUploadQueue<F extends FileLike>({
  upload,
  onChange,
  onCommit: initialOnCommit = () => {},
  describeError,
  preview = () => undefined,
  revokePreview = () => {},
  concurrency = 3,
}: {
  upload: UploadFn<F>;
  onChange: (pending: PendingUpload[]) => void;
  /** Receives finished URLs in pick order (replaceable later with `setOnCommit`). */
  onCommit?: (urls: string[]) => void;
  describeError: (error: unknown) => string;
  preview?: (file: F) => string | undefined;
  revokePreview?: (url: string) => void;
  concurrency?: number;
}) {
  let pending: PendingUpload[] = [];
  const jobs = new Map<string, UploadJob<F>>();
  const controllers = new Map<string, AbortController>();
  const committedKeys = new Map<string, string>(); // file key -> url
  let running = 0;
  let onCommit = initialOnCommit;

  function publish(next: PendingUpload[]) {
    const { committed, remaining } = commitFinishedUploads(next);
    const keep = new Set(remaining.map((p) => p.key));
    for (const p of next) {
      if (keep.has(p.key)) continue;
      if (p.previewUrl) revokePreview(p.previewUrl);
      if (p.url) committedKeys.set(p.key, p.url);
      jobs.delete(p.key);
    }
    pending = remaining;
    onChange(remaining);
    if (committed.length > 0) onCommit(committed);
  }

  function patch(key: string, change: Partial<PendingUpload>) {
    if (!pending.some((p) => p.key === key)) return; // dismissed meanwhile
    publish(pending.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }

  async function run(key: string, job: UploadJob<F>) {
    const controller = new AbortController();
    controllers.set(key, controller);
    patch(key, { status: "uploading", progress: 0, error: undefined });
    try {
      const url = await upload(job, {
        signal: controller.signal,
        onProgress: (progress) => patch(key, { progress }),
      });
      patch(key, { status: "done", progress: 1, url });
    } catch (error) {
      patch(key, { status: "error", error: describeError(error) });
    } finally {
      controllers.delete(key);
      running -= 1;
      pump();
    }
  }

  function pump() {
    while (running < concurrency) {
      const next = pending.find((p) => p.status === "queued");
      const job = next ? jobs.get(next.key) : undefined;
      if (!next || !job) return;
      running += 1;
      void run(next.key, job);
    }
  }

  return {
    get pending() {
      return pending;
    },

    /** Swap the commit handler (React: keep it pointing at the latest props). */
    setOnCommit(handler: (urls: string[]) => void) {
      onCommit = handler;
    },

    /** Validates and queues a selection; returns the files that were turned away. */
    add(files: readonly F[], limits: SlotLimits): RejectedUpload[] {
      const seenKeys = new Set(pending.map((p) => p.key));
      for (const [key, url] of committedKeys) if (limits.isTaken(url)) seenKeys.add(key);
      const inFlight = pending.filter((p) => p.status !== "error").length;

      const { accepted, rejected } = planImageUploads(files, {
        existingCount: limits.existingCount + inFlight,
        seenKeys,
        max: limits.max,
      });
      if (accepted.length === 0) return rejected;

      const queued: PendingUpload[] = accepted.map((a) => {
        jobs.set(a.key, { file: a.file, contentType: a.contentType, resize: a.resize });
        return { key: a.key, name: a.file.name, status: "queued", progress: 0, previewUrl: preview(a.file) };
      });
      publish([...pending, ...queued]);
      pump();
      return rejected;
    },

    retry(key: string) {
      const entry = pending.find((p) => p.key === key);
      if (!entry || entry.status !== "error" || !jobs.has(key)) return;
      patch(key, { status: "queued", progress: 0, error: undefined });
      pump();
    },

    /** Cancels (if uploading) and removes an entry. */
    dismiss(key: string) {
      const entry = pending.find((p) => p.key === key);
      if (!entry) return;
      controllers.get(key)?.abort();
      if (entry.previewUrl) revokePreview(entry.previewUrl);
      jobs.delete(key);
      publish(pending.filter((p) => p.key !== key));
    },
  };
}

export type UploadQueue<F extends FileLike> = ReturnType<typeof createUploadQueue<F>>;
