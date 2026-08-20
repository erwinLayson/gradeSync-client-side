import { useEffect, useState } from "react";
import {
    FiAlertTriangle,
    FiArrowLeft,
    FiBookOpen,
    FiCalendar,
    FiCheck,
    FiChevronDown,
    FiChevronRight,
    FiChevronUp,
    FiClipboard,
    FiHome,
    FiUser,
    FiUsers,
} from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { getInitials } from "../../helper/initials";

import type {
    StudentClass,
    StudentClassesData,
} from "../../constant/studentClasses";
import { QUARTERS, TYPE_LABELS } from "../../constant/studentClasses";

import "../../style/studentClassroom.css";

type DetailTab = "activities" | "attendance";

export default function StudentClassroom() {
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<StudentClassesData["student"] | null>(null);
    const [classes, setClasses] = useState<StudentClass[]>([]);
    const [selectedClass, setSelectedClass] = useState<StudentClass | null>(null);

    // Detail-view state
    const [activeTab, setActiveTab] = useState<DetailTab>("activities");
    const [activeQuarter, setActiveQuarter] = useState(1);
    const [expandedSubject, setExpandedSubject] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function loadClasses() {
            try {
                const response = await getAPICall<StudentClassesData>("/students/classes", { toast: false });
                if (cancelled) return;
                setStudent(response.data?.student ?? null);
                setClasses(response.data?.classes ?? []);
            } catch {
                // Error toast is handled by the axios interceptor in api.ts
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadClasses();
        return () => {
            cancelled = true;
        };
    }, []);

    const totalSubjects = classes.reduce((sum, cls) => sum + cls.subjects.length, 0);
    const totalUnits = classes.reduce(
        (sum, cls) => sum + cls.subjects.reduce((s, subject) => s + (subject.unit ?? 0), 0),
        0
    );
    const currentClass = classes[0] ?? null;

    // ==================== Class detail view ====================
    if (selectedClass) {
        const hasQuarterActivities = selectedClass.subjects.some((subject) =>
            subject.assessments.some((assessment) => assessment.quarter === activeQuarter),
        );

        return (
            <section className="student-classes__page flex flex-col gap-5">
                {/* Back button */}
                <button
                    type="button"
                    className="student-classes__back inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                    onClick={() => setSelectedClass(null)}
                    aria-label="Back to classes"
                >
                    <FiArrowLeft aria-hidden="true" />
                    <span className="text-sm font-bold">Back to Classes</span>
                </button>

                {/* Detail hero */}
                <div className="student-classes__details-hero flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="flex min-w-0 items-center gap-4">
                        <span className="student-classes__details-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl" aria-hidden="true">
                            <FiHome />
                        </span>
                        <div className="min-w-0">
                            <span className="student-classes__details-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                Grade {selectedClass.gradeLevel}
                            </span>
                            <h3 className="student-classes__details-title mt-1 truncate text-[1.375rem] font-bold">
                                {selectedClass.section}
                            </h3>
                            <p className="student-classes__details-subtitle mt-0.5 truncate text-[0.8125rem]">
                                Classroom #{selectedClass.classId} &middot; SY {selectedClass.schoolYear}
                            </p>
                        </div>
                    </div>
                    <div className="student-classes__details-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                        <span className="student-classes__details-badge-count text-[1.375rem] font-bold leading-none">
                            {selectedClass.subjects.length}
                        </span>
                        <span className="student-classes__details-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Subjects
                        </span>
                    </div>
                </div>

                {/* Detail stats */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="student-classes__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                        <span className="student-classes__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Grade Level
                        </span>
                        <span className="student-classes__details-stat-value text-[0.9375rem] font-bold">
                            Grade {selectedClass.gradeLevel}
                        </span>
                    </div>
                    <div className="student-classes__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                        <span className="student-classes__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Class Adviser
                        </span>
                        <span className="student-classes__details-stat-value text-[0.9375rem] font-bold">
                            {selectedClass.adviser ?? "—"}
                        </span>
                    </div>
                    <div className="student-classes__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                        <span className="student-classes__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            School Year
                        </span>
                        <span className="student-classes__details-stat-value text-[0.9375rem] font-bold">
                            {selectedClass.schoolYear}
                        </span>
                    </div>
                </div>

                {/* Subjects & teachers */}
                <section className="student-classes__subjects overflow-hidden rounded-2xl" aria-label="Class subjects">
                    <div className="border-b px-5 py-4">
                        <h4 className="text-[0.9375rem] font-bold text-neutral-900">Subjects &amp; Teachers</h4>
                        <p className="mt-1 text-[0.8125rem] text-neutral-500">
                            Your teachers for {selectedClass.section}.
                        </p>
                    </div>
                    <div className="flex flex-col">
                        {selectedClass.subjects.map((subject) => (
                            <div key={subject.classSubjectId ?? subject.name} className="student-classes__subjects-row flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="student-classes__subjects-subject-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                        <FiBookOpen />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-neutral-900">{subject.name}</p>
                                        <p className="student-classes__subjects-subject-code mt-0.5 truncate text-xs">
                                            {subject.code} &middot; {subject.unit ?? "—"} {subject.unit === 1 ? "unit" : "units"}
                                        </p>
                                    </div>
                                </div>
                                <p className="student-classes__subjects-teacher flex items-center gap-1.5 text-[0.8125rem]">
                                    <FiUser className="shrink-0" aria-hidden="true" />
                                    {subject.teacher ?? "—"}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ==================== Tabs + quarter selector ==================== */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
                        <button
                            type="button"
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-[0.8125rem] font-semibold transition ${
                                activeTab === "activities"
                                    ? "student-classes__tab--active"
                                    : "text-neutral-500 hover:text-neutral-800"
                            }`}
                            onClick={() => setActiveTab("activities")}
                        >
                            <FiClipboard aria-hidden="true" />
                            Activities &amp; Scores
                        </button>
                        <button
                            type="button"
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-[0.8125rem] font-semibold transition ${
                                activeTab === "attendance"
                                    ? "student-classes__tab--active"
                                    : "text-neutral-500 hover:text-neutral-800"
                            }`}
                            onClick={() => setActiveTab("attendance")}
                        >
                            <FiCalendar aria-hidden="true" />
                            Attendance
                        </button>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm" role="group" aria-label="Select quarter">
                        {QUARTERS.map((quarter) => (
                            <button
                                key={quarter}
                                type="button"
                                className={`inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-[0.8125rem] font-bold transition ${
                                    activeQuarter === quarter
                                        ? "student-classes__quarter--active"
                                        : "text-neutral-500 hover:text-neutral-800"
                                }`}
                                onClick={() => setActiveQuarter(quarter)}
                            >
                                Q{quarter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ==================== Activities & Scores (one table per subject) ==================== */}
                {activeTab === "activities" && (
                    <div className="flex flex-col gap-5" aria-label="Activities and scores">
                        {!hasQuarterActivities ? (
                            <section className="student-classes__grades overflow-hidden rounded-2xl">
                                <div className="border-b px-5 py-4">
                                    <h4 className="text-[0.9375rem] font-bold text-neutral-900">Activities &amp; Scores — Quarter {activeQuarter}</h4>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        Your recorded activities and scores for each subject.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400" aria-hidden="true">
                                        <FiClipboard />
                                    </span>
                                    <p className="mt-3 text-sm font-bold text-neutral-800">No activities yet</p>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        Your teachers have not recorded activities for Quarter {activeQuarter}.
                                    </p>
                                </div>
                            </section>
                        ) : (
                            selectedClass.subjects.map((subject) => {
                                const activities = subject.assessments.filter(
                                    (assessment) => assessment.quarter === activeQuarter,
                                );

                                return (
                                    <section
                                        key={subject.classSubjectId ?? subject.name}
                                        className="student-classes__grades overflow-hidden rounded-2xl"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="student-classes__subjects-subject-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                                    <FiBookOpen />
                                                </span>
                                                <div className="min-w-0">
                                                    <h4 className="truncate text-[0.9375rem] font-bold text-neutral-900">
                                                        {subject.name}
                                                    </h4>
                                                    <p className="student-classes__subjects-subject-code mt-0.5 truncate text-xs">
                                                        {subject.code} &middot; {subject.teacher ?? "—"}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="student-classes__card-tag inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
                                                Quarter {activeQuarter} &middot; {activities.length} {activities.length === 1 ? "activity" : "activities"}
                                            </span>
                                        </div>

                                        {activities.length === 0 ? (
                                            <p className="px-5 py-6 text-[0.8125rem] text-neutral-500">
                                                No activities recorded for this subject in Quarter {activeQuarter}.
                                            </p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="student-classes__grades-table text-sm">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-5 py-3 text-left font-bold">Type</th>
                                                            <th className="px-3 py-3 text-left font-bold">Activity</th>
                                                            <th className="px-3 py-3 text-center font-bold">Date</th>
                                                            <th className="px-3 py-3 text-center font-bold">Max</th>
                                                            <th className="px-3 py-3 text-center font-bold">Score</th>
                                                            <th className="px-5 py-3 text-center font-bold">%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {activities.map((activity) => {
                                                            const percentage =
                                                                activity.score === null
                                                                    ? null
                                                                    : Math.min(100, Math.round((activity.score / activity.maxScore) * 10000) / 100);
                                                            return (
                                                                <tr key={activity.id}>
                                                                    <td className="px-5 py-3">
                                                                        <span className="student-classes__activity-type inline-flex rounded-full px-2.5 py-1 text-xs font-bold">
                                                                            {TYPE_LABELS[activity.type]}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-3 font-semibold">{activity.title}</td>
                                                                    <td className="px-3 py-3 text-center text-neutral-600">
                                                                        {activity.dateGiven ?? "—"}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-center font-semibold">{activity.maxScore}</td>
                                                                    <td className="px-3 py-3 text-center font-bold">
                                                                        {activity.score === null ? (
                                                                            <span className="text-neutral-400">—</span>
                                                                        ) : (
                                                                            activity.score
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-3 text-center">
                                                                        {percentage === null ? (
                                                                            <span className="text-neutral-400">—</span>
                                                                        ) : (
                                                                            <span
                                                                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                                                                    percentage >= 75
                                                                                        ? "student-classes__grade-passed"
                                                                                        : "student-classes__grade-failed"
                                                                                }`}
                                                                            >
                                                                                {percentage}%
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
                                    </section>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ==================== Attendance ==================== */}
                {activeTab === "attendance" && (
                    <section className="student-classes__grades overflow-hidden rounded-2xl" aria-label="Attendance">
                        <div className="border-b px-5 py-4">
                            <h4 className="text-[0.9375rem] font-bold text-neutral-900">Attendance — Quarter {activeQuarter}</h4>
                            <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                Days present per subject. Click a subject to see the daily records.
                            </p>
                        </div>

                        <div className="flex flex-col">
                            {selectedClass.subjects.map((subject) => {
                                const quarterAttendance = subject.attendance.find((a) => a.quarter === activeQuarter);
                                const present = quarterAttendance?.presentDays ?? 0;
                                const total = quarterAttendance?.totalDays ?? 0;
                                const percentage = quarterAttendance?.percentage ?? null;
                                // Frozen record rows (classSubjectId === null) have no
                                // attendance history — they are not expandable.
                                const expanded =
                                    subject.classSubjectId !== null && expandedSubject === subject.classSubjectId;

                                return (
                                    <div key={subject.classSubjectId ?? subject.name} className="student-classes__subjects-row">
                                        <button
                                            type="button"
                                            className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
                                            onClick={() => {
                                                if (subject.classSubjectId === null) return;
                                                setExpandedSubject(expanded ? null : subject.classSubjectId);
                                            }}
                                            aria-expanded={expanded}
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="student-classes__subjects-subject-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                                    <FiCalendar />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-neutral-900">{subject.name}</p>
                                                    <p className="student-classes__subjects-subject-code mt-0.5 truncate text-xs">
                                                        {subject.code} &middot; {subject.teacher ?? "—"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[0.8125rem] text-neutral-600">
                                                    {total === 0 ? (
                                                        <span className="text-neutral-400">No records</span>
                                                    ) : (
                                                        <>
                                                            <span className="font-bold text-neutral-800">{present}</span>
                                                            {" / "}
                                                            <span className="font-bold text-neutral-800">{total}</span>
                                                            {" days present"}
                                                        </>
                                                    )}
                                                </span>
                                                <span
                                                    className={`inline-flex min-w-[3.5rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${
                                                        percentage === null
                                                            ? "bg-neutral-100 text-neutral-400"
                                                            : percentage >= 90
                                                                ? "student-classes__grade-passed"
                                                                : percentage >= 75
                                                                    ? "student-classes__attendance-warn"
                                                                    : "student-classes__grade-failed"
                                                    }`}
                                                >
                                                    {percentage === null ? "—" : `${percentage}%`}
                                                </span>
                                                {expanded ? (
                                                    <FiChevronUp className="text-neutral-400" aria-hidden="true" />
                                                ) : (
                                                    <FiChevronDown className="text-neutral-400" aria-hidden="true" />
                                                )}
                                            </div>
                                        </button>

                                        {expanded && (
                                            <div className="border-t px-5 py-4">
                                                {total === 0 ? (
                                                    <p className="text-[0.8125rem] text-neutral-500">
                                                        No attendance recorded for this quarter.
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {quarterAttendance?.records.map((record, index) => (
                                                            <span
                                                                key={index}
                                                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                                                    record.status === "present"
                                                                        ? "student-classes__attendance-present"
                                                                        : "student-classes__attendance-absent"
                                                                }`}
                                                            >
                                                                {record.status === "present" ? (
                                                                    <FiCheck aria-hidden="true" />
                                                                ) : (
                                                                    <FiAlertTriangle aria-hidden="true" />
                                                                )}
                                                                {record.date}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Footer note */}
                <p className="flex items-center gap-2 text-[0.8125rem] text-neutral-500">
                    <FiCalendar className="shrink-0" aria-hidden="true" />
                    Scores and attendance shown are the records entered by your teachers.
                </p>
            </section>
        );
    }

    // ==================== Loading state ====================
    if (loading) {
        return (
            <section className="student-classes__page flex flex-col gap-5">
                <div className="student-classes__hero flex items-center gap-4 p-6">
                    <div className="h-14 w-14 animate-pulse rounded-2xl bg-white/20" />
                    <div className="flex flex-col gap-2">
                        <div className="h-3 w-24 animate-pulse rounded bg-white/30" />
                        <div className="h-5 w-48 animate-pulse rounded bg-white/30" />
                        <div className="h-3 w-64 animate-pulse rounded bg-white/20" />
                    </div>
                </div>
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-neutral-400 shadow-sm">
                    Loading your classes…
                </div>
            </section>
        );
    }

    // ==================== Empty state ====================
    if (!student || classes.length === 0) {
        return (
            <section className="student-classes__page flex flex-col gap-5">
                <div className="student-classes__hero flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="flex min-w-0 items-center gap-4">
                        <span
                            className="student-classes__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                            aria-hidden="true"
                        >
                            {getInitials(student?.fullname ?? "?")}
                        </span>
                        <div className="min-w-0">
                            <span className="student-classes__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                Student
                            </span>
                            <h2 className="student-classes__hero-name mt-1 truncate text-[1.375rem] font-bold">
                                {student?.fullname ?? "Student"}
                            </h2>
                            <p className="student-classes__hero-role mt-0.5 truncate text-[0.8125rem]">
                                {student ? `LRN ${student.lrn} &middot; ${student.email}` : ""}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
                        <FiAlertTriangle />
                    </span>
                    <p className="mt-3 text-sm font-bold text-neutral-800">No classes found</p>
                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                        You are not enrolled in any class yet. Contact the registrar if you believe this is a mistake.
                    </p>
                </div>
            </section>
        );
    }

    // ==================== My Classrooms list view ====================
    return (
        <section className="student-classes__page flex flex-col gap-5">
            {/* Hero banner */}
            <div className="student-classes__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex min-w-0 items-center gap-4">
                    <span
                        className="student-classes__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                        aria-hidden="true"
                    >
                        {getInitials(student.fullname)}
                    </span>
                    <div className="min-w-0">
                        <span className="student-classes__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Student
                        </span>
                        <h2 className="student-classes__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            {student.fullname}
                        </h2>
                        <p className="student-classes__hero-role mt-0.5 truncate text-[0.8125rem]">
                            LRN {student.lrn} &middot; {student.email}
                        </p>
                    </div>
                </div>
                <div className="student-classes__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="student-classes__hero-badge-count text-[1.375rem] font-bold leading-none">
                        {classes.length}
                    </span>
                    <span className="student-classes__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        {classes.length === 1 ? "Class" : "Classes"}
                    </span>
                </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="student-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-classes__stat-icon student-classes__stat-icon--green inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiHome />
                    </span>
                    <div className="min-w-0">
                        <span className="student-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Grade Level
                        </span>
                        <span className="student-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {currentClass ? `Grade ${currentClass.gradeLevel}` : "—"}
                        </span>
                    </div>
                </div>

                <div className="student-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-classes__stat-icon student-classes__stat-icon--blue inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="student-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Subjects
                        </span>
                        <span className="student-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {totalSubjects}
                        </span>
                    </div>
                </div>

                <div className="student-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-classes__stat-icon student-classes__stat-icon--amber inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiCalendar />
                    </span>
                    <div className="min-w-0">
                        <span className="student-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            School Year
                        </span>
                        <span className="student-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {currentClass?.schoolYear ?? "—"}
                        </span>
                    </div>
                </div>

                <div className="student-classes__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-classes__stat-icon student-classes__stat-icon--violet inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="student-classes__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Total Units
                        </span>
                        <span className="student-classes__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {totalUnits} units
                        </span>
                    </div>
                </div>
            </div>

            {/* Class cards */}
            <section className="flex flex-col gap-4" aria-label="My classes">
                <div className="min-w-0">
                    <h3 className="text-[0.9375rem] font-bold text-neutral-900">My Classes</h3>
                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                        Sections and subjects you are enrolled in.
                    </p>
                </div>

                {classes.map((cls) => (
                    <article key={cls.enrollmentId} className="student-classes__card overflow-hidden rounded-2xl">
                        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                            <div className="flex min-w-0 items-center gap-4">
                                <span className="student-classes__card-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                                    <FiHome />
                                </span>
                                <div className="min-w-0">
                                    <span className="student-classes__card-tag inline-flex rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
                                        Grade {cls.gradeLevel}
                                    </span>
                                    <h4 className="mt-1.5 truncate text-[1.125rem] font-bold text-neutral-900">
                                        {cls.section}
                                    </h4>
                                    <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                        SY {cls.schoolYear}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col items-start gap-2 text-[0.8125rem] text-neutral-600 sm:items-end">
                                <p className="flex items-center gap-1.5">
                                    <FiUser className="student-classes__card-row-icon shrink-0" aria-hidden="true" />
                                    Adviser: <span className="font-semibold text-neutral-800">{cls.adviser ?? "—"}</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                    <FiBookOpen className="student-classes__card-row-icon shrink-0" aria-hidden="true" />
                                    {cls.subjects.length} subjects
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 border-t px-5 py-4">
                            {cls.subjects.map((subject) => (
                                <span
                                    key={subject.classSubjectId ?? subject.name}
                                    className="student-classes__card-subject inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                                >
                                    <span className="student-classes__card-subject-badge inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.625rem] font-bold">
                                        {subject.unit ?? "—"}
                                    </span>
                                    {subject.name}
                                </span>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
                            <p className="text-[0.8125rem] text-neutral-500">
                                View your activities, scores, and attendance for this section.
                            </p>
                            <button
                                type="button"
                                className="student-classes__card-cta inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold"
                                onClick={() => {
                                    setActiveTab("activities");
                                    setActiveQuarter(1);
                                    setExpandedSubject(null);
                                    setSelectedClass(cls);
                                }}
                            >
                                View Class
                                <FiChevronRight aria-hidden="true" />
                            </button>
                        </div>
                    </article>
                ))}
            </section>
        </section>
    );
}
