import { useNavigate } from "react-router-dom";
import {
    FiAlertCircle,
    FiAward,
    FiBell,
    FiBookOpen,
    FiClipboard,
    FiClock,
    FiHome,
    FiUsers,
} from "react-icons/fi";

import { useFacultyOverview } from "../../hooks/useFacultyOverview";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import GenderPieChart from "../../components/GenderPieChart";
import { PageHeader, PageSection, PageShell, StatGrid, StatTile } from "../../components/PageLayout";

import "../../style/facultyDashboard.css";

export default function FacultyDashboard() {
    const navigate = useNavigate();
    const { quarters, currentQuarter } = useAcademicSettings();
    const {
        faculty,
        classes,
        adviserClasses,
        adviserClassStats,
        honorStudents,
        totalStudents,
        totalSubjects,
        weeklyHours,
        loading,
        error,
    } = useFacultyOverview(currentQuarter);

    // ==================== Loading state ====================
    if (loading) {
        return (
            <PageShell className="faculty-dashboard" busy label="Loading dashboard">
                <div className="faculty-dashboard__hero flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="faculty-dashboard__hero-heading min-w-0">
                        <div className="faculty-dashboard__skeleton-bar faculty-dashboard__skeleton-bar--short" />
                        <div className="faculty-dashboard__skeleton-bar faculty-dashboard__skeleton-bar--long mt-2" />
                    </div>
                </div>
                <div className="faculty-dashboard__stats grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {quarters.map((i) => (
                        <div className="faculty-dashboard__stat flex items-center gap-3 rounded-xl border p-4" key={i}>
                            <div className="faculty-dashboard__skeleton-bar faculty-dashboard__skeleton-bar--icon" />
                            <div className="min-w-0 flex-1">
                                <div className="faculty-dashboard__skeleton-bar faculty-dashboard__skeleton-bar--short" />
                                <div className="faculty-dashboard__skeleton-bar faculty-dashboard__skeleton-bar--tiny mt-2" />
                            </div>
                        </div>
                    ))}
                </div>
            </PageShell>
        );
    }

    // ==================== Error / empty state ====================
    if (error || !faculty) {
        return (
            <PageShell className="faculty-dashboard">
                <PageSection
                    className="faculty-dashboard__card"
                    title="Dashboard"
                    description="Unable to load your dashboard data"
                >
                    <div className="faculty-dashboard__empty flex flex-col items-center justify-center py-10 text-center">
                        <span className="faculty-dashboard__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiAlertCircle />
                        </span>
                        <p className="faculty-dashboard__empty-title mt-3 text-sm font-bold">Could not load dashboard</p>
                        <p className="faculty-dashboard__empty-text mt-1 text-[0.8125rem]">
                            Your faculty profile may not be linked to your account yet. Contact the administrator.
                        </p>
                    </div>
                </PageSection>
            </PageShell>
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
        <PageShell className="faculty-dashboard">
            {/* ==================== Header ==================== */}
            <PageHeader
                title={`Welcome back, ${faculty.fullname.split(" ")[0]}!`}
                description={faculty.email}
                meta={`${dateLabel} · ${dayName} · ${yearLabel}`}
            />

            {/* ==================== Quick stats ==================== */}
            <StatGrid>
                <StatTile label="Advised Classes" value={adviserClasses?.length} icon={FiHome} />
                <StatTile label="Advised Students" value={totalStudents} icon={FiUsers} />
                <StatTile label="Subjects Taught" value={totalSubjects} icon={FiBookOpen} />
                <StatTile label="Weekly Load" value={`${weeklyHours} hrs`} icon={FiClock} />
            </StatGrid>

            {/* ==================== Quick actions + Adviser Classes ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="grid grid-cols-1 gap-5">
                    {/* ---------------- Quick actions ---------------- */}
                    <div className="faculty-dashboard__card overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="faculty-dashboard__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                            <div className="faculty-dashboard__card-heading min-w-0">
                                <h3 className="faculty-dashboard__card-title text-base font-bold">Quick Actions</h3>
                                <p className="faculty-dashboard__card-subtitle mt-1 text-[0.8125rem]">
                                    Jump to your most-used tools
                                </p>
                            </div>
                        </div>

                        <div className="faculty-dashboard__actions grid grid-cols-2 gap-3 p-5">
                            <button
                                type="button"
                                className="faculty-dashboard__action flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left"
                                onClick={() => navigate("/faculty/my-class")}
                            >
                                <span className="faculty-dashboard__action-icon inline-flex h-10 w-10 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                    <FiHome />
                                </span>
                                <span className="min-w-0">
                                    <span className="faculty-dashboard__action-title block text-[0.8125rem] font-bold">My Class</span>
                                    <span className="faculty-dashboard__action-meta mt-0.5 block text-[0.6875rem]">
                                        View your advised class &amp; grades
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="faculty-dashboard__action flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left"
                                onClick={() => {
                                    if (firstClass?.subjects[0]) {
                                        navigate(`/faculty/classes/${firstClass.subjects[0].classSubjectId}/gradebook`);
                                    }
                                }}
                                disabled={!firstClass?.subjects[0]}
                            >
                                <span className="faculty-dashboard__action-icon inline-flex h-10 w-10 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                    <FiBookOpen />
                                </span>
                                <span className="min-w-0">
                                    <span className="faculty-dashboard__action-title block text-[0.8125rem] font-bold">Gradebook</span>
                                    <span className="faculty-dashboard__action-meta mt-0.5 block text-[0.6875rem]">
                                        {firstClass?.subjects[0] ? `${firstClass.subjects[0].subjectName} · Q1` : "No subjects yet"}
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="faculty-dashboard__action flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left"
                                onClick={() => navigate("/faculty/attendance")}
                            >
                                <span className="faculty-dashboard__action-icon inline-flex h-10 w-10 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                    <FiClipboard />
                                </span>
                                <span className="min-w-0">
                                    <span className="faculty-dashboard__action-title block text-[0.8125rem] font-bold">Attendance</span>
                                    <span className="faculty-dashboard__action-meta mt-0.5 block text-[0.6875rem]">
                                        {firstClass ? `${firstClass.classSection} · P1` : "No classes yet"}
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="faculty-dashboard__action flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left"
                                onClick={() => navigate("/faculty/student-records")}
                            >
                                <span className="faculty-dashboard__action-icon inline-flex h-10 w-10 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                    <FiClipboard />
                                </span>
                                <span className="min-w-0">
                                    <span className="faculty-dashboard__action-title block text-[0.8125rem] font-bold">Student Records</span>
                                    <span className="faculty-dashboard__action-meta mt-0.5 block text-[0.6875rem]">
                                        Submit &amp; manage records
                                    </span>
                                </span>
                            </button>
                        </div>

                        {/* Mini announcement */}
                        <div className="faculty-dashboard__announcement flex items-start gap-3 border-t p-5">
                            <span className="faculty-dashboard__announcement-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm" aria-hidden="true">
                                <FiBell />
                            </span>
                            <div className="min-w-0">
                                <p className="faculty-dashboard__announcement-title text-[0.8125rem] font-bold">Quick tip</p>
                                <p className="faculty-dashboard__announcement-meta mt-0.5 text-[0.6875rem]">
                                    Use the Attendance tab to mark daily attendance for each of your classes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div>
                    <div className="faculty-dashboard__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="faculty-dashboard__card-heading min-w-0">
                            <h3 className="faculty-dashboard__card-title text-base font-bold">My Advised Classes</h3>
                            <p className="faculty-dashboard__card-subtitle mt-1 text-[0.8125rem]">
                                Student count &amp; gender breakdown
                            </p>
                        </div>
                        <span className="faculty-dashboard__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            <FiUsers aria-hidden="true" />
                        </span>
                    </div>                    
                    <div>
                        {adviserClassStats?.length === 0 ? (
                            <div className="faculty-dashboard__empty flex flex-col items-center justify-center px-6 py-10 text-center sm:col-span-2">
                                <span className="faculty-dashboard__empty-icon inline-flex h-10 w-10 items-center justify-center rounded-full" aria-hidden="true">
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
                                    className="faculty-dashboard__adviser-card"
                                    key={stat.classId}
                                    onClick={() => navigate("/faculty/my-class")}
                                >
                                    <GenderPieChart male={stat.maleCount} female={stat.femaleCount} fullWidth />
                                    <div className="faculty-dashboard__adviser-card-overlay">
                                        <span className="faculty-dashboard__adviser-card-eyebrow">Grade {stat.classGradeLevel}</span>
                                        <h4 className="faculty-dashboard__adviser-card-name">{stat.classSection}</h4>
                                        <div className="faculty-dashboard__adviser-gender">
                                            <span className="faculty-dashboard__gender-badge faculty-dashboard__gender-badge--male">
                                                <span className="faculty-dashboard__gender-dot faculty-dashboard__gender-dot--male" aria-hidden="true" /> {stat.maleCount} male
                                            </span>
                                            <span className="faculty-dashboard__gender-badge faculty-dashboard__gender-badge--female">
                                                <span className="faculty-dashboard__gender-dot faculty-dashboard__gender-dot--female" aria-hidden="true" /> {stat.femaleCount} female
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </div>
            
            </div>

            {/* ==================== Honor Students (adviser-only) ==================== */}
            {adviserClasses && adviserClasses.length > 0 && honorStudents && (
                <div className="faculty-dashboard__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="faculty-dashboard__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="faculty-dashboard__card-heading min-w-0">
                            <h3 className="faculty-dashboard__card-title text-base font-bold">Honor Students</h3>
                            <p className="faculty-dashboard__card-subtitle mt-1 text-[0.8125rem]">
                                Average {honorStudents.passingGrade} or higher in Grade {honorStudents.classGradeLevel} — {honorStudents.classSection} · Quarter {honorStudents.quarter}
                            </p>
                        </div>
                        <span className="faculty-dashboard__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            <FiAward aria-hidden="true" />
                            {honorStudents.students.length} honor {honorStudents.students.length === 1 ? "student" : "students"}
                        </span>
                    </div>

                    {honorStudents.students.length === 0 ? (
                        <div className="faculty-dashboard__empty flex flex-col items-center justify-center px-6 py-10 text-center">
                            <span className="faculty-dashboard__empty-icon inline-flex h-10 w-10 items-center justify-center rounded-full" aria-hidden="true">
                                <FiAward />
                            </span>
                            <p className="mt-2 text-[0.8125rem] font-bold">No honor students yet</p>
                            <p className="mt-1 text-[0.6875rem]">
                                No student has reached the {honorStudents.passingGrade} average for Quarter {honorStudents.quarter} yet.
                            </p>
                        </div>
                    ) : (
                        <ol className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                            {honorStudents.students.map((student) => (
                                <li className="faculty-dashboard__honor flex items-center gap-3 rounded-xl border p-3.5" key={student.enrollmentId}>
                                    <span
                                        className={`faculty-dashboard__honor-rank faculty-dashboard__honor-rank--${Math.min(student.rank, 3)} inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-bold`}
                                        aria-label={`Rank ${student.rank}`}
                                    >
                                        {student.rank}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <span className="block truncate text-[0.8125rem] font-bold">{student.fullname}</span>
                                        <span className="faculty-dashboard__honor-meta block font-mono text-[0.6875rem]">
                                            LRN {student.studentLrn} · {student.gradedSubjects} subject{student.gradedSubjects === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    <span className="faculty-dashboard__honor-average inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-[0.8125rem] font-bold">
                                        {student.average.toFixed(2)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            )}
        </PageShell>
    );
}
