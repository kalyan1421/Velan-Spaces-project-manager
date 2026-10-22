import { describe, expect, it } from "vitest";
import {
  UPDATES_PAGE_SIZE,
  contentCapabilities,
  contentKeys,
  contentPath,
  flattenUpdatePages,
  nextUpdatesOffset,
  normalizeComment,
  normalizeDesign,
  normalizeFile,
  normalizeRoom,
  normalizeUpdate,
  roleFromApi,
  type ProjectUpdate,
} from "./project-content";

const PID = "5b91891e-1c5c-4f50-a8dc-f57c56d1458c";

describe("roleFromApi", () => {
  it("reads the upper-case role snapshot the API stores", () => {
    expect(roleFromApi("MANAGER")).toBe("manager");
    expect(roleFromApi("head")).toBe("head");
  });

  it("returns null for anything that is not a role", () => {
    expect(roleFromApi("ADMIN")).toBeNull();
    expect(roleFromApi(undefined)).toBeNull();
    expect(roleFromApi(3)).toBeNull();
  });
});

describe("normalizeComment", () => {
  it("maps the API comment shape", () => {
    const c = normalizeComment(
      { id: "c1", text: "Looks good", postedBy: "Ravi", postedById: "u1", role: "MANAGER", timestamp: "2026-10-14T10:00:00Z" },
      0,
    );
    expect(c).toEqual({
      id: "c1",
      text: "Looks good",
      authorName: "Ravi",
      authorId: "u1",
      role: "manager",
      createdAt: "2026-10-14T10:00:00Z",
    });
  });

  it("tolerates legacy comments without id, role or author", () => {
    const c = normalizeComment({ text: "ok" }, 3);
    expect(c.id).toBe("legacy-3");
    expect(c.authorName).toBe("Team member");
    expect(c.role).toBeNull();
    expect(c.createdAt).toBeNull();
  });

  it("drops non-object comments to an empty text", () => {
    expect(normalizeComment(null, 0).text).toBe("");
  });
});

describe("normalizeUpdate", () => {
  it("fills safe defaults so the UI never sees undefined arrays", () => {
    const u = normalizeUpdate({ id: "u1", projectId: PID, createdAt: "2026-10-14T10:00:00Z" });
    expect(u.mediaUrls).toEqual([]);
    expect(u.associatedWorkerIds).toEqual([]);
    expect(u.comments).toEqual([]);
    expect(u.isClientViewable).toBe(true);
    expect(u.type).toBe("message");
    expect(u.content).toBe("");
  });

  it("keeps the API's fields and normalises the role and comments", () => {
    const u = normalizeUpdate({
      id: "u1",
      projectId: PID,
      postedBy: "user-1",
      postedByName: "Asha",
      role: "WORKER",
      type: "photo",
      content: "Tiles done",
      category: "Tiles",
      roomId: "room-1",
      associatedWorkerIds: ["w1", 7, "w2"],
      mediaUrls: ["https://x/a.jpg", "", null],
      comments: [{ id: "c1", text: "Nice", postedBy: "Ravi" }],
      isClientViewable: false,
      createdAt: "2026-10-14T10:00:00Z",
    });
    expect(u.role).toBe("worker");
    expect(u.postedByName).toBe("Asha");
    expect(u.associatedWorkerIds).toEqual(["w1", "w2"]);
    expect(u.mediaUrls).toEqual(["https://x/a.jpg"]);
    expect(u.comments).toHaveLength(1);
    expect(u.isClientViewable).toBe(false);
  });
});

describe("normalizeDesign / normalizeFile / normalizeRoom", () => {
  it("normalises a design row", () => {
    const d = normalizeDesign({ id: "d1", projectId: PID, fileUrl: "https://x/p.pdf", createdAt: "2026-10-14" });
    expect(d.type).toBe("2D");
    expect(d.title).toBeNull();
    expect(d.approvalRequired).toBe(false);
    expect(d.approvalApproved).toBe(false);
  });

  it("normalises a file row and parses the size", () => {
    const f = normalizeFile({ id: "f1", projectId: PID, name: "Contract.pdf", size: "2048", uploadedAt: "2026-10-14" });
    expect(f.size).toBe(2048);
    expect(f.storagePath).toBeNull();
    expect(f.category).toBe("other");
    expect(f.version).toBe(1);
  });

  it("normalises a room row", () => {
    expect(normalizeRoom({ id: "r1", name: "Kitchen" })).toEqual({ id: "r1", name: "Kitchen", assignedWorkerIds: [] });
  });
});

describe("pagination", () => {
  const page = (n: number, prefix = "u"): ProjectUpdate[] =>
    Array.from({ length: n }, (_, i) => normalizeUpdate({ id: `${prefix}${i}`, createdAt: "2026-10-14T10:00:00Z" }));

  it("asks for the next offset only after a full page", () => {
    const first = page(UPDATES_PAGE_SIZE);
    expect(nextUpdatesOffset(first, [first])).toBe(UPDATES_PAGE_SIZE);
    const short = page(3, "s");
    expect(nextUpdatesOffset(short, [first, short])).toBeUndefined();
  });

  it("removes duplicates that shift across pages when new updates arrive", () => {
    const a = page(2, "a");
    const b = [a[1], ...page(1, "b")];
    expect(flattenUpdatePages([a, b]).map((u) => u.id)).toEqual(["a0", "a1", "b0"]);
  });
});

describe("contentCapabilities (mirrors the API's role guards)", () => {
  it("lets head and managers do everything", () => {
    for (const role of ["head", "manager"] as const) {
      const c = contentCapabilities(role);
      expect(c.postUpdate && c.deleteUpdate && c.uploadDesign && c.deleteDesign && c.uploadFile && c.deleteFile).toBe(true);
    }
  });

  it("lets workers post and comment, but not delete or manage designs/files", () => {
    const c = contentCapabilities("worker");
    expect(c.postUpdate).toBe(true);
    expect(c.commentOnUpdate).toBe(true);
    expect(c.deleteUpdate).toBe(false);
    expect(c.uploadDesign).toBe(false);
    expect(c.uploadFile).toBe(false);
    expect(c.deleteFile).toBe(false);
  });

  it("keeps clients read-only (as in the mobile app)", () => {
    const c = contentCapabilities("client");
    expect(Object.values(c).every((v) => v === false)).toBe(true);
  });
});

describe("paths and keys", () => {
  it("builds API paths under the project", () => {
    expect(contentPath.updates(PID)).toBe(`projects/${PID}/updates`);
    expect(contentPath.update(PID, "u1")).toBe(`projects/${PID}/updates/u1`);
    expect(contentPath.comments(PID, "u1")).toBe(`projects/${PID}/updates/u1/comments`);
    expect(contentPath.design(PID, "d1")).toBe(`projects/${PID}/designs/d1`);
    expect(contentPath.file(PID, "f1")).toBe(`projects/${PID}/files/f1`);
    expect(contentPath.rooms(PID)).toBe(`projects/${PID}/rooms`);
  });

  it("scopes query keys per project", () => {
    expect(contentKeys.updates(PID)).toEqual(["project-content", PID, "updates"]);
    expect(contentKeys.updates(PID)).not.toEqual(contentKeys.designs(PID));
  });
});
