import { useNavigate } from "react-router-dom";
import {
    FiAlertCircle,
    FiBell,
    FiBookOpen,
    FiChevronRight,
    FiClipboard,
    FiClock,
    FiHome,
    FiUsers,
} from "react-icons/fi";

import { useTeacherOverview } from "../../hooks/useTeacherOverview";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import { getInitials } from "../../helper/initials";
import GenderPieChart from "../../components/GenderPieChart";

import "../../style/teacherDashboard.css";

export default function TeacherDashboard() {
    const navigate = useNavigate();
    const { quarters } = useAcademicSettings();
    const {
        teacher,
        classes,
        adviserClasses,
        adviserClassStats,
        totalStudents,
        totalSubjects,
        weeklyHours,
        loading,
        error,
        studentCountFor,
    } = useTeacherOverview();

    // ==================== Loading state ====================
    if (loading) {
        return (
            <section className="teacher-dashboard flex flex-col gap-5" aria-busy="true" aria-label="Loading dashboard">
                <div className="teacher-dashboard__hero flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="teacher-dashboard__hero-main flex min-w-0 items-center gap-4">
                        <span className="teacher-dashboard__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold" aria-hidden="true" />
                        <div className="teacher-dashboard__hero-heading min-w-0">
                            <div className="teacher-dashboard__skeleton-bar teacher-dashboard__skeleton-bar--short" />
                            <div className="teacher-dashboard__skeleton-bar teacher-dashboard__skeleton-bar--long mt-2" />
                        </div>
                    </div>
                </div>
                <div className="teacher-dashboard__stats grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {quarters.map((i) => (
                        <div className="teacher-dashboard__stat flex items-center gap-3 rounded-xl border p-4" key={i}>
                            <div className="teacher-dashboard__skeleton-bar teacher-dashboard__skeleton-bar--icon" />
                            <div className="min-w-0 flex-1">
                                <div className="teacher-dashboard__skeleton-bar teacher-dashboard__skeleton-bar--short" />
                                <div className="teacher-dashboard__skeleton-bar teacher-dashboard__skeleton-bar--tiny mt-2" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    // ==================== Error / empty state ====================
    if (error || !teacher) {
        return (
            <section className="teacher-dashboard flex flex-col gap-5">
                <div className="teacher-dashboard__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-dashboard__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-dashboard__card-heading min-w-0">
                            <h3 className="teacher-dashboard__card-title text-base font-bold">Dashboard</h3>
                            <p className="teacher-dashboard__card-subtitle mt-1 text-[0.8125rem]">
                                Unable to load your dashboard data
                            </p>
                        </div>
                    </div>
                    <div className="teacher-dashboard__empty flex flex-col items-center justify-center px-6 py-14 text-center">
                        <span className="teacher-dashboard__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiAlertCircle />
                        </span>
                        <p className="teacher-dashboard__empty-title mt-3 text-sm font-bold">Could not load dashboard</p>
                        <p className="teacher-dashboard__empty-text mt-1 text-[0.8125rem]">
                            Your teacher profile may not be linked to your account yet. Contact the administrator.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    // ==================== Computed helpers ====================
    const today = new Date();
    const dateLabel = today.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    const yearLabel = today.getFullYear();
    const firstClass = classes && classes[0];

    // ==================== Main content ====================
    return (
        <section className="teacher-dashboard flex flex-col gap-5">
            {/* ==================== Hero banner ==================== */}
            <div className="teacher-dashboard__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="teacher-dashboard__hero-main flex min-w-0 items-center gap-4">
                    <span
                        className="teacher-dashboard__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                        aria-hidden="true"
                    >
                        {getInitials(teacher.fullname)}
                    </span>
                    <div className="teacher-dashboard__hero-heading min-w-0">
                        <span className="teacher-dashboard__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Teacher Dashboard
                        </span>
                        <h2 className="teacher-dashboard__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            Welcome back, {teacher.fullname.split(" ")[0]}!
                        </h2>
                        <p className="teacher-dashboard__hero-role mt-0.5 truncate text-[0.8125rem]">
                            {teacher.email}
                        </p>
                    </div>
                </div>
                <div className="teacher-dashboard__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="teacher-dashboard__hero-badge-count text-[1.375rem] font-bold leading-none">
                        {dateLabel}
                    </span>
                    <span className="teacher-dashboard__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        {dayName} &middot; {yearLabel}
                    </span>
                </div>
            </div>

            {/* ==================== Quick stats ==================== */}
            <div className="teacher-dashboard__stats grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="teacher-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-dashboard__stat-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiHome />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Advised Classes</span>
                        <span className="teacher-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">{adviserClasses?.length}</span>
                    </div>
                </div>

                <div className="teacher-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-dashboard__stat-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Advised Students</span>
                        <span className="teacher-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">{totalStudents}</span>
                    </div>
                </div>

                <div className="teacher-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-dashboard__stat-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subjects Taught</span>
                        <span className="teacher-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">{totalSubjects}</span>
                    </div>
                </div>

                <div className="teacher-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="teacher-dashboard__stat-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiClock />
                    </span>
                    <div className="min-w-0">
                        <span className="teacher-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">Weekly Load</span>
                        <span className="teacher-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">{weeklyHours} hrs</span>
                    </div>
                </div>
            </div>

            {/* ==================== Quick actions + Adviser Classes ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="grid grid-cols-1 gap-5">
                    {/* ---------------- Quick actions ---------------- */}
                    <div className="teacher-dashboard__card overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="teacher-dashboard__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                            <div className="teacher-dashboard__card-heading min-w-0">
                                <h3 className="teacher-dashboard__card-title text-base font-bold">Quick Actions</h3>
                                <p className="teacher-dashboard__card-subtitle mt-1 text-[0.8125rem]">
                                    Jump to your most-used tools
                                </p>
                            </div>
                        </div>

                        <div className="teacher-dashboard__actions grid grid-cols-2 gap-3 p-5">
                            <button
                                type="button"
                                className="teacher-dashboard__action flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left"
                                onClick={() => navigate("/teacher/my-class")}
                            >
                                <span className="teacher-dashboard__action-icon inline-flex h-10 w-10 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                    <FiHome />
                                </span>
                                <span className="min-w-0">
                                    <span className="teacher-dashboard__action-title block text-[0.8125rem] font-bold">My Class</span>
                                    <span className="teacher-dashboard__action-meta mt-0.5 block text-[0.6875rem]">
                                        View your advised class &amp; grades
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="teacher-dashboard__action flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left"
                                onClick={() => {
                                    if (firstClass?.subjects[0]) {
                                        navigate(`/teacher/classes/${firstClass.subjects[0].classSubjectId}/gradebook`);
                                    }
                                }}
                                disabled={!firstClass?.subjects[0]}
                            >
                                <span className="teacher-dashboard__action-icon inline-flex h-10 w-10 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                    <FiBookOpen />
                                </span>
                                <span className="min-w-0">
                                    <span className="teacher-dashboard__action-title block text-[0.8125rem] font-bold">Gradebook</span>
                                    <span className="teacher-dashboard__action-meta mt-0.5 block text-[0.6875rem]">
                                        {firstClass?.subjects[0] ? `${firstClass.subjects[0].subjectName} · Q1` : "No subjects yet"}
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="teacher-dashboard__action flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left"
                                onClick={() => navigate("/teacher/attendance")}
                            >
                                <span className="teacher-dashboard__action-icon inline-flex h-10 w-10 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                    <FiClipboard />
                                </span>
                                <span className="min-w-0">
                                    <span className="teacher-dashboard__action-title block text-[0.8125rem] font-bold">Attendance</span>
                                    <span className="teacher-dashboard__action-meta mt-0.5 block text-[0.6875rem]">
                                        {firstClass ? `${firstClass.classSection} · P1` : "No classes yet"}
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="teacher-dashboard__action flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left"
                                onClick={() => navigate("/teacher/student-records")}
                            >
                                <span className="teacher-dashboard__action-icon inline-flex h-10 w-10 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                    <FiClipboard />
                                </span>
                                <span className="min-w-0">
                                    <span className="teacher-dashboard__action-title block text-[0.8125rem] font-bold">Student Records</span>
                                    <span className="teacher-dashboard__action-meta mt-0.5 block text-[0.6875rem]">
                                        Submit &amp; manage records
                                    </span>
                                </span>
                            </button>
                        </div>

                        {/* Mini announcement */}
                        <div className="teacher-dashboard__announcement flex items-start gap-3 border-t p-5">
                            <span className="teacher-dashboard__announcement-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm" aria-hidden="true">
                                <FiBell />
                            </span>
                            <div className="min-w-0">
                                <p className="teacher-dashboard__announcement-title text-[0.8125rem] font-bold">Quick tip</p>
                                <p className="teacher-dashboard__announcement-meta mt-0.5 text-[0.6875rem]">
                                    Use the Attendance tab to mark daily attendance for each of your classes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div>
                    <div className="teacher-dashboard__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-dashboard__card-heading min-w-0">
                            <h3 className="teacher-dashboard__card-title text-base font-bold">My Advised Classes</h3>
                            <p className="teacher-dashboard__card-subtitle mt-1 text-[0.8125rem]">
                                Student count &amp; gender breakdown
                            </p>
                        </div>
                        <span className="teacher-dashboard__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            <FiUsers aria-hidden="true" />
                        </span>
                    </div>                    
                    <div>
                        {adviserClassStats?.length === 0 ? (
                            <div className="teacher-dashboard__empty flex flex-col items-center justify-center px-6 py-10 text-center sm:col-span-2">
                                <span className="teacher-dashboard__empty-icon inline-flex h-10 w-10 items-center justify-center rounded-full" aria-hidden="true">
                                    <FiHome />
                                </span>
                                <p className="mt-2 text-[0.8125rem] font-bold">No advised classes</p>
                                <p className="mt-1 text-[0.6875rem]">
                                    You are not assigned as a class adviser yet.
                                </p>
                            </div>
                        ) : (
                            adviserClassStats?.map((stat) => (
                                <article
                                    className="teacher-dashboard__adviser-card"
                                    key={stat.classId}
                                    onClick={() => navigate("/teacher/my-class")}
                                >
                                    <GenderPieChart male={stat.maleCount} female={stat.femaleCount} fullWidth />
                                    <div className="teacher-dashboard__adviser-card-overlay">
                                        <span className="teacher-dashboard__adviser-card-eyebrow">Grade {stat.classGradeLevel}</span>
                                        <h4 className="teacher-dashboard__adviser-card-name">{stat.classSection}</h4>
                                        <div className="teacher-dashboard__adviser-gender">
                                            <span className="teacher-dashboard__gender-badge teacher-dashboard__gender-badge--male">
                                                <span className="teacher-dashboard__gender-dot teacher-dashboard__gender-dot--male" aria-hidden="true" /> {stat.maleCount} male
                                            </span>
                                            <span className="teacher-dashboard__gender-badge teacher-dashboard__gender-badge--female">
                                                <span className="teacher-dashboard__gender-dot teacher-dashboard__gender-dot--female" aria-hidden="true" /> {stat.femaleCount} female
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </div>
            
            </div>

            {/* ==================== Teaching Load ==================== */}
            {classes && classes.length > 0 && (
                <div className="teacher-dashboard__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-dashboard__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teacher-dashboard__card-heading min-w-0">
                            <h3 className="teacher-dashboard__card-title text-base font-bold">Teaching Load</h3>
                            <p className="teacher-dashboard__card-subtitle mt-1 text-[0.8125rem]">
                                All classes where you have assigned subjects
                            </p>
                        </div>
                        <span className="teacher-dashboard__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            {classes?.length} {classes?.length === 1 ? "class" : "classes"}
                        </span>
                    </div>

                    <div className="teacher-dashboard__classes grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                        {classes?.map((classGroup) => (
                            <article className="teacher-dashboard__class flex flex-col overflow-hidden rounded-xl border" key={classGroup.classId}>
                                <div className="teacher-dashboard__class-head flex items-start justify-between gap-3 p-4 pb-3">
                                    <div className="min-w-0">
                                        <span className="teacher-dashboard__class-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                            Grade {classGroup.classGradeLevel}
                                        </span>
                                        <h4 className="teacher-dashboard__class-name mt-1 truncate text-[1.0625rem] font-bold">
                                            {classGroup.classSection}
                                        </h4>
                                        <p className="teacher-dashboard__class-room mt-0.5 font-mono text-[0.6875rem]">
                                            Classroom #{classGroup.classId}
                                        </p>
                                    </div>
                                    <span className="teacher-dashboard__class-icon inline-flex h-9 w-9 items-center justify-center rounded-lg text-lg" aria-hidden="true">
                                        <FiBookOpen />
                                    </span>
                                </div>
                                <div className="teacher-dashboard__class-body flex flex-1 flex-col gap-2 p-4 pt-0">
                                    {classGroup.subjects.map((subject) => (
                                        <div className="teacher-dashboard__class-subject flex items-center gap-2.5 rounded-lg border p-2.5" key={subject.subjectId}>
                                            <span className="teacher-dashboard__class-subject-code inline-flex h-7 w-12 shrink-0 items-center justify-center rounded-md text-[0.625rem] font-bold">
                                                {subject.subjectCode}
                                            </span>
                                            <div className="min-w-0">
                                                <span className="teacher-dashboard__class-subject-name block truncate text-[0.75rem] font-bold">
                                                    {subject.subjectName}
                                                </span>
                                                <span className="teacher-dashboard__class-subject-meta block font-mono text-[0.625rem]">
                                                    {subject.subjectUnit} unit{subject.subjectUnit === 1 ? "" : "s"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="teacher-dashboard__class-foot flex items-center justify-between gap-3 p-4 pt-3">
                                    <span className="teacher-dashboard__class-stat flex items-center gap-1.5 text-[0.75rem]">
                                        <FiUsers aria-hidden="true" />
                                        <strong>{studentCountFor(classGroup.classId)}</strong> students
                                    </span>
                                    <button
                                        type="button"
                                        className="teacher-dashboard__class-link inline-flex items-center gap-1 text-[0.6875rem] font-bold"
                                        onClick={() => navigate("/teacher/classes")}
                                        aria-label={`Open Grade ${classGroup.classGradeLevel} ${classGroup.classSection}`}
                                    >
                                        View <FiChevronRight aria-hidden="true" />
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
