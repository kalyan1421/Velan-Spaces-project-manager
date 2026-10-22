/** Pure helpers for the Designs tab: grouping, titles and approval state. */

import type { Design } from "@/lib/api/project-content";
import { displayFileName } from "../media/media";

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

export type DesignGroupView = { key: DesignGroup; label: string; items: Design[] };

export function groupDesigns(designs: Design[]): DesignGroupView[] {
  const buckets = new Map<DesignGroup, Design[]>();
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
export function splitDocuments(designs: Design[]): { designs: Design[]; quotations: Design[] } {
  const out = { designs: [] as Design[], quotations: [] as Design[] };
  for (const d of designs) (designGroupOf(d.type) === "quotation" ? out.quotations : out.designs).push(d);
  return out;
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

export type ApprovalState = "not-required" | "pending" | "approved";

export function approvalStateOf(design: Pick<Design, "approvalRequired" | "approvalApproved">): ApprovalState {
  if (design.approvalApproved) return "approved";
  return design.approvalRequired ? "pending" : "not-required";
}
