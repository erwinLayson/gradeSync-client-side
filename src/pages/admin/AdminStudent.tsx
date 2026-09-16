import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    FiAlertTriangle,
    FiArrowLeft,
    FiBookOpen,
    FiCalendar,
    FiEdit2,
    FiPlus,
    FiPrinter,
    FiSearch,
    FiTrash2,
    FiUser,
    FiUserPlus,
    FiX,
} from "react-icons/fi";

import useStudent from "../../hooks/useStudent";

import type { StudentResponseProps, NewStudentProps } from "../../constant/students.js";
import type { StudentClassesData } from "../../constant/studentClasses.js";

import "../../style/adminStudent.css";

// Components
import Table, { type TableColumns } from "../../components/Table.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { PageCard } from "../../components/PageCard.js";
import { EmptyState } from "../../components/EmptyState.js";
import { ModalDialog } from "../../components/ModalDialog.js";

// Helpers Functions
import { Validate } from "../../helper/validate.js";

// API Calls
import { API, deleteAPICall, getAPICall, patchAPICall, postAPICall } from "../../api/api.js";
import Skeleton from "../../components/Skeleton";

/*
    Table columns
*/

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const EMPTY_STUDENT: NewStudentProps = {
    lrn: "",
    email: "",
    firstname: "",
    middlename: "",
    lastname: "",
    suffix: "",
    birthdate: "",
    sex: ""
};

type ModalStatus = "create" | "edit" | null;

// Normalize a birthdate string into the yyyy-mm-dd format expected by <input type="date">.
function toDateInputValue(value: string | undefined): string {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

// First letter of the student's last name, used by the A–Z filter.
function getLastNameInitial(student: StudentResponseProps): string {
    const lastname = student.lastname?.trim() || (student.fullname.split(" ").pop() ?? "");
    return lastname.charAt(0).toUpperCase();
}

export default function AdminStudents() {
    const { students, loading, refetchStudents } = useStudent<StudentResponseProps[]>();

    /* =================== Create / Edit student modal =================== */
    const [modalStatus, setModalStatus] = useState<ModalStatus>(null);
    const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isLoadingEdit, setIsLoadingEdit] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const editTriggerRef = useRef<HTMLButtonElement | null>(null);
    const [newStudent, setNewStudent] = useState<NewStudentProps>(EMPTY_STUDENT);

    /* =================== Delete student confirmation =================== */
    const [deleteTarget, setDeleteTarget] = useState<StudentResponseProps | null>(null);
    const [deletingStudent, setDeletingStudent] = useState(false);
    const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

    /* =================== Student details view (replaces the table) =================== */
    const [viewStudent, setViewStudent] = useState<StudentResponseProps | null>(null);
    const [academicHistory, setAcademicHistory] = useState<StudentClassesData | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    /* =================== Student record PDF (SF10) =================== */
    async function openStudentRecordPdf(student: StudentResponseProps) {
        if (pdfLoading) return;
        setPdfLoading(true);
        // Open the tab synchronously inside the click gesture so popup blockers
        // don't reject it — the final blob URL is only known after the fetch.
        const pdfTab = window.open("", "_blank");
        try {
            // Fetch as a blob so the httpOnly login_token cookie travels with the
            // request (a plain tab navigation to the endpoint would not send it).
            const response = await API.get(`/student-records/${student.id}/pdf`, { responseType: "blob" });
            const blobUrl = URL.createObjectURL(response.data as Blob);
            if (pdfTab) {
                pdfTab.location.href = blobUrl;
            } else {
                window.open(blobUrl, "_blank");
            }
            // Give the new tab time to load the PDF before releasing the URL.
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        } catch {
            pdfTab?.close();
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setPdfLoading(false);
        }
    }

    function goBackToStudents() {
        setViewStudent(null);
        setAcademicHistory(null);
        setHistoryLoading(false);
        triggerRef.current?.focus();
    }

    async function openStudentDetails(student: StudentResponseProps) {
        if (viewStudent) return;
        setViewStudent(student);
        setAcademicHistory(null);
        setHistoryLoading(true);
        try {
            const response = await getAPICall<StudentClassesData>(`/students/${student.id}/academic-history`, { toast: false });
            setAcademicHistory(response.data ?? null);
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setHistoryLoading(false);
        }
    }

    /* =================== Search & letter filters =================== */
    const [searchQuery, setSearchQuery] = useState("");
    const [activeLetter, setActiveLetter] = useState<string | null>(null);

    const closeModal = useCallback(() => {
        setModalStatus(null);
        setEditingStudentId(null);
        (editTriggerRef.current ?? triggerRef.current)?.focus();
        editTriggerRef.current = null;
    }, []);

    function openCreateModal() {
        editTriggerRef.current = null;
        setNewStudent(EMPTY_STUDENT);
        setModalStatus("create");
    }

    async function openEditModal(event: React.MouseEvent<HTMLButtonElement>, student: StudentResponseProps) {
        if (isLoadingEdit) return;
        const clickedButton = event.currentTarget;
        setIsLoadingEdit(true);
        try {
            const response = await getAPICall<StudentResponseProps>(`/students/${student.id}/students`);
            const details = response.data;
            if (!details) return;
            editTriggerRef.current = clickedButton;
            setEditingStudentId(details.id);
            setNewStudent({
                lrn: String(details.lrn ?? ""),
                email: details.email ?? "",
                firstname: details.firstname ?? "",
                middlename: details.middlename ?? "",
                lastname: details.lastname ?? "",
                suffix: details.suffix ?? "",
                birthdate: toDateInputValue(details.birthdate),
                sex: (details.sex ?? "").toLowerCase()
            });
            setModalStatus("edit");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setIsLoadingEdit(false);
        }
    }

    function handleCreateModalInputChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = event.target;
        setNewStudent((prevStudent) => ({
            ...prevStudent,
            [name]: value
        }));
    }

    /* =================== Create / Edit submit =================== */
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;

        const required: Omit<NewStudentProps, "suffix"> = {
            lrn: newStudent.lrn,
            email: newStudent.email,
            firstname: newStudent.firstname,
            middlename: newStudent.middlename,
            lastname: newStudent.lastname,
            birthdate: newStudent.birthdate,
            sex: newStudent.sex
        };
        if (!Validate(required)) {
            return;
        }

        const studentData: NewStudentProps = {
            ...required,
            suffix: newStudent.suffix || (modalStatus === "edit" ? null : undefined)
        };

        try {
            setSubmitting(true);
            if (modalStatus === "edit" && editingStudentId !== null) {
                await patchAPICall<NewStudentProps, null>(`/students/${editingStudentId}`, studentData, { toast: true });
            } else {
                await postAPICall<NewStudentProps, null>("/students", studentData, { toast: true });
            }
            closeModal();
            setNewStudent(EMPTY_STUDENT);
            refetchStudents("/students", { toast: false });
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setSubmitting(false);
        }
    }

    /* =================== Delete student =================== */
    const closeDeleteConfirm = useCallback(() => {
        setDeleteTarget(null);
    }, []);

    async function handleConfirmDelete() {
        if (!deleteTarget || deletingStudent) return;
        setDeletingStudent(true);
        try {
            await deleteAPICall<null, null>(`/students/${deleteTarget.id}`);
            refetchStudents("/students", { toast: false });
            setDeleteTarget(null);
            deleteTriggerRef.current?.focus();
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setDeletingStudent(false);
        }
    }

    /* =================== Filtering =================== */
    const filteredStudents = useMemo(() => {
        if (!students) return null;
        const query = searchQuery.trim().toLowerCase();
        // When a search or letter filter is active, every student is fair game
        // (including soft-deleted/inactive ones). With no filter, inactive
        // records are hidden.
        const hasFilter = Boolean(query || activeLetter);
        return students.filter((student) => {
            const haystack = `${student.fullname} ${student.lrn} ${student.email}`.toLowerCase();
            const matchesSearch = !query || haystack.includes(query);
            const matchesLetter = !activeLetter || getLastNameInitial(student) === activeLetter;
            const matchesStatus = hasFilter || student.status !== "inactive";
            return matchesSearch && matchesLetter && matchesStatus;
        });
    }, [students, searchQuery, activeLetter]);

    const hasActiveFilter = Boolean(searchQuery.trim() || activeLetter);

    /* =================== Table columns =================== */
    const columns: TableColumns<StudentResponseProps>[] = [
        { headers: "ID", accessor: "id" },
        { headers: "LRN", accessor: "lrn" },
        {
            headers: "Name",
            accessor: "fullname",
            renderCell: (student) => (
                <div className="students__name-cell">
                    <button
                        type="button"
                        className="students__name-link"
                        onClick={(event) => {
                            event.stopPropagation();
                            openStudentDetails(student);
                        }}
                        aria-label={`View details for ${student.fullname}`}
                        title="View student details"
                    >
                        <span className="students__name">{student.fullname}</span>
                    </button>
                    {student.status === "inactive" && (
                        <span className="students__status-chip" title="This student has been soft-deleted">Inactive</span>
                    )}
                </div>
            )
        },
        { headers: "Email", accessor: "email" },
        {
            headers: "Actions",
            accessor: "id",
            renderCell: (student) => (
                <div className="students__row-actions">
                    <button
                        type="button"
                        className="students__action-btn students__action-btn--edit"
                        onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(event, student);
                        }}
                        disabled={isLoadingEdit}
                        aria-label={`Edit ${student.fullname}`}
                        title="Edit student"
                    >
                        <FiEdit2 aria-hidden="true" />
                    </button>
                    {student.status !== "inactive" && (
                        <button
                            type="button"
                            className="students__action-btn students__action-btn--delete"
                            onClick={(event) => {
                                event.stopPropagation();
                                deleteTriggerRef.current = event.currentTarget;
                                setDeleteTarget(student);
                            }}
                            disabled={deletingStudent}
                            aria-label={`Delete ${student.fullname}`}
                            title="Delete student"
                        >
                            <FiTrash2 aria-hidden="true" />
                        </button>
                    )}
                </div>
            )
        }
    ];

    useEffect(() => {
        refetchStudents("/students", { toast: false });
    }, []);


    if (loading) {
        return (
            <section className="students flex flex-col gap-5">
                <PageCard
        className="students__card"
        ariaBusy={true}
        ariaLabel="Loading students"
                >
                    <div className="students__header flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="students__heading min-w-0">
                            <h2 className="students__title text-base font-bold">Student Records</h2>
                            <p className="students__subtitle mt-1 text-[0.8125rem]">Loading enrolled students…</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <Skeleton count={4} lines={1} height="2.5rem" gap="0.75rem" />
                    </div>
                </PageCard>
            </section>
        );
    }

    return (
        <section className="students flex flex-col gap-5">
            <PageCard
        className="students__card"
            >
                <div className="students__header flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="students__heading min-w-0">
                        <h2 className="students__title text-base font-bold">Student Records</h2>
                        <p className="students__subtitle mt-1 text-[0.8125rem]">Manage enrolled students</p>
                    </div>
                    <div className="students__actions flex flex-wrap items-center gap-2">
                        <span className="students__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            {hasActiveFilter
                                ? `${filteredStudents?.length ?? 0} of ${students?.length ?? 0} student${filteredStudents?.length === 1 ? "" : "s"}`
                                : `${filteredStudents?.length ?? 0} student${filteredStudents?.length === 1 ? "" : "s"}`}
                        </span>
                        <button
                            ref={triggerRef}
                            type="button"
                            className="students__add inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                            onClick={openCreateModal}
                            aria-label="Open create student form"
                        >
                            <FiPlus aria-hidden="true" />
                            Add Student
                        </button>
                        <button
                            type="button"
                            className="students__refresh inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                            onClick={() => refetchStudents("/students", { toast: true })}
                            aria-label="Refresh student list"
                        >
                            <span className="students__refresh-icon" aria-hidden="true">⟳</span>
                            Refresh
                        </button>
                    </div>
                </div>

                {viewStudent ? (
                    /* =================== Student details (replaces the table) =================== */
                    <div className="students-detail">
                        <div className="students-detail__nav flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                            <button
                                type="button"
                                className="students-detail__back inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={goBackToStudents}
                                aria-label="Back to students list"
                            >
                                <FiArrowLeft aria-hidden="true" />
                                Back to Students
                            </button>
                            <div className="flex flex-wrap items-center gap-3">
                                <p className="text-[0.8125rem] text-neutral-500">
                                    Viewing <span className="font-semibold text-neutral-800">{viewStudent.fullname}</span>
                                </p>
                                <button
                                    type="button"
                                    className="students-detail__print inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                                    onClick={() => openStudentRecordPdf(viewStudent)}
                                    disabled={pdfLoading}
                                    aria-label={`Print SF10 for ${viewStudent.fullname}`}
                                    title="Print student record (SF10)"
                                >
                                    <FiPrinter aria-hidden="true" />
                                    {pdfLoading ? "Preparing…" : "Print SF10"}
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Basic information */}
                            <section className="mb-6">
                                <h4 className="text-sm font-bold text-neutral-900">Student Details</h4>
                                <dl className="students-detail__grid mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                    <div className="flex flex-col gap-1">
                                        <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Full Name</dt>
                                        <dd className="text-sm font-semibold text-neutral-800">{viewStudent.fullname}</dd>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">LRN</dt>
                                        <dd className="text-sm font-semibold text-neutral-800">{viewStudent.lrn}</dd>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Email</dt>
                                        <dd className="truncate text-sm font-semibold text-neutral-800">{viewStudent.email}</dd>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Birthdate</dt>
                                        <dd className="text-sm font-semibold text-neutral-800">{viewStudent.birthdate}</dd>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Age</dt>
                                        <dd className="text-sm font-semibold text-neutral-800">{viewStudent.age}</dd>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Sex</dt>
                                        <dd className="text-sm font-semibold text-neutral-800">{viewStudent.sex}</dd>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Status</dt>
                                        <dd className="text-sm font-semibold text-neutral-800">{viewStudent.status === "inactive" ? "Inactive" : "Active"}</dd>
                                    </div>
                                </dl>
                            </section>

                            {/* Academic history */}
                            <section>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h4 className="text-sm font-bold text-neutral-900">Academic History</h4>
                                    {academicHistory && !historyLoading && (
                                        <span className="students-detail__count inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
                                            <FiCalendar aria-hidden="true" />
                                            {academicHistory.classes.length} {academicHistory.classes.length === 1 ? "school year" : "school years"}
                                        </span>
                                    )}
                                </div>

                                {historyLoading ? (
                                    <div className="mt-4 rounded-xl border border-neutral-200 p-8 text-center text-sm text-neutral-400">
                                        Loading academic history…
                                    </div>
                                ) : academicHistory && academicHistory.classes.length > 0 ? (
                                    <div className="mt-4 flex flex-col gap-4">
                                        {academicHistory.classes.map((cls) => (
                                            <article key={cls.enrollmentId} className="students-detail__class overflow-hidden rounded-xl border border-neutral-200">
                                                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                                                    <div className="flex min-w-0 items-start gap-3">
                                                        <span className="students-detail__class-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                                            <FiBookOpen />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <span className="students-detail__class-tag inline-flex rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
                                                                Grade {cls.gradeLevel}
                                                            </span>
                                                            <h5 className="mt-1.5 truncate text-[0.9375rem] font-bold text-neutral-900">{cls.section}</h5>
                                                            <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                                                SY {cls.schoolYear}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-start gap-1 text-[0.8125rem] text-neutral-600 sm:items-end">
                                                        <p className="flex items-center gap-1.5">
                                                            <FiUser className="shrink-0" aria-hidden="true" />
                                                            Adviser: <span className="font-semibold text-neutral-800">{cls.adviser ?? "—"}</span>
                                                        </p>
                                                        <div className="students-detail__average flex items-center gap-2">
                                                            <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-neutral-400">General Average</span>
                                                            <span className={`inline-flex min-w-[3rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${
                                                                cls.generalAverage === null
                                                                    ? "bg-neutral-100 text-neutral-400"
                                                                    : cls.generalAverage >= 75
                                                                        ? "students-detail__grade-pass"
                                                                        : "students-detail__grade-fail"
                                                            }`}>
                                                                {cls.generalAverage ?? "—"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {cls.subjects.length === 0 ? (
                                                    <p className="px-5 py-6 text-[0.8125rem] text-neutral-500">
                                                        No subjects assigned for this school year.
                                                    </p>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="students-detail__table w-full text-sm">
                                                            <thead>
                                                                <tr>
                                                                    <th className="px-5 py-3 text-left font-bold">Subject</th>
                                                                    <th className="px-3 py-3 text-left font-bold">Code</th>
                                                                    <th className="px-3 py-3 text-center font-bold">Units</th>
                                                                    <th className="px-3 py-3 text-center font-bold">Q1</th>
                                                                    <th className="px-3 py-3 text-center font-bold">Q2</th>
                                                                    <th className="px-3 py-3 text-center font-bold">Q3</th>
                                                                    <th className="px-3 py-3 text-center font-bold">Q4</th>
                                                                    <th className="px-3 py-3 text-center font-bold">Final</th>
                                                                    <th className="px-5 py-3 text-left font-bold">Remarks</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {cls.subjects.map((subject) => (
                                                                    <>
                                                                    <tr key={subject.classSubjectId ?? subject.name} className="border-t border-neutral-100">
                                                                        <td className="px-5 py-3">
                                                                            <span className="block font-semibold text-neutral-900">{subject.name}</span>
                                                                            <span className="block text-xs text-neutral-500">{subject.teacher ?? "—"}</span>
                                                                        </td>
                                                                        <td className="px-3 py-3 text-neutral-600">{subject.code}</td>
                                                                        <td className="px-3 py-3 text-center text-neutral-700">{subject.unit ?? "—"}</td>
                                                                        {subject.quarters.map((quarter, index) => (
                                                                            <td key={index} className="px-3 py-3 text-center text-neutral-700">
                                                                                {quarter ?? "—"}
                                                                            </td>
                                                                        ))}
                                                                        <td className={`px-3 py-3 text-center font-bold ${(subject.final ?? 0) >= 75 ? "text-emerald-700" : "text-neutral-800"}`}>
                                                                            {subject.final ?? "—"}
                                                                        </td>
                                                                        <td className="px-5 py-3">
                                                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                                                                subject.remarks === null
                                                                                    ? "bg-neutral-100 text-neutral-400"
                                                                                    : (subject.final ?? 0) >= 75
                                                                                        ? "students-detail__grade-pass"
                                                                                        : "students-detail__grade-fail"
                                                                            }`}>
                                                                                {subject.remarks ?? "—"}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                    {/* Component breakdown for composite subjects */}
                                                                    {(subject as any).componentBreakdown && (subject as any).componentBreakdown.length > 0 && (
                                                                        (subject as any).componentBreakdown.map((comp: any) => (
                                                                            <tr key={`${subject.classSubjectId ?? subject.name}-${comp.componentId}`} className="bg-gray-50">
                                                                                <td className="px-5 py-2 pl-10">
                                                                                    <span className="block text-xs font-medium text-neutral-600">└ {comp.name}</span>
                                                                                </td>
                                                                                <td className="px-3 py-2 text-xs text-neutral-500">{comp.code}</td>
                                                                                <td className="px-3 py-2 text-center text-xs text-neutral-500">{comp.weight}%</td>
                                                                                {comp.grades.map((grade: number | null, index: number) => (
                                                                                    <td key={index} className="px-3 py-2 text-center text-xs text-neutral-600">
                                                                                        {grade ?? "—"}
                                                                                    </td>
                                                                                ))}
                                                                                <td className="px-3 py-2 text-center text-xs font-medium text-neutral-600">
                                                                                    {comp.grades.filter((g: number | null) => g !== null).length > 0
                                                                                        ? Math.round(comp.grades.filter((g: number | null) => g !== null).reduce((a: number, b: number) => a + b, 0) / comp.grades.filter((g: number | null) => g !== null).length)
                                                                                        : "—"
                                                                                    }
                                                                                </td>
                                                                                <td className="px-5 py-2"></td>
                                                                            </tr>
                                                                        ))
                                                                    )}
                                                                    </>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center">
                                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
                                            <FiAlertTriangle />
                                        </span>
                                        <p className="mt-3 text-sm font-bold text-neutral-800">No academic history</p>
                                        <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                            This student has no enrollments on record yet.
                                        </p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* =================== Search + letter filter toolbar =================== */}
                        <div className="students__toolbar flex flex-col gap-3 p-5">
                            <div className="students__search relative w-full sm:max-w-xs">
                                <FiSearch className="students__search-icon pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                                <input
                                    type="search"
                                    name="student-search"
                                    className="students__search-input w-full rounded-lg border py-2.5 pl-10 pr-3.5 text-sm"
                                    placeholder="Search by name, LRN, or email"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    aria-label="Search students by name, LRN, or email"
                                />
                            </div>
                            <div className="students__letters flex items-center overflow-x-auto gap-1.5" role="group" aria-label="Filter students by last name initial">
                                <button
                                    type="button"
                                    className={`students__letter ${activeLetter === null ? "students__letter--active" : ""}`}
                                    onClick={() => setActiveLetter(null)}
                                >
                                    All
                                </button>
                                {LETTERS.map((letter) => (
                                    <button
                                        key={letter}
                                        type="button"
                                        className={`students__letter ${activeLetter === letter ? "students__letter--active" : ""}`}
                                        onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                                        aria-pressed={activeLetter === letter}
                                    >
                                        {letter}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredStudents && filteredStudents.length > 0 ? (
                            <Table
                                columns={columns}
                                data={filteredStudents}
                                rowKey={(student) => student.id}
                                onRowClick={openStudentDetails}
                            />
                        ) : (
                            <EmptyState
                                className="students__empty"
                                icon={<FiUserPlus />}
                                title={students && students.length > 0 ? "No matching students" : "No students found"}
                                description={
                                    students && students.length > 0
                                        ? "Try adjusting your search or letter filter."
                                        : "Student records will appear here once they are enrolled."
                                }
                            />
                        )}
                    </>
                )}
            </PageCard>

            {/* ==================== Create / Edit student Modal ==================== */}
            <ModalDialog
                open={Boolean(modalStatus)}
                onClose={closeModal}
                labelledById="students-modal-title"
                className="students-modal__panel w-full max-w-[36rem] overflow-y-auto rounded-3xl bg-white shadow-xl"
            >
                    <header className="students-modal__header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="students-modal__heading">
                                <span className="students-modal__eyebrow">{modalStatus === "create" ? "New record" : "Update record"}</span>
                                <h3 id="students-modal-title" className="students-modal__title mt-0.5 text-xl font-bold">
                                    {modalStatus === "create" ? "Create Student" : "Edit Student"}
                                </h3>
                                <p className="students-modal__subtitle mt-1 text-[0.8125rem]">
                                    {modalStatus === "create" ? "Enroll a new student into the school" : "Update this student's information"}
                                </p>
                            </div>
                            <button type="button" className="students-modal__close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg" onClick={closeModal} aria-label="Close modal">
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <form className="students-form p-6" onSubmit={handleSubmit} noValidate>
                            <div className="students-form__grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="students-form__field flex flex-col gap-1.5">
                                    <label htmlFor="student-lrn" className="students-form__label text-[0.8125rem] font-semibold">LRN</label>
                                    <input
                                        id="student-lrn"
                                        type="text"
                                        className="students-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="12-digit LRN"
                                        autoFocus
                                        onChange={handleCreateModalInputChange}
                                        name="lrn"
                                        value={newStudent.lrn}
                                    />
                                </div>
                                <div className="students-form__field flex flex-col gap-1.5">
                                    <label htmlFor="student-email" className="students-form__label text-[0.8125rem] font-semibold">Email</label>
                                    <input
                                        id="student-email"
                                        type="email"
                                        className="students-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="student@school.edu.ph"
                                        onChange={handleCreateModalInputChange}
                                        name="email"
                                        value={newStudent.email}
                                    />
                                </div>
                                <div className="students-form__field flex flex-col gap-1.5">
                                    <label htmlFor="student-firstname" className="students-form__label text-[0.8125rem] font-semibold">First Name</label>
                                    <input
                                        id="student-firstname"
                                        type="text"
                                        className="students-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Juan"
                                        onChange={handleCreateModalInputChange}
                                        name="firstname"
                                        value={newStudent.firstname}
                                    />
                                </div>
                                <div className="students-form__field flex flex-col gap-1.5">
                                    <label htmlFor="student-middlename" className="students-form__label text-[0.8125rem] font-semibold">Middle Name</label>
                                    <input
                                        id="student-middlename"
                                        type="text"
                                        className="students-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Santos"
                                        onChange={handleCreateModalInputChange}
                                        name="middlename"
                                        value={newStudent.middlename}
                                    />
                                </div>
                                <div className="students-form__field flex flex-col gap-1.5">
                                    <label htmlFor="student-lastname" className="students-form__label text-[0.8125rem] font-semibold">Last Name</label>
                                    <input
                                        id="student-lastname"
                                        type="text"
                                        className="students-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Dela Cruz"
                                        onChange={handleCreateModalInputChange}
                                        name="lastname"
                                        value={newStudent.lastname}
                                    />
                                </div>
                                <div className="students-form__field flex flex-col gap-1.5">
                                    <label htmlFor="student-suffix" className="students-form__label text-[0.8125rem] font-semibold">
                                        Suffix <span className="students-form__optional">(optional)</span>
                                    </label>
                                    <select
                                        id="student-suffix"
                                        className="students-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        onChange={handleCreateModalInputChange}
                                        name="suffix"
                                        value={newStudent.suffix ?? ""}
                                    >
                                        <option value="">None</option>
                                        <option value="Jr.">Jr.</option>
                                        <option value="Sr.">Sr.</option>
                                        <option value="II">II</option>
                                        <option value="III">III</option>
                                        <option value="IV">IV</option>
                                    </select>
                                </div>
                                <div className="students-form__field flex flex-col gap-1.5">
                                    <label htmlFor="student-birthdate" className="students-form__label text-[0.8125rem] font-semibold">Birthdate</label>
                                    <input
                                        id="student-birthdate"
                                        type="date"
                                        className="students-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        value={newStudent.birthdate}
                                        onChange={handleCreateModalInputChange}
                                        name="birthdate"
                                    />
                                </div>
                                <div className="students-form__field flex flex-col gap-1.5">
                                    <label htmlFor="student-sex" className="students-form__label text-[0.8125rem] font-semibold">Sex</label>
                                    <select
                                        id="student-sex"
                                        className="students-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        value={newStudent.sex}
                                        onChange={handleCreateModalInputChange}
                                        name="sex"
                                    >
                                        <option value="" disabled>Select sex</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                            </div>

                            <footer className="students-form__footer mt-6 flex justify-end gap-3 border-t pt-5">
                                <button type="button" className="students-form__cancel rounded-lg border px-4 py-2.5 text-sm font-semibold" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="students-form__submit inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold">
                                    {submitting
                                        ? (modalStatus === "edit" ? "Saving…" : "Creating…")
                                        : (modalStatus === "edit" ? "Save Changes" : "Create Student")}
                                </button>
                            </footer>
                        </form>
            </ModalDialog>

            {/* Delete student confirmation */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete student?"
                description={`This will hide ${deleteTarget?.fullname ?? "this student"} from the student list and deactivate their login account. Their enrollments, grades, and attendance records will be kept. You can't undo this from this screen.`}
                confirmLabel="Delete"
                pendingLabel="Deleting…"
                pending={deletingStudent}
                confirmIcon={<FiTrash2 aria-hidden="true" />}
                tone="danger"
                triggerRef={deleteTriggerRef}
                onConfirm={handleConfirmDelete}
                onClose={closeDeleteConfirm}
            />
        </section>
    );
}
