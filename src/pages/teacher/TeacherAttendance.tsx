import {
    FiCalendar,
    FiCheck,
    FiCheckCircle,
    FiClock,
    FiSave,
    FiUsers,
    FiUserCheck,
    FiXCircle,
    FiArrowLeft,
} from "react-icons/fi";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAPICall, postAPICall } from "../../api/api";
import { useUser } from "../../hooks/useUser";
import { getInitials } from "../../helper/initials";
import { toast } from "../../helper/toast";

import type { TeacherDetails, TeacherSubjectDetails } from "../../constant/teachers";
import type { ClassroomWithStudentsProps } from "../../constant/classrooms";

import "../../style/teacherAttendance.css";

// ================= Types =================

type AttendanceStatus = "present" | "absent";

interface AttendanceRecord {
    enrollmentId: number;
    status: AttendanceStatus | null;
}

/** One student's full attendance history for a subject (optionally filtered). */
interface AttendanceHistory {
    classSubjectId: number;
    enrollmentId: number;
    presentDays: number;
    totalDays: number;
    percentage: number | null;
    records: {
        enrollmentId: number;
        status: AttendanceStatus | null;
        date: string;
    }[];
}

/** attendance[enrollmentId] -> status (null = not recorded for the day yet). */
type StatusMap = Record<number, AttendanceStatus>;

type RosterStudent = NonNullable<ClassroomWithStudentsProps>["students"][number];

interface SchoolYearOption {
    id: number;
    startYear: string;
    endYear: string;
}

/** A quarter filter value: a specific quarter, or "all" to include everything. */
type QuarterFilter = number | "all";

const QUARTERS = [1, 2, 3, 4] as const;

// ================= Helpers =================

// Local yyyy-mm-dd for the date input value.
function toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

// Human label like "Monday, August 12, 2026"
function formatLongDate(value: string): string {
    const date = parseDateInput(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

export default function TeacherAttendance() {
    const navigate = useNavigate();
    const { user, loading: userLoading } = useUser();

    // ==================== State ====================
    const [teacher, setTeacher] = useState<TeacherDetails | null>(null);
    const [subjectDetails, setSubjectDetails] = useState<TeacherSubjectDetails[] | null>(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(toDateInputValue(new Date()));
    // The quarter the teacher is recording this day's attendance for. Stored on
    // every attendance row at save time so history can be filtered per quarter.
    const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
    // Available school years, used by the history view's school-year filter.
    const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);

    const [roster, setRoster] = useState<ClassroomWithStudentsProps | null>(null);
    const [statuses, setStatuses] = useState<StatusMap>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // The subject+date the current roster/statuses were loaded for. While they
    // don't match the selection, the sheet shows a skeleton instead of stale
    // students from the previous subject/date.
    const [loadedKey, setLoadedKey] = useState<string | null>(null);

    // ==================== Per-student history view ====================
    // While set, the main content is replaced by this student's attendance
    // history (table view) instead of the daily attendance sheet.
    const [viewingStudent, setViewingStudent] = useState<RosterStudent | null>(null);
    const [history, setHistory] = useState<AttendanceHistory | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    // Active filters for the history view.
    const [historyQuarter, setHistoryQuarter] = useState<QuarterFilter>("all");
    const [historySchoolYearId, setHistorySchoolYearId] = useState<QuarterFilter>("all");
    // Guards against stale responses when switching filters/students quickly.
    const historyRequestRef = useRef(0);

    // Guards against stale responses when switching subjects / dates quickly.
    const loadRequestRef = useRef(0);

    // ==================== Load teacher + subject assignments + school years ====================
    useEffect(() => {
        if (userLoading) return;
        let cancelled = false;

        async function loadTeacher() {
            if (!user) return;
            try {
                const teacherRes = await getAPICall<TeacherDetails>(`/teachers/by-user/${user.id}`, {
                    toast: false,
                });
                if (cancelled) return;
                const teacherData = teacherRes.data ?? null;
                setTeacher(teacherData);
                if (!teacherData) {
                    setLoading(false);
                    return;
                }

                const [subjectsRes, schoolYearsRes] = await Promise.all([
                    getAPICall<TeacherSubjectDetails[]>(`/teachers/${teacherData.id}/subjects`, {
                        toast: false,
                    }),
                    getAPICall<SchoolYearOption[]>("/schoolYear", { toast: false }),
                ]);
                if (cancelled) return;
                const subjects = subjectsRes.data ?? [];
                setSubjectDetails(subjects);
                setSchoolYears(schoolYearsRes.data ?? []);
                if (subjects.length > 0) {
                    setSelectedSubjectId(subjects[0]!.classSubjectId);
                }
            } catch {
                // Error toast is handled by the API interceptor
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadTeacher();
        return () => {
            cancelled = true;
        };
    }, [user, userLoading]);

    // ==================== Derived: subjects taught (flat, sorted by class) ====================
    const subjects = useMemo<TeacherSubjectDetails[]>(() => {
        if (!subjectDetails) return [];
        return [...subjectDetails].sort((a, b) => {
            if (a.classId !== b.classId) return a.classId - b.classId;
            return a.subjectName.localeCompare(b.subjectName);
        });
    }, [subjectDetails]);

    const selectedSubject =
        subjects.find((s) => s.classSubjectId === selectedSubjectId) ?? null;

    // ==================== Load roster + existing attendance ====================
    useEffect(() => {
        if (selectedSubjectId === null || !selectedDate || !selectedSubject) return;
        const subject = selectedSubject;

        const requestId = ++loadRequestRef.current;

        async function loadSheet() {
            try {
                const [rosterRes, attendanceRes] = await Promise.all([
                    getAPICall<ClassroomWithStudentsProps>(`/class/${subject.classId}/students`, {
                        toast: false,
                    }),
                    getAPICall<AttendanceRecord[]>(
                        `/attendance?classSubjectId=${selectedSubjectId}&date=${selectedDate}`,
                        { toast: false },
                    ),
                ]);
                if (loadRequestRef.current !== requestId) return;

                const students = rosterRes.data?.students ?? [];
                setRoster(rosterRes.data ?? null);

                // Prefill: recorded statuses win, unrecorded students default to
                // present (the common case — mark absences, not attendances).
                const existing: StatusMap = {};
                for (const record of attendanceRes.data ?? []) {
                    if (record.status === "present" || record.status === "absent") {
                        existing[record.enrollmentId] = record.status;
                    }
                }
                const prefilled: StatusMap = {};
                for (const student of students) {
                    prefilled[student.enrollmentId] = existing[student.enrollmentId] ?? "present";
                }
                setStatuses(prefilled);
                setLoadedKey(`${selectedSubjectId}|${selectedDate}`);
            } catch {
                // Error toast is handled by the API interceptor
            }
        }

        loadSheet();
    }, [selectedSubjectId, selectedDate, selectedSubject]);

    // ==================== Derived stats ====================
    const totalStudents = roster?.students.length ?? 0;
    const presentCount = Object.values(statuses).filter((s) => s === "present").length;
    const absentCount = Object.values(statuses).filter((s) => s === "absent").length;
    const presentRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 1000) / 10 : 0;

    // True while the sheet for the CURRENT selection is still loading (first
    // load or after switching subject/date) — avoids flashing stale students.
    const sheetLoading =
        selectedSubjectId !== null && loadedKey !== `${selectedSubjectId}|${selectedDate}`;

    // ==================== Handlers ====================
    function handleStatusToggle(enrollmentId: number) {
        setStatuses((prev) => ({
            ...prev,
            [enrollmentId]: prev[enrollmentId] === "present" ? "absent" : "present",
        }));
    }

    function markAllPresent() {
        if (!roster) return;
        const all: StatusMap = {};
        for (const student of roster.students) {
            all[student.enrollmentId] = "present";
        }
        setStatuses(all);
    }

    // ==================== History view handlers ====================
    function openHistory(student: RosterStudent) {
        // Default the filter to the quarter being recorded right now; the
        // teacher can flip to "All" or another quarter from the tabs.
        setViewingStudent(student);
        setHistory(null);
        setHistoryQuarter(selectedQuarter);
        setHistorySchoolYearId("all");
    }

    function closeHistory() {
        historyRequestRef.current++;
        setViewingStudent(null);
        setHistory(null);
    }

    // Escape returns to the attendance sheet while viewing a student's history.
    useEffect(() => {
        if (!viewingStudent) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            closeHistory();
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [viewingStudent]);

    // Fetch the student's history whenever the view opens or the filters change.
    useEffect(() => {
        if (!viewingStudent || !selectedSubjectId) return;
        const requestId = ++historyRequestRef.current;
        setHistory(null);
        setHistoryLoading(true);

        const params = new URLSearchParams({ classSubjectId: String(selectedSubjectId) });
        if (historyQuarter !== "all") params.set("quarter", String(historyQuarter));
        if (historySchoolYearId !== "all") params.set("schoolYearId", String(historySchoolYearId));

        getAPICall<AttendanceHistory>(
            `/attendance/${viewingStudent.enrollmentId}/history?${params.toString()}`,
            { toast: false },
        )
            .then((response) => {
                if (historyRequestRef.current !== requestId) return;
                setHistory(response.data ?? null);
            })
            .catch(() => {
                // Error toast is handled by the API interceptor
            })
            .finally(() => {
                if (historyRequestRef.current === requestId) {
                    setHistoryLoading(false);
                }
            });
    }, [viewingStudent, selectedSubjectId, historyQuarter, historySchoolYearId]);

    // Human label for the active history filter, e.g. "Quarter 1 · SY 2024-2025".
    const historyFilterLabel = useMemo(() => {
        const parts: string[] = [];
        parts.push(historyQuarter === "all" ? "All quarters" : `Quarter ${historyQuarter}`);
        const sy = schoolYears.find((s) => s.id === historySchoolYearId);
        parts.push(historySchoolYearId === "all" || !sy ? "All school years" : `SY ${sy.startYear}-${sy.endYear}`);
        return parts.join(" · ");
    }, [historyQuarter, historySchoolYearId, schoolYears]);

    async function handleSave() {
        if (!selectedSubjectId || !roster || saving) return;

        // The submitted sheet is authoritative: every student is saved for the
        // subject on this day (defaulting to present when the teacher left them
        // untouched), and the upsert is idempotent per (classSubjectId,
        // enrollmentId, date). The teacher-chosen quarter is stored with the day.
        const entries = roster.students
            .map((student) => ({
                enrollmentId: student.enrollmentId,
                status: statuses[student.enrollmentId] ?? "present",
            }))
            .filter((entry) => entry.status === "present" || entry.status === "absent");

        if (entries.length === 0) {
            toast.warning("No students to record attendance for.");
            return;
        }

        setSaving(true);
        try {
            await postAPICall(
                "/attendance",
                {
                    classSubjectId: selectedSubjectId,
                    date: selectedDate,
                    quarter: selectedQuarter,
                    entries,
                },
                { toast: false },
            );
            toast.success(`Attendance saved (Quarter ${selectedQuarter})`);
        } finally {
            setSaving(false);
        }
    }

    // ==================== Hero banner content ====================
    const heroEyebrow = viewingStudent
        ? selectedSubject
            ? `Grade ${selectedSubject.classGradeLevel} &middot; ${selectedSubject.classSection} &middot; ${selectedSubject.subjectName}`
            : "Attendance history"
        : selectedSubject
          ? `Grade ${selectedSubject.classGradeLevel} &middot; ${selectedSubject.classSection}`
          : "Daily Attendance";

    const heroName = viewingStudent
        ? viewingStudent.fullname
        : selectedSubject
          ? `${selectedSubject.subjectName} Attendance`
          : "Daily Attendance";

    const heroRole = viewingStudent
        ? `LRN ${viewingStudent.studentLrn} &middot; Attendance history`
        : selectedSubject
          ? `${selectedSubject.subjectCode} &middot; Classroom #${selectedSubject.classId}`
          : "Select a subject to record attendance";

    // ==================== Loading ====================
    if (userLoading || loading) {
        return (
            <section className="teacher-attendance flex flex-col gap-5" aria-busy="true" aria-label="Loading attendance">
                <div className="teacher-attendance__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-attendance__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-attendance__card-heading min-w-0">
                            <h3 className="teacher-attendance__card-title text-base font-bold">Daily Attendance</h3>
                            <p className="teacher-attendance__card-subtitle mt-1 text-[0.8125rem]">Loading your classes…</p>
                        </div>
                    </div>
                    <div className="teacher-attendance__sheet-wrap p-6">
                        <div className="h-40 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
                    </div>
                </div>
            </section>
        );
    }

    // ==================== Empty states ====================
    if (!teacher || subjects.length === 0) {
        return (
            <section className="teacher-attendance flex flex-col gap-5">
                <div className="teacher-attendance__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-attendance__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-attendance__card-heading min-w-0">
                            <h3 className="teacher-attendance__card-title text-base font-bold">Daily Attendance</h3>
                            <p className="teacher-attendance__card-subtitle mt-1 text-[0.8125rem]">
                                {teacher ? "No subjects assigned yet" : "Teacher profile not found"}
                            </p>
                        </div>
                    </div>
                    <div className="teacher-attendance__sheet-wrap flex flex-col items-center justify-center px-6 py-14 text-center">
                        <span className="teacher-attendance__stat-icon inline-flex h-12 w-12 items-center justify-center rounded-full text-lg" aria-hidden="true">
                            <FiUsers />
                        </span>
                        <p className="teacher-attendance__empty-title mt-3 text-sm font-bold">
                            {teacher ? "No subjects assigned" : "No teacher profile found"}
                        </p>
                        <p className="teacher-attendance__empty-text mt-1 text-[0.8125rem] text-gray-500">
                            {teacher
                                ? "Subjects you teach will appear here once you are assigned to a class and subject."
                                : "Your account is not linked to a teacher record yet. Contact the administrator."}
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="teacher-attendance flex flex-col gap-5">
            {/* ==================== Back button ==================== */}
            <button
                type="button"
                className="teacher-attendance__foot-btn inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                onClick={() => navigate("/teacher/dashboard")}
                aria-label="Back to dashboard"
            >
                <FiArrowLeft aria-hidden="true" />
                <span className="text-sm font-bold">Back to Dashboard</span>
            </button>

            {/* ==================== Hero banner ==================== */}
            <div className="teacher-attendance__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="teacher-attendance__hero-main flex min-w-0 items-center gap-4">
                    <span
                        className="teacher-attendance__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl"
                        aria-hidden="true"
                    >
                        {viewingStudent ? getInitials(viewingStudent.fullname) : <FiUsers />}
                    </span>
                    <div className="teacher-attendance__hero-heading min-w-0">
                        <span className="teacher-attendance__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            {heroEyebrow}
                        </span>
                        <h2 className="teacher-attendance__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            {heroName}
                        </h2>
                        <p className="teacher-attendance__hero-role mt-0.5 truncate text-[0.8125rem]">
                            {heroRole}
                        </p>
                    </div>
                </div>
                {viewingStudent ? (
                    <div className="teacher-attendance__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                        <span className="teacher-attendance__hero-badge-count text-[1.375rem] font-bold leading-none">
                            {history && history.percentage !== null ? `${history.percentage}%` : "—"}
                        </span>
                        <span className="teacher-attendance__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Present Rate
                        </span>
                    </div>
                ) : (
                    <div className="teacher-attendance__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                        <span className="teacher-attendance__hero-badge-count text-[1.375rem] font-bold leading-none">
                            {selectedDate ? selectedDate.slice(5) : "—"}
                        </span>
                        <span className="teacher-attendance__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            {selectedDate ? parseDateInput(selectedDate)?.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}
                        </span>
                    </div>
                )}
            </div>

            {viewingStudent ? (
                /* ==================== Student attendance history (table view) ==================== */
                <div className="teacher-attendance__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-attendance__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-attendance__card-heading flex min-w-0 items-center gap-3">
                            <span
                                className="teacher-attendance__student-avatar inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[0.75rem] font-bold uppercase"
                                aria-hidden="true"
                            >
                                {getInitials(viewingStudent.fullname)}
                            </span>
                            <div className="min-w-0">
                                <h3 className="teacher-attendance__card-title text-base font-bold">Attendance History</h3>
                                <p className="teacher-attendance__card-subtitle mt-1 text-[0.8125rem]">
                                    LRN {viewingStudent.studentLrn}
                                    {selectedSubject
                                        ? ` &middot; ${selectedSubject.subjectName} &middot; Grade ${selectedSubject.classGradeLevel} ${selectedSubject.classSection}`
                                        : ""}
                                    &middot; {historyFilterLabel}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="teacher-attendance__foot-btn inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                            onClick={closeHistory}
                            aria-label="Back to attendance sheet"
                        >
                            <FiArrowLeft aria-hidden="true" />
                            <span className="text-sm font-bold">Back to Sheet</span>
                        </button>
                    </div>

                    {/* Quarter + school year filters */}
                    <div className="teacher-attendance__history-filters flex flex-wrap items-center gap-2 border-b px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter attendance history by quarter">
                            <button
                                type="button"
                                className={`teacher-attendance__day inline-flex cursor-pointer rounded-lg border px-3.5 py-1.5 text-[0.6875rem] font-bold${
                                    historyQuarter === "all" ? " teacher-attendance__day--active" : ""
                                }`}
                                onClick={() => setHistoryQuarter("all")}
                                aria-pressed={historyQuarter === "all"}
                            >
                                All
                            </button>
                            {QUARTERS.map((quarter) => (
                                <button
                                    key={quarter}
                                    type="button"
                                    className={`teacher-attendance__day inline-flex cursor-pointer rounded-lg border px-3.5 py-1.5 text-[0.6875rem] font-bold${
                                        historyQuarter === quarter ? " teacher-attendance__day--active" : ""
                                    }`}
                                    onClick={() => setHistoryQuarter(quarter)}
                                    aria-pressed={historyQuarter === quarter}
                                >
                                    Q{quarter}
                                </button>
                            ))}
                        </div>

                        <label className="sr-only" htmlFor="history-school-year">School year</label>
                        <select
                            id="history-school-year"
                            className="teacher-attendance__day ml-auto inline-flex cursor-pointer rounded-lg border px-3.5 py-1.5 text-[0.6875rem] font-bold"
                            value={historySchoolYearId}
                            onChange={(event) =>
                                setHistorySchoolYearId(
                                    event.target.value === "all" ? "all" : Number(event.target.value),
                                )
                            }
                        >
                            <option value="all">All School Years</option>
                            {schoolYears.map((sy) => (
                                <option key={sy.id} value={sy.id}>
                                    SY {sy.startYear}-{sy.endYear}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Summary (scoped to the active filters) */}
                    <div className="teacher-attendance__history-summary grid grid-cols-1 gap-3 px-6 pt-5 sm:grid-cols-3">
                        <div className="teacher-attendance__history-stat teacher-attendance__history-stat--pct flex flex-col items-center justify-center gap-1 rounded-xl border p-4">
                            <span className="teacher-attendance__history-stat-value font-mono text-[1.5rem] font-bold leading-none">
                                {history && history.percentage !== null ? `${history.percentage}%` : "—"}
                            </span>
                            <span className="teacher-attendance__history-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                Present Rate
                            </span>
                        </div>
                        <div className="teacher-attendance__history-stat flex flex-col items-center justify-center gap-1 rounded-xl border p-4">
                            <span className="teacher-attendance__history-stat-value font-mono text-[1.5rem] font-bold leading-none">
                                {history?.presentDays ?? "—"}
                            </span>
                            <span className="teacher-attendance__history-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                Present Days
                            </span>
                        </div>
                        <div className="teacher-attendance__history-stat flex flex-col items-center justify-center gap-1 rounded-xl border p-4">
                            <span className="teacher-attendance__history-stat-value font-mono text-[1.5rem] font-bold leading-none">
                                {history?.totalDays ?? "—"}
                            </span>
                            <span className="teacher-attendance__history-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                Total Days
                            </span>
                        </div>
                    </div>

                    {/* History table */}
                    <div className="teacher-attendance__sheet-wrap overflow-x-auto pb-2 pt-3">
                        {historyLoading ? (
                            <div className="flex flex-col gap-3 px-6" aria-busy="true">
                                <div className="h-12 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
                                <div className="h-12 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
                                <div className="h-12 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
                            </div>
                        ) : !history || history.records.length === 0 ? (
                            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                                <span
                                    className="teacher-attendance__history-empty inline-flex h-11 w-11 items-center justify-center rounded-full"
                                    aria-hidden="true"
                                >
                                    <FiClock />
                                </span>
                                <p className="mt-3 text-sm font-bold">No attendance recorded</p>
                                <p className="mt-1 text-[0.8125rem] text-gray-500">
                                    {historyQuarter !== "all" || historySchoolYearId !== "all"
                                        ? "No records match the current quarter / school year filter."
                                        : "Record attendance for this subject to build up this student's history."}
                                </p>
                            </div>
                        ) : (
                            <table className="teacher-attendance__sheet w-full min-w-[40rem] border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                            No.
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                            Date
                                        </th>
                                        <th scope="col" className="teacher-attendance__sheet th--right px-6 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.records.map((record, index) => (
                                        <tr key={`${record.date}-${index}`}>
                                            <td className="px-6 py-3.5 font-mono text-[0.75rem] font-semibold text-gray-400">
                                                {String(index + 1).padStart(2, "0")}
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="flex items-center gap-2.5 text-[0.8125rem] font-semibold">
                                                    <FiCalendar className="text-gray-400" aria-hidden="true" />
                                                    {formatLongDate(record.date)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 text-right">
                                                <span
                                                    className={`teacher-attendance__status inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold teacher-attendance__status--${record.status ?? "absent"}`}
                                                >
                                                    {record.status === "present" ? (
                                                        <FiCheckCircle aria-hidden="true" />
                                                    ) : (
                                                        <FiXCircle aria-hidden="true" />
                                                    )}
                                                    {record.status === "present" ? "Present" : "Absent"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* ==================== Toolbar: subject + quarter + date + actions ==================== */}
                    <div className="teacher-attendance__toolbar flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm">
                        <div className="teacher-attendance__week flex flex-wrap items-center gap-2" role="group" aria-label="Attendance settings">
                            <label className="sr-only" htmlFor="attendance-subject">Subject</label>
                            <select
                                id="attendance-subject"
                                className="teacher-attendance__day inline-flex cursor-pointer rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                value={selectedSubjectId ?? ""}
                                onChange={(event) => setSelectedSubjectId(Number(event.target.value))}
                            >
                                {subjects.map((subject) => (
                                    <option key={subject.classSubjectId} value={subject.classSubjectId}>
                                        {subject.subjectName} · Grade {subject.classGradeLevel} {subject.classSection}
                                    </option>
                                ))}
                            </select>

                            <label className="sr-only" htmlFor="attendance-quarter">Quarter</label>
                            <select
                                id="attendance-quarter"
                                className="teacher-attendance__day inline-flex cursor-pointer rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                value={selectedQuarter}
                                onChange={(event) => setSelectedQuarter(Number(event.target.value))}
                            >
                                {QUARTERS.map((quarter) => (
                                    <option key={quarter} value={quarter}>
                                        Quarter {quarter}
                                    </option>
                                ))}
                            </select>

                            <label className="sr-only" htmlFor="attendance-date">Date</label>
                            <div className="teacher-attendance__today inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.6875rem] font-bold">
                                <FiCalendar aria-hidden="true" />
                                <input
                                    id="attendance-date"
                                    type="date"
                                    className="bg-transparent font-bold outline-none"
                                    value={selectedDate}
                                    max={toDateInputValue(new Date())}
                                    onChange={(event) => setSelectedDate(event.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            className="teacher-attendance__mark-all inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-bold"
                            disabled={sheetLoading || totalStudents === 0}
                            onClick={markAllPresent}
                        >
                            <FiCheck aria-hidden="true" />
                            Mark All Present
                        </button>
                    </div>

                    {/* ==================== Quick stats ==================== */}
                    <div className="teacher-attendance__stats grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className="teacher-attendance__stat flex items-center gap-3 rounded-xl border p-4">
                            <span className="teacher-attendance__stat-icon teacher-attendance__stat-icon--total inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiUsers />
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-attendance__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Total Students</span>
                                <span className="teacher-attendance__stat-value mt-0.5 block text-[1.125rem] font-bold">{totalStudents}</span>
                            </div>
                        </div>
                        <div className="teacher-attendance__stat flex items-center gap-3 rounded-xl border p-4">
                            <span className="teacher-attendance__stat-icon teacher-attendance__stat-icon--present inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiCheckCircle />
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-attendance__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Present</span>
                                <span className="teacher-attendance__stat-value mt-0.5 block text-[1.125rem] font-bold">{presentCount}</span>
                            </div>
                        </div>
                        <div className="teacher-attendance__stat flex items-center gap-3 rounded-xl border p-4">
                            <span className="teacher-attendance__stat-icon teacher-attendance__stat-icon--absent inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiXCircle />
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-attendance__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Absent</span>
                                <span className="teacher-attendance__stat-value mt-0.5 block text-[1.125rem] font-bold">{absentCount}</span>
                            </div>
                        </div>
                        <div className="teacher-attendance__stat flex items-center gap-3 rounded-xl border p-4">
                            <span className="teacher-attendance__stat-icon teacher-attendance__stat-icon--total inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiUserCheck />
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-attendance__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Present Rate</span>
                                <span className="teacher-attendance__stat-value mt-0.5 block text-[1.125rem] font-bold">
                                    {totalStudents > 0 ? `${presentRate}%` : "—"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ==================== Attendance sheet ==================== */}
                    <div className="teacher-attendance__card overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="teacher-attendance__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                            <div className="teacher-attendance__card-heading min-w-0">
                                <h3 className="teacher-attendance__card-title text-base font-bold">Attendance Sheet</h3>
                                <p className="teacher-attendance__card-subtitle mt-1 text-[0.8125rem]">
                                    {totalStudents} students &middot; {selectedDate ? formatLongDate(selectedDate) : ""}
                                    {selectedSubject ? ` &middot; ${selectedSubject.subjectName}` : ""}
                                    &middot; Quarter {selectedQuarter}
                                </p>
                            </div>
                        </div>

                        {sheetLoading ? (
                            <div className="teacher-attendance__sheet-wrap p-6" aria-busy="true">
                                <div className="h-40 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
                            </div>
                        ) : totalStudents === 0 ? (
                            <div className="teacher-attendance__sheet-wrap flex flex-col items-center justify-center px-6 py-14 text-center">
                                <span className="teacher-attendance__stat-icon inline-flex h-12 w-12 items-center justify-center rounded-full text-lg" aria-hidden="true">
                                    <FiUsers />
                                </span>
                                <p className="teacher-attendance__empty-title mt-3 text-sm font-bold">No students enrolled</p>
                                <p className="teacher-attendance__empty-text mt-1 text-[0.8125rem] text-gray-500">
                                    Students will appear here once they are enrolled in this class.
                                </p>
                            </div>
                        ) : (
                            <div className="teacher-attendance__sheet-wrap overflow-x-auto">
                                <table className="teacher-attendance__sheet w-full min-w-[40rem] border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Student</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Status</th>
                                            <th className="px-4 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roster?.students.map((student) => {
                                            const status = statuses[student.enrollmentId] ?? "present";
                                            return (
                                                <tr key={student.enrollmentId}>
                                                    <td className="teacher-attendance__cell--student px-4 py-3.5">
                                                        <button
                                                            type="button"
                                                            className="teacher-attendance__student-cell teacher-attendance__student-cell--link flex items-center gap-3 text-left"
                                                            onClick={() => openHistory(student)}
                                                            title="View attendance history"
                                                            aria-label={`View attendance history for ${student.fullname}`}
                                                        >
                                                            <span className="teacher-attendance__student-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold uppercase" aria-hidden="true">
                                                                {getInitials(student.fullname)}
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="teacher-attendance__student-name block truncate text-[0.8125rem] font-bold">
                                                                    {student.fullname}
                                                                </span>
                                                                <span className="teacher-attendance__student-lrn mt-0.5 flex items-center gap-1 font-mono text-[0.6875rem]">
                                                                    LRN {student.studentLrn} &middot;
                                                                    <FiClock aria-hidden="true" />
                                                                    History
                                                                </span>
                                                            </span>
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span
                                                            className={`teacher-attendance__status inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold teacher-attendance__status--${status}`}
                                                        >
                                                            {status === "present" ? (
                                                                <FiCheckCircle aria-hidden="true" />
                                                            ) : (
                                                                <FiXCircle aria-hidden="true" />
                                                            )}
                                                            {status === "present" ? "Present" : "Absent"}
                                                        </span>
                                                    </td>
                                                    <td className="teacher-attendance__cell--remarks px-4 py-3.5 text-right">
                                                        <button
                                                            type="button"
                                                            className={`teacher-attendance__save inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.6875rem] font-bold${
                                                                status === "absent" ? " teacher-attendance__save--primary" : ""
                                                            }`}
                                                            onClick={() => handleStatusToggle(student.enrollmentId)}
                                                            aria-label={`Mark ${student.fullname} ${status === "present" ? "absent" : "present"}`}
                                                        >
                                                            {status === "present" ? (
                                                                <FiXCircle aria-hidden="true" />
                                                            ) : (
                                                                <FiCheck aria-hidden="true" />
                                                            )}
                                                            Mark {status === "present" ? "Absent" : "Present"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ==================== Sheet footer ==================== */}
                        <div className="teacher-attendance__card-foot flex flex-wrap items-center justify-between gap-3 p-5">
                            <p className="teacher-attendance__foot-note flex items-center gap-2 text-[0.8125rem]">
                                <FiUserCheck aria-hidden="true" />
                                Present rate: <strong>{presentCount} of {totalStudents}</strong> students &middot; {presentRate}%
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="teacher-attendance__foot-btn inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-[0.8125rem] font-bold"
                                    onClick={markAllPresent}
                                    disabled={sheetLoading || totalStudents === 0}
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    className="teacher-attendance__save teacher-attendance__save--primary inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-bold"
                                    onClick={handleSave}
                                    disabled={saving || sheetLoading || totalStudents === 0}
                                >
                                    <FiSave aria-hidden="true" />
                                    {saving ? "Saving…" : "Save Attendance"}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
