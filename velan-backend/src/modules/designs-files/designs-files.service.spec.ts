/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DesignsFilesService } from './designs-files.module';

/**
 * Service wiring around the pure approval rules: which rows clients can see,
 * what gets written, and that notifications are sent after the write but can
 * never fail it.
 */

type Op = 'select' | 'insert' | 'update' | 'delete';
type Filter = [string, string, unknown];
interface Recorded {
  table: string;
  op: Op;
  payload?: any;
  filters: Filter[];
}
type Handler = (q: Recorded) => { data: any; error: any };

class FakeQuery {
  rec: Recorded;
  constructor(
    private readonly db: FakeDb,
    table: string,
  ) {
    this.rec = { table, op: 'select', filters: [] };
  }
  select() {
    return this;
  }
  insert(v: any) {
    this.rec.op = 'insert';
    this.rec.payload = v;
    return this;
  }
  update(v: any) {
    this.rec.op = 'update';
    this.rec.payload = v;
    return this;
  }
  delete() {
    this.rec.op = 'delete';
    return this;
  }
  eq(col: string, v: unknown) {
    this.rec.filters.push(['eq', col, v]);
    return this;
  }
  in(col: string, v: unknown) {
    this.rec.filters.push(['in', col, v]);
    return this;
  }
  gte(col: string, v: unknown) {
    this.rec.filters.push(['gte', col, v]);
    return this;
  }
  order() {
    return this;
  }
  single() {
    return this;
  }
  maybeSingle() {
    return this;
  }
  then(ok?: (v: { data: any; error: any }) => any, fail?: (e: unknown) => any) {
    this.db.log.push(this.rec);
    const handler = this.db.handlers[`${this.rec.table}:${this.rec.op}`];
    const result = handler ? handler(this.rec) : { data: null, error: null };
    return Promise.resolve(result).then(ok, fail);
  }
}

class FakeDb {
  log: Recorded[] = [];
  handlers: Record<string, Handler> = {};
  admin() {
    return { from: (t: string) => new FakeQuery(this, t) };
  }
  writes(table: string, op: Op) {
    return this.log.filter((r) => r.table === table && r.op === op);
  }
}

const has = (rec: Recorded, col: string, v: unknown) =>
  rec.filters.some(([, c, val]) => c === col && JSON.stringify(val) === JSON.stringify(v));

const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
};

const PID = '11111111-1111-4111-8111-111111111111';
const DID = '22222222-2222-4222-8222-222222222222';

const user = (role: AuthenticatedUser['role'], id = `${role}-1`): AuthenticatedUser => ({
  id,
  email: null,
  role,
  displayName: role === 'client' ? 'Asha Raman' : 'Priya',
  username: null,
  isSuspended: false,
});

const designRow = (over: Record<string, unknown> = {}) => ({
  id: DID,
  project_id: PID,
  title: 'Kitchen 3D',
  approval_required: true,
  approval_status: 'pending',
  approval_approved: false,
  approval_comment: null,
  person: { display_name: 'Priya' },
  decider: null,
  ...over,
});

describe('DesignsFilesService', () => {
  let db: FakeDb;
  let notifications: { notifyUser: jest.Mock; notifyProjectStaff: jest.Mock };
  let svc: DesignsFilesService;

  beforeEach(() => {
    db = new FakeDb();
    notifications = {
      notifyUser: jest.fn().mockResolvedValue(undefined),
      notifyProjectStaff: jest.fn().mockResolvedValue(undefined),
    };
    const access = { assertMember: jest.fn().mockResolvedValue(undefined) };
    const storage = { normalizeProjectRef: (_p: string, v: string) => v, removeRefs: jest.fn() };
    svc = new DesignsFilesService(db as never, access as never, storage as never, notifications as never);
    db.handlers['projects:select'] = () => ({ data: { project_name: 'Raman Villa' }, error: null });
  });

  describe('files visibility', () => {
    beforeEach(() => {
      db.handlers['files:select'] = () => ({ data: [], error: null });
    });

    it('clients only list files shared with them', async () => {
      await svc.listFiles(user('client'), PID);
      expect(has(db.writes('files', 'select')[0], 'client_visible', true)).toBe(true);
    });

    it('staff list every file', async () => {
      await svc.listFiles(user('manager'), PID);
      expect(has(db.writes('files', 'select')[0], 'client_visible', true)).toBe(false);
    });

    it('a client cannot update a file that is not shared (404)', async () => {
      db.handlers['files:update'] = (q) => ({
        data: has(q, 'client_visible', true) ? null : { id: 'f' },
        error: null,
      });
      await expect(
        svc.updateFile(user('client'), PID, 'f', { approvalStatus: 'approved' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('a client may not share files', async () => {
      await expect(
        svc.updateFile(user('client'), PID, 'f', { clientVisible: true } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('staff can share a file with the client', async () => {
      db.handlers['files:update'] = () => ({ data: { id: 'f', client_visible: true }, error: null });
      await svc.updateFile(user('manager'), PID, 'f', { clientVisible: true } as never);
      expect(db.writes('files', 'update')[0].payload).toEqual({ client_visible: true });
    });

    it('new files are staff-only unless shared', async () => {
      db.handlers['files:insert'] = (q) => ({ data: q.payload, error: null });
      await svc.createFile(user('manager'), PID, { storagePath: 'sb://project-files/x' } as never);
      await svc.createFile(user('manager'), PID, { storagePath: 'sb://project-files/y', clientVisible: true } as never);
      expect(db.writes('files', 'insert').map((w) => w.payload.client_visible)).toEqual([false, true]);
    });
  });

  describe('design approval', () => {
    let current: ReturnType<typeof designRow>;

    beforeEach(() => {
      current = designRow();
      db.handlers['designs:select'] = () => ({ data: current, error: null });
      db.handlers['designs:update'] = (q) => {
        current = { ...current, ...q.payload, decider: { display_name: 'Asha Raman' } };
        return { data: current, error: null };
      };
    });

    it('records the client decision and notifies staff with the design id', async () => {
      const res: any = await svc.decideDesign(user('client'), PID, DID, {
        status: 'changes_requested',
        comment: 'Wider wardrobe',
      });
      expect(db.writes('designs', 'update')[0].payload).toMatchObject({
        approval_status: 'changes_requested',
        approval_approved: false,
        approval_comment: 'Wider wardrobe',
        approval_decided_by: 'client-1',
      });
      expect(res).toMatchObject({
        approval_status: 'changes_requested',
        approval_decided_by_name: 'Asha Raman',
        posted_by_name: 'Priya',
      });
      expect(res.decider).toBeUndefined();

      await flush();
      expect(notifications.notifyProjectStaff).toHaveBeenCalledWith(PID, {
        title: 'Changes requested on a design',
        body: 'Asha Raman asked for changes to “Kitchen 3D”: Wider wardrobe',
        type: 'design_approval',
        projectId: PID,
        projectName: 'Raman Villa',
        entityId: DID,
        senderId: 'client-1',
        senderName: 'Asha Raman',
      });
    });

    it('a failing notification never fails the decision', async () => {
      notifications.notifyProjectStaff.mockRejectedValue(new Error('FCM down'));
      await expect(svc.decideDesign(user('client'), PID, DID, { status: 'approved' })).resolves.toMatchObject({
        approval_status: 'approved',
      });
      await flush();
    });

    it('validation errors write nothing', async () => {
      await expect(
        svc.decideDesign(user('client'), PID, DID, { status: 'changes_requested' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.writes('designs', 'update')).toHaveLength(0);
    });

    it('a repeated decision neither writes nor notifies', async () => {
      current = designRow({ approval_status: 'approved', approval_approved: true });
      await svc.decideDesign(user('client'), PID, DID, { status: 'approved' });
      await flush();
      expect(db.writes('designs', 'update')).toHaveLength(0);
      expect(notifications.notifyProjectStaff).not.toHaveBeenCalled();
    });

    it('legacy PATCH approvalApproved=true from the app maps onto the status', async () => {
      await svc.updateDesign(user('client'), PID, DID, { approvalApproved: true } as never);
      expect(db.writes('designs', 'update')[0].payload).toMatchObject({
        approval_status: 'approved',
        approval_approved: true,
      });
      await flush();
      expect(notifications.notifyProjectStaff).toHaveBeenCalledTimes(1);
    });

    it('staff re-request notifies the project clients (type design)', async () => {
      current = designRow({ approval_status: 'changes_requested', approval_comment: 'Wider' });
      db.handlers['project_members:select'] = () => ({ data: [{ user_id: 'client-1' }], error: null });
      db.handlers['users:select'] = () => ({ data: [{ id: 'client-1' }], error: null });
      await svc.decideDesign(user('manager'), PID, DID, { status: 'pending' });
      await flush();
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'client-1',
        expect.objectContaining({ type: 'design', entityId: DID, projectId: PID }),
      );
      // Re-requests are not throttled.
      expect(db.writes('notifications', 'select')).toHaveLength(0);
    });
  });

  describe('new design notifications', () => {
    beforeEach(() => {
      db.handlers['designs:insert'] = (q) => ({ data: { id: DID, ...q.payload }, error: null });
      db.handlers['project_members:select'] = () => ({
        data: [{ user_id: 'client-1' }, { user_id: 'client-2' }, { user_id: 'client-1' }],
        error: null,
      });
      db.handlers['users:select'] = (q) => ({
        data: (q.filters.find(([, c]) => c === 'id')?.[2] as string[]).map((id) => ({ id })),
        error: null,
      });
    });

    it('notifies each client once, skipping those notified in the last few minutes', async () => {
      db.handlers['notifications:select'] = () => ({ data: [{ recipient_id: 'client-2' }], error: null });
      await svc.createDesign(user('manager'), PID, { title: 'Kitchen 3D', fileUrl: 'sb://designs/x', approvalRequired: true });
      await flush();
      expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
      expect(notifications.notifyUser).toHaveBeenCalledWith('client-1', {
        title: 'New design for your approval',
        body: '“Kitchen 3D” was shared with you and needs your approval.',
        type: 'design',
        projectId: PID,
        projectName: 'Raman Villa',
        entityId: DID,
        senderId: 'manager-1',
        senderName: 'Priya',
      });
      const recent = db.writes('notifications', 'select')[0];
      expect(has(recent, 'type', 'design')).toBe(true);
      expect(has(recent, 'project_id', PID)).toBe(true);
    });

    it('the upload succeeds even if notifying fails', async () => {
      db.handlers['notifications:select'] = () => ({ data: [], error: null });
      notifications.notifyUser.mockRejectedValue(new Error('push down'));
      await expect(
        svc.createDesign(user('manager'), PID, { title: 'Plan', fileUrl: 'sb://designs/y' }),
      ).resolves.toMatchObject({ id: DID, approval_status: 'pending' });
      await flush();
      expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
    });
  });
});
