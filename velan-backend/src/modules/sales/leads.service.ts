import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
import { LEAD_STATUSES } from './sales.constants';

export interface LeadListFilter {
  status?: string;
  /** A user id, or 'me' for the caller. */
  assignedManagerId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** dto key -> column, for the plain text/enum columns create and patch share. */
const LEAD_COLUMNS: [keyof UpdateLeadDto, string][] = [
  ['clientName', 'client_name'],
  ['clientPhone', 'client_phone'],
  ['area', 'area'],
  ['projectType', 'project_type'],
  ['source', 'source'],
  ['estimatedBudget', 'estimated_budget'],
  ['notes', 'notes'],
  ['status', 'status'],
  ['assignedManagerId', 'assigned_manager_id'],
];

/**
 * Leads (sales pipeline). Visibility matches the mobile app today: head and
 * every manager see and edit ALL leads (spec OQ-10 is still open); the list
 * can be narrowed with ?assignedManagerId=me. Only the head deletes.
 */
@Injectable()
export class LeadsService {
  constructor(private readonly supabase: SupabaseService) {}

  private db() {
    return this.supabase.admin();
  }

  async list(user: AuthenticatedUser, filter: LeadListFilter = {}): Promise<unknown[]> {
    let q = this.db().from('leads').select('*').order('created_at', { ascending: false });
    if (filter.status !== undefined) {
      if (!(LEAD_STATUSES as readonly string[]).includes(filter.status)) {
        throw new BadRequestException(`status must be one of: ${LEAD_STATUSES.join(', ')}`);
      }
      q = q.eq('status', filter.status);
    }
    if (filter.assignedManagerId !== undefined) {
      const id = filter.assignedManagerId === 'me' ? user.id : filter.assignedManagerId;
      if (!UUID_RE.test(id)) throw new BadRequestException('assignedManagerId must be a uuid or "me"');
      q = q.eq('assigned_manager_id', id);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async get(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.db().from('leads').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Lead not found');
    return data;
  }

  async create(dto: CreateLeadDto) {
    await this.assertAssignable(dto.assignedManagerId);
    const row = toLeadRow(dto);
    row.status = row.status ?? 'new';
    const { data, error } = await this.db().from('leads').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.assertAssignable(dto.assignedManagerId);
    const patch = toLeadRow(dto);
    if (Object.keys(patch).length === 0) return this.get(id);
    const { data, error } = await this.db()
      .from('leads')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Lead not found');
    return data;
  }

  /** Deletes the lead and (FK on delete cascade) its quotes. */
  async remove(id: string) {
    const { data, error } = await this.db().from('leads').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new NotFoundException('Lead not found');
    return { deleted: true };
  }

  /** assignedManagerId must be an active head/manager account. */
  private async assertAssignable(userId: string | null | undefined) {
    if (!userId) return;
    const { data, error } = await this.db()
      .from('users')
      .select('id, role, is_suspended')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const u = data as { role: string; is_suspended: boolean } | null;
    if (!u || !['head', 'manager'].includes(u.role) || u.is_suspended) {
      throw new BadRequestException('assignedManagerId must be an active head or manager account');
    }
  }
}

/** Only the keys present in the body (undefined = untouched; null = clear). */
export function toLeadRow(dto: UpdateLeadDto): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, col] of LEAD_COLUMNS) {
    if (dto[key] !== undefined) row[col] = dto[key];
  }
  return row;
}
