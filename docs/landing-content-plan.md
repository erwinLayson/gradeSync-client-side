# Landing Page Content — Developer-Managed (Implementation Plan)

> **Status:** 🚧 In progress — **Phases 1–5 code complete; Phase 2 QA passed** (2026-09-15). Phase 5 browser QA **skipped by choice** (2026-09-15) — do a quick manual pass (see §5 Phase 5 notes) before trusting the preview flow in production.
> **Created:** 2026-09-15
> **Depends on:** Developer role (Phases 1+2+4+5 done; see `developer-role-plan.md`) and the features backend, which **already exists** in `server/src` (`routes/features.ts` + `allowedRoles([ROLES.DEVELOPER])`) — the role plan doc's "Phase 3 pending" note is stale.
> **Goal:** Let the developer account edit the public landing page from the developer area — hero slide images (upload with URL fallback), contact info, and every other content section — without a code deploy.

---

## 1. Purpose

`LandingPage.tsx` currently renders **hardcoded constants** (`HERO_SLIDES`, `STATS`, `ABOUT_FEATURES`, `HOW_IT_WORKS`, `AUDIENCES`, `CONTACT_ITEMS`, CTA copy). Changing a photo, the office phone number, or a headline requires editing source and redeploying. This plan moves that content into the database and gives the developer role a UI to manage it.

Scope (user-confirmed): **all content sections**, with **file upload as the primary image mechanism and pasted URL as fallback**.

Editable sections:

| Section key | Controls on the page |
|---|---|
| `hero` | Slide images (3), slide labels, headline, headline accent, subtitle |
| `stats` | 4 stat rows (`value`, `label`) |
| `about` | Section heading + 4 feature cards (`iconKey`, `title`, `text`) |
| `how_it_works` | Section heading + 4 steps (`step`, `title`, `text`) |
| `audiences` | Section heading + 3 audience cards (`iconKey`, `title`, `text`, `points[]`) |
| `contact` | Section heading + 4 contact items (`iconKey`, `title`, `lines[]`) |
| `cta` | CTA band title + text |

Not editable (by design): nav links, buttons/CTA targets, footer layout, logo — structural, not content.

---

## 2. Current state (as-built facts)

- **Frontend:** all copy/images are module constants in `client/src/pages/LandingPage.tsx`; hero images are bundled assets (`assets/hero-1..3.svg`). The page is **public** (pre-login) and redirects any authenticated user to their dashboard (`if (auth && user) return <Navigate to={DASHBOARD_PATH[user.role]} />`) — relevant for preview, see §7.4.
- **Backend:** Express + mysql2, `routes → controller → service → model`, `{ message, success, data }` envelope via `SuccessResponse`, role gating via `ValidateToken` + `allowedRoles([...])`. `ROLES.DEVELOPER` exists server-side. **No multer / no file-upload infra exists yet.**
- **Patterns to reuse:**
  - Route + middleware shape: `server/src/routes/features.ts` (`developerOnly` array).
  - Model with audit columns (`updatedBy`, `updatedAt`) + upsert-for-seed: `server/src/model/features.ts`.
  - Manual body validation with `BadRequestError`: `server/src/controller/features.ts`.
  - Module-level cache + window-event invalidation: `client/src/hooks/useSchoolInfo.ts`.
  - Fail-open flags context: `client/src/context/featureFlagContext.tsx`.

---

## 3. Target design

```
            ┌────────────────────────── BACKEND ──────────────────────────┐
            │                                                             │
            │  landing_content table (NEW)                                │
            │  ┌────┬──────────┬──────────────────┬───────────┬────────┐  │
            │  │ id │ section  │ content (JSON)   │ updatedBy │ updtAt │  │
            │  └────┴──────────┴──────────────────┴───────────┴────────┘  │
            │                                                             │
            │  GET  /landing-content        (PUBLIC — landing is pre-login)│
            │  PATCH /landing-content/:section  (developer only)          │
            │  POST /uploads                (developer only, multipart)   │
            │  GET  /uploads/<file>         (public static)               │
            └───────────────────────────┬─────────────────────────────────┘
                                        │
            ┌───────────────────────────┴─────────────────────────────────┐
            │                        FRONTEND                             │
            │                                                             │
            │  useLandingContent() — module cache + "landing-content-     │
            │  updated" event (useSchoolInfo pattern); merges fetched     │
            │  content OVER DEFAULT_LANDING_CONTENT (fail-open)           │
            │                                                             │
            │  LandingPage.tsx — renders from merged content              │
            │                                                             │
            │  /developer/landing-content — per-section editors,          │
            │  image upload widget, per-section save                      │
            └─────────────────────────────────────────────────────────────┘
```

### 3.1 Data model — JSON per section (Decision #1)

One row per section, content stored as a JSON blob validated server-side per section. The content is presentational and section-scoped; normalizing into 7+ tables buys nothing.

```sql
CREATE TABLE landing_content (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  section    VARCHAR(64)  NOT NULL UNIQUE,
  content    JSON         NOT NULL,
  updatedBy  INT          NULL REFERENCES users(id),   -- audit, same as features
  updatedAt  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

Seed all 7 sections with the **current hardcoded content** so the DB starts in sync with today's page (seed via `upsert`, like `Features.upsert`, so re-seeding is idempotent).

Content shapes (TypeScript contracts in `server/src/constant/landingContent.ts`, mirrored client-side):

```ts
interface HeroSlide   { image: string; label: string }              // image = URL
interface HeroContent { slides: HeroSlide[]; title: string; titleAccent: string; subtitle: string }
interface StatRow     { value: string; label: string }
interface FeatureCard { iconKey: string; title: string; text: string }
interface StepCard    { step: string; title: string; text: string }
interface AudienceCard{ iconKey: string; title: string; text: string; points: string[] }
interface ContactItem { iconKey: string; title: string; lines: string[] }
interface CtaContent  { title: string; text: string }
```

**Icons are stored as keys** (`"FaUserGraduate"`, `"FiMapPin"`, …), never as arbitrary strings rendered as component names (Decision #4). Client maps keys through a **whitelist lookup** (`ICON_REGISTRY: Record<string, IconType>`); unknown keys fall back to a default icon. Backend validates `iconKey` against the same key list (shared constant duplicated server-side or fetched — start duplicated, it changes rarely).

### 3.2 API

| Method | Path | Access | Notes |
|---|---|---|---|
| `GET` | `/landing-content` | **Public (no ValidateToken)** | Returns `{ [section]: content }`. The landing page renders for anonymous visitors, so this read cannot sit behind auth (Decision #2). Exposes only what the page already shows publicly. |
| `PATCH` | `/landing-content/:section` | **developer only** | Body = the section's content shape. Validate per-section (unknown section → 404; shape violation → 400). Records `updatedBy`/`updatedAt`. |
| `POST` | `/uploads` | **developer only** | Multipart (`multer`), field `image`. Returns `{ url }` (absolute, built from the server origin env var — client and server run on different origins). |
| `GET` | `/uploads/<file>` | Public | `express.static` on the uploads dir. |

Upload validation (mandatory):

- MIME whitelist: `image/jpeg`, `image/png`, `image/webp`. **No SVG** — stored SVG is an XSS vector via `<script>`; if SVG is ever needed, sanitize + serve with `Content-Disposition: attachment` first. The URL fallback can still point at a trusted host.
- Size cap: **5 MB**.
- Filename: server-generated (`crypto.randomUUID()` + validated extension) — never trust the client filename.
- Uploads dir via env (`UPLOAD_DIR`, default `<server>/uploads`), add to `.env.example`, `.gitignore` the dir.
- Keep `express.json()` limit in mind: section payloads are small, but hero can carry image URLs — set the PATCH body cap explicitly (e.g. 512 KB) and enforce max item counts server-side (e.g. ≤ 6 slides, ≤ 8 stats) so a stray paste can't bloat the page.

### 3.3 Frontend consumption

- **`client/src/constant/landingContent.ts` (Phase 1):** move today's hardcoded constants here as `DEFAULT_LANDING_CONTENT` + the icon-key registry. `LandingPage.tsx` renders from it. Pure refactor, zero behavior change, ships alone.
- **`client/src/hooks/useLandingContent.ts` (Phase 3):** `useSchoolInfo` pattern — module-level cache, `GET /landing-content` with `{ toast: false, skipErrorToast: true }`, `invalidateLandingContentCache()` + `landing-content-updated` window event dispatched after a successful developer save. Returns merged content.
- **Merge strategy (fail-open, Decision #2):** `content = deepMerge(DEFAULT_LANDING_CONTENT, fetched)` per section. A missing/failing/empty endpoint renders exactly today's page. The public page must never go blank or toast because content is down.
- No provider/context needed — one consumer page; the hook + cache suffices. Revisit only if more pages need landing content.

### 3.4 Developer UI (`/developer/landing-content`, Phase 4)

- Route group in `App.tsx` under the existing `ROLES.DEVELOPER` `ProtectedRoutes` gate; sidebar entry under **Configuration**: `{ label: "Landing Content", path: "/developer/landing-content", icon: FaImage }`.
- One card per section, mirroring the page order: Hero, Stats, About, How it works, Who it's for, Contact, CTA.
- **Hero card:** slide rows with image preview thumbnail, `Upload` button (POST /uploads → fills URL) *or* paste-a-URL input (fallback), label field, remove/reorder; headline/accent/subtitle fields.
- **Array sections (stats/about/steps/audiences/contact):** repeatable rows with add/remove; audience/contact get nested point/line editors.
- **Save model — per section (Decision #5):** one `Save` button per card → `PATCH /landing-content/:section`, optimistic local update + rollback via refetch on failure (same flow as feature toggles). Dirty-state indicator per card; warn on navigation with unsaved changes (`beforeunload` at minimum).
- Show `Updated <relative time> by <email>` per card from the PATCH response (audit visibility, matches features philosophy).
- Reuse: `ConfirmDialog` (`tone="danger"`) for row removal, `SkeletonLine` + `aria-busy` while loading, `developer-search` input styling, `analytics__card` card classes.

---

## 4. Phased plan

| Phase | Scope | Depends on | Est. | Ships alone? |
|---|---|---|---|---|
| **1. Defaults extraction** | `constant/landingContent.ts` + icon registry; `LandingPage.tsx` renders from defaults; `tsc` + eslint + visual diff | — | 1.5–2 h | ✅ **Done 2026-09-15** |
| **2. Backend** | Migration + seed; `landingContent` constant/types/validators; model/service/controller; routes (`GET` public, `PATCH` dev-only); multer upload endpoint + static serving + validation; env vars | — | 3–4 h | ✅ **Done 2026-09-15 (QA pending)** |
| **3. Frontend consumption** | `useLandingContent` hook (cache + event); merge-over-defaults; wire `LandingPage` | 2 | 1.5 h | ✅ **Done 2026-09-15** |
| **4. Developer UI** | Route + sidebar; `/developer/landing-content` page with per-section editors, upload widget, per-section save + rollback | 2, (3 for instant preview) | 4–6 h | ✅ **Done 2026-09-15 (browser QA pending)** |
| **5. Preview + polish + QA** | `?preview` escape hatch (§7.4); `beforeunload` dirty guard; preview bar UI; duplicate-key hardening; a11y pass | 3, 4 | 2 h | ✅ **Code done 2026-09-15 (browser QA skipped — manual pass pending)** |

Phase 2 backend task list (for the backend owner):

1. Migration file in `server/migrations/` (follow `migrate_all.mjs` conventions) creating `landing_content`.
2. `seed.ts`: upsert the 7 sections with current content (copy from `client/src/constant/landingContent.ts` after Phase 1 — keep values in sync).
3. `server/src/constant/landingContent.ts` — section keys + shapes + per-section validators (manual, `BadRequestError` style).
4. `model/landingContent.ts` (getAll as map, getBySection, upsertForSeed, updateSection) → `service` → `controller`.
5. `routes/landingContent.ts`: `publicRead = []`, `developerOnly = [ValidateToken, allowedRoles([ROLES.DEVELOPER])]`; mount in `app.ts`.
6. `routes/uploads.ts` + multer config + `express.static`; return absolute URLs from server-origin env; update `.env.example`.

---

## 5. Testing checklist

Phase 1:
- [x] `npx tsc -b` + eslint pass on `LandingPage.tsx` + `constant/landingContent.ts`.
- [ ] Landing page pixel-identical (visual diff / manual sweep of all sections). *(Manual QA pending.)*

Phase 2:
- [x] `GET /landing-content` works **without** a token (incognito); returns all 7 sections. *(Verified 2026-09-15 via curl.)*
- [x] `PATCH /landing-content/hero` as developer → 200, `updatedBy` recorded; as **admin from devtools** → 403; anonymous → 401; unknown section → 404; malformed body → 400. *(Verified 2026-09-15 via curl — dev 200 + audit, admin 403, anon 401, unknown 404, empty title 400, array body 400.)*
- [x] Upload: jpeg/png/webp accepted; `.svg`, `.exe`, oversized (>5 MB) rejected with 4xx; stored filename is a UUID; `GET /uploads/<file>` renders publicly. *(Verified 2026-09-15 — real PNG 201 with UUID filename + absolute URL, text-disguised-as-png 400 magic-byte rejection, admin 403, 6 MB 400, anon 401, served back 200 `image/png`.)*

Phase 3:
- [ ] Landing page renders DB content; killing the API (or 404) → page falls back to defaults, **no toasts**, no blank sections. *(Implemented with per-section shape guards; browser QA pending.)*
- [ ] After a developer save, an already-open landing tab picks up changes on next load; `landing-content-updated` event updates in-app consumers. *(Event dispatch itself lands with the Phase 4 developer page.)*

Phase 4:
- [ ] Each section saves independently; network failure rolls the editor back; dirty-state warns on navigation. *(Implemented; `beforeunload` guard is Phase 5.)*
- [ ] Upload from the editor fills the URL field and preview; pasted-URL fallback saves as-is. *(Implemented; browser QA pending.)*
- [ ] Admin/teacher/student have no "Landing Content" sidebar link and get `/unauthorized` on direct URL access. *(Gate is the existing `ROLES.DEVELOPER` ProtectedRoutes group; QA pending.)*

Phase 5 (code complete; automated browser QA was set up but skipped by choice — verify manually):
- [ ] `?preview` shows draft content for the developer without logout (§7.4). *(Implemented: editor publishes its draft to localStorage (2 h TTL); `/?preview` renders it via `useSyncExternalStore`, banner with Discard/Back-to-editor, auth redirect bypassed in preview mode, live re-publish updates an open preview tab. Verify by: edit a field → Preview page → check the draft renders + banner shows.)*
- [ ] `beforeunload` dirty guard on the editor. *(Implemented: native browser dialog when any section is dirty. Verify by: edit a field → close the tab → confirm dialog appears.)*
- [x] `prefers-reduced-motion` unaffected (slider behavior unchanged); keyboard operability of add/remove/upload controls. *(Preview-bar buttons are real `<button>`s with focus-visible outlines; reduced-motion CSS disables bar transitions; landing slider untouched.)*
- [x] Duplicate-key hardening for developer content. *(All landing list keys now pair content with index — repeated labels/lines from hand-entered content can no longer break React reconciliation.)*

---

## 6. Security & edge cases

1. **Server-side authorization is mandatory** — frontend gates are UX only. `PATCH /landing-content/:section` and `POST /uploads` must 403 for non-developers (verify from devtools as admin, same as features QA).
2. **Public read is intentional and safe** — the endpoint exposes only presentational content that anonymous visitors already see. Never widen it to include audit emails of *other* roles etc. `updatedBy` is returned only on the developer PATCH response.
3. **Upload hardening** — MIME + extension whitelist, 5 MB cap, UUID filenames, no SVG, uploads dir outside any executable path, `express.static` with `index: false`.
4. **Fail-open everywhere on the public page** — content fetch failure silently falls back to defaults; an outage degrades to today's hardcoded page, never to a blank or erroring landing page.
5. **Audit trail** — `updatedBy`/`updatedAt` per section; per-card "last updated" display is in Phase 4, a change-history list is a later enhancement.
6. **Concurrency** — two developers editing the same section: last write wins per section (per-section PATCH keeps the blast radius small); UI refetches after save.
7. **Caching** — anonymous visitors + CDNs: ship `Cache-Control: max-age=60` on `GET /landing-content` initially (cheap freshness), revisit with ETags later. In-app cache invalidates via the window event.
8. **Body limits** — cap PATCH body (512 KB) and array lengths server-side to keep the public payload lean.

---

## 7. Decision log

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Storage shape | **JSON blob per section** (`landing_content.section` + `content JSON`) | Content is presentational and section-scoped; normalizing into 7+ tables adds joins and migrations for no query benefit. Per-section server validation keeps shapes honest. |
| 2 | Read access | **Public `GET`**, fail-open frontend merge over defaults | The landing page is pre-login; auth-gating the read would break it for its primary audience. Fallback defaults guarantee the page survives an API outage. |
| 3 | Image storage | **Local disk via multer + `express.static`, absolute URLs** | No upload infra exists; disk is the smallest working step. URLs are stored (not paths), so moving to object storage (S3/R2) later is a backend-only swap. URL fallback covers externally hosted images from day one. |
| 4 | Icons | **Store icon keys, whitelist registry client-side** | Never persist arbitrary component names (injection risk, bundle coupling); registry keeps the allowed set explicit. |
| 5 | Save granularity | **Per-section PATCH** | Matches the storage shape; smaller payloads, smaller blast radius, independent dirty-state per card. |
| 6 | Preview | **`?preview` escape hatch on the landing page** | `LandingPage` redirects authenticated users to dashboards, so the developer otherwise can't see their changes without logging out (§4 Phase 5). |

## Changelog

- **v7 (2026-09-15)** — Phase 5 code done (browser QA skipped by choice): `?preview` escape hatch per Decision #6 — editor's "Preview page" link now publishes the UNSAVED draft to localStorage (`storeLandingPreview`, 2 h TTL, same fail-open shape guards as the DB path (reuses `mergeLandingContent`)) and opens `/?preview` in a new tab; `LandingPage` bypasses the auth redirect in preview mode and renders the draft over published content via `useSyncExternalStore` (snapshot-cached reader `readLandingPreview`, custom `landing-preview-updated` + cross-tab `storage` events), with a sticky amber preview bar (Discard draft / Back to editor, `landingPage.css`) that reflects no-draft/corrupt-draft states gracefully. `beforeunload` dirty guard on the editor (native dialog, returnValue per Chrome). Duplicate-key hardening: every landing list key now `${content}-${index}` (developer-entered repeats can't collide). ESLint `set-state-in-effect` drove the `useSyncExternalStore` migration. `tsc -b` + eslint clean. QA harness (CDP-driven headless Chrome, zero-install) aborted mid-sweep by user choice; harness + headless Chrome cleaned up. Manual verification steps recorded in §5 Phase 5.
- **v6 (2026-09-15)** — Phase 4 done: `pages/developer/DeveloperLandingContent.tsx` — seven section editors (Hero with slide rows incl. upload/URL/reorder, Stats, About, How It Works, Audiences, Contact, CTA) on one `SectionCard` chrome with per-section Save/Reset, dirty + last-saved chips, inline error banner, and a "Preview page" link. Fields: `Field` (input/textarea, maxLength from server limits), `ImageField` (thumb preview, upload via new `uploadFile()` helper in `api.ts` using FormData, client-side 5 MB pre-check, pasted-URL fallback), `IconField` (select over `ICON_REGISTRY` keys with live preview via a module-level `renderIconPreview()` helper to satisfy `react-hooks/static-components`), `StringList` (points/lines with add/remove), `HeadingEditor`. Saves PATCH per section; on success invalidates the landing cache + dispatches `landing-content-updated` so the public page resyncs instantly. Editor draft seeds once from `useLandingContent()` and is then owned by the page (a background re-sync never clobbers unsaved edits). Row removal is immediate (draft-only, nothing publishes until Save) — danger ConfirmDialog reserved for publish-level actions. Sidebar: "Landing Content" (FaImage) under developer Configuration; route added to the `ROLES.DEVELOPER` gate in `App.tsx`. `tsc -b` + eslint clean; browser QA in Phase 5.
- **v5 (2026-09-15)** — Phase 3 done: `mergeLandingContent()` added to `constant/landingContent.ts` — per-section shape guards mean one broken DB section degrades only that section to the default (fail-open, plan §6.4); `hooks/useLandingContent.ts` follows the `useSchoolInfo` module-cache + `landing-content-updated` window-event pattern with `{ toast: false, skipErrorToast: true }` (public page never toasts); `LandingPage.tsx` renders `landing = content ?? DEFAULT_LANDING_CONTENT`. Slider hardening: `slideCount` derived from merged content, clamped `activeSlide` when the list shrinks, and `slideCount` added to the auto-advance effect deps. `tsc -b` + eslint clean; browser QA deferred to Phase 5.
- **v4 (2026-09-15)** — Phase 2 QA passed end-to-end via curl (migration step 18 ran clean; public GET anon 200; PATCH dev 200 + audit / admin 403 / anon 401 / unknown 404 / malformed 400; uploads: PNG 201 + UUID + public fetch 200, fake bytes 400, admin 403, 6 MB 400, anon 401). Fixes surfaced by QA: unknown-section PATCH changed 400 → **404** (plan contract); env reads in `uploads.ts` **deferred to request time** — ESM evaluates route + page modules before `app.ts`'s `dotenv.config()`, so module-load `getEnv('UPLOAD_DIR')` crashed boot (also added a safe `./uploads` default); multer's own errors (e.g. `LIMIT_FILE_SIZE`) mapped to **400** instead of a 500 leak; public static handler now lazy-instantiates. QA content restored afterwards.
- **v3 (2026-09-15)** — Phase 2 done (QA pending): `landing_content` table via migrate_all.mjs step 18 + `migrations/create_landing_content.sql`; seed data mirrored across three places (client defaults, `constant/landingSeed.ts` for seed.ts, inlined in migrate_all.mjs — keep in sync). Full stack added: `constant/landingContent.ts` (types + `LANDING_ICON_KEYS` + limits), `helper/validateLandingContent.ts` (strict per-section validators that rebuild sanitized objects), model/service/controller/routes (public GET, dev-only PATCH). Uploads: `routes/uploads.ts` (multer memory storage, MIME filter + **magic-byte sniff** via `helper/imageValidation.ts` — no `file-type` dependency, 5 MB cap, UUID filenames, no SVG) + `express.static` public serving with absolute URLs from `SERVER_ORIGIN`. Hero SVGs copied to `client/public/assets/` so seeded `/assets/hero-*.svg` paths are stable across rebuilds. Env: `UPLOAD_DIR`, `SERVER_ORIGIN` (`.env.example` updated); `uploads/` git-ignored with `.gitkeep`. `tsc --noEmit` clean. Seed note: `seed.ts` upserts landing content (does not clobber developer edits).
- **v2 (2026-09-15)** — Phase 1 done: `client/src/constant/landingContent.ts` created (types = API contract, `ICON_REGISTRY` whitelist with `getIcon()` fail-open fallback, `DEFAULT_LANDING_CONTENT`, `LANDING_SECTION_KEYS`); `LandingPage.tsx` renders from the defaults with zero markup/CSS changes. `tsc -b` + eslint pass. Known tradeoff: strings that previously interpolated `SCHOOL_NAME` are now plain text in the defaults — if `SCHOOL_NAME` changes, update the landing defaults too (moot once DB content is live, Phase 3).
- **v1 (2026-09-15)** — Initial plan. Scope confirmed with user: all content sections; upload-primary images with URL fallback. Anchored on as-built facts: features backend already live in `server/src`, no upload infra yet, `useSchoolInfo` cache/event pattern reused for consumption.
