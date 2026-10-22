/**
 * Pure helpers for outgoing email: SMTP config resolution, address lists and
 * escaping. Unit-tested in mail.spec.ts.
 */

/** Escape text for HTML element content and quoted attribute values. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Headers (subject) must be one line: CR/LF would allow header injection. */
export function singleLine(value: unknown, max = 200): string {
  const flat = String(value ?? '')
    .replace(/[\r\n\t\u2028\u2029]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// Deliberately simple: one @, no spaces/brackets/commas, a dot in the domain.
const EMAIL_RE = /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']+$/;

export function isEmailAddress(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

/**
 * Normalise a recipient list from a comma/semicolon separated string or an
 * array: trimmed, lower-cased, de-duplicated, invalid and non-deliverable
 * (`*.invalid`, e.g. workers' synthetic logins) addresses dropped.
 */
export function parseEmailList(input: string | (string | null | undefined)[] | null | undefined): string[] {
  const parts = Array.isArray(input) ? input : (input ?? '').split(/[,;\n]/);
  const out: string[] = [];
  for (const raw of parts) {
    const email = (raw ?? '').trim().toLowerCase();
    if (!email || !isEmailAddress(email) || email.endsWith('.invalid')) continue;
    if (!out.includes(email)) out.push(email);
  }
  return out;
}

export interface SmtpEnv {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: 'true' | 'false';
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM?: string;
}

export type SmtpConfig =
  | {
      ok: true;
      host: string;
      port: number;
      secure: boolean;
      auth?: { user: string; pass: string };
      from: string;
    }
  | { ok: false; reason: string };

/** Resolve SMTP settings; `ok: false` (with a reason to log) when email is off. */
export function resolveSmtpConfig(env: SmtpEnv): SmtpConfig {
  const host = env.SMTP_HOST?.trim();
  if (!host) return { ok: false, reason: 'set SMTP_HOST (plus SMTP_USER / SMTP_PASS and MAIL_FROM) to send email' };
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : env.SMTP_PORT === 465;
  const port = env.SMTP_PORT ?? (secure ? 465 : 587);
  const user = env.SMTP_USER?.trim();
  const from = (env.MAIL_FROM ?? user ?? '').trim();
  if (!from.includes('@')) {
    return { ok: false, reason: 'set MAIL_FROM (a sender address) or an email-style SMTP_USER' };
  }
  return {
    ok: true,
    host,
    port,
    secure,
    auth: user ? { user, pass: env.SMTP_PASS ?? '' } : undefined,
    from,
  };
}
