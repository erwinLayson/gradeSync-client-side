import { useEffect, useState } from "react";
import {
    FiAlertTriangle,
    FiBookOpen,
    FiCalendar,
    FiCheck,
    FiChevronLeft,
    FiChevronRight,
    FiClipboard,
    FiUser,
    FiX
} from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { PageSection, PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";

import type {
    AssessmentType,
    StudentClass,
    StudentClassesData,
} from "../../constant/studentClasses";

import "../../style/studentClassroom.css";

type DetailTab = "activities" | "attendance";

function parseLocalDate(dateStr: string): Date | null {
    const raw = dateStr.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (match) {
        const [, year, month, day] = match;
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateHeader(dateStr: string | null) {
    if (!dateStr) return { monthDay: "UNSCHEDULED", dayOfWeek: "" };
    try {
        const d = parseLocalDate(dateStr);
        if (!d) return { monthDay: dateStr.toUpperCase(), dayOfWeek: "" };
        const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
        const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        return { monthDay, dayOfWeek };
    } catch {
        return { monthDay: dateStr.toUpperCase(), dayOfWeek: "" };
    }
}

function normalizeToYMD(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const raw = dateStr.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (match) return match[0];
    try {
        const d = parseLocalDate(raw);
        if (!d) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    } catch {
        return null;
    }
}

function getActivityBadge(type: AssessmentType, title: string) {
    const lowerTitle = title.toLowerCase();
    if (type === "quarterly_assessment" || lowerTitle.includes("exam") || lowerTitle.includes("periodical")) {
        return { label: "EXAM", className: "student-classes__badge-exam" };
    }
    if (type === "performance_task" || lowerTitle.includes("act") || lowerTitle.includes("task") || lowerTitle.includes("project")) {
        return { label: "ACT", className: "student-classes__badge-act" };
    }
    return { label: "QUIZ", className: "student-classes__badge-quiz" };
}

export default function StudentClassroom() {
    const { quarters } = useAcademicSettings();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<StudentClassesData["student"] | null>(null);
    const [classes, setClasses] = useState<StudentClass[]>([]);
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);

    // Detail-view state
    const [activeTab, setActiveTab] = useState<DetailTab>("activities");
    const [activeQuarter, setActiveQuarter] = useState(1);

    // Activities & Scores filter state
    const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("");
    const [activitiesDateFrom, setActivitiesDateFrom] = useState<string>("");
    const [activitiesDateTo, setActivitiesDateTo] = useState<string>("");
    const [isSubjectCollapsed, setIsSubjectCollapsed] = useState(false);

    // Attendance filter state
    const [attendanceSubjectFilter, setAttendanceSubjectFilter] = useState<string>("");
    const [attendanceDateFrom, setAttendanceDateFrom] = useState<string>("");
    const [attendanceDateTo, setAttendanceDateTo] = useState<string>("");
    const [isAttendanceSubjectCollapsed, setIsAttendanceSubjectCollapsed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function loadClasses() {
            try {
                const response = await getAPICall<StudentClassesData>("/students/classes", { toast: false });
                if (cancelled) return;
                setStudent(response.data?.student ?? null);
                const classList = response.data?.classes ?? [];
                setClasses(classList);
                if (classList.length > 0) {
                    setSelectedEnrollmentId(classList[0].enrollmentId);
                }
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

    // Loading state
    if (loading) {
        return (
            <PageShell className="student-classes">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <Skeleton lines={2} />
                    </div>
                    <Skeleton lines={1} className="h-20 rounded-2xl" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Skeleton lines={2} className="h-24 rounded-2xl" />
                        <Skeleton lines={2} className="h-24 rounded-2xl" />
                        <Skeleton lines={2} className="h-24 rounded-2xl" />
                        <Skeleton lines={2} className="h-24 rounded-2xl" />
                    </div>
                    <Skeleton lines={3} className="h-24 rounded-2xl" />
                    <PageSection flush>
                        <div className="p-6">
                            <Skeleton lines={5} gap="1rem" />
                        </div>
                    </PageSection>
                </div>
            </PageShell>
        );
    }

    const selectedClass =
        classes.find((cls) => cls.enrollmentId === selectedEnrollmentId) ??
        classes[0] ??
        null;

    // Empty state
    if (!student || classes.length === 0 || !selectedClass) {
        return (
            <PageShell className="student-classes">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                        {student?.fullname ?? "My Class"}
                    </h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        {student ? `LRN ${student.lrn} · ${student.email}` : "View your current class information."}
                    </p>
                </div>
                <PageSection>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
                            <FiAlertTriangle />
                        </span>
                        <p className="mt-3 text-sm font-bold text-neutral-800">No classes found</p>
                        <p className="mt-1 text-[0.8125rem] text-neutral-500">
                            You are not enrolled in any class yet. Contact the registrar if you believe this is a mistake.
                        </p>
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    const totalUnits = selectedClass.subjects.reduce(
        (sum, subject) => sum + (subject.unit ?? 0),
        0
    );

    return (
        <PageShell className="student-classes">
            {/* Header with Title, description and optional class switcher */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">My Class</h1>
                    <p className="mt-1 text-sm text-neutral-500">View your current class information.</p>
                </div>
                {classes.length > 1 && (
                    <div className="flex items-center gap-2">
                        <label htmlFor="student-class-selector" className="text-xs font-semibold text-neutral-500">
                            Enrolled Class:
                        </label>
                        <select
                            id="student-class-selector"
                            value={selectedClass.enrollmentId}
                            onChange={(e) => {
                                setSelectedEnrollmentId(Number(e.target.value));
                            }}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm focus:border-emerald-600 focus:outline-none"
                        >
                            {classes.map((cls) => (
                                <option key={cls.enrollmentId} value={cls.enrollmentId}>
                                    Grade {cls.gradeLevel} - {cls.section} (SY {cls.schoolYear})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* ModuLearn-styled Class Summary Hero Card */}
            <div className="student-classes__modu-hero flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-4">
                    <span className="student-classes__modu-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-neutral-900 truncate">
                            Grade {selectedClass.gradeLevel} - {selectedClass.section}
                        </h2>
                        <p className="mt-0.5 text-xs text-neutral-500 truncate">
                            Your current class &middot; Classroom #{selectedClass.classId} &middot; SY {selectedClass.schoolYear}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="student-classes__pill-badge student-classes__pill-badge--green" title={`Grade ${selectedClass.gradeLevel}`}>
                        {selectedClass.gradeLevel}
                    </span>
                    <span className="student-classes__pill-badge student-classes__pill-badge--gold" title={`Section ${selectedClass.section}`}>
                        {selectedClass.section}
                    </span>
                </div>
            </div>

            {/* Organized Stat Cards Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="student-classes__modu-stat flex flex-col justify-center">
                    <span className="student-classes__modu-stat-label">
                        Grade Level
                    </span>
                    <span className="student-classes__modu-stat-value mt-1">
                        {selectedClass.gradeLevel}
                    </span>
                </div>
                <div className="student-classes__modu-stat flex flex-col justify-center">
                    <span className="student-classes__modu-stat-label">
                        Section
                    </span>
                    <span className="student-classes__modu-stat-value mt-1">
                        {selectedClass.section}
                    </span>
                </div>
                <div className="student-classes__modu-stat flex flex-col justify-center">
                    <span className="student-classes__modu-stat-label">
                        Subjects
                    </span>
                    <span className="student-classes__modu-stat-value mt-1">
                        {selectedClass.subjects.length}
                    </span>
                </div>
                <div className="student-classes__modu-stat flex flex-col justify-center">
                    <span className="student-classes__modu-stat-label">
                        Total Units
                    </span>
                    <span className="student-classes__modu-stat-value mt-1">
                        {totalUnits}
                    </span>
                </div>
            </div>

            {/* Organized Classroom Information Card (Adviser & Academic Details) */}
            <div className="student-classes__modu-info grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                    <span className="student-classes__modu-stat-label">
                        Adviser
                    </span>
                    <p className="mt-2 text-base font-semibold text-neutral-900 flex items-center gap-2">
                        <FiUser className="text-neutral-400 shrink-0" aria-hidden="true" />
                        {selectedClass.adviser ?? "—"}
                    </p>
                </div>
                <div>
                    <span className="student-classes__modu-stat-label">
                        Academic Details
                    </span>
                    <div className="mt-2 text-sm text-neutral-700">
                        <p className="font-semibold text-neutral-900">
                            School Year {selectedClass.schoolYear} &middot; Classroom #{selectedClass.classId}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                            Student: {student.fullname} (LRN {student.lrn})
                        </p>
                    </div>
                </div>
            </div>

            {/* ==================== Tabs + quarter selector ==================== */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex gap-2 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
                    <button
                        type="button"
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-[0.8125rem] font-semibold transition ${activeTab === "activities"
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
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-[0.8125rem] font-semibold transition ${activeTab === "attendance"
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
                    {quarters.map((quarter) => (
                        <button
                            key={quarter}
                            type="button"
                            className={`inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-[0.8125rem] font-bold transition ${activeQuarter === quarter
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

            {/* ==================== Activities & Scores (Matrix view) ==================== */}
            {activeTab === "activities" && (() => {
                // Collect all assessments for activeQuarter across all subjects in this class
                const allQuarterAssessments: {
                    id: number;
                    subjectId: number | null;
                    subjectName: string;
                    type: AssessmentType;
                    title: string;
                    maxScore: number;
                    dateGiven: string | null;
                }[] = [];

                selectedClass.subjects.forEach((sub) => {
                    sub.assessments
                        .filter((a) => a.quarter === activeQuarter)
                        .forEach((a) => {
                            allQuarterAssessments.push({
                                id: a.id,
                                subjectId: sub.classSubjectId,
                                subjectName: sub.name,
                                type: a.type,
                                title: a.title,
                                maxScore: a.maxScore,
                                dateGiven: a.dateGiven,
                            });
                        });
                });

                allQuarterAssessments.sort((a, b) => {
                    if (a.dateGiven && b.dateGiven) {
                        const timeDiff = new Date(a.dateGiven).getTime() - new Date(b.dateGiven).getTime();
                        if (timeDiff !== 0) return timeDiff;
                    } else if (a.dateGiven) {
                        return -1;
                    } else if (b.dateGiven) {
                        return 1;
                    }
                    return a.id - b.id;
                });

                const displayActivities = allQuarterAssessments.filter((a) => {
                    if (selectedSubjectFilter && a.subjectName !== selectedSubjectFilter) {
                        return false;
                    }
                    if (activitiesDateFrom || activitiesDateTo) {
                        if (!a.dateGiven) return false;
                        const ymd = normalizeToYMD(a.dateGiven);
                        if (!ymd) return false;
                        if (activitiesDateFrom && ymd < activitiesDateFrom) return false;
                        if (activitiesDateTo && ymd > activitiesDateTo) return false;
                    }
                    return true;
                });

                const filteredSubjects = selectedSubjectFilter
                    ? selectedClass.subjects.filter((s) => s.name === selectedSubjectFilter)
                    : selectedClass.subjects;

                const validQuarterGrades = filteredSubjects
                    .map((s) => s.quarters[activeQuarter - 1])
                    .filter((g): g is number => typeof g === "number" && !Number.isNaN(g));

                const averageQuarterGrade =
                    validQuarterGrades.length > 0
                        ? (validQuarterGrades.reduce((sum, g) => sum + g, 0) / validQuarterGrades.length).toFixed(2)
                        : "—";

                interface DateGroup {
                    key: string;
                    monthDay: string;
                    dayOfWeek: string;
                    colSpan: number;
                }

                const dateGroups: DateGroup[] = [];
                displayActivities.forEach((act, idx) => {
                    const { monthDay, dayOfWeek } = formatDateHeader(act.dateGiven);
                    const lastGroup = dateGroups[dateGroups.length - 1];
                    if (lastGroup && lastGroup.monthDay === monthDay && lastGroup.dayOfWeek === dayOfWeek) {
                        lastGroup.colSpan += 1;
                    } else {
                        dateGroups.push({
                            key: `date_grp_${idx}_${monthDay}_${dayOfWeek}`,
                            monthDay,
                            dayOfWeek,
                            colSpan: 1,
                        });
                    }
                });

                return (
                    <div className="flex flex-col gap-4" aria-label="Activities and scores matrix">
                        {/* Activities Filter Bar */}
                        <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-2xl border border-neutral-200 shadow-sm">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="matrix-subject-filter" className="text-xs font-semibold text-neutral-500">
                                    Subject
                                </label>
                                <select
                                    id="matrix-subject-filter"
                                    value={selectedSubjectFilter}
                                    onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                                    className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 shadow-sm focus:border-emerald-600 focus:outline-none min-w-[200px]"
                                >
                                    <option value="">All Subjects</option>
                                    {selectedClass.subjects.map((sub) => (
                                        <option key={sub.classSubjectId ?? sub.name} value={sub.name}>
                                            {sub.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="activities-date-from" className="text-xs font-semibold text-neutral-500">
                                    From
                                </label>
                                <input
                                    id="activities-date-from"
                                    type="date"
                                    value={activitiesDateFrom}
                                    max={activitiesDateTo || undefined}
                                    onChange={(e) => setActivitiesDateFrom(e.target.value)}
                                    className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 shadow-sm focus:border-emerald-600 focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="activities-date-to" className="text-xs font-semibold text-neutral-500">
                                    To
                                </label>
                                <input
                                    id="activities-date-to"
                                    type="date"
                                    value={activitiesDateTo}
                                    min={activitiesDateFrom || undefined}
                                    onChange={(e) => setActivitiesDateTo(e.target.value)}
                                    className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 shadow-sm focus:border-emerald-600 focus:outline-none"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSubjectFilter("");
                                    setActivitiesDateFrom("");
                                    setActivitiesDateTo("");
                                }}
                                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-sm transition cursor-pointer"
                            >
                                Clear Filter
                            </button>
                        </div>

                        {displayActivities.length === 0 ? (
                            <section className="student-classes__matrix-card">
                                <div className="border-b px-5 py-4">
                                    <h4 className="text-[0.9375rem] font-bold text-neutral-900">
                                        Activities &amp; Scores — Quarter {activeQuarter}
                                    </h4>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        Your recorded activities and scores for each subject.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400" aria-hidden="true">
                                        <FiClipboard />
                                    </span>
                                    <p className="mt-3 text-sm font-bold text-neutral-800">
                                        {selectedSubjectFilter || activitiesDateFrom || activitiesDateTo
                                            ? "No activities match your filter"
                                            : "No activities yet"}
                                    </p>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        {selectedSubjectFilter || activitiesDateFrom || activitiesDateTo
                                            ? "Try adjusting your filters or clearing the date range."
                                            : `Your faculties have not recorded activities for Quarter ${activeQuarter}.`}
                                    </p>
                                </div>
                            </section>
                        ) : (
                            <section className="student-classes__matrix-card" aria-label="Activities Matrix">
                                {/* Mobile-only Subject Column Toggle Toolbar */}
                                <div className="flex md:hidden items-center justify-between px-3.5 py-2.5 bg-neutral-50 border-b border-neutral-200">
                                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                                        <span className="font-semibold text-neutral-800">Subject Column:</span>
                                        <span className={isSubjectCollapsed ? "text-amber-700 font-bold" : "text-[#176B3A] font-bold"}>
                                            {isSubjectCollapsed ? "Collapsed" : "Expanded"}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsSubjectCollapsed((prev) => !prev)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-neutral-300 bg-white text-neutral-800 shadow-xs hover:bg-neutral-100 active:scale-95 transition cursor-pointer"
                                        aria-label={isSubjectCollapsed ? "Expand Subject Column" : "Collapse Subject Column"}
                                    >
                                        {isSubjectCollapsed ? (
                                            <>
                                                <span>Expand</span>
                                                <FiChevronRight className="h-3.5 w-3.5 text-neutral-500" />
                                            </>
                                        ) : (
                                            <>
                                                <FiChevronLeft className="h-3.5 w-3.5 text-neutral-500" />
                                                <span>Collapse</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="student-classes__matrix-table-wrap">
                                    <table className="student-classes__matrix-table">
                                        <thead>
                                            {/* Row 1: Date headers */}
                                            <tr>
                                                <th
                                                    scope="col"
                                                    className={`student-classes__matrix-subject-th student-classes__sticky-col student-classes__sticky-date-blank ${isSubjectCollapsed ? "student-classes__matrix-subject-th--collapsed" : ""
                                                        }`}
                                                ></th>
                                                {dateGroups.map((grp) => (
                                                    <th
                                                        key={grp.key}
                                                        colSpan={grp.colSpan}
                                                        scope="colgroup"
                                                        className="student-classes__matrix-date-th"
                                                    >
                                                        <div className="flex flex-col items-center justify-center leading-tight">
                                                            <span className="text-[0.6875rem] font-bold text-neutral-600 tracking-wider">
                                                                {grp.monthDay}
                                                            </span>
                                                            {grp.dayOfWeek && (
                                                                <span className="text-[0.625rem] font-semibold text-neutral-400 mt-0.5">
                                                                    {grp.dayOfWeek}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </th>
                                                ))}
                                                <th scope="col" className="student-classes__matrix-grade-col student-classes__matrix-date-th"></th>
                                            </tr>

                                            {/* Row 2: Type Badges & column titles */}
                                            <tr>
                                                <th
                                                    scope="col"
                                                    className={`student-classes__matrix-subject-th student-classes__sticky-col text-xs font-bold uppercase tracking-wider text-neutral-500 ${isSubjectCollapsed ? "student-classes__matrix-subject-th--collapsed text-center" : "text-left"
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="truncate">
                                                            {isSubjectCollapsed ? (
                                                                <>
                                                                    <span className="md:hidden inline text-[0.6875rem]">SUBJ</span>
                                                                    <span className="hidden md:inline">SUBJECT</span>
                                                                </>
                                                            ) : (
                                                                "SUBJECT"
                                                            )}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsSubjectCollapsed((prev) => !prev)}
                                                            className="md:hidden inline-flex items-center justify-center p-1 rounded-md bg-neutral-200/70 hover:bg-neutral-200 text-neutral-700 transition active:scale-95 cursor-pointer shrink-0"
                                                            title={isSubjectCollapsed ? "Expand Subject Column" : "Collapse Subject Column"}
                                                            aria-label={isSubjectCollapsed ? "Expand Subject Column" : "Collapse Subject Column"}
                                                        >
                                                            {isSubjectCollapsed ? (
                                                                <FiChevronRight className="h-3 w-3" />
                                                            ) : (
                                                                <FiChevronLeft className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </th>
                                                {displayActivities.map((act) => {
                                                    const badge = getActivityBadge(act.type, act.title);
                                                    return (
                                                        <th
                                                            key={act.id}
                                                            scope="col"
                                                            className="student-classes__matrix-act-col bg-[#f8fafc]"
                                                            title={`${act.title} (${act.subjectName}) - ${act.maxScore} pts`}
                                                        >
                                                            <span className={badge.className}>{badge.label}</span>
                                                        </th>
                                                    );
                                                })}
                                                <th scope="col" className="student-classes__matrix-grade-col bg-[#f0fdf4] text-[#176B3A] font-extrabold text-xs tracking-wider">
                                                    GRADE
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSubjects.map((subject) => {
                                                const quarterGrade = subject.quarters[activeQuarter - 1];

                                                return (
                                                    <tr key={subject.classSubjectId ?? subject.name} className="transition-colors">
                                                        <td
                                                            className={`student-classes__matrix-subject-td student-classes__sticky-col ${isSubjectCollapsed ? "student-classes__matrix-subject-td--collapsed" : ""
                                                                }`}
                                                        >
                                                            {/* Mobile view when collapsed */}
                                                            <div className={`${isSubjectCollapsed ? "block md:hidden" : "hidden"} text-center`}>
                                                                <span
                                                                    className="inline-block px-1.5 py-0.5 rounded font-bold text-[0.6875rem] bg-emerald-50 text-[#176B3A] border border-emerald-200 tracking-tight leading-tight"
                                                                    title={`${subject.name}${subject.faculty ? ` • ${subject.faculty}` : ""}`}
                                                                >
                                                                    {subject.code || subject.name.slice(0, 4).toUpperCase()}
                                                                </span>
                                                            </div>

                                                            {/* Standard view on desktop, or mobile when expanded */}
                                                            <div className={isSubjectCollapsed ? "hidden md:block" : "block"}>
                                                                <p className="font-bold text-neutral-900 text-sm leading-snug">
                                                                    {subject.name}
                                                                </p>
                                                                <p className="text-xs text-neutral-500 mt-0.5 font-normal">
                                                                    {subject.faculty ?? "—"}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        {displayActivities.map((act) => {
                                                            const found = subject.assessments.find((a) => a.id === act.id && a.quarter === activeQuarter);
                                                            if (!found) {
                                                                return (
                                                                    <td key={act.id} className="student-classes__matrix-act-col text-neutral-400">
                                                                        —
                                                                    </td>
                                                                );
                                                            }
                                                            return (
                                                                <td key={act.id} className="student-classes__matrix-act-col text-xs font-semibold text-neutral-800">
                                                                    {found.score === null ? "—" : found.score}
                                                                    <span className="text-neutral-400 font-normal">/{found.maxScore}</span>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="student-classes__matrix-grade-col text-sm font-semibold text-neutral-700">
                                                            {quarterGrade !== null && quarterGrade !== undefined ? quarterGrade : "—"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* AVERAGE summary row */}
                                            <tr className="student-classes__matrix-avg">
                                                <td
                                                    className={`student-classes__matrix-subject-td student-classes__sticky-col font-extrabold text-neutral-900 text-xs uppercase tracking-wider ${isSubjectCollapsed ? "student-classes__matrix-subject-td--collapsed text-center" : ""
                                                        }`}
                                                >
                                                    {isSubjectCollapsed ? (
                                                        <>
                                                            <span className="md:hidden inline text-[0.6875rem] font-bold text-neutral-700">AVG</span>
                                                            <span className="hidden md:inline">AVERAGE</span>
                                                        </>
                                                    ) : (
                                                        "AVERAGE"
                                                    )}
                                                </td>
                                                {displayActivities.map((act) => (
                                                    <td key={act.id} className="student-classes__matrix-act-col text-neutral-400">
                                                        —
                                                    </td>
                                                ))}
                                                <td className="student-classes__matrix-grade-col text-sm font-bold text-neutral-800">
                                                    {averageQuarterGrade}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-neutral-200 bg-neutral-50/70 text-[0.75rem] text-neutral-500">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="font-semibold text-neutral-600">Legend:</span>
                                        <span className="inline-flex items-center gap-1.5"><span className="student-classes__badge-act">ACT</span> Activity</span>
                                        <span className="inline-flex items-center gap-1.5"><span className="student-classes__badge-quiz">QZ</span> Quiz</span>
                                        <span className="inline-flex items-center gap-1.5"><span className="student-classes__badge-exam">EX</span> Exam</span>
                                    </div>
                                    <span className="text-[0.6875rem] text-neutral-400 italic">
                                        Tip: Scroll horizontally to view all activities, examinations, and quarter grades.
                                    </span>
                                </div>
                            </section>
                        )}
                    </div>
                );
            })()}

            {/* ==================== Attendance ==================== */}
            {activeTab === "attendance" && (() => {
                const filteredAttendanceSubjects = attendanceSubjectFilter
                    ? selectedClass.subjects.filter((s) => s.name === attendanceSubjectFilter)
                    : selectedClass.subjects;

                const isDateFiltered = Boolean(attendanceDateFrom || attendanceDateTo);

                // Collect all unique attendance dates across the filtered subjects for activeQuarter
                const attendanceDatesSet = new Set<string>();
                filteredAttendanceSubjects.forEach((sub) => {
                    const qAtt = sub.attendance.find((a) => a.quarter === activeQuarter);
                    if (qAtt?.records) {
                        qAtt.records.forEach((rec) => {
                            const ymd = normalizeToYMD(rec.date);
                            if (ymd) {
                                if (attendanceDateFrom && ymd < attendanceDateFrom) return;
                                if (attendanceDateTo && ymd > attendanceDateTo) return;
                                attendanceDatesSet.add(ymd);
                            }
                        });
                    }
                });

                const sortedAttendanceDates = Array.from(attendanceDatesSet).sort((a, b) => a.localeCompare(b));

                // Calculate totals across all displayed subjects
                let overallPresentDays = 0;
                let overallTotalDays = 0;

                filteredAttendanceSubjects.forEach((sub) => {
                    const qAtt = sub.attendance.find((a) => a.quarter === activeQuarter);
                    if (isDateFiltered) {
                        const applicableRecords = (qAtt?.records ?? []).filter((r) => {
                            const ymd = normalizeToYMD(r.date);
                            if (!ymd) return false;
                            if (attendanceDateFrom && ymd < attendanceDateFrom) return false;
                            if (attendanceDateTo && ymd > attendanceDateTo) return false;
                            return true;
                        });
                        overallTotalDays += applicableRecords.length;
                        overallPresentDays += applicableRecords.filter((r) => r.status === "present").length;
                    } else {
                        overallPresentDays += qAtt?.presentDays ?? 0;
                        overallTotalDays += qAtt?.totalDays ?? 0;
                    }
                });

                return (
                    <div className="flex flex-col gap-4" aria-label="Attendance matrix">
                        {/* Attendance Filter Bar */}
                        <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-2xl border border-neutral-200 shadow-sm">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="attendance-subject-filter" className="text-xs font-semibold text-neutral-500">
                                    Subject
                                </label>
                                <select
                                    id="attendance-subject-filter"
                                    value={attendanceSubjectFilter}
                                    onChange={(e) => setAttendanceSubjectFilter(e.target.value)}
                                    className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 shadow-sm focus:border-emerald-600 focus:outline-none min-w-[200px]"
                                >
                                    <option value="">All Subjects</option>
                                    {selectedClass.subjects.map((sub) => (
                                        <option key={sub.classSubjectId ?? sub.name} value={sub.name}>
                                            {sub.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="attendance-date-from" className="text-xs font-semibold text-neutral-500">
                                    From
                                </label>
                                <input
                                    id="attendance-date-from"
                                    type="date"
                                    value={attendanceDateFrom}
                                    max={attendanceDateTo || undefined}
                                    onChange={(e) => setAttendanceDateFrom(e.target.value)}
                                    className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 shadow-sm focus:border-emerald-600 focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="attendance-date-to" className="text-xs font-semibold text-neutral-500">
                                    To
                                </label>
                                <input
                                    id="attendance-date-to"
                                    type="date"
                                    value={attendanceDateTo}
                                    min={attendanceDateFrom || undefined}
                                    onChange={(e) => setAttendanceDateTo(e.target.value)}
                                    className="rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 shadow-sm focus:border-emerald-600 focus:outline-none"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setAttendanceSubjectFilter("");
                                    setAttendanceDateFrom("");
                                    setAttendanceDateTo("");
                                }}
                                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-sm transition cursor-pointer"
                            >
                                Clear Filter
                            </button>
                        </div>

                        {selectedClass.subjects.length === 0 ? (
                            <section className="student-classes__matrix-card" aria-label="Attendance Matrix">
                                <div className="border-b px-5 py-4">
                                    <h4 className="text-[0.9375rem] font-bold text-neutral-900">
                                        Attendance — Quarter {activeQuarter}
                                    </h4>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        Attendance records per subject across dates.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400" aria-hidden="true">
                                        <FiCalendar />
                                    </span>
                                    <p className="mt-3 text-sm font-bold text-neutral-800">No subjects found</p>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        No subjects are assigned to this classroom.
                                    </p>
                                </div>
                            </section>
                        ) : filteredAttendanceSubjects.length === 0 ? (
                            <section className="student-classes__matrix-card" aria-label="Attendance Matrix">
                                <div className="border-b px-5 py-4">
                                    <h4 className="text-[0.9375rem] font-bold text-neutral-900">
                                        Attendance — Quarter {activeQuarter}
                                    </h4>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        Attendance records per subject across dates.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400" aria-hidden="true">
                                        <FiCalendar />
                                    </span>
                                    <p className="mt-3 text-sm font-bold text-neutral-800">No subjects found</p>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        No subjects match the selected filter.
                                    </p>
                                </div>
                            </section>
                        ) : sortedAttendanceDates.length === 0 ? (
                            <section className="student-classes__matrix-card" aria-label="Attendance Matrix">
                                <div className="border-b px-5 py-4">
                                    <h4 className="text-[0.9375rem] font-bold text-neutral-900">
                                        Attendance — Quarter {activeQuarter}
                                    </h4>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        Attendance records per subject across dates.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400" aria-hidden="true">
                                        <FiCalendar />
                                    </span>
                                    <p className="mt-3 text-sm font-bold text-neutral-800">
                                        {attendanceSubjectFilter || attendanceDateFrom || attendanceDateTo
                                            ? "No attendance records match your filter"
                                            : "No attendance recorded yet"}
                                    </p>
                                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                        {attendanceSubjectFilter || attendanceDateFrom || attendanceDateTo
                                            ? "Try adjusting your filters or clearing the date range."
                                            : `Your faculties have not recorded attendance for Quarter ${activeQuarter}.`}
                                    </p>
                                </div>
                            </section>
                        ) : (
                            <section className="student-classes__matrix-card" aria-label="Attendance Matrix">
                                {/* Mobile-only Subject Column Toggle Toolbar */}
                                <div className="flex md:hidden items-center justify-between px-3.5 py-2.5 bg-neutral-50 border-b border-neutral-200">
                                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                                        <span className="font-semibold text-neutral-800">Subject Column:</span>
                                        <span className={isAttendanceSubjectCollapsed ? "text-amber-700 font-bold" : "text-[#176B3A] font-bold"}>
                                            {isAttendanceSubjectCollapsed ? "Collapsed" : "Expanded"}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAttendanceSubjectCollapsed((prev) => !prev)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-neutral-300 bg-white text-neutral-800 shadow-xs hover:bg-neutral-100 active:scale-95 transition cursor-pointer"
                                        aria-label={isAttendanceSubjectCollapsed ? "Expand Subject Column" : "Collapse Subject Column"}
                                    >
                                        {isAttendanceSubjectCollapsed ? (
                                            <>
                                                <span>Expand</span>
                                                <FiChevronRight className="h-3.5 w-3.5 text-neutral-500" />
                                            </>
                                        ) : (
                                            <>
                                                <FiChevronLeft className="h-3.5 w-3.5 text-neutral-500" />
                                                <span>Collapse</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="student-classes__matrix-table-wrap">
                                    <table className="student-classes__matrix-table">
                                        <thead>
                                            {/* Row 1: Date headers */}
                                            <tr>
                                                <th
                                                    scope="col"
                                                    className={`student-classes__matrix-subject-th student-classes__sticky-col student-classes__sticky-date-blank ${isAttendanceSubjectCollapsed ? "student-classes__matrix-subject-th--collapsed" : ""
                                                        }`}
                                                ></th>
                                                {sortedAttendanceDates.map((dateStr) => {
                                                    const { monthDay, dayOfWeek } = formatDateHeader(dateStr);
                                                    return (
                                                        <th
                                                            key={dateStr}
                                                            scope="col"
                                                            className="student-classes__matrix-date-th"
                                                        >
                                                            <div className="flex flex-col items-center justify-center leading-tight">
                                                                <span className="text-[0.6875rem] font-bold text-neutral-600 tracking-wider">
                                                                    {monthDay}
                                                                </span>
                                                                {dayOfWeek && (
                                                                    <span className="text-[0.625rem] font-semibold text-neutral-400 mt-0.5">
                                                                        {dayOfWeek}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                                <th scope="col" className="student-classes__matrix-grade-col student-classes__matrix-date-th"></th>
                                                <th scope="col" className="student-classes__matrix-grade-col student-classes__matrix-date-th"></th>
                                                <th scope="col" className="student-classes__matrix-grade-col student-classes__matrix-date-th"></th>
                                            </tr>

                                            {/* Row 2: Badges & column titles */}
                                            <tr>
                                                <th
                                                    scope="col"
                                                    className={`student-classes__matrix-subject-th student-classes__sticky-col text-xs font-bold uppercase tracking-wider text-neutral-500 ${isAttendanceSubjectCollapsed ? "student-classes__matrix-subject-th--collapsed text-center" : "text-left"
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="truncate">
                                                            {isAttendanceSubjectCollapsed ? (
                                                                <>
                                                                    <span className="md:hidden inline text-[0.6875rem]">SUBJ</span>
                                                                    <span className="hidden md:inline">SUBJECT</span>
                                                                </>
                                                            ) : (
                                                                "SUBJECT"
                                                            )}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsAttendanceSubjectCollapsed((prev) => !prev)}
                                                            className="md:hidden inline-flex items-center justify-center p-1 rounded-md bg-neutral-200/70 hover:bg-neutral-200 text-neutral-700 transition active:scale-95 cursor-pointer shrink-0"
                                                            title={isAttendanceSubjectCollapsed ? "Expand Subject Column" : "Collapse Subject Column"}
                                                            aria-label={isAttendanceSubjectCollapsed ? "Expand Subject Column" : "Collapse Subject Column"}
                                                        >
                                                            {isAttendanceSubjectCollapsed ? (
                                                                <FiChevronRight className="h-3 w-3" />
                                                            ) : (
                                                                <FiChevronLeft className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </th>
                                                {sortedAttendanceDates.map((dateStr) => (
                                                    <th
                                                        key={dateStr}
                                                        scope="col"
                                                        className="student-classes__matrix-act-col bg-[#f8fafc]"
                                                        title={`Attendance on ${dateStr}`}
                                                    >
                                                        <span className="student-classes__badge-att">ATT</span>
                                                    </th>
                                                ))}
                                                <th scope="col" className="student-classes__matrix-grade-col bg-[#f0fdf4] text-[#176B3A] font-extrabold text-xs tracking-wider">
                                                    PRESENT
                                                </th>
                                                <th scope="col" className="student-classes__matrix-grade-col bg-[#fef2f2] text-[#991b1b] font-extrabold text-xs tracking-wider">
                                                    ABSENT
                                                </th>
                                                <th scope="col" className="student-classes__matrix-grade-col bg-[#f0fdf4] text-[#176B3A] font-extrabold text-xs tracking-wider">
                                                    RATE
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAttendanceSubjects.map((subject) => {
                                                const qAtt = subject.attendance.find((a) => a.quarter === activeQuarter);

                                                const applicableRecords = isDateFiltered
                                                    ? (qAtt?.records ?? []).filter((r) => {
                                                        const ymd = normalizeToYMD(r.date);
                                                        if (!ymd) return false;
                                                        if (attendanceDateFrom && ymd < attendanceDateFrom) return false;
                                                        if (attendanceDateTo && ymd > attendanceDateTo) return false;
                                                        return true;
                                                    })
                                                    : null;

                                                const totalCount =
                                                    applicableRecords !== null ? applicableRecords.length : (qAtt?.totalDays ?? 0);
                                                const presentCount =
                                                    applicableRecords !== null
                                                        ? applicableRecords.filter((r) => r.status === "present").length
                                                        : (qAtt?.presentDays ?? 0);
                                                const percentage =
                                                    applicableRecords !== null
                                                        ? (totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null)
                                                        : (qAtt?.percentage ?? null);
                                                const absentCount = totalCount - presentCount;

                                                return (
                                                    <tr key={subject.classSubjectId ?? subject.name} className="transition-colors">
                                                        <td
                                                            className={`student-classes__matrix-subject-td student-classes__sticky-col ${isAttendanceSubjectCollapsed ? "student-classes__matrix-subject-td--collapsed" : ""
                                                                }`}
                                                        >
                                                            {/* Mobile view when collapsed */}
                                                            <div className={`${isAttendanceSubjectCollapsed ? "block md:hidden" : "hidden"} text-center`}>
                                                                <span
                                                                    className="inline-block px-1.5 py-0.5 rounded font-bold text-[0.6875rem] bg-emerald-50 text-[#176B3A] border border-emerald-200 tracking-tight leading-tight"
                                                                    title={`${subject.name}${subject.faculty ? ` • ${subject.faculty}` : ""}`}
                                                                >
                                                                    {subject.code || subject.name.slice(0, 4).toUpperCase()}
                                                                </span>
                                                            </div>

                                                            {/* Standard view on desktop, or mobile when expanded */}
                                                            <div className={isAttendanceSubjectCollapsed ? "hidden md:block" : "block"}>
                                                                <p className="font-bold text-neutral-900 text-sm leading-snug">
                                                                    {subject.name}
                                                                </p>
                                                                <p className="text-xs text-neutral-500 mt-0.5 font-normal">
                                                                    {subject.faculty ?? "—"}
                                                                </p>
                                                            </div>
                                                        </td>

                                                        {sortedAttendanceDates.map((dateStr) => {
                                                            const rec = qAtt?.records?.find((r) => normalizeToYMD(r.date) === dateStr);
                                                            const status = rec?.status?.toLowerCase().trim();

                                                            if (!rec || !status) {
                                                                return (
                                                                    <td key={dateStr} className="student-classes__matrix-act-col text-neutral-400 text-center">
                                                                        —
                                                                    </td>
                                                                );
                                                            }

                                                            if (status === "present") {
                                                                return (
                                                                    <td key={dateStr} className="student-classes__matrix-act-col text-center">
                                                                        <span
                                                                            className="inline-flex items-center gap-1 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full capitalize bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                            title={`${subject.name} • ${dateStr} • Present`}
                                                                        >
                                                                            <FiCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                                        </span>
                                                                    </td>
                                                                );
                                                            }

                                                            if (status === "absent") {
                                                                return (
                                                                    <td key={dateStr} className="student-classes__matrix-act-col text-center">
                                                                        <span
                                                                            className="inline-flex items-center gap-1 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full capitalize bg-rose-50 text-rose-700 border border-rose-200"
                                                                            title={`${subject.name} • ${dateStr} • Absent`}
                                                                        >
                                                                            <FiX className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                                        </span>
                                                                    </td>
                                                                );
                                                            }

                                                            if (status === "late") {
                                                                return (
                                                                    <td key={dateStr} className="student-classes__matrix-act-col text-center">
                                                                        <span
                                                                            className="inline-flex items-center gap-1 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full capitalize bg-amber-50 text-amber-700 border border-amber-200"
                                                                            title={`${subject.name} • ${dateStr} • Late`}
                                                                        >
                                                                            <FiAlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                                            Late
                                                                        </span>
                                                                    </td>
                                                                );
                                                            }

                                                            return (
                                                                <td key={dateStr} className="student-classes__matrix-act-col text-neutral-400 text-center">
                                                                    —
                                                                </td>
                                                            );
                                                        })}

                                                        {/* Summary Columns */}
                                                        <td className="student-classes__matrix-grade-col text-center text-xs font-semibold text-neutral-800">
                                                            {totalCount === 0 ? (
                                                                <span className="text-neutral-400 font-normal">—</span>
                                                            ) : (
                                                                <span>
                                                                    {presentCount} <span className="text-neutral-400 font-normal">/ {totalCount}</span>
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="student-classes__matrix-grade-col text-center text-xs font-semibold text-neutral-800">
                                                            {totalCount === 0 ? (
                                                                <span className="text-neutral-400 font-normal">—</span>
                                                            ) : (
                                                                <span className={absentCount > 0 ? "text-rose-600 font-bold" : "text-neutral-700"}>
                                                                    {absentCount}
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="student-classes__matrix-grade-col text-center">
                                                            <span
                                                                className={`inline-flex min-w-[3.5rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${percentage === null
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
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer / Legend */}
                                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-neutral-200 bg-neutral-50/70 text-[0.75rem] text-neutral-500">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="font-semibold text-neutral-600">Legend:</span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="student-classes__badge-att">ATT</span> Attendance
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <FiCheck className="h-3 w-3" /> Present
                                            </span>
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                                <FiAlertTriangle className="h-3 w-3" /> Absent
                                            </span>
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 text-neutral-400 font-medium">
                                            — Unrecorded
                                        </span>
                                        <span className="text-neutral-300">|</span>
                                        <span className="font-semibold text-neutral-600">Rate Indicator:</span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> 90%+ Excellent
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span> 75%–89% Warning
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span> Below 75% Critical
                                        </span>
                                    </div>
                                    <span className="text-[0.6875rem] text-neutral-400 italic">
                                        Tip: Scroll horizontally to view all attendance dates and summaries.
                                    </span>
                                </div>
                            </section>
                        )}
                    </div>
                );
            })()}

            {/* Footer note */}
            <p className="flex items-center gap-2 text-[0.8125rem] text-neutral-500">
                <FiCalendar className="shrink-0" aria-hidden="true" />
                Scores and attendance shown are the records entered by your faculties.
            </p>
        </PageShell>
    );
}
