-- ============================================================================
-- 20261014200000 · Public website: portfolio_items + public `portfolio` bucket
-- ============================================================================
-- * Read publicly through the API (GET /public/portfolio, published only);
--   written by head users through the API. Like every other table, RLS is
--   enabled with no policies (default-deny) and the API uses service_role.
-- * Images live in the PUBLIC `portfolio` bucket (served directly by Storage
--   at /storage/v1/object/public/portfolio/...). Uploads only happen through
--   signed upload URLs issued by the API (head only); the bucket enforces the
--   size limit and image MIME allow-list on upload.
-- * Idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- portfolio_items
-- ----------------------------------------------------------------------------
create table if not exists portfolio_items (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique
                        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title               text not null check (char_length(title) between 1 and 200),
  description         text,
  category            text not null default 'residential'
                        check (category in ('residential', 'commercial', 'office', 'kitchen', 'other')),
  location            text,
  completion_year     int check (completion_year between 1990 and 2100),
  cover_image_url     text,
  image_urls          text[] not null default '{}',
  status              text not null default 'draft'
                        check (status in ('draft', 'published', 'hidden')),
  sort_order          int not null default 0,
  project_id          uuid references projects(id) on delete set null,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);
comment on table portfolio_items is
  'Website portfolio (public site). Public API returns status = published only.';

-- Indexes
-- Public list: where status = 'published' order by sort_order, created_at desc
create index if not exists idx_portfolio_items_status_order
  on portfolio_items(status, sort_order, created_at desc);
-- Public list filtered by category (?category=)
create index if not exists idx_portfolio_items_category
  on portfolio_items(category, sort_order, created_at desc)
  where status = 'published';
-- FK columns (keeps ON DELETE SET NULL from projects/users cheap)
create index if not exists idx_portfolio_items_project    on portfolio_items(project_id);
create index if not exists idx_portfolio_items_created_by on portfolio_items(created_by);

-- updated_at trigger
drop trigger if exists trg_portfolio_items_updated_at on portfolio_items;
create trigger trg_portfolio_items_updated_at before update on portfolio_items
  for each row execute function set_updated_at();

-- RLS (default-deny; backend uses service_role)
alter table portfolio_items enable row level security;

-- ----------------------------------------------------------------------------
-- portfolio_reorder(ids): sort_order = position in the array (0-based), in one
-- statement/transaction. Raises (and rolls back) if any id is unknown or
-- duplicated, so a reorder is all-or-nothing. Called by PUT /portfolio/order.
-- ----------------------------------------------------------------------------
create or replace function public.portfolio_reorder(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer := coalesce(cardinality(p_ids), 0);
  v_updated  integer;
begin
  if v_expected = 0 then
    return 0;
  end if;

  update public.portfolio_items as p
     set sort_order = (o.ord - 1)::int
    from unnest(p_ids) with ordinality as o(id, ord)
   where p.id = o.id;
  get diagnostics v_updated = row_count;

  if v_updated <> v_expected then
    raise exception 'portfolio_reorder: % of % ids matched', v_updated, v_expected
      using errcode = 'P0002';
  end if;
  return v_updated;
end;
$$;

-- Only the backend (service_role) may call it; never exposed to anon/authenticated via PostgREST.
revoke all on function public.portfolio_reorder(uuid[]) from public;
revoke all on function public.portfolio_reorder(uuid[]) from anon, authenticated;
grant execute on function public.portfolio_reorder(uuid[]) to service_role;

-- ----------------------------------------------------------------------------
-- Storage bucket `portfolio` — PUBLIC read, 10 MB, images only.
-- `do update` (unlike 0007) so re-running re-asserts the limits.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio',
  'portfolio',
  true,
  10485760,                                                   -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies: public reads of a public bucket need none, and
-- writes happen only through API-issued signed upload URLs (service_role).
