import { useCallback, useEffect, useState } from "react";
import {
    FiAlertTriangle,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiRefreshCw,
    FiSkipForward,
    FiUsers,
    FiX,
} from "react-icons/fi";

import { getAPICall, patchAPICall } from "../../api/api";
// invalidateAcademicSettingsCache notifies every useAcademicSettings() consumer
// (this page included) that the stored quarter changed, so no mounted page keeps
// showing the previous quarter.
import { invalidateAcademicSettingsCache, useAcademicSettings } from "../../hooks/useAcademicSettings";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ModalDialog } from "../../components/ModalDialog";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
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
    numQuarters: number;
    enrollmentOpen: boolean | number;
    submissionsLocked: boolean | number;
}

interface DrilldownState {
    row: SubmissionSummaryRow;
    quarter: number;
    data: ClassRecordsResponse | null;
}

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
    // The quarter and its configured number of quarters come from the shared hook,
    // which already listens to `academic-settings-updated` and re-fetches on
    // login/logout. That keeps every mounted page — including the tracker — on the
    // same source of truth after an advancement, without the tracker ever claiming
    // eligibility for a stale quarter.
    const { numQuarters, quarters } = useAcademicSettings();

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

    // Manual refetch of the matrix for the selected year (used after a
    // successful quarter advance). The effect above owns the initial load.
    const refetchSummary = useCallback(async () => {
        if (!selectedYearId) return;
        try {
            const response = await getAPICall<SubmissionSummaryRow[]>(
                `/student-records/summary?schoolYearId=${selectedYearId}`,
                { toast: false },
            );
            setSummary(response.data ?? []);
        } catch {
            // Error toast is handled by the API interceptor
        }
    }, [selectedYearId]);

    // The active school year can be changed from Admin Settings in another tab
    // while this page is open. Re-read the year list whenever the window regains
    // focus so the Advance button never reflects a stale active year. The server
    // remains authoritative regardless — a stale request is rejected there.
    useEffect(() => {
        async function refreshYears() {
            try {
                const response = await getAPICall<SchoolYear[]>("/schoolYear", { toast: false });
                if (response.data) setYears(response.data);
            } catch {
                // Error toast is handled by the API interceptor
            }
        }

        const onFocus = () => {
            void refreshYears();
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    function handleYearChange(yearId: string) {
        if (yearId === selectedYearId) return;
        setLoading(true);
        setSelectedYearId(yearId);
    }

    const selectedYear = years.find((sy) => String(sy.id) === selectedYearId) ?? null;

    // ================= Advance quarter =================
    // The quarter itself is a single global setting — `academic_settings` has no
    // school-year column — and it is only advanceable when the server's active
    // school year is complete. The UI therefore:
    //   * shows the selected year's matrix (useful for follow-up work), but
    //   * calculates eligibility only for the active year, so it never displays a
    //     false "ready" state for a different year; and
    //   * forces the selector to the active year when the button is pressed, so the
    //     POST always validates against the year the server checks.
    const activeYear = years.find((sy) => Boolean(sy.isActive)) ?? null;

    // Eligibility uses the active year's matrix. Loading a different year only
    // changes the displayed matrix; it never produces a misleading eligibility
    // state for an operation the server would validate elsewhere.
    const activeYearSummary =
        activeYear && String(activeYear.id) === selectedYearId
            ? summary
            : years.find((sy) => String(sy.id) === selectedYearId && Boolean(sy.isActive))
              ? summary
              : [];

    // Blockers inside the year the server will actually validate. A year with zero
    // viewable classes is advanceable by definition — there is nothing to block.
    const classesWithoutAdviser = activeYearSummary.filter((row) => !row.adviserId);
    const incompleteClasses =
        currentQuarter === null
            ? []
            : activeYearSummary.filter(
                  (row) =>
                      row.adviserId &&
                      row.totalStudents > 0 &&
                      (row.submitted[currentQuarter] ?? 0) < row.totalStudents,
              );

    // EMPTY-CLASS POLICY (explicit, mirrors the server): a year with no eligible
    // classes has nothing blocking it, so it is advanceable. This is stated
    // rather than relying on `[].every()` returning true.
    const quarterComplete =
        activeYearSummary.length === 0 ||
        (classesWithoutAdviser.length === 0 && incompleteClasses.length === 0);

    const advanceBlockedReason =
        !activeYear
            ? "No active school year — activate one in Admin Settings before advancing."
            : currentQuarter === null
                ? "Loading the current quarter…"
                : currentQuarter >= numQuarters
                    ? `Quarter ${numQuarters} is the final quarter`
                    : !quarterComplete
                        ? "Not all classes have completed submission for the current quarter"
                        : null;

    const canAdvance = advanceBlockedReason === null;

    async function handleAdvanceQuarter() {
        // Force the selector to the active year so the POST body carries the year
        // the server will validate against. Without this, opening the tracker on a
        // different year and pressing Advance would submit a stale/incomplete
        // matrix and surface a confusing 409.
        if (activeYear && String(activeYear.id) !== selectedYearId) {
            setSelectedYearId(String(activeYear.id));
            // Wait for the matrix to refresh so the blockers above reflect the
            // active year, not a stale one.
            await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, 0);
                return () => clearTimeout(timer);
            });
        }

        if (currentQuarter === null || currentQuarter >= numQuarters || advancing) return;
        setAdvancing(true);
        try {
            const nextQuarter = currentQuarter + 1;
            await patchAPICall("/academic-settings", {
                currentQuarter: nextQuarter,
            });

            // Only touched AFTER the server confirmed the transition, so a
            // failure never leaves the page showing a quarter that was not saved.
            setCurrentQuarter(nextQuarter);
            // Invalidates the shared hook cache AND re-fetches it for every
            // consumer, so no mounted page keeps displaying the old quarter.
            invalidateAcademicSettingsCache();
            window.dispatchEvent(new Event("academic-settings-updated"));

            // Re-read the summary: a newly active quarter can change which cells
            // are complete, keeping the matrix consistent with the new quarter.
            refetchSummary();

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
            <PageShell className="tracker" busy label="Loading submission tracker">
                <PageSection flush>
                    <div className="tracker__loading p-6">
                        <Skeleton lines={6} gap="1rem" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    return (
        <PageShell className="tracker">
            {/* ==================== Header ==================== */}
            <PageHeader
                title="Submission Tracker"
                description="Which classes have submitted their student records for each quarter."
                meta={
                    <>
                        Quarter {currentQuarter ?? "—"}
                        {selectedYear ? ` · SY ${selectedYear.startYear}–${selectedYear.endYear}` : " · SY —"}
                    </>
                }
            />

            {/* Quarter advancement is validated against the ACTIVE school year, so
                name that year whenever it is not the one being viewed. */}
            {(!activeYear || !selectedYear || String(activeYear.id) !== String(selectedYear.id)) && (
                <div
                    className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                    role="status"
                >
                    <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>
                        <strong className="font-bold">Quarter advancement is unavailable here.</strong>{" "}
                        {activeYear
                            ? `The quarter is advanced for the active school year (SY ${activeYear.startYear}–${activeYear.endYear}), but you are
                          viewing ${selectedYear ? `SY ${selectedYear.startYear}–${selectedYear.endYear}` : "no school year"}.
                          Select the active year to advance it.`
                            : "No school year is active. Activate one in Admin Settings before advancing the quarter."}
                    </p>
                </div>
            )}

            {/* ==================== Toolbar ==================== */}
            <PageSection
                className="tracker__toolbar"
                title="Class submission matrix"
                description="Click any quarter cell to see which students still need to be submitted."
            >
                <div className="flex flex-wrap items-center gap-2">
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
                        title={advanceBlockedReason ?? "Advance to the next quarter"}
                    >
                        {advancing ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSkipForward aria-hidden="true" />}
                        {advancing ? "Advancing…" : `Advance to Q${(currentQuarter ?? 0) + 1}`}
                    </button>
                </div>
            </PageSection>

            {/* ==================== Matrix ==================== */}
            <PageSection className="tracker__card" flush>
                {summary.length === 0 ? (
                    <div className="tracker__empty flex flex-col items-center justify-center px-6 py-20 text-center">
                        <span
                            className="tracker__empty-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                            aria-hidden="true"
                        >
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
                                    {quarters.map((q) => (
                                        <th
                                            key={q}
                                            className="px-3 py-3 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em]"
                                        >
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
                                                    <span
                                                        className="tracker__class-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold"
                                                        aria-hidden="true"
                                                    >
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

                                            {quarters.map((q) => {
                                                const count = row.submitted[q] ?? 0;
                                                const complete = row.totalStudents > 0 && count >= row.totalStudents;
                                                const hasAny = count > 0;
                                                return (
                                                    <td key={q} className="px-3 py-3.5 text-center">
                                                        <button
                                                            type="button"
                                                            className={`tracker__quarter inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-[0.75rem] font-bold${complete
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
                                                <span
                                                    className={`tracker__status tracker__status--${status.tone} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold`}
                                                >
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
            </PageSection>

            {/* ==================== Drill-down modal ==================== */}
            <ModalDialog
                open={drilldown !== null}
                onClose={() => setDrilldown(null)}
                labelledById="tracker-modal-title"
                className="tracker__modal-panel w-full max-w-[40rem] overflow-y-auto rounded-2xl border border-[var(--neutral-border)] bg-white"
            >
                {drilldown && (
                    <>
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
                                                                    <span
                                                                        className="tracker__modal-status tracker__modal-status--submitted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold"
                                                                    >
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
                                                                    ? formatSubmittedAt(student.submittedAt) ?? "—"
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
                    </>
                )}
            </ModalDialog>

            {/* ==================== Advance quarter confirm ==================== */}
            <ConfirmDialog
                open={confirmAdvance}
                title={`Advance to Quarter ${(currentQuarter ?? 0) + 1}?`}
                description={`This will change the active quarter from Q${currentQuarter} to Q${(currentQuarter ?? 0) + 1}. Teachers will then be able to submit records for the new quarter. This action cannot be undone from this page.`}
                confirmLabel={advancing ? "Advancing…" : "Advance Quarter"}
                confirmIcon={advancing ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSkipForward aria-hidden="true" />}
                tone="primary"
                pending={advancing}
                onConfirm={handleAdvanceQuarter}
                onClose={() => setConfirmAdvance(false)}
            />
        </PageShell>
    );
}
