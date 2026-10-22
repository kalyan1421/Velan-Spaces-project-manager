import { EnquiriesService } from '../modules/website/enquiries.service';

/**
 * Website enquiry -> team email (the dashboard notification side is covered in
 * website.services.spec.ts). Minimal chainable fake of the supabase calls used.
 */
type Row = Record<string, any>;

function fakeDb(users: Row[], opts: { failUsers?: boolean } = {}) {
  const leads: Row[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const q: any = {
      insert(row: Row) {
        const saved = { id: '22222222-2222-4222-8222-222222222222', ...row };
        leads.push(saved);
        return { select: () => ({ single: async () => ({ data: { id: saved.id }, error: null }) }) };
      },
      select() {
        return q;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return q;
      },
      then(resolve: (r: { data: Row[] | null; error: { message: string } | null }) => void) {
        if (table === 'users' && opts.failUsers) return resolve({ data: null, error: { message: 'boom' } });
        const rows = (table === 'users' ? users : []).filter((r) => filters.every(([c, v]) => r[c] === v));
        resolve({ data: rows, error: null });
      },
    };
    return q;
  };
  return { db: { admin: () => ({ from }) }, leads };
}

const flush = () => new Promise((r) => setImmediate(r));

const users: Row[] = [
  { id: 'h1', role: 'head', is_suspended: false, email: 'Owner@Example.com' },
  { id: 'h2', role: 'head', is_suspended: true, email: 'gone@example.com' },
  { id: 'h3', role: 'head', is_suspended: false, email: null },
  { id: 'm1', role: 'manager', is_suspended: false, email: 'mgr@example.com' },
];

const enquiry = {
  name: 'Asha <b>Raman</b>',
  phone: '+919876543210',
  email: 'asha@example.com',
  projectType: 'Residential',
  message: 'Full 3BHK',
};

function setup(env: Record<string, string | undefined>, mailEnabled = true, dbOpts = {}) {
  const { db, leads } = fakeDb(users, dbOpts);
  const notifyUser = jest.fn().mockResolvedValue(undefined);
  const mail = { enabled: mailEnabled, send: jest.fn().mockResolvedValue(true) };
  const config = { get: (k: string) => env[k] };
  const svc = new EnquiriesService(db as never, { notifyUser } as never, mail as never, config as never);
  return { svc, mail, notifyUser, leads };
}

describe('EnquiriesService email', () => {
  it('emails ENQUIRY_NOTIFY_EMAILS with a link to the lead and the visitor as reply-to', async () => {
    const { svc, mail, notifyUser } = setup({
      ENQUIRY_NOTIFY_EMAILS: 'sales@example.com, owner@example.com',
      APP_PUBLIC_URL: 'https://app.example.com',
    });
    await expect(svc.submit(enquiry)).resolves.toEqual({ ok: true });
    await flush();
    expect(mail.send).toHaveBeenCalledTimes(1);
    const msg = mail.send.mock.calls[0][0];
    expect(msg.to).toEqual(['sales@example.com', 'owner@example.com']);
    expect(msg.replyTo).toBe('asha@example.com');
    expect(msg.text).toContain('https://app.example.com/app/sales/22222222-2222-4222-8222-222222222222');
    expect(msg.html).toContain('Asha &lt;b&gt;Raman&lt;/b&gt;');
    // Dashboard notification still goes out, with the lead link.
    expect(notifyUser).toHaveBeenCalledWith('h1', expect.objectContaining({ type: 'lead', leadId: expect.any(String) }));
  });

  it('falls back to the emails of active heads', async () => {
    const { svc, mail } = setup({});
    await svc.submit(enquiry);
    await flush();
    expect(mail.send.mock.calls[0][0].to).toEqual(['owner@example.com']);
  });

  it('does nothing when email is not configured', async () => {
    const { svc, mail, leads } = setup({ ENQUIRY_NOTIFY_EMAILS: 'sales@example.com' }, false);
    await expect(svc.submit(enquiry)).resolves.toEqual({ ok: true });
    await flush();
    expect(mail.send).not.toHaveBeenCalled();
    expect(leads).toHaveLength(1);
  });

  it('never fails the enquiry when sending or the recipient lookup fails', async () => {
    const a = setup({});
    a.mail.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(a.svc.submit(enquiry)).resolves.toEqual({ ok: true });
    await flush();

    const b = setup({}, true, { failUsers: true });
    await expect(b.svc.submit(enquiry)).resolves.toEqual({ ok: true });
    await flush();
    expect(b.mail.send).not.toHaveBeenCalled();
  });

  it('skips honeypot submissions', async () => {
    const { svc, mail } = setup({ ENQUIRY_NOTIFY_EMAILS: 'sales@example.com' });
    await svc.submit({ ...enquiry, company: 'Spam Inc' });
    await flush();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('works without MailService / ConfigService (no email)', async () => {
    const { db } = fakeDb(users);
    const svc = new EnquiriesService(db as never, { notifyUser: jest.fn().mockResolvedValue(undefined) } as never);
    await expect(svc.submit(enquiry)).resolves.toEqual({ ok: true });
  });
});
