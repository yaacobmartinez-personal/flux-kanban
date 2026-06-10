# Flux — User Guide

A complete, action-by-action walkthrough of the app. If you're setting Flux up
for the first time (Supabase, env vars), see [README.md](README.md) first — this
guide assumes the app is running and you can reach the sign-in screen.

## Contents

1. [Accounts & signing in](#1-accounts--signing-in)
2. [Switching the theme](#2-switching-the-theme)
3. [Organizations](#3-organizations)
4. [Members & roles](#4-members--roles)
5. [Projects (spaces)](#5-projects-spaces)
6. [Switching views (Board / List)](#6-switching-views-board--list)
7. [Columns](#7-columns)
8. [Cards: create, move, reorder](#8-cards-create-move-reorder)
9. [The card editor (every field)](#9-the-card-editor-every-field)
10. [Comments](#10-comments)
11. [Activity history](#11-activity-history)
12. [Closing vs deleting a card](#12-closing-vs-deleting-a-card)
13. [Real-time collaboration](#13-real-time-collaboration)
14. [Keyboard shortcuts](#14-keyboard-shortcuts)
15. [Troubleshooting](#15-troubleshooting)

---

## Screen map

The bar across the top is always present once you're signed in:

```
[F] Acme Inc. ▾ / Marketing site ▾            [Members] [☀☐☾] [you]
└ logo  └ org switcher  └ project switcher      └ members └ theme └ account
```

Below it is your board (or list). Clicking a card slides an editor panel in from
the right.

---

## 1. Accounts & signing in

### Create an account
1. On the sign-in screen, click **Create one** (bottom of the card).
2. Enter your **Full name**, **Email**, and a **Password** (at least 6 characters).
3. Click **Create account**.
4. If your Supabase project has email confirmation enabled, check your inbox and
   confirm, then come back and sign in. If not, you can sign in right away.

### Sign in
1. Enter your **Email** and **Password**.
2. Click **Sign in**.

### Sign out
1. Click your **avatar** (top-right circle with your initials).
2. Click **Sign out**.

---

## 2. Switching the theme

The theme control is the three-icon pill in the top bar (also on the sign-in
screen, top-right).

- **Sun** = always Light
- **Monitor** = follow your operating system setting
- **Moon** = always Dark

Click an icon to switch instantly. Your choice is remembered on this device, and
"Monitor" updates automatically if your OS flips between light and dark.

---

## 3. Organizations

An **organization** holds your team, its members, and its projects. You can
belong to several and switch between them.

### Create your first organization
On first sign-in you'll see a **Create your organization** screen:
1. Type a name (e.g. `Acme Inc.`).
2. Click **Create organization**.

You become the **owner** automatically.

### Create another organization
1. Click the **organization name** in the top bar (the building icon).
2. Click **New organization**.
3. Enter a name and click **Create organization**.

### Switch organizations
1. Click the **organization name** in the top bar.
2. Pick an organization from the list. A checkmark marks the current one.

Your last-used organization is remembered between visits.

---

## 4. Members & roles

Open the panel with the **Members** button in the top bar.

### What each role can do

| Action | Member | Admin | Owner |
|---|:---:|:---:|:---:|
| View and edit cards, columns, comments | ✓ | ✓ | ✓ |
| Create / rename projects | ✓ | ✓ | ✓ |
| Delete a project | | ✓ | ✓ |
| Add / remove members, change roles | | ✓ | ✓ |
| Update organization settings | | ✓ | ✓ |
| Delete the organization | | | ✓ |
| Leave the organization | ✓ | ✓ | ✓\* |

\* An owner can leave only if another owner remains.

Within a board, **member and admin are identical** — the difference is purely
about managing people and the org. (Roles apply org-wide, not per project.)

### Add a member  *(owner/admin only)*
1. Open **Members**.
2. In **Add a member by email**, type their email.
3. Choose **Member** or **Admin**.
4. Click **Add member**.

> The person must already have a Flux account (they need to sign up first). If no
> account exists for that email, you'll get an error telling you so.

### Change a member's role  *(owner/admin only)*
1. Open **Members**.
2. Use the **role dropdown** next to that person and pick `owner`, `admin`, or
   `member`. It saves immediately.

### Remove a member  *(owner/admin only)*
1. Open **Members**.
2. Click the **✕** next to that person.

Members who aren't owners/admins see the roster read-only (just a role badge,
no controls). Your own row never shows management controls.

### Leave an organization
1. Open **Members**.
2. At the bottom of the panel, click **Leave organization**.
3. Confirm with **Yes, leave**.

You're removed from the organization and switched to another one (or the
"create an organization" screen if it was your only one). You'll need to be
re-invited to regain access.

> **If you're the only owner**, the Leave button is disabled. Promote another
> member to **owner** first (so the org still has one), or delete the
> organization. This prevents an org from being left with no one in charge.

---

## 5. Projects (spaces)

A **project** is one board your team works on. Each has a name and a short **key**
(like `MKT`) shown on cards and in menus.

### Create your first project
After creating an organization you'll see **Create your first project**:
1. Enter a name (e.g. `Marketing site`).
2. Optionally enter a **key** (auto-uppercased, up to 8 characters). If you leave
   it blank, one is generated from the name.
3. Click **Create project**.

### Create another project
1. Click the **project name** in the top bar (the grid icon).
2. Click **New project**.
3. Enter a name and optional key, then **Create project**.

### Switch projects
1. Click the **project name** in the top bar.
2. Pick a project. A checkmark marks the current one.

Your last-used project per organization is remembered.

### Delete a project  *(owner/admin only)*
1. Click the **project name** in the top bar to open the switcher.
2. Click **Delete "<project name>"** (shown in red at the bottom; only owners and
   admins see it).
3. Confirm in the dialog by clicking **Delete project**.

> This permanently removes the project and all of its columns, cards, comments,
> and history. There's no undo. After deleting, you're switched to another
> project (or the "create a project" screen if it was your last one).

---

## 6. Switching views (Board / List)

At the top of the board area there's a **Board / List** toggle.

- **Board** — the classic Kanban columns.
- **List** — every card as a flat, scrollable list showing its label, title,
  current column, story points, and assignee. Click any row to open the card.

Your choice is remembered on this device.

### Group by parent  *(board view)*
When at least one card has a parent (epic), a **Group by parent** toggle appears
in the toolbar. Turn it on to nest subtasks directly under their parent card in
the column; turn it off to show every card flat. (See
[Epic / Parent](#9-the-card-editor-every-field) for how to set a parent.)

---

## 7. Columns

Columns represent the stages of your workflow (e.g. To Do → In Progress → Done).
A badge on each header shows how many cards it holds.

### Add a column
- Click the **+ Add column** tile at the right end of the board, **or**
- On an empty board, either click **Use "To Do / In Progress / Done"** to create
  the three standard columns at once, or **+ Add a blank column**.

### Rename a column
1. Click the **column title**.
2. Type the new name.
3. Press **Enter** (or click away) to save. Press **Esc** to cancel.

### Reorder columns
Drag the **grip handle** (the ⋮⋮ icon at the left of the column header) left or
right and drop it in the new position.

### Delete a column
1. Click the **trash icon** in the column header.
2. Confirm with the **✓** (or cancel with **✕**).

> Deleting a column also deletes every card in it. There's no undo.

---

## 8. Cards: create, move, reorder

### Add a card
- Click **Add a card** at the bottom of a column, **or**
- In an empty column, click **Add the first one**.

The card is created and its editor opens immediately so you can fill in details.

Every card gets an automatic **ticket number** based on the project's key, like
`BRSO-1`, `BRSO-2`, `BRSO-3` — assigned in the order cards are created and unique
within the project. It shows on the card, in List view, and in the card editor's
header. Numbers aren't reused if a card is deleted (just like Jira).

### Open a card
Click any card (in Board or List view) to open its editor.

### Move a card to another column
**Drag** the card and drop it onto another column (anywhere in that column's
list). Its status updates and the move is recorded in the card's history.

### Reorder a card within a column
**Drag** the card up or down to its new spot.

> Drag tips: on a mouse, a card starts dragging after you move it ~8px (so a
> simple click still opens it). On touch, press and hold briefly before dragging
> (so normal scrolling still works).

---

## 9. The card editor (every field)

Click a card to open the editor panel on the right. **Every field saves
automatically** as you change it — there is no "Save" button for card fields.
Close the panel with the **✕**, by clicking the dimmed area, or pressing **Esc**.

- **Title** — the card's name. Click and type.
- **Description** — free text for detail. The box can be dragged taller.
- **Assignee** — pick a teammate from the dropdown (only people in this org
  appear). Choose **Unassigned** to clear it. The assignee's avatar shows on the
  card face and in List view.
- **Reporter** — read-only; automatically set to whoever created the card.
- **Epic / Parent** — pick another card to make *this* card a subtask of it.
  Choose **No epic** to detach. With **Group by parent** on, subtasks nest under
  their parent in the board.
- **Story points** — a number (0 or more). Type a value, or click **Clear** to
  remove it. Shows as a small violet badge on the card.
- **Label** — click a color swatch to tag the card (or **No label** to remove).
  When a color is set, an extra **caption** box appears so you can give the label
  custom text (otherwise the color's name is used). The label shows as a colored
  bar and chip on the card.
- **Due date** — pick a date, or click **Clear**. The card shows a due badge that
  turns amber for "today/tomorrow" and red for "overdue".
- **Links** — click **Add link**, paste a URL into the field. Click the
  **external-link icon** to open it in a new tab, or the **✕** to remove that
  link. Add as many as you need.

Below those are the card's [Activity history](#11-activity-history) and
[Comments](#10-comments), and at the bottom the
[Close / Delete](#12-closing-vs-deleting-a-card) actions.

---

## 10. Comments

Comments live at the bottom of the card editor.

### Post a comment
1. Type in the **Add a comment…** box.
2. Click **Post**, or press **⌘ + Enter** (Mac) / **Ctrl + Enter** (Windows).

### Edit your own comment
1. Under your comment, click **Edit**.
2. Change the text and click **Save** (or **⌘/Ctrl + Enter**). An "· edited"
   marker appears next to the timestamp.

### Delete your own comment
Under your comment, click **Delete**.

> You can only edit or delete comments you wrote. Everyone in the org can read
> all comments on cards they can see.

---

## 11. Activity history

The **History** section in the card editor records changes automatically — you
don't do anything to populate it. It logs:

- when the card was **created**,
- **field changes** (title, description, label, due date, assignee, reporter,
  parent, story points, links),
- **moves** between columns ("moved from X to Y"),
- **closed** and **reopened** events.

Each entry shows who did it and how long ago.

---

## 12. Closing vs deleting a card

Both actions are at the bottom of the card editor.

### Close a card  (reversible)
Click **Close card**. The card is marked **Closed** (a badge in the editor, and
struck through in List view) but is kept. Click **Reopen card** to bring it back.
Use this for "done / won't do" without losing the record.

### Delete a card  (permanent)
Click **Delete card**. This removes the card and its comments and history. There
is no undo.

---

## 13. Real-time collaboration

When teammates are working in the same project, their changes appear on your
board **without a refresh** — new cards, moves, edits, comments, and column
changes all sync live.

Two things worth knowing:
- If a teammate edits a card while **you're typing** in it, your unsaved text is
  preserved — the sync won't overwrite what you're entering.
- Updates that arrive **while you're mid-drag** are applied the moment you drop,
  so the drag never jumps under your cursor.

---

## 14. Keyboard shortcuts

| Shortcut | Where | Action |
|---|---|---|
| **Esc** | Card editor / dialogs | Close the panel or cancel |
| **Esc** | Renaming a column | Cancel the rename |
| **Enter** | Renaming a column | Save the new name |
| **⌘ / Ctrl + Enter** | Comment box | Post or save the comment |

---

## 15. Troubleshooting

- **A toast says you're going too fast.** You hit the write rate limit (e.g. lots
  of comments or cards in a short burst). Wait a few seconds and continue. See the
  Rate limiting section in [README.md](README.md).
- **You can't add or remove members.** Only owners and admins can manage members
  (see [Members & roles](#4-members--roles)). Ask an org admin to change your
  role.
- **"No Flux account exists for that email" when adding a member.** They need to
  sign up first; then add them.
- **Teammate changes aren't appearing live.** Confirm real-time is enabled for the
  project (Supabase dashboard) — see the Realtime section in
  [README.md](README.md). A page refresh always pulls the latest state.
- **You signed in but see no board.** Make sure you've selected (or created) an
  organization and a project from the top-bar switchers.
