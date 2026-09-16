import { useEffect, useMemo, useState } from "react";
import {
    FiActivity,
    FiAward,
    FiBarChart2,
    FiBookOpen,
    FiCheckCircle,
    FiInbox,
    FiLoader,
    FiUserCheck,
    FiUsers,
    FiXCircle
} from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { KpiCard } from "../../components/KpiCard";
import { PageCard } from "../../components/PageCard";
import { SkeletonLine } from "../../components/Skeleton";
import "../../style/skeleton.css";
import "../../style/analyticsReports.css";

// ==================== Types (mirror the server /api/analytics response) ====================

interface SchoolYear {
    id: number;
    startYear: string;
    endYear: string;
}

interface EnrollmentByGrade {
    gradeLevel: number;
    count: number;
}

interface SubjectPerformance {
    subject: string;
    score: number;
}

interface TopPerformer {
    studentId: number;
    fullname: string;
    section: string;
    grade: number;
}

interface AttendanceTrendRow {
    month: string;
    present: number;
    total: number;
    rate: number;
}

interface AnalyticsData {
    students: number;
    teachers: number;
    classrooms: number;
    averageGrade: number | null;
    passingRate: number | null;
    passingCount: number;
    gradedEnrollments: number;
    enrollmentByGrade: EnrollmentByGrade[];
    subjectPerformance: SubjectPerformance[];
    topPerformers: TopPerformer[];
    attendanceTrend: AttendanceTrendRow[];
    schoolYearsWithEnrollments: number[];
}

const GRADES = [7, 8, 9, 10, 11, 12];

function formatSchoolYear(year: SchoolYear): string {
    return `${year.startYear}–${year.endYear}`;
}

function monthLabel(month: string): string {
    // "2026-08" -> "Aug"
    const [, mm] = month.split("-");
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const index = Number(mm) - 1;
    return names[index] ?? month;
}

// ==================== Page ====================

export default function AnalyticsReports() {
    const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
    const [schoolYearId, setSchoolYearId] = useState<number | undefined>(undefined);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    // Load the school-year options once. Defaults to the most recent school year
    // that actually has enrollments, so the dashboard opens with data.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [yearsResponse, allAnalytics] = await Promise.all([
                    getAPICall<SchoolYear[]>("/schoolYear"),
                    getAPICall<AnalyticsData>("/analytics")
                ]);
                if (cancelled) {
                    return;
                }
                const sorted = [...(yearsResponse.data ?? [])].sort((a, b) => Number(a.startYear) - Number(b.startYear));
                setSchoolYears(sorted);

                const yearsWithData = new Set(allAnalytics.data?.schoolYearsWithEnrollments ?? []);
                const defaultYear = sorted.filter((y) => yearsWithData.has(y.id)).pop() ?? sorted[sorted.length - 1];
                if (defaultYear) {
                    setSchoolYearId(defaultYear.id);
                }
            } catch {
                // Endpoint unavailable — keep the list empty (charts show all years).
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Fetch analytics whenever the selected school year changes.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const url = schoolYearId !== undefined ? `/analytics?schoolYearId=${schoolYearId}` : "/analytics";
                const response = await getAPICall<AnalyticsData>(url);
                if (!cancelled) {
                    setAnalytics(response.data ?? null);
                }
            } catch {
                if (!cancelled) {
                    setAnalytics(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [schoolYearId]);

    // Merge the (possibly sparse) live grade-level counts into a full G7-G12 series.
    const enrollmentSeries = useMemo(() => {
        const counts = new Map<number, number>();
        for (const row of analytics?.enrollmentByGrade ?? []) {
            counts.set(row.gradeLevel, row.count);
        }
        return GRADES.map((grade) => ({ grade: `G${grade}`, count: counts.get(grade) ?? 0 }));
    }, [analytics]);

    const maxEnrollment = Math.max(1, ...enrollmentSeries.map((row) => row.count));
    const totalEnrolled = enrollmentSeries.reduce((sum, row) => sum + row.count, 0);

    const attendanceTrend = analytics?.attendanceTrend ?? [];

    // Build the SVG line/area points from the live monthly rates (0-100 scale).
    const { linePoints, areaPoints } = useMemo(() => {
        if (attendanceTrend.length === 0) {
            return { linePoints: "", areaPoints: "" };
        }
        const stepX = 315 / Math.max(1, attendanceTrend.length - 1);
        const points = attendanceTrend.map((row, index) => {
            const x = Math.round(index * stepX);
            const y = Math.round(115 - (row.rate / 100) * 90);
            return `${x},${y}`;
        });
        const last = points[points.length - 1]!;
        return {
            linePoints: points.join(" "),
            areaPoints: `${points.join(" ")} ${last.split(",")[0]},120 0,120`
        };
    }, [attendanceTrend]);

    const kpis = useMemo(
        () => [
            { label: "Total Students", value: String(analytics?.students ?? 0), icon: FiUsers },
            { label: "Teaching Staff", value: String(analytics?.teachers ?? 0), icon: FiBookOpen },
            { label: "Active Classes", value: String(analytics?.classrooms ?? 0), icon: FiActivity },
            { label: "Average Grade", value: analytics?.averageGrade != null ? analytics.averageGrade.toFixed(1) : "—", icon: FiBarChart2 }
        ],
        [analytics]
    );

    const hasGradeData = (analytics?.gradedEnrollments ?? 0) > 0;
    const passingRate = analytics?.passingRate ?? 0;
    const passingCount = analytics?.passingCount ?? 0;
    const gradedEnrollments = analytics?.gradedEnrollments ?? 0;
    const failedCount = Math.max(0, gradedEnrollments - passingCount);

    return (
        <section className="analytics flex flex-col gap-5">
            {/* ==================== Header ==================== */}
            <PageCard variant="flat" className="analytics__card">
                <div className="analytics__header flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                        <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">School Performance</span>
                        <h2 className="analytics__title mt-1 text-base font-bold">Reports &amp; Analytics</h2>
                        <p className="analytics__subtitle mt-1 text-[0.8125rem]">High-level snapshot of enrollment, grades, attendance, and subject performance.</p>
                    </div>
                    <label className="flex flex-col gap-1.5">
                        <span className="analytics__subtitle text-[0.6875rem] font-bold uppercase tracking-[0.08em]">School Year</span>
                        <select
                            className="analytics__select rounded-lg border px-3 py-2.5 text-sm"
                            value={schoolYearId ?? ""}
                            onChange={(event) => setSchoolYearId(Number(event.target.value))}
                        >
                            <option value="" disabled>Select school year</option>
                            {schoolYears.map((year) => (
                                <option key={year.id} value={year.id}>{formatSchoolYear(year)}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </PageCard>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((kpi) => (
                    <KpiCard
                        key={kpi.label}
                        label={kpi.label}
                        value={kpi.value}
                        icon={kpi.icon}
                        loading={loading}
                        trend={{
                            tone: "live",
                            text: (
                                <>
                                    <FiLoader className={loading ? "analytics__spin" : ""} aria-hidden="true" />
                                    {loading ? "Loading" : "Live data"}
                                </>
                            ),
                        }}
                    />
                ))}
            </div>

            {/* ==================== Enrollment bars + passing donut ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <PageCard variant="flat" className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Enrollment</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Students by Grade Level</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">
                                {schoolYears.length > 0 ? `${formatSchoolYear(schoolYears.find((y) => y.id === schoolYearId) ?? schoolYears[0]!)} · ` : ""}
                                {totalEnrolled} learners
                            </p>
                        </div>
                        <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                            <FiUsers aria-hidden="true" />
                            Total enrollment
                        </span>
                    </div>

                    {loading ? (
                        <div className="px-5 pb-5">
                            <div className="flex h-48 items-end gap-3">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <SkeletonLine
                                        key={index}
                                        width="100%"
                                        height={`${30 + ((index * 37) % 55)}%`}
                                        radius="0.5rem 0.5rem 0.25rem 0.25rem"
                                        className="flex-1 self-end"
                                    />
                                ))}
                            </div>
                            <div className="mt-3 flex gap-3 border-t pt-3">
                                {GRADES.map((grade) => (
                                    <span key={grade} className="flex-1 text-center text-[0.75rem] font-bold" style={{ color: "var(--text-muted)" }}>
                                        G{grade}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : totalEnrolled === 0 ? (
                        <AnalyticsEmpty message="No enrollments recorded for this school year." />
                    ) : (
                        <div className="px-5 pb-2">
                            <div className="flex h-48 items-end gap-3">
                                {enrollmentSeries.map((row) => (
                                    <div key={row.grade} className="relative h-full flex-1">
                                        <span className="analytics__bar-value absolute -top-5 left-1/2 -translate-x-1/2 text-[0.6875rem] font-semibold">
                                            {row.count}
                                        </span>
                                        <div
                                            className={`analytics__bar ${row.count === maxEnrollment && row.count > 0 ? "analytics__bar--tall" : ""}`}
                                            style={{ height: `${Math.max(2, Math.round((row.count / maxEnrollment) * 100))}%` }}
                                            role="img"
                                            aria-label={`${row.grade}: ${row.count} students`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 flex gap-3 border-t pt-3">
                                {enrollmentSeries.map((row) => (
                                    <span key={row.grade} className="analytics__bar-label flex-1 text-center text-[0.75rem]">{row.grade}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </PageCard>

                <PageCard variant="flat" className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Grades</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Passing Rate</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Learners who met the 75% passing mark this quarter</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center gap-6 p-5 sm:flex-row sm:justify-center sm:gap-10">
                            <SkeletonLine width="11rem" height="11rem" radius="9999px" />
                            <div className="flex w-64 flex-col gap-3">
                                <SkeletonLine width="100%" height="0.875rem" radius="0.5rem" />
                                <SkeletonLine width="100%" height="0.875rem" radius="0.5rem" />
                                <SkeletonLine width="100%" height="4rem" radius="0.75rem" />
                            </div>
                        </div>
                    ) : !hasGradeData ? (
                        <AnalyticsEmpty message="No graded assessments yet — passing rate will appear once teachers record scores." />
                    ) : (
                        <div className="flex flex-col items-center gap-6 p-5 sm:flex-row sm:justify-center sm:gap-10">
                            <div
                                className="analytics__donut"
                                style={{ background: `conic-gradient(var(--primary) 0 ${passingRate}%, var(--error) ${passingRate}% 100%)` }}
                            >
                                <div className="analytics__donut-center">
                                    <span className="analytics__donut-value text-[1.75rem] font-bold leading-none">
                                        {`${passingRate}%`}
                                    </span>
                                    <span className="analytics__donut-label text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">Passing</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2.5">
                                    <span className="analytics__legend-dot inline-block h-3 w-3" style={{ background: "var(--primary)" }} aria-hidden="true" />
                                    <span className="analytics__legend-label text-[0.8125rem]">Passed</span>
                                    <span className="analytics__legend-value ml-auto text-[0.8125rem] font-bold">{passingCount}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <span className="analytics__legend-dot inline-block h-3 w-3" style={{ background: "var(--error)" }} aria-hidden="true" />
                                    <span className="analytics__legend-label text-[0.8125rem]">Failed</span>
                                    <span className="analytics__legend-value ml-auto text-[0.8125rem] font-bold">{failedCount}</span>
                                </div>
                                <div className="mt-2 rounded-xl border p-3">
                                    <p className="analytics__legend-label flex items-center gap-1.5 text-[0.75rem]">
                                        <FiCheckCircle className="text-[var(--success)]" aria-hidden="true" />
                                        {passingCount} of {gradedEnrollments} graded learners passed
                                    </p>
                                    <p className="analytics__legend-label mt-1 flex items-center gap-1.5 text-[0.75rem]">
                                        <FiXCircle className="text-[var(--error)]" aria-hidden="true" />
                                        {failedCount} learners need intervention
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </PageCard>
            </div>

            {/* ==================== Subject bars + attendance trend ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <PageCard variant="flat" className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Academics</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Subject Performance</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Average subject score out of 100</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col gap-3.5 p-5">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className="analytics__hbar-row">
                                    <SkeletonLine width={`${45 + ((index * 23) % 40)}%`} height="0.875rem" />
                                    <SkeletonLine width="100%" height="0.625rem" radius="9999px" />
                                    <SkeletonLine width="100%" height="0.875rem" />
                                </div>
                            ))}
                        </div>
                    ) : !loading && (analytics?.subjectPerformance ?? []).length === 0 ? (
                        <AnalyticsEmpty message="No subject scores recorded yet." />
                    ) : (
                        <div className="flex flex-col gap-3.5 p-5">
                            {(analytics?.subjectPerformance ?? []).map((row) => (
                                <div key={row.subject} className="analytics__hbar-row">
                                    <span className="analytics__hbar-label text-[0.8125rem] font-semibold">{row.subject}</span>
                                    <div className="analytics__hbar-track">
                                        <div className="analytics__hbar-fill" style={{ width: `${Math.min(100, row.score)}%` }} />
                                    </div>
                                    <span className="analytics__hbar-value text-[0.8125rem] font-bold">{row.score}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </PageCard>

                <PageCard variant="flat" className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Attendance</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Monthly Attendance Trend</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Average monthly present rate across all classes</p>
                        </div>
                        <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                            <FiUserCheck aria-hidden="true" />
                            {loading ? "…" : attendanceTrend.length > 0 ? `Avg ${(attendanceTrend.reduce((sum, row) => sum + row.rate, 0) / attendanceTrend.length).toFixed(1)}%` : "No data"}
                        </span>
                    </div>

                    {loading ? (
                        <div className="px-5 pb-5">
                            <SkeletonLine width="100%" height="8.125rem" radius="0.75rem" />
                            <div className="mt-2 flex gap-3 border-t pt-2.5">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <SkeletonLine key={index} width="100%" height="0.625rem" className="flex-1" />
                                ))}
                            </div>
                        </div>
                    ) : !loading && attendanceTrend.length === 0 ? (
                        <AnalyticsEmpty message="No attendance records yet for this school year." />
                    ) : (
                        <div className="px-5 pb-2">
                            <svg className="analytics__line-chart" viewBox="0 0 320 130" role="img" aria-label="Attendance trend line chart">
                                <defs>
                                    <linearGradient id="analytics-line-gradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <g stroke="var(--neutral-border)" strokeDasharray="4 6" strokeWidth="1">
                                    <line x1="0" y1="30" x2="320" y2="30" />
                                    <line x1="0" y1="60" x2="320" y2="60" />
                                    <line x1="0" y1="90" x2="320" y2="90" />
                                </g>
                                {attendanceTrend.length > 0 && (
                                    <>
                                        <polygon className="analytics__line-area" points={areaPoints} />
                                        <polyline
                                            points={linePoints}
                                            fill="none"
                                            stroke="var(--primary)"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        {attendanceTrend.map((row, index) => {
                                            const [x, y] = linePoints.split(" ")[index]!.split(",").map(Number);
                                            return (
                                                <circle key={row.month} cx={x} cy={y} r="3.5" fill="var(--surface-white)" stroke="var(--primary)" strokeWidth="2">
                                                    <title>{`${monthLabel(row.month)}: ${row.rate}%`}</title>
                                                </circle>
                                            );
                                        })}
                                    </>
                                )}
                            </svg>
                            <div className="mt-2 flex gap-3 border-t pt-2.5">
                                {attendanceTrend.length > 0 ? (
                                    attendanceTrend.map((row) => (
                                        <span key={row.month} className="analytics__bar-label flex-1 text-center text-[0.6875rem]">{monthLabel(row.month)}</span>
                                    ))
                                ) : (
                                    Array.from({ length: 6 }).map((_, index) => (
                                        <span key={index} className="analytics__bar-label flex-1 text-center text-[0.6875rem]">—</span>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </PageCard>
            </div>

            {/* ==================== Top performers + subject summary ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <PageCard variant="flat" className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Achievers</span>
                            <h3 className="analytics__title mt-1 flex items-center gap-2 text-base font-bold">
                                <FiAward className="text-[var(--warning)]" aria-hidden="true" />
                                Top Performing Students
                            </h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Highest general averages this quarter</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col gap-2 p-5">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-4 px-1 py-1.5">
                                    <SkeletonLine width="1.75rem" height="1.75rem" radius="0.5rem" />
                                    <SkeletonLine width={`${30 + ((index * 17) % 30)}%`} height="0.875rem" />
                                    <SkeletonLine width="20%" height="0.875rem" className="ml-auto" />
                                    <SkeletonLine width="3.5rem" height="0.875rem" />
                                </div>
                            ))}
                        </div>
                    ) : !loading && (analytics?.topPerformers ?? []).length === 0 ? (
                        <AnalyticsEmpty message="No graded students yet." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="analytics__table w-full min-w-[28rem] border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className="px-6 py-3">Rank</th>
                                        <th className="px-6 py-3">Student</th>
                                        <th className="px-6 py-3">Section</th>
                                        <th className="px-6 py-3 text-right">GWA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(analytics?.topPerformers ?? []).map((row, index) => (
                                        <tr key={row.studentId}>
                                            <td className="px-6 py-3.5">
                                                <span className={`analytics__rank inline-flex h-7 w-7 items-center justify-center text-[0.75rem] ${index < 3 ? `analytics__rank--${index + 1}` : "analytics__rank--rest"}`}>
                                                    {index + 1}
                                                </span>
                                            </td>
                                            <td className="analytics__cell--name px-6 py-3.5">{row.fullname}</td>
                                            <td className="analytics__cell--muted px-6 py-3.5">{row.section}</td>
                                            <td className="analytics__cell--mono px-6 py-3.5 text-right font-bold">{Number(row.grade).toFixed(1)}</td>
                                        </tr>
                                    ))}
                                    {!loading && (analytics?.topPerformers ?? []).length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center">
                                                <AnalyticsEmpty message="No graded students yet." compact />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </PageCard>

                <PageCard variant="flat" className="analytics__card">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
                        <div className="min-w-0">
                            <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Summary</span>
                            <h3 className="analytics__title mt-1 text-base font-bold">Subject Summary</h3>
                            <p className="analytics__subtitle mt-1 text-[0.8125rem]">Average scores and passing rates by subject</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="analytics__table w-full min-w-[28rem] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="px-6 py-3">Subject</th>
                                    <th className="px-6 py-3 text-right">Average</th>
                                    <th className="px-6 py-3 text-right">Pass Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(analytics?.subjectPerformance ?? []).map((row) => (
                                    <tr key={row.subject}>
                                        <td className="analytics__cell--name px-6 py-3.5">{row.subject}</td>
                                        <td className="analytics__cell--mono px-6 py-3.5 text-right font-bold">{Number(row.score).toFixed(1)}</td>
                                        <td className="px-6 py-3.5 text-right">
                                            <span className="analytics__pass-chip inline-flex rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold">{Math.round(row.score)}%</span>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && (analytics?.subjectPerformance ?? []).length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center">
                                            <AnalyticsEmpty message="No subject scores recorded yet." compact />
                                        </td>
                                    </tr>
                                )}
                                {loading && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center">
                                            <div className="flex flex-col gap-2" aria-hidden="true">
                                                {Array.from({ length: 4 }).map((_, index) => (
                                                    <SkeletonLine key={index} width="100%" height="0.875rem" />
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </PageCard>
            </div>

            <p className="analytics__subtitle flex items-center gap-2 px-1 text-[0.75rem]">
                <FiBarChart2 aria-hidden="true" />
                Live data from the GradeSync database{schoolYearId !== undefined && schoolYears.length > 0 ? ` · ${formatSchoolYear(schoolYears.find((y) => y.id === schoolYearId) ?? schoolYears[0]!)}` : ""}.
            </p>
        </section>
    );
}

// ==================== Shared empty / loading states ====================

function AnalyticsEmpty({ message, compact = false }: { message: string; compact?: boolean }) {
    return (
        <div className={`flex flex-col items-center justify-center gap-2 px-6 ${compact ? "py-6" : "py-10"} text-center`}>
            <FiInbox className="text-[1.5rem] text-[var(--neutral-muted)]" aria-hidden="true" />
            <p className="analytics__subtitle text-[0.8125rem]">{message}</p>
        </div>
    );
}

