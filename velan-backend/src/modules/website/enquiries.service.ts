import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.module';
import { EnquiryDto } from './dto';
import { buildLeadRow, isHoneypotTripped } from './website.util';

/**
 * Public "contact us" form -> `leads` row (source 'website') + an in-app/push
 * notification to every active head. The response never echoes the lead.
 */
@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
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

    // Fire-and-forget (same as complaint notifications): a push/notification
    // failure must never fail the enquiry. notifyHeads never rejects.
    void this.notifyHeads((data as { id: string }).id, row.client_name, row.project_type);
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
}
