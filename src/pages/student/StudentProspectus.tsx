import { useEffect, useState } from "react";
import {
    FiAward,
    FiBookOpen,
    FiCalendar,
    FiCheck,
    FiHome,
    FiUsers,
} from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
import { isPassing } from "../../helper/grades";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";

import type { StudentClass, StudentClassesData, SubjectGrade } from "../../constant/studentClasses";

import "../../style/studentProspectus.css";

// ==================== Helpers ====================
// Attendance is per subject in this system, so the year-level summary aggregates
// every recorded subject-day across the year's subjects.
function aggregateAttendance(subjects: SubjectGrade[]) {
    let present = 0;
    let total = 0;
    for (const subject of subjects) {
        for (const quarter of subject.attendance) {
            present += quarter.presentDays;
            total += quarter.totalDays;
        }
    }
    return {
        present,
        total,
        percentage: total > 0 ? Math.round((present / total) * 100) : null,
    };
}

export default function StudentProspectus() {
    const { quarters } = useAcademicSettings();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<StudentClassesData["student"] | null>(null);
    const [years, setYears] = useState<StudentClass[]>([]);

    useEffect(() => {
        let cancelled = false;
        async function loadHistory() {
            try {
                const response = await getAPICall<StudentClassesData>("/students/prospectus", { toast: false });
                if (cancelled) return;
                setStudent(response.data?.student ?? null);
                // Server returns newest first; show the permanent record chronologically.
                // Only completed school years (with a computed general average) are displayed in prospectus.
                const completedYears = (response.data?.classes ?? []).filter(
                    (cls) => cls.generalAverage !== null
                );
                setYears([...completedYears].reverse());
            } catch {
                // Error toast is handled by the axios interceptor in api.ts
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadHistory();
        return () => {
            cancelled = true;
        };
    }, []);

    const totalSubjects = years.reduce((sum, year) => sum + year.subjects.length, 0);
    const promotedYears = years.filter(
        (year) => year.generalAverage !== null && isPassing(year.generalAverage),
    ).length;

    // ==================== Loading state ====================
    if (loading) {
        return (
            <PageShell className="student-prospectus">
                <div className="student-prospectus__hero flex items-center gap-4 p-6">
                    <Skeleton avatar avatarSize={56} lines={0} className="flex-1" />
                </div>
                <PageSection flush>
                    <div className="p-6">
                        <Skeleton lines={4} gap="1rem" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    // ==================== Empty state ====================
    if (!student || years.length === 0) {
        return (
            <PageShell className="student-prospectus">
                <PageHeader
                    title={student?.fullname ?? "Student"}
                    description={student ? `LRN ${student.lrn} · ${student.email}` : "Academic Prospectus"}
                />
                <PageSection>
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
                            <FiBookOpen />
                        </span>
                        <p className="mt-3 text-sm font-bold text-neutral-800">No completed academic records yet</p>
                        <p className="mt-1 text-[0.8125rem] text-neutral-500">
                            Your permanent academic records will appear here once you have completed a school year. Current in-progress classes can be viewed in My Classroom.
                        </p>
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    // ==================== Academic history ====================
    return (
        <PageShell className="student-prospectus">
            {/* ==================== Header ==================== */}
            <PageHeader
                title={student.fullname}
                description={`LRN ${student.lrn} · ${student.email}`}
                meta={`${years.length} school ${years.length === 1 ? "year" : "years"}`}
            />

            {/* ==================== Quick stats ==================== */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="student-prospectus__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-prospectus__stat-icon student-prospectus__stat-icon--green inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiCalendar />
                    </span>
                    <div className="min-w-0">
                        <span className="student-prospectus__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            School Years
                        </span>
                        <span className="student-prospectus__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {years.length}
                        </span>
                    </div>
                </div>

                <div className="student-prospectus__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-prospectus__stat-icon student-prospectus__stat-icon--blue inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="student-prospectus__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Subjects Taken
                        </span>
                        <span className="student-prospectus__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {totalSubjects}
                        </span>
                    </div>
                </div>

                <div className="student-prospectus__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-prospectus__stat-icon student-prospectus__stat-icon--amber inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiAward />
                    </span>
                    <div className="min-w-0">
                        <span className="student-prospectus__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Promoted
                        </span>
                        <span className="student-prospectus__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {promotedYears} / {years.length}
                        </span>
                    </div>
                </div>

                <div className="student-prospectus__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-prospectus__stat-icon student-prospectus__stat-icon--violet inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="student-prospectus__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Latest GWA
                        </span>
                        <span className="student-prospectus__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {years[years.length - 1]?.generalAverage ?? "—"}
                        </span>
                    </div>
                </div>
            </div>

            {/* ==================== Academic history by school year ==================== */}
            <div className="flex flex-col gap-5">
                <div className="min-w-0">
                    <h3 className="text-[0.9375rem] font-bold text-neutral-900">Academic History</h3>
                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                        Your report card records, one section per school year.
                    </p>
                </div>

                {years.map((year) => {
                    const attendance = aggregateAttendance(year.subjects);
                    const graded = year.generalAverage !== null;
                    const promoted = graded && isPassing(year.generalAverage);
                    const yearQuarterCount = year.numQuarters ?? (year.subjects[0]?.quarters.length || quarters.length);
                    const yearQuarters = Array.from({ length: yearQuarterCount }, (_, i) => i + 1);

                    return (
                        <article key={year.enrollmentId} className="student-prospectus__year-card overflow-hidden rounded-2xl">
                            {/* Year header */}
                            <div className="student-prospectus__year-head flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                                <div className="flex min-w-0 items-center gap-4">
                                    <span className="student-prospectus__year-badge inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold" aria-hidden="true">
                                        G{year.gradeLevel}
                                    </span>
                                    <div className="min-w-0">
                                        <h4 className="truncate text-[1.0625rem] font-bold text-neutral-900">
                                            SY {year.schoolYear} &middot; Grade {year.gradeLevel}
                                        </h4>
                                        <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                            {year.section} &middot; Adviser: {year.adviser ?? "—"}
                                        </p>
                                    </div>
                                </div>
                                {graded ? (
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                            promoted
                                                ? "student-prospectus__promoted"
                                                : "student-prospectus__retained"
                                        }`}
                                    >
                                        <FiCheck aria-hidden="true" />
                                        {promoted
                                            ? `Promoted to Grade ${year.gradeLevel + 1}`
                                            : "Retained"}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-500">
                                        In progress
                                    </span>
                                )}
                            </div>

                            {/* Grades table */}
                            <div className="data-table__wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="data-table__th w-56">Subject</th>
                                            {yearQuarters.map((quarter) => (
                                                <th key={quarter} scope="col" className="data-table__th data-table__th--center w-20">Q{quarter}</th>
                                            ))}
                                            <th scope="col" className="data-table__th data-table__th--center w-20">Final</th>
                                            <th scope="col" className="data-table__th data-table__th--center w-28">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {year.subjects.map((subject) => (
                                            <tr key={subject.classSubjectId ?? subject.name} className="data-table__row">
                                                <td className="data-table__td">
                                                    <span className="data-table__value">{subject.name}</span>
                                                    <span className="data-table__sub">{subject.code}</span>
                                                </td>
                                                {yearQuarters.map((_quarter, index) => (
                                                    <td key={index} className="data-table__td data-table__td--center">
                                                        {subject.quarters[index] ?? "—"}
                                                    </td>
                                                ))}
                                                <td className="data-table__td data-table__td--center data-table__td--primary">
                                                    {subject.final ?? "—"}
                                                </td>
                                                <td className="data-table__td data-table__td--center">
                                                    {subject.remarks ? (
                                                        <span
                                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                                                subject.remarks === "Passed"
                                                                    ? "student-prospectus__grade-passed"
                                                                    : "student-prospectus__grade-failed"
                                                            }`}
                                                        >
                                                            {subject.remarks}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-neutral-400">No grade</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="student-prospectus__grade-general data-table__row">
                                            <td className="data-table__td" colSpan={yearQuarters.length + 1}>
                                                General Average
                                            </td>
                                            <td className="data-table__td data-table__td--center data-table__td--primary">
                                                {graded ? year.generalAverage : "—"}
                                            </td>
                                            <td className="data-table__td data-table__td--center">
                                                {graded ? (
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                                            promoted
                                                                ? "student-prospectus__grade-passed"
                                                                : "student-prospectus__grade-failed"
                                                        }`}
                                                    >
                                                        {promoted ? "Passed" : "Failed"}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-neutral-400">In progress</span>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Attendance summary */}
                            <div className="student-prospectus__attendance flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                                <p className="flex items-center gap-2 text-[0.8125rem] text-neutral-600">
                                    <FiHome className="shrink-0" aria-hidden="true" />
                                    <span className="font-semibold text-neutral-800">Attendance</span>
                                    <span>
                                        {attendance.total === 0
                                            ? "No attendance recorded"
                                            : `${attendance.present} of ${attendance.total} days present across all subjects`}
                                    </span>
                                </p>
                                {attendance.percentage !== null && (
                                    <span className="student-prospectus__attendance-chip inline-flex rounded-full px-2.5 py-1 text-xs font-bold">
                                        {attendance.percentage}%
                                    </span>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>

            {/* ==================== Footer note ==================== */}
            <p className="flex items-center gap-2 text-[0.8125rem] text-neutral-500">
                <FiBookOpen className="shrink-0" aria-hidden="true" />
                Grades are computed from the recorded assessments. Official records (Form 137) are kept by the registrar.
            </p>
        </PageShell>
    );
}
