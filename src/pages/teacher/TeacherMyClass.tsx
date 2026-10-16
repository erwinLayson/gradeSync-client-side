import { useCallback, useEffect, useState } from "react";
import { FiBookOpen, FiGrid, FiHome, FiList, FiUsers } from "react-icons/fi";
import { getAPICall } from "../../api/api";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import { useUser } from "../../hooks/useUser";
import { isPassing } from "../../helper/grades";

import type { ClassroomResponseProps, ClassroomTeachersWithSubjectProps } from "../../constant/classrooms";

import "../../style/teacherClasses.css";

interface AdvisedClassData {
    classroom: ClassroomResponseProps | null;
    teachersWithSubjects: ClassroomTeachersWithSubjectProps[];
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

export default function TeacherMyClass() {
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
            const subjects = adviserClass.teachersWithSubjects;

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
    }, [adviserClass, roster]);

    // Fetch grades when switching to grades view
    useEffect(() => {
        if (viewMode === "grades" && studentGrades.length === 0) {
            fetchGrades();
        }
    }, [viewMode, studentGrades.length, fetchGrades]);

    // Loading state
    if (userLoading || loading) {
        return (
            <PageShell className="teacher-classes" busy>
                <PageSection className="teacher-classes__card" title="My Class" description="Loading…" flush>
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
            <PageShell className="teacher-classes">
                <PageSection
                    className="teacher-classes__card"
                    title="My Class"
                    description="You are not assigned as a class adviser"
                >
                    <div className="teacher-classes__empty flex flex-col items-center justify-center py-10 text-center">
                        <span className="teacher-classes__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiHome />
                        </span>
                        <p className="teacher-classes__empty-title mt-3 text-sm font-bold">No advised class</p>
                        <p className="teacher-classes__empty-text mt-1 text-[0.8125rem]">
                            You are not assigned as a class adviser yet.
                        </p>
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    const { classroom, teachersWithSubjects } = adviserClass;
    const students = roster?.students ?? [];

    return (
        <PageShell className="teacher-classes">
            {/* Header */}
            <PageHeader
                title={`Grade ${classroom.gradeLevel} — ${classroom.section}`}
                description={`Classroom #${classroom.id}`}
                meta={`${students.length} students`}
            />

            {/* Quick stats */}
            <div className="teacher-classes__stats grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--green inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiHome />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Grade Level</span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            Grade {classroom.gradeLevel} — {classroom.section}
                        </span>
                    </div>
                </div>
                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--blue inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Students</span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">{students.length}</span>
                    </div>
                </div>
                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--amber inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subjects</span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">{teachersWithSubjects.length}</span>
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
                    onClick={() => setViewMode("grades")}
                >
                    <FiGrid aria-hidden="true" />
                    Graded
                </button>
            </div>

            {/* ==================== Roster View ==================== */}
            {viewMode === "roster" && (
                <>
                    {/* Subjects & Teachers */}
                    <section className="teacher-classes__subjects" aria-label="Subjects and teachers">
                        <div className="teacher-classes__roster-head flex flex-wrap items-center justify-between gap-3">
                            <div className="teacher-classes__roster-heading min-w-0">
                                <h4 className="teacher-classes__roster-title text-[0.9375rem] font-bold">Subjects & Teachers</h4>
                                <p className="teacher-classes__roster-subtitle mt-1 text-[0.8125rem]">
                                    All subjects and teachers in your advised class
                                </p>
                            </div>
                            {teachersWithSubjects.length > 0 && (
                                <span className="teacher-classes__roster-count inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                    <FiBookOpen aria-hidden="true" />
                                    {teachersWithSubjects.length} {teachersWithSubjects.length === 1 ? "subject" : "subjects"}
                                </span>
                            )}
                        </div>

                        <div className="data-table__wrap mt-4 rounded-xl border">
                            {teachersWithSubjects.length > 0 ? (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="data-table__th w-56">Subject</th>
                                            <th scope="col" className="data-table__th w-24">Code</th>
                                            <th scope="col" className="data-table__th w-48">Teacher</th>
                                            <th scope="col" className="data-table__th data-table__th--num w-20">Units</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachersWithSubjects.map((ct) => (
                                            <tr key={`${ct.teacherId}-${ct.subjectId}`} className="data-table__row">
                                                <td className="data-table__td data-table__td--primary">{ct.subjectName}</td>
                                                <td className="data-table__td data-table__td--mono">{ct.code}</td>
                                                <td className="data-table__td">{ct.teacherFullname}</td>
                                                <td className="data-table__td data-table__td--num">{ct.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="teacher-classes__roster-empty flex flex-col items-center justify-center px-6 py-10 text-center">
                                    <FiBookOpen className="text-gray-400" />
                                    <p className="mt-3 text-sm font-bold">No subjects assigned</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Class Roster */}
                    <section className="teacher-classes__roster" aria-label="Class roster">
                        <div className="teacher-classes__roster-head flex flex-wrap items-center justify-between gap-3">
                            <div className="teacher-classes__roster-heading min-w-0">
                                <h4 className="teacher-classes__roster-title text-[0.9375rem] font-bold">Class Roster</h4>
                                <p className="teacher-classes__roster-subtitle mt-1 text-[0.8125rem]">Students enrolled in your class</p>
                            </div>
                            {!loadingRoster && students.length > 0 && (
                                <span className="teacher-classes__roster-count inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                    <FiUsers aria-hidden="true" />
                                    {students.length} {students.length === 1 ? "student" : "students"}
                                </span>
                            )}
                        </div>

                        <div className="data-table__wrap mt-4 rounded-xl border">
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
                                        {students.map((student) => (
                                            <tr key={student.enrollmentId} className="data-table__row">
                                                <td className="data-table__td data-table__td--mono">
                                                    {student.studentLrn}
                                                </td>
                                                <td className="data-table__td">
                                                    <span className="data-table__value">{student.fullname}</span>
                                                    <span className="data-table__sub">Student ID #{student.studentId}</span>
                                                </td>
                                                <td className="data-table__td data-table__td--center">
                                                    <span className={`teacher-classes__sex inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold capitalize teacher-classes__sex--${student.studentSex.toLowerCase()}`}>
                                                        {student.studentSex}
                                                    </span>
                                                </td>
                                                <td className="data-table__td data-table__td--center">{student.studentAge}</td>
                                                <td className="data-table__td data-table__td--muted">{student.studentBirthdate}</td>
                                                <td className="data-table__td data-table__td--muted">
                                                    <span className="data-table__truncate">{student.studentEmail}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="teacher-classes__roster-empty flex flex-col items-center justify-center px-6 py-10 text-center">
                                    <FiUsers className="text-gray-400" />
                                    <p className="mt-3 text-sm font-bold">No students enrolled</p>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {/* ==================== Grades View ==================== */}
            {viewMode === "grades" && (
                <section className="teacher-classes__roster" aria-label="Student grades">
                    <div className="teacher-classes__roster-head flex flex-wrap items-center justify-between gap-3">
                        <div className="teacher-classes__roster-heading min-w-0">
                            <h4 className="teacher-classes__roster-title text-[0.9375rem] font-bold">Student Grades</h4>
                            <p className="teacher-classes__roster-subtitle mt-1 text-[0.8125rem]">
                                Live grades for all students across all subjects (Q1–Q{numQuarters})
                            </p>
                        </div>
                        {!loadingGrades && studentGrades.length > 0 && (
                            <span className="teacher-classes__roster-count inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                <FiGrid aria-hidden="true" />
                                {studentGrades.length} students &times; {teachersWithSubjects.length} subjects
                            </span>
                        )}
                    </div>

                    <div className="data-table__wrap mt-4 rounded-xl border">
                        {loadingGrades ? (
                            <div className="p-5"><Skeleton count={4} lines={1} height="2.75rem" gap="0.75rem" /></div>
                        ) : studentGrades.length > 0 ? (
                            // Quarter columns share the leftover width evenly, so the
                            // table needs at least 4rem per cell to keep "Q1" and a
                            // three-digit grade readable.
                            <table
                                className="data-table"
                                style={{ minWidth: `${12 + teachersWithSubjects.length * quarters.length * 4}rem` }}
                            >
                                <thead>
                                    <tr>
                                        <th rowSpan={2} scope="col" className="data-table__th data-table__sticky w-48">
                                            Student
                                        </th>
                                        {teachersWithSubjects.map((s) => (
                                            <th key={s.classSubjectId} colSpan={quarters.length} scope="colgroup" className="data-table__th border-x text-center">
                                                <span className="data-table__value block">{s.subjectName}</span>
                                                <span className="data-table__sub block font-mono">{s.code}</span>
                                            </th>
                                        ))}
                                    </tr>
                                    <tr>
                                        {teachersWithSubjects.map((s) => (
                                            quarters.map((q) => (
                                                <th key={`${s.classSubjectId}-q${q}`} scope="col" className="data-table__th data-table__th--center">
                                                    Q{q}
                                                </th>
                                            ))
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentGrades.map((sg) => (
                                        <tr key={sg.enrollmentId} className="data-table__row">
                                            <td className="data-table__td data-table__td--primary data-table__sticky">
                                                {sg.fullname}
                                            </td>
                                            {teachersWithSubjects.flatMap((s) =>
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
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="teacher-classes__roster-empty flex flex-col items-center justify-center px-6 py-10 text-center">
                                <FiGrid className="text-gray-400" />
                                <p className="mt-3 text-sm font-bold">No grades available</p>
                                <p className="mt-1 text-[0.8125rem]">
                                    Grades will appear here once teachers start recording scores.
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </PageShell>
    );
}
