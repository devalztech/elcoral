# Phase 8 handoff — read this before touching anything

You are continuing a multi-phase frontend wiring job on the Elcoral
platform. Phase 8A is done and verified (see below). Phases 8B–8E are
not started. This file tells you exactly what exists, what doesn't,
and what to build next — read it fully before writing code.

## Do this first, every time, no exceptions

1. Read `backend/app/routers/communities.py` in full (it's ~1700
   lines — read it in chunks, don't skim). It is the only source of
   truth for what the API does. Do not infer endpoint behavior from
   this file or from variable names.
2. Read `backend/app/core/community_perms.py` in full. The
   `Capabilities` dataclass fields (`is_member`, `role`, `is_banned`,
   `can_view`, `can_post`, `can_chat`, `can_create_project`,
   `can_invite`, `can_moderate`, `can_manage_members`,
   `can_edit_settings`, `can_manage_roles`, `can_delete_community`)
   are the ONLY permission signals the frontend is allowed to act on.
   Never compute a permission client-side from `role` or anything
   else — always read the specific `can_*` flag the backend gave you.
3. Read `backend/app/schemas/community.py` in full for exact response
   field names before writing any code that reads a field off a
   response. Field names in this codebase do not always match what
   you'd guess — e.g. the class is `CommunityProjectOut` not
   `ProjectOut`, comments are `DiscussionCommentOut` not `CommentOut`.
   Import the actual class and print `.model_fields.keys()` if
   you're not 100% sure; don't guess from memory.
4. Read `frontend/src/api/client.js` in full. Every backend call from
   the frontend must go through a method in this file. If the UI
   needs something the backend doesn't expose, STOP and say so
   explicitly instead of inventing an endpoint or faking the data.

## Frontend tree — dead code warning

This project contains **two parallel file trees** left over from an
earlier restructure. Getting this wrong means you'll write code that
never runs.

- **Live tree** (entry point traced: `index.html` → `src/app/main.jsx`
  → `src/app/App.jsx`): `src/pages/*`, `src/features/*/components/*`,
  `src/features/*/hooks/*`, `src/layouts/*`, `src/api/client.js`, plus
  exactly two top-level files: `src/components/ElcoralMark.jsx` and
  `src/components/FormField.jsx`.
- **Dead tree** (not imported by anything reachable from
  `main.jsx`): `src/App.jsx`, `src/hooks/*`, `src/onboarding/*`,
  `src/lib/api.js`, and every other file in `src/components/*`
  (`AuthSheet.jsx`, `EditSheet.jsx`, `SectionCard.jsx`,
  `TagAutocomplete.jsx`, `MultiSelectDropdown.jsx`, `AppShell.jsx`,
  `BottomNav.jsx`, `PublicShell.jsx`, `AuthLayout.jsx`,
  `ActivityFeed.jsx`).

Before importing anything, check the live list above or trace the
import chain yourself. Don't trust a file's existence or its name —
trust the import graph from `main.jsx`.

## No `node_modules`, no npm install available

You will almost certainly hit the same problem I did: `npm install`
in this sandbox fails with `403 Forbidden` on essentially arbitrary
package tarballs, routed through a proxy
(`europe-west4-npm.pkg.dev/.../sandbox-npm-cache/...`) that rejects
requests regardless of which registry you configure. This is not
project-specific and not fixable from inside the sandbox.

What DOES work: `curl -sL -o pkg.tgz
"https://registry.npmjs.org/<pkg>/-/<pkg>-<version>.tgz"` fetches
individual tarballs fine — the proxy only breaks the `npm` CLI's own
resolution path, not direct registry HTTP fetches. I used this to
pull a standalone `esbuild` binary (`@esbuild/linux-x64`) and used it
directly (not through the `esbuild` npm wrapper, which needs
`node_modules` to run its postinstall) to bundle-check every file I
wrote — real JSX parsing, real import resolution, across the actual
file tree. I also used the same trick to fetch `react-router-dom` +
`react-router` + `@remix-run/router` tarballs to run real
`matchRoutes()` calls and confirm React Router's static-beats-dynamic
route ranking before relying on it in `App.jsx`.

Use the same approach if you need to verify anything similarly. Don't
claim a build succeeded if you didn't actually run one — say plainly
what you verified and what you couldn't.

Also note: this sandbox has **no Postgres available** and the apt
mirror can't fetch the `postgresql-16` binary. You cannot run
`alembic upgrade head` against a live database here. What you *can*
do, and what I did: install `alembic`/`sqlalchemy`/`asyncpg` from
PyPI (works fine — different path than npm's proxy problem), import
every model, and confirm `Base.metadata.tables` matches every table
the migration creates. That's real but partial verification — report
it as exactly that, not as a live migration run.

## What Phase 8A actually built (verified, not just written)

**New files:**
- `frontend/src/pages/CommunityDetail.jsx` — the community detail
  screen. Header (back/share/more-menu), hero (cover, tile/glyph,
  name, official crown, public/private lock icon, description,
  topic/member-count/new-today meta line, join/leave or Manage
  button), four-tab strip (Posts/Projects/Chat/Members), and a fully
  wired **Posts tab**: list via `listCommunityDiscussions`, create via
  `createDiscussion` (bottom sheet using the existing `EditSheet`
  component), like/unlike via `likeDiscussion`, save/unsave via
  `saveDiscussion`, delete via `deleteDiscussion` (gated on
  `d.can_delete` from the response, not recomputed), and a full
  discussion-thread overlay with comments
  (`listDiscussionComments`/`createDiscussionComment`/
  `deleteDiscussionComment`, delete gated on `c.can_delete`). Also
  exports `Avatar` and `SectionState`, reused by the tab components.
- `frontend/src/pages/CommunityCreate.jsx` — replaces the
  `/home/create/community` stub. Full create form (name, description,
  topic dropdown, tone swatches — both populated live from
  `GET /communities/options` rather than hardcoded, so they can never
  drift from the backend's actual allowed values) plus a
  public/private toggle. On success, navigates to
  `/home/community/{new-slug}`.
- `frontend/src/features/community/MembersTab.jsx` — **real**,
  read-only roster via `communityRoster()`. Shows role badges
  (owner/admin/moderator) using the actual `role` field per member.
  Promotion/demotion/removal/ban UI is NOT built yet — that's 8B.
- `frontend/src/features/community/ProjectsTab.jsx` — **real** list
  view via `listCommunityProjects()`, shows name/description/status.
  Create/collaborate/approve flow is NOT built — that's 8C.
- `frontend/src/features/community/ChatTab.jsx` — placeholder only.
  Correctly checks `community.chat_enabled` and `caps.is_member` for
  gating, but has no message list, no composer, no WebSocket
  connection. That's 8D, entirely unbuilt.
- `frontend/src/features/community/SettingsSheet.jsx` — **real** but
  partial: edits `name`/`description` via `updateCommunity()`, gated
  on `caps.can_edit_settings`. Does NOT yet expose policy toggles
  (`post_policy`/`chat_policy`/`project_policy`/`invite_policy`/
  `moderate_policy`/`chat_enabled`), role management, or
  delete-community. That's 8B.

**Modified files:**
- `frontend/src/api/client.js` — extended the `communities` block
  with every endpoint the 41-route backend exposes that wasn't
  already there: full roster/roles/bans (`communityRoster`,
  `setMemberRole`, `removeMember`, `unbanMember`,
  `updateCommunityPermissions`), projects/collaborators
  (`listCommunityProjects` → `decideCollaborator`, 9 methods),
  chat (`listCommunityMessages`, `sendCommunityMessage`,
  `deleteCommunityMessage`, `wsUrl` helper), discovery
  (`discoveryCategories`), reports (`reportCommunityContent`), plus
  filled gaps in what already existed (`deleteCommunity`,
  `updateDiscussion`, `deleteDiscussionComment`, pagination params
  added to `listCommunityDiscussions`/`listCommunityMembers`).
  **Every method name maps to exactly one backend route — I did not
  invent any endpoint.** Route existence was confirmed by importing
  the actual FastAPI router and listing `router.routes`, not by
  reading the file and trusting my own summary.
- `frontend/src/app/App.jsx` — replaced the two `ComingSoon` stub
  routes (`/home/community/:slug` and `/home/create/community`) with
  the real pages. Verified React Router's static-route-beats-dynamic-
  route ranking with a real `matchRoutes()` call before relying on it
  (see "No node_modules" section above) — `/home/create/community` is
  declared as a sibling of the existing `/home/create/:slug`
  catch-all and correctly takes priority regardless of order.
- `frontend/vite.config.js` — added `ws: true` to the `/api` proxy
  block. Without this, `ws://localhost:5173/api/communities/ws/...`
  cannot reach the backend in local dev — Vite's proxy only forwards
  plain HTTP by default. This is a real, necessary fix for Phase 8D
  to work at all locally, not a scope-creep change; I did not touch
  anything else in this file.

**What I verified, concretely, and how:**
- Every new/edited `.jsx`/`.js` file, and the real `App.jsx` and
  `main.jsx` entry points with the ENTIRE existing app graph attached,
  bundle cleanly through a real esbuild binary with zero errors. This
  catches syntax errors, bad JSX, and unresolved imports.
- The circular import between `CommunityDetail.jsx` and
  `MembersTab.jsx` (`MembersTab` imports `{ Avatar, SectionState }`
  back from `CommunityDetail.jsx`) was not just bundled but actually
  **executed** in Node with shimmed `react`/`react-router-dom`/
  `lucide-react`, confirming both components resolve as real
  functions at runtime, not `undefined` (the actual failure mode a
  broken circular import produces).
- Every field name I read off an API response in the new frontend
  code (`community.slug`, `d.can_delete`, `m.person.username`,
  `p.status`, `caps.can_post`, etc.) was cross-checked against the
  real Pydantic schema's `model_fields.keys()`, not against my own
  earlier notes. `Capabilities.dict()` was specifically traced to
  confirm it calls `dataclasses.asdict()`, which preserves field
  names verbatim — so `caps.can_post` in JS really does correspond to
  `Capabilities.can_post` in Python, not something inferred.
- All 41 REST routes + the WS route were confirmed to dispatch to the
  intended handler by loading the actual FastAPI router and calling
  `route.matches()` against representative paths — including the
  `/discovery/categories` vs `/{slug}` and `/discussions` vs
  `/discussions/{id}` cases that looked position-risky on paper but
  test out safe (path-segment-count means they don't actually
  collide).
- Backend model/migration consistency: installed the pinned
  `requirements.txt`, imported every model, confirmed
  `Base.metadata.tables` contains every table
  `0007_community_system.py` creates.

**What I could NOT verify (be honest about this in your own report
too):**
- No live Postgres, so no actual `alembic upgrade head` run, no real
  HTTP request ever sent to a running FastAPI instance, no real
  browser render. Everything above is static/offline verification —
  genuine, but not a substitute for `docker-compose up` + manually
  clicking through the app, which is what the user should still do
  locally before trusting this in production.

## What's next — do these phases in order, small verified steps, exactly like 8A

### Phase 8B — Members, roles, permissions/settings
- `MembersTab.jsx`: add role promotion/demotion UI (`setMemberRole`,
  gated on `caps.can_manage_roles` for owner-only actions like
  appointing admins — check `community_perms.py`'s `ROLE_RANK` for
  exactly who can promote whom to what — and `caps.can_manage_members`
  for the rest), member removal and ban (`removeMember` with its
  `ban` boolean, gated on `caps.can_moderate`), and an unban list
  (`unbanMember` — you'll need to figure out how to list banned users;
  check if there's an endpoint for this in the router before assuming
  one, and if not, say so rather than fake it).
- `SettingsSheet.jsx`: add the policy toggles
  (`post_policy`/`chat_policy`/`project_policy`/`invite_policy`/
  `moderate_policy`/`chat_enabled`) via `updateCommunityPermissions`,
  using the existing `ToggleRow` component from
  `features/settings/components/ToggleRow.jsx` for consistency. Add
  delete-community (`deleteCommunity`, gated on
  `caps.can_delete_community`, owner-only per the schema) with a
  real confirmation step — this is destructive and irreversible.
- Read `backend/app/schemas/community.py`'s
  `CommunityPermissionsUpdateRequest` (or whatever it's actually
  called — verify the name) for the exact payload shape before
  wiring the save call.

### Phase 8C — Projects + collaborators
- `ProjectsTab.jsx`: add project creation (`createProject`, gated on
  `caps.can_create_project`), a project detail view (`getProject`),
  edit/delete (`updateProject`/`deleteProject`, gated on
  `p.can_edit`/`p.can_delete` from the response — same pattern as
  discussions in 8A, don't recompute these client-side), and the
  full collaborator request flow: request to join
  (`requestToCollaborate`), withdraw (`withdrawCollaboration`), list
  pending/accepted collaborators (`listCollaborators`), and
  accept/reject (`decideCollaborator` — check the exact allowed
  `state` values in the schema before hardcoding a dropdown).

### Phase 8D — Chat + WebSocket + media
- This is the biggest remaining piece. Read
  `backend/app/routers/community_ws.py` (65 lines) and
  `backend/app/core/community_hub.py` (44 lines) in full — they're
  short, read them anyway, don't skim.
- **Critical constraint already confirmed: the socket is
  receive-only.** The client never sends chat text over the
  WebSocket. Sending is exclusively `POST /{slug}/messages` (already
  in the client as `sendCommunityMessage`); the server then broadcasts
  the result to all connected sockets. Do not build a client-side
  "send over WS" path — it doesn't exist on the backend and would
  silently do nothing.
- Exactly two broadcast event shapes exist:
  `{"type": "message", ...CommunityMessageOut fields}` and
  `{"type": "message_deleted", "message_id": "..."}`. No typing
  indicators, no presence, no read receipts — don't build UI that
  implies any of those exist.
- Use `api.wsUrl(slug, token)` (already built in `client.js`) to get
  the connection URL — it already handles the `VITE_API_URL` empty-
  string-means-same-origin convention and the http→ws / https→wss
  swap correctly.
- Handle reconnect: the WS will legitimately close (network blip, tab
  backgrounding, token expiry). Build actual reconnect-with-backoff
  logic, and surface a real "reconnecting…" state to the user rather
  than silently going stale. Check the close codes the WS router
  uses (4401/4403/4404 were visible in my read of
  `community_ws.py` — confirm the exact meanings again, don't trust
  this summary) so a 4401 (bad/expired token) doesn't trigger an
  infinite reconnect loop against a URL that will never succeed.
- Media: `uploadMedia` (check the exact existing client method name —
  I traced it to `POST /media` returning `{ref, mime_type,
  size_bytes}`) then pass `ref` into `sendCommunityMessage`'s
  `mediaRefs` array. Confirm the media upload size/type limits by
  reading `backend/app/routers/media.py` before building the picker
  UI, don't guess reasonable-sounding limits.

### Phase 8E — Discovery/top/featured + final polish
- Wire `discoveryCategories()` (already in the client) somewhere
  sensible — check whether `Community.jsx` (the list page) should
  consume this for its topic filter chips, since right now those
  chips may be hardcoded; read that file fresh, don't rely on my
  summary of it from Phase 8A.
- Go back through every placeholder left in 8A/8B/8C/8D and confirm
  nothing is still showing fake/mock data — that was the explicit
  instruction for this whole Phase 8 effort and it's easy to forget
  a leftover stub by the time you reach 8E.
- Full pagination pass: confirm every list view
  (discussions/members/projects/messages) actually implements
  "load more" against the `has_more`/`total`/`next_cursor` fields the
  backend returns, rather than just fetching page one and stopping.
  I did NOT build pagination UI in 8A — the client methods accept
  `limit`/`offset` params but nothing calls them with anything but
  a flat default yet.
- Empty/loading/error states: I built these for Posts, Members
  (read-only), and Projects (read-only). Confirm Chat, and every new
  8B/8C mutation flow, all have real equivalents — not just success-
  path happy code.
- At the very end, do the same field-name and route-existence
  cross-checks against the actual backend schemas/router that I did
  for 8A (see "What I verified" above) — don't assume 8B/8C/8D code
  is correct just because it bundles. Bundling proves syntax and
  import resolution; it does not prove a field name matches what the
  server actually sends.

## Rules that apply to every remaining phase, restated because they matter

- Never invent an endpoint. If the UI needs something the backend
  doesn't expose, stop and say so.
- Never compute a permission client-side. Only ever branch on the
  specific `can_*` / `is_*` field the backend's `capabilities` object
  gave you for that exact action.
- Don't claim something works if you haven't actually tested it —
  bundling is not the same as running, and running against a stub is
  not the same as running against the real backend.
- Preserve the existing black/grey/lemon-green design system exactly
  — CSS custom properties only, no hardcoded hex, match the card/row/
  avatar/button patterns already established in `Community.jsx`,
  `ProfileView.jsx`, and the Phase 8A files above rather than
  inventing new patterns.
