import { Fragment, useCallback, useEffect, useState } from "react";
import {
    FiBookOpen,
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight,
    FiChevronUp,
    FiGrid,
    FiHome,
    FiInfo,
    FiList,
    FiMail,
    FiUsers,
} from "react-icons/fi";
import { getAPICall } from "../../api/api";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import { useUser } from "../../hooks/useUser";
import { isPassing } from "../../helper/grades";

import type { ClassroomResponseProps, ClassroomFacultiesWithSubjectProps } from "../../constant/classrooms";

import "../../style/facultyClasses.css";

interface AdvisedClassData {
    classroom: ClassroomResponseProps | null;
    facultiesWithSubjects: ClassroomFacultiesWithSubjectProps[];
}

interface Student {
    enrollmentId: number;
    studentId: number;
    studentLrn: string;
    studentEmail: string;
    fullname: string;
    // Nullable: the roster endpoint formats the nullable students.birthdate column.
    studentBirthdate: string | null;
    studentAge: number;
    studentSex: string;
}

interface ClassroomWithStudents extends ClassroomResponseProps {
    students: Student[];
}

/** A single student's grades across all subjects and quarters. */
interface StudentGrades {
    enrollmentId: number;
    fullname: string;
    // classSubjectId → quarter (1-4) → grade
    grades: Record<number, Record<number, { quarterGrade: number | null }>>;
}

type ViewMode = "roster" | "grades";

function getInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
}

export default function FacultyMyClass() {
    const { user, loading: userLoading } = useUser();
    const { quarters, numQuarters } = useAcademicSettings();

    const [adviserClass, setAdviserClass] = useState<AdvisedClassData | null>(null);
    const [roster, setRoster] = useState<ClassroomWithStudents | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingRoster, setLoadingRoster] = useState(false);

    // View toggle
    const [viewMode, setViewMode] = useState<ViewMode>("roster");

    // Grades data
    const [studentGrades, setStudentGrades] = useState<StudentGrades[]>([]);
    const [loadingGrades, setLoadingGrades] = useState(false);

    // ================ Mobile preview collapse / expand state ================
    const [isStudentColCollapsed, setIsStudentColCollapsed] = useState<boolean>(false);
    const [expandedRosterStudentIds, setExpandedRosterStudentIds] = useState<Set<number>>(new Set());

    const toggleRosterStudentRow = useCallback((enrollmentId: number) => {
        setExpandedRosterStudentIds((prev) => {
            const next = new Set(prev);
            if (next.has(enrollmentId)) {
                next.delete(enrollmentId);
            } else {
                next.add(enrollmentId);
            }
            return next;
        });
    }, []);

    const toggleAllRosterStudents = useCallback(() => {
        const studentList = roster?.students ?? [];
        setExpandedRosterStudentIds((prev) => {
            if (prev.size === studentList.length) {
                return new Set();
            }
            return new Set(studentList.map((s) => s.enrollmentId));
        });
    }, [roster]);

    // Fetch adviser's class + roster
    useEffect(() => {
        if (userLoading) return;

        let cancelled = false;

        async function loadAdviserClass() {
            if (!user) return;

            try {
                const res = await getAPICall<AdvisedClassData>("/classrooms/my-advised-class");
                if (cancelled) return;
                setAdviserClass(res.data ?? null);

                const data = res.data;
                if (data?.classroom) {
                    setLoadingRoster(true);
                    const rosterRes = await getAPICall<ClassroomWithStudents>(
                        `/class/${data.classroom.id}/students`
                    );
                    if (!cancelled) {
                        setRoster(rosterRes.data ?? null);
                        setLoadingRoster(false);
                    }
                }
            } catch {
                // Error toast handled by API interceptor
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadAdviserClass();
        return () => { cancelled = true; };
    }, [user, userLoading]);

    // Fetch grades for all subjects and all quarters when switching to grades view
    const fetchGrades = useCallback(async () => {
        if (!adviserClass || !roster || roster.students.length === 0) return;

            setLoadingGrades(true);
        try {
            const subjects = adviserClass.facultiesWithSubjects;

            // Fetch gradebook for each subject × quarter combination. These are a
            // fan-out of best-effort reads (the table degrades to "—" per cell),
            // so a failure for one subject must not raise a global error toast.
            const gradebookResults = await Promise.all(
                subjects.flatMap((s) =>
                    quarters.map((q) =>
                        getAPICall<{ student: { enrollmentId: number; quarterGrade: number | null }[] }>(
                            `/gradebook/${s.classSubjectId}/details?quarter=${q}`,
                            { skipErrorToast: true }
                        ).catch(() => ({ data: null }))
                    )
                )
            );

            // Build grades matrix: enrollmentId → classSubjectId → quarter → grade
            const gradesMap = new Map<number, Record<number, Record<number, { quarterGrade: number | null }>>>();

            let idx = 0;
            for (const subject of subjects) {
                for (const q of quarters) {
                    const result = gradebookResults[idx++];
                    if (!result?.data?.student) continue;

                    for (const row of result.data.student) {
                        if (!gradesMap.has(row.enrollmentId)) {
                            gradesMap.set(row.enrollmentId, {});
                        }
                        const bySubject = gradesMap.get(row.enrollmentId)!;
                        if (!bySubject[subject.classSubjectId]) {
                            bySubject[subject.classSubjectId] = {};
                        }
                        bySubject[subject.classSubjectId][q] = { quarterGrade: row.quarterGrade };
                    }
                }
            }

            // Build final array matching roster order
            const grades: StudentGrades[] = roster.students.map((s) => ({
                enrollmentId: s.enrollmentId,
                fullname: s.fullname,
                grades: gradesMap.get(s.enrollmentId) ?? {},
            }));

            setStudentGrades(grades);
        } catch {
            // Error toast handled by API interceptor
        } finally {
            setLoadingGrades(false);
        }
    }, [adviserClass, roster, quarters]);

    const handleSwitchToGrades = useCallback(() => {
        setViewMode("grades");
        if (studentGrades.length === 0) {
            void fetchGrades();
        }
    }, [fetchGrades, studentGrades.length]);

    // Loading state
    if (userLoading || loading) {
        return (
            <PageShell className="faculty-classes" busy>
                <PageSection className="faculty-classes__card" title="My Class" description="Loading…" flush>
                    <div className="p-6">
                        <Skeleton count={2} lines={1} height="10rem" radius="0.75rem" grid="repeat(2, 1fr)" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    // Not an adviser
    if (!adviserClass || !adviserClass.classroom) {
        return (
            <PageShell className="faculty-classes">
                <PageSection
                    className="faculty-classes__card"
                    title="My Class"
                    description="You are not assigned as a class adviser"
                >
                    <div className="faculty-classes__empty flex flex-col items-center justify-center py-10 text-center">
                        <span className="faculty-classes__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiHome />
                        </span>
                        <p className="faculty-classes__empty-title mt-3 text-sm font-bold">No advised class</p>
                        <p className="faculty-classes__empty-text mt-1 text-[0.8125rem]">
                            You are not assigned as a class adviser yet.
                        </p>
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    const { classroom, facultiesWithSubjects } = adviserClass;
    const students = roster?.students ?? [];

    return (
        <PageShell className="faculty-classes">
            {/* Header */}
            <PageHeader
                title={`Grade ${classroom.gradeLevel} — ${classroom.section}`}
                description={`Classroom #${classroom.id}`}
                meta={`${students.length} students`}
            />

            {/* Quick stats */}
            <div className="faculty-classes__stats grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="faculty-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="faculty-classes__stat-icon faculty-classes__stat-icon--green inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiHome />
                    </span>
                    <div className="min-w-0">
                        <span className="faculty-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Grade Level</span>
                        <span className="faculty-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            Grade {classroom.gradeLevel} — {classroom.section}
                        </span>
                    </div>
                </div>
                <div className="faculty-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="faculty-classes__stat-icon faculty-classes__stat-icon--blue inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="faculty-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Students</span>
                        <span className="faculty-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">{students.length}</span>
                    </div>
                </div>
                <div className="faculty-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="faculty-classes__stat-icon faculty-classes__stat-icon--amber inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="faculty-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subjects</span>
                        <span className="faculty-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">{facultiesWithSubjects.length}</span>
                    </div>
                </div>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-[0.8125rem] font-bold transition-colors ${
                        viewMode === "roster"
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setViewMode("roster")}
                >
                    <FiList aria-hidden="true" />
                    Roster
                </button>
                <button
                    type="button"
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-[0.8125rem] font-bold transition-colors ${
                        viewMode === "grades"
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={handleSwitchToGrades}
                >
                    <FiGrid aria-hidden="true" />
                    Graded
                </button>
            </div>

            {/* ==================== Roster View ==================== */}
            {viewMode === "roster" && (
                <section className="faculty-classes__roster" aria-label="Class roster">
                        <div className="faculty-classes__roster-head flex flex-wrap items-center justify-between gap-3">
                            <div className="faculty-classes__roster-heading min-w-0">
                                <h4 className="faculty-classes__roster-title text-[0.9375rem] font-bold">Class Roster</h4>
                                <p className="faculty-classes__roster-subtitle mt-1 text-[0.8125rem]">Students enrolled in your class</p>
                            </div>
                            {!loadingRoster && students.length > 0 && (
                                <span className="faculty-classes__roster-count inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                    <FiUsers aria-hidden="true" />
                                    {students.length} {students.length === 1 ? "student" : "students"}
                                </span>
                            )}
                        </div>

                        {/* Mobile preview helper & toggle toolbar */}
                        {!loadingRoster && students.length > 0 && (
                            <div className="mt-3 flex md:hidden items-center justify-between px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs">
                                <div className="flex items-center gap-1.5 text-neutral-600">
                                    <FiInfo className="w-3.5 h-3.5 text-[#176B3A] shrink-0" />
                                    <span>Tap student name to expand details</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleAllRosterStudents}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-md border border-neutral-300 bg-white text-neutral-800 shadow-2xs hover:bg-neutral-100 active:scale-95 transition cursor-pointer"
                                >
                                    {expandedRosterStudentIds.size === students.length ? "Collapse All" : "Expand All"}
                                </button>
                            </div>
                        )}

                        <div className="data-table__wrap mt-4">
                            {loadingRoster ? (
                                <div className="p-5"><Skeleton count={4} lines={1} height="2.75rem" gap="0.75rem" /></div>
                            ) : students.length > 0 ? (
                                <table className="data-table min-w-[52rem]">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="data-table__th w-32">LRN</th>
                                            <th scope="col" className="data-table__th w-48">Student Name</th>
                                            <th scope="col" className="data-table__th data-table__th--center w-16">Sex</th>
                                            <th scope="col" className="data-table__th data-table__th--center w-16">Age</th>
                                            <th scope="col" className="data-table__th w-28">Birthdate</th>
                                            <th scope="col" className="data-table__th w-56">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student) => {
                                            const isRowExpanded = expandedRosterStudentIds.has(student.enrollmentId);
                                            return (
                                                <Fragment key={student.enrollmentId}>
                                                    <tr className={`data-table__row transition-colors ${isRowExpanded ? "bg-emerald-50/30" : ""}`}>
                                                        <td className="data-table__td data-table__td--mono">
                                                            {student.studentLrn}
                                                        </td>
                                                        <td className="data-table__td">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div
                                                                    className="flex flex-col min-w-0 cursor-pointer select-none group"
                                                                    onClick={() => toggleRosterStudentRow(student.enrollmentId)}
                                                                    title="Click to expand/collapse student profile"
                                                                >
                                                                    <span className="data-table__value group-hover:text-[#176B3A] transition-colors">{student.fullname}</span>
                                                                    <span className="data-table__sub">Student ID #{student.studentId}</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleRosterStudentRow(student.enrollmentId);
                                                                    }}
                                                                    className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                                                                        isRowExpanded
                                                                            ? "bg-emerald-100/80 text-[#176B3A]"
                                                                            : "hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
                                                                    }`}
                                                                    title={isRowExpanded ? "Collapse student details" : "Expand student details"}
                                                                    aria-label={isRowExpanded ? "Collapse student details" : "Expand student details"}
                                                                    aria-expanded={isRowExpanded}
                                                                >
                                                                    {isRowExpanded ? (
                                                                        <FiChevronUp className="w-4 h-4 text-[#176B3A]" />
                                                                    ) : (
                                                                        <FiChevronDown className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="data-table__td data-table__td--center">
                                                            <span className={`faculty-classes__sex inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold capitalize faculty-classes__sex--${student.studentSex.toLowerCase()}`}>
                                                                {student.studentSex}
                                                            </span>
                                                        </td>
                                                        <td className="data-table__td data-table__td--center">{student.studentAge}</td>
                                                        <td className="data-table__td data-table__td--muted">{student.studentBirthdate ?? "—"}</td>
                                                        <td className="data-table__td data-table__td--muted">
                                                            <span className="data-table__truncate">{student.studentEmail}</span>
                                                        </td>
                                                    </tr>

                                                    {/* Mobile / Compact Expanded Roster Row */}
                                                    {isRowExpanded && (
                                                        <tr className="bg-[#F7FAF8] border-b border-gray-200">
                                                            <td colSpan={6} className="p-3 sm:p-4">
                                                                <div className="faculty-classes__accordion-card sticky left-2 sm:left-4 max-w-[calc(100vw-2.5rem)] sm:max-w-2xl rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                                                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                                                                        <div className="flex items-center gap-2.5">
                                                                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF5EE] text-[#176B3A] font-bold text-xs border border-[#176B3A]/20">
                                                                                {getInitials(student.fullname)}
                                                                            </span>
                                                                            <div>
                                                                                <h4 className="font-bold text-sm text-gray-900">{student.fullname}</h4>
                                                                                <p className="text-xs text-gray-500 font-mono">Student ID #{student.studentId}</p>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleRosterStudentRow(student.enrollmentId)}
                                                                            className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer"
                                                                            title="Collapse row"
                                                                        >
                                                                            <FiChevronUp className="w-4 h-4" />
                                                                        </button>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                                        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                                                                            <span className="text-[0.625rem] font-bold uppercase text-gray-400 block">LRN</span>
                                                                            <span className="font-mono font-bold text-gray-800">{student.studentLrn}</span>
                                                                        </div>
                                                                        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                                                                            <span className="text-[0.625rem] font-bold uppercase text-gray-400 block">Sex</span>
                                                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold capitalize mt-0.5 faculty-classes__sex--${student.studentSex.toLowerCase()}`}>
                                                                                {student.studentSex}
                                                                            </span>
                                                                        </div>
                                                                        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                                                                            <span className="text-[0.625rem] font-bold uppercase text-gray-400 block">Age</span>
                                                                            <span className="font-bold text-gray-800">{student.studentAge} yrs old</span>
                                                                        </div>
                                                                        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                                                                            <span className="text-[0.625rem] font-bold uppercase text-gray-400 block">Birthdate</span>
                                                                            <span className="text-gray-700">{student.studentBirthdate ?? "—"}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
                                                                        <span className="text-gray-500 flex items-center gap-1.5">
                                                                            <FiMail className="w-3.5 h-3.5 text-gray-400" />
                                                                            Email:
                                                                        </span>
                                                                        <span className="font-mono text-gray-800 truncate select-all">{student.studentEmail}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="faculty-classes__roster-empty flex flex-col items-center justify-center px-6 py-10 text-center">
                                    <FiUsers className="text-gray-400" />
                                    <p className="mt-3 text-sm font-bold">No students enrolled</p>
                                </div>
                            )}
                        </div>
                    </section>
            )}

            {/* ==================== Grades View ==================== */}
            {viewMode === "grades" && (
                <section className="faculty-classes__roster" aria-label="Student grades">
                    <div className="faculty-classes__roster-head flex flex-wrap items-center justify-between gap-3">
                        <div className="faculty-classes__roster-heading min-w-0">
                            <h4 className="faculty-classes__roster-title text-[0.9375rem] font-bold">Student Grades</h4>
                            <p className="faculty-classes__roster-subtitle mt-1 text-[0.8125rem]">
                                Live grades for all students across all subjects (Q1–Q{numQuarters})
                            </p>
                        </div>
                        {!loadingGrades && studentGrades.length > 0 && (
                            <span className="faculty-classes__roster-count inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                <FiGrid aria-hidden="true" />
                                {studentGrades.length} students &times; {facultiesWithSubjects.length} subjects
                            </span>
                        )}
                    </div>

                    <div className="data-table__wrap mt-4">
                        {loadingGrades ? (
                            <div className="p-5"><Skeleton count={4} lines={1} height="2.75rem" gap="0.75rem" /></div>
                        ) : studentGrades.length > 0 ? (
                            // Quarter columns share the leftover width evenly, so the
                            // table needs at least 4rem per cell to keep "Q1" and a
                            // three-digit grade readable.
                            <table
                                className="data-table"
                                style={{ minWidth: isStudentColCollapsed ? `${6 + facultiesWithSubjects.length * quarters.length * 4}rem` : `${12 + facultiesWithSubjects.length * quarters.length * 4}rem` }}
                            >
                                <thead>
                                    <tr>
                                        <th
                                            rowSpan={2}
                                            scope="col"
                                            className={`data-table__th data-table__sticky transition-all ${
                                                isStudentColCollapsed ? "w-16 min-w-[4rem] text-center" : "w-48"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span className="flex items-center gap-1.5 truncate">
                                                    <FiUsers className="w-4 h-4 text-gray-400 shrink-0" />
                                                    {!isStudentColCollapsed && <span>Student</span>}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsStudentColCollapsed((prev) => !prev)}
                                                    className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer shrink-0"
                                                    title={isStudentColCollapsed ? "Expand student column" : "Collapse student column"}
                                                    aria-label={isStudentColCollapsed ? "Expand student column" : "Collapse student column"}
                                                >
                                                    {isStudentColCollapsed ? (
                                                        <FiChevronRight className="w-4 h-4 text-[#176B3A]" />
                                                    ) : (
                                                        <FiChevronLeft className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </th>
                                        {facultiesWithSubjects.map((s) => (
                                            <th key={s.classSubjectId} colSpan={quarters.length} scope="colgroup" className="data-table__th text-center">
                                                <span className="data-table__value block">{s.subjectName}</span>
                                                <span className="data-table__sub block font-mono">{s.code}</span>
                                            </th>
                                        ))}
                                    </tr>
                                    <tr>
                                        {facultiesWithSubjects.map((s) => (
                                            quarters.map((q) => (
                                                <th key={`${s.classSubjectId}-q${q}`} scope="col" className="data-table__th data-table__th--center">
                                                    Q{q}
                                                </th>
                                            ))
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentGrades.map((sg) => {
                                        const studentMeta = roster?.students.find((s) => s.enrollmentId === sg.enrollmentId);

                                        return (
                                            <tr key={sg.enrollmentId} className="data-table__row transition-colors">
                                                    <td className="data-table__td data-table__td--primary data-table__sticky">
                                                        {isStudentColCollapsed ? (
                                                            <span
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF5EE] text-[#176B3A] font-bold text-xs border border-[#176B3A]/20"
                                                                title={sg.fullname}
                                                            >
                                                                {getInitials(sg.fullname)}
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="data-table__value truncate font-bold text-[0.8125rem]">
                                                                    {sg.fullname}
                                                                </span>
                                                                {studentMeta?.studentLrn ? (
                                                                    <span className="data-table__sub font-mono text-[0.6875rem] text-gray-400">
                                                                        LRN {studentMeta.studentLrn}
                                                                    </span>
                                                                ) : (
                                                                    <span className="data-table__sub font-mono text-[0.6875rem] text-gray-400">
                                                                        ID #{sg.enrollmentId}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    {facultiesWithSubjects.flatMap((s) =>
                                                        quarters.map((q) => {
                                                            const grade = sg.grades[s.classSubjectId]?.[q]?.quarterGrade;
                                                            return (
                                                                <td key={`${sg.enrollmentId}-${s.classSubjectId}-q${q}`} className="data-table__td data-table__td--center">
                                                                    {grade != null ? (
                                                                        <span className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-md text-[0.75rem] font-bold ${
                                                                            isPassing(grade) ? "text-green-700"
                                                                            : "text-red-700"
                                                                        }`}>
                                                                            {grade.toFixed(1)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-400">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })
                                                    )}
                                                </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="faculty-classes__roster-empty flex flex-col items-center justify-center px-6 py-10 text-center">
                                <FiGrid className="text-gray-400" />
                                <p className="mt-3 text-sm font-bold">No grades available</p>
                                <p className="mt-1 text-[0.8125rem]">
                                    Grades will appear here once faculties start recording scores.
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </PageShell>
    );
}
