import { describe, expect, it } from "vitest";
import {
  type AppNotification,
  countUnread,
  nextUnread,
  normalizeNotificationType,
  notificationHref,
  notificationKeys,
  notificationPaths,
  withAllRead,
  without,
  withoutRead,
  withRead,
} from "./notifications";

const P = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: "n1",
  title: "T",
  body: null,
  type: null,
  projectId: null,
  projectName: null,
  isRead: false,
  createdAt: "2026-10-22T10:00:00Z",
  ...over,
});

describe("notificationHref (staff)", () => {
  it.each([
    ["update", `/app/projects/${P}/updates`],
    ["design", `/app/projects/${P}/designs`],
    ["design_approval", `/app/projects/${P}/designs`],
    ["chat", `/app/projects/${P}/support`],
    ["complaint", `/app/projects/${P}/support`],
    ["task", `/app/projects/${P}/timeline`],
    ["invite", `/app/projects/${P}`],
    ["system", `/app/projects/${P}`],
  ])("%s -> %s", (type, href) => {
    expect(notificationHref(n({ type, projectId: P }), "staff")).toBe(href);
  });

  it("lead -> the lead in Sales (or the Sales list without an id)", () => {
    expect(notificationHref(n({ type: "lead", leadId: LEAD }), "staff")).toBe(`/app/sales/${LEAD}`);
    expect(notificationHref(n({ type: "lead" }), "staff")).toBe("/app/sales");
  });

  it("legacy types still land somewhere sensible", () => {
    expect(notificationHref(n({ type: "assignment", projectId: P }), "staff")).toBe(`/app/projects/${P}/timeline`);
    expect(notificationHref(n({ type: "settlement", projectId: P }), "staff")).toBe(`/app/projects/${P}/settlements`);
    expect(notificationHref(n({ type: "status_change", projectId: P }), "staff")).toBe(`/app/projects/${P}`);
  });

  it("no project and not a lead -> not a link", () => {
    expect(notificationHref(n({ type: "update" }), "staff")).toBeNull();
    expect(notificationHref(n({ type: null }), "staff")).toBeNull();
  });
});

describe("notificationHref (client portal)", () => {
  it.each([
    ["update", `/portal/projects/${P}/updates`],
    ["design", `/portal/projects/${P}/designs`],
    ["design_approval", `/portal/projects/${P}/designs`],
    ["chat", `/portal/projects/${P}#chat`],
    ["complaint", `/portal/projects/${P}#chat`],
    ["task", `/portal/projects/${P}/timeline`],
    ["system", `/portal/projects/${P}`],
    ["settlement", `/portal/projects/${P}`],
  ])("%s -> %s", (type, href) => {
    expect(notificationHref(n({ type, projectId: P }), "client")).toBe(href);
  });

  it("never links a client to Sales", () => {
    expect(notificationHref(n({ type: "lead", leadId: LEAD }), "client")).toBeNull();
  });
});

describe("notificationHref encoding", () => {
  it("encodes ids so they can't escape their path segment", () => {
    expect(notificationHref(n({ type: "update", projectId: "../staff" }), "staff")).toBe(
      "/app/projects/..%2Fstaff/updates",
    );
    expect(notificationHref(n({ type: "lead", leadId: "x?y=1" }), "staff")).toBe("/app/sales/x%3Fy%3D1");
  });
});

describe("normalizeNotificationType", () => {
  it("keeps contract types, maps legacy ones, drops unknown", () => {
    expect(normalizeNotificationType("design_approval")).toBe("design_approval");
    expect(normalizeNotificationType("assignment")).toBe("task");
    expect(normalizeNotificationType("worker")).toBeNull();
    expect(normalizeNotificationType(undefined)).toBeNull();
  });
});

describe("paths + keys", () => {
  it("matches the API routes", () => {
    expect(notificationPaths.readAll).toBe("notifications/read-all");
    expect(notificationPaths.read("a/b")).toBe("notifications/a%2Fb/read");
    expect(notificationPaths.one("n1")).toBe("notifications/n1");
    expect(notificationPaths.clearRead).toBe("notifications");
  });

  it("list and badge share the prefix one invalidation refreshes", () => {
    expect(notificationKeys.list.slice(0, 1)).toEqual(notificationKeys.all);
    expect(notificationKeys.unreadCount.slice(0, 1)).toEqual(notificationKeys.all);
  });
});

describe("optimistic transforms", () => {
  const list = [n({ id: "a" }), n({ id: "b", isRead: true }), n({ id: "c" })];

  it("mark one / all read", () => {
    expect(countUnread(withRead(list, ["a"]))).toBe(1);
    expect(withRead(list, ["b"])[1]).toBe(list[1]); // untouched rows keep identity
    expect(countUnread(withAllRead(list))).toBe(0);
  });

  it("delete one / clear read", () => {
    expect(without(list, "b").map((x) => x.id)).toEqual(["a", "c"]);
    expect(withoutRead(list).map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("adjusts the server badge by the change, not the visible list size", () => {
    // Badge counts all unread (can exceed the 100 the list shows).
    expect(nextUnread({ unread: 150 }, list, withRead(list, ["a"]))).toEqual({ unread: 149 });
    expect(nextUnread({ unread: 150 }, list, without(list, "b"))).toEqual({ unread: 150 });
    expect(nextUnread({ unread: 1 }, list, withAllRead(list))).toEqual({ unread: 0 });
    expect(nextUnread(undefined, list, list)).toBeUndefined();
    expect(nextUnread({ unread: 3 }, undefined, undefined)).toEqual({ unread: 3 });
  });
});
