-- ============================================================================
-- 0004 · Financials: budget_transactions, settlements, expenses, counters
-- All money is numeric(14,2) — never float.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- budget_transactions  (projects/*/budgetTransactions)
-- ----------------------------------------------------------------------------
create table if not exists budget_transactions (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  type                budget_txn_type not null default 'debit',
  amount              numeric(14,2) not null default 0,
  description         text,
  txn_date            date,
  added_by            uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- settlements  (projects/*/settlements) — settlement_model
-- ----------------------------------------------------------------------------
create table if not exists settlements (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  description         text,
  amount              numeric(14,2) not null default 0,
  settlement_date     date,
  paid_to_name        text,                          -- Firestore `paidToName`
  mode                text,                          -- payment method
  created_by          uuid references users(id) on delete set null,
  proof_url           text,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- expenses  (expense_model; carries projectId/projectName denormalized)
-- ----------------------------------------------------------------------------
create table if not exists expenses (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references projects(id) on delete cascade,
  type                text not null default 'debit',
  amount              numeric(14,2) not null default 0,
  expense_date        date,
  account_details     text,
  category            text not null default 'other',
  payment_method      text,
  proof_url           text,
  created_at          timestamptz not null default now(),
  legacy_firestore_id text unique
);

-- ----------------------------------------------------------------------------
-- counters  (replaces the Firestore `counters` doc for sequential codes)
-- ----------------------------------------------------------------------------
create table if not exists counters (
  key   text primary key,
  value bigint not null default 0
);

-- Atomic counter increment helper (avoids race conditions on code generation)
create or replace function next_counter(p_key text)
returns bigint
language plpgsql
as $$
declare
  v bigint;
begin
  insert into counters(key, value) values (p_key, 1)
  on conflict (key) do update set value = counters.value + 1
  returning value into v;
  return v;
end;
$$;

-- Indexes
create index if not exists idx_budget_txn_project on budget_transactions(project_id, created_at desc);
create index if not exists idx_settlements_project on settlements(project_id, created_at desc);
create index if not exists idx_expenses_project    on expenses(project_id, created_at desc);

-- RLS
alter table budget_transactions enable row level security;
alter table settlements         enable row level security;
alter table expenses            enable row level security;
alter table counters            enable row level security;
