# Developer Manages User Accounts — Implementation Plan

> **Status:** 🚧 Phases 1–3 complete — Phase 4 (QA + docs sweep) pending
> **Created:** 2026-09-15
> **Depends on:** Developer role (all frontend phases done; see `developer-role-plan.md`) — the dev role is enforced server-side (`allowedRoles([ROLES.DEVELOPER])` pattern proven by `routes/features.ts` and `routes/landingContent.ts`).
> **Goal:** Let the developer account manage **login accounts** (the `users` table): list/search accounts, activate/deactivate, reset passwords, and change roles — the platform-level account lifecycle, distinct from the admin's academic management (students/teachers/enrollments entities).

---

## 1. Scope — what "manage users" means here

The developer is the platform manager (Decision #1 of `developer-role-plan.md`). Account management is split across two roles so responsibilities stay clean:

| Concern | Role | Why |
|---|---|---|
| Create/edit **academic entities** (student profiles, teacher profiles, enrollments) | Admin (existing pages) | Academic ownership |
| **Login account lifecycle** — who can sign in, as what role, with what credential state | **Developer (this plan)** | Platform/security ownership |

Concretely, the developer gets:

1. **View & search** all user accounts (id, email, role, status)
2. **Deactivate / reactivate** any account (the "fire someone / leave request" path — kills login without destroying data)
3. **Reset password** to a temporary password (account-recovery path; user changes it on next login — stretch, §7)
4. **Change role** (promote teacher→admin etc.) — guarded heavily (§6)
5. ~~Delete~~ — **explicitly deferred** (Decision #3): `users` rows are FK-parents of students/teachers/enrollments; `deleteUserById` exists in the model but hard delete would either fail on FK constraints or cascade-destruct academic history. Deactivation covers every legitimate need.

**Not in scope:** creating student/teacher entities (admin), managing feature flags (done), editing landing content (done).

---

## 2. Current state (as-built facts — verified 2026-09-15)

### 2.1 Backend (`server/src`)

| Fact | File | Impact |
|---|---|---|
| `GET /users` + `POST /users` are **admin-only** | `routes/users.ts` | Developer cannot list accounts today → needs either route widening or a dev-scoped route |
| `GET /users/:id` admin-only; `PUT /users/:id` = own-account-or-admin, **whitelisted to email/password only** (no role/status escalation possible — deliberately hardened) | `routes/users.ts`, `controller/users.ts`, `model/users.ts` | Role/status changes need **new endpoints**, not widening PUT |
| **Dead model code:** `Users.updateUserStatus(userId, "active"\|"inactive")` and `Users.deleteUserById(id)` exist but are wired to **no controller/route** | `model/users.ts` | Phase 1 wires the first one up (status) — the exact missing piece |
| `getUserByEmail` returns password hash — reusable for the reset flow | `model/users.ts` | Reset = hash new temp password, no plaintext anywhere |
| Login checks `status`: deactivated users already rejected (seed/backfill in migration step 1 set `status` enum `active\|inactive`) | `controller/authentication.ts` + `users.status` | Deactivation **works end-to-end the moment the endpoint exists** |
| `Validate()` helper + `NormalizedData()` + `{ message, success, data }` envelope + `BadRequestError`/`ForbiddenError` | `helper/*`, `middleware/errors.ts` | Follow existing controller conventions |
| `allowedRoles([ROLES.DEVELOPER])` proven in `routes/features.ts`, `routes/landingContent.ts`, `routes/uploads.ts` | — | Copy the middleware array pattern |
| Password hashing = bcrypt via `createUserService`/auth | `service/users.ts` | Reuse the same hash call for resets |
| `DEFAULT_PASSWORD` env var exists (seeded users) | `.env.example` | Natural temp-password value for reset (force-change UX deferred, §7) |

### 2.2 Client (`client/src`)

- **No user-management UI exists anywhere** (`CreateUserProps` unreferenced by pages; only `AdminSettings.tsx` touches `/users` for its own password change) — confirming §2.6 of the role plan.
- Proven patterns to copy: `DeveloperFeatures.tsx` (list + search + per-row action + ConfirmDialog danger flow + optimistic update with rollback), `DeveloperLandingContent.tsx` (per-item save with dirty state), `analytics__card` chrome, `SkeletonLine` + `aria-busy`, `developerDashboard.css` styling.
- `DASHBOARD_LINKS.developer` in `constant/navigation.ts` — add "User Accounts" (`FaUsers` — already imported? no; `FiUsers` is used on landing — pick `FaUsers` from react-icons/fa).

### 2.3 Known related gaps (NOT this plan's job, listed for honesty)

- `GET /users` controller has empty `catch {}` blocks (swallows errors → hanging requests) — pre-existing bug in `getAllUsersController`/`getUserByIdController`. Fix opportunistically in Phase 1 since we touch this file (one-line `next(err)` each).
- `users` table has no `updated_by`/`updated_at` audit columns — role changes are security-sensitive (§6.5 proposes a minimal fix or an explicit deferral).

---

## 3. Target design

```
        ┌────────────────────────── BACKEND ──────────────────────────┐
        │  (all developer-only: ValidateToken + allowedRoles([DEV]))   │
        │                                                             │
        │  GET    /users                ← widen: admin OR developer   │
        │  PATCH  /users/:id/status     NEW  { status }               │
        │  PATCH  /users/:id/role       NEW  { role }                 │
        │  POST   /users/:id/reset-password  NEW → { tempPassword }   │
        │                                                             │
        │  New shared guard: developer-account guardrails (§6)        │
        └───────────────────────────┬─────────────────────────────────┘
                                    │
        ┌───────────────────────────┴─────────────────────────────────┐
        │                        FRONTEND                             │
        │  /developer/users — account list + search + role filter,    │
        │  per-row actions: Deactivate/Activate (danger confirm),     │
        │  Reset password (danger confirm), Change role (select)      │
        │  Sidebar: "User Accounts" (FaUsers) under Configuration     │
        └─────────────────────────────────────────────────────────────┘
```

### 3.1 Endpoint contract

| Method | Path | Access | Body | Response `data` | Errors |
|---|---|---|---|---|---|
| `GET` | `/users` | admin **or** developer | — | `UserAccount[]` — `{ id, email, role, status }` (never password) | 401/403 |
| `PATCH` | `/users/:id/status` | **developer only** | `{ status: "active" \| "inactive" }` | updated account | 400 bad status / unknown id → 404; guardrail → 403 with message |
| `PATCH` | `/users/:id/role` | **developer only** | `{ role: UserRoles }` (whitelist-checked) | updated account | 400 unknown role; 403 guardrails; 404 |
| `POST` | `/users/:id/reset-password` | **developer only** | — (no body) | `{ tempPassword }` — shown ONCE to the developer to hand over | 404; 403 on self |

Unknown `:id` → 404 everywhere (aligned with the landing-content contract fix).

### 3.2 Guardrails (the heart of the design — enforced server-side)

1. **A developer cannot deactivate or demote themselves.** 403 `"You cannot deactivate your own account"`.
2. **The last active developer cannot be deactivated or demoted.** Count active developers first; if the target is the last one → 403 `"At least one active developer account must remain"`.
3. **Role values are whitelist-checked** against `ROLES` — no arbitrary strings reach the DB.
4. **Password reset on self is refused** (use Settings' own change flow, which requires the current password). Resetting *another developer's* password is allowed (recovery scenario) but the temp password is returned in the response and never stored in plaintext.
5. **Deactivated users** keep their role and academic links — reactivation restores everything. No data loss ever.
6. Frontend guards (`ProtectedRoutes`) are UX only; **every new route carries the server-side developer check**.

---

## 4. Phased plan

| Phase | Scope | Est. | Ships alone? |
|---|---|---|---|
| **1. Backend** | Widen `GET /users` to developer; 3 new routes + controller + service (wire up the dead `updateUserStatus`); guardrails; fix empty catch blocks; validation | 2–3 h | ✅ API-only, no UI change |

> **Phase 1 — DONE & smoke-tested** (13/13 against local dev server). Shipped: `updateUserRole` + `countActiveUsersByRole` model methods; `updateUserStatusService` / `updateUserRoleService` / `resetUserPasswordService` (all guardrails server-side); 3 controllers (+ `next(err)` fix in the two pre-existing empty catch blocks); routes widened (`GET /users`, `GET /users/:id` → admin+developer) and 3 dev-only routes added. `tsc --noEmit` clean.
>
> **Verified:** dev login OK; dev can list users; self-deactivation → 403; demoting self as only dev → 403; bad role string → 400; admin hitting dev route → 403; anonymous → 401; reset-password returns one-time temp password; deactivate → login 401 → reactivate → login 200. All test mutations were rolled back (teacher restored to `teacher`/`active` with seed password).
| **2. Client plumbing** | `constant/users.ts` account types; `api.ts` helpers (existing generic wrappers suffice); `constant/navigation.ts` sidebar entry | 1 h | ✅ (page hidden behind missing route = invisible) |

> **Addendum — self-service email change (developer + all roles).** `PUT /users/:id` route widened to include `ROLES.DEVELOPER` (own account only — the own-or-admin controller check still applies). Service hardened in `service/users.ts`: own-account **email** change now requires `currentPassword` (same rule as password change — the email IS the login identity), plus a server-side email format guard (400) shared by every role. Client: "Change Email" card on `/developer/settings` — validates format/duplicate-of-current, sends `{ currentPassword, email }`, then ends the session and redirects to `/login` (the JWT carries the old email). Smoke-tested 10/10: wrong password → 401, duplicate → 409, bad format → 400, valid change → old email 401 / new email 200, revert OK, teacher same-email no-op 200, cross-account attempt → 403.
>
> **Phase 2 — DONE.** `constant/users.ts`: added `UserStatus`, `UserAccount` (row shape of `GET /users`: id/email/role/status), and the `UpdateUserStatusPayload` / `UpdateUserRolePayload` bodies. The pre-existing `User` type was deliberately **not** extended — `/users/verify` returns the JWT payload (id/email/role only), and the user context types against it. `api.ts` needed no changes (generic `getAPICall`/`patchAPICall`/`postAPICall` suffice; toasts + error handling already centralized). `navigation.ts`: "User Accounts" entry (`FaUsersCog`, `/developer/users`) added to the developer's Configuration section. `tsc -b` + eslint clean.
| **3. `/developer/users` page** | Account table: search (email/id), role filter chips, status pills; Deactivate/Activate via `ConfirmDialog` danger; Reset password via `ConfirmDialog` + one-time temp-password reveal; Change role via inline select + confirm; optimistic updates with rollback (`refetch()`), skeleton + `aria-busy`, `developerDashboard.css` styles | 3–4 h | ✅ |

> **Phase 3 — DONE** (`client/src/pages/developer/DeveloperUsers.tsx`, route `/developer/users`). Reuses the DeveloperFeatures card language (`analytics__card`, `developer-feature` rows, `developer-switch`, `developer-search`) — no new CSS needed. Search by email/ID; role filter chips (All/Admins/Teachers/Students/Developers, `aria-pressed`); Active/Inactive pills; per-row role select (change opens a `tone="primary"` confirm dialog), reset-password button (custom two-stage dialog: confirm → one-time temp-password reveal with copy button), active/deactivate switch (deactivation goes through the danger `ConfirmDialog`). Optimistic updates roll back via `refetch()` on failure; initial fetch deferred via `setTimeout(0)` like the existing contexts (satisfies `react-hooks/set-state-in-effect`). Guardrails surfaced in UI: self-deactivation switch disabled, "You" badge on own row; server remains the enforcement layer. `tsc -b` + eslint clean. Browser QA still to do (Phase 4).
| **4. QA + docs** | Checklist below; update this doc's status | 1 h | — |

Sequencing notes: Phase 1 is independent; Phases 2+3 can start immediately after (the API is the only blocker). No migration needed **unless** §6.5 audit columns are adopted.

---

## 5. Testing checklist

Phase 1 (curl, mirroring the Phase 2 landing-content QA):
- [ ] `GET /users` as developer → 200 full list (no password field in any row); as anonymous → 401
- [ ] `PATCH /users/:id/status` as developer → 200; login as the deactivated user → rejected; reactivate → login works again
- [ ] Guardrails: self-deactivate → 403; demote/deactivate the last active developer → 403
- [ ] `PATCH /users/:id/role` with `"hacker"` → 400; with `"admin"` → 200
- [ ] `POST /users/:id/reset-password` → 200 + temp password works at login; on self → 403; unknown id → 404
- [ ] All of the above as admin → **403** (developer-only surface)

Phase 3 (browser):
- [ ] Page loads under the developer gate; admin/teacher/student direct-URL → `/unauthorized` (note: `/unauthorized` page itself is still pending from the role plan Phase 6)
- [ ] Search filters by email; role chips filter; status pill reflects server truth after each action
- [ ] Deactivate flow: confirm dialog → optimistic pill flip → toast; simulated failure rolls the pill back
- [ ] Reset flow: confirm → temp password revealed once → dismiss erases it from the DOM; the temp password actually logs in

---

## 6. Security & edge cases

1. **Server-side developer check on every new route** — frontend gate is UX only (role plan §6.1).
2. **Never return password hashes** — `GET /users` selects `id, email, role, status` only (the model already does this; keep it true in new queries).
3. **Guardrails are server-side** (§3.2) — the UI disables the buttons too, but never as the only layer.
4. **Audit visibility now**: status/role changes return the updated row; a "last changed" display needs audit columns — **Decision #4**: add `users.updatedBy`/`users.updatedAt` (nullable, FK to users) in a small migration, or defer to a later audit plan. Recommend: defer for MVP, note it in the changelog.
5. **Email is identity** — role change does not touch email; password reset does not touch status. One action = one effect per endpoint (no mega-PATCH).
6. **Concurrency** — two developers acting on the same account: last write wins per field; the UI refetches after each action (same as features).
7. **LocalStorage staleness** — a deactivated user's cached `user` in `localStorage` keeps UI working until their next `/users/verify` 401 bounce (same known behavior as role changes, role plan §6.5). Acceptable; mention in QA.
8. **Temp password display** — rendered once in the confirm-dialog success state; never cached, never sent again.

---

## 7. Deferred (explicitly out of MVP)

- **Force-change-on-first-login** for temp passwords (needs a `mustChangePassword` flag + login-flow branch) — the reset flow ships with `DEFAULT_PASSWORD`-style temp values and a "share securely" hint instead.
- **Hard delete** of accounts (FK reality, Decision #3) — revisit only if orphan-account cleanup becomes a real need.
- **Audit/change-history list** per account (needs §6.4 columns).
- **Bulk actions** (multi-select deactivate) — every action stays single-account, confirm-gated.

## Decision log

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Account lifecycle belongs to **developer**, entities to admin | Developer owns `users`-table management | Matches the platform-manager role split already in place; admins keep academic ownership |
| 2 | New dedicated routes instead of widening `PUT /users/:id` | `PATCH .../status`, `PATCH .../role`, `POST .../reset-password` | PUT is deliberately hardened to email/password; widening it would reopen escalation risks; separate endpoints = one action, one effect, precise guardrails |
| 3 | Deactivate-first, no delete | Status is the only removal path | `users` is an FK parent; hard delete risks academic history; deactivation already blocks login end-to-end |
| 4 | Audit columns | **Deferred** (recommend revisiting with a proper audit plan) | MVP value is the action itself; `updatedBy/At` on `users` touches a core table and deserves its own migration + review |
| 5 | Temp password returned in response | Shown once in UI, never stored plaintext | No email infra exists; matches the seeded-account `DEFAULT_PASSWORD` pattern |

## Changelog

- **v1 (2026-09-15)** — Initial plan. Anchored on as-built facts: `updateUserStatus`/`deleteUserById` exist unwired in `model/users.ts`; `GET /users` admin-only; `PUT /users/:id` deliberately whitelisted to email/password; no client user-management UI exists. 4 phases; guardrails (self-protection, last-developer protection, role whitelist) designed server-side; delete + force-change + audit deferred.
