# Security Model

How Flux keeps each organization's data isolated, and the specific Supabase
footguns this schema is built to avoid. The authoritative source is
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — this
document explains *why* it looks the way it does.

---

## 1. Trust boundary

The browser is **untrusted**. The app ships with the Supabase **publishable /
anon key**, which is expected — it only identifies the project. The actual
authorization boundary is **Postgres Row Level Security (RLS)**: every table is
RLS-enabled, and a request can only read or write rows the signed-in user is
allowed to.

- ✅ The anon key in `.env.local` / the bundle is safe.
- ❌ The `service_role` key must **never** appear in a `VITE_` variable or any
  client code — it bypasses RLS entirely. It is not used anywhere in this repo.

If RLS were misconfigured, the anon key would be enough for anyone to read every
row. So the policies below are the whole game.

---

## 2. Data isolation model

Access is derived from **organization membership**, not from row ownership:

```
auth.users ──1:1──> profiles
organizations ──< organization_members >── profiles      (who is in the org + role)
organizations ──< projects ──< columns ──< cards          (the data)
```

A user may touch a `card` only if they are a member of the organization that
(transitively) owns it: `cards → columns → projects → organizations → organization_members`.

Roles: **owner**, **admin**, **member**.

| Action | member | admin | owner |
|---|---|---|---|
| Read org, projects, columns, cards | ✅ | ✅ | ✅ |
| Create / edit projects, columns, cards | ✅ | ✅ | ✅ |
| Add / remove members, change roles | ❌ | ✅ | ✅ |
| Delete a project | ❌ | ✅ | ✅ |
| Update org settings | ❌ | ✅ | ✅ |
| Delete the organization | ❌ | ❌ | ✅ |
| Leave the org (delete own membership) | ✅ | ✅ | ✅ |

These are enforced in the database, not just the UI. The UI hides controls a
user can't use, but even a hand-crafted API call is rejected by RLS.

---

## 3. The recursion problem (and the fix)

The natural policy for `organization_members` is "you can see a membership row if
you are a member of that org." But expressed directly:

```sql
-- DON'T: this policy on organization_members queries organization_members
create policy "..." on organization_members for select
using (exists (select 1 from organization_members m
               where m.org_id = organization_members.org_id
                 and m.user_id = auth.uid()));
```

…Postgres evaluates the inner `select` against the same table, which re-triggers
the same policy → **"infinite recursion detected in policy for relation
organization_members."**

**Fix:** move the membership lookup into `SECURITY DEFINER` helper functions in a
private, non-exposed schema. A definer function runs as its owner and **bypasses
RLS**, so the inner read doesn't re-enter the policy:

```sql
create schema private;

create function private.is_org_member(_org uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = _org and m.user_id = auth.uid()
  );
$$;
```

Policies then call `private.is_org_member(org_id)` / `private.has_org_role(...)`
instead of an inline subquery. The same helpers resolve project/column access by
joining up to the org (`can_access_project`, `can_access_column`).

### Why this is still safe

`SECURITY DEFINER` is dangerous when misused (it removes access checks), so:

- **Every helper filters by `auth.uid()` internally.** Callers can't pass an
  arbitrary user id — the function only ever answers "does *the caller* have
  access to X?" Granting `EXECUTE` to `authenticated` therefore leaks nothing.
- **The helpers live in a `private` schema that is not exposed to the Data API**,
  so they can't be called as RPC endpoints — only referenced inside policies.
- **`set search_path = ''`** forces every object to be schema-qualified
  (`public.…`, `auth.uid()`), closing search-path hijacking.
- They are `stable` and side-effect free.

> Rule of thumb honored here: never reach for `SECURITY DEFINER` just to make a
> permission error go away. It's used deliberately and narrowly, for the
> recursion break, with an `auth.uid()` check in every body.

---

## 4. Policy correctness details

- **Every table has RLS enabled.** Tables in an exposed schema are reachable via
  the Data API once the `authenticated` role has access, so RLS is the only thing
  standing between a user and other orgs' rows.
- **Policies are `TO authenticated` *plus* a predicate.** `TO authenticated`
  alone is authentication without authorization (the BOLA/IDOR trap) — it checks
  that you're logged in, not which rows you may see. Each policy pairs the role
  with a membership/ownership predicate.
- **Every `UPDATE` policy has both `USING` and `WITH CHECK`.** `USING` controls
  which rows you may target; `WITH CHECK` controls what the row may look like
  afterward. Without `WITH CHECK`, a user could, e.g., reassign a row to another
  org. (Also note: an `UPDATE` needs a `SELECT`-able row first — the read policies
  cover that.)
- **No authorization decision reads `user_metadata`.** `raw_user_meta_data` is
  user-editable and can appear in the JWT, so it's unsafe for authz. Roles live in
  `organization_members`, a server-controlled table.
- **No security-relevant views.** (Views bypass RLS by default unless created
  `WITH (security_invoker = true)`; this schema doesn't rely on any.)

---

## 5. Triggers and the member-invite RPC

Two `SECURITY DEFINER` triggers provision rows the user can't insert directly
under RLS, which is the correct, narrow use of definer rights:

- `handle_new_user()` (on `auth.users` insert) → creates the `profiles` row.
- `handle_new_org()` (on `organizations` insert) → makes the creator an `owner`
  in `organization_members`, so a freshly created org is immediately usable.

**Adding a member** can't be a plain `INSERT`: a brand-new invitee is not yet a
co-member, so the admin can't even `SELECT` their `profiles` row to find their id
under RLS. So `public.add_org_member(_org, _email, _role)`:

1. Verifies the **caller** is an owner/admin of `_org` (`private.has_org_role`).
2. Validates the role value.
3. Looks up the invitee's `profiles.id` by email.
4. Inserts (or updates) the membership.

It's `SECURITY DEFINER` but begins with a caller-authorization check, and
`EXECUTE` is **revoked from `public` and granted only to `authenticated`**. A
person must already have a Flux account to be added (no email-invite flow yet).

---

## 6. Auth / session notes

- Sessions are managed by `supabase-js` (`persistSession`, `autoRefreshToken`).
- Deleting a user in Supabase does **not** instantly invalidate existing access
  tokens. For stricter guarantees, keep JWT expiry short and revoke sessions on
  sensitive changes. (Not wired up here — noted for production.)
- `app_metadata` / JWT claims aren't refreshed until the user's token refreshes,
  which is another reason roles are read from the `organization_members` table at
  query time rather than from the JWT.

---

## 7. Operational checklist

After any schema change, before shipping:

```bash
supabase db advisors        # CLI v2.81.3+  (or MCP get_advisors)
```

- [ ] RLS enabled on every new table in `public`.
- [ ] New policies are `TO authenticated` **and** carry a membership predicate.
- [ ] Every `UPDATE` policy has both `USING` and `WITH CHECK`.
- [ ] Any new `SECURITY DEFINER` function: lives in `private` (or has an internal
      `auth.uid()` check if it must be in `public`), uses `set search_path = ''`,
      and has `EXECUTE` scoped to `authenticated`.
- [ ] No authz logic reads `user_metadata`.
- [ ] `service_role` key is not referenced in any client/`VITE_` code.

---

## Reporting

This is a demo project. For a real deployment, route security reports to a
monitored address and rotate the Supabase keys if the `service_role` key is ever
exposed.
