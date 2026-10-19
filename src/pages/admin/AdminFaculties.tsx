import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiBookOpen, FiEdit2, FiPlus, FiTrash2, FiUsers, FiX } from "react-icons/fi";

import useFaculties from "../../hooks/useFaculties";

import type { Faculty, NewFacultyProps, FacultyDetails, FacultySubjectDetails, FacultyRole } from "../../constant/faculties";
import { FACULTY_ROLES, FACULTY_ROLE_OPTIONS, facultyRoleLabel } from "../../constant/faculties";
import type { SchoolYearOption } from "../../constant/attendance";

import { Validate } from "../../helper/validate";
import { getAPICall, postAPICall, patchAPICall, deleteAPICall } from "../../api/api";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import { ModalDialog } from "../../components/ModalDialog";
import Skeleton from "../../components/Skeleton";

import "../../style/adminFaculties.css";

const EMPTY_FACULTY: NewFacultyProps = {
    email: "",
    firstname: "",
    middlename: "",
    lastname: "",
    suffix: "",
    role: FACULTY_ROLES.TEACHER
};

type ModalStatus = "create" | "edit" | null;

export default function AdminFaculties() {
    const [editingFacultyId, setEditingFacultyId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState<NewFacultyProps>(EMPTY_FACULTY);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const editTriggerRef = useRef<HTMLButtonElement | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Faculty | null>(null);
    const [deletingFaculty, setDeletingFaculty] = useState(false);
    const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

    // ================= faculties state Data =====================
    const {
        faculties,
        loading: facultiesLoading,
        fetchFaculties
    } = useFaculties<Faculty[]>();
    const [facultySubjectsDetails, setFacultySubjectsDetails] = useState<FacultySubjectDetails[] | null>(null);
    const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
    const [loadingFacultyDetails, setLoadingFacultyDetails] = useState(false);
    const selectedFacultyIdRef = useRef<number | null>(null);

    // =============== conditional State Data ===================
    const [modalStatus, setModalStatus] = useState<ModalStatus>(null);
    const [isLoadingEdit, setIsLoadingEdit] = useState(false);

    // ============ school year completion status (gates role changes) ============
    // Reflects the AUTHORITATIVE status from GET /schoolYear; the server enforces
    // the same rule with a 409 even if this state is stale (plan §7).
    const [schoolYears, setSchoolYears] = useState<SchoolYearOption[] | null>(null);

    useEffect(() => {
        getAPICall<SchoolYearOption[]>("/schoolYear", { toast: false })
            .then((response) => setSchoolYears(response.data ?? []))
            .catch(() => setSchoolYears([]));
    }, []);

    // GET /schoolYear is ordered newest-first: prefer the active year, else the newest.
    const canChangeRole = useMemo(() => {
        if (!schoolYears) return false;
        const current = schoolYears.find((year) => year.isActive) ?? schoolYears[0];
        return current?.status === "completed";
    }, [schoolYears]);

    const currentSchoolYearLabel = useMemo(() => {
        if (!schoolYears) return null;
        const current = schoolYears.find((year) => year.isActive) ?? schoolYears[0];
        if (!current) return null;
        return `SY ${current.startYear}-${current.endYear}`;
    }, [schoolYears]);

    // In EDIT mode the role select is locked until the year is completed; on
    // CREATE a role must simply be chosen (a brand-new record is not a change).
    const roleLocked = modalStatus === "edit" && !canChangeRole;

    // =================== Fetch faculties on mount ====================
    useEffect(() => {
        fetchFaculties("/faculties");
    }, []);

    // ================== Modal open/close handlers ====================
    const closeModal = useCallback(() => {
        setModalStatus(null);
        setEditingFacultyId(null);
        (editTriggerRef.current ?? triggerRef.current)?.focus();
        editTriggerRef.current = null;
    }, []);

    function openCreateModal() {
        editTriggerRef.current = null;
        setForm(EMPTY_FACULTY);
        setModalStatus("create");
    }

    async function openEditModal(event: React.MouseEvent<HTMLButtonElement>, faculty: Faculty) {
        if (isLoadingEdit) return;
        const clickedButton = event.currentTarget;
        setIsLoadingEdit(true);
        try {
            const response = await getAPICall<FacultyDetails>(`/faculties/${faculty.id}`);
            const details = response.data;
            if (!details) return;
            editTriggerRef.current = clickedButton;
            setEditingFacultyId(details.id);
            setForm({
                email: details.email,
                firstname: details.firstname,
                middlename: details.middlename,
                lastname: details.lastname,
                suffix: details.suffix ?? "",
                role: details.role ?? FACULTY_ROLES.TEACHER
            });
            setModalStatus("edit");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setIsLoadingEdit(false);
        }
    }

    // ============= Create / Edit faculty modal input change handler ================
    function handleCreateModalInputChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = event.target;
        setForm((prev) => {
            if (name === "role") {
                // Narrow to the supported values so the payload can never carry
                // an unsupported role (the server rejects it regardless).
                const role: FacultyRole = value === FACULTY_ROLES.REGISTER
                    ? FACULTY_ROLES.REGISTER
                    : FACULTY_ROLES.TEACHER;
                return { ...prev, role };
            }
            return { ...prev, [name]: value };
        });
    }

    //============== Delete faculty modal ================
    const closeDeleteConfirm = useCallback(() => {
        setDeleteTarget(null);
    }, []);

    async function handleConfirmDelete() {
        if (!deleteTarget || deletingFaculty) return;
        setDeletingFaculty(true);
        try {
            await deleteAPICall<null, null>(`/faculties/${deleteTarget.id}`);
            fetchFaculties("/faculties");
            setDeleteTarget(null);
            deleteTriggerRef.current?.focus();
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setDeletingFaculty(false);
        }
    }

    // ============= Create / Edit faculty modal ================
    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;

        const required = {
            email: form.email,
            firstname: form.firstname,
            middlename: form.middlename,
            lastname: form.lastname,
            // Role is REQUIRED — create cannot save without a chosen role, and an
            // edit always sends the current one so an unchanged role is a no-op.
            role: form.role
        };

        if (!Validate(required)) {
            return;
        }

        const facultyData: NewFacultyProps = {
            ...required,
            suffix: form.suffix || (modalStatus === "edit" ? null : undefined),
            role: form.role
        };

        try {
            setSubmitting(true);
            if (modalStatus === "edit" && editingFacultyId !== null) {
                await patchAPICall<NewFacultyProps, null>(`/faculties/${editingFacultyId}`, facultyData, { toast: true });
            } else {
                await postAPICall<NewFacultyProps, null>("/faculties", facultyData, { toast: true });
            }
            closeModal();
            setForm(EMPTY_FACULTY);
            fetchFaculties("/faculties");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setSubmitting(false);
        }
    }

    // ================= Handle faculty row click ====================
    function handleSelectedFacultyClickEvent(faculty: Faculty) {
        if (!faculty.id) {
            return;
        }
        selectedFacultyIdRef.current = faculty.id;
        setSelectedFaculty(faculty);
        setFacultySubjectsDetails(null);
        fetchFacultyDetails(faculty.id);
    }

    // ================= Fetch faculty subjects details ====================
    async function fetchFacultyDetails(facultyId: number) {
        setLoadingFacultyDetails(true);
        try {
            const response = await getAPICall<FacultySubjectDetails[]>(`/faculties/${facultyId}/subjects`);
            if (selectedFacultyIdRef.current !== facultyId) return;
            setFacultySubjectsDetails(response.data ?? null);
        } finally {
            setLoadingFacultyDetails(false);
        }
    }

    // ================= Derived values for the details view ====================
    const subjectCount = facultySubjectsDetails?.length ?? 0;
    const totalUnits = facultySubjectsDetails?.reduce((sum, tsd) => sum + Number(tsd.subjectUnit), 0) ?? 0;
    const classCount = facultySubjectsDetails
        ? new Set(facultySubjectsDetails.map((tsd) => tsd.classId)).size
        : 0;
    if (facultiesLoading) {
        return (
            <PageShell className="faculties" busy label="Loading faculties">
                <PageHeader
                    title="Faculty"
                    description="Manage faculty accounts for your school."
                />
                <PageSection className="faculties__card" flush>
                    <div className="p-6">
                        <Skeleton count={4} lines={1} height="2.5rem" gap="0.75rem" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    return (
        <PageShell className="faculties">
            {/* ==================== Page Header ==================== */}
            <PageHeader
                title={selectedFaculty ? `Faculty — ${selectedFaculty.fullname}` : "Faculty"}
                description={
                    selectedFaculty
                        ? `Viewing assigned subjects for ${selectedFaculty.fullname}`
                        : "Manage faculty accounts for your school."
                }
                actions={
                    selectedFaculty ? (
                        <button
                            type="button"
                            className="faculties__back inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                            onClick={() => {
                                setSelectedFaculty(null);
                                setFacultySubjectsDetails(null);
                            }}
                            aria-label="Back to faculty list"
                        >
                            <FiArrowLeft aria-hidden="true" />
                            <span className="text-sm font-bold">Back to List</span>
                        </button>
                    ) : (
                        <>
                            <span className="faculties__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                {faculties?.length ?? 0} {faculties?.length === 1 ? "faculty member" : "faculty members"}
                            </span>
                            <button
                                ref={triggerRef}
                                type="button"
                                className="faculties__add inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={openCreateModal}
                                aria-label="Open create faculty form"
                            >
                                <FiPlus aria-hidden="true" />
                                Add Faculty
                            </button>
                            <button
                                type="button"
                                className="faculties__refresh inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={() => fetchFaculties("/faculties")}
                                aria-label="Refresh faculty list"
                            >
                                <span className="faculties__refresh-icon" aria-hidden="true">⟳</span>
                                Refresh
                            </button>
                        </>
                    )
                }
            />

            {/* ==================== Table Card ==================== */}
            <PageSection className="faculties__card" flush>

                {/* ================= Faculties Table ================= */}
                {!selectedFaculty && faculties &&  (
                    <div className="data-table__wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col" className="data-table__th w-16">ID</th>
                                    <th scope="col" className="data-table__th w-56">Faculty</th>
                                    <th scope="col" className="data-table__th w-28">Role</th>
                                    <th scope="col" className="data-table__th w-64">Email</th>
                                    <th scope="col" className="data-table__th data-table__th--actions w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {faculties.map((faculty) => (
                                    <tr key={faculty.id}
                                        className="data-table__row data-table__row--clickable"
                                        onClick={() => handleSelectedFacultyClickEvent(faculty)}
                                    >
                                        <td className="data-table__td data-table__td--mono">{faculty.id}</td>
                                        <td className="data-table__td data-table__td--primary">{faculty.fullname}</td>
                                        <td className="data-table__td">
                                            <span className={`faculties__role faculties__role--${faculty.role}`}>
                                                {facultyRoleLabel(faculty.role)}
                                            </span>
                                        </td>
                                        <td className="data-table__td data-table__td--muted">
                                            <span className="data-table__truncate">{faculty.email}</span>
                                        </td>
                                        <td className="data-table__td data-table__td--actions">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    className="faculties__edit inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        openEditModal(event, faculty);
                                                    }}
                                                    disabled={isLoadingEdit}
                                                    aria-label={`Edit ${faculty.fullname}`}
                                                >
                                                    <FiEdit2 aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="faculties__delete inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        deleteTriggerRef.current = event.currentTarget;
                                                        setDeleteTarget(faculty);
                                                    }}
                                                    disabled={deletingFaculty}
                                                    aria-label={`Delete ${faculty.fullname}`}
                                                >
                                                    <FiTrash2 aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ================ Empty State ================ */}
                {/* If no faculties are found, display an empty state */}
                {faculties && faculties.length  <= 0 && (
                    <EmptyState
                        className="faculties__empty"
                        icon={<FiUsers />}
                        title="No faculties found"
                        description="Faculty records will appear here once staff are registered."
                    />
                )}

                {/* ===================== Faculty subject Details =====================*/}
                {selectedFaculty && (
                    <div className="faculties__details">
                        {/* Hero profile banner */}
                        <div className="faculties__profile flex items-center justify-between gap-4 p-6">
                            <div className="faculties__profile-main flex min-w-0 items-center gap-4">
                                <div className="faculties__profile-heading min-w-0">
                                    <span className="faculties__profile-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Faculty</span>
                                    <h3 className="faculties__profile-name mt-1 truncate text-[1.375rem] font-bold">{selectedFaculty.fullname}</h3>
                                    <p className="faculties__profile-email mt-0.5 truncate text-[0.8125rem]">
                                        <span className={`faculties__role faculties__role--${selectedFaculty.role} mr-2`}>
                                            {facultyRoleLabel(selectedFaculty.role)}
                                        </span>
                                        {selectedFaculty.email}
                                    </p>
                                </div>
                            </div>
                            <div className="faculties__profile-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                                <span className="faculties__profile-badge-count text-[1.375rem] font-bold leading-none">
                                    {loadingFacultyDetails ? "…" : subjectCount}
                                </span>
                                <span className="faculties__profile-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subjects</span>
                            </div>
                        </div>

                        {/* Quick stats */}
                        <div className="faculties__stats grid grid-cols-1 gap-3 border-b p-5 sm:grid-cols-3">
                            <div className="faculties__stat flex flex-col gap-0.5 rounded-lg border p-3">
                                <span className="faculties__stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Assigned Subjects</span>
                                <span className="faculties__stat-value text-[0.9375rem] font-bold">{subjectCount}</span>
                            </div>
                            <div className="faculties__stat flex flex-col gap-0.5 rounded-lg border p-3">
                                <span className="faculties__stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Total Units</span>
                                <span className="faculties__stat-value text-[0.9375rem] font-bold">{totalUnits}</span>
                            </div>
                            <div className="faculties__stat flex flex-col gap-0.5 rounded-lg border p-3">
                                <span className="faculties__stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Classes Handled</span>
                                <span className="faculties__stat-value text-[0.9375rem] font-bold">{classCount}</span>
                            </div>
                        </div>

                        {/* Assigned subjects table */}
                        <section className="faculties__subjects p-5" aria-label="Assigned subjects">
                            <div className="faculties__subjects-head flex items-start justify-between gap-4">
                                <div className="faculties__subjects-heading min-w-0">
                                    <h4 className="faculties__subjects-title text-[0.9375rem] font-bold">Assigned Subjects</h4>
                                    <p className="faculties__subjects-subtitle mt-1 text-[0.8125rem]">Subjects currently handled by {selectedFaculty.fullname}</p>
                                </div>
                                {!loadingFacultyDetails && (
                                    <span className="faculties__subjects-count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                        {subjectCount} {subjectCount === 1 ? "subject" : "subjects"}
                                    </span>
                                )}
                            </div>

                            {loadingFacultyDetails ? (
                                <div className="mt-4">
                                    <Skeleton count={3} lines={1} height="3.5rem" gap="0.75rem" />
                                </div>
                            ) : facultySubjectsDetails && facultySubjectsDetails.length > 0 ? (
                                <div className="data-table__wrap mt-4 rounded-xl border">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th scope="col" className="data-table__th w-56">Subject</th>
                                                <th scope="col" className="data-table__th w-44">Class</th>
                                                <th scope="col" className="data-table__th data-table__th--num w-20">Units</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {facultySubjectsDetails.map((tsd) => (
                                                <tr key={`${tsd.classId}-${tsd.subjectId}`} className="data-table__row">
                                                    <td className="data-table__td">
                                                        <span className="data-table__value">{tsd.subjectName}</span>
                                                        <span className="data-table__sub">{tsd.subjectCode} · #{tsd.subjectId}</span>
                                                    </td>
                                                    <td className="data-table__td">
                                                        <span className="data-table__value">Grade {tsd.classGradeLevel} – {tsd.classSection}</span>
                                                        <span className="data-table__sub">Class ID #{tsd.classId}</span>
                                                    </td>
                                                    <td className="data-table__td data-table__td--num">
                                                        <span className="faculties__subject-unit inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[0.6875rem] font-bold">
                                                            {tsd.subjectUnit} unit{tsd.subjectUnit > 1 ? "s" : ""}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="faculties__no-subjects mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
                                    <span className="faculties__no-subjects-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                        <FiBookOpen />
                                    </span>
                                    <p className="faculties__no-subjects-title mt-3 text-sm font-bold">No subjects assigned</p>
                                    <p className="faculties__no-subjects-text mt-1 text-[0.8125rem]">Subjects will appear here once this faculty is assigned to a class.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </PageSection>

            {/* ==================== Create / Edit Faculty modal ==================== */}
            <ModalDialog
                open={Boolean(modalStatus)}
                onClose={closeModal}
                labelledById="faculties-modal-title"
                className="faculties-modal__panel w-full max-w-[36rem] overflow-y-auto rounded-3xl bg-white shadow-xl"
            >
                        <header className="faculties-modal__header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="faculties-modal__heading">
                                <span className="faculties-modal__eyebrow">{modalStatus === "create" ? "New record" : "Update record"}</span>
                                <h3 id="faculties-modal-title" className="faculties-modal__title mt-0.5 text-xl font-bold">
                                    {modalStatus === "create" ? "Create Faculty" : "Edit Faculty"}
                                </h3>
                                <p className="faculties-modal__subtitle mt-1 text-[0.8125rem]">
                                    {modalStatus === "create" ? "Add a new faculty to the teaching staff" : "Update this faculty's details"}
                                </p>
                            </div>
                            <button type="button" className="faculties-modal__close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg" onClick={closeModal} aria-label="Close modal">
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <form className="faculties-form p-6" onSubmit={handleSubmit} noValidate>
                            <div className="faculties-form__grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="faculties-form__field flex flex-col gap-1.5 sm:col-span-2">
                                    <label htmlFor="faculty-email" className="faculties-form__label text-[0.8125rem] font-semibold">Email</label>
                                    <input
                                        id="faculty-email"
                                        type="email"
                                        className="faculties-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="faculty@school.edu.ph"
                                        autoFocus
                                        onChange={handleCreateModalInputChange}
                                        name="email"
                                        value={form.email}
                                    />
                                </div>
                                <div className="faculties-form__field flex flex-col gap-1.5">
                                    <label htmlFor="faculty-firstname" className="faculties-form__label text-[0.8125rem] font-semibold">First Name</label>
                                    <input
                                        id="faculty-firstname"
                                        type="text"
                                        className="faculties-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Maria"
                                        onChange={handleCreateModalInputChange}
                                        name="firstname"
                                        value={form.firstname}
                                    />
                                </div>
                                <div className="faculties-form__field flex flex-col gap-1.5">
                                    <label htmlFor="faculty-middlename" className="faculties-form__label text-[0.8125rem] font-semibold">Middle Name</label>
                                    <input
                                        id="faculty-middlename"
                                        type="text"
                                        className="faculties-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Santos"
                                        onChange={handleCreateModalInputChange}
                                        name="middlename"
                                        value={form.middlename}
                                    />
                                </div>
                                <div className="faculties-form__field flex flex-col gap-1.5">
                                    <label htmlFor="faculty-lastname" className="faculties-form__label text-[0.8125rem] font-semibold">Last Name</label>
                                    <input
                                        id="faculty-lastname"
                                        type="text"
                                        className="faculties-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Dela Cruz"
                                        onChange={handleCreateModalInputChange}
                                        name="lastname"
                                        value={form.lastname}
                                    />
                                </div>
                                <div className="faculties-form__field flex flex-col gap-1.5">
                                    <label htmlFor="faculty-suffix" className="faculties-form__label text-[0.8125rem] font-semibold">
                                        Suffix <span className="faculties-form__optional">(optional)</span>
                                    </label>
                                    <select
                                        id="faculty-suffix"
                                        className="faculties-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        defaultValue=""
                                        onChange={handleCreateModalInputChange}
                                        name="suffix"
                                        value={form.suffix ?? ""}
                                    >
                                        <option value="">None</option>
                                        <option value="Jr.">Jr.</option>
                                        <option value="Sr.">Sr.</option>
                                        <option value="II">II</option>
                                        <option value="III">III</option>
                                        <option value="IV">IV</option>
                                    </select>
                                </div>
                                <div className="faculties-form__field flex flex-col gap-1.5 sm:col-span-2">
                                    <label htmlFor="faculty-role" className="faculties-form__label text-[0.8125rem] font-semibold">
                                        Role <span className="faculties-form__required">(required)</span>
                                    </label>
                                    <select
                                        id="faculty-role"
                                        className="faculties-form__input w-full rounded-lg border px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                        onChange={handleCreateModalInputChange}
                                        name="role"
                                        value={form.role}
                                        disabled={roleLocked}
                                        required
                                        aria-describedby="faculty-role-help"
                                    >
                                        {FACULTY_ROLE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p id="faculty-role-help" className="faculties-form__hint text-[0.75rem] leading-relaxed">
                                        {roleLocked
                                            ? `Faculty roles can only be changed after the current school year has been officially completed${currentSchoolYearLabel ? ` (${currentSchoolYearLabel} is still ongoing)` : ""}.`
                                            : FACULTY_ROLE_OPTIONS.find((option) => option.value === form.role)?.hint}
                                    </p>
                                </div>
                            </div>

                            <footer className="faculties-form__footer mt-6 flex justify-end gap-3 border-t pt-5">
                                <button type="button" className="faculties-form__cancel rounded-lg border px-4 py-2.5 text-sm font-semibold" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="faculties-form__submit inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold">
                                    {submitting
                                        ? (modalStatus === "edit" ? "Saving…" : "Creating…")
                                        : (modalStatus === "edit" ? "Save Changes" : "Create Faculty")}
                                </button>
                            </footer>
                        </form>
            </ModalDialog>

            {/* Delete faculty confirmation */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete faculty?"
                description={`This will permanently remove ${deleteTarget?.fullname ?? "this faculty"} and their account. Subject assignments will also be removed. This cannot be undone.`}
                confirmLabel="Delete"
                pendingLabel="Deleting…"
                pending={deletingFaculty}
                confirmIcon={<FiTrash2 aria-hidden="true" />}
                tone="danger"
                triggerRef={deleteTriggerRef}
                onConfirm={handleConfirmDelete}
                onClose={closeDeleteConfirm}
            />
        </PageShell>
    );
}
