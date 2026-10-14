import { ROOM_NAME_MAX, type Room } from "@/lib/api/project-ops";

const collator = new Intl.Collator("en-IN", { sensitivity: "base", numeric: true });

export function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => collator.compare(a.name, b.name));
}

/** null when valid. `editingId` is the room being renamed (it may keep its own name). */
export function validateRoomName(name: string, rooms: Room[], editingId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a room name.";
  if (trimmed.length > ROOM_NAME_MAX) return `Use at most ${ROOM_NAME_MAX} characters.`;
  const clash = rooms.some((r) => r.id !== editingId && collator.compare(r.name.trim(), trimmed) === 0);
  return clash ? "A room with this name already exists." : null;
}
