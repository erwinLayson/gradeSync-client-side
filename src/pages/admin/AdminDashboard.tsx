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
    FiUserCheck,
    FiUserPlus,
    FiUsers,
    FiXCircle,
} from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { SkeletonLine } from "../../components/Skeleton";
import "../../style/skeleton.css";

import "../../style/analyticsReports.css";
import "../../style/adminDashboard.css";

// ==================== Static UI data ====================

const SY = "2026–2027";

const QUICK_ACTIONS = [
    { label: "Enroll Student", path: "/admin/enrollments", icon: FiUserPlus, accent: false },
    { label: "Add Teacher", path: "/admin/teachers", icon: FiUserCheck, accent: false },
    { label: "Create Report", path: "/admin/reports", icon: FiFileText, accent: false },
    { label: "Manage Classes", path: "/admin/classrooms", icon: FiBookOpen, accent: true },
] as const;


interface AnalyticsData {
    students?: number;
    teachers?: number;
    classrooms?: number;
    averageGrade?: number | null;
    studentsPerSchoolYear?: { startYear: string; endYear: string; count: number }[];
    enrollmentBySex?: { sex: string; count: number }[];
    gradedEnrollments?: number;
    enrollmentCount?: number;
    newStudentsThisWeek?: number;
    attendanceToday?: { total: number; present: number; rate: number | null } | null;
}

// Live academic settings (current quarter + enrollment open/closed).
interface AcademicSettingsData {
    id: number;
    currentQuarter: number;
    enrollmentOpen: boolean | number;
}

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

    // Live per-school-year totals from /analytics, falling back to sample data.
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    // True while /analytics is in flight — drives the card skeletons below.
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    // Live academic settings (current quarter + enrollment status), falling back to the mock.
    const [academicSettings, setAcademicSettings] = useState<AcademicSettingsData | null>(null);
    // True while /academic-settings is in flight.
    const [settingsLoading, setSettingsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getAPICall<AnalyticsData>("/analytics", { toast: false })
            .then((response) => {
                if (!cancelled) setAnalytics(response.data ?? null);
            })
            .catch(() => {
                // Error toast is handled by the axios interceptor; keep the no-data state.
            })
            .finally(() => {
                if (!cancelled) setAnalyticsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        getAPICall<AcademicSettingsData>("/academic-settings", { toast: false })
            .then((response) => {
                if (!cancelled) setAcademicSettings(response.data ?? null);
            })
            .catch(() => {
                // Error toast is handled by the axios interceptor; keep the mock state.
            })
            .finally(() => {
                if (!cancelled) setSettingsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const hasAnalyticsData = analytics !== null && Object.keys(analytics).length > 0;

    // Card-level loading: only while fetching; once settled, show live data or the no-data state.
    const kpisLoading = analyticsLoading;
    const chartsLoading = analyticsLoading;
    const snapshotLoading = analyticsLoading;

    // Small shivering placeholder pill that matches the trend chip size.
    const loadingPill = (
        <span
            className="mt-1.5 inline-flex items-center px-2 py-0.5"
            aria-hidden="true"
        >
            <SkeletonLine width="4.5rem" height="0.875rem" radius="9999px" />
        </span>
    );

    // Enrollment status: null while loading, true/false once known.
    const enrollmentOpen =
        academicSettings === null ? null : Boolean(academicSettings.enrollmentOpen);

    // Quarter segments come from /academic-settings; fall back to Q2 active (the mock).
    const activeQuarter = academicSettings?.currentQuarter ?? 2;
    const quarterSegments = [1, 2, 3, 4].map((quarter) => ({
        label: `Q${quarter}`,
        state: quarter < activeQuarter ? "done" : quarter === activeQuarter ? "active" : "upcoming",
    }));

    // KPI values come from /analytics; show a no-data state when unavailable.
    const kpis = [
        {
            label: "Total Students",
            value:
                hasAnalyticsData && analytics?.students != null
                    ? analytics.students.toLocaleString()
                    : "No data found",
            delta: hasAnalyticsData ? "Live data" : "No data found",
            icon: FiUsers,
            trend: hasAnalyticsData ? "live" : "flat",
        },
        {
            label: "Teaching Staff",
            value:
                hasAnalyticsData && analytics?.teachers != null
                    ? analytics.teachers.toLocaleString()
                    : "No data found",
            delta: hasAnalyticsData ? "Live data" : "No data found",
            icon: FiBookOpen,
            trend: hasAnalyticsData ? "live" : "flat",
        },
        {
            label: "Active Classes",
            value:
                hasAnalyticsData && analytics?.classrooms != null
                    ? analytics.classrooms.toLocaleString()
                    : "No data found",
            delta: hasAnalyticsData ? "Live data" : "No data found",
            icon: FiActivity,
            trend: hasAnalyticsData ? "live" : "flat",
        },
        {
            label: "Average Grade",
            value: hasAnalyticsData
                ? analytics?.averageGrade != null
                    ? analytics.averageGrade.toFixed(1)
                    : "0"
                : "0",
            delta: hasAnalyticsData ? "Live data" : "flat",
            icon: FiBookOpen,
            trend: hasAnalyticsData ? "live" : "flat",
        },
    ];

    const liveSeries = analytics?.studentsPerSchoolYear ?? [];
    const chartSeries = liveSeries.map((row) => ({ year: row.startYear, count: row.count }));
    const hasChartData = chartSeries.length > 0;

    // Build the SVG line/area points for the per-school-year enrollment trend.
    // Scaled to the min–max count range so year-over-year growth is visible.
    const enrollmentCounts = hasChartData ? chartSeries.map((row) => row.count) : [0];
    const minEnrollment = Math.min(...enrollmentCounts);
    const enrollmentRange = Math.max(1, Math.max(...enrollmentCounts) - minEnrollment);
    const stepX = 315 / Math.max(1, chartSeries.length - 1);
    const enrollmentPoints = chartSeries.map((row, index) => {
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

    // Male / female counts come from /analytics; show a no-data state when unavailable.
    const sexRows = analytics?.enrollmentBySex ?? [];
    const hasSexEnrollmentData = sexRows.length > 0;
    const sexEnrollment = hasSexEnrollmentData
        ? {
              male: sexRows.find((row) => row.sex === "Male")?.count ?? 0,
              female: sexRows.find((row) => row.sex === "Female")?.count ?? 0,
          }
        : null;
    const totalSexEnrollment = (sexEnrollment?.male ?? 0) + (sexEnrollment?.female ?? 0);
    const malePercent =
        totalSexEnrollment > 0
            ? Math.round((((sexEnrollment?.male ?? 0) / totalSexEnrollment) * 1000)) / 10
            : 0;
    const femalePercent =
        totalSexEnrollment > 0
            ? Math.round((((sexEnrollment?.female ?? 0) / totalSexEnrollment) * 1000)) / 10
            : 0;

    // At-a-glance tiles come from /analytics; show a no-data state when unavailable.
    const gradedEnrollments = analytics?.gradedEnrollments ?? 0;
    const enrollmentCount = analytics?.enrollmentCount ?? 0;
    const pendingActions = Math.max(0, enrollmentCount - gradedEnrollments);
    const snapshot = [
        {
            label: "Attendance Today",
            value: hasAnalyticsData
                ? analytics?.attendanceToday?.rate != null
                    ? `${analytics.attendanceToday.rate}%`
                    : "0"
                : "0",
            icon: FiCheckCircle,
        },
        {
            label: "New This Week",
            value:
                hasAnalyticsData && analytics?.newStudentsThisWeek != null
                    ? analytics.newStudentsThisWeek.toLocaleString()
                    : "No data found",
            icon: FiUserPlus,
        },
        {
            label: "Grades Finalized",
            value: hasAnalyticsData ? gradedEnrollments.toLocaleString() : "No data found",
            icon: FiClipboard,
        },
        {
            label: "Pending Actions",
            value: hasAnalyticsData ? pendingActions.toLocaleString() : "No data found",
            icon: FiAlertCircle,
        },
    ];

    return (
        <section className="dashboard flex flex-col gap-5" aria-busy={analyticsLoading || settingsLoading}>
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
                            <span className="dashboard__hero-eyebrow text-[0.6875rem] font-bold uppercase tracking-[0.14em]">Admin Overview</span>
                            <h2 className="dashboard__hero-title mt-1 text-2xl font-extrabold tracking-tight">{greeting}, Admin</h2>
                            <p className="dashboard__hero-subtitle mt-1 text-sm">
                                {today} — here's what's happening across the school.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className="dashboard__hero-badge inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold">
                            <FiCalendar aria-hidden="true" />
                            SY {SY}
                        </span>
                        {settingsLoading ? (
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
            </div>

            {/* ==================== KPI cards ==================== */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <div key={kpi.label} className="analytics__kpi flex items-center gap-4 p-4">
                            {kpisLoading ? (
                                <SkeletonLine width="2.75rem" height="2.75rem" radius="0.75rem" />
                            ) : (
                                <span className="analytics__kpi-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                                    <Icon />
                                </span>
                            )}
                            <div className="min-w-0 flex-1">
                                <span className="analytics__kpi-label block text-[0.6875rem] font-bold uppercase tracking-[0.08em]">{kpi.label}</span>
                                {kpisLoading ? (
                                    <SkeletonLine width="4.5rem" height="1.75rem" radius="0.5rem" className="mt-1.5" />
                                ) : (
                                    <span className="analytics__kpi-value mt-0.5 block text-[1.5rem] font-bold leading-none">{kpi.value}</span>
                                )}
                                {kpisLoading ? (
                                    loadingPill
                                ) : (
                                    <span className={`analytics__trend analytics__trend--${kpi.trend} mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 text-[0.6875rem]`}>
                                        {kpi.delta}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
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

            {/* ==================== Enrollment status + students per school year ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Enrollment</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Enrollment Status</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Current window for the active school year</p>
                        </div>
                        <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                            <FiCalendar aria-hidden="true" />
                            SY {SY}
                        </span>
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

                        <div>
                            <div className="flex items-center justify-between text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">
                                {settingsLoading ? (
                                    <>
                                        <SkeletonLine width="6rem" height="0.75rem" />
                                        <SkeletonLine width="6.5rem" height="0.75rem" />
                                    </>
                                ) : (
                                    <>
                                        <span>Quarter {activeQuarter} of 4</span>
                                        <span>Current quarter</span>
                                    </>
                                )}
                            </div>
                            <div className="dashboard__quarter mt-2 flex gap-2" role="group" aria-label="Quarter progress">
                                {settingsLoading
                                    ? Array.from({ length: 4 }).map((_, index) => (
                                          <SkeletonLine key={index} width="100%" height="0.5rem" radius="9999px" className="flex-1" />
                                      ))
                                    : quarterSegments.map((quarter) => (
                                          <span
                                              key={quarter.label}
                                              className={`dashboard__quarter-seg ${quarter.state === "done" ? "dashboard__quarter-seg--done" : ""} ${quarter.state === "active" ? "dashboard__quarter-seg--active" : ""}`}
                                              aria-hidden="true"
                                          />
                                      ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                                {quarterSegments.map((quarter) => (
                                    <span key={quarter.label} className="flex-1 text-center text-[0.6875rem] font-semibold text-neutral-400">
                                        {quarter.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Enrollment</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Students per School Year</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Total students enrolled each academic year</p>
                        </div>
                        <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                            <FiUsers aria-hidden="true" />
                            {hasChartData ? `${chartSeries.length} school years` : "No data found"}
                        </span>
                    </div>

                    {chartsLoading ? (
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
                                {chartSeries.map((row, index) => {
                                    const [x, y] = enrollmentLinePoints.split(" ")[index]!.split(",").map(Number);
                                    return (
                                        <g key={row.year}>
                                            <text
                                                x={x}
                                                y={y - 9}
                                                textAnchor="middle"
                                                className="dashboard__line-label"
                                            >
                                                {row.count.toLocaleString()}
                                            </text>
                                            <circle cx={x} cy={y} r="3.5" fill="var(--surface-white)" stroke="var(--primary)" strokeWidth="2">
                                                <title>{`SY ${row.year}: ${row.count.toLocaleString()} students`}</title>
                                            </circle>
                                        </g>
                                    );
                                })}
                            </svg>
                            <div className="mt-2 flex gap-3 border-t pt-2.5">
                                {chartSeries.map((row) => (
                                    <span key={row.year} className="analytics__bar-label flex-1 text-center text-[0.75rem]">
                                        {row.year}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="px-5 pb-5">
                            <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm font-semibold text-neutral-500">
                                No data found
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ==================== Male / female enrollment + at a glance ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Demographics</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Male vs Female Enrollment</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Distribution of enrolled students for SY {SY}</p>
                        </div>
                        <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                            <FiUsers aria-hidden="true" />
                            {hasSexEnrollmentData ? `${totalSexEnrollment.toLocaleString()} students` : "No data found"}
                        </span>
                    </div>

                    {chartsLoading ? (
                        <div className="flex flex-col gap-4 p-5">
                            <SkeletonLine width="100%" height="1rem" radius="9999px" />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <SkeletonLine width="100%" height="6.5rem" radius="0.75rem" />
                                <SkeletonLine width="100%" height="6.5rem" radius="0.75rem" />
                            </div>
                        </div>
                    ) : hasSexEnrollmentData && sexEnrollment ? (
                        <div className="flex flex-col gap-5 p-5">
                            <div className="flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label={`${malePercent}% male, ${femalePercent}% female`}>
                                <span className="dashboard__sex-seg dashboard__sex-seg--male" style={{ width: `${malePercent}%` }} />
                                <span className="dashboard__sex-seg dashboard__sex-seg--female" style={{ width: `${femalePercent}%` }} />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-[#D1FAE5] bg-[#F6FBF7] p-4">
                                    <div className="flex items-center gap-2.5">
                                        <span className="inline-block h-3 w-3 rounded-full bg-[var(--primary)]" aria-hidden="true" />
                                        <span className="text-[0.8125rem] font-semibold text-neutral-700">Male</span>
                                    </div>
                                    <p className="mt-2 text-[1.375rem] font-bold leading-none text-neutral-900">{sexEnrollment!.male.toLocaleString()}</p>
                                    <p className="mt-1 text-[0.6875rem] font-semibold text-neutral-500">{malePercent}% of enrollment</p>
                                </div>
                                <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
                                    <div className="flex items-center gap-2.5">
                                        <span className="inline-block h-3 w-3 rounded-full bg-[var(--warning)]" aria-hidden="true" />
                                        <span className="text-[0.8125rem] font-semibold text-neutral-700">Female</span>
                                    </div>
                                    <p className="mt-2 text-[1.375rem] font-bold leading-none text-neutral-900">{sexEnrollment!.female.toLocaleString()}</p>
                                    <p className="mt-1 text-[0.6875rem] font-semibold text-neutral-500">{femalePercent}% of enrollment</p>
                                </div>
                            </div>

                            <p className="text-[0.75rem] text-neutral-500">
                                Based on {totalSexEnrollment.toLocaleString()} enrollments recorded for SY {SY}.
                            </p>
                        </div>
                    ) : (
                        <div className="px-5 pb-5">
                            <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm font-semibold text-neutral-500">
                                No data found
                            </p>
                        </div>
                    )}
                </div>

                <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Snapshot</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">At a Glance</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Quick numbers for today</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 p-5 pt-2 sm:grid-cols-2">
                        {snapshot.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="dashboard__snapshot flex items-center gap-3 rounded-xl border p-4">
                                    {snapshotLoading ? (
                                        <SkeletonLine width="2.5rem" height="2.5rem" radius="0.5rem" />
                                    ) : (
                                        <span className="dashboard__snapshot-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                            <Icon />
                                        </span>
                                    )}
                                    <div className="min-w-0">
                                        <span className="dashboard__snapshot-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">{item.label}</span>
                                        {snapshotLoading ? (
                                            <SkeletonLine width="3.5rem" height="1.375rem" radius="0.5rem" className="mt-1.5" />
                                        ) : (
                                            <span className="dashboard__snapshot-value mt-0.5 block text-[1.25rem] font-bold leading-none">{item.value}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ==================== Footer note ==================== */}
            <p className="analytics__subtitle flex items-center gap-2 px-1 text-[0.75rem]">
                <FiActivity aria-hidden="true" />
                All widgets on this page show live data from analytics.
            </p>
        </section>
    );
}
