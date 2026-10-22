-- ============================================================================
-- Design approval workflow (spec R-E4) + client-visible project files (R-E1).
--
-- designs: a design that needs approval moves pending -> approved |
--   changes_requested, recording who decided, when and (optionally) why.
--   `approval_approved` stays as the Flutter app's boolean and is kept in
--   sync by a trigger, so old clients, the ETL and the API all agree:
--     approval_approved = (approval_status = 'approved')
--   A write that only flips the boolean (legacy app / ETL re-import) moves the
--   status accordingly; a write that sets the status wins over the boolean.
--
-- files: project files are staff-only unless shared with the client.
--   Existing rows default to hidden (the mobile app never showed files to
--   clients, and files include bills/contracts).
-- Idempotent.
-- ============================================================================

alter table designs add column if not exists approval_status     text not null default 'pending';
alter table designs add column if not exists approval_comment    text;
alter table designs add column if not exists approval_decided_at timestamptz;
alter table designs add column if not exists approval_decided_by uuid references users(id) on delete set null;

do $$ begin
  alter table designs add constraint designs_approval_status_check
    check (approval_status in ('pending', 'approved', 'changes_requested'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table designs add constraint designs_approval_comment_len_check
    check (approval_comment is null or char_length(approval_comment) <= 2000);
exception when duplicate_object then null; end $$;

-- Backfill: rows approved under the boolean-only model.
update designs
   set approval_status = 'approved'
 where approval_approved
   and approval_status <> 'approved';

create or replace function designs_sync_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.approval_approved and new.approval_status = 'pending' then
      new.approval_status := 'approved';
    end if;
  elsif new.approval_status is distinct from old.approval_status then
    null; -- explicit status write wins
  elsif new.approval_approved is distinct from old.approval_approved then
    new.approval_status := case
      when new.approval_approved then 'approved'
      when old.approval_status = 'approved' then 'pending'
      else old.approval_status
    end;
  end if;
  new.approval_approved := (new.approval_status = 'approved');
  return new;
end;
$$;

drop trigger if exists trg_designs_sync_approval on designs;
create trigger trg_designs_sync_approval
  before insert or update on designs
  for each row execute function designs_sync_approval();

-- ----------------------------------------------------------------------------
-- files: client visibility
-- ----------------------------------------------------------------------------
alter table files add column if not exists client_visible boolean not null default false;

create index if not exists idx_files_project_client_visible
  on files(project_id) where client_visible;
