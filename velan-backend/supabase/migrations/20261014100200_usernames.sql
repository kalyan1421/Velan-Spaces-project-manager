-- ============================================================================
-- Usernames for staff who have no email (workers log in with username +
-- password). Stored lower-case; unique case-insensitively. Their Supabase Auth
-- account uses a synthetic, non-deliverable email (see staff module), so the
-- username is resolved to that account at login.
-- ============================================================================
alter table users add column if not exists username text;

alter table users drop constraint if exists users_username_format;
alter table users add constraint users_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

create unique index if not exists users_username_unique on users (lower(username))
  where username is not null;
