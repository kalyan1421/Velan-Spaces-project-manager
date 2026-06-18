/**
 * Phase 4 ETL — pure transforms from Firestore documents to PostgreSQL rows.
 * No DB/SDK here so they are unit-testable. Every row carries
 * `legacy_firestore_id` so the importer can upsert idempotently, and every
 * user/project reference is remapped from the Firestore id to the new PG uuid
 * via the IdMaps built during import.
 */

export interface IdMaps {
  /** Firestore user/worker/manager doc id -> PG users.id */
  users: Map<string, string>;
  /** Firestore project doc id -> PG projects.id */
  projects: Map<string, string>;
}

export interface FsDoc {
  id: string;
  data: Record<string, any>;
}

/** Normalize Firestore timestamps (ISO string | {seconds|_seconds} | Date) -> ISO | null. */
export function ts(v: any): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  const secs = v._seconds ?? v.seconds;
  if (typeof secs === 'number') return new Date(secs * 1000).toISOString();
  return null;
}

/** Date-only (YYYY-MM-DD) for `date` columns; tolerates ISO or plain strings. */
export function dateOnly(v: any): string | null {
  const iso = ts(v) ?? (typeof v === 'string' ? v : null);
  if (!iso) return null;
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

const num = (v: any): number => (typeof v === 'number' ? v : Number(v) || 0);
const roleOf = (v: any): string =>
  String(v ?? 'client').toLowerCase().trim();
const mapUserId = (maps: IdMaps, fid?: string | null): string | null =>
  (fid && maps.users.get(fid)) || null;

// ----------------------------------------------------------------- identities
export function mapUser(doc: FsDoc): Record<string, any> {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    email: d.email ?? null,
    role: roleOf(d.role),
    display_name: d.name ?? d.displayName ?? null,
    phone: d.phone ?? null,
    trade: d.trade ?? null,
    is_suspended: d.isSuspended ?? false,
  };
}

/** `workers` / `managers` collections also become users rows (role forced). */
export function mapStaff(doc: FsDoc, role: 'worker' | 'manager'): Record<string, any> {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    email: d.email ?? null,
    role,
    display_name: d.name ?? null,
    phone: d.phone ?? null,
    trade: d.trade ?? null,
    is_suspended: d.isSuspended ?? false,
  };
}

// ----------------------------------------------------------------- projects
export function mapProject(doc: FsDoc): Record<string, any> {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_code: d.projectCode ?? doc.id,
    project_name: d.projectName ?? '',
    client_name: d.clientName ?? null,
    client_phone: d.clientPhone ?? null,
    client_email: d.clientEmail ?? null,
    location: d.location ?? null,
    budget: num(d.budget),
    estimated_cost: num(d.estimatedCost),
    current_spend: num(d.currentSpend),
    completion_percentage: num(d.completionPercentage),
    is_complete: d.isComplete ?? false,
    start_date: dateOnly(d.startDate),
    target_end_date: dateOnly(d.targetEndDate),
    created_at: ts(d.createdAt) ?? undefined,
  };
}

/** Expand managerIds/workerIds/budgetAccessManagerIds into project_members rows. */
export function mapProjectMembers(
  doc: FsDoc,
  projectPgId: string,
  maps: IdMaps,
): Array<Record<string, any>> {
  const d = doc.data;
  const budgetAccess = new Set<string>(
    (d.budgetAccessManagerIds ?? []).map(String),
  );
  const rows: Array<Record<string, any>> = [];
  const add = (fid: string, role: 'manager' | 'worker' | 'client') => {
    const userId = maps.users.get(String(fid));
    if (!userId) return; // unresolved user — skipped (logged by importer)
    rows.push({
      project_id: projectPgId,
      user_id: userId,
      member_role: role,
      has_budget_access: role === 'manager' && budgetAccess.has(String(fid)),
    });
  };
  for (const id of d.managerIds ?? []) add(id, 'manager');
  for (const id of d.workerIds ?? []) add(id, 'worker');
  return rows;
}

// ----------------------------------------------------------------- children
export function mapUpdate(doc: FsDoc, projectPgId: string, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    posted_by: mapUserId(maps, d.postedBy),
    role: d.role ?? null,
    type: d.type ?? 'message',
    content: d.content ?? null,
    category: d.category ?? null,
    progress_percentage: d.progressPercentage ?? null,
    media_urls: d.mediaUrls ?? [],
    is_client_viewable: d.isClientViewable ?? true,
    created_at: ts(d.timestamp) ?? undefined,
  };
}

export function mapDesign(doc: FsDoc, projectPgId: string, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    title: d.title ?? null,
    file_url: d.url ?? d.fileUrl ?? null,
    type: d.type ?? '2D',
    posted_by: mapUserId(maps, d.postedBy),
    room_name: d.roomName ?? null,
    approval_approved: d.approvalStatus?.approved ?? false,
    approval_required: d.approvalStatus?.required ?? false,
    created_at: ts(d.timestamp) ?? undefined,
  };
}

export function mapFile(doc: FsDoc, projectPgId: string, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    name: d.name ?? null,
    title: d.title ?? null,
    storage_path: d.storagePath ?? null,
    category: d.category ?? 'other',
    type: d.type ?? 'unknown',
    size: num(d.size),
    uploaded_by: mapUserId(maps, d.uploadedBy),
    version: d.version ?? 1,
    approval_status: d.approvalStatus ?? 'pending',
    room_name: d.roomName ?? null,
    uploaded_at: ts(d.uploadedAt) ?? undefined,
  };
}

export function mapRoom(doc: FsDoc, projectPgId: string) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    name: d.name ?? '',
    assigned_worker_ids: [], // remapped post-import if needed
  };
}

export function mapBudgetTxn(doc: FsDoc, projectPgId: string, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    type: (d.type ?? 'debit') === 'credit' ? 'credit' : 'debit',
    amount: num(d.amount),
    description: d.description ?? null,
    txn_date: dateOnly(d.date),
    added_by: mapUserId(maps, d.addedBy),
    created_at: ts(d.createdAt) ?? undefined,
  };
}

export function mapSettlement(doc: FsDoc, projectPgId: string, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    description: d.description ?? null,
    amount: num(d.amount),
    settlement_date: dateOnly(d.date),
    paid_to_name: d.paidToName ?? d.paidTo ?? null,
    mode: d.mode ?? d.paymentMethod ?? null,
    created_by: mapUserId(maps, d.createdBy ?? d.addedBy),
    proof_url: d.proofUrl ?? null,
    created_at: ts(d.createdAt) ?? undefined,
  };
}

export function mapChat(doc: FsDoc, projectPgId: string, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    sender_id: mapUserId(maps, d.senderId),
    sender_name: d.senderName ?? null,
    sender_role: d.senderRole ?? null,
    content: d.content ?? null,
    message_type: d.messageType ?? 'text',
    attachment_urls: d.attachmentUrls ?? [],
    created_at: ts(d.createdAt) ?? undefined,
  };
}

export function mapComplaint(doc: FsDoc, projectPgId: string, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    title: d.title ?? null,
    description: d.description ?? null,
    created_by: mapUserId(maps, d.createdBy),
    created_by_name: d.createdByName ?? null,
    status: d.status ?? 'open',
    attachments: d.attachments ?? [],
    resolution_note: d.resolutionNote ?? null,
    created_at: ts(d.createdAt) ?? undefined,
    resolved_at: ts(d.resolvedAt),
  };
}

export function mapNotification(doc: FsDoc, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    recipient_id: mapUserId(maps, d.recipientId ?? d.userId),
    title: d.title ?? null,
    body: d.body ?? null,
    type: d.type ?? null,
    project_id: d.projectId ? maps.projects.get(String(d.projectId)) ?? null : null,
    project_name: d.projectName ?? null,
    sender_id: mapUserId(maps, d.senderId),
    sender_name: d.senderName ?? null,
    is_read: d.isRead ?? false,
    created_at: ts(d.createdAt) ?? undefined,
  };
}

export function mapLead(doc: FsDoc, maps: IdMaps) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    client_name: d.clientName ?? null,
    client_phone: d.clientPhone ?? null,
    area: d.area ?? null,
    project_type: d.projectType ?? null,
    source: d.source ?? null,
    estimated_budget: d.estimatedBudget ?? null,
    notes: d.notes ?? null,
    status: d.status ?? 'new',
    assigned_manager_id: mapUserId(maps, d.assignedManagerId),
    created_at: ts(d.createdAt) ?? undefined,
  };
}

export function mapCatalogItem(doc: FsDoc) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    name: d.name ?? '',
    description: d.description ?? null,
    item_type: d.itemType ?? null,
    uom: d.uom ?? null,
    default_section: d.defaultSection ?? null,
    variants: d.variants ?? [],
    active: d.active ?? true,
  };
}

export function mapQuoteTemplate(doc: FsDoc) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    name: d.name ?? '',
    sections: d.sections ?? [],
  };
}

export function mapQuote(doc: FsDoc) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    quote_number: d.quoteNumber ?? null,
    status: d.status ?? 'draft',
    prepared_for_name: d.preparedForName ?? null,
    prepared_for_phone: d.preparedForPhone ?? null,
    prepared_for_email: d.preparedForEmail ?? null,
    prepared_for_address: d.preparedForAddress ?? null,
    pdf_url: d.pdfUrl ?? null,
    handled_by: d.handledBy ?? null,
    designed_by: d.designedBy ?? null,
    quote_date: ts(d.date),
    valid_until: ts(d.validUntil),
    enquiry_date: ts(d.enquiryDate),
    enquiry_no: d.enquiryNo ?? null,
    site_location: d.siteLocation ?? null,
    project_type: d.projectType ?? 'Residential',
    not_included: d.notIncluded ?? [],
    sections: d.sections ?? [],
    discount_type: d.discountType === 'percent' ? 'percent' : 'amount',
    discount_value: num(d.discountValue),
    gst_percent: num(d.gstPercent),
    subtotal: num(d.subtotal),
    grand_total: num(d.grandTotal),
    created_at: ts(d.createdAt) ?? undefined,
  };
}

export function mapTimelinePhase(doc: FsDoc, projectPgId: string) {
  const d = doc.data;
  return {
    legacy_firestore_id: doc.id,
    project_id: projectPgId,
    name: d.name ?? '',
    start_date: ts(d.startDate),
    end_date: ts(d.endDate),
    status: d.status ?? 'notStarted',
    order_index: num(d.orderIndex),
    notes: d.notes ?? null,
    created_at: ts(d.createdAt) ?? undefined,
  };
}
