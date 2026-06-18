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
