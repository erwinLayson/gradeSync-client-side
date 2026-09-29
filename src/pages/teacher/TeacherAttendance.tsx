import {
    FiArrowLeft,
    FiCalendar,
    FiCheck,
    FiCheckCircle,
    FiClock,
    FiGrid,
    FiPlus,
    FiRefreshCw,
    FiUserCheck,
    FiUsers,
    FiX,
    FiXCircle,
} from "react-icons/fi";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getAPICall, postAPICall } from "../../api/api";
import { ModalDialog } from "../../components/ModalDialog";
import Skeleton from "../../components/Skeleton";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import { useUser } from "../../hooks/useUser";
import { getInitials } from "../../helper/initials";
import { toast } from "../../helper/toast";

import type { TeacherDetails, TeacherSubjectDetails } from "../../constant/teachers";
import type {
    AttendanceMatrix,
    AttendanceSavePayload,
    AttendanceStatus,
    QuarterFilter,
    SchoolYearOption,
} from "../../constant/attendance";

import "../../style/teacherAttendance.css";

// ================= Types =================

/** The minimal student shape both the grid rows and the history view need. */
interface AttendanceStudentRef {
    enrollmentId: number;
    fullname: string;
    studentLrn: string;
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

/** A school year filter value: a specific year id, or "all". */
type SchoolYearFilter = number | "all";

/** The "Create Attendance" dialog's fields. */
interface CreateAttendanceForm {
    classSubjectId: number | null;
    /** Local yyyy-mm-dd. */
    date: string;
    quarter: number;
}

// ================= Helpers =================

// `as const` keeps these as the literal "all" so comparisons narrow the filter
// types (a `QuarterFilter`-typed constant would not).
const ALL_QUARTERS = "all" as const;
const ALL_SCHOOL_YEARS = "all" as const;

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

// Compact column header, e.g. "Sep 9".
function formatShortDate(value: string): string {
    const date = parseDateInput(value);
    if (!date) return value;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

// Column header second line, e.g. "Wed".
function formatWeekday(value: string): string {
    const date = parseDateInput(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

// A yyyy-mm-dd date input value that is also a real calendar date.
function isValidDateInput(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDateInput(value) !== null;
}

// Inclusive first/last day of the current month — the "This Month" shortcut.
function currentMonthRange(): { from: string; to: string } {
    const now = new Date();
    return {
        from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
}

// Stable identity for one grid cell (a student on a date).
function cellKey(enrollmentId: number, date: string): string {
    return `${enrollmentId}|${date}`;
}

// Identity of the current filter selection. The grid is "loading" whenever the
// key it has loaded does not match the requested one — which is why the fetch
// effect never needs a synchronous setState just to flip a spinner.
function gridKey(
    subjectId: number | null,
    schoolYear: SchoolYearFilter,
    quarter: QuarterFilter,
    from: string,
    to: string,
): string {
    return `${subjectId ?? "none"}|${schoolYear}|${quarter}|${from}|${to}`;
}

// Shared empty arrays: a fresh [] on every render would give the derived row
// stats a new identity each time and defeat the memo below.
const NO_STUDENTS: AttendanceMatrix["students"] = [];
const NO_DATES: AttendanceMatrix["dates"] = [];
// Shared empty list for "no day is waiting to be recorded" (see pendingDays).
const NO_PENDING_DATES: string[] = [];

/** Reads a positive integer out of a URL/select value, else null. */
function toPositiveInt(value: string | null): number | null {
    if (!value || value === "all") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function TeacherAttendance() {
    const navigate = useNavigate();
    const { user, loading: userLoading } = useUser();
    const { quarters, currentQuarter, loading: settingsLoading } = useAcademicSettings();
    const [searchParams, setSearchParams] = useSearchParams();

    // ==================== State ====================
    const [teacher, setTeacher] = useState<TeacherDetails | null>(null);
    const [subjectDetails, setSubjectDetails] = useState<TeacherSubjectDetails[] | null>(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(() =>
        toPositiveInt(searchParams.get("subject")),
    );
    // Available school years, used by the grid's school-year filter.
    const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
    const [loading, setLoading] = useState(true);

    // ---- Filters (initialised from the URL so a refresh/back keeps them) ----
    const [quarterFilter, setQuarterFilter] = useState<QuarterFilter>(
        () => toPositiveInt(searchParams.get("quarter")) ?? ALL_QUARTERS,
    );
    const [schoolYearFilter, setSchoolYearFilter] = useState<SchoolYearFilter>(
        () => toPositiveInt(searchParams.get("year")) ?? ALL_SCHOOL_YEARS,
    );
    const [dateFrom, setDateFrom] = useState<string>(() => searchParams.get("from") ?? "");
    const [dateTo, setDateTo] = useState<string>(() => searchParams.get("to") ?? "");

    // The defaults below are applied once, and only when the URL did not already
    // carry an explicit choice — so a bookmarked view is never overwritten.
    const quarterFromUrlRef = useRef(searchParams.get("quarter") !== null);
    const schoolYearFromUrlRef = useRef(searchParams.get("year") !== null);

    // ---- The grid ----
    const [matrix, setMatrix] = useState<AttendanceMatrix | null>(null);
    // Live cell state: "enrollmentId|date" -> status. Seeded from the fetched
    // matrix, then updated optimistically while a save is in flight.
    const [cells, setCells] = useState<Record<string, AttendanceStatus>>({});
    // The filter key the current matrix/cells belong to; loading is derived from
    // it (see matrixLoading below).
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const [savingCell, setSavingCell] = useState<string | null>(null);
    const [savingColumn, setSavingColumn] = useState<string | null>(null);
    // Guards against stale responses when switching subject/filters quickly.
    const matrixRequestRef = useRef(0);

    // ---- "Create Attendance" dialog ----
    // The server only returns dates that already have a record, so a day with
    // no records has no column and therefore no cell to mark. This dialog opens
    // one: the teacher picks the subject, the date and the quarter, and the day
    // is added as an (empty) column of that grid. Nothing is written until a
    // cell is marked, exactly like any other day.
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState<CreateAttendanceForm>({
        classSubjectId: null,
        date: "",
        quarter: 1,
    });
    const [createError, setCreateError] = useState<string | null>(null);
    // True while the dialog checks whether that day already has records.
    const [createChecking, setCreateChecking] = useState(false);
    // Days opened by that dialog and not yet recorded, keyed by the grid they
    // belong to. An entry is dropped once the server reports the date (i.e. the
    // first cell was saved), so the column stops being "pending" by itself.
    const [pendingDays, setPendingDays] = useState<Record<string, string[]>>({});
    // The button that opened the dialog; ModalDialog returns focus to it.
    const createTriggerRef = useRef<HTMLButtonElement>(null);

    // ==================== Per-student history view ====================
    // While set, the main content is replaced by this student's attendance
    // history (table view) instead of the class grid.
    const [viewingStudent, setViewingStudent] = useState<AttendanceStudentRef | null>(null);
    const [history, setHistory] = useState<AttendanceHistory | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyQuarter, setHistoryQuarter] = useState<QuarterFilter>(ALL_QUARTERS);
    const [historySchoolYearId, setHistorySchoolYearId] = useState<SchoolYearFilter>(ALL_SCHOOL_YEARS);
    // Guards against stale responses when switching filters/students quickly.
    const historyRequestRef = useRef(0);

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
                const years = schoolYearsRes.data ?? [];
                setSubjectDetails(subjects);
                setSchoolYears(years);

                // Default the school-year filter to the ACTIVE year so records
                // from another year can never leak into the default view.
                if (!schoolYearFromUrlRef.current) {
                    schoolYearFromUrlRef.current = true;
                    const active = years.find((sy) => Number(sy.isActive) === 1);
                    if (active) setSchoolYearFilter(active.id);
                }

                if (subjects.length > 0) {
                    // Keep a subject from the URL when it is still one the teacher
                    // teaches; otherwise fall back to the first one.
                    setSelectedSubjectId((prev) =>
                        prev !== null && subjects.some((s) => s.classSubjectId === prev)
                            ? prev
                            : subjects[0]!.classSubjectId,
                    );
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

    // Default the quarter filter to the school's current quarter once the real
    // setting has loaded (the hook falls back to 1 while loading).
    useEffect(() => {
        if (settingsLoading || quarterFromUrlRef.current) return;
        quarterFromUrlRef.current = true;
        setQuarterFilter(currentQuarter);
    }, [settingsLoading, currentQuarter]);

    // Reflect the active filters in the URL (replace, so Back isn't spammed).
    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedSubjectId !== null) params.set("subject", String(selectedSubjectId));
        if (quarterFilter !== ALL_QUARTERS) params.set("quarter", String(quarterFilter));
        if (schoolYearFilter !== ALL_SCHOOL_YEARS) params.set("year", String(schoolYearFilter));
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        setSearchParams(params, { replace: true });
    }, [selectedSubjectId, quarterFilter, schoolYearFilter, dateFrom, dateTo, setSearchParams]);

    // ==================== Load the grid ====================
    // A partially-filled range (from > to) can never match a record, so it is
    // reported inline instead of being sent — no pointless request, no error toast.
    const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

    useEffect(() => {
        if (selectedSubjectId === null) return;
        // A from > to range can never match a record, so the request is skipped
        // (no error toast) and the render shows an inline warning instead.
        if (rangeInvalid) return;

        const requestId = ++matrixRequestRef.current;
        const key = gridKey(selectedSubjectId, schoolYearFilter, quarterFilter, dateFrom, dateTo);

        const params = new URLSearchParams({ classSubjectId: String(selectedSubjectId) });
        if (schoolYearFilter !== ALL_SCHOOL_YEARS) params.set("schoolYearId", String(schoolYearFilter));
        if (quarterFilter !== ALL_QUARTERS) params.set("quarter", String(quarterFilter));
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        getAPICall<AttendanceMatrix>(`/attendance/range?${params.toString()}`, { toast: false })
            .then((response) => {
                if (matrixRequestRef.current !== requestId) return;
                const data = response.data ?? null;
                setMatrix(data);
                const seeded: Record<string, AttendanceStatus> = {};
                for (const record of data?.records ?? []) {
                    if (record.status === "present" || record.status === "absent") {
                        seeded[cellKey(record.enrollmentId, record.date)] = record.status;
                    }
                }
                setCells(seeded);

                // A day opened from "Create Attendance" stops being pending as
                // soon as the server reports it: the first saved cell turned it
                // into an ordinary, recorded column.
                const fetchedDates = data?.dates ?? NO_PENDING_DATES;
                if (fetchedDates.length > 0) {
                    setPendingDays((prev) => {
                        const pending = prev[key];
                        if (!pending || pending.length === 0) return prev;
                        const remaining = pending.filter((date) => !fetchedDates.includes(date));
                        if (remaining.length === pending.length) return prev;
                        const next = { ...prev };
                        if (remaining.length === 0) delete next[key];
                        else next[key] = remaining;
                        return next;
                    });
                }
            })
            .catch(() => {
                if (matrixRequestRef.current !== requestId) return;
                setMatrix(null);
                setCells({});
            })
            .finally(() => {
                if (matrixRequestRef.current === requestId) setLoadedKey(key);
            });
    }, [selectedSubjectId, schoolYearFilter, quarterFilter, dateFrom, dateTo, rangeInvalid]);

    // ==================== Derived: grid stats ====================
    // A backwards range must not keep showing the previous filters' rows, and
    // the grid is still "loading" until the fetched key matches the requested one.
    const requestedKey = gridKey(selectedSubjectId, schoolYearFilter, quarterFilter, dateFrom, dateTo);
    const effectiveMatrix = rangeInvalid ? null : matrix;
    const students = effectiveMatrix?.students ?? NO_STUDENTS;
    const dates = effectiveMatrix?.dates ?? NO_DATES;

    // The columns the grid actually shows: every recorded day, plus any day the
    // teacher just opened from "Create Attendance" that has no record yet. This
    // is the only place a not-yet-recorded day can come from.
    const pendingForKey = pendingDays[requestedKey] ?? NO_PENDING_DATES;
    const gridDates = useMemo(() => {
        if (pendingForKey.length === 0) return dates;
        const merged = new Set(dates);
        for (const date of pendingForKey) merged.add(date);
        return [...merged].sort();
    }, [dates, pendingForKey]);

    const matrixLoading = selectedSubjectId !== null && !rangeInvalid && loadedKey !== requestedKey;

    // A specific quarter must be selected to write: every attendance row stores
    // the teacher-chosen quarter, so "All quarters" is a read-only view.
    const canEdit = quarterFilter !== ALL_QUARTERS;
    const busy = savingCell !== null || savingColumn !== null;

    const rowStats = useMemo(() => {
        const stats = new Map<number, { present: number; recorded: number }>();
        for (const student of students) {
            let present = 0;
            let recorded = 0;
            for (const date of gridDates) {
                const status = cells[cellKey(student.enrollmentId, date)];
                if (!status) continue;
                recorded++;
                if (status === "present") present++;
            }
            stats.set(student.enrollmentId, { present, recorded });
        }
        return stats;
    }, [students, gridDates, cells]);

    const totals = useMemo(() => {
        let present = 0;
        let recorded = 0;
        for (const stats of rowStats.values()) {
            present += stats.present;
            recorded += stats.recorded;
        }
        return {
            present,
            recorded,
            absent: recorded - present,
            // Display-only percentage, computed the same way the daily sheet did.
            rate: recorded > 0 ? Math.round((present / recorded) * 1000) / 10 : null,
        };
    }, [rowStats]);

    // ==================== Grid handlers ====================

    // Toggle one cell: unrecorded -> Present -> Absent -> Present. The write is
    // scoped to that single student and date, so nothing else is ever touched.
    async function handleToggleCell(student: AttendanceStudentRef, date: string) {
        // `canEdit` already means "a specific quarter is selected", and TS narrows
        // quarterFilter to a number through it.
        if (!canEdit || selectedSubjectId === null || busy) return;
        const quarter = quarterFilter;

        const key = cellKey(student.enrollmentId, date);
        const previous = cells[key];
        const next: AttendanceStatus = previous === "present" ? "absent" : "present";

        setCells((prev) => ({ ...prev, [key]: next }));
        setSavingCell(key);
        try {
            await postAPICall<AttendanceSavePayload, unknown>(
                "/attendance",
                {
                    classSubjectId: selectedSubjectId,
                    date,
                    quarter,
                    entries: [{ enrollmentId: student.enrollmentId, status: next }],
                },
                { toast: false },
            );
        } catch {
            // Roll back the optimistic cell; the interceptor already toasted.
            setCells((prev) => {
                const reverted = { ...prev };
                if (previous === undefined) delete reverted[key];
                else reverted[key] = previous;
                return reverted;
            });
        } finally {
            setSavingCell(null);
        }
    }

    // Fill one date column for the whole visible roster at once (the spreadsheet
    // equivalent of the old sheet's "Mark All Present").
    async function handleMarkDatePresent(date: string) {
        if (!canEdit || selectedSubjectId === null || busy) return;
        if (students.length === 0) return;
        const quarter = quarterFilter;

        const keys = students.map((student) => cellKey(student.enrollmentId, date));
        const previous = keys.map((key) => cells[key]);
        setCells((prev) => {
            const next = { ...prev };
            for (const key of keys) next[key] = "present";
            return next;
        });
        setSavingColumn(date);
        try {
            await postAPICall<AttendanceSavePayload, unknown>(
                "/attendance",
                {
                    classSubjectId: selectedSubjectId,
                    date,
                    quarter,
                    entries: students.map((student) => ({
                        enrollmentId: student.enrollmentId,
                        status: "present" as const,
                    })),
                },
                { toast: false },
            );
            toast.success(`${formatLongDate(date)} — all ${students.length} students marked present.`);
        } catch {
            setCells((prev) => {
                const reverted = { ...prev };
                keys.forEach((key, index) => {
                    const before = previous[index];
                    if (before === undefined) delete reverted[key];
                    else reverted[key] = before;
                });
                return reverted;
            });
        } finally {
            setSavingColumn(null);
        }
    }

    // ==================== "Create Attendance" dialog ====================

    // Opens with the grid's current context preselected, so recording a day for
    // the subject already on screen stays a two-tap action.
    function openCreateDialog() {
        setCreateError(null);
        setCreateForm({
            classSubjectId: selectedSubjectId ?? subjects[0]?.classSubjectId ?? null,
            date: toDateInputValue(new Date()),
            quarter: quarterFilter !== ALL_QUARTERS ? quarterFilter : currentQuarter,
        });
        setCreateOpen(true);
    }

    function closeCreateDialog() {
        setCreateOpen(false);
        setCreateError(null);
    }

    // "Create" writes nothing itself: it opens the chosen day as an empty column
    // of the grid (switching subject/quarter to match) so its cells — and the
    // header tick that fills the whole class — can save statuses one at a time.
    //
    // Before that it asks the server what already exists for that subject on
    // that exact date, in any quarter: attendance rows are unique per
    // (subject, student, date) and a save re-tags the quarter, so quietly
    // opening a day that belongs to another quarter would move it.
    async function handleCreateAttendance(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const { classSubjectId, date, quarter } = createForm;

        const target = subjects.find((subject) => subject.classSubjectId === classSubjectId) ?? null;
        if (!target) {
            setCreateError("Pick the subject this attendance is for.");
            return;
        }
        if (!isValidDateInput(date)) {
            setCreateError("Pick the date this attendance is for.");
            return;
        }
        if (date > toDateInputValue(new Date())) {
            setCreateError("Attendance cannot be recorded for a future date.");
            return;
        }
        if (createChecking) return;

        setCreateChecking(true);
        try {
            const params = new URLSearchParams({
                classSubjectId: String(classSubjectId),
                dateFrom: date,
                dateTo: date,
            });
            const response = await getAPICall<AttendanceMatrix>(
                `/attendance/range?${params.toString()}`,
                { toast: false },
            );
            const existing = response.data?.records ?? [];
            const otherQuarter = existing.find(
                (record) => record.quarter !== null && record.quarter !== quarter,
            );

            // A day already recorded under a different quarter is not a new
            // day; it is that quarter's to edit.
            if (otherQuarter) {
                setCreateError(
                    `${formatLongDate(date)} is already recorded for Quarter ${otherQuarter.quarter}. Pick Quarter ${otherQuarter.quarter} to edit that day.`,
                );
                return;
            }

            const key = gridKey(classSubjectId, schoolYearFilter, quarter, dateFrom, dateTo);
            const alreadyPending = (pendingDays[key] ?? NO_PENDING_DATES).includes(date);

            // Show the subject/quarter the day belongs to, even when it is
            // already on the grid (the click is still a navigation, not a no-op).
            setSelectedSubjectId(classSubjectId);
            setQuarterFilter(quarter);

            if (existing.length > 0 || alreadyPending) {
                closeCreateDialog();
                toast.info(`${formatLongDate(date)} is already open on the grid.`);
                return;
            }

            setPendingDays((prev) => ({
                ...prev,
                [key]: [...(prev[key] ?? NO_PENDING_DATES), date].sort(),
            }));
            closeCreateDialog();
            toast.success(
                `${formatLongDate(date)} opened for ${target.subjectName} — mark students to record it.`,
            );
        } catch {
            // The API interceptor already reported it; keep the dialog open.
            setCreateError("Could not check that date. Try again.");
        } finally {
            setCreateChecking(false);
        }
    }

    function applyThisMonth() {
        const { from, to } = currentMonthRange();
        setDateFrom(from);
        setDateTo(to);
    }

    function resetFilters() {
        setQuarterFilter(currentQuarter);
        const active = schoolYears.find((sy) => Number(sy.isActive) === 1);
        setSchoolYearFilter(active ? active.id : ALL_SCHOOL_YEARS);
        setDateFrom("");
        setDateTo("");
    }

    // ==================== History view handlers ====================
    function openHistory(student: AttendanceStudentRef) {
        // Carry the grid's filters into the history view so the drill-down shows
        // the same slice the teacher was just looking at.
        setViewingStudent(student);
        setHistory(null);
        setHistoryQuarter(quarterFilter);
        setHistorySchoolYearId(schoolYearFilter);
    }

    function closeHistory() {
        historyRequestRef.current++;
        setViewingStudent(null);
        setHistory(null);
    }

    // Escape returns to the attendance grid while viewing a student's history.
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
        if (historyQuarter !== ALL_QUARTERS) params.set("quarter", String(historyQuarter));
        if (historySchoolYearId !== ALL_SCHOOL_YEARS) params.set("schoolYearId", String(historySchoolYearId));

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
        parts.push(historyQuarter === ALL_QUARTERS ? "All quarters" : `Quarter ${historyQuarter}`);
        const sy = schoolYears.find((s) => s.id === historySchoolYearId);
        parts.push(
            historySchoolYearId === ALL_SCHOOL_YEARS || !sy
                ? "All school years"
                : `SY ${sy.startYear}-${sy.endYear}`,
        );
        return parts.join(" · ");
    }, [historyQuarter, historySchoolYearId, schoolYears]);

    // Human label for the grid's own filter state, used in the card subtitle.
    const gridFilterLabel = useMemo(() => {
        const parts: string[] = [];
        const sy = schoolYears.find((s) => s.id === schoolYearFilter);
        parts.push(
            schoolYearFilter === ALL_SCHOOL_YEARS || !sy
                ? "All school years"
                : `SY ${sy.startYear}-${sy.endYear}`,
        );
        parts.push(quarterFilter === ALL_QUARTERS ? "All quarters" : `Quarter ${quarterFilter}`);
        if (dateFrom || dateTo) {
            parts.push(
                `${dateFrom ? formatShortDate(dateFrom) : "start"} – ${dateTo ? formatShortDate(dateTo) : "today"}`,
            );
        } else {
            parts.push("All dates");
        }
        return parts.join(" · ");
    }, [schoolYearFilter, quarterFilter, dateFrom, dateTo, schoolYears]);

    // ==================== Hero banner content ====================
    const heroEyebrow = viewingStudent
        ? selectedSubject
            ? `Grade ${selectedSubject.classGradeLevel} &middot; ${selectedSubject.classSection} &middot; ${selectedSubject.subjectName}`
            : "Attendance history"
        : selectedSubject
          ? `Grade ${selectedSubject.classGradeLevel} &middot; ${selectedSubject.classSection}`
          : "Class Attendance";

    const heroName = viewingStudent
        ? viewingStudent.fullname
        : selectedSubject
          ? `${selectedSubject.subjectName} Attendance`
          : "Class Attendance";

    const heroRole = viewingStudent
        ? `LRN ${viewingStudent.studentLrn} &middot; Attendance history`
        : selectedSubject
          ? `${selectedSubject.subjectCode} &middot; Classroom #${selectedSubject.classId}`
          : "Select a subject to record attendance";

    // ==================== Loading ====================
    if (userLoading || loading) {
        return (
            <section className="teacher-attendance flex flex-col gap-5" aria-busy="true" aria-label="Loading attendance">
                <div className="teacher-attendance__card overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
                    <Skeleton lines={6} gap="1rem" />
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
                            <h3 className="teacher-attendance__card-title text-base font-bold">Class Attendance</h3>
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
                            {matrixLoading ? "…" : gridDates.length}
                        </span>
                        <span className="teacher-attendance__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Days Recorded
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
                            aria-label="Back to attendance grid"
                        >
                            <FiArrowLeft aria-hidden="true" />
                            <span className="text-sm font-bold">Back to Grid</span>
                        </button>
                    </div>

                    {/* Quarter + school year filters */}
                    <div className="teacher-attendance__history-filters flex flex-wrap items-center gap-2 border-b px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter attendance history by quarter">
                            <button
                                type="button"
                                className={`teacher-attendance__day inline-flex cursor-pointer rounded-lg border px-3.5 py-1.5 text-[0.6875rem] font-bold${
                                    historyQuarter === ALL_QUARTERS ? " teacher-attendance__day--active" : ""
                                }`}
                                onClick={() => setHistoryQuarter(ALL_QUARTERS)}
                                aria-pressed={historyQuarter === ALL_QUARTERS}
                            >
                                All
                            </button>
                            {quarters.map((quarter) => (
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
                                    event.target.value === "all" ? ALL_SCHOOL_YEARS : Number(event.target.value),
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
                                    {historyQuarter !== ALL_QUARTERS || historySchoolYearId !== ALL_SCHOOL_YEARS
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
                    {/* ==================== Toolbar: subject + school year + quarter + date range ==================== */}
                    <div className="teacher-attendance__toolbar flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm">
                        <div className="teacher-attendance__filters flex flex-wrap items-end gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="teacher-attendance__filter-label text-[0.625rem] font-bold uppercase tracking-[0.08em]" htmlFor="attendance-subject">
                                    Subject
                                </label>
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
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="teacher-attendance__filter-label text-[0.625rem] font-bold uppercase tracking-[0.08em]" htmlFor="attendance-school-year">
                                    School Year
                                </label>
                                <select
                                    id="attendance-school-year"
                                    className="teacher-attendance__day inline-flex cursor-pointer rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                    value={schoolYearFilter}
                                    onChange={(event) =>
                                        setSchoolYearFilter(
                                            event.target.value === "all" ? ALL_SCHOOL_YEARS : Number(event.target.value),
                                        )
                                    }
                                >
                                    <option value="all">All School Years</option>
                                    {schoolYears.map((sy) => (
                                        <option key={sy.id} value={sy.id}>
                                            SY {sy.startYear}-{sy.endYear}
                                            {Number(sy.isActive) === 1 ? " (Active)" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <span className="teacher-attendance__filter-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                    Quarter
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by quarter">
                                    <button
                                        type="button"
                                        className={`teacher-attendance__day inline-flex cursor-pointer rounded-lg border px-3.5 py-2 text-[0.6875rem] font-bold${
                                            quarterFilter === ALL_QUARTERS ? " teacher-attendance__day--active" : ""
                                        }`}
                                        onClick={() => setQuarterFilter(ALL_QUARTERS)}
                                        aria-pressed={quarterFilter === ALL_QUARTERS}
                                    >
                                        All
                                    </button>
                                    {quarters.map((quarter) => (
                                        <button
                                            key={quarter}
                                            type="button"
                                            className={`teacher-attendance__day inline-flex cursor-pointer rounded-lg border px-3.5 py-2 text-[0.6875rem] font-bold${
                                                quarterFilter === quarter ? " teacher-attendance__day--active" : ""
                                            }`}
                                            onClick={() => setQuarterFilter(quarter)}
                                            aria-pressed={quarterFilter === quarter}
                                        >
                                            Q{quarter}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="teacher-attendance__filter-label text-[0.625rem] font-bold uppercase tracking-[0.08em]" htmlFor="attendance-from">
                                    From
                                </label>
                                <div className="teacher-attendance__today inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.6875rem] font-bold">
                                    <FiCalendar aria-hidden="true" />
                                    <input
                                        id="attendance-from"
                                        type="date"
                                        className="bg-transparent font-bold outline-none"
                                        value={dateFrom}
                                        max={dateTo || toDateInputValue(new Date())}
                                        onChange={(event) => setDateFrom(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="teacher-attendance__filter-label text-[0.625rem] font-bold uppercase tracking-[0.08em]" htmlFor="attendance-to">
                                    To
                                </label>
                                <div className="teacher-attendance__today inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.6875rem] font-bold">
                                    <FiCalendar aria-hidden="true" />
                                    <input
                                        id="attendance-to"
                                        type="date"
                                        className="bg-transparent font-bold outline-none"
                                        value={dateTo}
                                        min={dateFrom || undefined}
                                        max={toDateInputValue(new Date())}
                                        onChange={(event) => setDateTo(event.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                ref={createTriggerRef}
                                className="teacher-attendance__save teacher-attendance__save--primary inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                onClick={openCreateDialog}
                                disabled={subjects.length === 0}
                            >
                                <FiPlus aria-hidden="true" />
                                Create Attendance
                            </button>
                            <button
                                type="button"
                                className="teacher-attendance__save inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                onClick={applyThisMonth}
                            >
                                <FiCalendar aria-hidden="true" />
                                This Month
                            </button>
                            <button
                                type="button"
                                className="teacher-attendance__foot-btn inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                onClick={resetFilters}
                            >
                                <FiRefreshCw aria-hidden="true" />
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* ==================== Quick stats (scoped to the filters) ==================== */}
                    <div className="teacher-attendance__stats grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className="teacher-attendance__stat flex items-center gap-3 rounded-xl border p-4">
                            <span className="teacher-attendance__stat-icon teacher-attendance__stat-icon--total inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiUsers />
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-attendance__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Students</span>
                                <span className="teacher-attendance__stat-value mt-0.5 block text-[1.125rem] font-bold">{students.length}</span>
                            </div>
                        </div>
                        <div className="teacher-attendance__stat flex items-center gap-3 rounded-xl border p-4">
                            <span className="teacher-attendance__stat-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiGrid />
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-attendance__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Days Recorded</span>
                                <span className="teacher-attendance__stat-value mt-0.5 block text-[1.125rem] font-bold">{gridDates.length}</span>
                            </div>
                        </div>
                        <div className="teacher-attendance__stat flex items-center gap-3 rounded-xl border p-4">
                            <span className="teacher-attendance__stat-icon teacher-attendance__stat-icon--absent inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiXCircle />
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-attendance__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Absences</span>
                                <span className="teacher-attendance__stat-value mt-0.5 block text-[1.125rem] font-bold">{totals.absent}</span>
                            </div>
                        </div>
                        <div className="teacher-attendance__stat flex items-center gap-3 rounded-xl border p-4">
                            <span className="teacher-attendance__stat-icon teacher-attendance__stat-icon--present inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiUserCheck />
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-attendance__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Present Rate</span>
                                <span className="teacher-attendance__stat-value mt-0.5 block text-[1.125rem] font-bold">
                                    {totals.rate === null ? "—" : `${totals.rate}%`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ==================== Spreadsheet grid ==================== */}
                    <div className="teacher-attendance__card overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="teacher-attendance__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                            <div className="teacher-attendance__card-heading min-w-0">
                                <h3 className="teacher-attendance__card-title text-base font-bold">Attendance Record</h3>
                                <p className="teacher-attendance__card-subtitle mt-1 text-[0.8125rem]">
                                    {students.length} students &middot; {gridDates.length} days
                                    {selectedSubject ? ` &middot; ${selectedSubject.subjectName}` : ""}
                                    &middot; {gridFilterLabel}
                                </p>
                            </div>
                            <div className="teacher-attendance__legend flex flex-wrap items-center gap-3 text-[0.6875rem] font-bold">
                                <span className="teacher-attendance__legend-item inline-flex items-center gap-1.5">
                                    <span className="teacher-attendance__legend-swatch teacher-attendance__legend-swatch--present inline-flex items-center justify-center" aria-hidden="true">
                                        <FiCheck />
                                    </span>
                                    Present
                                </span>
                                <span className="teacher-attendance__legend-item inline-flex items-center gap-1.5">
                                    <span className="teacher-attendance__legend-swatch teacher-attendance__legend-swatch--absent inline-flex items-center justify-center" aria-hidden="true">
                                        <FiX />
                                    </span>
                                    Absent
                                </span>
                                <span className="teacher-attendance__legend-item inline-flex items-center gap-1.5">
                                    <span className="teacher-attendance__legend-swatch teacher-attendance__legend-swatch--none inline-flex items-center justify-center" aria-hidden="true">
                                        ·
                                    </span>
                                    Not recorded
                                </span>
                            </div>
                        </div>

                        {/* Why the grid is read-only / why nothing is shown. */}
                        {!canEdit && (
                            <p className="teacher-attendance__hint border-b px-5 py-3 text-[0.8125rem]">
                                Showing every quarter — pick a specific quarter (or use Create Attendance) to record or change attendance.
                            </p>
                        )}
                        {rangeInvalid ? (
                            <div className="teacher-attendance__sheet-wrap flex flex-col items-center justify-center px-6 py-14 text-center">
                                <span className="teacher-attendance__history-empty inline-flex h-12 w-12 items-center justify-center rounded-full text-lg" aria-hidden="true">
                                    <FiCalendar />
                                </span>
                                <p className="teacher-attendance__empty-title mt-3 text-sm font-bold">Invalid date range</p>
                                <p className="teacher-attendance__empty-text mt-1 text-[0.8125rem] text-gray-500">
                                    The “From” date is after the “To” date, so there is nothing to show. Adjust the range.
                                </p>
                            </div>
                        ) : matrixLoading ? (
                            <div className="teacher-attendance__sheet-wrap p-6" aria-busy="true">
                                <div className="h-40 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
                            </div>
                        ) : students.length === 0 ? (
                            <div className="teacher-attendance__sheet-wrap flex flex-col items-center justify-center px-6 py-14 text-center">
                                <span className="teacher-attendance__stat-icon inline-flex h-12 w-12 items-center justify-center rounded-full text-lg" aria-hidden="true">
                                    <FiUsers />
                                </span>
                                <p className="teacher-attendance__empty-title mt-3 text-sm font-bold">No students enrolled</p>
                                <p className="teacher-attendance__empty-text mt-1 text-[0.8125rem] text-gray-500">
                                    No students are enrolled in this class for the selected school year.
                                </p>
                            </div>
                        ) : gridDates.length === 0 ? (
                            <div className="teacher-attendance__sheet-wrap flex flex-col items-center justify-center px-6 py-14 text-center">
                                <span className="teacher-attendance__history-empty inline-flex h-12 w-12 items-center justify-center rounded-full text-lg" aria-hidden="true">
                                    <FiCalendar />
                                </span>
                                <p className="teacher-attendance__empty-title mt-3 text-sm font-bold">No attendance recorded for these filters</p>
                                <p className="teacher-attendance__empty-text mt-1 text-[0.8125rem] text-gray-500">
                                    Days only appear once they have a record, so open a day to start recording — or try another school year, quarter or date range.
                                </p>
                                <button
                                    type="button"
                                    className="teacher-attendance__save teacher-attendance__save--primary mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                    onClick={openCreateDialog}
                                    disabled={subjects.length === 0}
                                >
                                    <FiPlus aria-hidden="true" />
                                    Create Attendance
                                </button>
                            </div>
                        ) : (
                            <div className="teacher-attendance__grid-wrap overflow-x-auto">
                                <table className="teacher-attendance__grid border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th
                                                scope="col"
                                                className="teacher-attendance__grid-student-col px-4 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]"
                                            >
                                                Student
                                            </th>
                                            {gridDates.map((date) => (
                                                <th
                                                    key={date}
                                                    scope="col"
                                                    className="teacher-attendance__grid-th px-1 py-2 text-center text-[0.6875rem] font-semibold"
                                                    title={
                                                        pendingForKey.includes(date)
                                                            ? `${formatLongDate(date)} — new day, not recorded yet`
                                                            : formatLongDate(date)
                                                    }
                                                >
                                                    <span className="teacher-attendance__grid-date block whitespace-nowrap">
                                                        {formatShortDate(date)}
                                                    </span>
                                                    <span className="teacher-attendance__grid-weekday block text-[0.5625rem] font-normal uppercase">
                                                        {formatWeekday(date)}
                                                    </span>
                                                    {pendingForKey.includes(date) && (
                                                        <span className="teacher-attendance__grid-new block text-[0.5rem] font-bold uppercase">
                                                            New
                                                        </span>
                                                    )}
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            className="teacher-attendance__grid-all inline-flex cursor-pointer items-center justify-center rounded"
                                                            onClick={() => handleMarkDatePresent(date)}
                                                            disabled={busy}
                                                            aria-label={`Mark all students present on ${formatLongDate(date)}`}
                                                            title={`Mark all students present on ${formatLongDate(date)}`}
                                                        >
                                                            <FiCheck aria-hidden="true" />
                                                        </button>
                                                    )}
                                                </th>
                                            ))}
                                            <th
                                                scope="col"
                                                className="teacher-attendance__grid-th px-3 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em]"
                                            >
                                                Present
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student) => {
                                            const stats = rowStats.get(student.enrollmentId) ?? { present: 0, recorded: 0 };
                                            const rate =
                                                stats.recorded > 0
                                                    ? Math.round((stats.present / stats.recorded) * 1000) / 10
                                                    : null;
                                            return (
                                                <tr key={student.enrollmentId}>
                                                    <th scope="row" className="teacher-attendance__grid-student-col px-4 py-1.5 text-left">
                                                        <button
                                                            type="button"
                                                            className="teacher-attendance__student-cell teacher-attendance__student-cell--link flex items-center gap-2.5 text-left"
                                                            onClick={() => openHistory(student)}
                                                            title="View attendance history"
                                                            aria-label={`View attendance history for ${student.fullname}`}
                                                        >
                                                            <span className="teacher-attendance__student-avatar inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[0.625rem] font-bold uppercase" aria-hidden="true">
                                                                {getInitials(student.fullname)}
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="teacher-attendance__student-name block truncate text-[0.8125rem] font-bold">
                                                                    {student.fullname}
                                                                </span>
                                                                <span className="teacher-attendance__student-lrn mt-0.5 block font-mono text-[0.625rem]">
                                                                    {student.studentLrn}
                                                                </span>
                                                            </span>
                                                        </button>
                                                    </th>

                                                    {gridDates.map((date) => {
                                                        const key = cellKey(student.enrollmentId, date);
                                                        const status = cells[key];
                                                        const isSaving = savingCell === key || savingColumn === date;
                                                        const label = status === "present" ? "Present" : status === "absent" ? "Absent" : "Not recorded";
                                                        return (
                                                            <td key={date} className="teacher-attendance__grid-cell px-1 py-1.5 text-center">
                                                                <button
                                                                    type="button"
                                                                    className={`teacher-attendance__cell teacher-attendance__cell--${status ?? "none"}${
                                                                        isSaving ? " teacher-attendance__cell--saving" : ""
                                                                    }`}
                                                                    onClick={() => handleToggleCell(student, date)}
                                                                    disabled={!canEdit || busy}
                                                                    aria-label={`${student.fullname} on ${formatLongDate(date)}: ${label}. ${
                                                                        canEdit
                                                                            ? `Click to mark ${status === "present" ? "absent" : "present"}.`
                                                                            : "Pick a specific quarter to edit."
                                                                    }`}
                                                                    title={`${formatShortDate(date)} — ${label}`}
                                                                >
                                                                    {status === "present" ? (
                                                                        <FiCheck aria-hidden="true" />
                                                                    ) : status === "absent" ? (
                                                                        <FiX aria-hidden="true" />
                                                                    ) : (
                                                                        <span aria-hidden="true">·</span>
                                                                    )}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}

                                                    <td className="teacher-attendance__grid-cell teacher-attendance__grid-cell--summary px-3 py-1.5 text-center">
                                                        {stats.recorded === 0 ? (
                                                            <span className="text-gray-400">—</span>
                                                        ) : (
                                                            <span className="font-mono text-[0.75rem] font-bold">
                                                                {stats.present}
                                                                <span className="text-gray-400">/{stats.recorded}</span>
                                                                {rate !== null && (
                                                                    <span className="ml-1 text-[0.6875rem] font-semibold text-gray-500">
                                                                        {rate}%
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ==================== Grid footer ==================== */}
                        <div className="teacher-attendance__card-foot flex flex-wrap items-center justify-between gap-3 p-5">
                            <p className="teacher-attendance__foot-note flex items-center gap-2 text-[0.8125rem]">
                                <FiUserCheck aria-hidden="true" />
                                Range present rate: <strong>{totals.present} of {totals.recorded}</strong> recorded days
                                {totals.rate !== null ? ` · ${totals.rate}%` : ""}
                            </p>
                            <p className="teacher-attendance__foot-note flex items-center gap-2 text-[0.8125rem]">
                                <FiCalendar aria-hidden="true" />
                                {canEdit
                                    ? "Tap a cell to toggle Present / Absent, or the header tick to fill a day."
                                    : "Pick a quarter to edit attendance — or use Create Attendance to open a day."}
                            </p>
                        </div>
                    </div>

                    {/* ==================== Create-attendance dialog ==================== */}
                    {/* A day with no records has no column, and a column is the only
                        way to mark a student — so this dialog is how a brand-new
                        day is opened. It writes nothing on its own. */}
                    <ModalDialog
                        open={createOpen}
                        onClose={closeCreateDialog}
                        labelledById="teacher-attendance-create-title"
                        className="teacher-attendance__modal-panel w-full max-w-[30rem] overflow-y-auto rounded-3xl bg-white shadow-xl"
                        restoreFocusRef={createTriggerRef}
                    >
                        <header className="teacher-attendance__modal-header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="min-w-0">
                                <span className="teacher-attendance__modal-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                    New record
                                </span>
                                <h3 id="teacher-attendance-create-title" className="teacher-attendance__modal-title mt-0.5 text-xl font-bold">
                                    Create Attendance
                                </h3>
                                <p className="teacher-attendance__modal-subtitle mt-1 text-[0.8125rem]">
                                    Open a day for a subject, then mark each student present or absent.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="teacher-attendance__modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                                onClick={closeCreateDialog}
                                aria-label="Close dialog"
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <form className="teacher-attendance__form p-6" onSubmit={handleCreateAttendance} noValidate>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="attendance-create-subject"
                                    className="teacher-attendance__form-label text-[0.8125rem] font-semibold"
                                >
                                    Subject
                                </label>
                                <select
                                    id="attendance-create-subject"
                                    className="teacher-attendance__form-input w-full cursor-pointer rounded-lg border px-3 py-2.5 text-sm"
                                    autoFocus
                                    value={createForm.classSubjectId ?? ""}
                                    onChange={(event) =>
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            classSubjectId: event.target.value ? Number(event.target.value) : null,
                                        }))
                                    }
                                >
                                    {subjects.length === 0 && <option value="">No subjects assigned</option>}
                                    {subjects.map((subject) => (
                                        <option key={subject.classSubjectId} value={subject.classSubjectId}>
                                            {subject.subjectName} · Grade {subject.classGradeLevel} {subject.classSection}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="attendance-create-date"
                                        className="teacher-attendance__form-label text-[0.8125rem] font-semibold"
                                    >
                                        Date
                                    </label>
                                    <input
                                        id="attendance-create-date"
                                        type="date"
                                        className="teacher-attendance__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        value={createForm.date}
                                        max={toDateInputValue(new Date())}
                                        onChange={(event) =>
                                            setCreateForm((prev) => ({ ...prev, date: event.target.value }))
                                        }
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="attendance-create-quarter"
                                        className="teacher-attendance__form-label text-[0.8125rem] font-semibold"
                                    >
                                        Quarter
                                    </label>
                                    <select
                                        id="attendance-create-quarter"
                                        className="teacher-attendance__form-input w-full cursor-pointer rounded-lg border px-3 py-2.5 text-sm"
                                        value={createForm.quarter}
                                        onChange={(event) =>
                                            setCreateForm((prev) => ({ ...prev, quarter: Number(event.target.value) }))
                                        }
                                    >
                                        {quarters.map((quarter) => (
                                            <option key={quarter} value={quarter}>
                                                Quarter {quarter}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {createError && (
                                <p className="teacher-attendance__form-error mt-3 text-[0.8125rem]" role="alert">
                                    {createError}
                                </p>
                            )}

                            <p className="teacher-attendance__form-note mt-4 text-[0.8125rem]">
                                Nothing is saved yet: the day is added as a new column. Mark students there — or use
                                the ✓ in its header to mark the whole class present at once.
                            </p>

                            <div className="teacher-attendance__form-footer mt-5 flex items-center justify-end gap-2 border-t pt-4">
                                <button
                                    type="button"
                                    className="teacher-attendance__form-cancel inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                    onClick={closeCreateDialog}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="teacher-attendance__form-submit inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-bold"
                                    disabled={subjects.length === 0 || createChecking}
                                >
                                    <FiPlus aria-hidden="true" />
                                    {createChecking ? "Checking…" : "Create"}
                                </button>
                            </div>
                        </form>
                    </ModalDialog>
                </>
            )}
        </section>
    );
}
