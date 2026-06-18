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
