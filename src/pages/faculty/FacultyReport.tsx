import { useCallback, useEffect, useState } from "react";
import { FiExternalLink, FiFileText, FiUsers } from "react-icons/fi";

import { getAPICall, API } from "../../api/api";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
import { useUser } from "../../hooks/useUser";

import type { ClassroomResponseProps } from "../../constant/classrooms";

import "../../style/facultyClasses.css";

interface AdvisedClassData {
    classroom: ClassroomResponseProps | null;
    facultiesWithSubjects: { classSubjectId: number; subjectName: string }[];
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

export default function FacultyReport() {
    const { user, loading: userLoading } = useUser();


    const [adviserClass, setAdviserClass] = useState<AdvisedClassData | null>(null);
    const [roster, setRoster] = useState<ClassroomWithStudents | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingRoster, setLoadingRoster] = useState(false);

    const [openingId, setOpeningId] = useState<number | null>(null);

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

    const handleOpen = useCallback((enrollmentId: number) => {
        setOpeningId(enrollmentId);
        const baseURL = API.defaults.baseURL as string;
        window.open(`${baseURL}/student/${enrollmentId}/report-card`, "_blank");
        setTimeout(() => setOpeningId(null), 1500);
    }, []);



    // Loading
    if (userLoading || loading) {
        return (
            <PageShell className="faculty-classes" busy>
                <PageSection className="faculty-classes__card" title="Student Reports" description="Loading…" flush>
                    <div className="p-6">
                        <Skeleton count={2} lines={1} height="10rem" radius="0.75rem" grid="repeat(2, 1fr)" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    // Not an adviser
    if (!adviserClass || !adviserClass.classroom) {
        return (
            <PageShell className="faculty-classes">
                <PageSection
                    className="faculty-classes__card"
                    title="Student Reports"
                    description="You are not assigned as a class adviser"
                >
                    <div className="faculty-classes__empty flex flex-col items-center justify-center py-10 text-center">
                        <span className="faculty-classes__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiFileText />
                        </span>
                        <p className="faculty-classes__empty-title mt-3 text-sm font-bold">No access</p>
                        <p className="faculty-classes__empty-text mt-1 text-[0.8125rem]">
                            Only class advisers can generate student report cards.
                        </p>
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    const { classroom } = adviserClass;
    const students = roster?.students ?? [];

    return (
        <PageShell className="faculty-classes faculty-report">
            {/* Header */}
            <PageHeader
                title={`Grade ${classroom.gradeLevel} — ${classroom.section}`}
                description="DepEd Form 138 — Report Card"
                meta={`${students.length} students`}
            />

            {/* Student list */}
            <div className="faculty-classes__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="faculty-classes__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="faculty-classes__card-heading flex min-w-0 items-start gap-3">
                        <span className="faculty-report__head-icon" aria-hidden="true">
                            <FiFileText />
                        </span>
                        <div className="min-w-0">
                            <h3 className="faculty-classes__card-title text-base font-bold">Student Report Cards</h3>
                            <p className="faculty-classes__card-subtitle mt-1 text-[0.8125rem]">
                                Click &quot;Open PDF&quot; to view the report card for each student
                            </p>
                        </div>
                    </div>
                    {!loadingRoster && students.length > 0 && (
                        <span className="faculty-classes__count inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            <FiUsers aria-hidden="true" />
                            {students.length} {students.length === 1 ? "student" : "students"}
                        </span>
                    )}
                </div>

                <div className="data-table__wrap faculty-report__table">
                    {loadingRoster ? (
                        <div className="p-5">
                            <Skeleton count={5} lines={1} height="3.5rem" gap="0.75rem" />
                        </div>
                    ) : students.length > 0 ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col" className="data-table__th data-table__th--num w-12">#</th>
                                    <th scope="col" className="data-table__th w-36">LRN</th>
                                    <th scope="col" className="data-table__th w-56">Student Name</th>
                                    <th scope="col" className="data-table__th data-table__th--center w-16">Sex</th>
                                    <th scope="col" className="data-table__th data-table__th--center w-16">Age</th>
                                    <th scope="col" className="data-table__th data-table__th--actions w-36">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, index) => (
                                    <tr key={student.enrollmentId} className="data-table__row">
                                        <td className="data-table__td data-table__td--num data-table__td--muted">{index + 1}</td>
                                        <td className="data-table__td data-table__td--mono">
                                            {student.studentLrn}
                                        </td>
                                        <td className="data-table__td">
                                            <div className="faculty-report__student">
                                                <span className="faculty-report__student-name">{student.fullname}</span>
                                            </div>
                                        </td>
                                        <td className="data-table__td data-table__td--center">
                                            <span className={`faculty-classes__sex inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold capitalize faculty-classes__sex--${student.studentSex.toLowerCase()}`}>
                                                {student.studentSex}
                                            </span>
                                        </td>
                                        <td className="data-table__td data-table__td--center">{student.studentAge}</td>
                                        <td className="data-table__td data-table__td--actions">
                                            <button
                                                type="button"
                                                className="faculty-report__open"
                                                onClick={() => handleOpen(student.enrollmentId)}
                                                disabled={openingId === student.enrollmentId}
                                                aria-label={`Open report card PDF for ${student.fullname}`}
                                            >
                                                <FiExternalLink aria-hidden="true" />
                                                {openingId === student.enrollmentId ? "Opening…" : "Open PDF"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="faculty-classes__roster-empty flex flex-col items-center justify-center px-6 py-14 text-center">
                            <span className="faculty-classes__roster-empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                <FiUsers />
                            </span>
                            <p className="faculty-classes__roster-empty-title mt-3 text-sm font-bold">No students enrolled</p>
                            <p className="faculty-classes__roster-empty-text mt-1 text-[0.8125rem]">
                                Report cards will appear here once students are enrolled.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}
