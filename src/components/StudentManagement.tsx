import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiArrowLeft,
    FiBookOpen,
    FiCalendar,
    FiChevronDown,
    FiChevronRight,
    FiEdit2,
    FiEye,
    FiPlus,
    FiPrinter,
    FiSearch,
    FiTrash2,
    FiUser,
    FiUserPlus,
    FiX,
} from "react-icons/fi";

import { useAcademicSettings } from "../hooks/useAcademicSettings";

import type {
    StudentResponseProps,
    NewStudentProps,
    StudentListResponse,
    StudentStatusFilter,
    StudentSortKey,
    SortDirection,
} from "../constant/students.js";
import type { StudentClassesData } from "../constant/studentClasses.js";
import "../style/adminStudent.css";

// Components
import Table, { type TableColumns } from "./Table.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { PageSection, PageShell } from "./PageLayout";
import { EmptyState } from "./EmptyState.js";
import { ModalDialog } from "./ModalDialog.js";
import Skeleton from "./Skeleton";

// Helpers Functions
import { Validate } from "../helper/validate.js";
import { isPassing } from "../helper/grades";

// API Calls
import { API, deleteAPICall, getAPICall, patchAPICall, postAPICall } from "../api/api.js";

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

// Server-side pagination: the size the table may request per page.
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

// The list route carries its filters in the query string so returning from a
// student's details (browser back, breadcrumb or "Back to list") restores the
// exact search/filter/sort/page the administrator left.
type DetailLocationState = { listSearch?: string } | null;

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

interface StudentManagementProps {
    /** Route the list/detail screens are mounted under, e.g. "/admin/students". */
    basePath: string;
}

export default function StudentManagement({ basePath }: StudentManagementProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { studentId: studentIdParam } = useParams<{ studentId?: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
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

    /* =================== List data (server-paginated) =================== */
    const [students, setStudents] = useState<StudentResponseProps[]>([]);
    const [total, setTotal] = useState(0);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState(false);
    // Bumping this re-runs the list/detail fetches after a create/edit/delete.
    const [refreshKey, setRefreshKey] = useState(0);

    /* =================== Student details (route-driven) =================== */
    const [viewStudent, setViewStudent] = useState<StudentResponseProps | null>(null);
    const [academicHistory, setAcademicHistory] = useState<StudentClassesData | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    // School years the administrator has collapsed in the academic history.
    const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

    /* =================== List query (URL is the source of truth) =================== */
    const search = searchParams.get("search") ?? "";
    const statusParam = searchParams.get("status");
    const status: StudentStatusFilter =
        statusParam === "inactive" || statusParam === "all" || statusParam === "enrolled" || statusParam === "unenrolled"
            ? statusParam
            : "active";
    const sortParam = searchParams.get("sort");
    const sort: StudentSortKey =
        sortParam === "lrn" || sortParam === "email" || sortParam === "id" ? sortParam : "name";
    const dir: SortDirection = searchParams.get("dir") === "desc" ? "desc" : "asc";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSizeRaw = Number(searchParams.get("pageSize"));
    const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;

    // Debounced mirror of the search box. The input stays responsive while the
    // URL (and therefore the request) only updates a beat after typing stops.
    const [searchDraft, setSearchDraft] = useState(search);
    const [syncedSearch, setSyncedSearch] = useState(search);
    if (search !== syncedSearch) {
        setSyncedSearch(search);
        setSearchDraft(search);
    }

    const updateParams = useCallback(
        (patch: Record<string, string | undefined>) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                for (const [key, value] of Object.entries(patch)) {
                    if (value === undefined || value === "") next.delete(key);
                    else next.set(key, value);
                }
                // Any change other than an explicit page change restarts at page 1.
                if (!("page" in patch)) next.delete("page");
                return next;
            });
        },
        [setSearchParams]
    );

    useEffect(() => {
        if (searchDraft === search) return;
        const handle = window.setTimeout(() => {
            updateParams({ search: searchDraft || undefined });
        }, 300);
        return () => window.clearTimeout(handle);
    }, [searchDraft, search, updateParams]);

    /* =================== Fetch the current page =================== */
    useEffect(() => {
        // On a detail route the list is not shown, so it is not fetched.
        if (studentIdParam) return;

        let cancelled = false;
        async function load() {
            setListLoading(true);
            setListError(false);
            try {
                const params = new URLSearchParams();
                if (search) params.set("search", search);
                params.set("status", status);
                params.set("page", String(page));
                params.set("pageSize", String(pageSize));
                params.set("sort", sort);
                params.set("dir", dir);

                const response = await getAPICall<StudentListResponse>(
                    `/students?${params.toString()}`,
                    { toast: false, skipErrorToast: true }
                );
                if (cancelled) return;
                const data = response.data;
                const rows = data?.students ?? [];
                setStudents(rows);
                setTotal(data?.total ?? 0);

                // If the current page emptied (e.g. the last row was deleted),
                // fall back to the new last page.
                const lastPage = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
                if (page > lastPage && rows.length === 0) {
                    setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        if (lastPage > 1) next.set("page", String(lastPage));
                        else next.delete("page");
                        return next;
                    }, { replace: true });
                }
            } catch {
                if (!cancelled) {
                    setStudents([]);
                    setTotal(0);
                    setListError(true);
                }
            } finally {
                if (!cancelled) setListLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [studentIdParam, search, status, page, pageSize, sort, dir, refreshKey, setSearchParams]);

    /* =================== Fetch the selected student + history =================== */
    useEffect(() => {
        if (!studentIdParam) return;

        let cancelled = false;
        async function load() {
            setDetailLoading(true);
            setDetailError(false);
            try {
                const [studentResponse, historyResponse] = await Promise.all([
                    getAPICall<StudentResponseProps>(`/students/${studentIdParam}/students`, {
                        toast: false,
                        skipErrorToast: true
                    }),
                    getAPICall<StudentClassesData>(`/students/${studentIdParam}/academic-history`, {
                        toast: false,
                        skipErrorToast: true
                    })
                ]);
                if (cancelled) return;
                setViewStudent(studentResponse.data ?? null);
                setAcademicHistory(historyResponse.data ?? null);
            } catch {
                if (!cancelled) {
                    setViewStudent(null);
                    setAcademicHistory(null);
                    setDetailError(true);
                }
            } finally {
                if (!cancelled) setDetailLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [studentIdParam, refreshKey]);

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

    /* =================== Navigation between list and details =================== */
    const detailState = location.state as DetailLocationState;
    const listSearch = detailState?.listSearch ?? "";
    const listHref = `${basePath}${listSearch}`;

    function openStudentDetails(student: StudentResponseProps) {
        navigate(`${basePath}/${student.id}`, { state: { listSearch: location.search } });
    }

    function goBackToStudents() {
        // When we arrived from the list, step back so the browser restores the
        // exact list state; a deep link has no history to return to.
        if (detailState?.listSearch !== undefined) {
            navigate(-1);
        } else {
            navigate(basePath);
        }
    }

    function toggleSort(key: string) {
        const nextDir: SortDirection = sort === key && dir === "asc" ? "desc" : "asc";
        updateParams({ sort: key, dir: nextDir });
    }

    function toggleYear(enrollmentId: number) {
        setCollapsedYears((prev) => {
            const next = new Set(prev);
            if (next.has(enrollmentId)) next.delete(enrollmentId);
            else next.add(enrollmentId);
            return next;
        });
    }

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
            setRefreshKey((key) => key + 1);
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
            setDeleteTarget(null);
            deleteTriggerRef.current?.focus();
            setRefreshKey((key) => key + 1);
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setDeletingStudent(false);
        }
    }

    /* =================== Table columns =================== */
    const columns: TableColumns<StudentResponseProps>[] = [
        { headers: "ID", accessor: "id", width: "5rem", sortable: true, sortKey: "id" },
        { headers: "LRN", accessor: "lrn", width: "9rem", sortable: true, sortKey: "lrn" },
        {
            headers: "Name",
            accessor: "fullname",
            width: "14rem",
            sortable: true,
            sortKey: "name",
            renderCell: (student) => (
                <div className="students__name-cell">
                    <span className="students__name">{student.fullname}</span>
                    {student.status === "inactive" && (
                        <span className="students__status-chip" title="This student has been soft-deleted">Inactive</span>
                    )}
                </div>
            )
        },
        { headers: "Email", accessor: "email", width: "16rem", sortable: true, sortKey: "email" },
        {
            headers: "Actions",
            accessor: "id",
            width: "8rem",
            align: "actions",
            renderCell: (student) => (
                <div className="students__row-actions">
                    <button
                        type="button"
                        className="students__action-btn students__action-btn--view"
                        onClick={() => openStudentDetails(student)}
                        aria-label={`View details for ${student.fullname}`}
                        title="View student info"
                    >
                        <FiEye aria-hidden="true" />
                    </button>
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

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const lastRow = Math.min(page * pageSize, total);
    const hasActiveFilter = Boolean(search) || status !== "active";

    /* =================== Details screen =================== */
    if (studentIdParam) {
        const viewing = viewStudent;
        return (
            <PageShell className="students">
                <PageSection
                    className="students__card"
                    flush
                    title="Student Records"
                    description="View this student's information and academic history"
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                className="students-detail__back inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={goBackToStudents}
                                aria-label="Back to students list"
                            >
                                <FiArrowLeft aria-hidden="true" />
                                Back to list
                            </button>
                            {viewing && (
                                <button
                                    type="button"
                                    className="students-detail__print inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                                    onClick={() => openStudentRecordPdf(viewing)}
                                    disabled={pdfLoading}
                                    aria-label={`Print SF10 for ${viewing.fullname}`}
                                    title="Print the complete SF10 / Form-137 student record"
                                >
                                    <FiPrinter aria-hidden="true" />
                                    {pdfLoading ? "Preparing…" : "Print SF10"}
                                </button>
                            )}
                        </div>
                    }
                >
                    <div className="students-detail__breadcrumb-bar">
                        <nav className="students-detail__breadcrumb" aria-label="Breadcrumb">
                            <Link to={listHref} className="students-detail__crumb">Students</Link>
                            <span className="students-detail__crumb-sep" aria-hidden="true">/</span>
                            <span aria-current="page" className="students-detail__crumb-current">
                                {viewing?.fullname ?? "Student details"}
                            </span>
                        </nav>
                    </div>
                    {detailLoading ? (
                        <div className="p-6">
                            <Skeleton count={4} lines={1} height="2.5rem" gap="0.75rem" />
                        </div>
                    ) : detailError || !viewing ? (
                        <EmptyState
                            className="students__empty"
                            icon={<FiAlertCircle />}
                            title="Student not found"
                            description="This student may have been removed, or you no longer have access to their record."
                            action={
                                <button
                                    type="button"
                                    className="students__add mt-4 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                                    onClick={goBackToStudents}
                                >
                                    <FiArrowLeft aria-hidden="true" />
                                    Back to students
                                </button>
                            }
                        />
                    ) : (
                        <div className="students-detail">
                            <div className="p-6">
                                {/* Basic information */}
                                <section className="mb-6">
                                    <h4 className="text-sm font-bold text-neutral-900">Student Details</h4>
                                    <dl className="students-detail__grid mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                        <div className="flex flex-col gap-1">
                                            <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Full Name</dt>
                                            <dd className="text-sm font-semibold text-neutral-800">{viewing.fullname}</dd>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">LRN</dt>
                                            <dd className="text-sm font-semibold text-neutral-800">{viewing.lrn}</dd>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Email</dt>
                                            <dd className="truncate text-sm font-semibold text-neutral-800">{viewing.email}</dd>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Birthdate</dt>
                                            <dd className="text-sm font-semibold text-neutral-800">{viewing.birthdate ?? "—"}</dd>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Age</dt>
                                            <dd className="text-sm font-semibold text-neutral-800">{viewing.age ?? "—"}</dd>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Sex</dt>
                                            <dd className="text-sm font-semibold text-neutral-800">{viewing.sex}</dd>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Status</dt>
                                            <dd className="text-sm font-semibold text-neutral-800">{viewing.status === "inactive" ? "Inactive" : "Active"}</dd>
                                        </div>
                                    </dl>
                                </section>

                                {/* Academic history, newest school year first */}
                                <section>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h4 className="text-sm font-bold text-neutral-900">Academic History</h4>
                                        {academicHistory && (
                                            <span className="students-detail__count inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
                                                <FiCalendar aria-hidden="true" />
                                                {academicHistory.classes.length} {academicHistory.classes.length === 1 ? "school year" : "school years"}
                                            </span>
                                        )}
                                    </div>

                                    {!academicHistory || academicHistory.classes.length === 0 ? (
                                        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center">
                                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
                                                <FiAlertTriangle />
                                            </span>
                                            <p className="mt-3 text-sm font-bold text-neutral-800">No academic history</p>
                                            <p className="mt-1 text-[0.8125rem] text-neutral-500">
                                                This student has no enrollments on record yet.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-4 flex flex-col gap-4">
                                            {academicHistory.classes.map((cls) => {
                                                const isCollapsed = collapsedYears.has(cls.enrollmentId);
                                                const bodyId = `academic-year-${cls.enrollmentId}`;
                                                const classQuarterCount = cls.numQuarters ?? (cls.subjects[0]?.quarters.length || quarters.length);
                                                const classQuarters = Array.from({ length: classQuarterCount }, (_, i) => i + 1);
                                                return (
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
                                                            <button
                                                                type="button"
                                                                className="students-detail__toggle inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-semibold"
                                                                onClick={() => toggleYear(cls.enrollmentId)}
                                                                aria-expanded={!isCollapsed}
                                                                aria-controls={bodyId}
                                                            >
                                                                {isCollapsed ? <FiChevronRight aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
                                                                {isCollapsed ? "Show records" : "Hide records"}
                                                            </button>
                                                        </div>

                                                        <div id={bodyId} hidden={isCollapsed}>
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
                                                                                {classQuarters.map((q) => (
                                                                                    <th key={q} scope="col" className="data-table__th data-table__th--center w-20">Q{q}</th>
                                                                                ))}
                                                                                <th scope="col" className="data-table__th data-table__th--center w-20">Final</th>
                                                                                <th scope="col" className="data-table__th w-28">Remarks</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {cls.subjects.map((subject) => (
                                                                                <Fragment key={subject.classSubjectId ?? subject.name}>
                                                                                <tr className="data-table__row">
                                                                                    <td className="data-table__td">
                                                                                        <span className="data-table__value">{subject.name}</span>
                                                                                        <span className="data-table__sub">{subject.faculty ?? "—"}</span>
                                                                                    </td>
                                                                                    <td className="data-table__td data-table__td--muted">{subject.code}</td>
                                                                                    <td className="data-table__td data-table__td--center">{subject.unit ?? "—"}</td>
                                                                                    {classQuarters.map((_q, index) => (
                                                                                        <td key={index} className="data-table__td data-table__td--center">
                                                                                            {subject.quarters[index] ?? "—"}
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
                                                                                {(subject.componentBreakdown ?? []).map((comp) => (
                                                                                    <tr key={`${subject.classSubjectId ?? subject.name}-${comp.componentId}`} className="data-table__row students-detail__component-row">
                                                                                        <td className="data-table__td data-table__td--muted">
                                                                                            <span className="block pl-5 text-xs">└ {comp.name}</span>
                                                                                        </td>
                                                                                        <td className="data-table__td data-table__td--muted text-xs">{comp.code}</td>
                                                                                        <td className="data-table__td data-table__td--center text-xs">
                                                                                            {comp.weight === null ? "—" : `${comp.weight}%`}
                                                                                        </td>
                                                                                        {classQuarters.map((_quarter, index) => (
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
                                                                                </Fragment>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    )}
                </PageSection>
            </PageShell>
        );
    }

    /* =================== List screen =================== */
    return (
        <PageShell className="students">
            <PageSection
                className="students__card"
                flush
                title="Student Records"
                description="Manage enrolled students"
                actions={
                    <div className="students__actions flex flex-wrap items-center gap-2">
                        <span className="students__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                            {hasActiveFilter
                                ? `${total} matching student${total === 1 ? "" : "s"}`
                                : `${total} student${total === 1 ? "" : "s"}`}
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
                    </div>
                }
            >
                {/* =================== Search & filters =================== */}
                <div className="students__toolbar flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="students__search relative w-full lg:max-w-xs">
                        <FiSearch className="students__search-icon pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                            type="search"
                            name="student-search"
                            className="students__search-input w-full rounded-lg border py-2.5 pl-10 pr-3.5 text-sm"
                            placeholder="Search by name, LRN, or email"
                            value={searchDraft}
                            onChange={(event) => setSearchDraft(event.target.value)}
                            aria-label="Search students by name, LRN, or email"
                        />
                    </div>

                    <div className="students__filters flex flex-wrap items-center gap-2">
                        <label className="students__filter">
                            <span className="students__filter-label">Status</span>
                            <select
                                className="students__filter-select"
                                value={status}
                                onChange={(event) => updateParams({ status: event.target.value === "active" ? undefined : event.target.value })}
                                aria-label="Filter by student status"
                            >
                                <option value="active">Active</option>
                                <option value="enrolled">Enrolled</option>
                                <option value="unenrolled">Unenrolled</option>
                                <option value="inactive">Inactive</option>
                                <option value="all">All</option>
                            </select>
                        </label>
                    </div>
                </div>

                {listError ? (
                    <EmptyState
                        className="students__empty"
                        icon={<FiAlertCircle />}
                        title="Couldn't load students"
                        description="Something went wrong while loading the student list."
                        action={
                            <button
                                type="button"
                                className="students__refresh mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={() => setRefreshKey((key) => key + 1)}
                            >
                                Try again
                            </button>
                        }
                    />
                ) : listLoading && students.length === 0 ? (
                    <div className="p-6" aria-busy="true">
                        <Skeleton count={4} lines={1} height="2.5rem" gap="0.75rem" />
                    </div>
                ) : students.length === 0 ? (
                    <EmptyState
                        className="students__empty"
                        icon={<FiUserPlus />}
                        title={hasActiveFilter ? "No matching students" : "No students found"}
                        description={
                            hasActiveFilter
                                ? "Try a different search or filter."
                                : "Student records will appear here once they are enrolled."
                        }
                    />
                ) : (
                    <>
                        <Table
                            columns={columns}
                            data={students}
                            rowKey={(student) => student.id}
                            sortKey={sort}
                            sortDir={dir}
                            onSortChange={toggleSort}
                        />

                        <div className="students__pagination flex flex-wrap items-center justify-between gap-3 p-5">
                            <p className="students__page-summary text-[0.8125rem]" aria-live="polite">
                                Showing <strong>{firstRow}</strong>–<strong>{lastRow}</strong> of{" "}
                                <strong>{total}</strong> student{total === 1 ? "" : "s"}
                                {totalPages > 1 && (
                                    <> · page {page} of {totalPages}</>
                                )}
                            </p>

                            <div className="students__pager-controls flex flex-wrap items-center gap-3">
                                <label className="students__page-size">
                                    <span className="students__filter-label">Per page</span>
                                    <select
                                        className="students__filter-select"
                                        value={String(pageSize)}
                                        onChange={(event) => updateParams({ pageSize: event.target.value })}
                                        aria-label="Students per page"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((size) => (
                                            <option key={size} value={String(size)}>{size}</option>
                                        ))}
                                    </select>
                                </label>

                                {totalPages > 1 && (
                                    <nav
                                        className="students__pager flex items-center gap-1.5"
                                        aria-label="Student table pagination"
                                    >
                                        <button
                                            type="button"
                                            className="students__page-nav"
                                            onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
                                            disabled={page === 1}
                                        >
                                            Prev
                                        </button>

                                        <span className="students__page-current" aria-hidden="true">
                                            {page} / {totalPages}
                                        </span>

                                        <button
                                            type="button"
                                            className="students__page-nav"
                                            onClick={() => updateParams({ page: String(Math.min(totalPages, page + 1)) })}
                                            disabled={page === totalPages}
                                        >
                                            Next
                                        </button>
                                    </nav>
                                )}
                            </div>
                        </div>
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
                description={`This will hide ${deleteTarget?.fullname ?? "this student"} from the student list and deactivate their login account. Their enrollments, grades, and attendance records are kept so the SF10 / academic history stays complete. You can't undo this from this screen.`}
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
