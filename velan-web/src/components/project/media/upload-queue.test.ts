import { describe, expect, it } from "vitest";
import { createUploadItem, queueSummary, uploadQueueReducer, type UploadItem } from "./upload-queue";

const f = (name: string, size = 100) => new File([new Uint8Array(size)], name, { type: "image/jpeg" });

function queue(...names: string[]): UploadItem[] {
  return uploadQueueReducer([], { type: "add", items: names.map((n, i) => createUploadItem(f(n), `id-${i}`)) });
}

describe("createUploadItem", () => {
  it("starts queued with no progress and detects the media kind", () => {
    const item = createUploadItem(f("site.jpg", 10), "x", "blob:preview");
    expect(item).toMatchObject({ id: "x", name: "site.jpg", size: 10, kind: "image", status: "queued", progress: 0 });
    expect(item.ref).toBeNull();
    expect(item.previewUrl).toBe("blob:preview");
  });
});

describe("uploadQueueReducer", () => {
  it("adds items in order", () => {
    expect(queue("a.jpg", "b.jpg").map((i) => i.name)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("removes an item", () => {
    const next = uploadQueueReducer(queue("a.jpg", "b.jpg"), { type: "remove", id: "id-0" });
    expect(next.map((i) => i.id)).toEqual(["id-1"]);
  });

  it("tracks progress and clamps it to 0..1", () => {
    let s = uploadQueueReducer(queue("a.jpg"), { type: "start", id: "id-0" });
    expect(s[0].status).toBe("uploading");
    s = uploadQueueReducer(s, { type: "progress", id: "id-0", progress: 0.4 });
    expect(s[0].progress).toBe(0.4);
    s = uploadQueueReducer(s, { type: "progress", id: "id-0", progress: 7 });
    expect(s[0].progress).toBe(1);
  });

  it("stores the storage ref on success", () => {
    let s = uploadQueueReducer(queue("a.jpg"), { type: "start", id: "id-0" });
    s = uploadQueueReducer(s, { type: "succeed", id: "id-0", ref: "sb://update-images/projects/p/a.jpg" });
    expect(s[0]).toMatchObject({ status: "done", progress: 1, ref: "sb://update-images/projects/p/a.jpg", error: null });
  });

  it("keeps the file on failure so it can be retried", () => {
    let s = uploadQueueReducer(queue("a.jpg"), { type: "start", id: "id-0" });
    s = uploadQueueReducer(s, { type: "fail", id: "id-0", error: "Network error" });
    expect(s[0]).toMatchObject({ status: "error", error: "Network error" });
    s = uploadQueueReducer(s, { type: "retry", id: "id-0" });
    expect(s[0]).toMatchObject({ status: "queued", progress: 0, error: null });
    expect(s[0].file.name).toBe("a.jpg");
  });

  it("retry-all only touches failed items", () => {
    let s = queue("a.jpg", "b.jpg");
    s = uploadQueueReducer(s, { type: "succeed", id: "id-0", ref: "sb://x/a" });
    s = uploadQueueReducer(s, { type: "fail", id: "id-1", error: "boom" });
    s = uploadQueueReducer(s, { type: "retryAll" });
    expect(s.map((i) => i.status)).toEqual(["done", "queued"]);
  });

  it("swaps in the compressed file without losing identity", () => {
    const s = uploadQueueReducer(queue("a.png"), { type: "replaceFile", id: "id-0", file: f("a.jpg", 10) });
    expect(s[0]).toMatchObject({ id: "id-0", name: "a.jpg", size: 10 });
  });

  it("ignores actions for unknown ids and does not resurrect finished uploads", () => {
    const s = queue("a.jpg");
    expect(uploadQueueReducer(s, { type: "progress", id: "nope", progress: 0.5 })).toBe(s);
    const done = uploadQueueReducer(s, { type: "succeed", id: "id-0", ref: "sb://x/a" });
    expect(uploadQueueReducer(done, { type: "retry", id: "id-0" })[0].status).toBe("done");
    expect(uploadQueueReducer(done, { type: "progress", id: "id-0", progress: 0.2 })[0].progress).toBe(1);
  });

  it("resets to empty", () => {
    expect(uploadQueueReducer(queue("a.jpg"), { type: "reset" })).toEqual([]);
  });
});

describe("queueSummary", () => {
  it("summarises an empty queue", () => {
    expect(queueSummary([])).toMatchObject({ total: 0, allDone: false, failed: 0, busy: false, progress: 0 });
  });

  it("weights overall progress by file size and lists refs in order", () => {
    let s = uploadQueueReducer([], {
      type: "add",
      items: [createUploadItem(f("a.jpg", 300), "a"), createUploadItem(f("b.jpg", 100), "b")],
    });
    s = uploadQueueReducer(s, { type: "succeed", id: "a", ref: "sb://x/a" });
    s = uploadQueueReducer(s, { type: "start", id: "b" });
    s = uploadQueueReducer(s, { type: "progress", id: "b", progress: 0.5 });
    const sum = queueSummary(s);
    expect(sum.progress).toBeCloseTo(0.875);
    expect(sum.busy).toBe(true);
    expect(sum.allDone).toBe(false);
    s = uploadQueueReducer(s, { type: "succeed", id: "b", ref: "sb://x/b" });
    expect(queueSummary(s)).toMatchObject({ allDone: true, refs: ["sb://x/a", "sb://x/b"], done: 2 });
  });

  it("counts failures", () => {
    const s = uploadQueueReducer(queue("a.jpg"), { type: "fail", id: "id-0", error: "x" });
    expect(queueSummary(s)).toMatchObject({ failed: 1, allDone: false });
  });
});

describe("runPool", () => {
  it("runs every item with at most `limit` in flight", async () => {
    const { runPool } = await import("./upload-queue");
    let inFlight = 0;
    let peak = 0;
    const seen: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      seen.push(n);
      inFlight -= 1;
    });
    expect(peak).toBe(2);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles an empty list", async () => {
    const { runPool } = await import("./upload-queue");
    await expect(runPool([], 3, async () => {})).resolves.toBeUndefined();
  });
});
