import { escapeHtml, isEmailAddress, parseEmailList, resolveSmtpConfig, singleLine } from './mail.util';
import { buildEnquiryEmail, leadUrl } from './templates/enquiry-email';

const LEAD = '22222222-2222-4222-8222-222222222222';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('singleLine', () => {
  it('removes CR/LF (no header injection) and collapses spaces', () => {
    expect(singleLine('Hi\r\nBcc: evil@example.com')).toBe('Hi Bcc: evil@example.com');
    expect(singleLine('a b')).toBe('a b');
    expect(singleLine('x'.repeat(10), 5)).toBe('xxxx…');
  });
});

describe('parseEmailList', () => {
  it('splits, trims, lowercases, dedupes and drops invalid / non-deliverable', () => {
    expect(parseEmailList(' Sales@Example.com, owner@example.com;sales@example.com, bad, x@y ,w@workers.velanspaces.invalid')).toEqual([
      'sales@example.com',
      'owner@example.com',
    ]);
    expect(parseEmailList(['a@b.co', null, undefined, ''])).toEqual(['a@b.co']);
    expect(parseEmailList(undefined)).toEqual([]);
  });

  it('rejects addresses that could smuggle extra recipients', () => {
    expect(isEmailAddress('a@b.co,c@d.co')).toBe(false);
    expect(isEmailAddress('"x" <a@b.co>')).toBe(false);
  });
});

describe('resolveSmtpConfig', () => {
  it('is disabled without SMTP_HOST', () => {
    expect(resolveSmtpConfig({})).toMatchObject({ ok: false });
  });

  it('needs a sender address', () => {
    expect(resolveSmtpConfig({ SMTP_HOST: 'smtp.x.com', SMTP_USER: 'apikey' })).toMatchObject({ ok: false });
  });

  it('defaults to STARTTLS on 587 and uses SMTP_USER as sender', () => {
    expect(resolveSmtpConfig({ SMTP_HOST: 'smtp.x.com', SMTP_USER: 'me@x.com', SMTP_PASS: 'p' })).toEqual({
      ok: true,
      host: 'smtp.x.com',
      port: 587,
      secure: false,
      auth: { user: 'me@x.com', pass: 'p' },
      from: 'me@x.com',
    });
  });

  it('port 465 implies TLS; SMTP_SECURE overrides; no auth without a user', () => {
    expect(resolveSmtpConfig({ SMTP_HOST: 'h', SMTP_PORT: 465, MAIL_FROM: 'a@b.co' })).toMatchObject({
      port: 465,
      secure: true,
      auth: undefined,
    });
    expect(resolveSmtpConfig({ SMTP_HOST: 'h', SMTP_SECURE: 'true', MAIL_FROM: 'Velan <a@b.co>' })).toMatchObject({
      port: 465,
      secure: true,
      from: 'Velan <a@b.co>',
    });
    expect(resolveSmtpConfig({ SMTP_HOST: 'h', SMTP_PORT: 2525, SMTP_SECURE: 'false', MAIL_FROM: 'a@b.co' })).toMatchObject({
      port: 2525,
      secure: false,
    });
  });
});

describe('buildEnquiryEmail', () => {
  const base = {
    leadId: LEAD,
    name: 'Asha Raman',
    phone: '+919876543210',
    email: 'asha@example.com',
    location: 'Adyar',
    projectType: 'Residential',
    budgetRange: '10-20 L',
    message: 'Full 3BHK\nModular kitchen',
    appUrl: 'https://app.example.com/',
  };

  it('links to the lead in the web app', () => {
    expect(leadUrl('https://app.example.com//', LEAD)).toBe(`https://app.example.com/app/sales/${LEAD}`);
    const mail = buildEnquiryEmail(base);
    expect(mail.text).toContain(`Open the lead: https://app.example.com/app/sales/${LEAD}`);
    expect(mail.html).toContain(`href="https://app.example.com/app/sales/${LEAD}"`);
  });

  it('has a one-line subject and every detail in the text body', () => {
    const mail = buildEnquiryEmail(base);
    expect(mail.subject).toBe('New website enquiry: Asha Raman (Residential)');
    for (const line of [
      'Name: Asha Raman',
      'Phone: +919876543210',
      'Email: asha@example.com',
      'Location: Adyar',
      'Project type: Residential',
      'Budget: 10-20 L',
      'Message:\nFull 3BHK\nModular kitchen',
    ]) {
      expect(mail.text).toContain(line);
    }
  });

  it('escapes visitor input in the HTML and keeps line breaks', () => {
    const mail = buildEnquiryEmail({
      ...base,
      name: '<img src=x onerror=alert(1)>',
      message: 'Hi <b>team</b>\n"quoted" & more',
      location: undefined,
    });
    expect(mail.html).not.toContain('<img');
    expect(mail.html).not.toContain('<b>team');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mail.html).toContain('Hi &lt;b&gt;team&lt;/b&gt;<br>&quot;quoted&quot; &amp; more');
    expect(mail.html).not.toContain('Location');
  });

  it('strips line breaks from the subject', () => {
    const mail = buildEnquiryEmail({ ...base, name: 'Evil\r\nBcc: x@y.com', projectType: undefined });
    expect(mail.subject).toBe('New website enquiry: Evil Bcc: x@y.com');
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it('omits empty optional fields', () => {
    const mail = buildEnquiryEmail({ leadId: LEAD, name: 'Ravi', phone: '+919876543210', appUrl: 'http://localhost:3100' });
    expect(mail.text).not.toContain('Email:');
    expect(mail.text).not.toContain('Message:');
    expect(mail.subject).toBe('New website enquiry: Ravi');
  });
});
