import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import {
    FiBookOpen,
    FiCheckCircle,
    FiCopy,
    FiKey,
    FiLock,
    FiSearch,
    FiServer,
    FiShield,
    FiUserCheck,
    FiUserX,
    FiUsers,
} from "react-icons/fi";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SkeletonLine } from "../../components/Skeleton";
import { getAPICall, patchAPICall, postAPICall } from "../../api/api";
import { useUser } from "../../hooks/useUser";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import { FEATURE_META } from "./featureMeta";
import { ROLES, type UserAccount, type UserRoles } from "../../constant/users";
import { toast } from "../../helper/toast";
import "../../style/analyticsReports.css";
import "../../style/developerDashboard.css";

/*
 * Developer account management — docs/developer-users-plan.md Phase 3.
 *
 * Endpoints (Phase 1, all developer-only, guardrails enforced server-side):
 *   GET   /users                      → UserAccount[] (no password hashes)
 *   PATCH /users/:id/status           { status: "active" | "inactive" }
 *   PATCH /users/:id/role             { role: UserRoles }
 *   POST  /users/:id/reset-password   → { tempPassword } (shown once)
 *
 * Mutations are optimistic; on failure the interceptor toasts the error and
 * we refetch to roll the row back to server truth.
 */

const ROLE_FILTERS: Array<{ label: string; value: UserRoles | "all" }> = [
    { label: "All", value: "all" },
    { label: "Admins", value: ROLES.ADMIN },
    { label: "Teachers", value: ROLES.TEACHER },
    { label: "Students", value: ROLES.STUDENT },
    { label: "Developers", value: ROLES.DEVELOPER },
];

const ROLE_META: Record<UserRoles, { label: string; icon: typeof FiShield }> = {
    [ROLES.ADMIN]: { label: "Admin", icon: FiShield },
    [ROLES.TEACHER]: { label: "Teacher", icon: FiBookOpen },
    [ROLES.STUDENT]: { label: "Student", icon: FiUsers },
    [ROLES.DEVELOPER]: { label: "Developer", icon: FiServer },
};

const LOGIN_SWITCHES: Array<{ key: string; role: UserRoles }> = [
    { key: "login_admin", role: ROLES.ADMIN },
    { key: "login_teacher", role: ROLES.TEACHER },
    { key: "login_student", role: ROLES.STUDENT },
];

export default function DeveloperUsers() {
    const { user: me } = useUser();
    const [accounts, setAccounts] = useState<UserAccount[] | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<UserRoles | "all">("all");

    const [pendingId, setPendingId] = useState<number | null>(null);
    // Role change awaiting confirmation: the select already shows the draft
    // value; cancelling reverts it.
    const [roleDraft, setRoleDraft] = useState<{ account: UserAccount; next: UserRoles } | null>(null);
    const [statusTarget, setStatusTarget] = useState<UserAccount | null>(null);
    const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
    // null while the reset dialog is in "confirm" state; string once generated.
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Role login switches (docs/role-login-switches-plan.md) — reuse the
    // feature-flag system: flags flow from GET /features; setFlag is the
    // optimistic write, refetchFlags rolls back on failure.
    const { flags, loading: flagsLoading, setFlag, refetch: refetchFlags } = useFeatureFlags();
    const [pendingLoginKey, setPendingLoginKey] = useState<string | null>(null);
    const [loginSwitchTarget, setLoginSwitchTarget] = useState<string | null>(null);

    const resetTriggerRef = useRef<HTMLButtonElement>(null);
    const resetTitleId = useId();
    const resetDescId = useId();

    const refetch = useCallback(async () => {
        try {
            const response = await getAPICall<UserAccount[]>("/users", { toast: false });
            setAccounts(response.data ?? []);
        } catch {
            // Interceptor already toasted; leave the current list in place.
        }
    }, []);

    useEffect(() => {
        // Deferred like userContext/featureFlagContext do, so the setState
        // inside refetch doesn't cascade renders from within the effect.
        const timer = window.setTimeout(() => {
            void refetch();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [refetch]);

    const visibleAccounts = useMemo(() => {
        if (!accounts) return [];
        const needle = search.trim().toLowerCase();
        return accounts.filter((account) => {
            if (roleFilter !== "all" && account.role !== roleFilter) return false;
            if (!needle) return true;
            return (
                account.email.toLowerCase().includes(needle) ||
                String(account.id).includes(needle)
            );
        });
    }, [accounts, search, roleFilter]);

    const activeCount = accounts?.filter((account) => account.status === "active").length ?? 0;

    /** Apply a mutation optimistically; roll back to server truth on failure. */
    async function mutate(id: number, apply: () => void, request: () => Promise<unknown>) {
        setPendingId(id);
        apply();
        try {
            await request();
        } catch {
            await refetch();
        } finally {
            setPendingId(null);
        }
    }

    function handleStatusToggle(account: UserAccount, nextActive: boolean) {
        // Deactivation blocks a login — confirm first (mirrors the features
        // page: the risky direction asks, the safe direction applies).
        if (!nextActive) {
            setStatusTarget(account);
            return;
        }
        void mutate(
            account.id,
            () =>
                setAccounts((prev) =>
                    prev
                        ? prev.map((row) => (row.id === account.id ? { ...row, status: "active" } : row))
                        : prev,
                ),
            () => patchAPICall(`/users/${account.id}/status`, { status: "active" }),
        );
    }

    function handleLoginSwitchToggle(key: string, nextEnabled: boolean) {
        // Disabling a whole role's logins is the risky direction — confirm first.
        if (!nextEnabled) {
            setLoginSwitchTarget(key);
            return;
        }
        setPendingLoginKey(key);
        setFlag(key, true);
        void (async () => {
            try {
                await patchAPICall(`/features/${key}`, { enabled: true });
            } catch {
                // Interceptor toasted; roll the switch back to server truth.
                await refetchFlags();
            } finally {
                setPendingLoginKey(null);
            }
        })();
    }

    function handleConfirmLoginDisable() {
        const key = loginSwitchTarget;
        if (!key) return;
        setPendingLoginKey(key);
        setFlag(key, false);
        void (async () => {
            try {
                await patchAPICall(`/features/${key}`, { enabled: false });
            } catch {
                await refetchFlags();
            } finally {
                setPendingLoginKey(null);
                setLoginSwitchTarget(null);
            }
        })();
    }

    function handleConfirmDeactivate() {
        const account = statusTarget;
        if (!account) return;
        void mutate(
            account.id,
            () => {
                setAccounts((prev) =>
                    prev
                        ? prev.map((row) => (row.id === account.id ? { ...row, status: "inactive" } : row))
                        : prev,
                );
                setStatusTarget(null);
            },
            () => patchAPICall(`/users/${account.id}/status`, { status: "inactive" }),
        );
    }

    function handleRolePick(account: UserAccount, next: UserRoles) {
        if (next === account.role) return;
        setRoleDraft({ account, next });
    }

    function handleConfirmRole() {
        const draft = roleDraft;
        if (!draft) return;
        const { account, next } = draft;
        setRoleDraft(null);
        void mutate(
            account.id,
            () =>
                setAccounts((prev) =>
                    prev
                        ? prev.map((row) => (row.id === account.id ? { ...row, role: next } : row))
                        : prev,
                ),
            () => patchAPICall(`/users/${account.id}/role`, { role: next }),
        );
    }

    async function handleConfirmReset() {
        const account = resetTarget;
        if (!account) return;
        setPendingId(account.id);
        try {
            const response = await postAPICall<null, { tempPassword: string }>(
                `/users/${account.id}/reset-password`,
                null,
                { toast: false },
            );
            if (response.data?.tempPassword) {
                setTempPassword(response.data.tempPassword);
                setCopied(false);
            }
        } catch {
            // Interceptor toasted; dialog stays in confirm state for a retry.
        } finally {
            setPendingId(null);
        }
    }

    async function handleCopyPassword() {
        if (!tempPassword) return;
        try {
            await navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Could not copy — select the password manually.");
        }
    }

    /** Close the reset dialog (any path) and restore focus to its trigger. */
    function closeResetDialog() {
        setResetTarget(null);
        setTempPassword(null);
        resetTriggerRef.current?.focus();
    }

    // Reset dialog: Escape closes, overlay click closes, body scroll locked —
    // mirroring ConfirmDialog's behaviour for this one custom reveal state.
    useEffect(() => {
        if (!resetTarget) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeResetDialog();
        };
        document.addEventListener("keydown", handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [resetTarget]);

    function handleResetOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) closeResetDialog();
    }

    const loading = accounts === null;

    return (
        <section className="flex flex-col gap-5">
            {/* ==================== Header card ==================== */}
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                        <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Platform</span>
                        <h3 className="analytics__title mt-1 text-base font-bold">User Accounts</h3>
                        <p className="analytics__subtitle mt-1 text-[0.8125rem]">
                            Manage login accounts: deactivate, change roles, or reset passwords. Academic records are never touched.
                        </p>
                    </div>
                    <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                        <FiUsers aria-hidden="true" />
                        {loading ? "Syncing…" : `${activeCount}/${accounts?.length ?? 0} active`}
                    </span>
                </div>
            </div>

            {/* ==================== Role login switches ==================== */}
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-neutral-800">Role login switches</h4>
                        <p className="mt-0.5 text-[0.75rem] text-neutral-500">
                            While a switch is off, that role cannot sign in. Sessions already open expire naturally (max 1 hour). Developer logins are never affected.
                        </p>
                    </div>
                    <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                        <FiLock aria-hidden="true" />
                        {flagsLoading ? "Syncing…" : `${LOGIN_SWITCHES.filter((sw) => flags[sw.key]).length}/${LOGIN_SWITCHES.length} enabled`}
                    </span>
                </div>
                <div className="p-5" aria-busy={flagsLoading}>
                    {flagsLoading ? (
                        <div className="grid grid-cols-1 gap-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-4 rounded-xl border border-[var(--neutral-border)] p-4">
                                    <SkeletonLine width="2.75rem" height="2.75rem" radius="0.75rem" />
                                    <div className="min-w-0 flex-1">
                                        <SkeletonLine width="30%" height="0.875rem" />
                                        <SkeletonLine width="65%" height="0.75rem" className="mt-2" />
                                    </div>
                                    <SkeletonLine width="2.75rem" height="1.5rem" radius="9999px" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <ul className="grid grid-cols-1 gap-3">
                            {LOGIN_SWITCHES.map((sw) => {
                                const enabled = Boolean(flags[sw.key]);
                                const busy = pendingLoginKey === sw.key;
                                const RoleIcon = ROLE_META[sw.role].icon;
                                return (
                                    <li
                                        key={sw.key}
                                        className={`developer-feature flex flex-wrap items-center gap-4 rounded-xl border border-[var(--neutral-border)] p-4 ${enabled ? "" : "developer-feature--disabled"}`}
                                    >
                                        <span className="developer-feature__icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                                            <RoleIcon />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-neutral-800">{FEATURE_META[sw.key]?.label ?? sw.key}</span>
                                                <code className="developer-feature__key">{sw.key}</code>
                                                <span className={`developer-feature__status-pill developer-feature__status-pill--${enabled ? "on" : "off"} px-2 py-0.5`}>
                                                    {enabled ? "Logins enabled" : "Logins disabled"}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-neutral-500">{FEATURE_META[sw.key]?.description}</p>
                                        </div>
                                        <label className="inline-flex cursor-pointer items-center gap-2">
                                            <span className="sr-only">
                                                {enabled ? `Disable ${FEATURE_META[sw.key]?.label ?? sw.key}` : `Enable ${FEATURE_META[sw.key]?.label ?? sw.key}`}
                                            </span>
                                            <input
                                                type="checkbox"
                                                className="developer-switch"
                                                checked={enabled}
                                                disabled={busy}
                                                onChange={(event) => handleLoginSwitchToggle(sw.key, event.target.checked)}
                                            />
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* ==================== Filters + list ==================== */}
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-neutral-800">All accounts</h4>
                        <p className="mt-0.5 text-[0.75rem] text-neutral-500">
                            Deactivated accounts cannot log in but keep all their data.
                        </p>
                    </div>
                    <label className="relative block">
                        <span className="sr-only">Search accounts</span>
                        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by email or ID…"
                            className="developer-search w-56 rounded-lg border py-2 pl-9 pr-3 text-sm"
                            aria-label="Search accounts by email or ID"
                        />
                    </label>
                </div>

                <div className="flex flex-wrap gap-2 border-b px-5 py-3" role="group" aria-label="Filter by role">
                    {ROLE_FILTERS.map((filter) => (
                        <button
                            key={filter.value}
                            type="button"
                            onClick={() => setRoleFilter(filter.value)}
                            aria-pressed={roleFilter === filter.value}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                                roleFilter === filter.value
                                    ? "bg-[var(--primary)] text-white"
                                    : "bg-[var(--surface-bg)] text-neutral-600 hover:bg-[var(--neutral-border)]"
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className="p-5" aria-busy={loading}>
                    {loading ? (
                        <div className="grid grid-cols-1 gap-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-4 rounded-xl border border-[var(--neutral-border)] p-4">
                                    <SkeletonLine width="2.75rem" height="2.75rem" radius="0.75rem" />
                                    <div className="min-w-0 flex-1">
                                        <SkeletonLine width="35%" height="0.875rem" />
                                        <SkeletonLine width="55%" height="0.75rem" className="mt-2" />
                                    </div>
                                    <SkeletonLine width="5.5rem" height="1.75rem" radius="0.5rem" />
                                    <SkeletonLine width="2.75rem" height="1.5rem" radius="9999px" />
                                </div>
                            ))}
                        </div>
                    ) : visibleAccounts.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center">
                            <FiSearch className="text-[1.5rem] text-[var(--text-muted)]" aria-hidden="true" />
                            <p className="text-sm font-semibold text-neutral-500">
                                {accounts?.length === 0
                                    ? "No accounts found."
                                    : `No accounts match “${search}”.`}
                            </p>
                        </div>
                    ) : (
                        <ul className="grid grid-cols-1 gap-3">
                            {visibleAccounts.map((account) => {
                                const active = account.status === "active";
                                const busy = pendingId === account.id;
                                const isSelf = me?.id === account.id;
                                const RoleIcon = ROLE_META[account.role].icon;
                                return (
                                    <li
                                        key={account.id}
                                        className={`developer-feature flex flex-wrap items-center gap-4 rounded-xl border border-[var(--neutral-border)] p-4 ${active ? "" : "developer-feature--disabled"}`}
                                    >
                                        <span className="developer-feature__icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                                            <RoleIcon />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-neutral-800">{account.email}</span>
                                                <code className="developer-feature__key">#{account.id}</code>
                                                <span className={`developer-feature__status-pill developer-feature__status-pill--${active ? "on" : "off"} px-2 py-0.5`}>
                                                    {active ? "Active" : "Inactive"}
                                                </span>
                                                {isSelf && (
                                                    <span className="rounded-full bg-[var(--neutral-border)] px-2 py-0.5 text-[0.6875rem] font-bold text-neutral-600">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-neutral-500">
                                                {ROLE_META[account.role].label} account
                                            </p>
                                        </div>

                                        {/* Role select — change opens a confirm dialog */}
                                        <label className="inline-flex items-center gap-2">
                                            <span className="sr-only">Role for {account.email}</span>
                                            <select
                                                value={account.role}
                                                disabled={busy}
                                                onChange={(event) => handleRolePick(account, event.target.value as UserRoles)}
                                                className="developer-input rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                                            >
                                                {Object.values(ROLES).map((role) => (
                                                    <option key={role} value={role}>
                                                        {ROLE_META[role].label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        {/* Reset password */}
                                        <button
                                            type="button"
                                            ref={resetTriggerRef}
                                            disabled={busy}
                                            onClick={() => {
                                                setResetTarget(account);
                                                setTempPassword(null);
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--neutral-border)] px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
                                        >
                                            <FiKey aria-hidden="true" />
                                            <span className="sr-only sm:not-sr-only">Reset password</span>
                                        </button>

                                        {/* Active switch — deactivating asks first */}
                                        <label className="inline-flex cursor-pointer items-center gap-2">
                                            <span className="sr-only">
                                                {active ? `Deactivate ${account.email}` : `Activate ${account.email}`}
                                            </span>
                                            <input
                                                type="checkbox"
                                                className="developer-switch"
                                                checked={active}
                                                disabled={busy || (isSelf && active)}
                                                onChange={(event) => handleStatusToggle(account, event.target.checked)}
                                            />
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* ==================== Deactivate confirmation ==================== */}
            <ConfirmDialog
                open={statusTarget !== null}
                title="Deactivate this account?"
                description={
                    statusTarget
                        ? `“${statusTarget.email}” will immediately lose access. All their records stay intact and reactivating restores everything.`
                        : ""
                }
                confirmLabel="Deactivate account"
                confirmIcon={<FiUserX aria-hidden="true" />}
                tone="danger"
                pending={pendingId === statusTarget?.id}
                pendingLabel="Deactivating…"
                onConfirm={() => void handleConfirmDeactivate()}
                onClose={() => setStatusTarget(null)}
            />

            {/* ==================== Disable role logins confirmation ==================== */}
            <ConfirmDialog
                open={loginSwitchTarget !== null}
                title="Disable all logins for this role?"
                description={
                    loginSwitchTarget
                        ? `Every ${FEATURE_META[loginSwitchTarget]?.label?.replace(" Logins", "") ?? loginSwitchTarget} account will be unable to sign in. Sessions already open expire naturally (max 1 hour). Your developer account is not affected.`
                        : ""
                }
                confirmLabel="Disable logins"
                confirmIcon={<FiLock aria-hidden="true" />}
                tone="danger"
                pending={loginSwitchTarget !== null && pendingLoginKey === loginSwitchTarget}
                pendingLabel="Disabling…"
                onConfirm={() => void handleConfirmLoginDisable()}
                onClose={() => setLoginSwitchTarget(null)}
            />

            {/* ==================== Role change confirmation ==================== */}
            <ConfirmDialog
                open={roleDraft !== null}
                title="Change this account's role?"
                description={
                    roleDraft
                        ? `“${roleDraft.account.email}” will become a ${ROLE_META[roleDraft.next].label}. Their permissions change the next time their session checks in.`
                        : ""
                }
                confirmLabel="Change role"
                confirmIcon={<FiUserCheck aria-hidden="true" />}
                tone="primary"
                pending={pendingId === roleDraft?.account.id}
                pendingLabel="Changing…"
                onConfirm={() => void handleConfirmRole()}
                onClose={() => setRoleDraft(null)}
            />

            {/* ==================== Reset password + one-time reveal ==================== */}
            {resetTarget && (
                <div
                    className="confirm-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={resetTitleId}
                    aria-describedby={resetDescId}
                    onMouseDown={handleResetOverlayMouseDown}
                >
                    <div className="confirm-dialog__panel">
                        <span className="confirm-dialog__icon confirm-dialog__icon--primary" aria-hidden="true">
                            <FiKey />
                        </span>
                        {tempPassword ? (
                            <>
                                <h2 id={resetTitleId} className="confirm-dialog__title">Temporary password generated</h2>
                                <p id={resetDescId} className="confirm-dialog__text">
                                    Share it securely with {resetTarget.email} — it is shown <strong>only this once</strong>.
                                </p>
                                <div className="my-2 flex items-center justify-center gap-2">
                                    <code className="rounded-lg bg-neutral-100 px-3 py-2 font-mono text-sm font-bold tracking-wider text-neutral-800">
                                        {tempPassword}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={() => void handleCopyPassword()}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--neutral-border)] px-2.5 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                                    >
                                        {copied ? <FiCheckCircle className="text-[var(--success)]" aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                                        {copied ? "Copied" : "Copy"}
                                    </button>
                                </div>
                                <div className="confirm-dialog__actions">
                                    <button
                                        type="button"
                                        className="confirm-dialog__confirm confirm-dialog__confirm--primary"
                                        autoFocus
                                        onClick={closeResetDialog}
                                    >
                                        Done
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 id={resetTitleId} className="confirm-dialog__title">Reset this password?</h2>
                                <p id={resetDescId} className="confirm-dialog__text">
                                    A temporary password will be generated for {resetTarget.email}. Their current password stops working immediately.
                                </p>
                                <div className="confirm-dialog__actions">
                                    <button
                                        type="button"
                                        className="confirm-dialog__cancel"
                                        onClick={() => setResetTarget(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="confirm-dialog__confirm confirm-dialog__confirm--primary"
                                        disabled={pendingId === resetTarget.id}
                                        onClick={() => void handleConfirmReset()}
                                    >
                                        {pendingId === resetTarget.id ? "Generating…" : "Generate password"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Status hint */}
            {!loading && (accounts?.length ?? 0) > 0 && (
                <p className="analytics__subtitle flex items-center gap-2 px-1 text-[0.75rem]">
                    <FiCheckCircle className="text-[var(--success)]" aria-hidden="true" />
                    Live account data — changes apply immediately. You cannot deactivate your own account or remove the last active developer.
                </p>
            )}
        </section>
    );
}
