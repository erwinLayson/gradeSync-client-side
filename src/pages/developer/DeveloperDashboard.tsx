import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
    FiActivity,
    FiArrowRight,
    FiCalendar,
    FiCheckCircle,
    FiServer,
    FiXCircle,
} from "react-icons/fi";

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
        <section className="dashboard flex flex-col gap-5">
            {/* ==================== Hero ==================== */}
            <div className="dashboard__hero relative overflow-hidden rounded-2xl p-6 sm:p-8">
                <div className="dashboard__hero-glow dashboard__hero-glow--accent" aria-hidden="true" />
                <div className="dashboard__hero-glow dashboard__hero-glow--leaf" aria-hidden="true" />

                <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="dashboard__hero-icon inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl" aria-hidden="true">
                            <FiActivity />
                        </span>
                        <div className="min-w-0">
                            <span className="dashboard__hero-eyebrow text-[0.6875rem] font-bold uppercase tracking-[0.14em]">Developer Overview</span>
                            <h2 className="dashboard__hero-title mt-1 text-2xl font-extrabold tracking-tight">{greeting}, Developer</h2>
                            <p className="dashboard__hero-subtitle mt-1 text-sm">
                                {today} — {email ? `${email} · ` : ""}platform tools
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className="dashboard__hero-badge inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold">
                            <FiCalendar aria-hidden="true" />
                            System features
                        </span>
                    </div>
                </div>
            </div>

            {/* ==================== At-a-glance KPIs ==================== */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {kpis.map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <div key={kpi.label} className="analytics__kpi flex items-center gap-4 p-4">
                            <span className="analytics__kpi-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                                <Icon />
                            </span>
                            <div className="min-w-0 flex-1">
                                <span className="analytics__kpi-label block text-[0.6875rem] font-bold uppercase tracking-[0.08em]">{kpi.label}</span>
                                {loading ? (
                                    <SkeletonLine width="3rem" height="1.75rem" radius="0.5rem" className="mt-1.5" />
                                ) : (
                                    <span className="analytics__kpi-value mt-0.5 block text-[1.5rem] font-bold leading-none">{kpi.value}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
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
        </section>
    );
}
