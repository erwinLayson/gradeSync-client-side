import { useEffect, useState } from "react";
import {
    FiAlertTriangle,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiClipboard,
    FiRefreshCw,
    FiSkipForward,
    FiUsers,
    FiX,
} from "react-icons/fi";

import { getAPICall, patchAPICall } from "../../api/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { getInitials } from "../../helper/initials";
import { toast } from "../../helper/toast";

import type { ClassRecordsResponse, SubmissionSummaryRow } from "../../constant/studentRecord";

import "../../style/adminStudentRecords.css";

// ================= Types =================

interface SchoolYear {
    id: number;
    startYear: string;
    endYear: string;
    isActive?: boolean | number;
}

interface AcademicSettingsData {
    id: number;
    currentQuarter: number;
    enrollmentOpen: boolean | number;
    submissionsLocked: boolean | number;
}

interface DrilldownState {
    row: SubmissionSummaryRow;
    quarter: number;
    data: ClassRecordsResponse | null;
}

// ================= Constants =================

const QUARTERS = [1, 2, 3, 4] as const;

// ================= Helpers =================

function formatSubmittedAt(iso: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Enrolled subjects without a grade — why a pending record can't be submitted (E2).
function missingGradeCount(data: ClassRecordsResponse, enrollmentId: number): number {
    const student = data.students.find((s) => s.enrollmentId === enrollmentId);
    if (!student) return 0;
    return student.subjects.filter((sg) => sg.enrolled && sg.grade === null).length;
}

// ================= Component =================

export default function AdminStudentRecords() {
    // ================= State =================
    const [loading, setLoading] = useState(true);
    const [years, setYears] = useState<SchoolYear[]>([]);
    const [selectedYearId, setSelectedYearId] = useState("");
    const [currentQuarter, setCurrentQuarter] = useState<number | null>(null);
    const [summary, setSummary] = useState<SubmissionSummaryRow[]>([]);

    // Drill-down modal: class + quarter -> roster with submission statuses.
    const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
    const [drilldownLoading, setDrilldownLoading] = useState(false);

    // Advance quarter state.
    const [confirmAdvance, setConfirmAdvance] = useState(false);
    const [advancing, setAdvancing] = useState(false);

    // ================= Load school years + current quarter =================
    useEffect(() => {
        let cancelled = false;

        async function loadContext() {
            try {
                const [yearsResponse, settingsResponse] = await Promise.all([
                    getAPICall<SchoolYear[]>("/schoolYear", { toast: false }),
                    getAPICall<AcademicSettingsData>("/academic-settings", { toast: false }),
                ]);
                if (cancelled) return;

                const yearsData = yearsResponse.data ?? [];
                setYears(yearsData);
                const active = yearsData.find((sy) => Boolean(sy.isActive));
                const initialId = active ? String(active.id) : yearsData[0] ? String(yearsData[0].id) : "";
                setSelectedYearId(initialId);

                const settings = settingsResponse.data;
                if (settings) {
                    setCurrentQuarter(Number(settings.currentQuarter));
                }
            } catch {
                // Error toast is handled by the API interceptor
            }
        }

        loadContext();
        return () => {
            cancelled = true;
        };
    }, []);

    // ================= Load summary for the selected year =================
    useEffect(() => {
        if (!selectedYearId) return;
        let cancelled = false;

        async function loadSummary() {
            try {
                const response = await getAPICall<SubmissionSummaryRow[]>(
                    `/student-records/summary?schoolYearId=${selectedYearId}`,
                    { toast: false },
                );
                if (cancelled) return;
                setSummary(response.data ?? []);
            } catch {
                if (!cancelled) setSummary([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadSummary();
        return () => {
            cancelled = true;
        };
    }, [selectedYearId]);

    function handleYearChange(yearId: string) {
        if (yearId === selectedYearId) return;
        setLoading(true);
        setSelectedYearId(yearId);
    }

    const selectedYear = years.find((sy) => String(sy.id) === selectedYearId) ?? null;

    // ================= Advance quarter =================
    const canAdvance = (() => {
        if (currentQuarter === null || currentQuarter >= 4) return false;
        return summary.every((row) => {
            if (!row.adviserId) return false;
            if (row.totalStudents === 0) return true;
            const submitted = row.submitted[currentQuarter] ?? 0;
            return submitted >= row.totalStudents;
        });
    })();

    async function handleAdvanceQuarter() {
        if (currentQuarter === null || currentQuarter >= 4 || advancing) return;
        setAdvancing(true);
        try {
            const nextQuarter = currentQuarter + 1;
            await patchAPICall("/academic-settings", {
                currentQuarter: nextQuarter,
            });
            setCurrentQuarter(nextQuarter);
            toast.success(`Quarter advanced to Q${nextQuarter}`);
            setConfirmAdvance(false);
        } catch {
            // Error toast handled by API interceptor (409 if records incomplete)
        } finally {
            setAdvancing(false);
        }
    }

    // ================= Drill-down =================
    async function openDrilldown(row: SubmissionSummaryRow, quarter: number) {
        setDrilldown({ row, quarter, data: null });
        setDrilldownLoading(true);
        try {
            const response = await getAPICall<ClassRecordsResponse>(
                `/student-records/class/${row.classId}?quarter=${quarter}`,
                { toast: false },
            );
            setDrilldown((prev) =>
                prev && prev.row.classId === row.classId && prev.quarter === quarter
                    ? { ...prev, data: response.data ?? null }
                    : prev,
            );
        } catch {
            // Error toast is handled by the API interceptor
        } finally {
            setDrilldownLoading(false);
        }
    }

    // ================= Row status (drives the enforcement story) =================
    function rowStatus(row: SubmissionSummaryRow): { label: string; tone: "ok" | "blocked" | "warn" | "muted" } {
        if (!row.adviserId) {
            return { label: "No adviser — blocks advance", tone: "blocked" };
        }
        if (currentQuarter !== null && row.totalStudents > 0) {
            const submitted = row.submitted[currentQuarter] ?? 0;
            if (submitted < row.totalStudents) {
                return { label: "Incomplete — blocks advance", tone: "blocked" };
            }
            return { label: "Complete", tone: "ok" };
        }
        return { label: "No students", tone: "muted" };
    }

    // ================= Loading =================
    if (loading) {
        return (
            <section className="tracker flex flex-col gap-5" aria-busy="true" aria-label="Loading submission tracker">
                <div className="tracker__loading flex min-h-[60vh] w-full items-center justify-center">
                    <FiClipboard className="animate-spin text-4xl text-gray-500" aria-hidden="true" />
                </div>
            </section>
        );
    }

    return (
        <section className="tracker flex flex-col gap-5">
            {/* ==================== Hero banner ==================== */}
            <div className="tracker__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="tracker__hero-main flex min-w-0 items-center gap-4">
                    <span className="tracker__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl" aria-hidden="true">
                        <FiClipboard />
                    </span>
                    <div className="tracker__hero-heading min-w-0">
                        <span className="tracker__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Quarter {currentQuarter ?? "—"} in progress
                        </span>
                        <h2 className="tracker__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            Submission Tracker
                        </h2>
                        <p className="tracker__hero-role mt-0.5 truncate text-[0.8125rem]">
                            Which classes have submitted their student records for each quarter.
                        </p>
                    </div>
                </div>
                <div className="tracker__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="tracker__hero-badge-count text-[1.375rem] font-bold leading-none">
                        {selectedYear ? `SY ${selectedYear.startYear}–${selectedYear.endYear}` : "SY —"}
                    </span>
                    <span className="tracker__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        School Year
                    </span>
                </div>
            </div>

            {/* ==================== Toolbar ==================== */}
            <div className="tracker__toolbar flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="tracker__toolbar-heading min-w-0">
                    <h3 className="tracker__toolbar-title text-[0.9375rem] font-bold">Class submission matrix</h3>
                    <p className="tracker__toolbar-subtitle mt-0.5 text-[0.8125rem]">
                        Click any quarter cell to see which students still need to be submitted.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="tracker__year flex items-center gap-2 rounded-lg border px-3 py-2 text-[0.8125rem] font-semibold">
                        <FiCalendar className="tracker__year-icon" aria-hidden="true" />
                        <span className="tracker__year-label">School Year</span>
                        <select
                            className="tracker__year-select cursor-pointer bg-transparent font-semibold outline-none"
                            value={selectedYearId}
                            onChange={(event) => handleYearChange(event.target.value)}
                            aria-label="Select school year"
                        >
                            {years.map((sy) => (
                                <option key={sy.id} value={sy.id}>
                                    SY {sy.startYear}–{sy.endYear}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        className="settings__btn inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-bold disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canAdvance || advancing}
                        onClick={() => setConfirmAdvance(true)}
                        title={!canAdvance ? (currentQuarter === null || currentQuarter >= 4 ? "Quarter 4 is the final quarter" : "Not all classes have completed submission for the current quarter") : "Advance to the next quarter"}
                    >
                        {advancing ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSkipForward aria-hidden="true" />}
                        {advancing ? "Advancing…" : `Advance to Q${(currentQuarter ?? 0) + 1}`}
                    </button>
                </div>
            </div>

            {/* ==================== Matrix ==================== */}
            <div className="tracker__card overflow-hidden rounded-2xl bg-white shadow-sm">
                {summary.length === 0 ? (
                    <div className="tracker__empty flex flex-col items-center justify-center px-6 py-20 text-center">
                        <span className="tracker__empty-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" aria-hidden="true">
                            <FiUsers />
                        </span>
                        <h3 className="tracker__empty-title mt-4 text-base font-bold">No classes yet</h3>
                        <p className="tracker__empty-text mt-1 max-w-md text-[0.8125rem] leading-relaxed">
                            No classes have students enrolled for this school year. The tracker will fill in as
                            enrollments and adviser assignments are made.
                        </p>
                    </div>
                ) : (
                    <div className="tracker__table-wrap overflow-x-auto">
                        <table className="tracker__table w-full min-w-[64rem] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Class
                                    </th>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Adviser
                                    </th>
                                    <th className="px-3 py-3 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Students
                                    </th>
                                    {QUARTERS.map((q) => (
                                        <th key={q} className="px-3 py-3 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                            <span className="inline-flex items-center gap-1.5">
                                                Q{q}
                                                {currentQuarter === q && (
                                                    <span className="tracker__current-chip inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-[0.06em]">
                                                        Current
                                                    </span>
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.map((row) => {
                                    const status = rowStatus(row);
                                    return (
                                        <tr key={row.classId}>
                                            <td className="tracker__cell--class px-4 py-3.5">
                                                <div className="tracker__class-cell flex items-center gap-3">
                                                    <span className="tracker__class-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold" aria-hidden="true">
                                                        G{row.gradeLevel}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="tracker__class-name truncate text-[0.8125rem] font-bold">
                                                            {row.section}
                                                        </p>
                                                        <p className="tracker__class-meta mt-0.5 text-[0.6875rem]">
                                                            Grade {row.gradeLevel}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {row.adviserFullname ? (
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <span className="tracker__adviser-avatar inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold uppercase" aria-hidden="true">
                                                            {getInitials(row.adviserFullname)}
                                                        </span>
                                                        <span className="tracker__adviser-name truncate text-[0.8125rem] font-semibold">
                                                            {row.adviserFullname}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="tracker__no-adviser inline-flex items-center gap-1 text-[0.6875rem] font-bold">
                                                        <FiAlertTriangle aria-hidden="true" />
                                                        No adviser
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3.5 text-center font-mono text-[0.8125rem] font-bold">
                                                {row.totalStudents}
                                            </td>

                                            {QUARTERS.map((q) => {
                                                const count = row.submitted[q] ?? 0;
                                                const complete = row.totalStudents > 0 && count >= row.totalStudents;
                                                const hasAny = count > 0;
                                                return (
                                                    <td key={q} className="px-3 py-3.5 text-center">
                                                        <button
                                                            type="button"
                                                            className={`tracker__quarter inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-[0.75rem] font-bold${
                                                                complete
                                                                    ? " tracker__quarter--complete"
                                                                    : hasAny
                                                                      ? " tracker__quarter--partial"
                                                                      : " tracker__quarter--none"
                                                            }`}
                                                            title={
                                                                complete
                                                                    ? `All ${row.totalStudents} students submitted for Q${q}`
                                                                    : hasAny
                                                                      ? `${count} of ${row.totalStudents} submitted for Q${q} — click to view`
                                                                      : `No submissions for Q${q} — click to view`
                                                            }
                                                            onClick={() => openDrilldown(row, q)}
                                                        >
                                                            {complete && <FiCheckCircle aria-hidden="true" />}
                                                            {count}/{row.totalStudents}
                                                        </button>
                                                    </td>
                                                );
                                            })}

                                            <td className="px-3 py-3.5">
                                                <span className={`tracker__status tracker__status--${status.tone} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold`}>
                                                    {status.tone === "ok" ? (
                                                        <FiCheckCircle aria-hidden="true" />
                                                    ) : status.tone === "blocked" ? (
                                                        <FiAlertTriangle aria-hidden="true" />
                                                    ) : (
                                                        <FiClock aria-hidden="true" />
                                                    )}
                                                    {status.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="tracker__card-foot flex flex-wrap items-center justify-between gap-3 p-5">
                    <p className="tracker__foot-note flex items-center gap-2 text-[0.8125rem]">
                        <FiAlertTriangle className="tracker__foot-warn" aria-hidden="true" />
                        The administrator can lock grade submissions from the Settings page to prevent teachers from
                        submitting student records.
                    </p>
                </div>
            </div>

            {/* ==================== Drill-down modal ==================== */}
            {drilldown && (
                <div
                    className="tracker__modal fixed inset-0 z-[1000] grid place-items-center p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tracker-modal-title"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setDrilldown(null);
                    }}
                >
                    <div className="tracker__modal-panel w-full max-w-[40rem] overflow-y-auto rounded-3xl bg-white shadow-xl">
                        <header className="tracker__modal-header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="tracker__modal-heading min-w-0">
                                <span className="tracker__modal-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                    {drilldown.row.section} &middot; Quarter {drilldown.quarter}
                                </span>
                                <h3 id="tracker-modal-title" className="tracker__modal-title mt-0.5 truncate text-xl font-bold">
                                    Submission status
                                </h3>
                                <p className="tracker__modal-subtitle mt-1 truncate text-[0.8125rem]">
                                    Grade {drilldown.row.gradeLevel} &middot; adviser:{" "}
                                    {drilldown.row.adviserFullname ?? "none assigned"}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="tracker__modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                                onClick={() => setDrilldown(null)}
                                aria-label="Close modal"
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <div className="p-6 pt-0">
                            {drilldownLoading ? (
                                <div className="flex min-h-[12rem] items-center justify-center">
                                    <FiRefreshCw className="animate-spin text-2xl text-gray-400" aria-hidden="true" />
                                </div>
                            ) : drilldown.data ? (
                                drilldown.data.students.length === 0 ? (
                                    <div className="tracker__modal-empty py-10 text-center text-[0.8125rem]">
                                        No students enrolled in this class for this quarter.
                                    </div>
                                ) : (
                                    <div className="tracker__modal-table-wrap overflow-x-auto rounded-xl border">
                                        <table className="tracker__modal-table w-full border-collapse text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                        Student
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                        Status
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                        Submitted
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {drilldown.data.students.map((student) => {
                                                    const isSubmitted = student.status === "submitted";
                                                    const missing = missingGradeCount(drilldown.data!, student.enrollmentId);
                                                    return (
                                                        <tr key={student.enrollmentId}>
                                                            <td className="tracker__cell--student px-4 py-2.5">
                                                                <div className="flex min-w-0 items-center gap-2.5">
                                                                    <span className="tracker__modal-avatar inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[0.625rem] font-bold uppercase" aria-hidden="true">
                                                                        {getInitials(student.fullname)}
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-[0.8125rem] font-bold">
                                                                            {student.fullname}
                                                                        </p>
                                                                        <p className="font-mono text-[0.6875rem] text-gray-500">
                                                                            LRN {student.studentLrn}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                {isSubmitted ? (
                                                                    <span className="tracker__modal-status tracker__modal-status--submitted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold">
                                                                        <FiCheckCircle aria-hidden="true" />
                                                                        Submitted
                                                                    </span>
                                                                ) : (
                                                                    <span
                                                                        className="tracker__modal-status tracker__modal-status--pending inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold"
                                                                        title={missing > 0 ? `${missing} subject(s) still ungraded` : undefined}
                                                                    >
                                                                        <FiClock aria-hidden="true" />
                                                                        Pending
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-[0.75rem]">
                                                                {isSubmitted
                                                                    ? (formatSubmittedAt(student.submittedAt) ?? "—")
                                                                    : missing > 0
                                                                      ? `${missing} subject(s) ungraded`
                                                                      : "—"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : (
                                <div className="tracker__modal-empty py-10 text-center text-[0.8125rem]">
                                    Could not load this class&apos;s records.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== Advance quarter confirm ==================== */}
            <ConfirmDialog
                open={confirmAdvance}
                title={`Advance to Quarter ${(currentQuarter ?? 0) + 1}?`
                }
                description={`This will change the active quarter from Q${currentQuarter} to Q${(currentQuarter ?? 0) + 1}. Teachers will then be able to submit records for the new quarter. This action cannot be undone from this page.`}
                confirmLabel={advancing ? "Advancing…" : "Advance Quarter"}
                confirmIcon={advancing ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSkipForward aria-hidden="true" />}
                tone="primary"
                pending={advancing}
                onConfirm={handleAdvanceQuarter}
                onClose={() => setConfirmAdvance(false)}
            />
        </section>
    );
}
