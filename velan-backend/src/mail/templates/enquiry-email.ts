import { escapeHtml, singleLine } from '../mail.util';

export interface EnquiryEmailInput {
  leadId: string;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  projectType?: string;
  budgetRange?: string;
  message?: string;
  /** Web app base URL (APP_PUBLIC_URL). */
  appUrl: string;
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

/** Where the team opens the lead in the web app. */
export function leadUrl(appUrl: string, leadId: string): string {
  return `${appUrl.replace(/\/+$/, '')}/app/sales/${encodeURIComponent(leadId)}`;
}

/**
 * Team email for a new website enquiry: plain text + a simple HTML version.
 * Every visitor-supplied value is escaped in the HTML and kept to one line in
 * the subject.
 */
export function buildEnquiryEmail(input: EnquiryEmailInput): EmailContent {
  const url = leadUrl(input.appUrl, input.leadId);
  const fields: [string, string | undefined][] = [
    ['Name', input.name],
    ['Phone', input.phone],
    ['Email', input.email],
    ['Location', input.location],
    ['Project type', input.projectType],
    ['Budget', input.budgetRange],
  ];
  const shown = fields.filter((f): f is [string, string] => !!f[1]?.trim());
  const message = input.message?.trim();

  const subject = singleLine(
    `New website enquiry: ${input.name}${input.projectType ? ` (${input.projectType})` : ''}`,
    150,
  );

  const text = [
    'A new enquiry came in through the website.',
    '',
    ...shown.map(([label, value]) => `${label}: ${singleLine(value, 500)}`),
    ...(message ? ['', 'Message:', message] : []),
    '',
    `Open the lead: ${url}`,
  ].join('\n');

  const rows = shown
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#6b6b6b;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;color:#1f1f1f">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  const messageHtml = message
    ? `<p style="margin:16px 0 4px;color:#6b6b6b">Message</p>` +
      `<p style="margin:0;color:#1f1f1f;white-space:pre-wrap">${escapeHtml(message).replace(/\r?\n/g, '<br>')}</p>`
    : '';

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f4f0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">` +
    `<h1 style="margin:0 0 12px;font-size:18px;color:#1f1f1f">New website enquiry</h1>` +
    `<table role="presentation" style="border-collapse:collapse">${rows}</table>` +
    messageHtml +
    `<p style="margin:24px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1f1f1f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px">Open the lead</a></p>` +
    `<p style="margin:12px 0 0;color:#6b6b6b;font-size:12px">The enquiry is also in Sales and in your dashboard notifications.</p>` +
    `</div></body></html>`;

  return { subject, text, html };
}
