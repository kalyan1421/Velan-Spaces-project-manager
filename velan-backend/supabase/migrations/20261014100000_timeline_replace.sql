-- ============================================================================
-- Timeline: task ordering + atomic "save whole timeline".
--
-- The app edits the plan locally and saves it as a whole (phases with nested
-- tasks). Doing delete + re-insert as separate API calls could lose the plan if
-- an insert failed half way, so the replace runs inside one function call
-- (one transaction). Ids sent by the app are kept, so they stay stable across
-- saves; missing ids get a fresh uuid.
-- ============================================================================

alter table timeline_tasks add column if not exists order_index int not null default 0;
create index if not exists idx_tasks_phase_order on timeline_tasks(phase_id, order_index);

create or replace function replace_project_timeline(p_project_id uuid, p_phases jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  ph         jsonb;
  tk         jsonb;
  ph_idx     int := 0;
  tk_idx     int;
  v_phase_id uuid;
begin
  -- Cascades to timeline_tasks.
  delete from timeline_phases where project_id = p_project_id;

  for ph in select value from jsonb_array_elements(coalesce(p_phases, '[]'::jsonb)) loop
    v_phase_id := coalesce(nullif(ph->>'id', '')::uuid, gen_random_uuid());

    insert into timeline_phases (
      id, project_id, name, start_date, end_date, status, order_index, notes,
      created_at, updated_at
    ) values (
      v_phase_id,
      p_project_id,
      coalesce(nullif(ph->>'name', ''), 'Unnamed Phase'),
      (ph->>'startDate')::timestamptz,
      (ph->>'endDate')::timestamptz,
      coalesce(nullif(ph->>'status', ''), 'pending'),
      ph_idx,
      ph->>'notes',
      coalesce((ph->>'createdAt')::timestamptz, now()),
      now()
    );

    tk_idx := 0;
    for tk in select value from jsonb_array_elements(coalesce(ph->'tasks', '[]'::jsonb)) loop
      insert into timeline_tasks (
        id, phase_id, project_id, title, description, status, priority,
        planned_start, planned_end, actual_start, actual_end,
        assigned_worker_id, room_id, checklist_items, comments, photo_proof_urls,
        order_index, created_at, updated_at
      ) values (
        coalesce(nullif(tk->>'id', '')::uuid, gen_random_uuid()),
        v_phase_id,
        p_project_id,
        coalesce(nullif(tk->>'title', ''), 'Untitled task'),
        tk->>'description',
        coalesce(nullif(tk->>'status', ''), 'pending'),
        coalesce(nullif(tk->>'priority', ''), 'medium'),
        (tk->>'plannedStart')::timestamptz,
        (tk->>'plannedEnd')::timestamptz,
        (tk->>'actualStart')::timestamptz,
        (tk->>'actualEnd')::timestamptz,
        nullif(tk->>'assignedWorkerId', '')::uuid,
        nullif(tk->>'roomId', '')::uuid,
        coalesce(tk->'checklistItems', '[]'::jsonb),
        coalesce(tk->'comments', '[]'::jsonb),
        coalesce(
          array(select jsonb_array_elements_text(coalesce(tk->'photoProofUrls', '[]'::jsonb))),
          '{}'::text[]
        ),
        tk_idx,
        coalesce((tk->>'createdAt')::timestamptz, now()),
        now()
      );
      tk_idx := tk_idx + 1;
    end loop;

    ph_idx := ph_idx + 1;
  end loop;
end;
$$;

-- Backend (service role) only; never callable by app/anon tokens.
revoke all on function replace_project_timeline(uuid, jsonb) from public, anon, authenticated;
grant execute on function replace_project_timeline(uuid, jsonb) to service_role;
