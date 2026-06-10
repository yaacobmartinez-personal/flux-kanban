-- Flux Kanban — UPGRADE: keep every organization owned
--
-- Prevents orphaning an org (members but no owner, or no members at all). Run
-- once on a database created before this rule. Idempotent; no-op on fresh
-- installs created from 0001 (which already include it). Touches no data.

-- Detect org deletion so the cascade can pass through the guard below.
create or replace function private.mark_org_deleting() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('flux.deleting_org', old.id::text, true);
  return old;
end;
$$;

drop trigger if exists org_deleting on public.organizations;
create trigger org_deleting before delete on public.organizations
  for each row execute function private.mark_org_deleting();

-- Block any change that would leave the org with zero owners.
create or replace function private.enforce_owner_present() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _org uuid := coalesce(old.org_id, new.org_id);
  _owners integer;
begin
  if current_setting('flux.deleting_org', true) = _org::text then
    return coalesce(new, old);
  end if;

  select count(*) into _owners
  from public.organization_members
  where org_id = _org and role = 'owner' and id <> old.id;

  if tg_op = 'UPDATE' and new.role = 'owner' then
    _owners := _owners + 1;
  end if;

  if _owners = 0 then
    raise exception
      'An organization must always have at least one owner. Make another member an owner first.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_owner_present on public.organization_members;
create trigger enforce_owner_present
  before update or delete on public.organization_members
  for each row execute function private.enforce_owner_present();
