-- ============================================================================
-- Budget: one definition of "spent" (product decision 2026-10-14):
--   current_spend = all settlements + expense debits.
-- Expense credits are income (e.g. client payments) and are reported
-- separately; they do not reduce spend. budget_transactions is a legacy table
-- the app never used and no longer counts.
-- ============================================================================
alter table expenses add column if not exists created_by uuid references users(id) on delete set null;

create or replace function recompute_project_spend(p_project_id uuid)
returns numeric
language sql
security invoker
set search_path = public
as $$
  update projects p
     set current_spend =
           coalesce((select sum(s.amount) from settlements s where s.project_id = p_project_id), 0)
         + coalesce((select sum(e.amount) from expenses e
                      where e.project_id = p_project_id and e.type = 'debit'), 0),
         updated_at = now()
   where p.id = p_project_id
  returning p.current_spend;
$$;

revoke all on function recompute_project_spend(uuid) from public, anon, authenticated;
grant execute on function recompute_project_spend(uuid) to service_role;

create index if not exists idx_expenses_project_date on expenses(project_id, expense_date);
