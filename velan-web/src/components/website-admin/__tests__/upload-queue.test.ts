import { describe, expect, it } from "vitest";
import type { PendingUpload } from "../portfolio-rules";
import { createUploadQueue, type UploadJob } from "../upload-queue";

type F = { name: string; type: string; size: number; lastModified: number };

const MB = 1024 * 1024;
const file = (name: string, lastModified = 1): F => ({ name, type: "image/jpeg", size: MB, lastModified });

function deferred() {
  let resolve!: (url: string) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A queue whose uploads are resolved by the test, one deferred per file name. */
function setup({ concurrency = 3 } = {}) {
  const calls: { job: UploadJob<F>; signal: AbortSignal; onProgress: (f: number) => void }[] = [];
  const pendingUploads = new Map<string, ReturnType<typeof deferred>>();
  const committed: string[][] = [];
  let snapshot: PendingUpload[] = [];

  const queue = createUploadQueue<F>({
    concurrency,
    upload: (job, options) => {
      calls.push({ job, ...options });
      const d = deferred();
      pendingUploads.set(job.file.name, d);
      options.signal.addEventListener("abort", () => d.reject(new Error("Upload cancelled.")));
      return d.promise;
    },
    onChange: (p) => {
      snapshot = p;
    },
    onCommit: (urls) => committed.push(urls),
    describeError: (e) => (e instanceof Error ? e.message : "failed"),
  });

  const slot = { max: 40, existingCount: 0, isTaken: () => false };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { queue, calls, pendingUploads, committed, slot, flush, statuses: () => snapshot.map((p) => `${p.name}:${p.status}`) };
}

describe("createUploadQueue", () => {
  it("uploads accepted files and commits them in the order they were picked", async () => {
    const t = setup();
    t.queue.add([file("a.jpg", 1), file("b.jpg", 2)], t.slot);
    expect(t.statuses()).toEqual(["a.jpg:uploading", "b.jpg:uploading"]);

    t.pendingUploads.get("b.jpg")!.resolve("url-b");
    await t.flush();
    expect(t.committed).toEqual([]); // b waits for a

    t.pendingUploads.get("a.jpg")!.resolve("url-a");
    await t.flush();
    expect(t.committed.flat()).toEqual(["url-a", "url-b"]);
    expect(t.queue.pending).toEqual([]);
  });

  it("runs at most `concurrency` uploads at once", async () => {
    const t = setup({ concurrency: 2 });
    t.queue.add([file("a.jpg", 1), file("b.jpg", 2), file("c.jpg", 3)], t.slot);
    expect(t.calls).toHaveLength(2);
    expect(t.statuses()).toEqual(["a.jpg:uploading", "b.jpg:uploading", "c.jpg:queued"]);

    t.pendingUploads.get("a.jpg")!.resolve("url-a");
    await t.flush();
    expect(t.calls).toHaveLength(3);
  });

  it("reports progress", () => {
    const t = setup();
    t.queue.add([file("a.jpg")], t.slot);
    t.calls[0].onProgress(0.5);
    expect(t.queue.pending[0].progress).toBe(0.5);
  });

  it("keeps a failed upload with its error, without blocking later ones, and can retry it", async () => {
    const t = setup();
    t.queue.add([file("a.jpg", 1), file("b.jpg", 2)], t.slot);
    t.pendingUploads.get("a.jpg")!.reject(new Error("Upload failed (500). Please try again."));
    t.pendingUploads.get("b.jpg")!.resolve("url-b");
    await t.flush();

    expect(t.committed.flat()).toEqual(["url-b"]);
    expect(t.queue.pending).toMatchObject([{ name: "a.jpg", status: "error", error: "Upload failed (500). Please try again." }]);

    t.queue.retry(t.queue.pending[0].key);
    expect(t.statuses()).toEqual(["a.jpg:uploading"]);
    t.pendingUploads.get("a.jpg")!.resolve("url-a");
    await t.flush();
    expect(t.committed.flat()).toEqual(["url-b", "url-a"]);
  });

  it("dismiss cancels an upload in flight and removes it", async () => {
    const t = setup();
    t.queue.add([file("a.jpg")], t.slot);
    const signal = t.calls[0].signal;
    t.queue.dismiss(t.queue.pending[0].key);
    await t.flush();
    expect(signal.aborted).toBe(true);
    expect(t.queue.pending).toEqual([]);
    expect(t.committed).toEqual([]);
  });

  it("returns rejected files and queues nothing for them", () => {
    const t = setup();
    const rejected = t.queue.add([{ name: "x.heic", type: "image/heic", size: MB, lastModified: 1 }], t.slot);
    expect(rejected).toHaveLength(1);
    expect(t.calls).toHaveLength(0);
  });

  it("treats re-adding an uploaded file as a duplicate only while its photo is still in the slot", async () => {
    const t = setup();
    const a = file("a.jpg", 7);
    t.queue.add([a], t.slot);
    t.pendingUploads.get("a.jpg")!.resolve("url-a");
    await t.flush();

    expect(t.queue.add([a], { ...t.slot, isTaken: (u) => u === "url-a" })[0].reason).toMatch(/already added/i);
    expect(t.queue.add([a], { ...t.slot, isTaken: () => false })).toEqual([]);
  });

  it("counts uploads in flight toward the slot limit", () => {
    const t = setup();
    t.queue.add([file("a.jpg", 1)], { ...t.slot, max: 1 });
    const rejected = t.queue.add([file("b.jpg", 2)], { ...t.slot, max: 1 });
    expect(rejected).toHaveLength(1);
  });
});
