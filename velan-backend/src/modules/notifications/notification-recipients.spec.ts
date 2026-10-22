import {
  chatAudience,
  chatNotification,
  complaintStatusNotification,
  complaintStatusRecipients,
  isUuid,
  newTaskAssignments,
  notificationRow,
  preview,
  ProjectMemberRef,
  pushData,
  selectProjectRecipients,
  STAFF_AUDIENCE,
  taskAssignmentNotification,
  TaskRef,
  uniqueRecipients,
  UPDATE_AUDIENCE,
  updateNotification,
} from './notification-recipients';
import { isNotificationType, NOTIFICATION_TYPES } from './notification-types';

const P = '11111111-1111-4111-8111-111111111111';
const LEAD = '22222222-2222-4222-8222-222222222222';
const members: ProjectMemberRef[] = [
  { userId: 'client-1', memberRole: 'client' },
  { userId: 'client-2', memberRole: 'client' },
  { userId: 'mgr-1', memberRole: 'manager' },
  { userId: 'mgr-2', memberRole: 'manager' },
  { userId: 'wkr-1', memberRole: 'worker' },
  // Same person on the project twice (manager + worker) must be notified once.
  { userId: 'mgr-1', memberRole: 'worker' },
];
const heads = ['head-1', 'head-2'];

describe('notification types', () => {
  it('lists the contract types', () => {
    expect(NOTIFICATION_TYPES).toEqual([
      'update',
      'design',
      'design_approval',
      'chat',
      'complaint',
      'task',
      'lead',
      'invite',
      'system',
    ]);
    expect(isNotificationType('lead')).toBe(true);
    expect(isNotificationType('settlement')).toBe(false);
    expect(isNotificationType(undefined)).toBe(false);
  });
});

describe('uniqueRecipients', () => {
  it('dedupes, keeps order and drops empty / excluded ids', () => {
    expect(uniqueRecipients(['a', null, 'b', 'a', undefined, '', 'c'], ['c', null])).toEqual(['a', 'b']);
  });
});

describe('selectProjectRecipients', () => {
  it('staff = managers + heads, not clients or workers', () => {
    expect(selectProjectRecipients(members, heads, STAFF_AUDIENCE)).toEqual(['mgr-1', 'mgr-2', 'head-1', 'head-2']);
  });

  it('a client-visible update reaches clients + staff, never the poster', () => {
    expect(selectProjectRecipients(members, heads, UPDATE_AUDIENCE, ['mgr-1'])).toEqual([
      'client-1',
      'client-2',
      'mgr-2',
      'head-1',
      'head-2',
    ]);
  });

  it('a head who posts is not notified about their own update', () => {
    expect(selectProjectRecipients(members, heads, UPDATE_AUDIENCE, ['head-2'])).not.toContain('head-2');
  });

  it('workers only when asked for', () => {
    expect(selectProjectRecipients(members, [], { workers: true })).toEqual(['wkr-1', 'mgr-1']);
    expect(selectProjectRecipients(members, heads, {})).toEqual([]);
  });
});

describe('chat audience', () => {
  it('a client message goes to project staff', () => {
    const to = selectProjectRecipients(members, heads, chatAudience('client'), ['client-1']);
    expect(to).toEqual(['mgr-1', 'mgr-2', 'head-1', 'head-2']);
  });

  it.each(['head', 'manager', 'worker'] as const)('a %s message goes to the client(s) only', (role) => {
    const to = selectProjectRecipients(members, heads, chatAudience(role), ['mgr-1']);
    expect(to).toEqual(['client-1', 'client-2']);
  });
});

describe('complaintStatusRecipients', () => {
  it('clients + whoever raised it, minus the person changing it', () => {
    expect(complaintStatusRecipients(members, 'wkr-1', 'mgr-1')).toEqual(['client-1', 'client-2', 'wkr-1']);
  });

  it('does not double-notify a client who raised it', () => {
    expect(complaintStatusRecipients(members, 'client-2', 'mgr-1')).toEqual(['client-1', 'client-2']);
  });

  it('skips the actor even when they raised it', () => {
    expect(complaintStatusRecipients(members, 'mgr-1', 'mgr-1')).toEqual(['client-1', 'client-2']);
  });
});

describe('newTaskAssignments', () => {
  const t = (id: string, title: string, worker: string | null): TaskRef => ({ id, title, assignedWorkerId: worker });

  it('notifies on a new task with a worker', () => {
    const out = newTaskAssignments([], [t('a', 'Paint wall', 'w1')], 'mgr');
    expect([...out]).toEqual([['w1', [{ taskId: 'a', title: 'Paint wall' }]]]);
  });

  it('notifies on reassignment and on first assignment', () => {
    const before = [t('a', 'Paint', 'w1'), t('b', 'Tile', null)];
    const after = [t('a', 'Paint', 'w2'), t('b', 'Tile', 'w1')];
    const out = newTaskAssignments(before, after, 'mgr');
    expect(out.get('w2')).toEqual([{ taskId: 'a', title: 'Paint' }]);
    expect(out.get('w1')).toEqual([{ taskId: 'b', title: 'Tile' }]);
  });

  it('ignores unchanged assignments, unassignments and the actor', () => {
    const before = [t('a', 'Paint', 'w1'), t('b', 'Tile', 'w2')];
    const after = [t('a', 'Paint (renamed)', 'w1'), t('b', 'Tile', null), t('c', 'Self', 'mgr')];
    expect(newTaskAssignments(before, after, 'mgr').size).toBe(0);
  });

  it('groups several tasks per worker', () => {
    const out = newTaskAssignments([], [t('a', 'A', 'w1'), t('b', 'B', 'w1'), t('c', 'C', 'w2')], 'mgr');
    expect(out.get('w1')?.map((x) => x.taskId)).toEqual(['a', 'b']);
    expect(out.get('w2')?.map((x) => x.taskId)).toEqual(['c']);
  });

  it('treats a re-created id with the same title + worker as the same task', () => {
    const before = [t('old-a', 'Paint wall', 'w1'), t('old-b', 'Paint wall', 'w1')];
    const after = [t('new-a', ' paint WALL ', 'w1'), t('new-b', 'Paint wall', 'w1'), t('new-c', 'Paint wall', 'w1')];
    const out = newTaskAssignments(before, after, 'mgr');
    // Two of the three match the two previous tasks; only the extra one is new.
    expect(out.get('w1')).toEqual([{ taskId: 'new-c', title: 'Paint wall' }]);
  });

  it('falls back to "Untitled task"', () => {
    const out = newTaskAssignments([], [{ id: 'a', title: null, assignedWorkerId: 'w1' }], 'mgr');
    expect(out.get('w1')).toEqual([{ taskId: 'a', title: 'Untitled task' }]);
  });
});

describe('payload builders', () => {
  it('task: one task links to it; many are summarised', () => {
    const one = taskAssignmentNotification([{ taskId: 'a', title: 'Paint' }], P, 'mgr', 'Mira');
    expect(one).toMatchObject({ type: 'task', projectId: P, entityId: 'a', title: 'New task assigned to you', body: 'Paint' });
    const many = taskAssignmentNotification(
      ['A', 'B', 'C', 'D', 'E'].map((x) => ({ taskId: x, title: x })),
      P,
      'mgr',
    );
    expect(many).toMatchObject({ title: '5 tasks assigned to you', body: 'A, B, C and 2 more' });
    expect(many.entityId).toBeUndefined();
  });

  it('update: previews the content and links the update', () => {
    const p = updateNotification({ content: 'Tiles\n\nlaid  today', posterName: 'Ravi', updateId: 'u1', projectId: P, senderId: 's' });
    expect(p).toMatchObject({ type: 'update', title: 'New project update', body: 'Tiles laid today', entityId: 'u1', projectId: P, senderId: 's' });
  });

  it('chat: sender in the title; attachment-only messages get a body', () => {
    const p = chatNotification({ content: '', messageType: 'image', senderName: 'Asha', messageId: 'm1', projectId: P, senderId: 's' });
    expect(p).toMatchObject({ type: 'chat', title: 'New message from Asha', body: 'Sent an attachment', entityId: 'm1' });
  });

  it('complaint status: label + resolution note', () => {
    const p = complaintStatusNotification({
      complaintTitle: 'Leaking tap',
      status: 'inProgress',
      complaintId: 'c1',
      projectId: P,
      senderId: 's',
    });
    expect(p).toMatchObject({ type: 'complaint', title: 'Complaint in progress', body: 'Leaking tap is now in progress', entityId: 'c1' });
    const resolved = complaintStatusNotification({
      complaintTitle: 'Leaking tap',
      status: 'resolved',
      resolutionNote: 'Washer replaced',
      complaintId: 'c1',
      projectId: P,
      senderId: 's',
    });
    expect(resolved.body).toBe('Leaking tap · Washer replaced');
  });

  it('preview collapses whitespace and truncates with an ellipsis', () => {
    expect(preview('  a \n b  ')).toBe('a b');
    expect(preview('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
    expect(preview(null)).toBe('');
  });
});

describe('row + push data', () => {
  it('stores routing keys and only valid uuids in FK columns', () => {
    expect(
      notificationRow('user-1', {
        title: 'T',
        body: 'B',
        type: 'lead',
        leadId: LEAD,
        entityId: LEAD,
        senderId: 'not-a-uuid',
      }),
    ).toEqual({
      recipient_id: 'user-1',
      title: 'T',
      body: 'B',
      type: 'lead',
      project_id: null,
      project_name: null,
      lead_id: LEAD,
      entity_id: LEAD,
      sender_id: null,
      sender_name: null,
    });
    expect(notificationRow('u', { title: 'T', body: 'B', leadId: 'bogus' }).lead_id).toBeNull();
  });

  it('push data is string-only and omits unset keys', () => {
    expect(pushData({ title: 't', body: 'b', type: 'update', projectId: P, entityId: 'u1' })).toEqual({
      type: 'update',
      projectId: P,
      entityId: 'u1',
    });
    expect(pushData({ title: 't', body: 'b' })).toBeUndefined();
  });

  it('isUuid', () => {
    expect(isUuid(P)).toBe(true);
    expect(isUuid('abc')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
