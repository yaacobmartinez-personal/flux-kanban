-- Flux Kanban — full schema, RLS, rate limiting, and realtime
-- Hierarchy: organization → members / projects(spaces) → columns → cards
--
-- Sections:
--   1. Schema (tables + indexes)
--   2. Authorization helpers (SECURITY DEFINER, private schema)
--   3. Triggers + member-invite RPC
--   4. Row Level Security policies
--   5. Rate limiting (per-user/per-action, enforced in triggers)
--   6. Realtime (supabase_realtime publication)
--
-- RLS design notes:
--  * Authorization helpers live in a NON-EXPOSED `private` schema and are
--    SECURITY DEFINER so they bypass RLS on organization_members. This is what
--    prevents the classic "infinite recursion detected in policy" error you get
--    when a policy on organization_members queries organization_members.
--  * Every helper filters by auth.uid() internally, so granting EXECUTE to
--    `authenticated` only ever reveals facts about the *caller's own* access.
--  * No authorization decision reads user_metadata (it is user-editable).

-- ---------------------------------------------------------------------------
-- Teardown: drop everything so this script is safe to re-run from scratch.
-- CASCADE on tables removes their policies, indexes, and dependent triggers.
-- `drop schema private cascade` removes the auth helpers AND the rate-limit
-- objects (rate_limits table + functions) that live in that schema.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.card_activity        cascade;
drop table if exists public.comments             cascade;
drop table if exists public.cards                cascade;
drop table if exists public.columns              cascade;
drop table if exists public.projects             cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.organizations        cascade;
drop table if exists public.profiles             cascade;

drop function if exists public.handle_new_user();
drop function if exists public.handle_new_org();
drop function if exists public.add_org_member(uuid, text, text);

drop schema if exists private cascade;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Private schema for security-definer helpers (auth + rate limiting)
-- ---------------------------------------------------------------------------
create schema if not exists private;

-- ===========================================================================
-- 1. SCHEMA
-- ===========================================================================

-- Mirror of auth.users we can safely expose / embed in PostgREST joins.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table if not exists public.organization_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','admin','member')),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  key         text not null check (char_length(key) between 1 and 8),
  description text,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table if not exists public.columns (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null default 'New column',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.cards (
  id           uuid primary key default gen_random_uuid(),
  column_id    uuid not null references public.columns (id) on delete cascade,
  title        text not null default 'Untitled',
  description  text not null default '',
  color        text not null default 'none',
  due_date     date,
  position     integer not null default 0,
  created_by   uuid references public.profiles (id),
  assignee_id  uuid references public.profiles (id) on delete set null,
  reporter_id  uuid references public.profiles (id) on delete set null,
  epic_id      uuid references public.cards (id) on delete set null,
  story_points integer check (story_points is null or story_points >= 0),
  links        jsonb not null default '[]',
  label_text   text,
  closed_at    timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.card_activity (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  type       text not null,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_members_org    on public.organization_members (org_id);
create index if not exists idx_members_user    on public.organization_members (user_id);
create index if not exists idx_projects_org    on public.projects (org_id);
create index if not exists idx_columns_project on public.columns (project_id);
create index if not exists idx_cards_column    on public.cards (column_id);
create index if not exists idx_comments_card        on public.comments (card_id);
create index if not exists idx_card_activity_card   on public.card_activity (card_id, created_at desc);

-- ===========================================================================
-- 2. AUTHORIZATION HELPERS (SECURITY DEFINER, private schema)
-- ===========================================================================
create or replace function private.is_org_member(_org uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = _org and m.user_id = auth.uid()
  );
$$;

create or replace function private.has_org_role(_org uuid, _roles text[])
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = _org and m.user_id = auth.uid() and m.role = any (_roles)
  );
$$;

create or replace function private.can_access_project(_project uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members m on m.org_id = p.org_id
    where p.id = _project and m.user_id = auth.uid()
  );
$$;

create or replace function private.can_access_column(_column uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1
    from public.columns c
    join public.projects p on p.id = c.project_id
    join public.organization_members m on m.org_id = p.org_id
    where c.id = _column and m.user_id = auth.uid()
  );
$$;

create or replace function private.shares_org(_other uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members them on them.org_id = me.org_id
    where me.user_id = auth.uid() and them.user_id = _other
  );
$$;

create or replace function private.can_access_card(_card uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1
    from public.cards c
    join public.columns col on col.id = c.column_id
    join public.projects p   on p.id   = col.project_id
    join public.organization_members m on m.org_id = p.org_id
    where c.id = _card and m.user_id = auth.uid()
  );
$$;

-- Policy expressions are evaluated as the invoking role, so authenticated
-- needs USAGE on the schema + EXECUTE on the helpers. anon never does.
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ===========================================================================
-- 3. TRIGGERS + MEMBER-INVITE RPC
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_members (org_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (org_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_org_created
  after insert on public.organizations
  for each row execute function public.handle_new_org();

-- A new invitee is not yet a co-member, so the caller cannot SELECT their
-- profile under RLS — hence a definer RPC that does the lookup + insert after
-- verifying the caller's role.
create or replace function public.add_org_member(_org uuid, _email text, _role text default 'member')
returns json language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid;
begin
  if not private.has_org_role(_org, array['owner','admin']) then
    raise exception 'Only owners and admins can add members';
  end if;
  if _role not in ('owner','admin','member') then
    raise exception 'Invalid role: %', _role;
  end if;

  select id into _uid from public.profiles where lower(email) = lower(_email);
  if _uid is null then
    raise exception 'No Flux account exists for %. Ask them to sign up first.', _email;
  end if;

  insert into public.organization_members (org_id, user_id, role)
  values (_org, _uid, _role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  return json_build_object('user_id', _uid, 'email', _email, 'role', _role);
end;
$$;

revoke execute on function public.add_org_member(uuid, text, text) from public;
grant execute on function public.add_org_member(uuid, text, text) to authenticated;

-- ===========================================================================
-- 4. ROW LEVEL SECURITY
-- ===========================================================================
alter table public.profiles             enable row level security;
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects             enable row level security;
alter table public.columns              enable row level security;
alter table public.cards                enable row level security;
alter table public.comments             enable row level security;
alter table public.card_activity        enable row level security;

-- profiles -------------------------------------------------------------------
create policy "profiles: read self or co-members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_org(id));

create policy "profiles: insert self" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations --------------------------------------------------------------
create policy "orgs: members read" on public.organizations
  for select to authenticated
  using (private.is_org_member(id));

create policy "orgs: any authenticated can create" on public.organizations
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "orgs: owners/admins update" on public.organizations
  for update to authenticated
  using (private.has_org_role(id, array['owner','admin']))
  with check (private.has_org_role(id, array['owner','admin']));

create policy "orgs: owners delete" on public.organizations
  for delete to authenticated
  using (private.has_org_role(id, array['owner']));

-- organization_members -------------------------------------------------------
create policy "members: co-members read" on public.organization_members
  for select to authenticated
  using (private.is_org_member(org_id));

create policy "members: owners/admins add" on public.organization_members
  for insert to authenticated
  with check (private.has_org_role(org_id, array['owner','admin']));

create policy "members: owners/admins change role" on public.organization_members
  for update to authenticated
  using (private.has_org_role(org_id, array['owner','admin']))
  with check (private.has_org_role(org_id, array['owner','admin']));

create policy "members: admins remove or self-leave" on public.organization_members
  for delete to authenticated
  using (
    private.has_org_role(org_id, array['owner','admin'])
    or user_id = (select auth.uid())
  );

-- projects -------------------------------------------------------------------
create policy "projects: members read" on public.projects
  for select to authenticated
  using (private.is_org_member(org_id));

create policy "projects: members create" on public.projects
  for insert to authenticated
  with check (private.is_org_member(org_id) and created_by = (select auth.uid()));

create policy "projects: members update" on public.projects
  for update to authenticated
  using (private.is_org_member(org_id))
  with check (private.is_org_member(org_id));

create policy "projects: owners/admins delete" on public.projects
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner','admin']));

-- columns --------------------------------------------------------------------
create policy "columns: project members read" on public.columns
  for select to authenticated
  using (private.can_access_project(project_id));

create policy "columns: project members write" on public.columns
  for insert to authenticated
  with check (private.can_access_project(project_id));

create policy "columns: project members update" on public.columns
  for update to authenticated
  using (private.can_access_project(project_id))
  with check (private.can_access_project(project_id));

create policy "columns: project members delete" on public.columns
  for delete to authenticated
  using (private.can_access_project(project_id));

-- cards ----------------------------------------------------------------------
create policy "cards: members read" on public.cards
  for select to authenticated
  using (private.can_access_column(column_id));

create policy "cards: members create" on public.cards
  for insert to authenticated
  with check (private.can_access_column(column_id));

create policy "cards: members update" on public.cards
  for update to authenticated
  using (private.can_access_column(column_id))
  with check (private.can_access_column(column_id));

create policy "cards: members delete" on public.cards
  for delete to authenticated
  using (private.can_access_column(column_id));

-- comments -------------------------------------------------------------------
create policy "comments: members read" on public.comments
  for select to authenticated
  using (private.can_access_card(card_id));

create policy "comments: members create" on public.comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_access_card(card_id));

create policy "comments: own update" on public.comments
  for update to authenticated
  using  (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "comments: own delete" on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()));

-- card_activity ---------------------------------------------------------------
create policy "activity: members read" on public.card_activity
  for select to authenticated
  using (private.can_access_card(card_id));

create policy "activity: members create" on public.card_activity
  for insert to authenticated
  with check (actor_id = (select auth.uid()) and private.can_access_card(card_id));

-- ===========================================================================
-- 5. RATE LIMITING (server-side, non-bypassable)
--
-- The client limiter in src/lib/supabase.js only smooths bursts; a hand-crafted
-- REST call ignores it. Here, per-user/per-action counters are enforced inside
-- BEFORE INSERT triggers.
--
-- How a rejection surfaces: we RAISE with SQLSTATE 'PT429'. PostgREST maps
-- PTxyz codes to HTTP status xyz, so the client receives a real HTTP 429. The
-- hint ('RATE_LIMIT') lets the client tell our limit apart from a platform one.
-- ===========================================================================

-- One row per (user, action); a fixed window that resets when it elapses.
create table private.rate_limits (
  user_id      uuid not null,
  action       text not null,
  window_start timestamptz not null default now(),
  count        integer not null default 0,
  primary key (user_id, action)
);

-- Increments the caller's counter for `action`. If it exceeds `max` within
-- `window`, raises PT429 — which also rolls back the increment, so blocked
-- attempts don't inflate the counter past the ceiling.
create function private.check_rate_limit(_action text, _max integer, _window interval)
returns void language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _now timestamptz := clock_timestamp();
  _cnt integer;
begin
  -- No JWT (service role, internal jobs) → not subject to per-user limits.
  if _uid is null then
    return;
  end if;

  insert into private.rate_limits as r (user_id, action, window_start, count)
  values (_uid, _action, _now, 1)
  on conflict (user_id, action) do update
    set count = case when r.window_start < _now - _window then 1 else r.count + 1 end,
        window_start = case when r.window_start < _now - _window then _now else r.window_start end
  returning count into _cnt;

  if _cnt > _max then
    raise sqlstate 'PT429'
      using message = format('Rate limit reached for %s. Please slow down and retry shortly.', _action),
            hint = 'RATE_LIMIT';
  end if;
end;
$$;

-- Not granted to authenticated: triggers call it within the table-owner context.
revoke all on function private.check_rate_limit(text, integer, interval) from public;

-- Trigger wrappers. Limits are generous enough never to bother a real user.
-- Only INSERTs are throttled — a single legitimate drag of a long column issues
-- many position UPDATEs in one batch and must not be rejected.
create function private.rl_cards() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_rate_limit('card_insert', 120, interval '1 minute');
  return new;
end;
$$;

create function private.rl_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_rate_limit('comment_insert', 30, interval '1 minute');
  return new;
end;
$$;

create function private.rl_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_rate_limit('activity_insert', 300, interval '1 minute');
  return new;
end;
$$;

create function private.rl_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_rate_limit('column_insert', 40, interval '1 minute');
  return new;
end;
$$;

create trigger rl_before_insert before insert on public.cards
  for each row execute function private.rl_cards();

create trigger rl_before_insert before insert on public.comments
  for each row execute function private.rl_comments();

create trigger rl_before_insert before insert on public.card_activity
  for each row execute function private.rl_activity();

create trigger rl_before_insert before insert on public.columns
  for each row execute function private.rl_columns();

-- ===========================================================================
-- 6. REALTIME
--
-- Add the board tables to the supabase_realtime publication so clients can
-- subscribe to Postgres changes. RLS still applies: a user only receives change
-- events for rows they're allowed to SELECT.
-- ===========================================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'columns') then
    alter publication supabase_realtime add table public.columns;
  end if;

  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cards') then
    alter publication supabase_realtime add table public.cards;
  end if;

  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments') then
    alter publication supabase_realtime add table public.comments;
  end if;

  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'card_activity') then
    alter publication supabase_realtime add table public.card_activity;
  end if;
end $$;
