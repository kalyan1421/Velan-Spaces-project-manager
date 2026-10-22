import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  APPROVAL_COMMENT_MAX,
  ApprovalRow,
  cleanApprovalComment,
  clientNoticeText,
  decisionNoticeText,
  normalizeApprovalStatus,
  planApprovalDecision,
  planLegacyApprovalPatch,
} from './design-approval';

const NOW = new Date('2026-10-22T09:30:00.000Z');
const CLIENT = 'client-1';
const MANAGER = 'manager-1';

const row = (over: Partial<ApprovalRow> = {}): ApprovalRow => ({
  approval_required: true,
  approval_status: 'pending',
  approval_comment: null,
  ...over,
});

describe('normalizeApprovalStatus', () => {
  it('keeps known statuses and falls back to pending', () => {
    expect(normalizeApprovalStatus('approved')).toBe('approved');
    expect(normalizeApprovalStatus('changes_requested')).toBe('changes_requested');
    expect(normalizeApprovalStatus('rejected')).toBe('pending');
    expect(normalizeApprovalStatus(null)).toBe('pending');
  });
});

describe('cleanApprovalComment', () => {
  it('trims and turns blank into null', () => {
    expect(cleanApprovalComment('  move the window  ')).toBe('move the window');
    expect(cleanApprovalComment('   ')).toBeNull();
    expect(cleanApprovalComment(undefined)).toBeNull();
  });

  it('rejects comments over the limit', () => {
    expect(() => cleanApprovalComment('x'.repeat(APPROVAL_COMMENT_MAX + 1))).toThrow(BadRequestException);
    expect(cleanApprovalComment(`  ${'x'.repeat(APPROVAL_COMMENT_MAX)}  `)).toHaveLength(APPROVAL_COMMENT_MAX);
  });
});

describe('planApprovalDecision — client', () => {
  const decide = (status: string, comment?: string, r = row()) =>
    planApprovalDecision({ role: 'client', userId: CLIENT, row: r, status, comment, now: NOW });

  it('approves a pending design, recording who and when, and notifies staff', () => {
    expect(decide('approved')).toEqual({
      patch: {
        approval_status: 'approved',
        approval_approved: true,
        approval_comment: null,
        approval_decided_at: NOW.toISOString(),
        approval_decided_by: CLIENT,
      },
      notice: 'decision',
    });
  });

  it('keeps an optional comment on approval', () => {
    expect(decide('approved', ' Looks great ').patch.approval_comment).toBe('Looks great');
  });

  it('requests changes with a comment (boolean stays false)', () => {
    const plan = decide('changes_requested', 'Make the wardrobe wider');
    expect(plan.patch).toMatchObject({
      approval_status: 'changes_requested',
      approval_approved: false,
      approval_comment: 'Make the wardrobe wider',
      approval_decided_by: CLIENT,
    });
    expect(plan.notice).toBe('decision');
  });

  it('requires a comment to request changes', () => {
    expect(() => decide('changes_requested')).toThrow(BadRequestException);
    expect(() => decide('changes_requested', '   ')).toThrow(BadRequestException);
  });

  it('refuses designs that do not need approval', () => {
    expect(() => decide('approved', undefined, row({ approval_required: false }))).toThrow(BadRequestException);
  });

  it('cannot reset to pending or send an unknown status', () => {
    expect(() => decide('pending')).toThrow(BadRequestException);
    expect(() => decide('rejected')).toThrow(BadRequestException);
  });

  it('may change their mind (changes requested -> approved, approved -> changes requested)', () => {
    expect(decide('approved', undefined, row({ approval_status: 'changes_requested', approval_comment: 'x' })).patch)
      .toMatchObject({ approval_status: 'approved', approval_comment: null });
    expect(decide('changes_requested', 'Actually, darker tiles', row({ approval_status: 'approved' })).patch)
      .toMatchObject({ approval_status: 'changes_requested', approval_approved: false });
  });

  it('re-sending the same decision is a no-op (no write, no notification)', () => {
    expect(decide('approved', undefined, row({ approval_status: 'approved' }))).toEqual({ patch: {}, notice: null });
    const same = row({ approval_status: 'changes_requested', approval_comment: 'Wider door' });
    expect(decide('changes_requested', ' Wider door ', same)).toEqual({ patch: {}, notice: null });
    // A new comment is a new decision.
    expect(decide('changes_requested', 'Wider door, please', same).notice).toBe('decision');
  });
});

describe('planApprovalDecision — staff and workers', () => {
  const ask = (r: ApprovalRow, role: 'head' | 'manager' = 'manager') =>
    planApprovalDecision({ role, userId: MANAGER, row: r, status: 'pending', now: NOW });

  it('staff can ask the client again: fresh round, client notified', () => {
    expect(ask(row({ approval_status: 'changes_requested', approval_comment: 'Wider door' }))).toEqual({
      patch: {
        approval_required: true,
        approval_status: 'pending',
        approval_approved: false,
        approval_comment: null,
        approval_decided_at: null,
        approval_decided_by: null,
      },
      notice: 'request',
    });
    expect(ask(row({ approval_required: false }), 'head').notice).toBe('request');
    expect(ask(row({ approval_status: 'approved' })).patch.approval_status).toBe('pending');
  });

  it('asking while already waiting is a no-op', () => {
    expect(ask(row())).toEqual({ patch: {}, notice: null });
  });

  it('staff cannot decide on the client’s behalf', () => {
    for (const status of ['approved', 'changes_requested']) {
      expect(() =>
        planApprovalDecision({ role: 'head', userId: MANAGER, row: row(), status, comment: 'ok', now: NOW }),
      ).toThrow(ForbiddenException);
    }
  });

  it('workers cannot approve', () => {
    expect(() =>
      planApprovalDecision({ role: 'worker', userId: 'w', row: row(), status: 'approved', now: NOW }),
    ).toThrow(ForbiddenException);
  });
});

describe('planLegacyApprovalPatch (Flutter PATCH fields)', () => {
  const legacy = (
    role: 'client' | 'manager',
    r: ApprovalRow,
    fields: { approvalRequired?: boolean; approvalApproved?: boolean },
  ) => planLegacyApprovalPatch({ role, userId: role === 'client' ? CLIENT : MANAGER, row: r, now: NOW, ...fields });

  it('client approvalApproved=true approves and notifies staff', () => {
    const plan = legacy('client', row(), { approvalApproved: true });
    expect(plan.patch).toMatchObject({ approval_status: 'approved', approval_approved: true, approval_decided_by: CLIENT });
    expect(plan.notice).toBe('decision');
  });

  it('client approvalApproved=false ("reject") records changes requested', () => {
    expect(legacy('client', row(), { approvalApproved: false })).toMatchObject({
      patch: { approval_status: 'changes_requested', approval_approved: false, approval_comment: null },
      notice: 'decision',
    });
    expect(legacy('client', row({ approval_status: 'approved' }), { approvalApproved: false }).patch.approval_status)
      .toBe('changes_requested');
  });

  it('repeating the current boolean changes nothing', () => {
    expect(legacy('client', row({ approval_status: 'approved' }), { approvalApproved: true })).toEqual({
      patch: {},
      notice: null,
    });
    expect(
      legacy('client', row({ approval_status: 'changes_requested' }), { approvalApproved: false }),
    ).toEqual({ patch: {}, notice: null });
  });

  it('staff turning approval on starts a fresh round and notifies the client', () => {
    const plan = legacy('manager', row({ approval_required: false, approval_status: 'approved' }), {
      approvalRequired: true,
    });
    expect(plan.patch).toMatchObject({ approval_required: true, approval_status: 'pending', approval_approved: false });
    expect(plan.notice).toBe('request');
  });

  it('staff turning approval off keeps the recorded decision', () => {
    expect(legacy('manager', row({ approval_status: 'changes_requested' }), { approvalRequired: false })).toEqual({
      patch: { approval_required: false },
      notice: null,
    });
    expect(legacy('manager', row(), { approvalRequired: true })).toEqual({ patch: {}, notice: null });
  });

  it('staff clearing an approval goes back to pending without notifying', () => {
    expect(legacy('manager', row({ approval_status: 'approved' }), { approvalApproved: false })).toEqual({
      patch: {
        approval_status: 'pending',
        approval_approved: false,
        approval_comment: null,
        approval_decided_at: null,
        approval_decided_by: null,
      },
      notice: null,
    });
  });
});

describe('notification text', () => {
  it('names the client and the design for staff', () => {
    expect(decisionNoticeText({ status: 'approved', clientName: 'Asha', designTitle: 'Kitchen 3D', comment: null }))
      .toEqual({ title: 'Design approved', body: 'Asha approved “Kitchen 3D”.' });
    const changes = decisionNoticeText({
      status: 'changes_requested',
      clientName: null,
      designTitle: null,
      comment: `Please\n make it ${'very '.repeat(60)}wide`,
    });
    expect(changes.title).toBe('Changes requested on a design');
    expect(changes.body.startsWith('The client asked for changes to a design: Please make it very')).toBe(true);
    expect(changes.body.endsWith('…')).toBe(true);
  });

  it('tells the client about new designs and approval requests', () => {
    expect(clientNoticeText({ kind: 'new', approvalRequired: false, designTitle: 'Living room' }).title).toBe(
      'New design shared',
    );
    expect(clientNoticeText({ kind: 'new', approvalRequired: true, designTitle: 'Living room' }).body).toContain(
      'needs your approval',
    );
    expect(clientNoticeText({ kind: 'request', approvalRequired: true, designTitle: ' ' }).body).toContain('a design');
  });
});
