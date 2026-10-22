import { describe, expect, it } from "vitest";
import type { Room } from "@/lib/api/project-ops";
import { sortRooms, validateRoomName } from "./rooms-model";

const room = (id: string, name: string): Room => ({ id, projectId: "p1", name, assignedWorkerIds: [], createdAt: "" });

describe("validateRoomName", () => {
  const rooms = [room("r1", "Master Bedroom"), room("r2", "Kitchen")];

  it("requires a name within the API limit", () => {
    expect(validateRoomName("  ", rooms)).toMatch(/Enter/);
    expect(validateRoomName("x".repeat(121), rooms)).toMatch(/120/);
    expect(validateRoomName("Living room", rooms)).toBeNull();
  });

  it("rejects duplicates regardless of case and spacing", () => {
    expect(validateRoomName(" kitchen ", rooms)).toMatch(/already/);
  });

  it("lets a room keep its own name when renaming", () => {
    expect(validateRoomName("Kitchen", rooms, "r2")).toBeNull();
  });
});

describe("sortRooms", () => {
  it("sorts by name, numerically aware", () => {
    expect(sortRooms([room("a", "Bedroom 10"), room("b", "bedroom 2"), room("c", "Attic")]).map((r) => r.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});
