import { describe, expect, it } from "vitest";
import {
  UPDATE_CATEGORIES,
  buildCreateUpdateBody,
  canSubmitUpdate,
  taggedPeople,
  updateTypeFor,
  type ComposerValues,
} from "./update-meta";

const values = (over: Partial<ComposerValues> = {}): ComposerValues => ({
  text: "  Tiling finished in the kitchen  ",
  category: null,
  roomId: null,
  workerIds: [],
  clientVisible: true,
  ...over,
});

describe("UPDATE_CATEGORIES", () => {
  it("matches the mobile app's list", () => {
    expect(UPDATE_CATEGORIES[0]).toBe("General");
    expect(UPDATE_CATEGORIES).toContain("Fall Ceiling");
    expect(UPDATE_CATEGORIES).toHaveLength(15);
  });
});

describe("updateTypeFor", () => {
  it("derives the update type from its media", () => {
    expect(updateTypeFor([])).toBe("message");
    expect(updateTypeFor(["image", "image"])).toBe("photo");
    expect(updateTypeFor(["video"])).toBe("video");
  });
});

describe("canSubmitUpdate", () => {
  it("needs text or at least one attachment", () => {
    expect(canSubmitUpdate("   ", 0)).toBe(false);
    expect(canSubmitUpdate("hi", 0)).toBe(true);
    expect(canSubmitUpdate("", 2)).toBe(true);
  });
});

describe("buildCreateUpdateBody", () => {
  it("trims text and omits empty optional fields", () => {
    expect(buildCreateUpdateBody(values(), [], [])).toEqual({
      type: "message",
      content: "Tiling finished in the kitchen",
      isClientViewable: true,
    });
  });

  it("sends refs, category, room, tagged workers and visibility", () => {
    const body = buildCreateUpdateBody(
      values({ category: "Tiles", roomId: "r1", workerIds: ["w1", "w1", "w2"], clientVisible: false }),
      ["sb://update-images/projects/p/updates/a.jpg", "sb://update-images/projects/p/updates/b.jpg"],
      ["image", "image"],
    );
    expect(body).toEqual({
      type: "photo",
      content: "Tiling finished in the kitchen",
      category: "Tiles",
      roomId: "r1",
      associatedWorkerIds: ["w1", "w2"],
      mediaUrls: ["sb://update-images/projects/p/updates/a.jpg", "sb://update-images/projects/p/updates/b.jpg"],
      isClientViewable: false,
    });
  });

  it("omits visibility when the poster may not set it", () => {
    const body = buildCreateUpdateBody(values({ clientVisible: false }), [], [], { canSetVisibility: false });
    expect(body).not.toHaveProperty("isClientViewable");
  });
});

describe("taggedPeople", () => {
  it("resolves names it knows and counts the rest", () => {
    const directory = new Map([
      ["w1", { id: "w1", name: "Asha" }],
      ["w2", { id: "w2", name: "Ravi" }],
    ]);
    expect(taggedPeople(["w2", "w9", "w1"], directory)).toEqual({
      people: [
        { id: "w2", name: "Ravi" },
        { id: "w1", name: "Asha" },
      ],
      unknown: 1,
    });
  });
});
