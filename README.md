# Flux — Team Kanban

A polished, multi-tenant Kanban board. React (Vite) + Tailwind v4 + @dnd-kit +
Zustand + motion/react, backed by **Supabase** for auth and storage.

- **Auth** — email/password (Supabase Auth)
- **Organizations** with **members & roles** (owner / admin / member) — Jira-style
- **Projects (spaces)** per organization, each with its own board
- **Columns & cards** — create / rename / delete, drag between columns and reorder,
  with title, description, color label, and due date
- **Light / Dark / System** theme switching (no flash on load)
- **Row Level Security** so members only ever see their own organizations' data

---

## 1. Prerequisites

- Node 18+ and npm
- A Supabase project (free tier is fine) — https://supabase.com/dashboard

## 2. Install

```bash
npm install
```

## 3. Create the database schema

The full schema, triggers, and RLS policies live in
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

**Option A — Supabase SQL Editor (quickest):**

1. Open your project → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/migrations/0001_init.sql`.
3. **Run**.

**Option B — Supabase CLI:**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

> The migration enables RLS on every table and creates `SECURITY DEFINER` helper
> functions in a private `private` schema to evaluate membership without the
> classic "infinite recursion in policy" error. Don't move those helpers into a
> public/exposed schema.

## 4. Configure auth

In the dashboard → **Authentication → Providers → Email**:

- Enable **Email** sign-in.
- For local testing, you may turn **"Confirm email"** off so new sign-ups can log
  in immediately. Leave it on for production.

## 5. Add environment variables

Copy the example and fill in your project's values
(**Project Settings → API**):

```bash
cp .env.example .env.local
```

```ini
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

> Use the **publishable / anon** key — it is safe in the browser because RLS
> protects the data. **Never** put the `service_role` key in a `VITE_` variable;
> anything prefixed `VITE_` is shipped to the client.

## 6. Run

```bash
npm run dev      # http://localhost:5173
npm run build    # production build
npm run preview  # preview the build
```

On first run: sign up → create an organization → create a project → start adding
cards. Invite teammates from **Members** (they must have signed up first).

---

## How it fits together

| Concept       | Table                   | Notes |
|---------------|-------------------------|-------|
| Organization  | `organizations`         | Creator becomes `owner` via trigger |
| Membership    | `organization_members`  | `role` ∈ owner / admin / member; unique per (org, user) |
| Project/Space | `projects`              | Belongs to an org; has a short `key` (e.g. `MKT`) |
| Column        | `columns`               | Ordered by `position` |
| Card          | `cards`                 | `title`, `description`, `color`, `due_date`, `position` |
| User profile  | `profiles`              | Mirror of `auth.users`, created on signup via trigger |

**Adding members** goes through the `add_org_member(_org, _email, _role)` RPC: it
verifies the caller is an owner/admin, looks up the invitee's profile by email,
and inserts the membership. A person must already have a Flux account to be added.

### State / data layer

- `src/store/authStore.js` — session + profile, sign in/up/out
- `src/store/workspaceStore.js` — orgs, members, projects, current selections
- `src/store/boardStore.js` — columns/cards for the active project; optimistic
  local updates, debounced card writes, drag positions flushed to the DB on drop
- `src/store/themeStore.js` — light/dark/system (persisted to `localStorage`)

### Security model (RLS highlights)

- Membership checks run through `private.is_org_member` / `private.has_org_role`
  (`SECURITY DEFINER`, filtered by `auth.uid()` internally) — this is what avoids
  recursion on the `organization_members` policies.
- All `UPDATE` policies include both `USING` and `WITH CHECK`.
- No authorization decision reads `user_metadata` (it is user-editable).
- Run `supabase db advisors` (or the MCP `get_advisors`) after any schema change.

**Full write-up:** see [SECURITY.md](SECURITY.md) for the trust boundary, the RLS
recursion fix, policy-correctness details, the member-invite RPC, and a
pre-ship checklist.

---

## Notes & next steps

- **Realtime** isn't wired up — changes from other users appear on reload. Adding
  `supabase.channel(...)` subscriptions per project is a natural next step.
- **Member invites** require an existing account (no email-invite flow yet).
- To reset the demo selection, clear the `flux-*` keys in `localStorage`.
