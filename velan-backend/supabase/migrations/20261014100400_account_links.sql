-- ============================================================================
-- One-time account links: client invitations and admin-issued password
-- resets (workers have no email, so resets are links the admin shares).
-- Only a SHA-256 hash of the token is stored; the raw token exists only in
-- the link handed to the person. A link is single-use (used_at) and expires.
-- ============================================================================
create table if not exists account_links (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  kind         text not null check (kind in ('client_invite', 'password_reset')),
  -- password_reset: whose password; client_invite: null until accepted
  user_id      uuid references users(id) on delete cascade,
  -- client_invite details
  email        text,
  display_name text,
  phone        text,
  project_id   uuid references projects(id) on delete cascade,
  created_by   uuid references users(id) on delete set null,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_account_links_user on account_links(user_id);
create index if not exists idx_account_links_project on account_links(project_id);

alter table account_links enable row level security;
