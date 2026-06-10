-- Flux Kanban — UPGRADE: per-project ticket numbers (KEY-N)
--
-- Run this ONCE on a database that was created before ticket numbers existed.
-- It is idempotent and a no-op on fresh installs created from 0001 (which
-- already include everything here). It does NOT drop or recreate any data.

-- 1. Columns -----------------------------------------------------------------
alter table public.projects add column if not exists card_seq integer not null default 0;
alter table public.cards    add column if not exists number   integer;

-- 2. Trigger that assigns the next per-project number on insert --------------
create or replace function private.assign_card_number() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _project uuid;
  _n integer;
begin
  if new.number is not null then
    return new;
  end if;
  select col.project_id into _project from public.columns col where col.id = new.column_id;
  update public.projects set card_seq = card_seq + 1 where id = _project returning card_seq into _n;
  new.number := _n;
  return new;
end;
$$;

drop trigger if exists assign_card_number on public.cards;
create trigger assign_card_number before insert on public.cards
  for each row execute function private.assign_card_number();

-- 3. Backfill existing cards: number them per project in creation order -------
with ordered as (
  select c.id,
         row_number() over (
           partition by col.project_id
           order by c.created_at, c.id
         ) as rn
  from public.cards c
  join public.columns col on col.id = c.column_id
)
update public.cards c
set number = o.rn
from ordered o
where c.id = o.id and c.number is null;

-- 4. Set each project's counter to its current max so new cards continue on ---
update public.projects p
set card_seq = coalesce((
  select max(c.number)
  from public.cards c
  join public.columns col on col.id = c.column_id
  where col.project_id = p.id
), 0);
