/** Pure helpers for the Designs tab: grouping, titles and approval state. */

import type { Design } from "@/lib/api/project-content";
import { formatDate } from "@/lib/format";
import { displayFileName } from "../media/media";
import { APPROVAL_COMMENT_MAX, type ApprovalDesign, type DesignApprovalStatus } from "./design-api";

export type DesignGroup = "2d" | "3d" | "quotation" | "other";

export const DESIGN_GROUP_LABELS: Record<DesignGroup, string> = {
  "2d": "2D plans",
  "3d": "3D renders",
  quotation: "Quotations",
  other: "Other designs",
};

const GROUP_ORDER: DesignGroup[] = ["2d", "3d", "quotation", "other"];

/** Values the mobile app writes today ("2D Plan" / "3D Render"); legacy rows say "2D" / "3D". */
export const DESIGN_TYPE_OPTIONS = [
  { value: "2D Plan", label: "2D plan" },
  { value: "3D Render", label: "3D render" },
  { value: "Other", label: "Other" },
] as const;

export type DesignTypeValue = (typeof DESIGN_TYPE_OPTIONS)[number]["value"];

export function designGroupOf(type: string): DesignGroup {
  const t = type.toLowerCase().replace(/\s+/g, "");
  if (t.includes("3d") || t.includes("render")) return "3d";
  if (t.includes("2d") || t.includes("plan")) return "2d";
  if (t.includes("quot")) return "quotation";
  return "other";
}

export function designTypeLabel(type: string): string {
  const group = designGroupOf(type);
  if (group === "2d") return "2D plan";
  if (group === "3d") return "3D render";
  if (group === "quotation") return "Quotation";
  return type.trim() || "Design";
}

export type DesignGroupView<T extends Design = Design> = { key: DesignGroup; label: string; items: T[] };

export function groupDesigns<T extends Design>(designs: T[]): DesignGroupView<T>[] {
  const buckets = new Map<DesignGroup, T[]>();
  for (const d of designs) {
    const key = designGroupOf(d.type);
    const list = buckets.get(key);
    if (list) list.push(d);
    else buckets.set(key, [d]);
  }
  return GROUP_ORDER.filter((k) => buckets.has(k)).map((key) => ({
    key,
    label: DESIGN_GROUP_LABELS[key],
    items: buckets.get(key) ?? [],
  }));
}

/** Quotation PDFs attached to the project live in designs; clients see them under Documents. */
export function splitDocuments<T extends Design>(designs: T[]): { designs: T[]; quotations: T[] } {
  const out = { designs: [] as T[], quotations: [] as T[] };
  for (const d of designs) (designGroupOf(d.type) === "quotation" ? out.quotations : out.designs).push(d);
  return out;
}

/**
 * Portal gallery: drawings and renders; quotation PDFs live under Files &
 * documents, unless the team asked the client to approve one.
 */
export function portalGalleryDesigns<T extends Design>(designs: T[]): T[] {
  return designs.filter((d) => designGroupOf(d.type) !== "quotation" || d.approvalRequired);
}

const MAX_TITLE = 300;
const FALLBACK_TITLE = "Untitled design";

export function numberedTitles(base: string, count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [base];
  return Array.from({ length: count }, (_, i) => `${base} (${i + 1})`);
}

/** "master_bedroom-3d.PNG" → "master bedroom 3d". */
export function titleFromFileName(name: string): string {
  const stem = name.replace(/\.[a-z0-9]{1,8}$/i, "");
  const title = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return title || FALLBACK_TITLE;
}

/**
 * One title per uploaded file: the typed title numbered `Title (1)`, `Title (2)`…
 * when several files share it, otherwise each file's own name.
 */
export function designTitlesFor(baseTitle: string, fileNames: string[]): string[] {
  const base = baseTitle.trim();
  const titles = base ? numberedTitles(base.slice(0, MAX_TITLE - 6), fileNames.length) : fileNames.map(titleFromFileName);
  return titles.map((t) => t.slice(0, MAX_TITLE));
}

export function designTitle(design: Pick<Design, "title" | "fileUrl">): string {
  if (design.title?.trim()) return design.title.trim();
  if (design.fileUrl) {
    const name = displayFileName(design.fileUrl);
    if (name && name !== "file") return name;
  }
  return FALLBACK_TITLE;
}

export type ApprovalState = "not-required" | "pending" | "approved" | "changes-requested";

type ApprovalFields = Pick<Design, "approvalRequired" | "approvalApproved"> & {
  /** Present on rows from `design-api` (R-E4); older rows only have the boolean. */
  approvalStatus?: DesignApprovalStatus | null;
};

/**
 * Display state of a design's client approval. An approval is shown even if
 * staff later turned "needs approval" off; a change request only while the
 * design still needs approval.
 */
export function approvalStateOf(design: ApprovalFields): ApprovalState {
  const status = design.approvalStatus ?? (design.approvalApproved ? "approved" : "pending");
  if (status === "approved" || design.approvalApproved) return "approved";
  if (!design.approvalRequired) return "not-required";
  return status === "changes_requested" ? "changes-requested" : "pending";
}

export const APPROVAL_STATE_LABELS: Record<ApprovalState, string> = {
  "not-required": "No approval needed",
  pending: "Awaiting approval",
  approved: "Approved",
  "changes-requested": "Changes requested",
};

/** The client can still decide (approve, or ask for changes). */
export function clientCanDecide(design: ApprovalFields): boolean {
  const state = approvalStateOf(design);
  return state === "pending" || state === "changes-requested";
}

/** Designs waiting for the client's first decision, oldest request first. */
export function awaitingClientDecision<T extends ApprovalFields & Pick<Design, "createdAt">>(designs: T[]): T[] {
  return designs
    .filter((d) => approvalStateOf(d) === "pending")
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}

export function approvalCounts(designs: ApprovalFields[]): { pending: number; changesRequested: number; approved: number } {
  const out = { pending: 0, changesRequested: 0, approved: 0 };
  for (const d of designs) {
    const state = approvalStateOf(d);
    if (state === "pending") out.pending += 1;
    else if (state === "changes-requested") out.changesRequested += 1;
    else if (state === "approved" && d.approvalRequired) out.approved += 1;
  }
  return out;
}

/**
 * One line about the decision: staff see who decided, the client sees "You".
 * Null when there is nothing to say (no approval needed, no decision).
 */
export function approvalSummary(
  design: ApprovalFields & Pick<ApprovalDesign, "approvalDecidedAt" | "approvalDecidedByName">,
  viewer: "staff" | "client",
): string | null {
  const state = approvalStateOf(design);
  const when = design.approvalDecidedAt ? formatDate(design.approvalDecidedAt) : null;
  const suffix = when ? ` · ${when}` : "";
  const who = design.approvalDecidedByName?.trim() || "the client";
  if (state === "approved") {
    if (!design.approvalDecidedAt && !design.approvalDecidedByName) return null; // legacy approval, no record
    return viewer === "client" ? `You approved this${suffix}` : `Approved by ${who}${suffix}`;
  }
  if (state === "changes-requested") {
    return viewer === "client" ? `You asked for changes${suffix}` : `Changes requested by ${who}${suffix}`;
  }
  if (state === "pending") return viewer === "client" ? "Waiting for your approval" : "Waiting for the client";
  return null;
}

/** Client-side check before sending a decision (the API enforces the same). */
export function validateDecisionComment(status: DesignApprovalStatus, comment: string): string | null {
  const trimmed = comment.trim();
  if (trimmed.length > APPROVAL_COMMENT_MAX) return `Keep it under ${APPROVAL_COMMENT_MAX} characters.`;
  if (status === "changes_requested" && !trimmed) return "Tell the team what you'd like changed.";
  return null;
}

/** The design as it will look once a decision is saved (optimistic update). */
export function withDecision(
  design: ApprovalDesign,
  decision: { status: DesignApprovalStatus; comment?: string },
  now: Date,
): ApprovalDesign {
  if (decision.status === "pending") {
    return {
      ...design,
      approvalRequired: true,
      approvalApproved: false,
      approvalStatus: "pending",
      approvalComment: null,
      approvalDecidedAt: null,
      approvalDecidedBy: null,
      approvalDecidedByName: null,
    };
  }
  return {
    ...design,
    approvalApproved: decision.status === "approved",
    approvalStatus: decision.status,
    approvalComment: decision.comment?.trim() || null,
    approvalDecidedAt: now.toISOString(),
  };
}
