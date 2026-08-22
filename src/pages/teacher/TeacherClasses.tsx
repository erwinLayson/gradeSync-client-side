import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBookOpen, FiClipboard, FiClock, FiHome, FiUsers } from "react-icons/fi";

import { getAPICall } from "../../api/api";
import Skeleton from "../../components/Skeleton";
import { useUser } from "../../hooks/useUser";
import { getInitials } from "../../helper/initials";

import type { TeacherDetails, TeacherSubjectDetails } from "../../constant/teachers";
import type { ClassroomResponseProps } from "../../constant/classrooms";

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

    // ==================== Fetch real class data ====================
    useEffect(() => {
        if (userLoading) return;

        let cancelled = false;

        async function loadTeacherClasses() {
            if (!user) return;

            try {
                const teacherRes = await getAPICall<TeacherDetails>(`/teachers/by-user/${user.id}`);
                const teacherData = teacherRes.data ?? null;
                if (cancelled) return;
                setTeacher(teacherData);

                if (!teacherData) {
                    setLoading(false);
                    return;
                }

                const [subjectsRes, classroomsRes] = await Promise.all([
                    getAPICall<TeacherSubjectDetails[]>(`/teachers/${teacherData.id}/subjects`),
                    getAPICall<ClassroomResponseProps[]>("/classrooms"),
                ]);
                if (cancelled) return;
                setSubjectDetails(subjectsRes.data ?? null);
                setClassrooms(classroomsRes.data ?? []);
            } catch {
                // Error toast handled by API interceptor
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadTeacherClasses();
        return () => { cancelled = true; };
    }, [user, userLoading]);

    // Group subjects into class cards
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
        () => classes.reduce((sum, c) => sum + (classrooms.find((cl) => cl.id === c.classId)?.totalStudent ?? 0), 0),
        [classes, classrooms]
    );
    const totalSubjects = subjectDetails?.length ?? 0;
    const weeklyHours = subjectDetails?.reduce((sum, row) => sum + Number(row.subjectUnit), 0) ?? 0;

    function studentCountFor(classId: number): number {
        return classrooms.find((cl) => cl.id === classId)?.totalStudent ?? 0;
    }

    // ==================== Loading state ====================
    if (userLoading || loading) {
        return (
            <section className="teacher-classes flex flex-col gap-5" aria-busy="true">
                <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-classes__card-heading min-w-0">
                            <h3 className="teacher-classes__card-title text-base font-bold">Gradebook</h3>
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

    // ==================== Empty state ====================
    if (!teacher || classes.length === 0) {
        return (
            <section className="teacher-classes flex flex-col gap-5">
                <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-classes__card-heading min-w-0">
                            <h3 className="teacher-classes__card-title text-base font-bold">Gradebook</h3>
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
                                ? "Classes you teach will appear here once you are assigned."
                                : "Your account is not linked to a teacher record yet."}
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    // ==================== Main content ====================
    return (
        <section className="teacher-classes flex flex-col gap-5">
            {/* Hero banner */}
            <div className="teacher-classes__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="teacher-classes__hero-main flex min-w-0 items-center gap-4">
                    <span className="teacher-classes__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold" aria-hidden="true">
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

            {/* Quick stats */}
            <div className="teacher-classes__stats grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--green inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiHome />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Classes</span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">{classes.length}</span>
                    </div>
                </div>
                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--blue inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Students</span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">{totalStudents}</span>
                    </div>
                </div>
                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--amber inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subjects</span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">{totalSubjects}</span>
                    </div>
                </div>
                <div className="teacher-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-classes__stat-icon teacher-classes__stat-icon--rose inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiClock />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Weekly Load</span>
                        <span className="teacher-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">{weeklyHours} hrs</span>
                    </div>
                </div>
            </div>

            {/* Class cards with gradebook buttons */}
            <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="teacher-classes__card-heading min-w-0">
                        <h3 className="teacher-classes__card-title text-base font-bold">Gradebook</h3>
                        <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">
                            Select a subject to open its gradebook
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
                                        Classroom #{classItem.classId} &middot; {studentCountFor(classItem.classId)} students
                                    </p>
                                </div>
                                <span className="teacher-classes__class-icon inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg" aria-hidden="true">
                                    <FiHome />
                                </span>
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
                                            onClick={() => navigate(`/teacher/classes/${subject.classSubjectId}/gradebook`)}
                                            aria-label={`Open gradebook for ${subject.subjectName}`}
                                        >
                                            <FiClipboard aria-hidden="true" />
                                            Gradebook
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
