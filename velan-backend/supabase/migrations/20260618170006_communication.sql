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
