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
