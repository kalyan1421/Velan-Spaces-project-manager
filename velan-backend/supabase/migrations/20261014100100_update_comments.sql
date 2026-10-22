-- ============================================================================
-- Atomic comment append on a project update (comments live in a jsonb array).
-- A read-modify-write from the API would let two simultaneous comments
-- overwrite each other; `comments || new` in one UPDATE cannot.
-- p_client_only: clients may only comment on client-viewable updates.
-- Returns the new comments array, or NULL when no matching update.
-- ============================================================================
create or replace function append_update_comment(
  p_project_id  uuid,
  p_update_id   uuid,
  p_comment     jsonb,
  p_client_only boolean
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  update project_updates
     set comments = comments || jsonb_build_array(p_comment)
   where id = p_update_id
     and project_id = p_project_id
     and (not p_client_only or is_client_viewable)
  returning comments;
$$;

revoke all on function append_update_comment(uuid, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function append_update_comment(uuid, uuid, jsonb, boolean) to service_role;
