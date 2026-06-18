-- ============================================================
-- Velan Spaces — combined Phase 1 schema (generated from
-- supabase/migrations/*.sql). Paste into the Supabase SQL Editor
-- to apply all at once. Safe to re-run (idempotent guards).
-- ============================================================


-- >>> supabase/migrations/20260618170001_extensions_enums_helpers.sql

-- ============================================================================
-- Velan Spaces — Firebase → Supabase migration
-- 0001 · Extensions, enum types, and shared helper functions
-- ============================================================================
-- Strategy notes:
--  * Backend (NestJS) connects with the service_role key and bypasses RLS.
--    RLS is still ENABLED on every table (default-deny) as defense in depth;
--    granular policies are added in Phase 2 only if direct client access is
--    ever needed.
--  * Controlled domains (roles) use enums. Free-form/legacy status fields use
--    TEXT so the Phase 4 ETL never rejects unexpected legacy values.
--  * Every table carries `legacy_firestore_id` to make the ETL idempotent
--    (upsert on the original Firestore document id).
-- ============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()

-- Roles across the app (head / manager / worker / client)
do $$ begin
  create type user_role as enum ('head', 'manager', 'worker', 'client');
exception when duplicate_object then null; end $$;

-- A user's relationship to a specific project
do $$ begin
  create type project_member_role as enum ('manager', 'worker', 'client');
exception when duplicate_object then null; end $$;

-- Budget transaction direction
do $$ begin
  create type budget_txn_type as enum ('debit', 'credit');
exception when duplicate_object then null; end $$;

-- Shared trigger to maintain updated_at on row updates
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- >>> supabase/migrations/20260618170002_core.sql

-- ============================================================================
-- 0002 · Core tables: users, projects, project_members
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users  (mirrors Firestore `users`; folds in legacy `workers` / `managers`)
-- id matches auth.users.id once Supabase Auth accounts are provisioned.
-- ----------------------------------------------------------------------------
create table if not exists users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  role                user_role not null default 'client',
  display_name        text,
  phone               text,
  trade               text,                         -- legacy worker.trade
  is_suspended        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);
comment on table users is 'App users; id aligns with auth.users after Phase 2/4 auth migration.';

-- ----------------------------------------------------------------------------
-- projects  (Firestore `projects`; id arrays normalized into project_members)
-- ----------------------------------------------------------------------------
create table if not exists projects (
  id                    uuid primary key default gen_random_uuid(),
  project_code          text not null unique,
  project_name          text not null,
  client_name           text,
  client_phone          text,
  client_email          text,
  location              text,
  budget                numeric(14,2) not null default 0,
  estimated_cost        numeric(14,2) not null default 0,
  current_spend         numeric(14,2) not null default 0,
  completion_percentage int not null default 0,
  is_complete           boolean not null default false,
  start_date            date,
  target_end_date       date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  legacy_firestore_id   text unique
);

-- ----------------------------------------------------------------------------
-- project_members  (replaces managerIds / workerIds / budgetAccessManagerIds
-- and the legacy worker/manager `assignedProjects` arrays)
-- ----------------------------------------------------------------------------
create table if not exists project_members (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  member_role       project_member_role not null,
  has_budget_access boolean not null default false,   -- budgetAccessManagerIds
  created_at        timestamptz not null default now(),
  unique (project_id, user_id, member_role)
);

-- Indexes
create index if not exists idx_users_role               on users(role);
create index if not exists idx_projects_code            on projects(project_code);
create index if not exists idx_project_members_project  on project_members(project_id);
create index if not exists idx_project_members_user     on project_members(user_id);

-- updated_at triggers
drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at before update on projects
  for each row execute function set_updated_at();

-- RLS (default-deny; backend uses service_role)
alter table users           enable row level security;
alter table projects        enable row level security;
alter table project_members enable row level security;

-- >>> supabase/migrations/20260618170003_project_content.sql

-- ============================================================================
-- 0003 · Project content: rooms, updates, designs, files, timeline phases/tasks
-- (rooms created first so updates/tasks can FK to it)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- rooms  (projects/*/rooms)
-- ----------------------------------------------------------------------------
create table if not exists rooms (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  name                text not null,
  assigned_worker_ids uuid[] not null default '{}',
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- project_updates  (projects/*/updates) — multi-image via media_urls
-- ----------------------------------------------------------------------------
create table if not exists project_updates (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references projects(id) on delete cascade,
  posted_by             uuid references users(id) on delete set null,
  role                  text,                       -- poster role snapshot
  type                  text not null default 'message',
  content               text,
  category              text,
  room_id               uuid references rooms(id) on delete set null,
  associated_worker_ids uuid[] not null default '{}',
  progress_percentage   int,
  media_urls            text[] not null default '{}',
  comments              jsonb not null default '[]',
  is_client_viewable    boolean not null default true,
  created_at            timestamptz not null default now(),  -- Firestore `timestamp`
  legacy_firestore_id   text unique
);

-- ----------------------------------------------------------------------------
-- designs  (projects/*/designs) — design_document_model
-- ----------------------------------------------------------------------------
create table if not exists designs (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  title               text,
  file_url            text,                         -- Firestore `url` / `fileUrl`
  type                text not null default '2D',   -- 2D / 3D
  posted_by           uuid references users(id) on delete set null,
  room_name           text,
  approval_approved   boolean not null default false,
  approval_required   boolean not null default false,
  created_at          timestamptz not null default now(),  -- Firestore `timestamp`
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- files  (projects/*/files) — file_model
-- ----------------------------------------------------------------------------
create table if not exists files (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  name                text,
  title               text,
  storage_path        text,
  category            text not null default 'other',
  type                text not null default 'unknown',
  size                bigint not null default 0,
  uploaded_by         uuid references users(id) on delete set null,
  version             int not null default 1,
  approval_status     text not null default 'pending',
  room_name           text,
  uploaded_at         timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- timeline_phases  (top-level `phases`) — timeline_model
-- ----------------------------------------------------------------------------
create table if not exists timeline_phases (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  name                text not null,
  start_date          timestamptz,
  end_date            timestamptz,
  status              text not null default 'notStarted',
  order_index         int not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- timeline_tasks  (tasks embedded under a phase) — timeline_task_model
-- ----------------------------------------------------------------------------
create table if not exists timeline_tasks (
  id                  uuid primary key default gen_random_uuid(),
  phase_id            uuid not null references timeline_phases(id) on delete cascade,
  project_id          uuid references projects(id) on delete cascade,
  title               text not null,
  description         text,
  status              text not null default 'notStarted',
  priority            text not null default 'medium',
  planned_start       timestamptz,
  planned_end         timestamptz,
  actual_start        timestamptz,
  actual_end          timestamptz,
  assigned_worker_id  uuid references users(id) on delete set null,
  room_id             uuid references rooms(id) on delete set null,
  checklist_items     jsonb not null default '[]',
  comments            jsonb not null default '[]',
  photo_proof_urls    text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- Indexes
create index if not exists idx_rooms_project           on rooms(project_id);
create index if not exists idx_updates_project_created on project_updates(project_id, created_at desc);
create index if not exists idx_designs_project          on designs(project_id);
create index if not exists idx_files_project            on files(project_id);
create index if not exists idx_phases_project_order     on timeline_phases(project_id, order_index);
create index if not exists idx_tasks_phase              on timeline_tasks(phase_id);
create index if not exists idx_tasks_project            on timeline_tasks(project_id);

-- updated_at triggers
drop trigger if exists trg_phases_updated_at on timeline_phases;
create trigger trg_phases_updated_at before update on timeline_phases
  for each row execute function set_updated_at();

drop trigger if exists trg_tasks_updated_at on timeline_tasks;
create trigger trg_tasks_updated_at before update on timeline_tasks
  for each row execute function set_updated_at();

-- RLS
alter table rooms           enable row level security;
alter table project_updates enable row level security;
alter table designs         enable row level security;
alter table files           enable row level security;
alter table timeline_phases enable row level security;
alter table timeline_tasks  enable row level security;

-- >>> supabase/migrations/20260618170004_financials.sql

-- ============================================================================
-- 0004 · Financials: budget_transactions, settlements, expenses, counters
-- All money is numeric(14,2) — never float.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- budget_transactions  (projects/*/budgetTransactions)
-- ----------------------------------------------------------------------------
create table if not exists budget_transactions (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  type                budget_txn_type not null default 'debit',
  amount              numeric(14,2) not null default 0,
  description         text,
  txn_date            date,
  added_by            uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- settlements  (projects/*/settlements) — settlement_model
-- ----------------------------------------------------------------------------
create table if not exists settlements (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  description         text,
  amount              numeric(14,2) not null default 0,
  settlement_date     date,
  paid_to_name        text,                          -- Firestore `paidToName`
  mode                text,                          -- payment method
  created_by          uuid references users(id) on delete set null,
  proof_url           text,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- expenses  (expense_model; carries projectId/projectName denormalized)
-- ----------------------------------------------------------------------------
create table if not exists expenses (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references projects(id) on delete cascade,
  type                text not null default 'debit',
  amount              numeric(14,2) not null default 0,
  expense_date        date,
  account_details     text,
  category            text not null default 'other',
  payment_method      text,
  proof_url           text,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- counters  (replaces the Firestore `counters` doc for sequential codes)
-- ----------------------------------------------------------------------------
create table if not exists counters (
  key   text primary key,
  value bigint not null default 0
);

-- Atomic counter increment helper (avoids race conditions on code generation)
create or replace function next_counter(p_key text)
returns bigint
language plpgsql
as $$
declare
  v bigint;
begin
  insert into counters(key, value) values (p_key, 1)
  on conflict (key) do update set value = counters.value + 1
  returning value into v;
  return v;
end;
$$;

-- Indexes
create index if not exists idx_budget_txn_project on budget_transactions(project_id, created_at desc);
create index if not exists idx_settlements_project on settlements(project_id, created_at desc);
create index if not exists idx_expenses_project    on expenses(project_id, created_at desc);

-- RLS
alter table budget_transactions enable row level security;
alter table settlements         enable row level security;
alter table expenses            enable row level security;
alter table counters            enable row level security;

-- >>> supabase/migrations/20260618170005_sales_crm.sql

-- ============================================================================
-- 0005 · Sales / CRM: leads, catalog_items, quote_templates, quotes,
--         quotation_settings
-- Quote sections/items are kept as jsonb to mirror the existing nested model
-- (sections -> items). Normalize into quote_items later only if reporting needs it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- leads  (lead_model)
-- ----------------------------------------------------------------------------
create table if not exists leads (
  id                  uuid primary key default gen_random_uuid(),
  client_name         text,
  client_phone        text,
  area                text,
  project_type        text,
  source              text,
  estimated_budget    text,                          -- stored free-form in app
  notes               text,
  status              text not null default 'new',
  assigned_manager_id uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- catalog_items  (catalog_item_model) — rate card
-- ----------------------------------------------------------------------------
create table if not exists catalog_items (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  item_type           text,
  uom                 text,
  default_section     text,
  variants            jsonb not null default '[]',
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- quote_templates  (quote_template_model)
-- ----------------------------------------------------------------------------
create table if not exists quote_templates (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  sections            jsonb not null default '[]',
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- quotes  (quote_model) — totals computed server-side at write time
-- ----------------------------------------------------------------------------
create table if not exists quotes (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid references leads(id) on delete set null,
  quote_number        text,
  status              text not null default 'draft',
  prepared_for_name   text,
  prepared_for_phone  text,
  prepared_for_email  text,
  prepared_for_address text,
  pdf_url             text,
  handled_by          text,
  designed_by         text,
  quote_date          timestamptz,
  valid_until         timestamptz,
  enquiry_date        timestamptz,
  enquiry_no          text,
  site_location       text,
  project_type        text not null default 'Residential',
  not_included        text[] not null default '{}',
  sections            jsonb not null default '[]',   -- sections -> items
  discount_type       text not null default 'amount',-- amount | percent
  discount_value      numeric(14,2) not null default 0,
  gst_percent         numeric(6,2) not null default 0,
  subtotal            numeric(14,2) not null default 0,
  grand_total         numeric(14,2) not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- quotation_settings  (quotation_settings_model) — branding for client PDF
-- ----------------------------------------------------------------------------
create table if not exists quotation_settings (
  id                   uuid primary key default gen_random_uuid(),
  company_name         text,
  phone                text,
  email                text,
  address              text,
  logo_url             text,
  watermark_logo_url   text,
  cover_image_url      text,
  footer_text          text,
  default_terms        text,
  default_not_included text[] not null default '{}',
  quote_validity_days  int not null default 15,
  quote_number_prefix  text not null default 'QUO-',
  default_project_type text not null default 'Residential',
  default_gst_percent  numeric(6,2) not null default 0,
  round_amounts        boolean not null default true,
  updated_at           timestamptz not null default now(),
  legacy_firestore_id  text unique
);

-- Indexes
create index if not exists idx_leads_status        on leads(status);
create index if not exists idx_leads_manager       on leads(assigned_manager_id);
create index if not exists idx_quotes_lead         on quotes(lead_id);
create index if not exists idx_quotes_status       on quotes(status);
create index if not exists idx_catalog_active      on catalog_items(active);

-- updated_at triggers
drop trigger if exists trg_quotes_updated_at on quotes;
create trigger trg_quotes_updated_at before update on quotes
  for each row execute function set_updated_at();

drop trigger if exists trg_quotation_settings_updated_at on quotation_settings;
create trigger trg_quotation_settings_updated_at before update on quotation_settings
  for each row execute function set_updated_at();

-- RLS
alter table leads              enable row level security;
alter table catalog_items      enable row level security;
alter table quote_templates    enable row level security;
alter table quotes             enable row level security;
alter table quotation_settings enable row level security;

-- >>> supabase/migrations/20260618170006_communication.sql

-- ============================================================================
-- 0006 · Communication: chat_messages, complaints, notifications, device_tokens
-- ============================================================================

-- ----------------------------------------------------------------------------
-- chat_messages  (projects/*/chatMessages)
-- ----------------------------------------------------------------------------
create table if not exists chat_messages (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  sender_id           uuid references users(id) on delete set null,
  sender_name         text,
  sender_role         text,
  content             text,
  message_type        text not null default 'text',
  attachment_urls     text[] not null default '{}',
  read_by             uuid[] not null default '{}',
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- complaints  (projects/*/complaints) — project_complaint_model
-- ----------------------------------------------------------------------------
create table if not exists complaints (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  title               text,
  description         text,
  created_by          uuid references users(id) on delete set null,
  created_by_name     text,
  status              text not null default 'open',
  attachments         text[] not null default '{}',
  resolution_note     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- notifications  (top-level `notifications`) — notification_model
-- recipient_id is nullable: legacy docs may target by role/project broadcast.
-- ----------------------------------------------------------------------------
create table if not exists notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_id        uuid references users(id) on delete cascade,
  title               text,
  body                text,
  type                text,
  project_id          uuid references projects(id) on delete cascade,
  project_name        text,
  sender_id           uuid references users(id) on delete set null,
  sender_name         text,
  is_read             boolean not null default false,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- device_tokens  (new) — FCM push tokens per user/device
-- ----------------------------------------------------------------------------
create table if not exists device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  fcm_token   text not null unique,
  platform    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes
create index if not exists idx_chat_project_created on chat_messages(project_id, created_at desc);
create index if not exists idx_complaints_project   on complaints(project_id, created_at desc);
create index if not exists idx_notifications_recipient on notifications(recipient_id, is_read, created_at desc);
create index if not exists idx_device_tokens_user   on device_tokens(user_id);

-- updated_at triggers
drop trigger if exists trg_complaints_updated_at on complaints;
create trigger trg_complaints_updated_at before update on complaints
  for each row execute function set_updated_at();

drop trigger if exists trg_device_tokens_updated_at on device_tokens;
create trigger trg_device_tokens_updated_at before update on device_tokens
  for each row execute function set_updated_at();

-- RLS
alter table chat_messages enable row level security;
alter table complaints    enable row level security;
alter table notifications enable row level security;
alter table device_tokens enable row level security;

-- >>> supabase/migrations/20260618170007_storage_buckets.sql

-- ============================================================================
-- 0007 · Storage buckets (all private; access brokered by the backend via
--         signed URLs using the service_role key)
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('project-files', 'project-files', false),
  ('designs',       'designs',       false),
  ('update-images', 'update-images', false),
  ('quotations',    'quotations',    false),
  ('avatars',       'avatars',       false)
on conflict (id) do nothing;

-- No public storage policies: objects are reachable only through the backend,
-- which issues short-lived signed URLs with the service_role key. Granular
-- per-bucket policies (if ever needed for direct client access) are added in
-- Phase 2 alongside the auth model.

-- >>> supabase/migrations/20260618170008_legacy_user_map.sql

-- ============================================================================
-- 0008 · legacy_user_map — Phase 4 auth migration support
-- A person may exist across the Firestore `users`, `workers`, and `managers`
-- collections under DIFFERENT doc ids but the SAME email → one Supabase auth
-- user. This table records EVERY legacy id → the single PG user it maps to, so
-- the ETL importer can remap all child FKs (posted_by, added_by, …) correctly.
-- ============================================================================

create table if not exists legacy_user_map (
  legacy_firestore_id text primary key,
  user_id             uuid not null references users(id) on delete cascade,
  source              text,                 -- 'users' | 'workers' | 'managers'
  created_at          timestamptz not null default now()
);

create index if not exists idx_legacy_user_map_user on legacy_user_map(user_id);

alter table legacy_user_map enable row level security;
