import { useEffect, useRef, useState } from "react";
import {
    FiBookOpen,
    FiCheckCircle,
    FiClock,
    FiEdit3,
    FiLock,
    FiRefreshCw,
    FiSend,
    FiShield,
    FiUnlock,
    FiUserCheck,
    FiUsers,
    FiX,
} from "react-icons/fi";

import { getAPICall, postAPICall } from "../../api/api";
import {
    getSubjectClassRecords,
    submitSubjectRecords,
    submitSingleStudentSubjectRecord,
} from "../../api/studentRecord";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ModalDialog } from "../../components/ModalDialog";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import { RequestAmendmentModal } from "../../components/RequestAmendmentModal";
import { AmendStudentRecordModal } from "../../components/AmendStudentRecordModal";
import Skeleton from "../../components/Skeleton";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import { useMyAmendments } from "../../hooks/useMyAmendments";
import { useTeacherSubjects } from "../../hooks/useTeacherSubjects";
import { formatGrade } from "../../helper/grades";
import { toast } from "../../helper/toast";

import type {
    ClassRecordsResponse,
    StudentClassRecordRow,
    SubjectClassRecordResponse,
    SubjectStudentRow,
} from "../../constant/studentRecord";

import "../../style/facultyStudentRecords.css";
// ================= Component =================

export default function FacultyStudentRecords() {
    // ================= State =================
    const { quarters, currentQuarter, loading: settingsLoading } = useAcademicSettings();
    const [quarter, setQuarter] = useState<number>(currentQuarter ?? 1);
    const prevCurrentQuarterRef = useRef<number>(currentQuarter ?? 1);
    const hasUserSelectedQuarterRef = useRef<boolean>(false);

    useEffect(() => {
        if (!settingsLoading && currentQuarter) {
            if (prevCurrentQuarterRef.current !== currentQuarter || !hasUserSelectedQuarterRef.current) {
                setQuarter(currentQuarter);
                prevCurrentQuarterRef.current = currentQuarter;
                hasUserSelectedQuarterRef.current = false;
            }
        }
    }, [currentQuarter, settingsLoading]);

    const [submissionsLocked, setSubmissionsLocked] = useState(false);

    // Subject Teacher Hook
    const {
        subjects,
        selectedSubjectId,
        selectedSubject,
        setSelectedSubjectId,
        loading: loadingSubjects,
        refetchSubjects
    } = useTeacherSubjects();

    // Active Subject Class Records State
    const [subjectRecords, setSubjectRecords] = useState<SubjectClassRecordResponse | null>(null);
    const [loadingSubjectRecords, setLoadingSubjectRecords] = useState(false);
    const [submittingSubjectEnrollmentId, setSubmittingSubjectEnrollmentId] = useState<number | null>(null);
    const [confirmSubmitAllSubject, setConfirmSubmitAllSubject] = useState(false);
    const [submittingAllSubject, setSubmittingAllSubject] = useState(false);
    const [amendmentSubjectStudent, setAmendmentSubjectStudent] = useState<SubjectStudentRow | null>(null);
    const [activeAmendStudent, setActiveAmendStudent] = useState<SubjectStudentRow | null>(null);

    // Class Adviser View State (for dual-role faculty)
    const [viewMode, setViewMode] = useState<"subjects" | "adviser">("subjects");
    const [loadingAdviser, setLoadingAdviser] = useState(true);
    const [adviserRecords, setAdviserRecords] = useState<ClassRecordsResponse | null>(null);
    const [isClassAdviser, setIsClassAdviser] = useState(false);

    // Adviser review modal & submit states
    const [reviewingAdviserStudent, setReviewingAdviserStudent] = useState<StudentClassRecordRow | null>(null);
    const reviewTriggerRef = useRef<HTMLButtonElement>(null);
    const [submittingAdviserEnrollmentId, setSubmittingAdviserEnrollmentId] = useState<number | null>(null);
    const [amendmentAdviserStudent, setAmendmentAdviserStudent] = useState<StudentClassRecordRow | null>(null);
    const { refresh: refreshAmendments } = useMyAmendments();

    // Load academic settings to check if submissions are locked.
    useEffect(() => {
        let cancelled = false;
        async function loadAcademicSettings() {
            try {
                const response = await getAPICall<{ submissionsLocked: boolean | number }>(
                    "/academic-settings",
                    { toast: false }
                );
                if (!cancelled && response.data) {
                    setSubmissionsLocked(Boolean(response.data.submissionsLocked));
                }
            } catch {
                // Non-critical — default to unlocked if request fails.
            }
        }
        loadAcademicSettings();
        return () => {
            cancelled = true;
        };
    }, []);

    // Check if faculty has an advised class (background check for tab display)
    useEffect(() => {
        let cancelled = false;
        async function checkAdvisedClass() {
            setLoadingAdviser(true);
            try {
                const response = await getAPICall<ClassRecordsResponse>(
                    `/student-records/my-class?quarter=${quarter}`,
                    { skipErrorToast: true, toast: false }
                );
                if (!cancelled && response.data && response.data.classId) {
                    setAdviserRecords(response.data);
                    setIsClassAdviser(true);
                } else if (!cancelled) {
                    setAdviserRecords(null);
                    setIsClassAdviser(false);
                }
            } catch {
                if (!cancelled) {
                    setAdviserRecords(null);
                    setIsClassAdviser(false);
                }
            } finally {
                if (!cancelled) setLoadingAdviser(false);
            }
        }
        checkAdvisedClass();
        return () => {
            cancelled = true;
        };
    }, [quarter]);

    // Set initial viewMode based on teacher assignments
    useEffect(() => {
        if (!loadingSubjects) {
            if (subjects.length > 0) {
                setViewMode("subjects");
            } else if (isClassAdviser) {
                setViewMode("adviser");
            }
        }
    }, [loadingSubjects, subjects.length, isClassAdviser]);

    // ================= Fetch Subject Records =================
    const fetchSubjectRecords = async (classSubjectId: number, targetQuarter: number) => {
        setLoadingSubjectRecords(true);
        try {
            const res = await getSubjectClassRecords(classSubjectId, targetQuarter);
            setSubjectRecords(res.data ?? null);
        } catch {
            setSubjectRecords(null);
        } finally {
            setLoadingSubjectRecords(false);
        }
    };

    useEffect(() => {
        if (selectedSubjectId) {
            fetchSubjectRecords(selectedSubjectId, quarter);
        } else {
            setSubjectRecords(null);
        }
    }, [selectedSubjectId, quarter]);

    // ================= Subject Record Actions =================
    const handleSubmitOneSubject = async (student: SubjectStudentRow) => {
        if (!selectedSubjectId || submittingSubjectEnrollmentId !== null) return;
        setSubmittingSubjectEnrollmentId(student.enrollmentId);
        try {
            await submitSingleStudentSubjectRecord(selectedSubjectId, student.enrollmentId, quarter);
            toast.success(`Record submitted for ${student.fullname}`);
            await fetchSubjectRecords(selectedSubjectId, quarter);
            refetchSubjects();
        } finally {
            setSubmittingSubjectEnrollmentId(null);
        }
    };

    const handleSubmitAllSubject = async () => {
        if (!selectedSubjectId || submittingAllSubject) return;
        setSubmittingAllSubject(true);
        try {
            const res = await submitSubjectRecords(selectedSubjectId, quarter);
            toast.success(`Quarter ${quarter} records submitted for ${res.data?.totalStudents ?? 0} students.`);
            setConfirmSubmitAllSubject(false);
            await fetchSubjectRecords(selectedSubjectId, quarter);
            refetchSubjects();
        } finally {
            setSubmittingAllSubject(false);
        }
    };

    // ================= Adviser View Actions =================
    const fetchAdviserRecords = async (targetQuarter: number) => {
        setLoadingAdviser(true);
        try {
            const response = await getAPICall<ClassRecordsResponse>(
                `/student-records/my-class?quarter=${targetQuarter}`
            );
            setAdviserRecords(response.data ?? null);
        } finally {
            setLoadingAdviser(false);
        }
    };

    const handleSubmitOneAdviser = async (student: StudentClassRecordRow) => {
        if (!adviserRecords?.classId || submittingAdviserEnrollmentId !== null) return;
        setSubmittingAdviserEnrollmentId(student.enrollmentId);
        try {
            await postAPICall(
                `/student-records/class/${adviserRecords.classId}/students/${student.enrollmentId}/quarter/${quarter}/submit`,
                {}
            );
            setReviewingAdviserStudent(null);
            await fetchAdviserRecords(quarter);
        } finally {
            setSubmittingAdviserEnrollmentId(null);
        }
    };

    function missingSubjectsFor(student: StudentClassRecordRow): string[] {
        if (!adviserRecords) return [];
        const missing: string[] = [];
        for (const subjectGrade of student.subjects) {
            if (subjectGrade.enrolled && subjectGrade.grade === null) {
                const subject = adviserRecords.subjects.find((s) => s.subjectId === subjectGrade.subjectId);
                missing.push(subject?.subjectName ?? `Subject #${subjectGrade.subjectId}`);
            }
        }
        return missing;
    }

    // ================= Loading / Empty State Handling =================
    if (loadingSubjects && loadingAdviser) {
        return (
            <PageShell className="faculty-records" busy label="Loading student records">
                <PageSection className="faculty-records__loading" flush>
                    <div className="p-6">
                        <Skeleton lines={6} gap="1rem" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    const hasNoAssignments = subjects.length === 0 && !isClassAdviser;

    if (hasNoAssignments) {
        return (
            <PageShell className="faculty-records">
                <PageSection className="faculty-records__empty">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <span className="faculty-records__empty-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" aria-hidden="true">
                            <FiBookOpen />
                        </span>
                        <h2 className="faculty-records__empty-title mt-4 text-base font-bold text-slate-800 dark:text-white">
                            No Assigned Subjects or Advised Class Found
                        </h2>
                        <p className="faculty-records__empty-text mt-1 max-w-md text-[0.8125rem] leading-relaxed text-slate-500 dark:text-slate-400">
                            You are not currently assigned to teach any subjects or advise a section for the active school year. Once the administrator assigns your schedule, your student records will appear here.
                        </p>
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    // Calculate subject progress
    const subjectProgress = subjectRecords?.progress ?? { total: 0, submitted: 0, pending: 0 };
    const subjectProgressPercent = subjectProgress.total === 0 ? 0 : Math.round((subjectProgress.submitted / subjectProgress.total) * 100);

    return (
        <PageShell className="faculty-records">
            {/* ==================== View Switcher Tabs (for dual-role faculty) ==================== */}
            {isClassAdviser && subjects.length > 0 && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <button
                        type="button"
                        onClick={() => setViewMode("subjects")}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${viewMode === "subjects"
                                ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-400"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            }`}
                    >
                        <FiBookOpen className="h-4 w-4" />
                        My Assigned Subjects ({subjects.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("adviser")}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${viewMode === "adviser"
                                ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-400"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            }`}
                    >
                        <FiUserCheck className="h-4 w-4" />
                        Advised Class Matrix ({adviserRecords?.section ?? "Adviser"})
                    </button>
                </div>
            )}

            {/* ==================== Submissions Locked Banner ==================== */}
            {submissionsLocked && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <FiShield className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="text-[0.8125rem] font-bold text-amber-800 dark:text-amber-300">Grade submissions are locked</p>
                        <p className="mt-0.5 text-[0.75rem] leading-relaxed text-amber-700 dark:text-amber-400">
                            The administrator has locked grade submissions. You cannot submit or reopen student records until submissions are unlocked.
                        </p>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 1: SUBJECT TEACHER STUDENT RECORDS (PRIMARY)                  */}
            {/* ========================================================================= */}
            {viewMode === "subjects" && (
                <>
                    {/* Header */}
                    <PageHeader
                        title={selectedSubject ? `${selectedSubject.subjectName}` : "Subject Student Records"}
                        description={selectedSubject ? `${selectedSubject.classSection} · Grade ${selectedSubject.classGradeLevel} (${selectedSubject.subjectCode})` : "Manage and submit student quarterly grades for your assigned subjects"}
                        meta={`Quarter ${quarter} · ${subjects.length} Assigned Class Subject${subjects.length === 1 ? "" : "s"}`}
                    />

                    {/* Subject Switcher Cards / Pills */}
                    {subjects.length > 1 && (
                        <div className="mb-6 flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                            {subjects.map((s) => {
                                const isSelected = s.classSubjectId === selectedSubjectId;
                                const qStatus = s.submissionStatus[quarter] ?? "pending";
                                const isSubSubmitted = qStatus === "submitted";

                                return (
                                    <button
                                        key={s.classSubjectId}
                                        type="button"
                                        onClick={() => setSelectedSubjectId(s.classSubjectId)}
                                        className={`flex min-w-[200px] flex-col items-start rounded-xl border p-3 text-left transition-all ${isSelected
                                                ? "border-emerald-500 bg-emerald-50/70 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/40"
                                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850"
                                            }`}
                                    >
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                                {s.subjectName}
                                            </span>
                                            <span
                                                className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isSubSubmitted
                                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                                                    }`}
                                            >
                                                Q{quarter}: {isSubSubmitted ? "Submitted" : "Pending"}
                                            </span>
                                        </div>
                                        <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            {s.classSection} · Grade {s.classGradeLevel}
                                        </span>
                                        <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                            {s.totalStudents} enrolled
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Progress Banner */}
                    <div className="faculty-records__progress mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-[0.9375rem] font-bold text-slate-900 dark:text-white">
                                    Quarter {quarter} Submission Progress
                                </h3>
                                <p className="mt-1 text-[0.8125rem] text-slate-500 dark:text-slate-400">
                                    {subjectProgress.submitted} of {subjectProgress.total} students submitted &middot;{" "}
                                    {subjectProgress.pending} pending
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {subjectRecords?.isSubjectSubmitted ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                        <FiCheckCircle className="h-4 w-4" />
                                        Subject Submitted
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={submissionsLocked || submittingAllSubject || subjectProgress.pending === 0}
                                        onClick={() => setConfirmSubmitAllSubject(true)}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <FiSend className="h-3.5 w-3.5" />
                                        Submit All Pending ({subjectProgress.pending})
                                    </button>
                                )}
                                <span className="faculty-records__progress-pct inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {subjectProgressPercent}%
                                </span>
                            </div>
                        </div>
                        <div
                            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                            role="progressbar"
                            aria-valuenow={subjectProgress.submitted}
                            aria-valuemin={0}
                            aria-valuemax={subjectProgress.total}
                        >
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${subjectProgressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Student Records Sheet Card */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        {/* Header toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    {selectedSubject?.subjectName ?? "Subject"} Students
                                </h3>
                                <p className="mt-0.5 text-[0.8125rem] text-slate-500 dark:text-slate-400">
                                    {subjectRecords?.students.length ?? 0} students &middot; grades and attendance frozen on submit
                                </p>
                            </div>

                            {/* Quarter Selector */}
                            <div className="flex items-center gap-2">
                                <label
                                    htmlFor="subject-quarter-select"
                                    className="text-[0.75rem] font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap"
                                >
                                    Quarter:
                                </label>
                                <select
                                    id="subject-quarter-select"
                                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                    value={quarter}
                                    onChange={(e) => {
                                        hasUserSelectedQuarterRef.current = true;
                                        setQuarter(Number(e.target.value));
                                    }}
                                >
                                    {quarters.map((q) => (
                                        <option key={q} value={q}>Q{q}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {loadingSubjectRecords ? (
                            <div className="p-8">
                                <Skeleton lines={5} gap="1rem" />
                            </div>
                        ) : !subjectRecords || subjectRecords.students.length === 0 ? (
                            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                                    <FiUsers className="h-6 w-6" />
                                </span>
                                <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">No students enrolled</p>
                                <p className="mt-1 text-[0.8125rem] text-slate-500 dark:text-slate-400">
                                    Students will appear here once enrolled in this class subject.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                                            <th className="px-5 py-3">Student</th>
                                            <th className="px-3 py-3 text-center">Written Work</th>
                                            <th className="px-3 py-3 text-center">Performance Task</th>
                                            <th className="px-3 py-3 text-center">Quarterly Exam</th>
                                            <th className="px-3 py-3 text-center">Subject Attendance</th>
                                            <th className="px-4 py-3 text-center">Q{quarter} Grade</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-5 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                        {subjectRecords.students.map((student) => {
                                            const isSubmitted = student.status === "submitted" || student.isFrozen;
                                            const isBusy = submittingSubjectEnrollmentId === student.enrollmentId;
                                            const initials = student.fullname
                                                .split(" ")
                                                .filter(Boolean)
                                                .slice(0, 2)
                                                .map((w) => w[0].toUpperCase())
                                                .join("");

                                            return (
                                                <tr
                                                    key={student.enrollmentId}
                                                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                                                >
                                                    {/* Student cell */}
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                                                {initials}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="truncate font-bold text-slate-900 dark:text-white">
                                                                    {student.fullname}
                                                                </div>
                                                                <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                                                    LRN: {student.studentLrn} &middot; {student.studentSex}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Written work */}
                                                    <td className="px-3 py-3.5 text-center font-mono text-slate-700 dark:text-slate-300">
                                                        {student.writtenWorkScore !== null ? formatGrade(student.writtenWorkScore) : "—"}
                                                    </td>

                                                    {/* Performance task */}
                                                    <td className="px-3 py-3.5 text-center font-mono text-slate-700 dark:text-slate-300">
                                                        {student.performanceTaskScore !== null ? formatGrade(student.performanceTaskScore) : "—"}
                                                    </td>

                                                    {/* Quarterly exam */}
                                                    <td className="px-3 py-3.5 text-center font-mono text-slate-700 dark:text-slate-300">
                                                        {student.quarterlyAssessmentScore !== null ? formatGrade(student.quarterlyAssessmentScore) : "—"}
                                                    </td>

                                                    {/* Attendance */}
                                                    <td className="px-3 py-3.5 text-center">
                                                        <span className="inline-flex flex-col items-center">
                                                            <span className="font-mono text-slate-800 dark:text-slate-200">
                                                                {student.attendancePresentDays} / {student.attendanceTotalDays} days
                                                            </span>
                                                            {student.attendanceRate !== null && (
                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                                    ({student.attendanceRate}%)
                                                                </span>
                                                            )}
                                                        </span>
                                                    </td>

                                                    {/* Quarter Grade */}
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs font-bold ${isSubmitted
                                                                    ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                                                                    : student.quarterGrade !== null
                                                                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                                                }`}
                                                        >
                                                            {isSubmitted && <FiLock className="h-3 w-3 text-slate-400" aria-hidden="true" />}
                                                            {formatGrade(student.quarterGrade)}
                                                        </span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="px-4 py-3.5 text-center">
                                                        {student.hasActiveAmendment && student.activePermissionId ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                <FiUnlock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                                {student.amendmentStatus === "in_progress" ? "In Progress" : "Authorized"}
                                                            </span>
                                                        ) : student.amendmentStatus === "pending" ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                                <FiClock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                                                Pending Review
                                                            </span>
                                                        ) : isSubmitted ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                <FiCheckCircle className="h-3 w-3" />
                                                                Submitted
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                                <FiClock className="h-3 w-3" />
                                                                Pending
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                        {isSubmitted ? (
                                                            student.hasActiveAmendment && student.activePermissionId ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={submissionsLocked}
                                                                    onClick={() => setActiveAmendStudent(student)}
                                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                >
                                                                    <FiEdit3 className="h-3.5 w-3.5 text-emerald-600" />
                                                                    Amend Record
                                                                </button>
                                                            ) : student.amendmentStatus === "pending" ? (
                                                                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50/60 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                                                                    <FiClock className="h-3.5 w-3.5" />
                                                                    Request Pending
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    disabled={submissionsLocked}
                                                                    onClick={() => setAmendmentSubjectStudent(student)}
                                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                                                >
                                                                    <FiEdit3 className="h-3.5 w-3.5" />
                                                                    Request Amendment
                                                                </button>
                                                            )
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                disabled={isBusy || submissionsLocked || student.quarterGrade === null}
                                                                onClick={() => handleSubmitOneSubject(student)}
                                                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                {isBusy ? (
                                                                    <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <FiSend className="h-3.5 w-3.5" />
                                                                )}
                                                                Submit
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
                    </div>
                </>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 2: ADVISED CLASS MATRIX (FOR CLASS ADVISERS)                    */}
            {/* ========================================================================= */}
            {viewMode === "adviser" && adviserRecords && (
                <>
                    <PageHeader
                        title={adviserRecords.section}
                        description={`Class Adviser: ${adviserRecords.adviserFullname ?? "Self"}`}
                        meta={`Grade ${adviserRecords.gradeLevel} · Q${quarter} Homeroom Rollup`}
                    />

                    {/* Progress banner */}
                    <div className="faculty-records__progress mb-6 flex flex-col gap-3 rounded-xl border p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="faculty-records__progress-heading min-w-0">
                                <h3 className="faculty-records__progress-title text-[0.9375rem] font-bold">
                                    Quarter {quarter} Submission Progress
                                </h3>
                                <p className="faculty-records__progress-subtitle mt-1 text-[0.8125rem]">
                                    {adviserRecords.progress.submitted} of {adviserRecords.progress.total} students submitted &middot;{" "}
                                    {adviserRecords.progress.pending} pending
                                </p>
                            </div>
                            <span className="faculty-records__progress-pct inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold">
                                {adviserRecords.progress.total === 0 ? 0 : Math.round((adviserRecords.progress.submitted / adviserRecords.progress.total) * 100)}%
                            </span>
                        </div>
                    </div>

                    {/* Sheet card */}
                    <div className="faculty-records__sheet-card overflow-hidden rounded-2xl">
                        <div className="faculty-records__card-head flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                            <div>
                                <h3 className="faculty-records__card-title text-base font-bold">Advised Class Student Records</h3>
                                <p className="faculty-records__card-subtitle mt-0.5 text-[0.8125rem]">
                                    {adviserRecords.students.length} students &middot; Section {adviserRecords.section}
                                </p>
                            </div>
                        </div>

                        <div className="faculty-records__table-container">
                            <table className="faculty-records__grade-table">
                                <thead>
                                    <tr>
                                        <th scope="col" rowSpan={2} className="faculty-records__sticky-col faculty-records__th-student">
                                            Student
                                        </th>
                                        {adviserRecords.subjects.map((subject) => (
                                            <th key={subject.classSubjectId} scope="col" className="faculty-records__th-group">
                                                {subject.subjectName}
                                            </th>
                                        ))}
                                        <th scope="col" className="faculty-records__th-group faculty-records__th-status">
                                            Status
                                        </th>
                                        <th scope="col" className="faculty-records__th-group faculty-records__th-action">
                                            Action
                                        </th>
                                    </tr>
                                    <tr>
                                        {adviserRecords.subjects.map((subject) => (
                                            <th key={subject.classSubjectId} scope="col" className="faculty-records__th-sub">
                                                {subject.subjectCode}
                                            </th>
                                        ))}
                                        <th scope="col" className="faculty-records__th-sub">Q{quarter}</th>
                                        <th scope="col" className="faculty-records__th-sub"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adviserRecords.students.map((student) => {
                                        const isSubmitted = student.status === "submitted";
                                        const isBusy = submittingAdviserEnrollmentId === student.enrollmentId;
                                        const initials = student.fullname
                                            .split(" ")
                                            .filter(Boolean)
                                            .slice(0, 2)
                                            .map((w) => w[0].toUpperCase())
                                            .join("");

                                        return (
                                            <tr key={student.enrollmentId} className="faculty-records__grade-row">
                                                <td className="faculty-records__sticky-col faculty-records__cell-student">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="faculty-records__avatar" aria-hidden="true">
                                                            {initials}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="faculty-records__student-name truncate text-[0.8125rem] font-bold">
                                                                {student.fullname}
                                                            </div>
                                                            <div className="faculty-records__student-meta font-mono text-[0.6875rem]">
                                                                LRN {student.studentLrn} &middot; {student.studentSex}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {adviserRecords.subjects.map((subject) => {
                                                    const subjectGrade = student.subjects.find((sg) => sg.subjectId === subject.subjectId);
                                                    if (!subjectGrade || !subjectGrade.enrolled) {
                                                        return (
                                                            <td key={subject.subjectId} className="faculty-records__grade-cell faculty-records__desktop-cell">
                                                                <span className="faculty-records__grade faculty-records__grade--off">—</span>
                                                            </td>
                                                        );
                                                    }
                                                    const isFrozen = subjectGrade.source === "frozen";
                                                    return (
                                                        <td key={subject.subjectId} className="faculty-records__grade-cell faculty-records__desktop-cell">
                                                            <span className={`faculty-records__grade faculty-records__grade--${isFrozen ? "frozen" : subjectGrade.grade !== null ? "live" : "missing"}`}>
                                                                {isFrozen && <FiLock className="faculty-records__grade-lock" aria-hidden="true" />}
                                                                {formatGrade(subjectGrade.grade)}
                                                            </span>
                                                        </td>
                                                    );
                                                })}

                                                <td className="faculty-records__grade-cell faculty-records__cell-status faculty-records__desktop-cell">
                                                    {isSubmitted ? (
                                                        <span className="faculty-records__status faculty-records__status--submitted inline-flex items-center gap-1 text-[0.6875rem] font-bold">
                                                            <FiCheckCircle aria-hidden="true" />
                                                            Submitted
                                                        </span>
                                                    ) : (
                                                        <span className="faculty-records__status faculty-records__status--pending inline-flex items-center gap-1 text-[0.6875rem] font-bold">
                                                            <FiClock aria-hidden="true" />
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="faculty-records__grade-cell faculty-records__cell-action faculty-records__desktop-cell">
                                                    {isSubmitted ? (
                                                        <button
                                                            type="button"
                                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[0.6875rem] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                            disabled={submissionsLocked}
                                                            onClick={() => setAmendmentAdviserStudent(student)}
                                                        >
                                                            <FiEdit3 aria-hidden="true" />
                                                            Request Amendment
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            ref={reviewingAdviserStudent?.enrollmentId === student.enrollmentId ? reviewTriggerRef : undefined}
                                                            className="faculty-records__review inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.6875rem] font-bold"
                                                            disabled={isBusy || submissionsLocked}
                                                            onClick={() => setReviewingAdviserStudent(student)}
                                                        >
                                                            {isBusy ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSend aria-hidden="true" />}
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
                    </div>
                </>
            )}

            {/* ==================== Confirm Dialogs ==================== */}
            <ConfirmDialog
                open={confirmSubmitAllSubject}
                title={`Submit all records for ${selectedSubject?.subjectName ?? "Subject"}?`}
                description={`This will freeze the Quarter ${quarter} records for all ${subjectProgress.pending} pending student(s) in this subject. Ensure all scores and attendance have been entered.`}
                confirmLabel={submittingAllSubject ? "Submitting…" : "Submit All Records"}
                confirmIcon={submittingAllSubject ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : undefined}
                tone="primary"
                pending={submittingAllSubject}
                onConfirm={handleSubmitAllSubject}
                onClose={() => setConfirmSubmitAllSubject(false)}
            />

            {/* ==================== Subject Amendment Request Modal ==================== */}
            {amendmentSubjectStudent && selectedSubject && (
                <RequestAmendmentModal
                    isOpen={Boolean(amendmentSubjectStudent)}
                    onClose={() => setAmendmentSubjectStudent(null)}
                    onSuccess={() => {
                        setAmendmentSubjectStudent(null);
                        if (selectedSubjectId) {
                            fetchSubjectRecords(selectedSubjectId, quarter);
                        }
                        refreshAmendments();
                    }}
                    recordType="subject_record"
                    studentId={amendmentSubjectStudent.studentId}
                    studentName={amendmentSubjectStudent.fullname}
                    studentLrn={amendmentSubjectStudent.studentLrn}
                    enrollmentId={amendmentSubjectStudent.enrollmentId}
                    classSubjectId={selectedSubject.classSubjectId}
                    subjectName={selectedSubject.subjectName}
                    classroomId={selectedSubject.classId}
                    classSection={selectedSubject.classSection}
                    quarter={quarter}
                    currentValueDisplay={amendmentSubjectStudent.quarterGrade}
                />
            )}

            {/* ==================== Subject Record Amendment Editor Modal ==================== */}
            {activeAmendStudent && selectedSubject && activeAmendStudent.activePermissionId && (
                <AmendStudentRecordModal
                    isOpen={Boolean(activeAmendStudent)}
                    onClose={() => setActiveAmendStudent(null)}
                    onSuccess={() => {
                        if (selectedSubjectId) {
                            fetchSubjectRecords(selectedSubjectId, quarter);
                        }
                        refreshAmendments();
                        refetchSubjects();
                    }}
                    classSubjectId={selectedSubject.classSubjectId}
                    enrollmentId={activeAmendStudent.enrollmentId}
                    quarter={quarter}
                    permissionId={activeAmendStudent.activePermissionId}
                    studentName={activeAmendStudent.fullname}
                    subjectName={selectedSubject.subjectName}
                />
            )}

            {/* ==================== Adviser Amendment Request Modal ==================== */}
            {amendmentAdviserStudent && adviserRecords?.classId && (
                <RequestAmendmentModal
                    isOpen={Boolean(amendmentAdviserStudent)}
                    onClose={() => setAmendmentAdviserStudent(null)}
                    onSuccess={() => {
                        setAmendmentAdviserStudent(null);
                        refreshAmendments();
                    }}
                    recordType="student_record_grade"
                    studentId={amendmentAdviserStudent.studentId}
                    studentName={amendmentAdviserStudent.fullname}
                    studentLrn={amendmentAdviserStudent.studentLrn}
                    enrollmentId={amendmentAdviserStudent.enrollmentId}
                    classroomId={adviserRecords.classId}
                    classSection={adviserRecords.section}
                    quarter={quarter}
                />
            )}

            {/* ==================== Adviser Review Dialog ==================== */}
            <ModalDialog
                open={reviewingAdviserStudent !== null}
                onClose={() => setReviewingAdviserStudent(null)}
                scrollable
                maxWidth="max-w-xl"
                className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            >
                {reviewingAdviserStudent && adviserRecords && (
                    <div className="flex h-full max-h-[calc(90dvh-2.5rem)] flex-col p-6" role="document">
                        <header className="shrink-0 flex items-center justify-between border-b pb-4 dark:border-slate-800">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    Review Student Record (Q{quarter})
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {reviewingAdviserStudent.fullname} &middot; LRN {reviewingAdviserStudent.studentLrn}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewingAdviserStudent(null)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </header>

                        <div className="min-h-0 flex-1 overflow-y-auto py-4">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b text-slate-500 dark:border-slate-800">
                                        <th className="py-2 text-left">Subject</th>
                                        <th className="py-2 text-right">Computed Q{quarter} Grade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-800">
                                    {adviserRecords.subjects.map((s) => {
                                        const grade = reviewingAdviserStudent.subjects.find((sg) => sg.subjectId === s.subjectId);
                                        return (
                                            <tr key={s.subjectId}>
                                                <td className="py-2">{s.subjectName}</td>
                                                <td className="py-2 text-right font-mono font-bold">
                                                    {grade?.grade !== null ? formatGrade(grade?.grade) : "Missing"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <footer className="shrink-0 flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setReviewingAdviserStudent(null)}
                                className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={missingSubjectsFor(reviewingAdviserStudent).length > 0 || submittingAdviserEnrollmentId !== null}
                                onClick={() => handleSubmitOneAdviser(reviewingAdviserStudent)}
                                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                Submit Record
                            </button>
                        </footer>
                    </div>
                )}
            </ModalDialog>
        </PageShell>
    );
}
