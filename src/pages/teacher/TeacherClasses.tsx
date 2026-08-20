import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiBookOpen, FiClipboard, FiClock, FiHome, FiUsers } from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { useUser } from "../../hooks/useUser";
import { getInitials } from "../../helper/initials";

import type { TeacherDetails, TeacherSubjectDetails } from "../../constant/teachers";
import type { ClassroomResponseProps, ClassroomWithStudentsProps } from "../../constant/classrooms";

import "../../style/teacherClasses.css";

interface ClassGroup {
    classId: number;
    classSection: string;
    classGradeLevel: number;
    subjects: TeacherSubjectDetails[];
}

export default function TeacherClasses() {
    const { user, loading: userLoading } = useUser();
    const navigate = useNavigate();

    // ==================== State ====================
    const [teacher, setTeacher] = useState<TeacherDetails | null>(null);
    const [subjectDetails, setSubjectDetails] = useState<TeacherSubjectDetails[] | null>(null);
    const [classrooms, setClassrooms] = useState<ClassroomResponseProps[]>([]);
    const [loading, setLoading] = useState(true);

    // Selected class detail view
    const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
    const [roster, setRoster] = useState<ClassroomWithStudentsProps | null>(null);
    const [loadingRoster, setLoadingRoster] = useState(false);
    // Guards against stale roster responses arriving after switching classes / going back
    const rosterRequestRef = useRef(0);

    // ==================== Fetch real class data ====================
    useEffect(() => {
        // Wait for the account verification to resolve before loading.
        if (userLoading) return;

        let cancelled = false;

        async function loadTeacherClasses() {
            if (!user) {
                return;
            }

            try {
                // 1. Find the teacher record linked to the logged-in account
                const teacherRes = await getAPICall<TeacherDetails>(`/teachers/by-user/${user.id}`);
                const teacherData = teacherRes.data ?? null;
                if (cancelled) return;
                setTeacher(teacherData);

                if (!teacherData) {
                    setLoading(false);
                    return;
                }

                // 2. Load the classes/subjects this teacher handles + student counts
                const [subjectsRes, classroomsRes] = await Promise.all([
                    getAPICall<TeacherSubjectDetails[]>(`/teachers/${teacherData.id}/subjects`),
                    getAPICall<ClassroomResponseProps[]>("/classrooms"),
                ]);
                if (cancelled) return;
                setSubjectDetails(subjectsRes.data ?? null);
                setClassrooms(classroomsRes.data ?? []);
            } catch {
                // Error toast is handled by the API interceptor
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadTeacherClasses();
        return () => {
            cancelled = true;
        };
    }, [user, userLoading]);

    // ==================== Derived data ====================
    // Group the flat subject rows into per-class cards
    const classes = useMemo<ClassGroup[]>(() => {
        if (!subjectDetails) return [];
        const map = new Map<number, ClassGroup>();
        for (const row of subjectDetails) {
            const group = map.get(row.classId);
            if (group) {
                group.subjects.push(row);
            } else {
                map.set(row.classId, {
                    classId: row.classId,
                    classSection: row.classSection,
                    classGradeLevel: row.classGradeLevel,
                    subjects: [row],
                });
            }
        }
        return [...map.values()];
    }, [subjectDetails]);

    const totalStudents = useMemo(
        () =>
            classes.reduce(
                (sum, c) => sum + (classrooms.find((cl) => cl.id === c.classId)?.totalStudent ?? 0),
                0
            ),
        [classes, classrooms]
    );
    const totalSubjects = subjectDetails?.length ?? 0;
    const weeklyHours = subjectDetails?.reduce((sum, row) => sum + Number(row.subjectUnit), 0) ?? 0;

    function studentCountFor(classId: number): number {
        return classrooms.find((cl) => cl.id === classId)?.totalStudent ?? 0;
    }

    function subjectHoursFor(group: ClassGroup): number {
        return group.subjects.reduce((sum, row) => sum + Number(row.subjectUnit), 0);
    }

    // ==================== Class roster handlers ====================
    async function handleSelectClass(classItem: ClassGroup) {
        const requestId = ++rosterRequestRef.current;
        setSelectedClass(classItem);
        setRoster(null);
        setLoadingRoster(true);
        try {
            const response = await getAPICall<ClassroomWithStudentsProps>(
                `/class/${classItem.classId}/students`
            );
            // Ignore stale responses if the user navigated away or switched classes
            if (rosterRequestRef.current !== requestId) return;
            setRoster(response.data ?? null);
        } catch {
            // Error toast is handled by the API interceptor
        } finally {
            if (rosterRequestRef.current === requestId) {
                setLoadingRoster(false);
            }
        }
    }

    function handleBackToClasses() {
        // Invalidate any in-flight roster request
        rosterRequestRef.current++;
        setSelectedClass(null);
        setRoster(null);
    }

    // ==================== Loading state ====================
    if (userLoading || loading) {
        return (
            <section className="teacher-classes flex flex-col gap-5" aria-busy="true" aria-label="Loading your classes">
                <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-classes__card-heading min-w-0">
                            <h3 className="teacher-classes__card-title text-base font-bold">My Classes</h3>
                            <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">
                                Loading your classes…
                            </p>
                        </div>
                    </div>
                    <div className="teacher-classes__skeleton grid grid-cols-1 gap-4 p-6 md:grid-cols-2" aria-hidden="true">
                        <div className="teacher-classes__skeleton-row" />
                        <div className="teacher-classes__skeleton-row" />
                    </div>
                </div>
            </section>
        );
    }

    // ==================== Empty state ====================
    if (!teacher || classes.length === 0) {
        return (
            <section className="teacher-classes flex flex-col gap-5">
                <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-classes__card-heading min-w-0">
                            <h3 className="teacher-classes__card-title text-base font-bold">My Classes</h3>
                            <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">
                                {teacher ? "No classes assigned yet" : "Teacher profile not found"}
                            </p>
                        </div>
                    </div>
                    <div className="teacher-classes__empty flex flex-col items-center justify-center px-6 py-14 text-center">
                        <span className="teacher-classes__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiHome />
                        </span>
                        <p className="teacher-classes__empty-title mt-3 text-sm font-bold">
                            {teacher ? "No classes assigned" : "No teacher profile found"}
                        </p>
                        <p className="teacher-classes__empty-text mt-1 text-[0.8125rem]">
                            {teacher
                                ? "Classes you teach will appear here once you are assigned to a class and subject."
                                : "Your account is not linked to a teacher record yet. Contact the administrator."}
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    // ==================== Main content ====================
    return (
        <section className="teacher-classes flex flex-col gap-5">
            {/* ==================== Hero banner ==================== */}
            <div className="teacher-classes__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="teacher-classes__hero-main flex min-w-0 items-center gap-4">
                    <span
                        className="teacher-classes__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                        aria-hidden="true"
                    >
                        {getInitials(teacher.fullname)}
                    </span>
                    <div className="teacher-classes__hero-heading min-w-0">
                        <span className="teacher-classes__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Teacher
                        </span>
                        <h2 className="teacher-classes__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            {teacher.fullname}
                        </h2>
                        <p className="teacher-classes__hero-role mt-0.5 truncate text-[0.8125rem]">
                            {teacher.email}
                        </p>
                    </div>
                </div>
                <div className="teacher-classes__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="teacher-classes__hero-badge-count text-[1.375rem] font-bold leading-none">
                        {classes.length}
                    </span>
                    <span className="teacher-classes__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        {classes.length === 1 ? "Class" : "Classes"}
                    </span>
                </div>
            </div>

            {/* ==================== Quick stats ==================== */}
            <div className="teacher-classes__stats grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--green inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiHome />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Total Classes
                        </span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {classes.length}
                        </span>
                    </div>
                </div>

                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--blue inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Students
                        </span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {totalStudents}
                        </span>
                    </div>
                </div>

                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--amber inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Subjects Taught
                        </span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {totalSubjects}
                        </span>
                    </div>
                </div>

                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--rose inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiClock />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Weekly Load
                        </span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {weeklyHours} hrs
                        </span>
                    </div>
                </div>
            </div>

            {/* ==================== My classes / roster ==================== */}
            {selectedClass ? (
                /* ---------------- Class detail view ---------------- */
                <div className="teacher-classes__details flex flex-col gap-5">
                    <button
                        type="button"
                        className="teacher-classes__back inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                        onClick={handleBackToClasses}
                        aria-label="Back to class list"
                    >
                        <FiArrowLeft aria-hidden="true" />
                        <span className="text-sm font-bold">Back to Classes</span>
                    </button>

                    {/* Detail hero */}
                    <div className="teacher-classes__details-hero flex flex-wrap items-center justify-between gap-4 p-6">
                        <div className="teacher-classes__details-main flex min-w-0 items-center gap-4">
                            <span className="teacher-classes__details-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl" aria-hidden="true">
                                <FiHome />
                            </span>
                            <div className="teacher-classes__details-heading min-w-0">
                                <span className="teacher-classes__details-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                    Grade {selectedClass.classGradeLevel}
                                </span>
                                <h3 className="teacher-classes__details-title mt-1 truncate text-[1.375rem] font-bold">
                                    {selectedClass.classSection}
                                </h3>
                                <p className="teacher-classes__details-subtitle mt-0.5 truncate text-[0.8125rem]">
                                    Classroom #{selectedClass.classId} &middot; {selectedClass.subjects.length} {selectedClass.subjects.length === 1 ? "subject" : "subjects"}
                                </p>
                            </div>
                        </div>
                        <div className="teacher-classes__details-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                            <span className="teacher-classes__details-badge-count text-[1.375rem] font-bold leading-none">
                                {roster?.students?.length ?? studentCountFor(selectedClass.classId)}
                            </span>
                            <span className="teacher-classes__details-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                Students
                            </span>
                        </div>
                    </div>

                    {/* Detail quick stats */}
                    <div className="teacher-classes__details-stats grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
                        <div className="teacher-classes__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                            <span className="teacher-classes__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                Grade Level
                            </span>
                            <span className="teacher-classes__details-stat-value text-[0.9375rem] font-bold">
                                Grade {selectedClass.classGradeLevel}
                            </span>
                        </div>
                        <div className="teacher-classes__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                            <span className="teacher-classes__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                Classroom ID
                            </span>
                            <span className="teacher-classes__details-stat-value text-[0.9375rem] font-bold">
                                #{selectedClass.classId}
                            </span>
                        </div>
                        <div className="teacher-classes__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                            <span className="teacher-classes__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                Subjects
                            </span>
                            <span className="teacher-classes__details-stat-value text-[0.9375rem] font-bold">
                                {selectedClass.subjects.length}
                            </span>
                        </div>
                    </div>

                    {/* Class roster */}
                    <section className="teacher-classes__roster" aria-label="Class roster">
                        <div className="teacher-classes__roster-head flex flex-wrap items-center justify-between gap-3">
                            <div className="teacher-classes__roster-heading min-w-0">
                                <h4 className="teacher-classes__roster-title text-[0.9375rem] font-bold">Class Roster</h4>
                                <p className="teacher-classes__roster-subtitle mt-1 text-[0.8125rem]">
                                    Students enrolled in {selectedClass.classSection}
                                </p>
                            </div>
                            {!loadingRoster && roster && roster.students.length > 0 && (
                                <span className="teacher-classes__roster-count inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                    <FiUsers aria-hidden="true" />
                                    {roster.students.length} {roster.students.length === 1 ? "student" : "students"}
                                </span>
                            )}
                        </div>

                        <div className="teacher-classes__roster-table-wrap mt-4 overflow-x-auto rounded-xl border">
                            {loadingRoster ? (
                                <div className="teacher-classes__roster-skeleton flex flex-col gap-3 p-5" aria-hidden="true">
                                    <div className="teacher-classes__roster-skeleton-row" />
                                    <div className="teacher-classes__roster-skeleton-row" />
                                    <div className="teacher-classes__roster-skeleton-row" />
                                    <div className="teacher-classes__roster-skeleton-row" />
                                </div>
                            ) : roster && roster.students.length > 0 ? (
                                <table className="teacher-classes__roster-table w-full min-w-[46rem] border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">LRN</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Student Name</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Sex</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Age</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Birthdate</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Email</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Enrollment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roster.students.map((student) => (
                                            <tr key={student.enrollmentId}>
                                                <td className="teacher-classes__cell--lrn px-4 py-3.5">
                                                    <span className="teacher-classes__lrn-chip inline-flex items-center rounded-md px-2 py-1 font-mono text-[0.75rem]">
                                                        {student.studentLrn}
                                                    </span>
                                                </td>
                                                <td className="teacher-classes__cell--name px-4 py-3.5">
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
                                                <td className="teacher-classes__cell--age px-4 py-3.5">{student.studentAge}</td>
                                                <td className="teacher-classes__cell--date px-4 py-3.5">{student.studentBirthdate}</td>
                                                <td className="teacher-classes__cell--email px-4 py-3.5">{student.studentEmail}</td>
                                                <td className="teacher-classes__cell--id px-4 py-3.5">
                                                    <span className="teacher-classes__id-chip inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.6875rem]">
                                                        #{student.enrollmentId}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="teacher-classes__roster-empty flex flex-col items-center justify-center px-6 py-10 text-center">
                                    <span className="teacher-classes__roster-empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                        <FiUsers />
                                    </span>
                                    <p className="teacher-classes__roster-empty-title mt-3 text-sm font-bold">No students enrolled</p>
                                    <p className="teacher-classes__roster-empty-text mt-1 text-[0.8125rem]">
                                        Students will appear here once they are enrolled in {selectedClass.classSection}.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            ) : (
                /* ---------------- Classes grid ---------------- */
                <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-classes__card-heading min-w-0">
                            <h3 className="teacher-classes__card-title text-base font-bold">My Classes</h3>
                            <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">
                                Select a class to view its roster
                            </p>
                        </div>
                        <span className="teacher-classes__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            {classes.length} {classes.length === 1 ? "class" : "classes"}
                        </span>
                    </div>

                    <div className="teacher-classes__grid grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                        {classes.map((classItem) => (
                            <article
                                className="teacher-classes__class flex flex-col overflow-hidden rounded-xl border"
                                key={classItem.classId}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleSelectClass(classItem)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        handleSelectClass(classItem);
                                    }
                                }}
                                aria-label={`View roster for Grade ${classItem.classGradeLevel} ${classItem.classSection}`}
                            >
                                <div className="teacher-classes__class-head flex items-start justify-between gap-3 p-5 pb-4">
                                    <div className="teacher-classes__class-heading min-w-0">
                                        <span className="teacher-classes__class-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                            Grade {classItem.classGradeLevel}
                                        </span>
                                        <h4 className="teacher-classes__class-name mt-1 truncate text-[1.0625rem] font-bold">
                                            {classItem.classSection}
                                        </h4>
                                        <p className="teacher-classes__class-room mt-0.5 font-mono text-[0.6875rem]">
                                            Classroom #{classItem.classId}
                                        </p>
                                    </div>
                                    <div className="teacher-classes__class-aside flex shrink-0 flex-col items-end gap-2">
                                        <span className="teacher-classes__class-subjects inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[0.625rem] font-bold">
                                            {classItem.subjects.length} {classItem.subjects.length === 1 ? "subject" : "subjects"}
                                        </span>
                                        <span className="teacher-classes__class-icon inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg" aria-hidden="true">
                                            <FiHome />
                                        </span>
                                    </div>
                                </div>

                                <div className="teacher-classes__class-body flex flex-1 flex-col gap-2 p-4 pt-0">
                                    {classItem.subjects.map((subject) => (
                                        <div className="teacher-classes__subject flex items-center gap-3 rounded-lg border p-2.5" key={subject.subjectId}>
                                            <span className="teacher-classes__subject-code inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-md font-mono text-[0.625rem] font-bold" aria-hidden="true">
                                                {subject.subjectCode}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <span className="teacher-classes__subject-name block truncate text-[0.8125rem] font-bold">
                                                    {subject.subjectName}
                                                </span>
                                                <span className="teacher-classes__subject-meta block font-mono text-[0.6875rem]">
                                                    {subject.subjectCode} &middot; {subject.subjectUnit} unit{subject.subjectUnit === 1 ? "" : "s"}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="teacher-classes__subject-action inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.6875rem] font-bold"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    navigate(`/teacher/classes/${subject.classSubjectId}/gradebook`);
                                                }}
                                                onKeyDown={(event) => event.stopPropagation()}
                                                aria-label={`Open gradebook for ${subject.subjectName}`}
                                            >
                                                <FiClipboard aria-hidden="true" />
                                                Gradebook
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="teacher-classes__class-foot flex items-center justify-between gap-3 p-4 pt-3">
                                    <div className="teacher-classes__class-stat flex min-w-0 items-center gap-1.5">
                                        <FiUsers aria-hidden="true" />
                                        <span className="truncate text-[0.8125rem] font-bold">
                                            {studentCountFor(classItem.classId)} students
                                        </span>
                                    </div>
                                    <div className="teacher-classes__class-stat flex min-w-0 items-center gap-1.5">
                                        <FiClock aria-hidden="true" />
                                        <span className="truncate text-[0.8125rem]">
                                            {classItem.subjects.length} {classItem.subjects.length === 1 ? "subject" : "subjects"} &middot; {subjectHoursFor(classItem)} hrs/week
                                        </span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
