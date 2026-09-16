# GradeSync Frontend Improvement Plan

**Purpose:**
A practical roadmap for improving the GradeSync client codebase (`client/src`) in terms of correctness, maintainability, consistency, accessibility, and scalability.

**Last reviewed:** September 2026

---

## 1. Executive Summary

The GradeSync frontend has a solid foundation:

* Good design-token foundation in `index.css`
* Consistent BEM-style CSS naming
* Strong `ConfirmDialog` implementation
* Good loading, empty, and error-state handling
* Several well-structured pages that can serve as refactoring examples

However, the codebase has several structural problems that will become harder to maintain as the system grows.

### Main Problems

1. **Large monolithic pages**

   * Twelve pages exceed 650 lines.
   * `AdminClassrooms.tsx` is 1,433 lines (measured September 2026).
   * `TeacherGradebook.tsx` is 1,216 lines.

2. **Duplicated UI patterns**

   * Modals, cards, heroes, selects, charts, and animations are repeatedly implemented.
   * Around 52 similar `@keyframes` definitions exist across the project.

3. **Inconsistent modal implementations**

   * Multiple pages implement their own modal behavior.
   * Most lack proper focus trapping and focus restoration.
   * `ConfirmDialog` already provides the correct pattern and should become the standard.

4. **Inconsistent data hooks**

   * `useStudent`, `useTeachers`, `useClassroom`, and `useSubject` use different APIs, loading states, and error behavior.

5. **Accessibility gaps**

   * Some clickable rows/cards cannot be operated with a keyboard.
   * Some tables lack proper heading semantics.
   * Some charts and toast notifications need better ARIA support.

6. **Several correctness and product issues**

   * Some bugs remain.
   * `Admin-Reports.tsx` is still a hardcoded mockup.
   * Login features such as password recovery are incomplete.

---

# 2. Phase 1 — Critical Bugs

These should be handled before major refactoring.

| #  | Area             | Issue                                                                                                  | Status     |
| -- | ---------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| 1  | Admin Settings   | Save button could remain disabled because `setSubmitting(false)` was missing from `finally`.           | ✅ Fixed    |
| 2  | Admin Subjects   | Composite-subject editing previously failed to load existing components.                               | ✅ Fixed    |
| 3  | Admin Classrooms | Subject validation result was ignored, causing subjects without teachers to be silently dropped.       | ✅ Fixed    |
| 4  | API              | `uploadFile` manually set `Content-Type: multipart/form-data`, which can break the multipart boundary. | ✅ Fixed    |
| 5  | Hooks            | `useTeachers.fetchTeachers` lacked error handling.                                                     | ✅ Fixed    |
| 6  | Hooks            | Stray `console.log` remained in `useSubject.ts`.                                                       | ✅ Fixed    |
| 7  | Validation       | `!value` incorrectly treats valid falsy values such as `0` and `false` as empty.                       | ✅ Fixed    |
| 8  | Admin Reports    | Page is still a hardcoded mockup with non-functional filters/printing/downloading.                     | ⏸ Deferred |
| 9  | Login            | Remember-me and login error handling were incomplete.                                                  | ✅ Fixed    |
| 10 | Console cleanup  | Debug `console.log` / `console.error` statements remained in several files.                            | ✅ Fixed    |
| 11 | API              | Bodyless POST endpoints (`POST /users/:id/reset-password`) sent a literal `"null"` JSON body, which body-parser rejects with a 400 parse error. `postAPICall` now converts `null`/`undefined` data to an empty body. | ✅ Fixed    |

### Current Phase 1 Status

**9/10 items are complete.**

The remaining item is `Admin-Reports.tsx`.

Because the backend currently does not provide a general reports endpoint, a product decision is required:

* Connect the page to real backend data, or
* Clearly mark it as a prototype, or
* Remove it from the admin navigation.

Do not leave a fake production-looking report page that displays fabricated data.

---

# 3. Phase 2 — Create a Shared Modal System

## Problem

Several pages independently implement modal behavior:

* `AdminStudent`
* `AdminTeachers`
* `AdminSubjects`
* `AdminClassrooms`
* `AdminStudentRecords`
* `TeacherGradebook`
* `TeacherStudentRecords`
* `DeveloperUsers`

This creates duplicated code and inconsistent behavior.

## Solution

Create a reusable:

```text
ModalDialog
```

component based on the existing `ConfirmDialog` behavior.

It should provide:

* Portal rendering
* Focus trap
* Initial focus
* Focus restoration
* Escape-to-close
* Backdrop click
* Body scroll locking
* `role="dialog"`
* `aria-modal`
* `aria-labelledby`
* `aria-describedby`
* Support for preventing close while submitting

Then refactor `ConfirmDialog` to use `ModalDialog`.

### Expected Result

All application modals should share the same accessibility and interaction behavior instead of maintaining separate implementations.

### Status (September 2026)

**Complete.** `ModalDialog` (portal, focus trap + initial focus, focus restoration via
`restoreFocusRef`, Escape/backdrop close with `lockClose`, scroll-lock, full ARIA) lives in
`src/components/ModalDialog.tsx` with `src/style/modalDialog.css`. `ConfirmDialog` is refactored
to build on it, and all eight inline modal implementations have been retired — the six admin
pages plus `DeveloperUsers.tsx` (OTP reveal) and `TeacherStudentRecords.tsx` (review modal),
both of which also gained focus restoration they previously lacked.

---

# 4. Phase 3 — Split Monolithic Pages

Large pages should be divided into focused components.

| Page                          | Lines | Recommended Components                                                                        |
| ----------------------------- | ----: | --------------------------------------------------------------------------------------------- |
| `AdminClassrooms.tsx`         | 1,433 | Classroom cards, detail view, students table, subjects table, and individual modal components |
| `TeacherGradebook.tsx`        | 1,216 | Score sheet, assessment editor, weights editor, summary                                       |
| `AdminSettings.tsx`           | 1,045 | School Info, Academic Year, Grading Weights, Credentials                                      |
| `DeveloperLandingContent.tsx` |   986 | Individual section editors                                                                    |
| `AdminSubjects.tsx`           |   913 | Subject cards, detail view, create/edit/assign modal                                          |
| `AdminEnrollments.tsx`        |   902 | Refactor search and promise chains                                                            |
| `TeacherAttendance.tsx`       |   895 | Attendance toolbar, roster table, per-student history view, shared date helpers               |
| `AdminStudent.tsx`            |   847 | Student detail view and academic-history components                                           |
| `studentClassroom.tsx`        |   803 | Hero, grades, activities, attendance                                                          |
| `TeacherStudentRecords.tsx`   |   681 | Roster table, review modal, progress banner, quarter/submit-all toolbar                       |
| `DeveloperUsers.tsx`          |   670 | Header card, role login switches, user list, reset-password modal                             |
| `AdminDashboard.tsx`          |   651 | Hero, KPI grid, enrollment chart (adopt the Phase 4 `KpiCard` / `SvgLineChart` primitives)    |

Line counts were measured with `wc -l` in September 2026; re-measure before scoping work.
The table covers every page over the 650-line threshold, sorted by size.

### Refactoring Rule

Do not split files simply to reduce line count.

Each extracted component should have a **clear responsibility**.

For example:

```text
AdminClassrooms
├── ClassroomCardsGrid
├── ClassroomDetail
├── ClassroomStudentsTable
├── ClassroomSubjectsTable
├── CreateClassroomModal
├── EditClassroomModal
├── AddSubjectsModal
├── EditSubjectTeacherModal
└── AssignAdviserModal
```

This makes the code easier to understand, test, debug, and modify.

---

# 5. Phase 4 — Build Shared Design-System Components

Repeated UI should become reusable components.

### Status (September 2026)

**First components shipped and adopted:**

* `PageCard` (`src/components/PageCard.tsx`) — the `overflow-hidden rounded-2xl bg-white
  shadow-sm` shell (60 inline occurrences across pages). Optional `variant="flat"` adds
  the `analytics__card` border; `ariaBusy`/`ariaLabel` support loading cards; `as`
  renders `form`/`section`/`article` variants. Adopted by every admin page (Settings ×5,
  Dashboard ×5, Analytics ×8, Reports ×4, Subjects ×2, Teachers ×2, Student ×2,
  Classrooms ×2, StudentRecords ×1) — ~31 inline shells remain in teacher/developer/student
  pages.
* `EmptyState` (`src/components/EmptyState.tsx`) — the icon/title/description no-data
  block, with an `action` slot for create-buttons. Styles in `src/style/components.css`,
  imported globally via `index.css`. Adopted by AdminTeachers, AdminSubjects, AdminStudent,
  and AdminClassrooms.
* `KpiCard` (`src/components/KpiCard.tsx`) — icon/label/value/trend stat card with
  built-in skeleton loading and accent-icon support. Adopted by AdminDashboard,
  Analytics-Reports, and DeveloperDashboard; the three pages' hand-rolled KPI blocks
  (~60 lines) are now one component.

Remaining: roll `PageCard` out to the other ~12 pages still hand-writing the shell,
and the rest of the catalogue below (PageHero, StatusChip, Avatar, chart primitives,
hook unification).

## Recommended Components

### Layout

```text
PageCard
PageHeader
PageHero
Eyebrow
CountBadge
```

### States

```text
EmptyState
LoadingState
ErrorState
```

### Data Display

```text
KpiCard
StatusChip
Avatar
```

### Charts

```text
SvgLineChart
```

These patterns currently appear repeatedly throughout the application and should be standardized.

## Data Hooks

The current hooks have inconsistent APIs:

```text
useStudent
useTeachers
useClassroom
useSubject
```

Standardize them around consistent concepts:

```text
loading
error
data
refetch
```

Avoid exposing internal state setters such as:

```text
setLoading
```

A possible long-term direction is a generic:

```text
useResource(endpoint, options?)
```

However, do not introduce abstraction merely for the sake of abstraction. If a generic hook makes the code harder to understand, standardizing the existing hooks is sufficient.

---

# 6. Phase 5 — CSS and Design System

Tailwind v4 is already installed correctly, but the project is not currently taking advantage of its newer design-system capabilities.

## Recommended Improvements

### 1. Move design tokens into `@theme`

Centralize:

* Colors
* Radius
* Shadows
* Other reusable design values

This makes the design system easier to consume consistently.

### 2. Remove duplicated CSS

Consolidate repeated styles such as:

* Student cards
* Classroom cards
* Subject cards
* Page headers
* Select controls
* Hero sections
* Modal animations
* Shimmer animations

Avoid maintaining multiple versions of the same visual pattern.

### 3. Fix token inconsistencies

Examples identified during review:

* Blue focus ring inside the green-themed teacher settings
* Off-palette chart colors
* Duplicate `--accent` / `--warning` tokens

### 4. Dark mode

Dark mode is **not currently a priority**.

Keep the architecture ready for it, but do not spend development time on it unless the product requires it.

---

# 7. Phase 6 — Accessibility and UX

## Keyboard Accessibility

Clickable elements must be keyboard-operable.

Review:

* Table rows
* Classroom cards
* Subject cards
* Teacher rows
* Other clickable containers

Prefer semantic elements such as:

```tsx
<button>
<a>
```

instead of making arbitrary `<div>` or `<article>` elements behave like buttons.

If a non-semantic element must be interactive, provide the appropriate:

* `tabIndex`
* `role`
* Enter handling
* Space handling

## Tables

Add:

```html
scope="col"
```

to hand-built table headers.

Important tables should also have a:

```html
<caption>
```

or an equivalent accessible label.

## Charts

Charts should provide meaningful accessible descriptions.

For example:

```text
Male: 40 (57%)
Female: 30 (43%)
```

The visual chart should not be the only way to understand the data.

## Toasts

Use appropriate live-region behavior:

* Informational messages → `role="status"`
* Errors → `role="alert"`

Avoid nested or conflicting live regions.

## Headings

Avoid having multiple competing `<h1>` elements on the same page.

The application layout should have one clear page-level heading.

---

# 8. UX Improvements

### Loading states

Avoid replacing the entire page with a skeleton when only a small section is loading.

Prefer section-level loading states.

`AdminTeachers` already demonstrates this approach and can be used as the reference implementation.

### Submit buttons

Disable submit buttons while requests are processing.

This prevents accidental double submissions, particularly in:

* Admin Subjects
* Admin Classrooms

### Validation

Improve validation so that it:

* Trims input
* Reports multiple errors when appropriate
* Uses user-friendly field labels
* Avoids exposing raw property names

### Search

Reduce the `AdminEnrollments` debounce from approximately:

```text
1000 ms
```

to around:

```text
300–400 ms
```

for a more responsive search experience.

---

# 9. Naming and Consistency

Standardize naming across the project.

### File naming

Rename:

```text
studentClassroom.tsx
```

to:

```text
StudentClassroom.tsx
```

### Reports

Clarify the distinction between:

```text
Admin-Reports.tsx
Analytics-Reports.tsx
```

The mock report page should not appear to be a live production report system.

### Hooks

Standardize:

```text
fetch*
refetch*
loading
```

For example, avoid having:

```text
loading
subjectsLoading
fetchSubjects
refetchStudents
```

without a clear reason.

### Helpers

Use consistent naming:

```text
validate
formatDate
```

instead of:

```text
Validate
FormatDate
```

### Formatting

Adopt one formatter/linter configuration covering:

* Indentation
* Semicolons
* Import formatting
* General code style

### API configuration

Replace confusing environment logic such as:

```text
VITE_SYSTEM_STATUS
```

with a clearer API configuration:

```text
VITE_API_URL
```

with a development fallback.

---

# 10. Existing Patterns Worth Preserving

Not everything needs refactoring.

These areas already provide good patterns for the rest of the application:

### `ConfirmDialog.tsx`

Strong implementation containing:

* Portal
* Focus trap
* Focus restoration
* Accessibility attributes
* Pending state
* Appropriate confirmation messaging

Now built on the shared `ModalDialog` primitive.

### `Analytics-Reports.tsx`

Good example of:

* Loading states
* Empty states
* Error handling
* Section-level rendering

### `AdminEnrollments.tsx`

Good UX patterns including:

* Stepper
* Sticky summary
* Readiness checklist
* Capacity indicators

### Detail Views

Several detail views already have good information architecture, particularly:

* Teacher subjects
* Classroom assignments
* Student academic history

### Effect Cleanup

The use of cancellation flags in several pages is a good pattern that should be preserved.

### Reduced Motion

Existing reduced-motion support in:

```text
skeleton.css
protectedRoutes.css
```

should be maintained.

### Empty States

The application consistently provides meaningful no-data states. Preserve this behavior.

### Design Tokens

The existing tokens in `index.css` are a good foundation for a more centralized design system.

---

# 11. Recommended Execution Order

The refactoring should not be performed randomly.

### Step 1 — Fix remaining correctness issues

Complete Phase 1.

Priority:

```text
Bugs → Correctness → Product gaps
```

### Step 2 — Build `ModalDialog`

Create the shared modal primitive and migrate existing modals.

This gives the project a reliable foundation for future modal work.

### Step 3 — Build shared UI components

Create:

```text
PageCard
PageHeader
PageHero
EmptyState
KpiCard
StatusChip
Avatar
SvgLineChart
```

### Step 4 — Consolidate the CSS system

Move toward centralized design tokens and remove duplicate CSS.

### Step 5 — Split large pages

Only after the shared patterns are established should the large pages be broken apart.

### Step 6 — Accessibility and consistency pass

Finish:

* Keyboard navigation
* ARIA
* Table semantics
* Validation UX
* Naming
* Formatting
* API configuration

---

# 12. Current Status

| Phase | Description                     | Status           |
| ----- | ------------------------------- | ---------------- |
| 1     | Critical bugs                   | 🟡 9/10 complete |
| 2     | Shared `ModalDialog`            | 🟢 Complete       |
| 3     | Monolith page splits            | ⚪ Not started    |
| 4     | Shared design-system components | 🟡 In progress    |
| 5     | CSS design system               | ⚪ Not started    |
| 6     | Accessibility & UX polish       | ⚪ Not started    |
| 7     | Naming & consistency            | ⚪ Not started    |

---

# Bottom Line

The GradeSync frontend does **not** need a rewrite.

The foundation is already usable. The main problem is that good patterns have not yet been **centralized and reused**.

The biggest technical priorities are:

```text
1. Finish remaining bugs
2. Standardize modals
3. Standardize reusable UI
4. Standardize hooks
5. Reduce CSS duplication
6. Split large pages
7. Fix accessibility
8. Standardize naming/formatting
```

The most important principle for the next refactoring stage is:

> **Do not create abstractions just to make files smaller. Create abstractions when multiple parts of the application genuinely share the same behavior or visual pattern.**
