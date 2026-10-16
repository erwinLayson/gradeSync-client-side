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

import useStudent from "../hooks/useStudent";
import { useAcademicSettings } from "../hooks/useAcademicSettings";

import type { StudentResponseProps, NewStudentProps } from "../constant/students.js";
import type { StudentClassesData } from "../constant/studentClasses.js";

import "../style/adminStudent.css";

// Components
import Table, { type TableColumns } from "./Table.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { PageSection, PageShell } from "./PageLayout";
import { EmptyState } from "./EmptyState.js";
import { ModalDialog } from "./ModalDialog.js";

// Helpers Functions
import { Validate } from "../helper/validate.js";
import { isPassing } from "../helper/grades";

// API Calls
import { API, deleteAPICall, getAPICall, patchAPICall, postAPICall } from "../api/api.js";
import Skeleton from "./Skeleton";

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

// Student table pagination — at most PAGE_SIZE rows render at once, so the DOM
// stays small however large the registry grows.
const PAGE_SIZE = 100;

// Page buttons to render: all of them when there are few pages, otherwise the
// first, a window around the current page, and the last, with "gap" markers.
function buildPageItems(current: number, total: number): (number | "gap")[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }

    const items: (number | "gap")[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) items.push("gap");
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
        items.push(pageNumber);
    }
    if (end < total - 1) items.push("gap");
    items.push(total);

    return items;
}

// Normalize a birthdate string into the yyyy-mm-dd format expected by <input type="date">.
function toDateInputValue(value: string | null | undefined): string {
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

export default function StudentManagement() {
    const { students, loading, refetchStudents } = useStudent<StudentResponseProps[]>();
    const { quarters } = useAcademicSettings();

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

    /* =================== Search & pagination =================== */
    const [searchQuery, setSearchQuery] = useState("");
    // 1-based page index, reset whenever the search changes and clamped at
    // render time so a shrinking list can never strand the view on a dead page.
    const [page, setPage] = useState(1);

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

    /* =================== Filtering + pagination =================== */
    const filteredStudents = useMemo(() => {
        if (!students) return null;
        const query = searchQuery.trim().toLowerCase();
        // When a search is active, every student is fair game (including
        // soft-deleted/inactive ones). With no search, inactive records are hidden.
        const hasFilter = Boolean(query);
        return students.filter((student) => {
            const haystack = `${student.fullname} ${student.lrn} ${student.email}`.toLowerCase();
            const matchesSearch = !query || haystack.includes(query);
            const matchesStatus = hasFilter || student.status !== "inactive";
            return matchesSearch && matchesStatus;
        });
    }, [students, searchQuery]);

    const totalFiltered = filteredStudents?.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    // Only PAGE_SIZE rows are ever handed to the table.
    const pageStudents = filteredStudents?.slice(pageStart, pageStart + PAGE_SIZE) ?? null;
    const pageItems = buildPageItems(currentPage, totalPages);
    const firstRow = totalFiltered === 0 ? 0 : pageStart + 1;
    const lastRow = Math.min(pageStart + PAGE_SIZE, totalFiltered);

    const hasActiveFilter = Boolean(searchQuery.trim());

    /* =================== Table columns =================== */
    const columns: TableColumns<StudentResponseProps>[] = [
        { headers: "ID", accessor: "id", width: "6rem" },
        { headers: "LRN", accessor: "lrn", width: "9rem" },
        {
            headers: "Name",
            accessor: "fullname",
            width: "13rem",
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
        { headers: "Email", accessor: "email", width: "16rem" },
        {
            headers: "Actions",
            accessor: "id",
            width: "6rem",
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
            <PageShell className="students" busy label="Loading students">
                <PageSection className="students__card" title="Student Records" description="Loading enrolled students…" flush>
                    <div className="p-6">
                        <Skeleton count={4} lines={1} height="2.5rem" gap="0.75rem" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    return (
        <PageShell className="students">
            <PageSection
                className="students__card"
                flush
                title="Student Records"
                description={viewStudent ? `Viewing ${viewStudent.fullname}` : "Manage enrolled students"}
                actions={
                    viewStudent ? (
                        <button
                            type="button"
                            className="students-detail__back inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                            onClick={goBackToStudents}
                            aria-label="Back to students list"
                        >
                            <FiArrowLeft aria-hidden="true" />
                            Back to list
                        </button>
                    ) : (
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
                                <span className="hidden md:block">Add Student</span>
                            </button>
                            <button
                                type="button"
                                className="students__refresh inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={() => refetchStudents("/students", { toast: true })}
                                aria-label="Refresh student list"
                            >
                                <span className="students__refresh-icon" aria-hidden="true">⟳</span>
                                <span className="hidden md:block">Refresh</span>
                            </button>
                        </div>
                    )
                }
            >

                {viewStudent ? (
                    /* =================== Student details (replaces the table) =================== */
                    <div className="students-detail">
                        <div className="students-detail__nav flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                           
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
                                                                    : isPassing(cls.generalAverage)
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
                                                    <div className="data-table__wrap">
                                                        <table className="data-table">
                                                            <thead>
                                                                <tr>
                                                                    <th scope="col" className="data-table__th w-56">Subject</th>
                                                                    <th scope="col" className="data-table__th w-24">Code</th>
                                                                    <th scope="col" className="data-table__th data-table__th--center w-20">Units</th>
                                                                    {quarters.map((q) => (
                                                                        <th key={q} scope="col" className="data-table__th data-table__th--center w-20">Q{q}</th>
                                                                    ))}
                                                                    <th scope="col" className="data-table__th data-table__th--center w-20">Final</th>
                                                                    <th scope="col" className="data-table__th w-28">Remarks</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {cls.subjects.map((subject) => (
                                                                    <>
                                                                    <tr key={subject.classSubjectId ?? subject.name} className="data-table__row">
                                                                        <td className="data-table__td">
                                                                            <span className="data-table__value">{subject.name}</span>
                                                                            <span className="data-table__sub">{subject.faculty ?? "—"}</span>
                                                                        </td>
                                                                        <td className="data-table__td data-table__td--muted">{subject.code}</td>
                                                                        <td className="data-table__td data-table__td--center">{subject.unit ?? "—"}</td>
                                                                        {subject.quarters.map((quarter, index) => (
                                                                            <td key={index} className="data-table__td data-table__td--center">
                                                                                {quarter ?? "—"}
                                                                            </td>
                                                                        ))}
                                                                        <td className={`data-table__td data-table__td--center data-table__td--primary${isPassing(subject.final) ? " students-detail__final--pass" : ""}`}>
                                                                            {subject.final ?? "—"}
                                                                        </td>
                                                                        <td className="data-table__td">
                                                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                                                                subject.remarks === null
                                                                                    ? "bg-neutral-100 text-neutral-400"
                                                                                    : isPassing(subject.final)
                                                                                        ? "students-detail__grade-pass"
                                                                                        : "students-detail__grade-fail"
                                                                            }`}>
                                                                                {subject.remarks ?? "—"}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                    {/* Component breakdown for composite subjects. The per-component
                                                                        final rating is computed on the server with the same helper as
                                                                        subject finals (calculateFinalGrade) — it is never re-derived or
                                                                        re-averaged here, so the breakdown always matches the composite
                                                                        grade printed on the row above. */}
                                                                    {(subject.componentBreakdown ?? []).map((comp) => (
                                                                        <tr key={`${subject.classSubjectId ?? subject.name}-${comp.componentId}`} className="data-table__row students-detail__component-row">
                                                                            <td className="data-table__td data-table__td--muted">
                                                                                <span className="block pl-5 text-xs">└ {comp.name}</span>
                                                                            </td>
                                                                            <td className="data-table__td data-table__td--muted text-xs">{comp.code}</td>
                                                                            <td className="data-table__td data-table__td--center text-xs">
                                                                                {comp.weight === null ? "—" : `${comp.weight}%`}
                                                                            </td>
                                                                            {quarters.map((_quarter, index) => (
                                                                                <td key={index} className="data-table__td data-table__td--center data-table__td--muted text-xs">
                                                                                    {comp.grades[index] ?? "—"}
                                                                                </td>
                                                                            ))}
                                                                            <td className="data-table__td data-table__td--center data-table__td--muted text-xs">
                                                                                {comp.final ?? "—"}
                                                                            </td>
                                                                            <td className="data-table__td"></td>
                                                                        </tr>
                                                                    ))}
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
                        {/* =================== Search toolbar =================== */}
                        <div className="students__toolbar flex flex-col gap-3 p-5">
                            <div className="students__search relative w-full sm:max-w-xs">
                                <FiSearch className="students__search-icon pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                                <input
                                    type="search"
                                    name="student-search"
                                    className="students__search-input w-full rounded-lg border py-2.5 pl-10 pr-3.5 text-sm"
                                    placeholder="Search by name, LRN, or email"
                                    value={searchQuery}
                                    // A new search always starts from the first page.
                                    onChange={(event) => {
                                        setSearchQuery(event.target.value);
                                        setPage(1);
                                    }}
                                    aria-label="Search students by name, LRN, or email"
                                />
                            </div>
                        </div>

                        {pageStudents && pageStudents.length > 0 ? (
                            <>
                                <Table
                                    columns={columns}
                                    data={pageStudents}
                                    rowKey={(student) => student.id}
                                    onRowClick={openStudentDetails}
                                />

                                <div className="students__pagination flex flex-wrap items-center justify-between gap-3 p-5">
                                    <p className="students__page-summary text-[0.8125rem]" aria-live="polite">
                                        Showing <strong>{firstRow}</strong>–<strong>{lastRow}</strong> of{" "}
                                        <strong>{totalFiltered}</strong> student{totalFiltered === 1 ? "" : "s"}
                                        {totalPages > 1 && (
                                            <> · page {currentPage} of {totalPages}</>
                                        )}
                                    </p>

                                    {totalPages > 1 && (
                                        <nav
                                            className="students__pager flex items-center gap-1.5"
                                            aria-label="Student table pagination"
                                        >
                                            <button
                                                type="button"
                                                className="students__page-nav"
                                                onClick={() => setPage(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Prev
                                            </button>

                                            {pageItems.map((item, index) =>
                                                item === "gap" ? (
                                                    <span
                                                        key={`gap-${index}`}
                                                        className="students__page-gap"
                                                        aria-hidden="true"
                                                    >
                                                        …
                                                    </span>
                                                ) : (
                                                    <button
                                                        key={item}
                                                        type="button"
                                                        className={`students__page-btn${item === currentPage ? " students__page-btn--active" : ""}`}
                                                        onClick={() => setPage(item)}
                                                        aria-current={item === currentPage ? "page" : undefined}
                                                        aria-label={`Go to page ${item}`}
                                                    >
                                                        {item}
                                                    </button>
                                                )
                                            )}

                                            <button
                                                type="button"
                                                className="students__page-nav"
                                                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                Next
                                            </button>
                                        </nav>
                                    )}
                                </div>
                            </>
                        ) : (
                            <EmptyState
                                className="students__empty"
                                icon={<FiUserPlus />}
                                title={students && students.length > 0 ? "No matching students" : "No students found"}
                                description={
                                    students && students.length > 0
                                        ? "Try a different search."
                                        : "Student records will appear here once they are enrolled."
                                }
                            />
                        )}
                    </>
                )}
            </PageSection>

            {/* ==================== Create / Edit student Modal ==================== */}
            <ModalDialog
                open={Boolean(modalStatus)}
                onClose={closeModal}
                labelledById="students-modal-title"
                className="students-modal__panel w-full max-w-[36rem] overflow-y-auto rounded-2xl border border-[var(--neutral-border)] bg-white"
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
        </PageShell>
    );
}
