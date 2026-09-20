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
import Skeleton from "../../components/Skeleton";
import { getInitials } from "../../helper/initials";
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
                setYears([...(response.data?.classes ?? [])].reverse());
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
        (year) => year.generalAverage !== null && year.generalAverage >= 75,
    ).length;

    // ==================== Loading state ====================
    if (loading) {
        return (
            <section className="student-prospectus__page flex flex-col gap-5">
                <div className="student-prospectus__hero flex items-center gap-4 p-6">
                    <Skeleton avatar avatarSize={56} lines={0} className="flex-1" />
                </div>
                <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <Skeleton lines={4} gap="1rem" />
                </div>
            </section>
        );
    }

    // ==================== Empty state ====================
    if (!student || years.length === 0) {
        return (
            <section className="student-prospectus__page flex flex-col gap-5">
                <div className="student-prospectus__hero flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="flex min-w-0 items-center gap-4">
                        <span
                            className="student-prospectus__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                            aria-hidden="true"
                        >
                            {getInitials(student?.fullname ?? "?")}
                        </span>
                        <div className="min-w-0">
                            <span className="student-prospectus__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                Academic Prospectus
                            </span>
                            <h2 className="student-prospectus__hero-name mt-1 truncate text-[1.375rem] font-bold">
                                {student?.fullname ?? "Student"}
                            </h2>
                            <p className="student-prospectus__hero-role mt-0.5 truncate text-[0.8125rem]">
                                {student ? `LRN ${student.lrn} &middot; ${student.email}` : ""}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <p className="mt-3 text-sm font-bold text-neutral-800">No academic records yet</p>
                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                        Your report card records will appear here once you have been enrolled.
                    </p>
                </div>
            </section>
        );
    }

    // ==================== Academic history ====================
    return (
        <section className="student-prospectus__page flex flex-col gap-5">
            {/* ==================== Hero banner ==================== */}
            <div className="student-prospectus__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex min-w-0 items-center gap-4">
                    <span
                        className="student-prospectus__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                        aria-hidden="true"
                    >
                        {getInitials(student.fullname)}
                    </span>
                    <div className="min-w-0">
                        <span className="student-prospectus__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Academic Prospectus
                        </span>
                        <h2 className="student-prospectus__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            {student.fullname}
                        </h2>
                        <p className="student-prospectus__hero-role mt-0.5 truncate text-[0.8125rem]">
                            LRN {student.lrn} &middot; {student.email}
                        </p>
                    </div>
                </div>
                <div className="student-prospectus__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="student-prospectus__hero-badge-count text-[1.375rem] font-bold leading-none">
                        {years.length}
                    </span>
                    <span className="student-prospectus__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        School Years
                    </span>
                </div>
            </div>

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
                    const promoted = graded && year.generalAverage! >= 75;

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
                            <div className="overflow-x-auto">
                                <table className="student-prospectus__table text-sm">
                                    <thead>
                                        <tr>
                                            <th className="px-5 py-3 text-left font-bold">Subject</th>
                                            {quarters.map((quarter) => (
                                                <th key={quarter} className="px-3 py-3 text-center font-bold">Q{quarter}</th>
                                            ))}
                                            <th className="px-3 py-3 text-center font-bold">Final</th>
                                            <th className="px-5 py-3 text-center font-bold">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {year.subjects.map((subject) => (
                                            <tr key={subject.classSubjectId ?? subject.name}>
                                                <td className="px-5 py-3 font-semibold">
                                                    {subject.name}
                                                    <span className="ml-1.5 text-xs font-normal text-neutral-400">
                                                        {subject.code}
                                                    </span>
                                                </td>
                                                {quarters.map((_quarter, index) => (
                                                    <td key={index} className="px-3 py-3 text-center font-semibold">
                                                        {subject.quarters[index] ?? "—"}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-3 text-center font-bold">
                                                    {subject.final ?? "—"}
                                                </td>
                                                <td className="px-5 py-3 text-center">
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
                                        <tr className="student-prospectus__grade-general">
                                            <td className="px-5 py-3" colSpan={quarters.length + 1}>
                                                General Average
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {graded ? year.generalAverage : "—"}
                                            </td>
                                            <td className="px-5 py-3 text-center">
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
        </section>
    );
}
