import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.module';

type Row = { id: string; expires_at: string; used_at: string | null } | null;

function make(row: Row, deleteReturns: { id: string } | null = { id: 'i1' }) {
  const calls: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is']) builder[m] = (...a: unknown[]) => (calls.push(`${m}:${a.join(',')}`), builder);
  builder.delete = () => (calls.push('delete'), builder);
  let deleting = false;
  builder.delete = () => ((deleting = true), calls.push('delete'), builder);
  builder.maybeSingle = () =>
    Promise.resolve({ data: deleting ? deleteReturns : row, error: null });
  const db = { from: () => builder };
  const assertMember = jest.fn().mockResolvedValue(undefined);
  const svc = new AccountsService({ admin: () => db } as never, { assertMember } as never, {} as never, {} as never);
  return { svc, calls, assertMember };
}

const actor = { id: 'u1', role: 'manager' } as never;
const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

describe('AccountsService.revokeClientInvite', () => {
  it('deletes a pending invite scoped to the project', async () => {
    const { svc, calls, assertMember } = make({ id: 'i1', expires_at: future, used_at: null });
    await expect(svc.revokeClientInvite(actor, 'p1', 'i1')).resolves.toEqual({ revoked: true });
    expect(assertMember).toHaveBeenCalledWith(actor, 'p1');
    expect(calls).toContain('eq:project_id,p1');
    expect(calls).toContain('delete');
  });

  it('404s an unknown invite or one from another project', async () => {
    const { svc, calls } = make(null);
    await expect(svc.revokeClientInvite(actor, 'p1', 'i1')).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).not.toContain('delete');
  });

  it('409s an accepted invite', async () => {
    const { svc, calls } = make({ id: 'i1', expires_at: future, used_at: past });
    await expect(svc.revokeClientInvite(actor, 'p1', 'i1')).rejects.toBeInstanceOf(ConflictException);
    expect(calls).not.toContain('delete');
  });

  it('409s an expired invite', async () => {
    const { svc } = make({ id: 'i1', expires_at: past, used_at: null });
    await expect(svc.revokeClientInvite(actor, 'p1', 'i1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('409s when the invite was accepted between check and delete', async () => {
    const { svc } = make({ id: 'i1', expires_at: future, used_at: null }, null);
    await expect(svc.revokeClientInvite(actor, 'p1', 'i1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('propagates the project access check failure', async () => {
    const { svc, assertMember } = make({ id: 'i1', expires_at: future, used_at: null });
    assertMember.mockRejectedValue(new ForbiddenException());
    await expect(svc.revokeClientInvite(actor, 'p1', 'i1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
