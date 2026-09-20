import { useCallback, useEffect, useState } from "react";
import { FiBookOpen, FiGrid, FiHome, FiList, FiUsers } from "react-icons/fi";
import { getAPICall } from "../../api/api";
import Skeleton from "../../components/Skeleton";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import { useUser } from "../../hooks/useUser";
import { getInitials } from "../../helper/initials";

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
    studentBirthdate: string;
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

            // Fetch gradebook for each subject × quarter combination
            const gradebookResults = await Promise.all(
                subjects.flatMap((s) =>
                    quarters.map((q) =>
                        getAPICall<{ student: { enrollmentId: number; quarterGrade: number | null }[] }>(
                            `/gradebook/${s.classSubjectId}/details?quarter=${q}`
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
            <section className="teacher-classes flex flex-col gap-5" aria-busy="true">
                <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-classes__card-heading min-w-0">
                            <h3 className="teacher-classes__card-title text-base font-bold">My Class</h3>
                            <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">Loading…</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <Skeleton count={2} lines={1} height="10rem" radius="0.75rem" grid="repeat(2, 1fr)" />
                    </div>
                </div>
            </section>
        );
    }

    // Not an adviser
    if (!adviserClass || !adviserClass.classroom) {
        return (
            <section className="teacher-classes flex flex-col gap-5">
                <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-classes__card-heading min-w-0">
                            <h3 className="teacher-classes__card-title text-base font-bold">My Class</h3>
                            <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">
                                You are not assigned as a class adviser
                            </p>
                        </div>
                    </div>
                    <div className="teacher-classes__empty flex flex-col items-center justify-center px-6 py-14 text-center">
                        <span className="teacher-classes__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiHome />
                        </span>
                        <p className="teacher-classes__empty-title mt-3 text-sm font-bold">No advised class</p>
                        <p className="teacher-classes__empty-text mt-1 text-[0.8125rem]">
                            You are not assigned as a class adviser yet.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    const { classroom, teachersWithSubjects } = adviserClass;
    const students = roster?.students ?? [];

    return (
        <section className="teacher-classes flex flex-col gap-5">
            {/* Hero banner */}
            <div className="teacher-classes__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="teacher-classes__hero-main flex min-w-0 items-center gap-4">
                    <span className="teacher-classes__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold" aria-hidden="true">
                        <FiHome />
                    </span>
                    <div className="teacher-classes__hero-heading min-w-0">
                        <span className="teacher-classes__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Advised Class
                        </span>
                        <h2 className="teacher-classes__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            Grade {classroom.gradeLevel} — {classroom.section}
                        </h2>
                        <p className="teacher-classes__hero-role mt-0.5 truncate text-[0.8125rem]">
                            Classroom #{classroom.id}
                        </p>
                    </div>
                </div>
                <div className="teacher-classes__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="teacher-classes__hero-badge-count text-[1.375rem] font-bold leading-none">
                        {students.length}
                    </span>
                    <span className="teacher-classes__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        Students
                    </span>
                </div>
            </div>

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

                        <div className="teacher-classes__roster-table-wrap mt-4 overflow-x-auto rounded-xl border">
                            {teachersWithSubjects.length > 0 ? (
                                <table className="teacher-classes__roster-table w-full min-w-[32rem] border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Subject</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Code</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Teacher</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Units</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachersWithSubjects.map((ct) => (
                                            <tr key={`${ct.teacherId}-${ct.subjectId}`}>
                                                <td className="px-4 py-3.5">
                                                    <span className="text-[0.8125rem] font-bold">{ct.subjectName}</span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="teacher-classes__lrn-chip inline-flex items-center rounded-md px-2 py-1 font-mono text-[0.75rem]">
                                                        {ct.code}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="teacher-classes__student-cell flex items-center gap-3">
                                                        <span className="teacher-classes__student-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold uppercase" aria-hidden="true">
                                                            {getInitials(ct.teacherFullname)}
                                                        </span>
                                                        <span className="text-[0.8125rem] font-bold">{ct.teacherFullname}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="text-[0.8125rem]">{ct.unit}</span>
                                                </td>
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

                        <div className="teacher-classes__roster-table-wrap mt-4 overflow-x-auto rounded-xl border">
                            {loadingRoster ? (
                                <div className="p-5"><Skeleton count={4} lines={1} height="2.75rem" gap="0.75rem" /></div>
                            ) : students.length > 0 ? (
                                <table className="teacher-classes__roster-table w-full min-w-[46rem] border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">LRN</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Student Name</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Sex</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Age</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Birthdate</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student) => (
                                            <tr key={student.enrollmentId}>
                                                <td className="px-4 py-3.5">
                                                    <span className="teacher-classes__lrn-chip inline-flex items-center rounded-md px-2 py-1 font-mono text-[0.75rem]">
                                                        {student.studentLrn}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="teacher-classes__student-cell flex items-center gap-3">
                                                        <span className="teacher-classes__student-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold uppercase" aria-hidden="true">
                                                            {getInitials(student.fullname)}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="teacher-classes__student-name truncate text-[0.8125rem] font-bold">{student.fullname}</p>
                                                            <p className="teacher-classes__student-meta mt-0.5 font-mono text-[0.6875rem]">Student ID #{student.studentId}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`teacher-classes__sex inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold capitalize teacher-classes__sex--${student.studentSex.toLowerCase()}`}>
                                                        {student.studentSex}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">{student.studentAge}</td>
                                                <td className="px-4 py-3.5">{student.studentBirthdate}</td>
                                                <td className="px-4 py-3.5">{student.studentEmail}</td>
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

                    <div className="teacher-classes__roster-table-wrap mt-4 overflow-x-auto rounded-xl border">
                        {loadingGrades ? (
                            <div className="p-5"><Skeleton count={4} lines={1} height="2.75rem" gap="0.75rem" /></div>
                        ) : studentGrades.length > 0 ? (
                            <table className="teacher-classes__roster-table w-full min-w-[50rem] border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th rowSpan={2} className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                            Student
                                        </th>
                                        {teachersWithSubjects.map((s) => (
                                            <th key={s.classSubjectId} colSpan={quarters.length} className="border-x px-2 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em] bg-gray-50">
                                                <span className="block">{s.subjectName}</span>
                                                <span className="block font-normal normal-case text-gray-500">{s.code}</span>
                                            </th>
                                        ))}
                                    </tr>
                                    <tr>
                                        {teachersWithSubjects.map((s) => (
                                            quarters.map((q) => (
                                                <th key={`${s.classSubjectId}-q${q}`} className="px-2 py-1.5 text-center text-[0.625rem] font-semibold text-gray-500">
                                                    Q{q}
                                                </th>
                                            ))
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentGrades.map((sg) => (
                                        <tr key={sg.enrollmentId} className="hover:bg-gray-50">
                                            <td className="sticky left-0 z-10 bg-white px-4 py-3.5">
                                                <div className="teacher-classes__student-cell flex items-center gap-3">
                                                    <span className="teacher-classes__student-avatar inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[0.625rem] font-bold uppercase" aria-hidden="true">
                                                        {getInitials(sg.fullname)}
                                                    </span>
                                                    <span className="truncate text-[0.8125rem] font-bold">{sg.fullname}</span>
                                                </div>
                                            </td>
                                            {teachersWithSubjects.flatMap((s) =>
                                                quarters.map((q) => {
                                                    const grade = sg.grades[s.classSubjectId]?.[q]?.quarterGrade;
                                                    return (
                                                        <td key={`${sg.enrollmentId}-${s.classSubjectId}-q${q}`} className="px-2 py-3.5 text-center">
                                                            {grade != null ? (
                                                                <span className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-md text-[0.75rem] font-bold ${
                                                                    grade >= 75 ? "text-green-700"
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
        </section>
    );
}
