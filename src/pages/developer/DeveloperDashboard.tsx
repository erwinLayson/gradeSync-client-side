import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
    FiArrowRight,
    FiCheckCircle,
    FiServer,
    FiXCircle,
} from "react-icons/fi";

import { KpiCard } from "../../components/KpiCard";
import { PageHeader, PageShell } from "../../components/PageLayout";
import { SkeletonLine } from "../../components/Skeleton";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";
import { FEATURE_META } from "./featureMeta";
import "../../style/analyticsReports.css";
import "../../style/developerDashboard.css";

export default function DeveloperDashboard() {
    const { user } = useUser();
    const { auth } = useAuth();
    const { flags, loading } = useFeatureFlags();
    const email = auth ? user?.email ?? "" : "";

    const today = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, []);

    const featureKeys = useMemo(() => Object.keys(flags), [flags]);
    const enabledCount = featureKeys.filter((key) => flags[key]).length;
    const disabledCount = featureKeys.length - enabledCount;

    const kpis = [
        { label: "Total Features", value: loading ? "…" : String(featureKeys.length), icon: FiServer },
        { label: "Enabled", value: loading ? "…" : String(enabledCount), icon: FiCheckCircle },
        { label: "Disabled", value: loading ? "…" : String(disabledCount), icon: FiXCircle },
    ];

    return (
        <PageShell className="dashboard">
            {/* ==================== Header ==================== */}
            <PageHeader
                title={`${greeting}, Developer`}
                description={`${today} — ${email ? `${email} · ` : ""}platform tools`}
                meta="System features"
            />

            {/* ==================== At-a-glance KPIs ==================== */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {kpis.map((kpi) => (
                    <KpiCard
                        key={kpi.label}
                        label={kpi.label}
                        value={kpi.value}
                        icon={kpi.icon}
                        loading={loading}
                    />
                ))}
            </div>

            {/* ==================== Feature status grid ==================== */}
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                    <div className="min-w-0">
                        <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Platform</span>
                        <h3 className="analytics__title mt-1 text-base font-bold">Feature Status</h3>
                        <p className="analytics__subtitle mt-1 text-[0.8125rem]">Current state of every system feature</p>
                    </div>
                    <Link
                        to="/developer/features"
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--neutral-border)] px-3.5 py-2 text-xs font-bold text-neutral-700 shadow-sm transition hover:border-[var(--primary)]"
                    >
                        Manage features
                        <FiArrowRight aria-hidden="true" />
                    </Link>
                </div>

                <div className="p-5 pt-2" aria-busy={loading}>
                    {loading ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <SkeletonLine key={index} width="100%" height="4rem" radius="0.75rem" />
                            ))}
                        </div>
                    ) : featureKeys.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm font-semibold text-neutral-500">
                            No features registered.
                        </p>
                    ) : (
                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {featureKeys.map((key) => {
                                const enabled = Boolean(flags[key]);
                                return (
                                    <li
                                        key={key}
                                        className={`developer-feature flex items-center justify-between gap-3 rounded-xl border border-[var(--neutral-border)] p-4 ${enabled ? "" : "developer-feature--disabled"}`}
                                    >
                                        <div className="min-w-0">
                                            <span className="block truncate text-sm font-bold text-neutral-800">
                                                {FEATURE_META[key]?.label ?? key}
                                            </span>
                                            <code className="developer-feature__key mt-1 inline-block">{key}</code>
                                        </div>
                                        <span className={`developer-feature__status-pill developer-feature__status-pill--${enabled ? "on" : "off"} shrink-0 px-2.5 py-1`}>
                                            {enabled ? "Enabled" : "Disabled"}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* ==================== Footer note ==================== */}
            <p className="analytics__subtitle flex items-center gap-2 px-1 text-[0.75rem]">
                <FiServer aria-hidden="true" />
                Feature flags load from the platform (mock mode active when VITE_FEATURE_FLAGS_MOCK is set).
            </p>
        </PageShell>
    );
}
