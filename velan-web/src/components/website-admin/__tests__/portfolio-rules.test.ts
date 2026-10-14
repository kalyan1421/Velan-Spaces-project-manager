import { describe, expect, it } from "vitest";
import type { PortfolioItem } from "@/lib/api/types";
import {
  applyOrder,
  canViewOnSite,
  commitFinishedUploads,
  countByStatus,
  coverOf,
  filterByStatus,
  moveId,
  moveInArray,
  moveToTarget,
  planImageUploads,
  previewSlug,
  publicPath,
  resolveImageContentType,
  slugify,
  uniqueSlug,
  validateSlug,
  type PendingUpload,
} from "../portfolio-rules";

function item(overrides: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "modern-villa",
    title: "Modern Villa",
    description: null,
    category: "residential",
    location: null,
    completionYear: null,
    coverImageUrl: null,
    imageUrls: [],
    status: "draft",
    sortOrder: 0,
    projectId: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const MB = 1024 * 1024;

function file(name: string, type: string, size = 1 * MB, lastModified = 1) {
  return { name, type, size, lastModified };
}

// ---------------------------------------------------------------- slugs (mirror the API)

describe("slugify (mirrors the API's website.util)", () => {
  it.each([
    ["Modern Villa in Chennai", "modern-villa-in-chennai"],
    ["  lots   of\twhitespace\n ", "lots-of-whitespace"],
    ["Café Résidence", "cafe-residence"],
    ["Kitchen & Dining", "kitchen-and-dining"],
    ["🏠 Villa ✨ 2024 🎉", "villa-2024"],
    ["--Already--dashed--", "already-dashed"],
    ["UPPER_case.Title", "upper-case-title"],
  ])("%j -> %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("returns an empty string when nothing slug-safe remains", () => {
    expect(slugify("🏠🎉")).toBe("");
    expect(slugify("வீடு")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("caps the length at 80 and never ends with a dash", () => {
    const s = slugify("word ".repeat(60));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
    expect(validateSlug(s)).toBeNull();
  });
});

describe("uniqueSlug", () => {
  it("keeps the base when it is free", () => {
    expect(uniqueSlug("villa", ["other"])).toBe("villa");
  });

  it("adds the first free numeric suffix", () => {
    expect(uniqueSlug("villa", ["villa", "villa-2"])).toBe("villa-3");
  });

  it("trims a long base so the suffixed slug still fits", () => {
    const base = "a".repeat(80);
    const s = uniqueSlug(base, [base]);
    expect(s).toBe(`${"a".repeat(78)}-2`);
    expect(s.length).toBe(80);
  });
});

describe("previewSlug", () => {
  it("is what the API will generate for a new item", () => {
    expect(previewSlug("Modern Villa", [])).toBe("modern-villa");
    expect(previewSlug("Modern Villa", ["modern-villa"])).toBe("modern-villa-2");
  });

  it("falls back to 'project' when the title has no usable characters", () => {
    expect(previewSlug("🏠", [])).toBe("project");
    expect(previewSlug("", ["project"])).toBe("project-2");
  });
});

describe("validateSlug", () => {
  it("accepts lowercase words separated by single dashes", () => {
    expect(validateSlug("modern-villa-2024")).toBeNull();
    expect(validateSlug("a")).toBeNull();
  });

  it.each([
    ["", "Enter a web address"],
    ["Modern-Villa", "lowercase"],
    ["modern--villa", "lowercase"],
    ["-villa", "lowercase"],
    ["villa-", "lowercase"],
    ["villa house", "lowercase"],
  ])("rejects %j", (slug, message) => {
    expect(validateSlug(slug)).toContain(message);
  });

  it("rejects slugs longer than 80 characters", () => {
    expect(validateSlug("a".repeat(81))).toContain("80");
  });
});

describe("publicPath / canViewOnSite", () => {
  it("builds the public portfolio URL", () => {
    expect(publicPath("modern-villa")).toBe("/portfolio/modern-villa");
  });

  it("only offers 'View on site' for published items", () => {
    expect(canViewOnSite(item({ status: "published" }))).toBe(true);
    expect(canViewOnSite(item({ status: "draft" }))).toBe(false);
    expect(canViewOnSite(item({ status: "hidden" }))).toBe(false);
  });
});

describe("coverOf", () => {
  it("prefers the cover, then the first gallery photo", () => {
    expect(coverOf(item({ coverImageUrl: "c", imageUrls: ["g1"] }))).toBe("c");
    expect(coverOf(item({ imageUrls: ["g1", "g2"] }))).toBe("g1");
    expect(coverOf(item())).toBeNull();
  });
});

// ---------------------------------------------------------------- status filter

describe("countByStatus", () => {
  it("counts every status and the total", () => {
    const items = [
      item({ id: "1", status: "published" }),
      item({ id: "2", status: "published" }),
      item({ id: "3", status: "draft" }),
      item({ id: "4", status: "hidden" }),
    ];
    expect(countByStatus(items)).toEqual({ all: 4, published: 2, draft: 1, hidden: 1 });
  });

  it("returns zeros for an empty list", () => {
    expect(countByStatus([])).toEqual({ all: 0, published: 0, draft: 0, hidden: 0 });
  });
});

describe("filterByStatus", () => {
  const items = [item({ id: "1", status: "published" }), item({ id: "2", status: "draft" })];

  it("returns everything for 'all'", () => {
    expect(filterByStatus(items, "all")).toHaveLength(2);
  });

  it("keeps only the chosen status, in order", () => {
    expect(filterByStatus(items, "draft").map((i) => i.id)).toEqual(["2"]);
  });
});

// ---------------------------------------------------------------- reorder

describe("moveId", () => {
  const ids = ["a", "b", "c", "d"];

  it("moves an item up one place", () => {
    expect(moveId(ids, "c", "up")).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item down one place", () => {
    expect(moveId(ids, "b", "down")).toEqual(["a", "c", "b", "d"]);
  });

  it("returns the same order at the edges or for unknown ids", () => {
    expect(moveId(ids, "a", "up")).toEqual(ids);
    expect(moveId(ids, "d", "down")).toEqual(ids);
    expect(moveId(ids, "zz", "up")).toEqual(ids);
  });

  it("does not mutate the input", () => {
    const copy = [...ids];
    moveId(ids, "c", "up");
    expect(ids).toEqual(copy);
  });

  it("jumps over items hidden by a filter (moves past the previous visible one)", () => {
    // Visible (published): a, c, d. Moving d up should land it before c, not before b.
    expect(moveId(ids, "d", "up", ["a", "c", "d"])).toEqual(["a", "b", "d", "c"]);
    // Moving a down should land it after c.
    expect(moveId(ids, "a", "down", ["a", "c", "d"])).toEqual(["b", "c", "a", "d"]);
  });

  it("returns the same order when the item is the first/last visible one", () => {
    expect(moveId(ids, "c", "up", ["c", "d"])).toEqual(ids);
  });
});

describe("moveToTarget (drag and drop)", () => {
  const ids = ["a", "b", "c", "d"];

  it("drops an item onto a later item's position", () => {
    expect(moveToTarget(ids, "a", "c")).toEqual(["b", "c", "a", "d"]);
  });

  it("drops an item onto an earlier item's position", () => {
    expect(moveToTarget(ids, "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("is a no-op for the same or unknown ids", () => {
    expect(moveToTarget(ids, "b", "b")).toEqual(ids);
    expect(moveToTarget(ids, "x", "b")).toEqual(ids);
  });
});

describe("applyOrder", () => {
  it("orders items by the ids and sets sortOrder to the index", () => {
    const items = [item({ id: "a", sortOrder: 0 }), item({ id: "b", sortOrder: 1 }), item({ id: "c", sortOrder: 2 })];
    const result = applyOrder(items, ["c", "a", "b"]);
    expect(result.map((i) => [i.id, i.sortOrder])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("keeps items missing from the ids at the end", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    expect(applyOrder(items, ["b"]).map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("moveInArray", () => {
  it("swaps with the neighbour", () => {
    expect(moveInArray(["x", "y", "z"], 0, 1)).toEqual(["y", "x", "z"]);
    expect(moveInArray(["x", "y", "z"], 2, -1)).toEqual(["x", "z", "y"]);
  });

  it("ignores moves past either end", () => {
    expect(moveInArray(["x", "y"], 0, -1)).toEqual(["x", "y"]);
    expect(moveInArray(["x", "y"], 1, 1)).toEqual(["x", "y"]);
  });
});

// ---------------------------------------------------------------- uploads

describe("resolveImageContentType", () => {
  it("accepts the four image types the API allows", () => {
    expect(resolveImageContentType(file("a.jpg", "image/jpeg"))).toBe("image/jpeg");
    expect(resolveImageContentType(file("a.png", "image/png"))).toBe("image/png");
    expect(resolveImageContentType(file("a.webp", "image/webp"))).toBe("image/webp");
    expect(resolveImageContentType(file("a.avif", "image/avif"))).toBe("image/avif");
  });

  it("falls back to the extension when the browser gives no type", () => {
    expect(resolveImageContentType(file("Living Room.JPEG", ""))).toBe("image/jpeg");
    expect(resolveImageContentType(file("plan.avif", ""))).toBe("image/avif");
  });

  it("rejects anything else", () => {
    expect(resolveImageContentType(file("photo.heic", "image/heic"))).toBeNull();
    expect(resolveImageContentType(file("anim.gif", "image/gif"))).toBeNull();
    expect(resolveImageContentType(file("doc.pdf", "application/pdf"))).toBeNull();
    expect(resolveImageContentType(file("noext", ""))).toBeNull();
  });
});

describe("planImageUploads", () => {
  it("accepts valid images with their content type", () => {
    const plan = planImageUploads([file("a.jpg", "image/jpeg"), file("b.png", "image/png")], {
      existingCount: 0,
      seenKeys: new Set(),
    });
    expect(plan.accepted.map((a) => [a.file.name, a.contentType, a.resize])).toEqual([
      ["a.jpg", "image/jpeg", false],
      ["b.png", "image/png", false],
    ]);
    expect(plan.rejected).toEqual([]);
  });

  it("rejects unsupported types with a reason", () => {
    const plan = planImageUploads([file("a.heic", "image/heic")], { existingCount: 0, seenKeys: new Set() });
    expect(plan.accepted).toEqual([]);
    expect(plan.rejected[0].name).toBe("a.heic");
    expect(plan.rejected[0].reason).toMatch(/JPEG, PNG, WebP or AVIF/);
  });

  it("marks oversize JPEG/PNG/WebP files for resizing and rejects oversize AVIF", () => {
    const plan = planImageUploads(
      [file("big.jpg", "image/jpeg", 12 * MB), file("big.avif", "image/avif", 12 * MB)],
      { existingCount: 0, seenKeys: new Set() },
    );
    expect(plan.accepted.map((a) => [a.file.name, a.resize])).toEqual([["big.jpg", true]]);
    expect(plan.rejected.map((r) => r.name)).toEqual(["big.avif"]);
    expect(plan.rejected[0].reason).toMatch(/10 MB/);
  });

  it("accepts a file of exactly 10 MB without resizing", () => {
    const plan = planImageUploads([file("edge.png", "image/png", 10 * MB)], { existingCount: 0, seenKeys: new Set() });
    expect(plan.accepted[0].resize).toBe(false);
  });

  it("rejects empty files", () => {
    const plan = planImageUploads([file("empty.jpg", "image/jpeg", 0)], { existingCount: 0, seenKeys: new Set() });
    expect(plan.rejected[0].reason).toMatch(/empty/i);
  });

  it("skips duplicates within the selection and against earlier uploads", () => {
    const a = file("a.jpg", "image/jpeg", 2 * MB, 100);
    const plan = planImageUploads([a, { ...a }, file("b.jpg", "image/jpeg", 3 * MB, 200)], {
      existingCount: 0,
      seenKeys: new Set(["b.jpg|3145728|200"]),
    });
    expect(plan.accepted.map((x) => x.file.name)).toEqual(["a.jpg"]);
    expect(plan.rejected.map((r) => r.reason)).toEqual([
      expect.stringMatching(/already added/i),
      expect.stringMatching(/already added/i),
    ]);
  });

  it("stops at the 40-photo limit, counting photos already in the gallery", () => {
    const files = Array.from({ length: 5 }, (_, i) => file(`p${i}.jpg`, "image/jpeg", MB, i));
    const plan = planImageUploads(files, { existingCount: 38, seenKeys: new Set() });
    expect(plan.accepted.map((a) => a.file.name)).toEqual(["p0.jpg", "p1.jpg"]);
    expect(plan.rejected).toHaveLength(3);
    expect(plan.rejected[0].reason).toMatch(/40/);
  });

  it("accepts only one file when asked for a single upload (cover)", () => {
    const plan = planImageUploads([file("a.jpg", "image/jpeg"), file("b.jpg", "image/jpeg", MB, 2)], {
      existingCount: 0,
      seenKeys: new Set(),
      max: 1,
    });
    expect(plan.accepted).toHaveLength(1);
    expect(plan.rejected).toHaveLength(1);
  });
});

describe("commitFinishedUploads", () => {
  function p(key: string, status: PendingUpload["status"], url?: string): PendingUpload {
    return { key, name: key, status, progress: status === "done" ? 1 : 0, url };
  }

  it("commits finished uploads in selection order", () => {
    const { committed, remaining } = commitFinishedUploads([p("a", "done", "ua"), p("b", "done", "ub")]);
    expect(committed).toEqual(["ua", "ub"]);
    expect(remaining).toEqual([]);
  });

  it("holds finished uploads that come after one still uploading", () => {
    const { committed, remaining } = commitFinishedUploads([
      p("a", "done", "ua"),
      p("b", "uploading"),
      p("c", "done", "uc"),
    ]);
    expect(committed).toEqual(["ua"]);
    expect(remaining.map((x) => x.key)).toEqual(["b", "c"]);
  });

  it("does not let a failed upload block the ones after it", () => {
    const { committed, remaining } = commitFinishedUploads([p("a", "error"), p("b", "done", "ub")]);
    expect(committed).toEqual(["ub"]);
    expect(remaining.map((x) => x.key)).toEqual(["a"]);
  });
});
