import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AppRole } from '../../common/types/authenticated-user';

/**
 * Design approval (spec R-E4) as pure decisions, so the rules are unit-tested
 * without a database. The service applies the returned patch and, only after
 * the write succeeded, sends the returned notice.
 *
 * States: pending -> approved | changes_requested (the client decides);
 * staff can ask again, which resets the design to pending. The legacy
 * `approval_approved` boolean is always written alongside the status (a DB
 * trigger enforces the same invariant for other writers).
 */

export const DESIGN_APPROVAL_STATUSES = ['pending', 'approved', 'changes_requested'] as const;
export type DesignApprovalStatus = (typeof DESIGN_APPROVAL_STATUSES)[number];

export const APPROVAL_COMMENT_MAX = 2000;

/** The approval columns of a `designs` row. */
export interface ApprovalRow {
  approval_required: boolean;
  approval_status: string | null;
  approval_comment: string | null;
}

export interface ApprovalPatch {
  approval_required?: boolean;
  approval_status?: DesignApprovalStatus;
  approval_approved?: boolean;
  approval_comment?: string | null;
  approval_decided_at?: string | null;
  approval_decided_by?: string | null;
}

/**
 * Who hears about the change once it is stored:
 *  - `decision`: the client approved / asked for changes -> project staff
 *  - `request`:  staff asked the client to review -> the project's clients
 */
export type ApprovalNotice = 'decision' | 'request' | null;

export interface ApprovalPlan {
  patch: ApprovalPatch;
  notice: ApprovalNotice;
}

const UNCHANGED: ApprovalPlan = { patch: {}, notice: null };

export const isStaffRole = (role: AppRole): boolean => role === 'head' || role === 'manager';

export function normalizeApprovalStatus(value: unknown): DesignApprovalStatus {
  return (DESIGN_APPROVAL_STATUSES as readonly unknown[]).includes(value)
    ? (value as DesignApprovalStatus)
    : 'pending';
}

/** Trimmed comment, or null when blank. Throws when over the limit. */
export function cleanApprovalComment(comment: unknown): string | null {
  if (comment === undefined || comment === null) return null;
  if (typeof comment !== 'string') throw new BadRequestException('Comment must be text');
  const trimmed = comment.trim();
  if (trimmed.length > APPROVAL_COMMENT_MAX) {
    throw new BadRequestException(`Comment must be at most ${APPROVAL_COMMENT_MAX} characters`);
  }
  return trimmed === '' ? null : trimmed;
}

/** Patch that starts a fresh approval round (no decision yet). */
function resetPatch(): ApprovalPatch {
  return {
    approval_required: true,
    approval_status: 'pending',
    approval_approved: false,
    approval_comment: null,
    approval_decided_at: null,
    approval_decided_by: null,
  };
}

function decisionPatch(
  status: Exclude<DesignApprovalStatus, 'pending'>,
  comment: string | null,
  userId: string,
  now: Date,
): ApprovalPatch {
  return {
    approval_status: status,
    approval_approved: status === 'approved',
    approval_comment: comment,
    approval_decided_at: now.toISOString(),
    approval_decided_by: userId,
  };
}

/**
 * `POST /projects/:projectId/designs/:id/approval`.
 *  - client: `approved` (comment optional) or `changes_requested` (comment
 *    required) on a design that needs approval; may change their mind.
 *  - head/manager: only `pending` = ask the client (again). They cannot
 *    decide on the client's behalf, so the record always names the client.
 * Re-sending the current decision is a no-op (no write, no notification).
 */
export function planApprovalDecision(input: {
  role: AppRole;
  userId: string;
  row: ApprovalRow;
  status: string;
  comment?: unknown;
  now: Date;
}): ApprovalPlan {
  const { role, userId, row, now } = input;
  if (!(DESIGN_APPROVAL_STATUSES as readonly string[]).includes(input.status)) {
    throw new BadRequestException(`status must be one of: ${DESIGN_APPROVAL_STATUSES.join(', ')}`);
  }
  const status = input.status as DesignApprovalStatus;
  const comment = cleanApprovalComment(input.comment);
  const current = normalizeApprovalStatus(row.approval_status);

  if (isStaffRole(role)) {
    if (status !== 'pending') {
      throw new ForbiddenException('Only the client can approve a design or request changes');
    }
    const alreadyWaiting = row.approval_required && current === 'pending' && !row.approval_comment;
    return alreadyWaiting ? UNCHANGED : { patch: resetPatch(), notice: 'request' };
  }

  if (role !== 'client') throw new ForbiddenException('Only the client can approve designs');
  if (status === 'pending') {
    throw new BadRequestException('Approve the design or request changes');
  }
  if (!row.approval_required) throw new BadRequestException('This design does not need approval');
  if (status === 'changes_requested' && !comment) {
    throw new BadRequestException('Please say what you would like changed');
  }
  if (current === status && (row.approval_comment ?? null) === comment) return UNCHANGED;
  return { patch: decisionPatch(status, comment, userId, now), notice: 'decision' };
}

/**
 * Legacy `PATCH /projects/:projectId/designs/:id` fields (the Flutter app):
 *  - `approvalRequired` (staff): turning it on starts a fresh round and
 *    notifies the client; turning it off keeps the recorded decision.
 *  - `approvalApproved` (client, or staff overriding): true -> approved;
 *    false -> changes_requested for a client (no comment in the old app),
 *    or back to pending when staff clear it.
 * Role/ownership checks stay in the service; this only maps the fields.
 */
export function planLegacyApprovalPatch(input: {
  role: AppRole;
  userId: string;
  row: ApprovalRow;
  approvalRequired?: boolean;
  approvalApproved?: boolean;
  now: Date;
}): ApprovalPlan {
  const { role, userId, row, approvalRequired, approvalApproved, now } = input;
  let patch: ApprovalPatch = {};
  let notice: ApprovalNotice = null;

  if (approvalRequired !== undefined && approvalRequired !== row.approval_required) {
    if (approvalRequired) {
      patch = resetPatch();
      notice = 'request';
    } else {
      patch = { approval_required: false };
    }
  }

  if (approvalApproved !== undefined) {
    const current = normalizeApprovalStatus(patch.approval_status ?? row.approval_status);
    if (approvalApproved && current !== 'approved') {
      patch = { ...patch, ...decisionPatch('approved', null, userId, now) };
      notice = role === 'client' ? 'decision' : notice;
    } else if (!approvalApproved && current === 'approved') {
      if (role === 'client') {
        patch = { ...patch, ...decisionPatch('changes_requested', null, userId, now) };
        notice = 'decision';
      } else {
        patch = {
          ...patch,
          approval_status: 'pending',
          approval_approved: false,
          approval_comment: null,
          approval_decided_at: null,
          approval_decided_by: null,
        };
      }
    } else if (!approvalApproved && role === 'client' && current === 'pending' && row.approval_required) {
      // The old app's "reject" on a design still waiting for a decision.
      patch = { ...patch, ...decisionPatch('changes_requested', null, userId, now) };
      notice = 'decision';
    }
  }

  return { patch, notice };
}

// ---------------------------------------------------------------- notification text

const NOTICE_SNIPPET_MAX = 140;

function quoted(title: string | null | undefined): string {
  const t = (title ?? '').trim();
  return t ? `“${t}”` : 'a design';
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > NOTICE_SNIPPET_MAX ? `${flat.slice(0, NOTICE_SNIPPET_MAX - 1)}…` : flat;
}

/** Staff notification after a client decision. */
export function decisionNoticeText(input: {
  status: DesignApprovalStatus;
  clientName: string | null;
  designTitle: string | null;
  comment: string | null;
}): { title: string; body: string } {
  const who = input.clientName?.trim() || 'The client';
  if (input.status === 'approved') {
    return { title: 'Design approved', body: `${who} approved ${quoted(input.designTitle)}.` };
  }
  const why = input.comment ? `: ${snippet(input.comment)}` : '.';
  return {
    title: 'Changes requested on a design',
    body: `${who} asked for changes to ${quoted(input.designTitle)}${why}`,
  };
}

/** Client notification for a new design or a (re-)request for approval. */
export function clientNoticeText(input: {
  kind: 'new' | 'request';
  approvalRequired: boolean;
  designTitle: string | null;
}): { title: string; body: string } {
  if (input.kind === 'request') {
    return {
      title: 'Design ready for your approval',
      body: `Please review ${quoted(input.designTitle)} and approve it or request changes.`,
    };
  }
  if (input.approvalRequired) {
    return {
      title: 'New design for your approval',
      body: `${quoted(input.designTitle)} was shared with you and needs your approval.`,
    };
  }
  return { title: 'New design shared', body: `${quoted(input.designTitle)} was added to your project.` };
}
