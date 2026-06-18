-- ============================================================================
-- 0007 · Storage buckets (all private; access brokered by the backend via
--         signed URLs using the service_role key)
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('project-files', 'project-files', false),
  ('designs',       'designs',       false),
  ('update-images', 'update-images', false),
  ('quotations',    'quotations',    false),
  ('avatars',       'avatars',       false)
on conflict (id) do nothing;

-- No public storage policies: objects are reachable only through the backend,
-- which issues short-lived signed URLs with the service_role key. Granular
-- per-bucket policies (if ever needed for direct client access) are added in
-- Phase 2 alongside the auth model.
