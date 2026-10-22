-- ============================================================================
-- Notification deep links (web + mobile route a notification to its source).
--
-- `type` stays free text (legacy Firestore rows carry other values such as
-- settlement / status_change / assignment / worker). Server-side triggers use:
--   update | design | design_approval | chat | complaint | task | lead | invite | system
--
-- New columns (additive, nullable):
--   lead_id   — the sales lead a `lead` notification is about (deleted with it)
--   entity_id — id of the row that triggered it (update, design, chat message,
--               complaint, timeline task, …); no FK, the row may be gone.
-- ============================================================================

alter table notifications add column if not exists lead_id   uuid references leads(id) on delete cascade;
alter table notifications add column if not exists entity_id text;

create index if not exists idx_notifications_lead on notifications(lead_id) where lead_id is not null;

comment on column notifications.type is
  'update | design | design_approval | chat | complaint | task | lead | invite | system (legacy rows may hold other values)';
comment on column notifications.lead_id is 'Sales lead a lead notification links to.';
comment on column notifications.entity_id is 'Id of the row that triggered the notification (update, design, message, complaint, task).';
