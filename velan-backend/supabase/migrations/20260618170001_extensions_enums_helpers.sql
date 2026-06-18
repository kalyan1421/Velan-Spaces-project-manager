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
