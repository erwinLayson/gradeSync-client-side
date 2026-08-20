import { useEffect, useState } from "react";
import {
    FiAlertTriangle,
    FiCheckCircle,
    FiClock,
    FiFileText,
    FiLock,
    FiRefreshCw,
    FiSend,
    FiShield,
    FiUsers,
    FiX,
} from "react-icons/fi";

import { getAPICall, postAPICall } from "../../api/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { getInitials } from "../../helper/initials";
import { toast } from "../../helper/toast";

import type {
    ClassRecordsResponse,
    StudentClassRecordRow,
    SubmitAllResult,
} from "../../constant/studentRecord";

import "../../style/teacherStudentRecords.css";

// ================= Constants =================

const QUARTERS = [1, 2, 3, 4] as const;

// ================= Helpers =================

// E8: frozen/computed grades are stored exactly, but displayed as whole numbers
// (matching the printed DepEd form).
function formatGrade(grade: number | null): string {
    return grade === null ? "—" : String(Math.round(grade));
}

function formatSubmittedAt(iso: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ================= Component =================

export default function TeacherStudentRecords() {
    // ================= State =================
    const [loading, setLoading] = useState(true);
    const [quarter, setQuarter] = useState<number>(1);
    const [records, setRecords] = useState<ClassRecordsResponse | null>(null);
    // Records could not be loaded (e.g. this teacher is not a class adviser).
    const [loadFailed, setLoadFailed] = useState(false);
    const [submissionsLocked, setSubmissionsLocked] = useState(false);

    // Review modal: the student whose record is being reviewed before freezing.
    const [reviewing, setReviewing] = useState<StudentClassRecordRow | null>(null);
    // Which per-student submit is in flight (disables that row's button).
    const [submittingEnrollmentId, setSubmittingEnrollmentId] = useState<number | null>(null);
    // Bulk submit state.
    const [confirmSubmitAll, setConfirmSubmitAll] = useState(false);
    const [submittingAll, setSubmittingAll] = useState(false);
    // Reopen confirm target.
    const [reopenTarget, setReopenTarget] = useState<StudentClassRecordRow | null>(null);
    const [reopening, setReopening] = useState(false);

    // ================= Fetch =================
    // No synchronous setState in the pre-await path, so calling this from the
    // mount/quarter effect does not trigger cascading renders.
    async function fetchRecords(targetQuarter: number) {
        try {
            const response = await getAPICall<ClassRecordsResponse>(
                `/student-records/my-class?quarter=${targetQuarter}`,
            );
            setRecords(response.data ?? null);
            setLoadFailed(false);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        // fetchRecords is recreated every render; quarter is the only input
        // that should trigger a refetch.
        fetchRecords(quarter).catch(() => {
            // The API interceptor already toasts the error (e.g. "You are not
            // assigned as a class adviser").
            setRecords(null);
            setLoadFailed(true);
        });
    }, [quarter]);

    // Load academic settings to check if submissions are locked.
    useEffect(() => {
        let cancelled = false;
        async function loadAcademicSettings() {
            try {
                const response = await getAPICall<{ submissionsLocked: boolean | number }>(
                    "/academic-settings",
                    { toast: false },
                );
                if (!cancelled && response.data) {
                    setSubmissionsLocked(Boolean(response.data.submissionsLocked));
                }
            } catch {
                // Non-critical — default to unlocked if request fails.
            }
        }
        loadAcademicSettings();
        return () => { cancelled = true; };
    }, []);

    function handleQuarterChange(targetQuarter: number) {
        if (targetQuarter === quarter) return;
        setLoading(true);
        setLoadFailed(false);
        setQuarter(targetQuarter);
    }

    // ================= Derived =================
    const classId = records?.classId ?? null;
    const progress = records?.progress ?? { total: 0, submitted: 0, pending: 0 };
    const progressPercent = progress.total === 0 ? 0 : Math.round((progress.submitted / progress.total) * 100);

    // ================= Per-student submit =================
    async function handleSubmitOne(student: StudentClassRecordRow) {
        if (!classId || submittingEnrollmentId !== null) return;
        setSubmittingEnrollmentId(student.enrollmentId);
        try {
            await postAPICall(
                `/student-records/class/${classId}/students/${student.enrollmentId}/quarter/${quarter}/submit`,
                {},
            );
            setReviewing(null);
            await fetchRecords(quarter);
        } finally {
            setSubmittingEnrollmentId(null);
        }
    }

    // ================= Submit all pending =================
    async function handleSubmitAll() {
        if (!classId || submittingAll) return;
        setSubmittingAll(true);
        try {
            const response = await postAPICall<unknown, SubmitAllResult>(
                `/student-records/class/${classId}/quarter/${quarter}/submit-all`,
                {},
                { toast: false },
            );
            const result = response.data;
            if (result) {
                if (result.blocked.length > 0) {
                    const names = result.blocked.map((b) => b.fullname).join(", ");
                    toast.warning(
                        `${result.submitted} submitted — ${result.blocked.length} blocked (missing grades): ${names}`,
                    );
                } else if (result.submitted === 0 && result.alreadySubmitted > 0) {
                    toast.info("All student records are already submitted for this quarter.");
                } else {
                    toast.success(`${result.submitted} student record${result.submitted === 1 ? "" : "s"} submitted.`);
                }
            }
            setConfirmSubmitAll(false);
            await fetchRecords(quarter);
        } finally {
            setSubmittingAll(false);
        }
    }

    // ================= Reopen =================
    async function handleReopen() {
        if (!classId || !reopenTarget || reopening) return;
        setReopening(true);
        try {
            await postAPICall(
                `/student-records/class/${classId}/students/${reopenTarget.enrollmentId}/quarter/${quarter}/reopen`,
                {},
            );
            setReopenTarget(null);
            await fetchRecords(quarter);
        } finally {
            setReopening(false);
        }
    }

    // Subjects a student is missing a grade for (blocks submission — E2).
    function missingSubjectsFor(student: StudentClassRecordRow): string[] {
        if (!records) return [];
        const missing: string[] = [];
        for (const subjectGrade of student.subjects) {
            if (subjectGrade.enrolled && subjectGrade.grade === null) {
                const subject = records.subjects.find((s) => s.subjectId === subjectGrade.subjectId);
                missing.push(subject?.subjectName ?? `Subject #${subjectGrade.subjectId}`);
            }
        }
        return missing;
    }

    // ================= Loading =================
    if (loading) {
        return (
            <section className="teacher-records flex flex-col gap-5" aria-busy="true" aria-label="Loading student records">
                <div className="teacher-records__loading flex min-h-[60vh] w-full items-center justify-center">
                    <FiUsers className="animate-spin text-4xl text-gray-500" aria-hidden="true" />
                </div>
            </section>
        );
    }

    // ================= Not an adviser / no data =================
    if (loadFailed || !records) {
        return (
            <section className="teacher-records flex flex-col gap-5">
                <div className="teacher-records__empty flex flex-col items-center justify-center rounded-2xl border bg-white px-6 py-20 text-center shadow-sm">
                    <span className="teacher-records__empty-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" aria-hidden="true">
                        <FiFileText />
                    </span>
                    <h2 className="teacher-records__empty-title mt-4 text-base font-bold">
                        No advised class found
                    </h2>
                    <p className="teacher-records__empty-text mt-1 max-w-md text-[0.8125rem] leading-relaxed">
                        You are not assigned as a class adviser yet. Once the administrator assigns you to a
                        class, its student records will appear here for quarterly submission.
                    </p>
                </div>
            </section>
        );
    }

    // ================= Main =================
    return (
        <section className="teacher-records flex flex-col gap-5">
            {/* ==================== Hero banner ==================== */}
            <div className="teacher-records__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="teacher-records__hero-main flex min-w-0 items-center gap-4">
                    <span className="teacher-records__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl" aria-hidden="true">
                        <FiFileText />
                    </span>
                    <div className="teacher-records__hero-heading min-w-0">
                        <span className="teacher-records__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Class Adviser &middot; Grade {records.gradeLevel}
                        </span>
                        <h2 className="teacher-records__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            {records.section}
                        </h2>
                        <p className="teacher-records__hero-role mt-0.5 truncate text-[0.8125rem]">
                            {records.adviserFullname ?? "No adviser assigned"}
                        </p>
                    </div>
                </div>
                <div className="teacher-records__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="teacher-records__hero-badge-count text-[1.375rem] font-bold leading-none">
                        Q{quarter}
                    </span>
                    <span className="teacher-records__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        Quarter
                    </span>
                </div>
            </div>

            {/* ==================== Submissions locked banner ==================== */}
            {submissionsLocked && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <FiShield className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="text-[0.8125rem] font-bold text-amber-800">Grade submissions are locked</p>
                        <p className="mt-0.5 text-[0.75rem] leading-relaxed text-amber-700">
                            The administrator has locked grade submissions. You cannot submit or reopen student records until submissions are unlocked.
                        </p>
                    </div>
                </div>
            )}

            {/* ==================== Quarter tabs + submit all ==================== */}
            <div className="teacher-records__toolbar flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="teacher-records__tabs flex items-center gap-1.5" role="tablist" aria-label="Select quarter">
                    {QUARTERS.map((q) => (
                        <button
                            key={q}
                            type="button"
                            role="tab"
                            aria-selected={quarter === q}
                            aria-label={`Quarter ${q}`}
                            className={`teacher-records__tab inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-[0.8125rem] font-bold transition-colors${
                                quarter === q ? " teacher-records__tab--active" : ""
                            }`}
                            onClick={() => handleQuarterChange(q)}
                        >
                            Quarter {q}
                        </button>
                    ))}
                </div>
                <div className="teacher-records__toolbar-actions flex items-center gap-2">
                    <button
                        type="button"
                        className="teacher-records__submit-all inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-bold"
                        disabled={progress.pending === 0 || submittingAll || submissionsLocked}
                        onClick={() => setConfirmSubmitAll(true)}
                    >
                        {submittingAll ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSend aria-hidden="true" />}
                        {submittingAll ? "Submitting…" : "Submit All Pending"}
                    </button>
                </div>
            </div>

            {/* ==================== Progress banner ==================== */}
            <div className="teacher-records__progress flex flex-col gap-3 rounded-xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="teacher-records__progress-heading min-w-0">
                        <h3 className="teacher-records__progress-title text-[0.9375rem] font-bold">
                            Quarter {quarter} submission progress
                        </h3>
                        <p className="teacher-records__progress-subtitle mt-1 text-[0.8125rem]">
                            {progress.submitted} of {progress.total} students submitted &middot;{" "}
                            {progress.pending} pending
                        </p>
                    </div>
                    <span className="teacher-records__progress-pct inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold">
                        {progressPercent}%
                    </span>
                </div>
                <div
                    className="teacher-records__progress-track h-2.5 w-full overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={progress.submitted}
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-label="Submitted student records"
                >
                    <div
                        className="teacher-records__progress-bar h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* ==================== Roster table ==================== */}
            <div className="teacher-records__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="teacher-records__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="teacher-records__card-heading min-w-0">
                        <h3 className="teacher-records__card-title text-base font-bold">Student Records</h3>
                        <p className="teacher-records__card-subtitle mt-1 text-[0.8125rem]">
                            {records.students.length} students &middot; grades are{" "}
                            <strong>frozen on submit</strong> — teacher score edits after submission won't change them
                        </p>
                    </div>
                </div>

                {records.students.length === 0 ? (
                    <div className="teacher-records__empty flex flex-col items-center justify-center px-6 py-16 text-center">
                        <span className="teacher-records__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiUsers />
                        </span>
                        <p className="teacher-records__empty-title mt-3 text-sm font-bold">No students enrolled</p>
                        <p className="teacher-records__empty-text mt-1 text-[0.8125rem]">
                            Students will appear here once they are enrolled in this class.
                        </p>
                    </div>
                ) : (
                    <div className="teacher-records__table-wrap overflow-x-auto">
                        <table className="teacher-records__table w-full min-w-[62rem] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Student
                                    </th>
                                    {records.subjects.map((subject) => (
                                        <th
                                            key={subject.classSubjectId}
                                            className="px-3 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]"
                                        >
                                            <div className="teacher-records__subject-cell flex min-w-[7rem] flex-col gap-1">
                                                <span className="teacher-records__subject-name truncate text-[0.6875rem] font-bold uppercase tracking-[0.06em]">
                                                    {subject.subjectName}
                                                </span>
                                                <span className="teacher-records__subject-code font-mono text-[0.625rem]">
                                                    {subject.subjectCode}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Status
                                    </th>
                                    <th className="px-3 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.students.map((student) => {
                                    const isSubmitted = student.status === "submitted";
                                    const isBusy = submittingEnrollmentId === student.enrollmentId;
                                    return (
                                        <tr key={student.enrollmentId}>
                                            <td className="teacher-records__cell--student px-4 py-3.5">
                                                <div className="teacher-records__student-cell flex items-center gap-3">
                                                    <span className="teacher-records__student-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold uppercase" aria-hidden="true">
                                                        {getInitials(student.fullname)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="teacher-records__student-name truncate text-[0.8125rem] font-bold">
                                                            {student.fullname}
                                                        </p>
                                                        <p className="teacher-records__student-meta mt-0.5 font-mono text-[0.6875rem]">
                                                            LRN {student.studentLrn} &middot; {student.studentSex}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {records.subjects.map((subject) => {
                                                const subjectGrade = student.subjects.find(
                                                    (sg) => sg.subjectId === subject.subjectId,
                                                );
                                                if (!subjectGrade || !subjectGrade.enrolled) {
                                                    return (
                                                        <td key={subject.subjectId} className="px-3 py-3.5 text-center">
                                                            <span
                                                                className="teacher-records__grade teacher-records__grade--off"
                                                                title="Not enrolled in this subject"
                                                            >
                                                                —
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                const isFrozen = subjectGrade.source === "frozen";
                                                const hasGrade = subjectGrade.grade !== null;
                                                return (
                                                    <td key={subject.subjectId} className="px-3 py-3.5 text-center">
                                                        <span
                                                            className={`teacher-records__grade teacher-records__grade--${isFrozen ? "frozen" : hasGrade ? "live" : "missing"}`}
                                                            title={
                                                                isFrozen
                                                                    ? `Frozen on ${formatSubmittedAt(student.submittedAt) ?? "submission"}`
                                                                    : hasGrade
                                                                      ? "Live — recalculated from current scores"
                                                                      : "No grade yet — blocks submission"
                                                            }
                                                        >
                                                            {isFrozen && <FiLock className="teacher-records__grade-lock" aria-hidden="true" />}
                                                            {formatGrade(subjectGrade.grade)}
                                                        </span>
                                                    </td>
                                                );
                                            })}

                                            <td className="px-3 py-3.5">
                                                {isSubmitted ? (
                                                    <span className="teacher-records__status teacher-records__status--submitted inline-flex flex-col items-start gap-0.5">
                                                        <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold">
                                                            <FiCheckCircle aria-hidden="true" />
                                                            Submitted
                                                        </span>
                                                        {formatSubmittedAt(student.submittedAt) && (
                                                            <span className="text-[0.625rem] opacity-80">
                                                                {formatSubmittedAt(student.submittedAt)}
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="teacher-records__status teacher-records__status--pending inline-flex items-center gap-1 text-[0.6875rem] font-bold">
                                                        <FiClock aria-hidden="true" />
                                                        Pending
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3.5 text-right">
                                                {isSubmitted ? (
                                                    <button
                                                        type="button"
                                                        className="teacher-records__reopen inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.6875rem] font-bold"
                                                        disabled={submissionsLocked}
                                                        onClick={() => setReopenTarget(student)}
                                                    >
                                                        <FiRefreshCw aria-hidden="true" />
                                                        Reopen
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="teacher-records__review inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.6875rem] font-bold"
                                                        disabled={isBusy || submissionsLocked}
                                                        onClick={() => setReviewing(student)}
                                                    >
                                                        {isBusy ? (
                                                            <FiRefreshCw className="animate-spin" aria-hidden="true" />
                                                        ) : (
                                                            <FiSend aria-hidden="true" />
                                                        )}
                                                        {isBusy ? "Submitting…" : "Review & Submit"}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="teacher-records__card-foot flex flex-wrap items-center justify-between gap-3 p-5">
                    <p className="teacher-records__foot-note flex items-center gap-2 text-[0.8125rem]">
                        <FiLock aria-hidden="true" />
                        Submitted records are snapshots — reopen to unlock, then submit again to re-freeze.
                    </p>
                </div>
            </div>

            {/* ==================== Review modal ==================== */}
            {reviewing && (
                <div
                    className="teacher-records__modal fixed inset-0 z-[1000] grid place-items-center p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="teacher-records-modal-title"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setReviewing(null);
                    }}
                >
                    <div className="teacher-records__modal-panel w-full max-w-[36rem] overflow-y-auto rounded-3xl bg-white shadow-xl">
                        <header className="teacher-records__modal-header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="teacher-records__modal-heading min-w-0">
                                <span className="teacher-records__modal-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                    Review before freezing &middot; Quarter {quarter}
                                </span>
                                <h3 id="teacher-records-modal-title" className="teacher-records__modal-title mt-0.5 truncate text-xl font-bold">
                                    {reviewing.fullname}
                                </h3>
                                <p className="teacher-records__modal-subtitle mt-1 truncate font-mono text-[0.8125rem]">
                                    LRN {reviewing.studentLrn} &middot; {reviewing.studentSex}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="teacher-records__modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                                onClick={() => setReviewing(null)}
                                aria-label="Close modal"
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <div className="p-6 pt-0">
                            <div className="teacher-records__review-table-wrap overflow-x-auto rounded-xl border">
                                <table className="teacher-records__review-table w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                Subject
                                            </th>
                                            <th className="px-4 py-2.5 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                Grade
                                            </th>
                                            <th className="px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                Source
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {records.subjects.map((subject) => {
                                            const subjectGrade = reviewing.subjects.find(
                                                (sg) => sg.subjectId === subject.subjectId,
                                            );
                                            if (!subjectGrade || !subjectGrade.enrolled) return null;
                                            const isFrozen = subjectGrade.source === "frozen";
                                            return (
                                                <tr key={subject.subjectId}>
                                                    <td className="px-4 py-2.5 text-[0.8125rem] font-bold">
                                                        {subject.subjectName}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <span
                                                            className={`teacher-records__review-grade inline-flex items-center justify-center rounded-lg px-2 py-1 font-mono text-[0.8125rem] font-bold${
                                                                subjectGrade.grade === null
                                                                    ? " teacher-records__review-grade--missing"
                                                                    : isFrozen
                                                                      ? " teacher-records__review-grade--frozen"
                                                                      : ""
                                                            }`}
                                                        >
                                                            {formatGrade(subjectGrade.grade)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-[0.6875rem]">
                                                        {isFrozen
                                                            ? "Frozen (submitted)"
                                                            : subjectGrade.grade === null
                                                              ? "No grade yet"
                                                              : "Live (computed)"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {missingSubjectsFor(reviewing).length > 0 ? (
                                <div className="teacher-records__modal-warning mt-4 flex items-start gap-3 rounded-xl border p-4">
                                    <FiAlertTriangle className="teacher-records__modal-warning-icon mt-0.5 shrink-0" aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="text-[0.8125rem] font-bold">Cannot submit yet</p>
                                        <p className="mt-0.5 text-[0.75rem] leading-relaxed">
                                            No grade yet for: {missingSubjectsFor(reviewing).join(", ")}. The record
                                            is blocked until every enrolled subject has a grade (the adviser can't
                                            freeze an incomplete record).
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="teacher-records__modal-note mt-4 flex items-center gap-2 text-[0.75rem]">
                                    <FiLock aria-hidden="true" />
                                    Submitting freezes these grades as the official record for Quarter {quarter}.
                                    Later score edits by teachers won't change it — reopen to update.
                                </p>
                            )}

                            <div className="teacher-records__modal-footer mt-5 flex flex-wrap items-center justify-end gap-3 border-t pt-5">
                                <button
                                    type="button"
                                    className="teacher-records__form-cancel inline-flex cursor-pointer items-center rounded-lg border px-4 py-2.5 text-[0.8125rem] font-semibold"
                                    onClick={() => setReviewing(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="teacher-records__form-submit inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[0.8125rem] font-bold"
                                    disabled={missingSubjectsFor(reviewing).length > 0 || submittingEnrollmentId !== null}
                                    onClick={() => handleSubmitOne(reviewing)}
                                >
                                    {submittingEnrollmentId === reviewing.enrollmentId ? (
                                        <FiRefreshCw className="animate-spin" aria-hidden="true" />
                                    ) : (
                                        <FiLock aria-hidden="true" />
                                    )}
                                    {submittingEnrollmentId === reviewing.enrollmentId
                                        ? "Submitting…"
                                        : `Submit Record (Q${quarter})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== Submit-all confirm ==================== */}
            <ConfirmDialog
                open={confirmSubmitAll}
                title="Submit all pending records?"
                description={`Freeze the Quarter ${quarter} records for all ${progress.pending} pending student(s) in ${records.section}. Students without a grade in every enrolled subject will be skipped and reported.`}
                confirmLabel={submittingAll ? "Submitting…" : "Submit All"}
                confirmIcon={submittingAll ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : undefined}
                tone="primary"
                pending={submittingAll}
                onConfirm={handleSubmitAll}
                onClose={() => setConfirmSubmitAll(false)}
            />

            {/* ==================== Reopen confirm ==================== */}
            <ConfirmDialog
                open={reopenTarget !== null}
                title="Reopen this record?"
                description={`Unlock ${reopenTarget?.fullname ?? "this student"}'s Quarter ${quarter} record. The frozen grades will be replaced by live values, and you can submit again to re-freeze. The previous submission timestamp is kept for the audit trail.`}
                confirmLabel={reopening ? "Reopening…" : "Reopen"}
                confirmIcon={reopening ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : undefined}
                pending={reopening}
                onConfirm={handleReopen}
                onClose={() => setReopenTarget(null)}
            />
        </section>
    );
}
