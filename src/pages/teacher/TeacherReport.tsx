import { useCallback, useEffect, useState } from "react";
import { FiDownload, FiFileText, FiUsers } from "react-icons/fi";

import { getAPICall } from "../../api/api";
import Skeleton from "../../components/Skeleton";
import { useUser } from "../../hooks/useUser";
import { getInitials } from "../../helper/initials";

import type { ClassroomResponseProps } from "../../constant/classrooms";

import "../../style/teacherClasses.css";

interface AdvisedClassData {
    classroom: ClassroomResponseProps | null;
    teachersWithSubjects: { classSubjectId: number; subjectName: string }[];
}

interface Student {
    enrollmentId: number;
    studentId: number;
    studentLrn: string;
    fullname: string;
    studentSex: string;
    studentAge: number;
}

interface ClassroomWithStudents extends ClassroomResponseProps {
    students: Student[];
}

type Quarter = 1 | 2 | 3 | 4;

const QUARTER_LABELS: Record<Quarter, string> = {
    1: "1st Quarter",
    2: "2nd Quarter",
    3: "3rd Quarter",
    4: "4th Quarter",
};

export default function TeacherReport() {
    const { user, loading: userLoading } = useUser();

    const [adviserClass, setAdviserClass] = useState<AdvisedClassData | null>(null);
    const [roster, setRoster] = useState<ClassroomWithStudents | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingRoster, setLoadingRoster] = useState(false);

    const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(1);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    useEffect(() => {
        if (userLoading) return;
        let cancelled = false;

        async function load() {
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

        load();
        return () => { cancelled = true; };
    }, [user, userLoading]);

    const handleDownload = useCallback((enrollmentId: number) => {
        setDownloadingId(enrollmentId);
        const baseURL = import.meta.env.VITE_LOCAL_SERVER as string;
        window.open(`${baseURL}/student/${enrollmentId}/report-card`, "_blank");
        setTimeout(() => setDownloadingId(null), 1500);
    }, []);



    // Loading
    if (userLoading || loading) {
        return (
            <section className="teacher-classes flex flex-col gap-5" aria-busy="true">
                <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="teacher-classes__card-head p-5">
                        <h3 className="teacher-classes__card-title text-base font-bold">Student Reports</h3>
                        <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">Loading…</p>
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
                    <div className="teacher-classes__card-head p-5">
                        <h3 className="teacher-classes__card-title text-base font-bold">Student Reports</h3>
                        <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">
                            You are not assigned as a class adviser
                        </p>
                    </div>
                    <div className="teacher-classes__empty flex flex-col items-center justify-center px-6 py-14 text-center">
                        <span className="teacher-classes__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiFileText />
                        </span>
                        <p className="teacher-classes__empty-title mt-3 text-sm font-bold">No access</p>
                        <p className="teacher-classes__empty-text mt-1 text-[0.8125rem]">
                            Only class advisers can generate student report cards.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    const { classroom } = adviserClass;
    const students = roster?.students ?? [];

    return (
        <section className="teacher-classes flex flex-col gap-5">
            {/* Hero banner */}
            <div className="teacher-classes__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="teacher-classes__hero-main flex min-w-0 items-center gap-4">
                    <span className="teacher-classes__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold" aria-hidden="true">
                        <FiFileText />
                    </span>
                    <div className="teacher-classes__hero-heading min-w-0">
                        <span className="teacher-classes__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Report Cards
                        </span>
                        <h2 className="teacher-classes__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            Grade {classroom.gradeLevel} — {classroom.section}
                        </h2>
                        <p className="teacher-classes__hero-role mt-0.5 truncate text-[0.8125rem]">
                            DepEd Form 138 — Report Card
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

            {/* Quarter selector + Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-[0.8125rem] font-bold text-gray-700">Quarter:</span>
                    <div className="flex gap-1.5">
                        {([1, 2, 3, 4] as Quarter[]).map((q) => (
                            <button
                                key={q}
                                type="button"
                                className={`inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-[0.8125rem] font-bold transition-colors ${
                                    selectedQuarter === q
                                        ? "bg-blue-500 text-white shadow-sm"
                                        : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                }`}
                                onClick={() => setSelectedQuarter(q)}
                            >
                                Q{q}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[0.8125rem] text-gray-500">
                        <span className="font-bold text-gray-700">{QUARTER_LABELS[selectedQuarter]}</span>
                    </span>
                </div>
            </div>

            {/* Student list */}
            <div className="teacher-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="teacher-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="teacher-classes__card-heading min-w-0">
                        <h3 className="teacher-classes__card-title text-base font-bold">Student Report Cards</h3>
                        <p className="teacher-classes__card-subtitle mt-1 text-[0.8125rem]">
                            Click &quot;Download&quot; to generate a PDF report card for each student
                        </p>
                    </div>
                    {!loadingRoster && students.length > 0 && (
                        <span className="teacher-classes__count inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            <FiUsers aria-hidden="true" />
                            {students.length} {students.length === 1 ? "student" : "students"}
                        </span>
                    )}
                </div>

                <div className="teacher-classes__roster-table-wrap overflow-x-auto rounded-xl border">
                    {loadingRoster ? (
                        <div className="p-5">
                            <Skeleton count={5} lines={1} height="3.5rem" gap="0.75rem" />
                        </div>
                    ) : students.length > 0 ? (
                        <table className="teacher-classes__roster-table w-full min-w-[40rem] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">#</th>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">LRN</th>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Student Name</th>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Sex</th>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Age</th>
                                    <th className="px-4 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, index) => (
                                    <tr key={student.enrollmentId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3.5 text-gray-500">{index + 1}</td>
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
                                                <span className="text-[0.8125rem] font-bold">{student.fullname}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className={`teacher-classes__sex inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold capitalize teacher-classes__sex--${student.studentSex.toLowerCase()}`}>
                                                {student.studentSex}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">{student.studentAge}</td>
                                        <td className="px-4 py-3.5 text-right">
                                            <button
                                                type="button"
                                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[0.75rem] font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                onClick={() => handleDownload(student.enrollmentId)}
                                                disabled={downloadingId === student.enrollmentId}
                                            >
                                                <FiDownload aria-hidden="true" />
                                                {downloadingId === student.enrollmentId ? "Generating…" : "Download"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="teacher-classes__roster-empty flex flex-col items-center justify-center px-6 py-14 text-center">
                            <span className="teacher-classes__roster-empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                <FiUsers />
                            </span>
                            <p className="teacher-classes__roster-empty-title mt-3 text-sm font-bold">No students enrolled</p>
                            <p className="teacher-classes__roster-empty-text mt-1 text-[0.8125rem]">
                                Report cards will appear here once students are enrolled.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
