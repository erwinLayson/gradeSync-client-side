# Role-Wide Login Master Switches — Plan

> **Status:** ✅ Built & smoke-tested (12/12 API checks) — browser QA pending

## 1. Goal

The developer can disable **all logins for an entire role** (admin / teacher / student) with one switch, on top of the per-account deactivation that already exists on `/developer/users` (docs/developer-users-plan.md).

| Switch (key) | Effect when OFF |
|---|---|
| `login_admin` | Every admin account refused at login |
| `login_teacher` | Every teacher account refused at login |
| `login_student` | Every student account refused at login |

- **`login_developer` deliberately does not exist** — the developer can never lock themselves out via a role switch.
- Per-account deactivation (`users.status = 'inactive'`) keeps working independently; both gates apply.

## 2. Design decisions

1. **Reuse the `features` table + flag system.** The flags already flow to the client via `GET /features` → `FeatureFlagProvider` → `useFeatureFlags()`. No new table, endpoint, or context needed. A disabled flag is a *login policy*, not a "feature", but the mechanism is identical and the developer already knows the UI.
2. **Server-side enforcement at login** (`LoginUserService`): after password verification and the `status` check, look up `login_<user.role>`; if the flag exists and is disabled → `403 ForbiddenError` with a clear message. **Fail-open** if the row is missing (a deleted flag never locks anyone out).
3. **Lockout insurance** (`updateFeatureService`): hard-block disabling any key matching `login_developer` (and any `login_` key not in the known set, defensively). The developer flag doesn't exist, but the guard makes it impossible to create that hole through the API.
4. **Migration is seed-only** (step 19 in `migrate_all.mjs`): `INSERT … ON DUPLICATE KEY UPDATE label/description` — never touches `enabled`, so a developer's chosen state survives re-runs and redeploys (same convention as steps 17/18).
5. **Known limitation (documented):** existing JWT sessions stay valid up to their 1h expiry; the switch blocks new logins, not active sessions. Acceptable for a capstone scope; noted on the UI card.

## 3. Changes

| File | Change |
|---|---|
| `server/migrate_all.mjs` | Step 19/19: seed the 3 `login_*` rows (idempotent upsert) |
| `server/src/service/authentication.ts` | Login gate: `login_<role>` disabled → 403 (fail-open on missing row) |
| `server/src/service/features.ts` | Guard: refuse disabling `login_developer` / unknown `login_` keys |
| `client/src/pages/developer/featureMeta.ts` | Labels/descriptions for the 3 flags (Feature Management page renders them automatically) |
| `client/src/pages/developer/DeveloperUsers.tsx` | "Role login switches" card — 3 switches driven by `useFeatureFlags()`; disabling goes through danger `ConfirmDialog` |

## 4. QA checklist

> **API smoke test — 2026-09-15, all passed** against the local dev server: disable `login_student` → student login **403** with *"Logins for student accounts are currently disabled. Contact the system developer."*; admin/teacher/dev logins stayed **200**; re-enable → student **200** again; disable `login_developer` → **403** (lockout insurance); unknown `login_x` → **403**; admin token PATCHing a login switch → **403** (route is developer-only). Migration re-run: step 19 idempotent, `enabled` state preserved. Final state: all three switches re-enabled.

- [ ] `PATCH /features/login_student {enabled:false}` → student login **403** with message; admin/teacher/dev logins still **200**
- [ ] Re-enable → student login **200**
- [ ] Individually deactivated account in an enabled role → still **401** (independent gates)
- [ ] Admin token hitting `PATCH /features/login_student` → **403** (route is developer-only)
- [ ] `PATCH /features/login_developer` (or unknown `login_x`) disable attempt → **403** guardrail message
- [ ] `node migrate_all.mjs` re-run → seeds missing rows, never flips an existing `enabled` value
- [ ] UI: switch flip is optimistic; simulated failure rolls back; disabled state shows the danger dialog

## 5. Explicitly deferred

- Force-logout of active sessions when a switch flips (needs a token denylist — out of scope)
- Scheduled/time-windowed login windows (e.g. "students may log in 8am–5pm")
- Audit columns on `features` beyond `updatedBy/updatedAt` (already present)
