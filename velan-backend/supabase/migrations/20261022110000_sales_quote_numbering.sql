-- ============================================================================
-- Sales: server-assigned quote numbers + lead delete cascade.
--
-- Quote numbers are "<prefix>-<YYYY>-<NNNN>" (formatted by the API). The
-- sequence is per calendar year (Asia/Kolkata), shared across prefixes — the
-- same rule the mobile app used (Firestore counter doc per year).
--
-- next_quote_seq() is atomic: the upsert takes a row lock on the year's
-- counter, so concurrent callers queue and each gets a distinct number. It
-- also never hands out a number at or below the highest "<YYYY>-<NNNN>"
-- already stored in quotes, so rows imported later from Firestore (ETL runs
-- after this migration) cannot collide with new numbers.
-- ============================================================================

create table if not exists quote_number_counters (
  year       int primary key,
  last_seq   int not null default 0,
  updated_at timestamptz not null default now()
);

alter table quote_number_counters enable row level security;

create or replace function next_quote_seq(p_year int)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing int;
  v_seq      int;
begin
  if p_year is null or p_year < 2000 or p_year > 2999 then
    raise exception 'invalid quote year %', p_year;
  end if;

  select coalesce(max((substring(q.quote_number from '(\d+)$'))::int), 0)
    into v_existing
    from quotes q
   where q.quote_number ~ ('(^|[^0-9])' || p_year::text || '-[0-9]{1,9}$');

  insert into quote_number_counters as c (year, last_seq, updated_at)
  values (p_year, v_existing + 1, now())
  on conflict (year) do update
     set last_seq   = greatest(c.last_seq, v_existing) + 1,
         updated_at = now()
  returning c.last_seq into v_seq;

  return v_seq;
end;
$$;

revoke all on function next_quote_seq(int) from public, anon, authenticated;
grant execute on function next_quote_seq(int) to service_role;

-- Quotes belong to their lead (the mobile app stored them as a subcollection
-- of the lead document): deleting a lead deletes its quotes.
alter table quotes drop constraint if exists quotes_lead_id_fkey;
alter table quotes
  add constraint quotes_lead_id_fkey
  foreign key (lead_id) references leads(id) on delete cascade;

create index if not exists idx_quotes_created_at on quotes(created_at desc);
create index if not exists idx_leads_created_at  on leads(created_at desc);
