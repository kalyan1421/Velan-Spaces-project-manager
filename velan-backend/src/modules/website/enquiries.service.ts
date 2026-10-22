import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';
import { MailService } from '../../mail/mail.service';
import { parseEmailList } from '../../mail/mail.util';
import { buildEnquiryEmail } from '../../mail/templates/enquiry-email';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.module';
import { EnquiryDto } from './dto';
import { buildLeadRow, isHoneypotTripped } from './website.util';

/**
 * Public "contact us" form -> `leads` row (source 'website') + an in-app/push
 * notification to every active head + an email to the team
 * (ENQUIRY_NOTIFY_EMAILS, else every active head). The response never echoes
 * the lead.
 */
@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
    // Optional so the service still works (no email) where MailModule is absent.
    @Optional() private readonly mail?: MailService,
    @Optional() private readonly config?: ConfigService<Env, true>,
  ) {}

  private db() {
    return this.supabase.admin();
  }

  async submit(dto: EnquiryDto): Promise<{ ok: true }> {
    if (isHoneypotTripped(dto.company)) {
      // Same answer as a real submission so bots learn nothing.
      this.logger.debug('Dropped website enquiry: honeypot field was filled');
      return { ok: true };
    }

    const row = buildLeadRow(dto);
    const { data, error } = await this.db().from('leads').insert(row).select('id').single();
    if (error) throw new Error(error.message);
    const leadId = (data as { id: string }).id;

    // Fire-and-forget (same as complaint notifications): a push/notification
    // or email failure must never fail the enquiry. Neither helper rejects.
    void this.notifyHeads(leadId, row.client_name, row.project_type);
    void this.emailTeam(leadId, dto);
    return { ok: true };
  }

  private async notifyHeads(leadId: string, name: string, projectType: string | null) {
    try {
      const { data: heads, error } = await this.db()
        .from('users')
        .select('id')
        .eq('role', 'head')
        .eq('is_suspended', false);
      if (error) throw new Error(error.message);

      const payload = {
        title: 'New website enquiry',
        body: `${name} · ${projectType || 'Enquiry'}`,
        type: 'lead',
        leadId,
        entityId: leadId,
      };
      const results = await Promise.allSettled(
        ((heads ?? []) as { id: string }[]).map((h) => this.notifications.notifyUser(h.id, payload)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        this.logger.warn(`Lead ${leadId}: ${failed}/${results.length} head notification(s) failed`);
      }
    } catch (e) {
      // No PII in logs: only the lead id.
      this.logger.warn(`Lead ${leadId}: could not notify heads (${(e as Error).message})`);
    }
  }

  /** Email the enquiry to the team. No-op when email is not configured. */
  private async emailTeam(leadId: string, dto: EnquiryDto) {
    try {
      if (!this.mail?.enabled) return;
      const to = await this.enquiryRecipients();
      if (to.length === 0) {
        this.logger.warn(`Lead ${leadId}: no enquiry email recipients (set ENQUIRY_NOTIFY_EMAILS)`);
        return;
      }
      const content = buildEnquiryEmail({
        leadId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        location: dto.location,
        projectType: dto.projectType,
        budgetRange: dto.budgetRange,
        message: dto.message,
        appUrl: this.config?.get('APP_PUBLIC_URL', { infer: true }) ?? 'http://localhost:3100',
      });
      const sent = await this.mail.send({ to, ...content, replyTo: dto.email });
      if (!sent) this.logger.warn(`Lead ${leadId}: enquiry email not sent`);
    } catch (e) {
      this.logger.warn(`Lead ${leadId}: could not email the team (${(e as Error).message})`);
    }
  }

  /** ENQUIRY_NOTIFY_EMAILS when set, else every active head's email. */
  private async enquiryRecipients(): Promise<string[]> {
    const configured = parseEmailList(this.config?.get('ENQUIRY_NOTIFY_EMAILS', { infer: true }));
    if (configured.length > 0) return configured;
    const { data, error } = await this.db()
      .from('users')
      .select('email')
      .eq('role', 'head')
      .eq('is_suspended', false);
    if (error) throw new Error(error.message);
    return parseEmailList(((data ?? []) as { email: string | null }[]).map((u) => u.email));
  }
}
