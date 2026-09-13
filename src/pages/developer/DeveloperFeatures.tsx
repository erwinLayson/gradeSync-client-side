import { useMemo, useRef, useState } from "react";
import {
    FiAlertCircle,
    FiCheckCircle,
    FiSearch,
    FiServer,
    FiXCircle,
} from "react-icons/fi";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SkeletonLine } from "../../components/Skeleton";
import { patchAPICall } from "../../api/api";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import { FEATURE_META, type FeatureRow } from "./featureMeta";
import "../../style/analyticsReports.css";
import "../../style/developerDashboard.css";

/*
 * Endpoints (Phase 3 contract — docs/developer-role-plan.md):
 *   PATCH /features/:key   { enabled: boolean }   (developer only)
 * Flag map is read from FeatureFlagProvider (GET /features or mock).
 *
 * Mock mode: VITE_FEATURE_FLAGS_MOCK makes PATCH a no-op resolve so the
 * whole flow (confirm dialog, optimistic toggle, toasts) is QA-able
 * before the backend exists. Remove together with the provider's mock
 * branch once Phase 3 is live.
 */

function isMockMode(): boolean {
    return Boolean(import.meta.env.VITE_FEATURE_FLAGS_MOCK);
}

export default function DeveloperFeatures() {
    const { flags, loading, setFlag, refetch } = useFeatureFlags();
    const [search, setSearch] = useState("");
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<FeatureRow | null>(null);
    // Focus-restore target for the dialog. The actual trigger is a checkbox
    // input, which doesn't match the dialog's HTMLButtonElement ref type, so
    // this ref stays unattached and focus restoration no-ops gracefully.
    const confirmTriggerRef = useRef<HTMLButtonElement>(null);

    // One row per known flag; API unknown keys fall back to key-as-label.
    const featureRows = useMemo<FeatureRow[]>(
        () =>
            Object.keys(flags).map((key) => ({
                key,
                label: FEATURE_META[key]?.label ?? key,
                description: FEATURE_META[key]?.description ?? "System feature.",
            })),
        [flags],
    );

    const visibleRows = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return featureRows;
        return featureRows.filter(
            (row) =>
                row.label.toLowerCase().includes(needle) ||
                row.key.toLowerCase().includes(needle),
        );
    }, [featureRows, search]);

    async function handleToggle(feature: FeatureRow, nextEnabled: boolean) {
        // Disabling asks for confirmation first (handled via the dialog);
        // enabling is low-risk and applies immediately.
        if (!nextEnabled) {
            setConfirmTarget(feature);
            return;
        }

        setPendingKey(feature.key);
        setFlag(feature.key, true);
        try {
            if (!isMockMode()) {
                await patchAPICall(`/features/${feature.key}`, { enabled: true });
            } else {
                await new Promise((resolve) => window.setTimeout(resolve, 300));
            }
        } catch {
            // Error toast handled by the interceptor; roll the switch back.
            await refetch();
        } finally {
            setPendingKey(null);
        }
    }

    async function handleConfirmDisable() {
        const feature = confirmTarget;
        if (!feature) return;

        setPendingKey(feature.key);
        setFlag(feature.key, false);
        try {
            if (!isMockMode()) {
                await patchAPICall(`/features/${feature.key}`, { enabled: false });
            } else {
                await new Promise((resolve) => window.setTimeout(resolve, 300));
            }
        } catch {
            await refetch();
        } finally {
            setPendingKey(null);
            setConfirmTarget(null);
        }
    }

    const enabledCount = featureRows.filter((row) => flags[row.key]).length;

    return (
        <section className="flex flex-col gap-5">
            {/* ==================== Header card ==================== */}
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                        <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Platform</span>
                        <h3 className="analytics__title mt-1 text-base font-bold">Feature Management</h3>
                        <p className="analytics__subtitle mt-1 text-[0.8125rem]">
                            Turn system features on or off for the whole school. Changes apply to every user immediately.
                        </p>
                    </div>
                    <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                        <FiServer aria-hidden="true" />
                        {loading ? "Syncing…" : `${enabledCount}/${featureRows.length} enabled`}
                    </span>
                </div>
            </div>

            {/* ==================== Search + list ==================== */}
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-neutral-800">System features</h4>
                        <p className="mt-0.5 text-[0.75rem] text-neutral-500">
                            Disabling a feature hides it from admins, teachers and students.
                        </p>
                    </div>
                    <label className="relative block">
                        <span className="sr-only">Search features</span>
                        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by name or key…"
                            className="developer-search w-56 rounded-lg border py-2 pl-9 pr-3 text-sm"
                            aria-label="Search features by name or key"
                        />
                    </label>
                </div>

                <div className="p-5" aria-busy={loading}>
                    {loading ? (
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
                    ) : visibleRows.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center">
                            <FiSearch className="text-[1.5rem] text-[var(--text-muted)]" aria-hidden="true" />
                            <p className="text-sm font-semibold text-neutral-500">
                                {featureRows.length === 0
                                    ? "No features registered. The flag map is empty."
                                    : `No features match “${search}”.`}
                            </p>
                        </div>
                    ) : (
                        <ul className="grid grid-cols-1 gap-3">
                            {visibleRows.map((feature) => {
                                const enabled = Boolean(flags[feature.key]);
                                const busy = pendingKey === feature.key;
                                return (
                                    <li
                                        key={feature.key}
                                        className={`developer-feature flex flex-wrap items-center gap-4 rounded-xl border border-[var(--neutral-border)] p-4 ${enabled ? "" : "developer-feature--disabled"}`}
                                    >
                                        <span className="developer-feature__icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                                            <FiServer />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-neutral-800">{feature.label}</span>
                                                <code className="developer-feature__key">{feature.key}</code>
                                                <span className={`developer-feature__status-pill developer-feature__status-pill--${enabled ? "on" : "off"} px-2 py-0.5`}>
                                                    {enabled ? "Enabled" : "Disabled"}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-neutral-500">{feature.description}</p>
                                        </div>

                                        <label className="inline-flex cursor-pointer items-center gap-2">
                                            <span className="sr-only">{enabled ? `Disable ${feature.label}` : `Enable ${feature.label}`}</span>
                                            <input
                                                type="checkbox"
                                                className="developer-switch"
                                                checked={enabled}
                                                disabled={busy}
                                                onChange={(event) => void handleToggle(feature, event.target.checked)}
                                            />
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* ==================== Disable confirmation ==================== */}
            <ConfirmDialog
                open={confirmTarget !== null}
                title="Disable this feature?"
                description={
                    confirmTarget
                        ? `“${confirmTarget.label}” will be hidden from admins, teachers and students across the whole school. You can re-enable it anytime.`
                        : ""
                }
                confirmLabel="Disable feature"
                confirmIcon={<FiXCircle aria-hidden="true" />}
                tone="danger"
                pending={pendingKey === confirmTarget?.key}
                pendingLabel="Disabling…"
                onConfirm={() => void handleConfirmDisable()}
                onClose={() => setConfirmTarget(null)}
                triggerRef={confirmTriggerRef}
            />

            {/* Status hint when everything is fine */}
            {!loading && featureRows.length > 0 && (
                <p className="analytics__subtitle flex items-center gap-2 px-1 text-[0.75rem]">
                    {enabledCount === featureRows.length ? <FiCheckCircle className="text-[var(--success)]" aria-hidden="true" /> : <FiAlertCircle className="text-[var(--warning)]" aria-hidden="true" />}
                    {isMockMode()
                        ? "Mock mode (VITE_FEATURE_FLAGS_MOCK) — changes are not persisted."
                        : "Live flags — changes persist and apply to all users."}
                </p>
            )}
        </section>
    );
}
