import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { ChatMessage } from "@/lib/api/project-ops";
import {
  CHAT_POLL_MS,
  acceptAttachments,
  attachmentKind,
  attachmentName,
  canManageComplaints,
  canRaiseComplaint,
  chatRefetchInterval,
  checkAttachment,
  complaintCounts,
  complaintFormSchema,
  mergeMessages,
  messageTypeFor,
  nextComplaintStatuses,
  normalizeComplaintStatus,
  senderRoleLabel,
  sortComplaints,
  validateComplaintUpdate,
} from "./support-model";

function msg(id: string, createdAt: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    projectId: "p1",
    senderId: "u1",
    senderName: "Anand",
    senderRole: "CLIENT",
    content: `message ${id}`,
    messageType: "text",
    attachmentUrls: [],
    createdAt,
    ...overrides,
  };
}

describe("chatRefetchInterval", () => {
  it("polls every ~8 s while the page is visible", () => {
    expect(chatRefetchInterval({ visible: true })).toBe(CHAT_POLL_MS);
    expect(CHAT_POLL_MS).toBeGreaterThanOrEqual(5_000);
    expect(CHAT_POLL_MS).toBeLessThanOrEqual(10_000);
  });

  it("pauses while the tab is hidden", () => {
    expect(chatRefetchInterval({ visible: false })).toBe(false);
  });

  it("stops polling after an auth/access error instead of hammering the API", () => {
    expect(chatRefetchInterval({ visible: true, error: new ApiError(403, "") })).toBe(false);
    expect(chatRefetchInterval({ visible: true, error: new ApiError(401, "") })).toBe(false);
    expect(chatRefetchInterval({ visible: true, error: new ApiError(404, "") })).toBe(false);
  });

  it("keeps polling through transient failures (network, 5xx, 429)", () => {
    expect(chatRefetchInterval({ visible: true, error: new ApiError(503, "") })).toBe(CHAT_POLL_MS);
    expect(chatRefetchInterval({ visible: true, error: new ApiError(0, "") })).toBe(CHAT_POLL_MS);
    expect(chatRefetchInterval({ visible: true, error: new ApiError(429, "") })).toBe(CHAT_POLL_MS * 3);
  });
});

describe("mergeMessages", () => {
  it("dedupes by id and orders oldest first (API pages arrive newest first)", () => {
    const latest = [msg("c", "2026-10-14T10:02:00Z"), msg("b", "2026-10-14T10:01:00Z")];
    const older = [msg("b", "2026-10-14T10:01:00Z"), msg("a", "2026-10-14T10:00:00Z")];
    expect(mergeMessages(latest, older).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("prefers the copy from the earlier list (fresh poll beats a stale page)", () => {
    const fresh = [msg("a", "2026-10-14T10:00:00Z", { content: "edited" })];
    const stale = [msg("a", "2026-10-14T10:00:00Z", { content: "old" })];
    expect(mergeMessages(fresh, stale)[0].content).toBe("edited");
  });
});

describe("senderRoleLabel", () => {
  it("maps stored upper-case roles to labels", () => {
    expect(senderRoleLabel("HEAD")).toBe("Admin");
    expect(senderRoleLabel("manager")).toBe("Manager");
    expect(senderRoleLabel("CLIENT")).toBe("Client");
    expect(senderRoleLabel(null)).toBe("");
  });
});

describe("attachments", () => {
  it("accepts images and PDFs up to the size limit", () => {
    expect(checkAttachment({ name: "site.JPG", size: 1024 })).toBeNull();
    expect(checkAttachment({ name: "quote.pdf", size: 1024 })).toBeNull();
    expect(checkAttachment({ name: "notes.docx", size: 1024 })).toMatch(/images or PDF/);
    expect(checkAttachment({ name: "huge.pdf", size: 60 * 1024 * 1024 })).toMatch(/too large/);
  });

  it("derives the message type like the mobile app (image / file / text)", () => {
    expect(messageTypeFor([])).toBe("text");
    expect(messageTypeFor(["a.jpg", "b.png"])).toBe("image");
    expect(messageTypeFor(["a.jpg", "b.pdf"])).toBe("file");
  });

  it("names and classifies signed URLs without their token or random prefix", () => {
    const url =
      "https://x.supabase.co/storage/v1/object/sign/project-files/projects/p1/support/chat/ab12cd34-site-photo.jpg?token=t";
    expect(attachmentName(url)).toBe("site-photo.jpg");
    expect(attachmentKind(url)).toBe("image");
    expect(attachmentKind("https://s/x/report.pdf?token=1")).toBe("pdf");
    expect(attachmentName("https://firebasestorage.googleapis.com/v0/b/app/o/projects%2Fp1%2Fchat%2Fplan.pdf?alt=media")).toBe(
      "plan.pdf",
    );
  });
});

describe("acceptAttachments", () => {
  const f = (name: string, size = 10) => ({ name, size });

  it("adds valid files and reports rejected ones", () => {
    const { files, errors } = acceptAttachments([f("a.jpg")], [f("b.pdf"), f("c.exe")]);
    expect(files.map((x) => x.name)).toEqual(["a.jpg", "b.pdf"]);
    expect(errors).toHaveLength(1);
  });

  it("stops at the attachment limit", () => {
    const { files, errors } = acceptAttachments([f("a.jpg")], [f("b.jpg"), f("c.jpg")], 2);
    expect(files.map((x) => x.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(errors).toEqual(["You can attach up to 2 files."]);
  });
});

describe("complaint statuses", () => {
  it("normalises unknown values to open", () => {
    expect(normalizeComplaintStatus("inProgress")).toBe("inProgress");
    expect(normalizeComplaintStatus("pending")).toBe("open");
  });

  it("offers the transitions staff can make from each status", () => {
    expect(nextComplaintStatuses("open")).toEqual(["inProgress", "resolved", "closed"]);
    expect(nextComplaintStatuses("inProgress")).toEqual(["open", "resolved", "closed"]);
    expect(nextComplaintStatuses("resolved")).toEqual(["open", "closed"]);
    expect(nextComplaintStatuses("closed")).toEqual(["open"]);
  });

  it("requires a resolution note to resolve or close", () => {
    expect(validateComplaintUpdate({ current: "open", next: "resolved", note: " " })).toMatch(/resolution note/);
    expect(validateComplaintUpdate({ current: "open", next: "closed", note: "" })).toMatch(/resolution note/);
    expect(validateComplaintUpdate({ current: "open", next: "resolved", note: "Fixed the leak." })).toBeNull();
    expect(validateComplaintUpdate({ current: "open", next: "inProgress", note: "" })).toBeNull();
  });

  it("rejects transitions that aren't allowed and no-op updates", () => {
    expect(validateComplaintUpdate({ current: "closed", next: "resolved", note: "x" })).toMatch(/can't move/);
    expect(validateComplaintUpdate({ current: "open", next: "open", note: "", previousNote: "" })).toMatch(/Nothing/);
    expect(validateComplaintUpdate({ current: "resolved", next: "resolved", note: "Better note", previousNote: "x" })).toBeNull();
  });

  it("limits the note length", () => {
    expect(validateComplaintUpdate({ current: "open", next: "resolved", note: "x".repeat(2001) })).toMatch(/2000/);
  });

  it("counts complaints by status", () => {
    expect(complaintCounts([{ status: "open" }, { status: "open" }, { status: "resolved" }, { status: "weird" }])).toEqual({
      open: 3,
      inProgress: 0,
      resolved: 1,
      closed: 0,
    });
  });

  it("lets head/manager manage complaints, and clients/head/manager raise them", () => {
    expect(canManageComplaints("head")).toBe(true);
    expect(canManageComplaints("manager")).toBe(true);
    expect(canManageComplaints("worker")).toBe(false);
    expect(canManageComplaints("client")).toBe(false);
    expect(canRaiseComplaint("client")).toBe(true);
    expect(canRaiseComplaint("worker")).toBe(false);
  });
});

describe("complaintFormSchema", () => {
  it("needs a title and trims the text", () => {
    expect(complaintFormSchema.safeParse({ title: " ", description: "" }).success).toBe(false);
    expect(complaintFormSchema.parse({ title: " Leak ", description: " Under the sink " })).toEqual({
      title: "Leak",
      description: "Under the sink",
    });
  });

  it("enforces the API limits", () => {
    expect(complaintFormSchema.safeParse({ title: "x".repeat(301), description: "" }).success).toBe(false);
    expect(complaintFormSchema.safeParse({ title: "x", description: "y".repeat(5001) }).success).toBe(false);
  });
});

describe("sortComplaints", () => {
  it("puts open/in-progress first, newest first within each group", () => {
    const list = [
      { id: "1", status: "resolved", createdAt: "2026-10-10T00:00:00Z" },
      { id: "2", status: "open", createdAt: "2026-10-01T00:00:00Z" },
      { id: "3", status: "inProgress", createdAt: "2026-10-05T00:00:00Z" },
      { id: "4", status: "closed", createdAt: "2026-10-12T00:00:00Z" },
    ];
    expect(sortComplaints(list).map((c) => c.id)).toEqual(["3", "2", "4", "1"]);
  });
});
