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
