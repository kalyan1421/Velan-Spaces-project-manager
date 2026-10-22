/**
 * Designs with the client-approval workflow (spec R-E4).
 *
 * `GET /projects/:projectId/designs` rows now carry the approval record
 * (`approvalStatus`, `approvalComment`, `approvalDecidedAt`,
 * `approvalDecidedBy(Name)`); `normalizeDesign` in `@/lib/api/project-content`
 * predates them, so this module extends it. Older API builds without the
 * fields fall back to the `approvalApproved` boolean.
 *
 * `POST /projects/:projectId/designs/:id/approval` `{ status, comment? }`:
 *  - client: `approved` | `changes_requested` (comment required)
 *  - head/manager: `pending` = ask the client (again)
 * Answers the updated design.
 */

import { api } from "@/lib/api/client";
import {
  contentPath,
  normalizeDesign,
  type Design,
  type UpdateDesignBody,
} from "@/lib/api/project-content";

export const DESIGN_APPROVAL_STATUSES = ["pending", "approved", "changes_requested"] as const;
export type DesignApprovalStatus = (typeof DESIGN_APPROVAL_STATUSES)[number];

/** Same limit as the API (`APPROVAL_COMMENT_MAX`). */
export const APPROVAL_COMMENT_MAX = 2000;

export type ApprovalDesign = Design & {
  approvalStatus: DesignApprovalStatus;
  approvalComment: string | null;
  /** ISO timestamp of the client's decision. */
  approvalDecidedAt: string | null;
  approvalDecidedBy: string | null;
  approvalDecidedByName: string | null;
};

export type DesignDecisionBody = { status: DesignApprovalStatus; comment?: string };

type Raw = Record<string, unknown>;
const asObject = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

export function parseApprovalStatus(value: unknown): DesignApprovalStatus | null {
  return (DESIGN_APPROVAL_STATUSES as readonly unknown[]).includes(value) ? (value as DesignApprovalStatus) : null;
}

export function normalizeApprovalDesign(raw: unknown): ApprovalDesign {
  const base = normalizeDesign(raw);
  const o = asObject(raw);
  const status = parseApprovalStatus(o.approvalStatus) ?? (base.approvalApproved ? "approved" : "pending");
  return {
    ...base,
    approvalApproved: status === "approved",
    approvalStatus: status,
    approvalComment: str(o.approvalComment),
    approvalDecidedAt: str(o.approvalDecidedAt),
    approvalDecidedBy: str(o.approvalDecidedBy),
    approvalDecidedByName: str(o.approvalDecidedByName),
  };
}

export const normalizeApprovalDesigns = (raw: unknown): ApprovalDesign[] =>
  Array.isArray(raw) ? raw.map(normalizeApprovalDesign) : [];

/**
 * Upgrades rows that came through the older `normalizeDesign` (no approval
 * record) so the UI can rely on the fields being present.
 */
export function ensureApprovalDesigns(list: readonly (Design | ApprovalDesign)[]): ApprovalDesign[] {
  return list.map((d) => ("approvalStatus" in d ? d : normalizeApprovalDesign(d)));
}

const approvalPath = (projectId: string, id: string) => `${contentPath.design(projectId, id)}/approval`;

type Signal = { signal?: AbortSignal };

/** Browser fetchers (BFF). Share the `contentKeys.designs` cache key. */
export const designApi = {
  list: async (projectId: string, { signal }: Signal = {}) =>
    normalizeApprovalDesigns(await api.get<unknown>(contentPath.designs(projectId), { signal })),
  update: async (projectId: string, id: string, body: UpdateDesignBody) =>
    normalizeApprovalDesign(await api.patch<unknown>(contentPath.design(projectId, id), body)),
  decide: async (projectId: string, id: string, body: DesignDecisionBody) =>
    normalizeApprovalDesign(await api.post<unknown>(approvalPath(projectId, id), body)),
};
