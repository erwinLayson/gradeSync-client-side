import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiActivity,
    FiAlertCircle,
    FiArrowRight,
    FiBookOpen,
    FiCalendar,
    FiCheckCircle,
    FiClipboard,
    FiFileText,
    FiRefreshCw,
    FiUserCheck,
    FiUserPlus,
    FiUsers,
    FiXCircle,
} from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { KpiCard, type KpiTrend } from "../../components/KpiCard";
import { PageCard } from "../../components/PageCard";
import { SkeletonLine } from "../../components/Skeleton";
import type { DashboardSummary } from "../../constant/dashboard";

import "../../style/skeleton.css";
import "../../style/analyticsReports.css";
import "../../style/adminDashboard.css";

// ==================== Static UI data ====================

const QUICK_ACTIONS = [
    { label: "Enroll Student", path: "/admin/enrollments", icon: FiUserPlus, accent: false },
    { label: "Add Teacher", path: "/admin/teachers", icon: FiUserCheck, accent: false },
    { label: "Gradebook", path: "/admin/student-records", icon: FiClipboard, accent: false },
    { label: "Reports", path: "/admin/reports", icon: FiFileText, accent: true },
] as const;

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

// ==================== Page ====================

export default function AdminDashboard() {
    const navigate = useNavigate();
    const greeting = getGreeting();
    const today = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        getAPICall<DashboardSummary>("/dashboard/summary", { toast: false })
            .then((response) => {
                if (!cancelled) setSummary(response.data ?? null);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function handleRetry() {
        setLoading(true);
        setError(false);
        getAPICall<DashboardSummary>("/dashboard/summary", { toast: false })
            .then((response) => setSummary(response.data ?? null))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }

    // ---- Derived data ----
    const schoolYearLabel = summary?.schoolYear
        ? `SY ${summary.schoolYear.startYear}–${summary.schoolYear.endYear}`
        : null;
    const quarterLabel = summary ? `Quarter ${summary.academicQuarter}` : null;
    const academicContext = schoolYearLabel && quarterLabel
        ? `${schoolYearLabel} • ${quarterLabel}`
        : schoolYearLabel ?? quarterLabel ?? null;

    const enrollmentOpen = summary === null ? null : summary.enrollmentOpen;

    // KPI values
    const kpis = [
        {
            label: "Total Students",
            value: summary != null ? summary.students.toLocaleString() : "—",
            subtitle: summary != null ? "Current school year" : "",
            icon: FiUsers,
            trend: summary != null ? ("flat" as KpiTrend) : ("flat" as KpiTrend),
            trendText: summary != null ? "Active" : "—",
        },
        {
            label: "Teaching Staff",
            value: summary != null ? summary.teachers.toLocaleString() : "—",
            subtitle: summary != null ? `${summary.teachers} active` : "",
            icon: FiBookOpen,
            trend: summary != null ? ("flat" as KpiTrend) : ("flat" as KpiTrend),
            trendText: summary != null ? "Active" : "—",
        },
        {
            label: "Active Classes",
            value: summary != null ? summary.classrooms.toLocaleString() : "—",
            subtitle: summary != null ? "Current school year" : "",
            icon: FiActivity,
            trend: summary != null ? ("flat" as KpiTrend) : ("flat" as KpiTrend),
            trendText: summary != null ? "Active" : "—",
        },
        {
            label: "Average Grade",
            value: summary != null
                ? summary.averageGrade != null
                    ? summary.averageGrade.toFixed(1)
                    : "N/A"
                : "—",
            subtitle: summary != null
                ? summary.averageGrade != null
                    ? quarterLabel ?? "Current period"
                    : "No grades submitted"
                : "",
            icon: FiBookOpen,
            trend: summary?.averageGrade != null ? ("flat" as KpiTrend) : ("flat" as KpiTrend),
            trendText: summary?.averageGrade != null ? quarterLabel ?? "—" : "—",
        },
    ];

    // Grade submission progress
    const gradeProgress = summary?.academicProgress.gradeSubmission;
    const gradeSubmissionPercent =
        gradeProgress && gradeProgress.total > 0
            ? Math.round((gradeProgress.submitted / gradeProgress.total) * 1000) / 10
            : null;

    // Snapshot data
    const pendingActions = summary
        ? Math.max(0, summary.enrollmentCount - summary.gradedEnrollments)
        : 0;

    // ==================== Loading state ====================
    if (loading && summary === null) {
        return (
            <section className="dashboard flex flex-col gap-5" aria-busy="true">
                {/* Hero skeleton */}
                <PageCard className="dashboard__hero relative p-4 sm:p-6">
                    <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
                        <div className="flex min-w-0 items-start gap-4">
                            <SkeletonLine width="3.5rem" height="3.5rem" radius="var(--radius-lg)" />
                            <div className="flex flex-col gap-2">
                                <SkeletonLine width="7rem" height="0.75rem" />
                                <SkeletonLine width="14rem" height="1.5rem" />
                                <SkeletonLine width="18rem" height="0.875rem" />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <SkeletonLine width="8rem" height="2rem" radius="9999px" />
                            <SkeletonLine width="7rem" height="2rem" radius="9999px" />
                        </div>
                    </div>
                </PageCard>

                {/* KPI skeletons */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="analytics__kpi flex items-center gap-4 p-4">
                            <SkeletonLine width="2.75rem" height="2.75rem" radius="0.75rem" />
                            <div className="flex flex-1 flex-col gap-2">
                                <SkeletonLine width="5rem" height="0.625rem" />
                                <SkeletonLine width="3rem" height="1.5rem" />
                                <SkeletonLine width="4rem" height="0.75rem" radius="9999px" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Content skeletons */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="dashboard__quick flex items-center gap-3 rounded-xl border p-4">
                            <SkeletonLine width="2.5rem" height="2.5rem" radius="var(--radius-lg)" />
                            <div className="flex flex-1 flex-col gap-2">
                                <SkeletonLine width="6rem" height="0.875rem" />
                                <SkeletonLine width="3rem" height="0.625rem" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    // ==================== Error state ====================
    if (error && summary === null) {
        return (
            <section className="dashboard flex flex-col gap-5">
                <PageCard className="dashboard__hero relative p-6 sm:p-8">
                    <div className="relative z-10 flex flex-col items-center justify-center gap-4 py-8 text-center">
                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl text-white">
                            <FiAlertCircle />
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-white">Unable to load dashboard data</h2>
                            <p className="mt-1 text-sm text-white/70">Please check your connection and try again.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                        >
                            <FiRefreshCw aria-hidden="true" />
                            Retry
                        </button>
                    </div>
                </PageCard>
            </section>
        );
    }

    // ==================== Render ====================
    return (
        <section className="dashboard flex flex-col gap-5" aria-busy={loading}>
            {/* ==================== Hero ==================== */}
            <PageCard className="dashboard__hero relative p-4 sm:p-6">
                <div className="dashboard__hero-glow dashboard__hero-glow--accent" aria-hidden="true" />
                <div className="dashboard__hero-glow dashboard__hero-glow--leaf" aria-hidden="true" />

                <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="dashboard__hero-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" aria-hidden="true">
                            <FiActivity />
                        </span>
                        <div className="min-w-0">
                            <span className="dashboard__hero-eyebrow text-[0.6875rem] font-bold uppercase tracking-[0.14em]">Admin Overview</span>
                            <h2 className="dashboard__hero-title mt-1 text-xl font-extrabold tracking-tight">{greeting}, Admin</h2>
                            <p className="dashboard__hero-subtitle mt-1 text-sm">
                                Here&apos;s the current academic status of your school.
                            </p>
                            {academicContext && (
                                <p className="dashboard__hero-academic mt-1.5 text-xs font-bold tracking-wide">
                                    {academicContext}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className="layout__date hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex">
                            <FiCalendar aria-hidden="true" />
                            {today}
                        </span>
                        {loading ? (
                            <span
                                className="dashboard__hero-badge inline-flex items-center gap-2 rounded-full px-3.5 py-2"
                                aria-hidden="true"
                            >
                                <SkeletonLine width="5.5rem" height="0.875rem" radius="9999px" />
                            </span>
                        ) : (
                            <span className={`dashboard__hero-badge ${enrollmentOpen === false ? "dashboard__hero-badge--closed" : "dashboard__hero-badge--open"} inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold`}>
                                {enrollmentOpen === false ? <FiXCircle aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
                                {enrollmentOpen === false ? "Enrollment Closed" : "Enrollment Open"}
                            </span>
                        )}
                    </div>
                </div>
            </PageCard>

            {/* ==================== KPI cards ==================== */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => (
                    <KpiCard
                        key={kpi.label}
                        label={kpi.label}
                        value={kpi.value}
                        icon={kpi.icon}
                        loading={loading}
                        trend={{ tone: kpi.trend, text: kpi.trendText }}
                    />
                ))}
            </div>

            {/* ==================== Quick actions ==================== */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                        <button
                            key={action.label}
                            type="button"
                            onClick={() => navigate(action.path)}
                            className="dashboard__quick flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left"
                        >
                            <span className={`dashboard__quick-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${action.accent ? "dashboard__quick-icon--accent" : ""}`} aria-hidden="true">
                                <Icon />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[0.8125rem] font-bold text-neutral-800">{action.label}</span>
                                <span className="mt-0.5 flex items-center gap-1 text-[0.6875rem] font-semibold text-neutral-400">
                                    Open
                                    <FiArrowRight aria-hidden="true" />
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ==================== Attention Required ==================== */}
            {summary && summary.attentionItems.length > 0 && (
                <PageCard className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Attention Required</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Items Needing Action</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Issues that require administrator attention</p>
                        </div>
                        <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                            <FiAlertCircle aria-hidden="true" />
                            {summary.attentionItems.length} issue{summary.attentionItems.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    <div className="flex flex-col gap-0 p-5 pt-0">
                        {summary.attentionItems.map((item) => (
                            <div
                                key={item.id}
                                className={`dashboard__attention-item flex flex-wrap items-start gap-3 rounded-xl border p-4 ${
                                    item.type === "error"
                                        ? "dashboard__attention-item--error"
                                        : "dashboard__attention-item--warning"
                                }`}
                            >
                                <span className={`dashboard__attention-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${
                                    item.type === "error" ? "dashboard__attention-icon--error" : ""
                                }`} aria-hidden="true">
                                    <FiAlertCircle />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-neutral-800">{item.message}</p>
                                    <p className="mt-0.5 text-[0.8125rem] text-neutral-500">{item.detail}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate(item.actionPath)}
                                    className="dashboard__attention-action inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.75rem] font-bold transition-colors"
                                >
                                    {item.actionLabel}
                                    <FiArrowRight aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                    </div>
                </PageCard>
            )}

            {summary && summary.attentionItems.length === 0 && !loading && (
                <PageCard className="analytics__card">
                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#D1FAE5] text-xl text-[#065F46]">
                            <FiCheckCircle />
                        </span>
                        <div>
                            <p className="text-sm font-bold text-neutral-800">All caught up</p>
                            <p className="mt-0.5 text-[0.8125rem] text-neutral-500">No administrative issues require attention right now.</p>
                        </div>
                    </div>
                </PageCard>
            )}

            {/* ==================== Academic Progress ==================== */}
            {summary && (gradeSubmissionPercent !== null || summary.academicProgress.classesWithoutAdviser > 0) && (
                <PageCard className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Academic Progress</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Current Period Overview</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Progress for {quarterLabel}</p>
                        </div>
                        {schoolYearLabel && (
                            <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                                <FiCalendar aria-hidden="true" />
                                {schoolYearLabel}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-5 p-5 pt-0">
                        {gradeSubmissionPercent !== null && gradeProgress && (
                            <div>
                                <div className="flex items-center justify-between text-[0.75rem] font-semibold text-neutral-600">
                                    <span>Grade Submission</span>
                                    <span className="tabular-nums">{gradeSubmissionPercent}%</span>
                                </div>
                                <div className="dashboard__progress-track mt-2" role="progressbar" aria-valuenow={gradeSubmissionPercent} aria-valuemin={0} aria-valuemax={100}>
                                    <span
                                        className="dashboard__progress-fill"
                                        style={{ width: `${gradeSubmissionPercent}%` }}
                                    />
                                </div>
                                <p className="mt-1.5 text-[0.6875rem] text-neutral-400">
                                    {gradeProgress.submitted} of {gradeProgress.total} student records submitted
                                </p>
                            </div>
                        )}

                        {summary.academicProgress.classesWithoutAdviser > 0 && (
                            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600" aria-hidden="true">
                                    <FiAlertCircle />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-amber-800">
                                        {summary.academicProgress.classesWithoutAdviser} class{summary.academicProgress.classesWithoutAdviser !== 1 ? "es" : ""} without adviser
                                    </p>
                                    <p className="mt-0.5 text-[0.8125rem] text-amber-600/80">
                                        Assign advisers from the Classrooms page.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate("/admin/classrooms")}
                                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[0.75rem] font-bold text-amber-700 transition-colors hover:bg-amber-50"
                                >
                                    Manage
                                    <FiArrowRight aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </div>
                </PageCard>
            )}

            {/* ==================== Enrollment status + At a Glance ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <PageCard className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Enrollment</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Enrollment Status</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Current window for the active school year</p>
                        </div>
                        {schoolYearLabel && (
                            <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                                <FiCalendar aria-hidden="true" />
                                {schoolYearLabel}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-5 p-5">
                        <div className={`dashboard__status flex flex-wrap items-center gap-3 rounded-xl border p-4 ${enrollmentOpen === false ? "dashboard__status--closed" : ""}`}>
                            <span className={`dashboard__status-dot ${enrollmentOpen === false ? "dashboard__status-dot--closed" : ""}`} aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                {enrollmentOpen === false ? (
                                    <>
                                        <p className="text-sm font-bold text-[#B91C1C]">Enrollment is closed</p>
                                        <p className="mt-0.5 text-[0.8125rem] text-[#B91C1C]/80">
                                            New enrollments are paused. Reopen it from Admin Settings → Academic Year.
                                        </p>
                                    </>
                                ) : enrollmentOpen === true ? (
                                    <>
                                        <p className="text-sm font-bold text-[#065F46]">Enrollment is open</p>
                                        <p className="mt-0.5 text-[0.8125rem] text-[#065F46]/80">
                                            New students can be enrolled from the Enrollments page.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold text-neutral-600">Checking enrollment status…</p>
                                        <p className="mt-0.5 text-[0.8125rem] text-neutral-500">Syncing with academic settings.</p>
                                    </>
                                )}
                            </div>
                            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${enrollmentOpen === false ? "text-[#B91C1C]" : enrollmentOpen === true ? "text-[#065F46]" : "text-neutral-500"}`}>
                                {enrollmentOpen === false ? (
                                    <>
                                        <FiXCircle aria-hidden="true" />
                                        Closed
                                    </>
                                ) : enrollmentOpen === true ? (
                                    <>
                                        <FiCheckCircle aria-hidden="true" />
                                        Open
                                    </>
                                ) : (
                                    "…"
                                )}
                            </span>
                        </div>

                        {summary && (
                            <div>
                                <div className="flex items-center justify-between text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">
                                    <span>{quarterLabel} of 4</span>
                                    <span>Current quarter</span>
                                </div>
                                <div className="dashboard__quarter mt-2 flex gap-2" role="group" aria-label="Quarter progress">
                                    {[1, 2, 3, 4].map((q) => (
                                        <span
                                            key={q}
                                            className={`dashboard__quarter-seg ${
                                                q < summary.academicQuarter
                                                    ? "dashboard__quarter-seg--done"
                                                    : q === summary.academicQuarter
                                                        ? "dashboard__quarter-seg--active"
                                                        : ""
                                            }`}
                                            aria-hidden="true"
                                        />
                                    ))}
                                </div>
                                <div className="mt-2 flex gap-2">
                                    {[1, 2, 3, 4].map((q) => (
                                        <span key={q} className="flex-1 text-center text-[0.6875rem] font-semibold text-neutral-400">
                                            Q{q}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!summary && loading && (
                            <div className="flex flex-col gap-2">
                                <SkeletonLine width="100%" height="0.75rem" />
                                <div className="flex gap-2">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <SkeletonLine key={i} width="100%" height="0.5rem" radius="9999px" className="flex-1" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </PageCard>

                <PageCard className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Snapshot</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">At a Glance</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Quick numbers for today</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 p-5 pt-2 sm:grid-cols-2">
                        {[
                            {
                                label: "Attendance Today",
                                value: summary
                                    ? summary.attendanceToday?.rate != null
                                        ? `${summary.attendanceToday.rate}%`
                                        : "N/A"
                                    : "—",
                                icon: FiCheckCircle,
                            },
                            {
                                label: "New This Week",
                                value: summary ? summary.newStudentsThisWeek.toLocaleString() : "—",
                                icon: FiUserPlus,
                            },
                            {
                                label: "Grades Finalized",
                                value: summary ? summary.gradedEnrollments.toLocaleString() : "—",
                                icon: FiClipboard,
                            },
                            {
                                label: "Pending Actions",
                                value: summary ? pendingActions.toLocaleString() : "—",
                                icon: FiAlertCircle,
                            },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="dashboard__snapshot flex items-center gap-3 rounded-xl border p-4">
                                    {loading ? (
                                        <SkeletonLine width="2.5rem" height="2.5rem" radius="0.5rem" />
                                    ) : (
                                        <span className="dashboard__snapshot-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                            <Icon />
                                        </span>
                                    )}
                                    <div className="min-w-0">
                                        <span className="dashboard__snapshot-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">{item.label}</span>
                                        {loading ? (
                                            <SkeletonLine width="3.5rem" height="1.375rem" radius="0.5rem" className="mt-1.5" />
                                        ) : (
                                            <span className="dashboard__snapshot-value mt-0.5 block text-[1.25rem] font-bold leading-none">{item.value}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </PageCard>
            </div>

            {/* ==================== Students per School Year ==================== */}
            {summary && (
                <StudentsPerSchoolYearCard loading={loading} />
            )}
        </section>
    );
}

// ==================== Students per School Year sub-component ====================

function StudentsPerSchoolYearCard({ loading: parentLoading }: { loading: boolean }) {
    const [chartData, setChartData] = useState<{ startYear: string; endYear: string; count: number }[]>([]);
    const [chartLoading, setChartLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getAPICall<{ startYear: string; endYear: string; count: number }[]>("/analytics", { toast: false })
            .then((response) => {
                if (!cancelled) {
                    const raw = (response.data as Record<string, unknown>)?.studentsPerSchoolYear;
                    if (Array.isArray(raw)) {
                        setChartData(raw);
                    }
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setChartLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const hasChartData = chartData.length > 0;
    const enrollmentCounts = hasChartData ? chartData.map((r) => r.count) : [0];
    const minEnrollment = Math.min(...enrollmentCounts);
    const enrollmentRange = Math.max(1, Math.max(...enrollmentCounts) - minEnrollment);
    const stepX = 315 / Math.max(1, chartData.length - 1);
    const enrollmentPoints = chartData.map((row, index) => {
        const x = Math.round(index * stepX);
        const y = Math.round(115 - ((row.count - minEnrollment) / enrollmentRange) * 90);
        return `${x},${y}`;
    });
    const enrollmentLinePoints = enrollmentPoints.join(" ");
    const lastEnrollmentPoint = enrollmentPoints[enrollmentPoints.length - 1] ?? "0,120";
    const lastEnrollmentX = lastEnrollmentPoint.split(",")[0] ?? "0";
    const enrollmentAreaPoints = hasChartData
        ? `${enrollmentLinePoints} ${lastEnrollmentX},120 0,120`
        : "0,120 0,120";

    return (
        <PageCard className="analytics__card">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                <div className="min-w-0">
                    <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Enrollment</span>
                    <h3 className="analytics__title mt-1 text-base font-bold">Students per School Year</h3>
                    <p className="analytics__subtitle mt-1 text-[0.8125rem]">Total students enrolled each academic year</p>
                </div>
                <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                    <FiUsers aria-hidden="true" />
                    {chartLoading ? "Loading…" : hasChartData ? `${chartData.length} school years` : "No data"}
                </span>
            </div>

            {(parentLoading || chartLoading) ? (
                <div className="px-5 pb-5">
                    <div className="flex h-[8.125rem] flex-col justify-end gap-1">
                        <SkeletonLine width="55%" height="0.875rem" radius="0.375rem" />
                        <div className="mt-2">
                            <SkeletonLine width="100%" height="6.5rem" radius="0.75rem" />
                        </div>
                    </div>
                </div>
            ) : hasChartData ? (
                <div className="px-5 pb-2 overflow-y-auto">
                    <svg className="analytics__line-chart" viewBox="0 0 320 130" role="img" aria-label="Students per school year line chart">
                        <defs>
                            <linearGradient id="dashboard-line-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <g stroke="var(--neutral-border)" strokeDasharray="4 6" strokeWidth="1">
                            <line x1="0" y1="30" x2="320" y2="30" />
                            <line x1="0" y1="60" x2="320" y2="60" />
                            <line x1="0" y1="90" x2="320" y2="90" />
                        </g>
                        <polygon className="dashboard__line-area" points={enrollmentAreaPoints} />
                        <polyline
                            points={enrollmentLinePoints}
                            fill="none"
                            stroke="var(--primary)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {chartData.map((row, index) => {
                            const [x, y] = enrollmentLinePoints.split(" ")[index]!.split(",").map(Number);
                            return (
                                <g key={row.startYear}>
                                    <text
                                        x={x}
                                        y={y - 9}
                                        textAnchor="middle"
                                        className="dashboard__line-label"
                                    >
                                        {row.count.toLocaleString()}
                                    </text>
                                    <circle cx={x} cy={y} r="3.5" fill="var(--surface-white)" stroke="var(--primary)" strokeWidth="2">
                                        <title>{`SY ${row.startYear}–${row.endYear}: ${row.count.toLocaleString()} students`}</title>
                                    </circle>
                                </g>
                            );
                        })}
                    </svg>
                    <div className="mt-2 flex gap-3 border-t pt-2.5">
                        {chartData.map((row) => (
                            <span key={row.startYear} className="analytics__bar-label flex-1 text-center text-[0.75rem]">
                                {row.startYear}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="px-5 pb-5">
                    <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm font-semibold text-neutral-500">
                        No enrollment data available
                    </p>
                </div>
            )}
        </PageCard>
    );
}
