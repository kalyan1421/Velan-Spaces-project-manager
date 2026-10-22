import { describe, expect, it } from "vitest";
import { normalizeDesign } from "@/lib/api/project-content";
import { ensureApprovalDesigns, normalizeApprovalDesign } from "./design-api";
import {
  approvalCounts,
  approvalStateOf,
  approvalSummary,
  awaitingClientDecision,
  clientCanDecide,
  designGroupOf,
  designTitle,
  designTitlesFor,
  groupDesigns,
  numberedTitles,
  portalGalleryDesigns,
  splitDocuments,
  titleFromFileName,
  validateDecisionComment,
  withDecision,
} from "./design-utils";

const design = (over: Record<string, unknown>) =>
  normalizeDesign({ id: "d", projectId: "p", createdAt: "2026-10-14T10:00:00Z", ...over });

/** A row as the API returns it now (R-E4), through the approval-aware normalizer. */
const approval = (over: Record<string, unknown>) =>
  normalizeApprovalDesign({ id: "d", projectId: "p", createdAt: "2026-10-14T10:00:00Z", ...over });

describe("designGroupOf", () => {
  it("understands current and legacy type values", () => {
    expect(designGroupOf("2D")).toBe("2d");
    expect(designGroupOf("2D Plan")).toBe("2d");
    expect(designGroupOf("3D")).toBe("3d");
    expect(designGroupOf("3D Render")).toBe("3d");
    expect(designGroupOf("Quotation")).toBe("quotation");
    expect(designGroupOf("Elevation")).toBe("other");
    expect(designGroupOf("")).toBe("other");
  });
});

describe("groupDesigns", () => {
  it("returns non-empty groups in a fixed order, keeping item order", () => {
    const groups = groupDesigns([
      design({ id: "a", type: "3D Render" }),
      design({ id: "b", type: "2D Plan" }),
      design({ id: "c", type: "3D" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["2d", "3d"]);
    expect(groups[1].items.map((d) => d.id)).toEqual(["a", "c"]);
  });
});

describe("splitDocuments", () => {
  it("separates quotation PDFs from design drawings (client Documents section)", () => {
    const { designs, quotations } = splitDocuments([
      design({ id: "q", type: "Quotation" }),
      design({ id: "d", type: "2D" }),
    ]);
    expect(designs.map((d) => d.id)).toEqual(["d"]);
    expect(quotations.map((d) => d.id)).toEqual(["q"]);
  });
});

describe("titles", () => {
  it("numbers a shared title only when there are several files", () => {
    expect(numberedTitles("Kitchen", 1)).toEqual(["Kitchen"]);
    expect(numberedTitles("Kitchen", 3)).toEqual(["Kitchen (1)", "Kitchen (2)", "Kitchen (3)"]);
    expect(numberedTitles("Kitchen", 0)).toEqual([]);
  });

  it("derives a readable title from a file name", () => {
    expect(titleFromFileName("master_bedroom-3d.render.PNG")).toBe("master bedroom 3d.render");
    expect(titleFromFileName(".pdf")).toBe("Untitled design");
  });

  it("uses each file's own name when no title is typed", () => {
    expect(designTitlesFor("  ", ["Living room.pdf", "kitchen_plan.jpg"])).toEqual(["Living room", "kitchen plan"]);
  });

  it("uses the typed title (numbered) when given", () => {
    expect(designTitlesFor("Ground floor", ["a.pdf", "b.pdf"])).toEqual(["Ground floor (1)", "Ground floor (2)"]);
  });

  it("caps titles at the API's 300 characters", () => {
    expect(designTitlesFor("x".repeat(400), ["a.pdf", "b.pdf"])[1].length).toBeLessThanOrEqual(300);
  });
});

describe("designTitle", () => {
  it("falls back to the stored file name", () => {
    expect(designTitle(design({ title: "Plan A" }))).toBe("Plan A");
    expect(designTitle(design({ fileUrl: "https://x/storage/v1/object/sign/designs/p/0a1b2c3d-plan-b.pdf?token=t" }))).toBe(
      "plan-b.pdf",
    );
    expect(designTitle(design({}))).toBe("Untitled design");
  });
});

describe("approvalStateOf", () => {
  it("maps the legacy approval flags (rows without a status)", () => {
    expect(approvalStateOf(design({}))).toBe("not-required");
    expect(approvalStateOf(design({ approvalRequired: true }))).toBe("pending");
    expect(approvalStateOf(design({ approvalRequired: true, approvalApproved: true }))).toBe("approved");
    expect(approvalStateOf(design({ approvalApproved: true }))).toBe("approved");
  });

  it("maps the approval status", () => {
    expect(approvalStateOf(approval({ approvalRequired: true, approvalStatus: "pending" }))).toBe("pending");
    expect(approvalStateOf(approval({ approvalRequired: true, approvalStatus: "approved" }))).toBe("approved");
    expect(approvalStateOf(approval({ approvalRequired: true, approvalStatus: "changes_requested" }))).toBe(
      "changes-requested",
    );
  });

  it("keeps showing an approval after approval is no longer required, but not a stale change request", () => {
    expect(approvalStateOf(approval({ approvalRequired: false, approvalStatus: "approved" }))).toBe("approved");
    expect(approvalStateOf(approval({ approvalRequired: false, approvalStatus: "changes_requested" }))).toBe(
      "not-required",
    );
    expect(approvalStateOf(approval({ approvalRequired: false, approvalStatus: "pending" }))).toBe("not-required");
  });

  it("lets the client decide only while a decision is open", () => {
    expect(clientCanDecide(approval({ approvalRequired: true }))).toBe(true);
    expect(clientCanDecide(approval({ approvalRequired: true, approvalStatus: "changes_requested" }))).toBe(true);
    expect(clientCanDecide(approval({ approvalRequired: true, approvalStatus: "approved" }))).toBe(false);
    expect(clientCanDecide(approval({ approvalRequired: false }))).toBe(false);
  });
});

describe("normalizeApprovalDesign", () => {
  it("reads the approval record", () => {
    const d = approval({
      approvalRequired: true,
      approvalStatus: "changes_requested",
      approvalApproved: false,
      approvalComment: "Wider door",
      approvalDecidedAt: "2026-10-20T08:00:00Z",
      approvalDecidedBy: "u1",
      approvalDecidedByName: "Asha",
    });
    expect(d).toMatchObject({
      approvalStatus: "changes_requested",
      approvalApproved: false,
      approvalComment: "Wider door",
      approvalDecidedAt: "2026-10-20T08:00:00Z",
      approvalDecidedBy: "u1",
      approvalDecidedByName: "Asha",
    });
  });

  it("falls back to the boolean when the API has no status, and ignores unknown statuses", () => {
    expect(approval({ approvalApproved: true }).approvalStatus).toBe("approved");
    expect(approval({}).approvalStatus).toBe("pending");
    expect(approval({ approvalStatus: "rejected", approvalApproved: true }).approvalStatus).toBe("approved");
    expect(approval({ approvalComment: "  " }).approvalComment).toBeNull();
  });

  it("the status wins over a stale boolean", () => {
    const d = approval({ approvalStatus: "changes_requested", approvalApproved: true });
    expect(d.approvalApproved).toBe(false);
  });

  it("upgrades rows from the older normalizer", () => {
    const [d] = ensureApprovalDesigns([design({ approvalRequired: true, approvalApproved: true })]);
    expect(d.approvalStatus).toBe("approved");
    const already = approval({ approvalStatus: "changes_requested", approvalRequired: true });
    expect(ensureApprovalDesigns([already])[0]).toBe(already);
  });
});

describe("approval lists", () => {
  const list = [
    approval({ id: "new", approvalRequired: true, createdAt: "2026-10-20T00:00:00Z" }),
    approval({ id: "old", approvalRequired: true, createdAt: "2026-10-01T00:00:00Z" }),
    approval({ id: "chg", approvalRequired: true, approvalStatus: "changes_requested" }),
    approval({ id: "ok", approvalRequired: true, approvalStatus: "approved" }),
    approval({ id: "legacy-ok", approvalApproved: true }),
    approval({ id: "free" }),
  ];

  it("lists designs waiting for the client's first decision, oldest first", () => {
    expect(awaitingClientDecision(list).map((d) => d.id)).toEqual(["old", "new"]);
  });

  it("counts states for the staff summary (only approvals that were asked for)", () => {
    expect(approvalCounts(list)).toEqual({ pending: 2, changesRequested: 1, approved: 1 });
  });

  it("portal gallery hides quotations unless the client must approve one", () => {
    const shown = portalGalleryDesigns([
      approval({ id: "q", type: "Quotation" }),
      approval({ id: "qa", type: "Quotation", approvalRequired: true }),
      approval({ id: "p", type: "2D Plan" }),
    ]);
    expect(shown.map((d) => d.id)).toEqual(["qa", "p"]);
  });
});

describe("approvalSummary", () => {
  const decided = (status: string) =>
    approval({
      approvalRequired: true,
      approvalStatus: status,
      approvalDecidedAt: "2026-10-20T08:00:00Z",
      approvalDecidedByName: "Asha Raman",
    });

  it("names the client for staff and says 'You' to the client", () => {
    expect(approvalSummary(decided("approved"), "staff")).toBe("Approved by Asha Raman · 20 Oct 2026");
    expect(approvalSummary(decided("approved"), "client")).toBe("You approved this · 20 Oct 2026");
    expect(approvalSummary(decided("changes_requested"), "staff")).toBe("Changes requested by Asha Raman · 20 Oct 2026");
    expect(approvalSummary(decided("changes_requested"), "client")).toBe("You asked for changes · 20 Oct 2026");
  });

  it("describes waiting designs and stays quiet otherwise", () => {
    expect(approvalSummary(approval({ approvalRequired: true }), "staff")).toBe("Waiting for the client");
    expect(approvalSummary(approval({ approvalRequired: true }), "client")).toBe("Waiting for your approval");
    expect(approvalSummary(approval({}), "staff")).toBeNull();
    // Approved under the old boolean-only model: no record to show.
    expect(approvalSummary(approval({ approvalApproved: true }), "staff")).toBeNull();
    expect(approvalSummary(approval({ approvalStatus: "changes_requested", approvalRequired: true }), "staff")).toBe(
      "Changes requested by the client",
    );
  });
});

describe("validateDecisionComment", () => {
  it("requires a comment to request changes, not to approve", () => {
    expect(validateDecisionComment("changes_requested", "   ")).toMatch(/what you'd like changed/);
    expect(validateDecisionComment("changes_requested", "Wider")).toBeNull();
    expect(validateDecisionComment("approved", "")).toBeNull();
  });

  it("caps comments at the API limit", () => {
    expect(validateDecisionComment("approved", "x".repeat(2001))).toMatch(/2000/);
    expect(validateDecisionComment("approved", ` ${"x".repeat(2000)} `)).toBeNull();
  });
});

describe("withDecision (optimistic update)", () => {
  const now = new Date("2026-10-22T09:00:00Z");
  const base = approval({ approvalRequired: true });

  it("applies a client decision", () => {
    expect(withDecision(base, { status: "approved" }, now)).toMatchObject({
      approvalStatus: "approved",
      approvalApproved: true,
      approvalComment: null,
      approvalDecidedAt: "2026-10-22T09:00:00.000Z",
    });
    const changes = withDecision(base, { status: "changes_requested", comment: "  Wider  " }, now);
    expect(changes).toMatchObject({ approvalStatus: "changes_requested", approvalApproved: false, approvalComment: "Wider" });
    expect(approvalStateOf(changes)).toBe("changes-requested");
  });

  it("a staff re-request starts a fresh round", () => {
    const decided = withDecision(base, { status: "changes_requested", comment: "Wider" }, now);
    const again = withDecision({ ...decided, approvalDecidedByName: "Asha" }, { status: "pending" }, now);
    expect(again).toMatchObject({
      approvalRequired: true,
      approvalStatus: "pending",
      approvalComment: null,
      approvalDecidedAt: null,
      approvalDecidedByName: null,
    });
    expect(approvalStateOf(again)).toBe("pending");
  });

  it("does not mutate the cached design", () => {
    withDecision(base, { status: "approved" }, now);
    expect(base.approvalStatus).toBe("pending");
  });
});
