import { FiBookOpen, FiCheckCircle, FiCalendar, FiX } from "react-icons/fi";
import { useState, useEffect, useId } from "react";

import { ModalDialog } from "../../components/ModalDialog";
import { getAPICall } from "../../api/api";

interface PastGradesModalProps {
    studentId: number;
    studentName: string;
    open: boolean;
    onClose: () => void;
}

export default function StudentPastGradesModal({
    studentId,
    studentName,
    open,
    onClose,
}: PastGradesModalProps) {
    const titleId = useId();
    const descId = useId();
    const [data, setData] = useState<PastGradesView | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        getAPICall<PastGradesView>(`/students/${studentId}/past-submitted-grades`, { toast: false })
            .then((response) => {
                if (!cancelled) {
                    if (response.data) {
                        setData(response.data);
                        setError(null);
                    } else {
                        // Keep the modal usable even when there is no cached data yet.
                        setData(null);
                    }
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setError("Couldn't load the student's past grades.");
                    setData(null);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open, studentId]);

    return (
        <ModalDialog
            open={open}
            onClose={onClose}
            labelledById={titleId}
        describedById={descId}
        >
            <div className="flex flex-col gap-5" role="document">
                <button
                    type="button"
                    className="self-end"
                    onClick={onClose}
                    aria-label="Close past grades dialog"
                >
                    <FiX aria-hidden="true" />
                </button>

                <h2 id={titleId} className="flex items-center gap-2 text-base font-bold">
                    <FiBookOpen aria-hidden="true" />
                    Past Submitted Grades
                </h2>
                <p id={descId} className="text-sm text-neutral-600">
                    {studentName ? `Previously submitted school-year grades for ${studentName}.` : undefined}
                </p>

                {loading && (
                    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-600">
                        <FiCalendar className="animate-spin shrink-0" aria-hidden="true" />
                        Loading past grades…
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <span className="mt-0.5 shrink-0">{error}</span>
                    </div>
                )}

                {data && data.classes.length === 0 && !loading && (
                    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-600">
                        <FiBookOpen className="shrink-0" aria-hidden="true" />
                        No submitted past grades found for this student.
                    </div>
                )}

                {data && data.classes.length > 0 && (
                    <ul className="flex flex-col gap-4">
                        {data.classes.map((cls) => (
                            <li key={cls.enrollmentId} className="flex flex-col gap-3">
                                <article className="rounded-xl border border-neutral-200 bg-white p-4">
                                    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="shrink-0 rounded-lg bg-neutral-100 p-2 text-base" aria-hidden="true">
                                                <FiBookOpen />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm">
                                                    Grade {cls.gradeLevel} — {cls.section}
                                                </p>
                                                <p className="text-xs text-neutral-600">
                                                    {cls.schoolYear}
                                                    {cls.adviser ? ` · Adviser: ${cls.adviser}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        {cls.generalAverage !== null && (
                                            <div className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1 text-center text-xs font-semibold tabular-nums">
                                                Gen. Avg: {cls.generalAverage.toFixed(2)}
                                            </div>
                                        )}
                                    </header>

                                    <table className="mt-3 w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-neutral-200">
                                                <th className="px-2 py-2 font-semibold uppercase text-[0.625rem] tracking-wide">Subject</th>
                                                <th className="px-2 py-2 font-semibold uppercase text-[0.625rem] tracking-wide">Code</th>
                                                <th className="px-2 py-2 font-semibold uppercase text-[0.625rem] tracking-wide">Q1</th>
                                                <th className="px-2 py-2 font-semibold uppercase text-[0.625rem] tracking-wide">Q2</th>
                                                <th className="px-2 py-2 font-semibold uppercase text-[0.625rem] tracking-wide">Q3</th>
                                                <th className="px-2 py-2 font-semibold uppercase text-[0.625rem] tracking-wide">Q4</th>
                                                <th className="px-2 py-2 font-semibold uppercase text-[0.625rem] tracking-wide">Final</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cls.subjects.map((subject) => {
                                                const final = subject.final;
                                                const isPassed = typeof final === "number" && final >= 75;
                                                const isFailed = typeof final === "number" && final < 75;

                                                return (
                                                    <tr key={subject.code} className="border-b border-neutral-100 last:border-0">
                                                        <td className="px-2 py-2 font-medium">{subject.name}</td>
                                                        <td className="px-2 py-2 text-neutral-600">{subject.code}</td>
                                                        {subject.quarters.map((q, idx) => (
                                                            <td
                                                                key={idx}
                                                                className="px-2 py-2 text-center tabular-nums"
                                                            >
                                                                {q === null ? "—" : q.toFixed(2)}
                                                            </td>
                                                        ))}
                                                        <td className="px-2 py-2">
                                                            {final === null ? (
                                                                <span className="text-neutral-400">—</span>
                                                            ) : (
                                                                <span
                                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums ${
                                                                        isPassed
                                                                            ? "bg-green-100 text-green-800"
                                                                            : isFailed
                                                                                ? "bg-red-100 text-red-800"
                                                                                : "bg-neutral-100 text-neutral-800"
                                                                    }`}
                                                                >
                                                                    {typeof final === "number" ? (
                                                                        <>
                                                                            {final.toFixed(2)}
                                                                            {isPassed ? <FiCheckCircle aria-hidden="true" /> : isFailed ? <FiX aria-hidden="true" /> : null}
                                                                        </>
                                                                    ) : (
                                                                        final
                                                                    )}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </article>
                            </li>
                        ))}
                    </ul>
                )}

                {!loading && data && data.classes.length > 0 && (
                    <p className="text-[0.6875rem] text-neutral-500">
                        Showing only school years with submitted/frozen grades.
                    </p>
                )}
            </div>
        </ModalDialog>
    );
}

// Compact API view used by this modal. Kept separate from the broader
// StudentClassesData type because the enrollment screen only needs the
// submitted/frozen snapshot, not the full live gradebook payload.
export interface PastGradesView {
    student: {
        id: number;
        lrn: string;
        email: string;
        fullname: string;
    };
    classes: PastClass[];
}

export interface PastClass {
    enrollmentId: number;
    classId: number;
    section: string;
    gradeLevel: number;
    schoolYearId: number;
    schoolYear: string;
    adviser: string | null;
    subjects: PastSubject[];
    generalAverage: number | null;
}

export interface PastSubject {
    name: string;
    code: string;
    unit: number | null;
    quarters: (number | null)[];
    final: number | null;
    remarks: string | null;
}
