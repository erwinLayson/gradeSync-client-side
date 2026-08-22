import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiAward,
    FiBookOpen,
    FiCalendar,
    FiCheck,
    FiChevronRight,
    FiHome,
    FiUser,
    FiUsers,
} from "react-icons/fi";

import { getAPICall } from "../../api/api";
import Skeleton from "../../components/Skeleton";
import { getInitials } from "../../helper/initials";

import type { StudentClass, StudentClassesData, AttendanceQuarter } from "../../constant/studentClasses";

interface ClassAttendance {
    enrollmentId: number;
    classId: number;
    schoolYearId: number;
    schoolYear: string;
    attendance: AttendanceQuarter[];
}

interface ClassAttendanceResponse {
    classes: ClassAttendance[];
}

import "../../style/studentDashboard.css";

// ==================== Types ====================

interface AcademicSettingsData {
    id: number;
    currentQuarter: number;
    enrollmentOpen: boolean | number;
    submissionsLocked: boolean | number;
}

// ==================== Helpers ====================

function gradeClass(final: number | null): string {
    if (final === null) return "student-dashboard__grade-ng";
    return final >= 75 ? "student-dashboard__grade-good" : "student-dashboard__grade-warn";
}

// ==================== Component ====================

export default function StudentDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<StudentClassesData["student"] | null>(null);
    const [currentClass, setCurrentClass] = useState<StudentClass | null>(null);
    const [classAttendance, setClassAttendance] = useState<ClassAttendance | null>(null);
    const [currentQuarter, setCurrentQuarter] = useState(1);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const [classesRes, settingsRes] = await Promise.all([
                    getAPICall<StudentClassesData>("/students/classes", { toast: false }),
                    getAPICall<AcademicSettingsData>("/students/current-quarter", { toast: false }),
                ]);
                if (cancelled) return;

                const classes = classesRes.data?.classes ?? [];
                setStudent(classesRes.data?.student ?? null);
                setCurrentClass(classes[0] ?? null);

                const quarter = settingsRes.data?.currentQuarter ?? 1;
                setCurrentQuarter(quarter);

                // Fetch class-level attendance from class_daily_attendance
                const attendanceRes = await getAPICall<ClassAttendanceResponse>(
                    `/students/attendance?quarter=${quarter}`,
                    { toast: false }
                );
                if (cancelled) return;
                const attClasses = attendanceRes.data?.classes ?? [];
                setClassAttendance(attClasses[0] ?? null);
            } catch {
                // Error toast handled by API interceptor
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    // ==================== Loading ====================
    if (loading) {
        return (
            <section className="student-dashboard__page flex flex-col gap-5">
                <div className="student-dashboard__hero flex items-center gap-4 p-6">
                    <Skeleton avatar avatarSize={56} lines={0} className="flex-1" />
                </div>
                <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <Skeleton lines={4} gap="1rem" />
                </div>
            </section>
        );
    }

    // ==================== Empty state ====================
    if (!student || !currentClass) {
        return (
            <section className="student-dashboard__page flex flex-col gap-5">
                <div className="student-dashboard__hero flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="flex min-w-0 items-center gap-4">
                        <span
                            className="student-dashboard__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                            aria-hidden="true"
                        >
                            {getInitials(student?.fullname ?? "?")}
                        </span>
                        <div className="min-w-0">
                            <span className="student-dashboard__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                Welcome back
                            </span>
                            <h2 className="student-dashboard__hero-name mt-1 truncate text-[1.375rem] font-bold">
                                {student?.fullname ?? "Student"}
                            </h2>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
                        <FiHome />
                    </span>
                    <p className="mt-3 text-sm font-bold text-neutral-800">No classes found</p>
                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                        You are not enrolled in any class yet. Contact the registrar if you believe this is a mistake.
                    </p>
                </div>
            </section>
        );
    }

    // ==================== Derived data ====================
    const subjects = currentClass.subjects;
    const totalSubjects = subjects.length;

    // Use class_daily_attendance for accurate class-level attendance
    const quarterAttendance = classAttendance?.attendance.find((a) => a.quarter === currentQuarter);
    const presentDays = quarterAttendance?.presentDays ?? 0;
    const totalDays = quarterAttendance?.totalDays ?? 0;

    return (
        <section className="student-dashboard__page flex flex-col gap-5">
            {/* ==================== Hero banner ==================== */}
            <div className="student-dashboard__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex min-w-0 items-center gap-4">
                    <span
                        className="student-dashboard__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                        aria-hidden="true"
                    >
                        {getInitials(student.fullname)}
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Welcome back
                        </span>
                        <h2 className="student-dashboard__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            {student.fullname}
                        </h2>
                        <p className="student-dashboard__hero-role mt-0.5 truncate text-[0.8125rem]">
                            LRN {student.lrn} &middot; Grade {currentClass.gradeLevel} &middot; {currentClass.section}
                        </p>
                    </div>
                </div>
                <div className="student-dashboard__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="student-dashboard__hero-badge-count text-[1.375rem] font-bold leading-none">
                        {currentClass.schoolYear}
                    </span>
                    <span className="student-dashboard__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        School Year
                    </span>
                </div>
            </div>

            {/* ==================== Quick stats ==================== */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* General Average */}
                <div className="student-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--green inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiAward />
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            General Average
                        </span>
                        <span className="student-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {currentClass.generalAverage !== null
                                ? Math.round(currentClass.generalAverage)
                                : "—"}
                        </span>
                    </div>
                </div>

                {/* Subjects */}
                <div className="student-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--blue inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Subjects
                        </span>
                        <span className="student-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {totalSubjects}
                        </span>
                    </div>
                </div>

                {/* Attendance */}
                <div className="student-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--amber inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Attendance (Q{currentQuarter})
                        </span>
                        <span className="student-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {totalDays > 0 ? (
                                <>
                                    <FiCheck className="inline text-emerald-600" aria-hidden="true" /> {presentDays}
                                    {" / "}
                                    {totalDays} days
                                </>
                            ) : (
                                "No records"
                            )}
                        </span>
                    </div>
                </div>

                {/* School Year */}
                <div className="student-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--violet inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiCalendar />
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            School Year
                        </span>
                        <span className="student-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {currentClass.schoolYear}
                        </span>
                    </div>
                </div>
            </div>

            {/* ==================== Subjects + quick links ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* My subjects */}
                <section className="student-dashboard__panel overflow-hidden rounded-2xl lg:col-span-2" aria-label="My subjects">
                    <div className="border-b px-5 py-4">
                        <h3 className="text-[0.9375rem] font-bold text-neutral-900">My Subjects</h3>
                        <p className="mt-1 text-[0.8125rem] text-neutral-500">
                            Your subjects this school year with the latest final grade.
                        </p>
                    </div>

                    <div className="flex flex-col">
                        {subjects.map((subject) => (
                            <div key={subject.classSubjectId ?? subject.name} className="student-dashboard__subject-row flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="student-dashboard__subject-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                        <FiBookOpen />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-neutral-900">{subject.name}</p>
                                        <p className="mt-0.5 truncate text-xs text-neutral-400">
                                            {subject.code} &middot; {subject.teacher ?? "—"}
                                        </p>
                                    </div>
                                </div>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${gradeClass(subject.final)}`}>
                                    {subject.final === null ? "No grade" : Math.round(subject.final)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Quick links */}
                <section className="flex flex-col gap-4" aria-label="Quick links">
                    <div className="min-w-0">
                        <h3 className="text-[0.9375rem] font-bold text-neutral-900">Quick Access</h3>
                        <p className="mt-1 text-[0.8125rem] text-neutral-500">
                            Jump straight to what you need.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="student-dashboard__link flex w-full cursor-pointer items-center gap-3 rounded-xl p-4 text-left"
                        onClick={() => navigate("/student/classrooms")}
                    >
                        <span className="student-dashboard__link-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiHome />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-neutral-900">My Classes</p>
                            <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                Subjects, activities, scores &amp; attendance
                            </p>
                        </div>
                        <FiChevronRight className="student-dashboard__link-arrow shrink-0" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="student-dashboard__link flex w-full cursor-pointer items-center gap-3 rounded-xl p-4 text-left"
                        onClick={() => navigate("/student/prospectus")}
                    >
                        <span className="student-dashboard__link-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiAward />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-neutral-900">Prospectus</p>
                            <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                Your academic history by school year
                            </p>
                        </div>
                        <FiChevronRight className="student-dashboard__link-arrow shrink-0" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="student-dashboard__link flex w-full cursor-pointer items-center gap-3 rounded-xl p-4 text-left"
                        onClick={() => navigate("/student/profile")}
                    >
                        <span className="student-dashboard__link-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiUser />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-neutral-900">My Profile</p>
                            <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                Personal and guardian information
                            </p>
                        </div>
                        <FiChevronRight className="student-dashboard__link-arrow shrink-0" aria-hidden="true" />
                    </button>
                </section>
            </div>
        </section>
    );
}
