# Developer Role — Implementation Plan

> **Status:** 🚧 In progress — **Phases 1+2, 4, 5 complete** (2026-09-13); Phase 3 (backend) and Phase 6 pending
> **Last reviewed:** 2026-09-13 (v4 — Phase 4 flag plumbing + Phase 5 pages implemented against mock flags)
> **Decisions locked in (see [Decision log](#decision-log)):** developer gets its **own area only** (no admin access); feature flags are **backend-driven**.

---

## 1. Purpose

Add a fourth user role, **`developer`**, to Grade-sync.

The developer role is responsible for **managing system features**: turning features on/off for the whole school via feature flags, and (later) observing system health. Unlike admin/teacher/student, the developer is *not* an academic user — they never handle enrollments, grades, or attendance. They manage the platform itself.

Concretely, this means:

1. A new `developer` role value recognized end-to-end (DB → API → login → routing → sidebar).
2. A protected `/developer/*` area with its own dashboard and pages.
3. A **feature-flag system**: features stored server-side, toggled from the developer UI, consumed by the frontend to show/hide features for everyone.

---

## 2. Role architecture

Understanding these touchpoints is essential — the new role must be added at **every** one of them.

### 2.1 Single source of truth — ✅ DONE (Phase 1)

`src/constant/users.ts`

```ts
export const ROLES = {
    ADMIN: "admin",
    TEACHER: "teacher",
    STUDENT: "student",
    DEVELOPER: "developer"     // ✅ added 2026-09-13
} as const;

export type UserRoles = (typeof ROLES)[keyof typeof ROLES];
```

`User.role` is typed as `UserRoles`, so adding a key here automatically propagated through the type system.

### 2.2 Auth flow (unchanged)

| Step | File | Notes |
|---|---|---|
| Login POST | `src/pages/LoginPage.tsx` → `POST /users/login` | Response typed as `LoginResponse { role }`; role is cast to `UserRoles` and used to pick the redirect target. **No role whitelist here** — any role string from the backend works. |
| Session verify | `src/context/userContext.tsx` → `GET /users/verify` | Returns the full `User` (`{ id, email, role }`); cached in `localStorage`. Uses `{ toast: false, skipErrorToast: true }` — the 401 for anonymous visitors is expected and silenced. Role-agnostic already. |
| Auth hook | `src/hooks/useAuth.ts` / `src/hooks/useUser.ts` | Expose `{ user, loading }`. Role-agnostic. |
| Route guards | `src/routes/ProtectedRoutes.tsx` | `allowedRoles.includes(user.role)`; unauthorized → `<Navigate to="/unauthorized" />`. |

### 2.3 Route gate structure — UPDATED upstream (no outer gate)

**v2 of this plan documented an outer gate** (`allowedRoles={[ADMIN, TEACHER, STUDENT]}` wrapping everything in `App.tsx`). That outer gate **has since been removed** in an upstream refactor: routes now sit directly under `MasterLayout` with only **per-role inner gates**:

```tsx
{/* Master Layout */}
<Route element={<MasterLayout />}>
  {/* Admin Routes */}
  <Route element={<ProtectedRoutes allowedRoles={[ROLES.ADMIN]} />}> ...
  {/* Teacher Routes */}
  <Route element={<ProtectedRoutes allowedRoles={[ROLES.TEACHER]} />}> ...
  {/* Student Routes */}
  <Route element={<ProtectedRoutes allowedRoles={[ROLES.STUDENT]} />}> ...
  {/* Developer Routes */}                                                        {/* ✅ added (Phase 2) */}
  <Route element={<ProtectedRoutes allowedRoles={[ROLES.DEVELOPER]} />}> ...
```

**Consequences:**
- The v2 risk "developer bounced by the outer gate" no longer exists — no outer gate to widen.
- The v2 regression risk §6.7 (widening the outer gate affects everyone) is **obsolete**.
- Per-role gates remain the sole authorization boundary on the frontend; server-side checks (Phase 3) are still mandatory.

Note: route paths in `App.tsx` are absolute (e.g. `path="/admin/dashboard"`), not relative as v2 assumed.

### 2.4 Role-driven UI — mostly automatic

| Concern | File | Change needed for developer? |
|---|---|---|
| Post-login redirect | `DASHBOARD_PATH` in `src/constant/navigation.ts` | ✅ Added `developer` key (Phase 2). |
| Sidebar links | `DASHBOARD_LINKS` in `src/constant/navigation.ts` | ✅ Added `developer` group (Phase 2). |
| Sidebar render | `src/components/Sidebar.tsx` | ❌ Generic — `DASHBOARD_LINKS[user.role]`, and `roleLabel` capitalizes automatically → "Developer". |
| Page title | `src/components/MaterLayout.tsx` | ❌ Generic — derives the header title from the URL segment (`/developer/features` → "Features"). |
| Mobile sidebar drawer | `MasterLayout` + `Sidebar` | ❌ Generic already. |

### 2.5 API layer conventions (confirmed)

`src/api/api.ts` — generic wrappers (`getAPICall`, `postAPICall`, `patchAPICall`, `putAPICall`, `deleteAPICall`) with a `{ message, success, data }` response envelope. Relevant details for this plan:

- **`skipErrorToast: true`** per request silences the global error interceptor (added for the `/users/verify` probe). The flags fetch should use it — a flags outage must not toast for every user on every page.
- `patchAPICall` toasts success by default — exactly what feature toggles want.
- Page-level endpoint documentation convention exists (see the header comment in `AdminSettings.tsx` listing its endpoints) — developer pages should follow it.

### 2.6 No user-creation UI exists

`CreateUserProps` in `constant/users.ts` is not referenced by any page; teachers/students are created server-side via `/teachers` and `/students`. **There is no UI path to create any user** — confirming the first developer account can only be seeded directly in the DB.

### 2.7 Known pre-existing gap

`ProtectedRoutes.tsx` redirects to `/unauthorized`, but **no `/unauthorized` route exists** in `App.tsx`, so unauthorized users currently land on a blank page. Fixing this is included in Phase 6 (it becomes more visible once a fourth role exists).

### 2.8 Proven patterns to reuse

| Pattern | Where proven | Reuse for |
|---|---|---|
| Context definition split from provider + throwing hook | `userContextDefinition.ts` / `userContext.tsx` / `useUser.ts` (throws "Must be use inside the context provider") | `FeatureFlagContext` — same 3-file shape |
| Module-level request cache + `window` event refresh | `useSchoolInfo.ts` (cache + `school-info-updated` event) | Optional alternative for post-toggle flag refresh |
| Confirm dialog with pending state | `src/components/ConfirmDialog.tsx` (`tone="danger"`, `pending`, `pendingLabel`, `triggerRef`) | Disable-feature confirmation |
| Skeleton loading per card | `Skeleton` / `SkeletonLine` + `aria-busy` (AdminDashboard) | Developer dashboard/features loading states |
| Hybrid styling (tokens in CSS, Tailwind layout, shared `analytics__card`/`analytics__kpi` classes) | All dashboard pages | Developer pages |

---

## 3. Target design (to-be)

```
                 ┌──────────────────────────────────────────────┐
                 │                  BACKEND                     │
                 │                                              │
                 │  users.role enum:  admin | teacher | student │
                 │                    | developer      (NEW)    │
                 │                                              │
                 │  features table (NEW)                        │
                 │  ┌────┬──────────────┬─────────┬──────────┐  │
                 │  │ id │ key          │ enabled │ updated  │  │
                 │  └────┴──────────────┴─────────┴──────────┘  │
                 │                                              │
                 │  GET    /features            (any authed)    │
                 │  PATCH  /features/:key       (developer only)│
                 └──────────────┬───────────────────────────────┘
                                │
              ┌─────────────────┴──────────────────┐
              │             FRONTEND               │
              │                                    │
              │  FeatureFlagProvider               │
              │   - fetches GET /features once     │
              │     (skipErrorToast, fail-open)    │
              │   - exposes useFeatureFlags()      │
              │     { flags, isEnabled, setFlag,   │
              │       loading, refetch }           │
              │                                    │
              │  /developer/* area (role-guarded   │
              │  by the per-role inner gate)       │
              │   - Dashboard: flag overview       │
              │   - Features: toggle management    │
              └────────────────────────────────────┘
```

**Access model:** developer gets *only* `/developer/*`. They do **not** get admin pages. This keeps platform management fully separate from academic administration.

---

## 4. Phased implementation plan

### Phase 1 — Role foundation (frontend) — ✅ DONE (2026-09-13)

**File: `src/constant/users.ts`** — added `DEVELOPER: "developer"` to `ROLES` (see §2.1 for the final code). `UserRoles` updates automatically.

---

### Phase 2 — Routing & navigation (frontend) — ✅ DONE (2026-09-13)

Implemented exactly as planned, **except** the outer-gate step (§2.3) — the outer gate no longer exists, so nothing to widen. Changes made:

1. **`src/constant/navigation.ts`**
   - `DASHBOARD_PATH.developer: '/developer/dashboard'` added (prevents the `navigate(undefined)` login crash).
   - `DASHBOARD_LINKS.developer` group added (Main: Dashboard `FaHome`, Feature Management `FaToggleOn` — Configuration: Settings `FaCog`); `FaToggleOn` added to imports.
2. **`src/App.tsx`** — developer route group added inside `MasterLayout`, matching the file's style (absolute paths, multi-line `ProtectedRoutes` element):

```tsx
{/* Developer Routes */}
<Route
  element={
    <ProtectedRoutes allowedRoles={[ROLES.DEVELOPER]} />
  }
>
  <Route path="/developer/dashboard" element={<DeveloperDashboard />} />
  <Route path="/developer/features" element={<DeveloperFeatures />} />
  <Route path="/developer/settings" element={<DeveloperSettings />} />
</Route>
```

3. **Placeholder pages** — routes must render something, so three placeholder pages were created (to be replaced by Phase 5):
   - `src/pages/developer/DeveloperDashboard.tsx` — hero + "Feature Management is on the way" card + link to features.
   - `src/pages/developer/DeveloperFeatures.tsx` — "awaiting backend" notice + skeleton preview of the intended layout (`aria-busy`).
   - `src/pages/developer/DeveloperSettings.tsx` — account email display + coming-soon note.
   - `src/style/developerDashboard.css` — stub stylesheet (Phase 5 expands it).
4. **Verification:** `npx tsc -b --force` and `eslint` pass on all touched files.

**Still pending from this phase's original scope:** end-to-end login verification — requires the backend role enum + a seeded developer account (Phase 3).

**No changes needed** in `LoginPage.tsx`, `Sidebar.tsx`, or `MasterLayout.tsx` — all are role-generic (§2.4), confirmed.

---

### Phase 3 — Backend: role + feature flags (prerequisite for Phases 4–6) — ⬜ PENDING

> The backend lives outside this repo. Items below are the **contract** the backend must satisfy; coordinate before starting Phase 4. This phase can run in parallel with frontend work.

**3.1 Users table** — add `developer` to the role enum/allowed values. Existing rows untouched. Seed the first developer account (there is **no UI path to create users**, §2.6):

```sql
-- example, adapt to the actual schema
INSERT INTO users (email, password, role) VALUES ('dev@gradesync.test', <hashed>, 'developer');
```

**3.2 Auth middleware** — the role guard protecting admin endpoints today must:
- Allow `developer` through generic authed endpoints (`/users/verify`, `/features`).
- Restrict the new management endpoint to `role === 'developer'` **server-side**. Never rely on the frontend guard alone.

**3.3 Feature flags**

Table:

```sql
CREATE TABLE features (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(64)  NOT NULL UNIQUE,   -- e.g. 'reports_analytics'
  label       VARCHAR(128) NOT NULL,          -- e.g. 'Reports & Analytics'
  description TEXT,
  enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_by  INTEGER      REFERENCES users(id),        -- audit (§6.3)
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

Seed with the toggleable features (start small — suggested initial set, final list is a product decision):

| key | label | Controls |
|---|---|---|
| `reports_analytics` | Reports & Analytics | Admin analytics page + sidebar link |
| `reports_generation` | Report Generation | Admin/Teacher "Reports" pages + links |
| `submission_tracker` | Submission Tracker | Admin "Submission Tracker" + link |

Endpoints:

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/features` | any authenticated user | Flag map consumed by `FeatureFlagProvider`. Response: `data: { [key: string]: boolean }`. |
| `PATCH` | `/features/:key` | **developer only** | Body `{ enabled: boolean }`. Returns the updated row (including `updated_by`/`updated_at`). Server records who/when (§6.3). |

Notes:
- Unknown `key` on PATCH → 404; non-developer PATCH → 403.
- Keep the `{ message, success, data }` envelope consistent with the rest of the API.
- `/features` must NOT be role-gated to developer — every role's frontend needs the map to hide features.

---

### Phase 4 — Feature-flag plumbing (frontend) — ✅ DONE (2026-09-13, mock mode)

Implemented following the **3-file context pattern** (§2.8), as planned:

**`src/context/featureFlagContextDefinition.ts`** — `FeatureFlagContextValue` (`flags`, `loading`, `isEnabled`, `setFlag`, `refetch`) and the context with **safe fail-open defaults** (everything enabled until real flags arrive).

**`src/context/featureFlagContext.tsx`** — the provider:
- **`VITE_FEATURE_FLAGS_MOCK` switch**: when the env var is set (any truthy value), serves a static map (`reports_analytics`, `reports_generation`, `submission_tracker` — all `true`) after a 400 ms delay (so loading states are visible), with a dev-only console info. **Remove the mock branch once Phase 3 is live.**
- **Live mode**: fetches once on mount via `getAPICall<Record<string, boolean>>("/features", { toast: false, skipErrorToast: true })` — silent on failure (§2.5); a flags outage should never spam toasts.
- On fetch failure: keeps the previous/empty map; `isEnabled` fails open → app fully usable, features visible.
- `setFlag` = optimistic update; `refetch` = confirm/rollback path for the developer UI.
- Initial fetch deferred with `setTimeout(..., 0)` — same pattern as `userContext.tsx`, required by the `react-hooks/set-state-in-effect` lint rule.

**`src/hooks/useFeatureFlags.ts`** — `useContext` + throw-if-missing, same wording convention as `useUser.ts`.

**Provider placement in `src/main.tsx`** — `UserContextProvider → FeatureFlagProvider → ToastProvider → App`.

**Remaining from this phase (deferred):** sidebar link filtering + route-level flag gating (the "consumer wiring"). The pages are done; `Sidebar.tsx` does not filter by flags yet, and no route currently renders a disabled-notice. Track as its own task.

**Alternative considered (kept for the record):** the `useSchoolInfo.ts` module-cache + `window` event pattern (§2.8) would avoid a provider, but context wins because the developer toggle must synchronously update every consumer (sidebar + pages) without event wiring.

**Consuming a flag anywhere:**

```tsx
const { isEnabled } = useFeatureFlags();
if (!isEnabled("reports_analytics")) return <FeatureDisabledNotice />;
```

---

### Phase 5 — Developer pages (frontend) — ✅ DONE (2026-09-13, working against mock flags)

All three placeholders replaced with working pages; `src/style/developerDashboard.css` expanded from the stub.

**5.1 `DeveloperDashboard.tsx`** — hero kept from Phase 2, plus:
- 3 KPI tiles (Total / Enabled / Disabled features) with skeleton values while loading.
- Feature status grid: one card per feature with label, mono key chip, and enabled/disabled pill; disabled cards get a muted background.
- "Manage features" link to `/developer/features`.

**5.2 `DeveloperFeatures.tsx`** — the core screen, as planned:
- Live feature list from `useFeatureFlags()`: icon, friendly label, mono `key` chip, Enabled/Disabled pill, switch toggle per feature (mirrors the `adminSettings.css` switch style).
- **Disable flow:** toggle off → `ConfirmDialog` (`tone="danger"`, `pendingLabel="Disabling…"`) → optimistic `setFlag(key, false)` + `patchAPICall("/features/" + key, { enabled: false })` → on rejection the interceptor toasts and `refetch()` rolls the switch back. Implemented.
- **Enable flow:** immediate, no confirm (low-risk). Implemented.
- Search by label or key (distinct empty states for "no features registered" vs "no matches"); skeleton rows + `aria-busy`; header chip shows `N/M enabled`; footer note distinguishes mock vs live mode.
- **In mock mode** (`VITE_FEATURE_FLAGS_MOCK`): PATCH is skipped in favor of a 300 ms simulated delay, so the whole confirm/optimistic/toast flow is QA-able without a backend. Remove with the provider's mock branch in Phase 3.

**5.3 `DeveloperSettings.tsx`** — account email card + **working password change** via the existing `PUT /users/:id` endpoint: 8-char min + confirmation-match validation, form captured before `await` (AdminSettings pattern), show/hide password toggle, inline success/error banners.

**Supporting files:**
- `src/pages/developer/featureMeta.ts` — shared `FEATURE_META` label/description metadata used by both dashboard and features pages; unknown API keys still render (key-as-label) so nothing can hide.
- `src/style/developerDashboard.css` — feature cards, switch toggle, stat tiles, search input, reduced-motion guards.
- **Quirk worth knowing:** `ConfirmDialog.triggerRef` is typed `Ref<HTMLButtonElement>` but the toggle trigger is a checkbox input, so an unattached ref is passed (focus restore no-ops gracefully; commented in code).
- Verification: `npx tsc -b --force` + `eslint` pass on all touched files.

**Still pending from this phase's original scope:** real-data verification — needs the Phase 3 backend (role enum, seeded developer account, live `/features`).

---

### Phase 6 — Unauthorized page + final polish (~1 h) — ⬜ PENDING

- New `src/pages/UnauthorizedPage.tsx` + public route `<Route path="/unauthorized" element={<UnauthorizedPage />} />` (outside all guards) — fixes the pre-existing blank-page gap (§2.7).
- Visual QA of every role: each sidebar shows only its own links; cross-role URL access lands on `/unauthorized`.

---

## 5. Rollout order & sizing

| Phase | Depends on | Est. effort | Can ship alone? | Status |
|---|---|---|---|---|
| 1+2. Role + routing/nav | — | 1.5 h | Yes | ✅ **Done 2026-09-13** |
| 3. Backend | — | backend team | Yes | ⬜ Pending |
| 4. Flag context | 3 (`GET /features`) | 1.5 h | Yes (fail-open, harmless) | ✅ **Done 2026-09-13 (mock mode)** |
| 5. Developer pages | 2, 3 | 3–4 h | Yes | ✅ **Done 2026-09-13 (mock mode)** |
| 6. Unauthorized + polish | 2 | 1 h | Yes | ⬜ Pending |

Phase 3 is the only blocker between mock mode and production: once live, remove the two mock branches (provider + features page) and the switch is real. Sidebar/route flag filtering is deferred frontend work (see Phase 4 "Remaining").

---

## 6. Security & edge cases

1. **Server-side authorization is mandatory.** The frontend guards are UX only. `PATCH /features/:key` must reject non-developers with 403 (verified in QA by calling it from the browser devtools as admin).
2. **Fail-open flags by default** — a disabled/failing `/features` endpoint must not brick the app for admins/teachers/students, and must not toast-spam (`skipErrorToast`). Document any deliberate fail-closed flags.
3. **Audit trail** — `features.updated_by` / `updated_at` (§3.3) records who/when. A visible "recent changes" list on the developer dashboard is a later enhancement.
4. **First developer account** — DB seed only; no signup path exists anywhere in the UI (§2.6).
5. **LocalStorage cache** — `userContext.tsx` caches the user (including role). After a role change in the DB, the stale cached role applies until the next `fetchUser()` (page load). Acceptable; note in QA.
6. **Concurrency** — two developers toggling simultaneously: last write wins; the UI `refetch()`es after every toggle to resync.
7. ~~**Outer-gate regression risk**~~ — **OBSOLETE (v3):** the outer gate was removed upstream (§2.3); per-role inner gates are the only frontend boundary.

---

## 7. Testing checklist

Build & role wiring (Phase 1+2 scope):
- [x] `npx tsc -b` passes with `DEVELOPER` added.
- [ ] Developer login → lands on `/developer/dashboard`, sidebar (desktop + mobile drawer) shows developer links only, header title derives per page. *(Needs Phase 3 backend + seeded account.)*
- [ ] Developer cannot open `/admin/*` URLs → `/unauthorized` page (not blank; needs Phase 6 page).
- [ ] Admin/teacher/student cannot open `/developer/*` → `/unauthorized`, and see no developer links.

Feature flags (Phases 3–5 scope):
- [ ] `GET /features` populates the provider; flags fail open if the endpoint is down (app usable, no toast). *(Live fetch implemented; verify once Phase 3 is up.)*
- [ ] Disabling a flag hides the corresponding sidebar entry **and** makes the route show the disabled state for admin/teacher/student. *(Blocked on sidebar/route filtering — deferred, see Phase 4 "Remaining".)*
- [ ] PATCH as non-developer from devtools → 403. *(Needs Phase 3.)*
- [x] Toggling in mock mode: optimistic update, confirm dialog on disable, simulated delay, switch state survives re-render. *(Mock-mode subset verified; refresh-persistence + two-tab cases need Phase 3.)*
- [ ] Two tabs open: toggle in one → other tab resyncs on next navigation/refetch. *(Needs Phase 3.)*

Polish:
- [x] Skeletons + `aria-busy` on all three developer pages; `prefers-reduced-motion` disables shimmer/animations (guards in `developerDashboard.css`).

---

## Decision log

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Developer access scope | **Own area only** (`/developer/*`) | Keeps platform management separate from academic administration; smallest permission surface. |
| 2 | Feature flag source | **Backend-driven** (DB table + API) | Toggles must apply to all users instantly and persist; frontend-only config can't do that. |
| 3 | Implementation timing | ~~Documentation only for now~~ → **Implementation started** | Phases 1+2 shipped 2026-09-13; doc now tracks progress. |
| 4 | Mock mode for pre-backend QA | `VITE_FEATURE_FLAGS_MOCK` env switch (provider + features page) | Lets the full toggle flow be built and QA'd before the backend exists; two mock branches to delete in Phase 3. |

## Changelog

- **v4 (2026-09-13)** — Phases 4+5 marked done (mock mode): flag plumbing implemented (3-file context, provider placement, `setTimeout` deferral for the lint rule) and all three developer pages replaced with working UI (KPIs + status grid, toggle management with confirm-on-disable + search, password change). Mock branches documented (provider map + features-page PATCH skip) as tech debt for Phase 3. Sidebar/route flag filtering explicitly deferred out of Phase 4. Rollout table, testing checklist (mock-mode subset checked), and decision log updated; decision #4 added for the mock switch.
- **v3 (2026-09-13)** — Implementation started: Phases 1+2 marked done with the exact changes made (role constant, `DASHBOARD_PATH`/`DASHBOARD_LINKS`, `App.tsx` route group, placeholder pages + stub CSS). §2.3 rewritten: the **outer route gate was removed upstream** — per-role inner gates are now the only frontend boundary; §6.7 regression risk marked obsolete; route-path style corrected (absolute, not relative). Phase 4 gained an interim mock-mode note; testing checklist split by phase with completed items checked.
- **v2 (2026-09-13)** — Deep-dive revision: documented the outer route-gate coupling (§2.3, the critical miss in v1); confirmed no user-creation UI exists (§2.6); adopted the 3-file context pattern and provider placement (§4 Phase 4); added `skipErrorToast` to the flags fetch; `updated_by` audit columns; ConfirmDialog-based disable flow; expanded QA checklist with outer-gate regression cases.
- **v1 (2026-09-13)** — Initial plan.
