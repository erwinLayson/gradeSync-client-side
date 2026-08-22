import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiBookOpen, FiEdit2, FiPlus, FiTrash2, FiUsers, FiX } from "react-icons/fi";

import useTeachers from "../../hooks/useTeachers";

import type { Teacher, NewTeacherProps, TeacherDetails, TeacherSubjectDetails } from "../../constant/teachers";

import { Validate } from "../../helper/validate";
import { getInitials } from "../../helper/initials";

import { getAPICall, postAPICall, patchAPICall, deleteAPICall } from "../../api/api";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import Skeleton from "../../components/Skeleton";

import "../../style/adminTeachers.css";

const EMPTY_TEACHER: NewTeacherProps = {
    email: "",
    firstname: "",
    middlename: "",
    lastname: "",
    suffix: ""
};

type ModalStatus = "create" | "edit" | null;

export default function AdminTeachers() {
    const [editingTeacherId, setEditingTeacherId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState<NewTeacherProps>(EMPTY_TEACHER);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const editTriggerRef = useRef<HTMLButtonElement | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
    const [deletingTeacher, setDeletingTeacher] = useState(false);
    const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

    // ================= teachers state Data =====================
    const {
        teachers,
        loading: teachersLoading,
        fetchTeachers
    } = useTeachers<Teacher[]>();
    const [teacherSubjectsDetails, setTeacherSubjectsDetails] = useState<TeacherSubjectDetails[] | null>(null);
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
    const [loadingTeacherDetails, setLoadingTeacherDetails] = useState(false);
    const selectedTeacherIdRef = useRef<number | null>(null);

    // =============== conditional State Data ===================
    const [modalStatus, setModalStatus] = useState<ModalStatus>(null);
    const [isLoadingEdit, setIsLoadingEdit] = useState(false);

    // =================== Fetch teachers on mount ====================
    useEffect(() => {
        fetchTeachers("/teachers");
    }, []);

    // ================== Modal open/close handlers ====================
    const closeModal = useCallback(() => {
        setModalStatus(null);
        setEditingTeacherId(null);
        (editTriggerRef.current ?? triggerRef.current)?.focus();
        editTriggerRef.current = null;
    }, []);

    function handleOverlayMouseDown(event: React.MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) {
            closeModal();
        }
    }

    useEffect(() => {
        if (!modalStatus) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeModal();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [modalStatus, closeModal]);

    function openCreateModal() {
        editTriggerRef.current = null;
        setForm(EMPTY_TEACHER);
        setModalStatus("create");
    }

    async function openEditModal(event: React.MouseEvent<HTMLButtonElement>, teacher: Teacher) {
        if (isLoadingEdit) return;
        const clickedButton = event.currentTarget;
        setIsLoadingEdit(true);
        try {
            const response = await getAPICall<TeacherDetails>(`/teachers/${teacher.id}`);
            const details = response.data;
            if (!details) return;
            editTriggerRef.current = clickedButton;
            setEditingTeacherId(details.id);
            setForm({
                email: details.email,
                firstname: details.firstname,
                middlename: details.middlename,
                lastname: details.lastname,
                suffix: details.suffix ?? ""
            });
            setModalStatus("edit");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setIsLoadingEdit(false);
        }
    }

    // ============= Create / Edit teacher modal input change handler ================
    function handleCreateModalInputChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    //============== Delete teacher modal ================
    const closeDeleteConfirm = useCallback(() => {
        setDeleteTarget(null);
    }, []);

    async function handleConfirmDelete() {
        if (!deleteTarget || deletingTeacher) return;
        setDeletingTeacher(true);
        try {
            await deleteAPICall<null, null>(`/teachers/${deleteTarget.id}`);
            fetchTeachers("/teachers");
            setDeleteTarget(null);
            deleteTriggerRef.current?.focus();
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setDeletingTeacher(false);
        }
    }

    // ============= Create / Edit teacher modal ================
    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;

        const required = {
            email: form.email,
            firstname: form.firstname,
            middlename: form.middlename,
            lastname: form.lastname
        };

        if (!Validate(required)) {
            return;
        }

        const teacherData: NewTeacherProps = {
            ...required,
            suffix: form.suffix || (modalStatus === "edit" ? null : undefined)
        };

        try {
            setSubmitting(true);
            if (modalStatus === "edit" && editingTeacherId !== null) {
                await patchAPICall<NewTeacherProps, null>(`/teachers/${editingTeacherId}`, teacherData, { toast: true });
            } else {
                await postAPICall<NewTeacherProps, null>("/teachers", teacherData, { toast: true });
            }
            closeModal();
            setForm(EMPTY_TEACHER);
            fetchTeachers("/teachers");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setSubmitting(false);
        }
    }

    // ================= Handle teacher row click ====================
    function handleSelectedTeacherClickEvent(teacher: Teacher) {
        if (!teacher.id) {
            return;
        }
        selectedTeacherIdRef.current = teacher.id;
        setSelectedTeacher(teacher);
        setTeacherSubjectsDetails(null);
        fetchTeacherDetails(teacher.id);
    }

    // ================= Fetch teacher subjects details ====================
    async function fetchTeacherDetails(teacherId: number) {
        setLoadingTeacherDetails(true);
        try {
            const response = await getAPICall<TeacherSubjectDetails[]>(`/teachers/${teacherId}/subjects`);
            if (selectedTeacherIdRef.current !== teacherId) return;
            console.log("Fetched teacher subjects details:", response.data);    
            setTeacherSubjectsDetails(response.data ?? null);
        }  finally {
            setLoadingTeacherDetails(false);
        }
    }

    // ================= Derived values for the details view ====================
    const subjectCount = teacherSubjectsDetails?.length ?? 0;
    const totalUnits = teacherSubjectsDetails?.reduce((sum, tsd) => sum + Number(tsd.subjectUnit), 0) ?? 0;
    const classCount = teacherSubjectsDetails
        ? new Set(teacherSubjectsDetails.map((tsd) => tsd.classId)).size
        : 0;
    if (teachersLoading) {
        return (
            <section className="teachers flex flex-col gap-5">
                <div className="teachers__card overflow-hidden rounded-2xl bg-white shadow-sm" aria-busy="true" aria-label="Loading teachers">
                    <div className="teachers__header flex flex-wrap items-center justify-between gap-4 p-5">
                        <div className="teachers__heading min-w-0">
                            <h2 className="teachers__title text-base font-bold">Teacher Records</h2>
                            <p className="teachers__subtitle mt-1 text-[0.8125rem]">Loading teaching staff…</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <Skeleton count={4} lines={1} height="2.5rem" gap="0.75rem" />
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="teachers flex flex-col gap-5">
            <div className="teachers__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="teachers__header flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="teachers__heading min-w-0">
                        <h2 className="teachers__title text-base font-bold">Teacher Records</h2>
                        <p className="teachers__subtitle mt-1 text-[0.8125rem]">
                            {selectedTeacher ? `Viewing subjects for ${selectedTeacher.fullname}` : "Manage teaching staff"}
                        </p>
                    </div>
                    <div className="teachers__actions flex flex-wrap items-center gap-2">
                        {selectedTeacher ? (
                            <button
                                type="button"
                                className="teachers__back inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={() => {
                                    setSelectedTeacher(null);
                                    setTeacherSubjectsDetails(null);
                                }}
                                aria-label="Back to teacher list"
                            >
                                <FiArrowLeft aria-hidden="true" />
                                <span className="text-sm font-bold">Back to List</span>
                            </button>
                        ) : (
                            <>
                                <span className="teachers__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                    {teachers?.length ?? 0} {teachers?.length === 1 ? "teacher" : "teachers"}
                                </span>
                                <button
                                    ref={triggerRef}
                                    type="button"
                                    className="teachers__add inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                                    onClick={openCreateModal}
                                    aria-label="Open create teacher form"
                                >
                                    <FiPlus aria-hidden="true" />
                                    Add Teacher
                                </button>
                                <button
                                    type="button"
                                    className="teachers__refresh inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                                    onClick={() => fetchTeachers("/teachers")}
                                    aria-label="Refresh teacher list"
                                >
                                    <span className="teachers__refresh-icon" aria-hidden="true">⟳</span>
                                    Refresh
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ================= Teachers Table ================= */}
                {!selectedTeacher && teachers &&  (
                    <div className="teachers__table-wrap overflow-x-auto">
                        <table className="teachers__table w-full min-w-[40rem] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th scope="col" className="px-6 py-3">ID</th>
                                    <th scope="col" className="px-6 py-3">Teacher</th>
                                    <th scope="col" className="px-6 py-3">Email</th>
                                    <th scope="col" className="w-20 px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teachers.map((teacher) => (
                                    <tr key={teacher.id}
                                        onClick={() => handleSelectedTeacherClickEvent(teacher)}
                                    >
                                        <td className="teachers__cell--id px-6 py-3.5">{teacher.id}</td>
                                        <td className="teachers__cell--name px-6 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <span className="teachers__avatar inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold uppercase" aria-hidden="true">
                                                    {getInitials(teacher.fullname)}
                                                </span>
                                                {teacher.fullname}
                                            </div>
                                        </td>
                                        <td className="teachers__cell--email px-6 py-3.5">{teacher.email}</td>
                                        <td className="px-6 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    className="teachers__edit inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        openEditModal(event, teacher);
                                                    }}
                                                    disabled={isLoadingEdit}
                                                    aria-label={`Edit ${teacher.fullname}`}
                                                >
                                                    <FiEdit2 aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="teachers__delete inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        deleteTriggerRef.current = event.currentTarget;
                                                        setDeleteTarget(teacher);
                                                    }}
                                                    disabled={deletingTeacher}
                                                    aria-label={`Delete ${teacher.fullname}`}
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
                {/* If no teachers are found, display an empty state */}
                {teachers && teachers.length  <= 0 && (
                    <div className="teachers__empty flex flex-col items-center justify-center px-6 py-14 text-center">
                        <span className="teachers__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                            <FiUsers />
                        </span>
                        <p className="teachers__empty-title mt-3 text-sm font-bold">No teachers found</p>
                        <p className="teachers__empty-text mt-1 text-[0.8125rem]">Teacher records will appear here once staff are registered.</p>
                    </div>
                )}

                {/* ===================== Teacher subject Details =====================*/}
                {selectedTeacher && (
                    <div className="teachers__details">
                        {/* Hero profile banner */}
                        <div className="teachers__profile flex items-center justify-between gap-4 p-6">
                            <div className="teachers__profile-main flex min-w-0 items-center gap-4">
                                <span
                                    className="teachers__profile-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-bold uppercase"
                                    aria-hidden="true"
                                >
                                    {getInitials(selectedTeacher.fullname)}
                                </span>
                                <div className="teachers__profile-heading min-w-0">
                                    <span className="teachers__profile-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Teacher</span>
                                    <h3 className="teachers__profile-name mt-1 truncate text-[1.375rem] font-bold">{selectedTeacher.fullname}</h3>
                                    <p className="teachers__profile-email mt-0.5 truncate text-[0.8125rem]">{selectedTeacher.email}</p>
                                </div>
                            </div>
                            <div className="teachers__profile-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                                <span className="teachers__profile-badge-count text-[1.375rem] font-bold leading-none">
                                    {loadingTeacherDetails ? "…" : subjectCount}
                                </span>
                                <span className="teachers__profile-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subjects</span>
                            </div>
                        </div>

                        {/* Quick stats */}
                        <div className="teachers__stats grid grid-cols-1 gap-3 border-b p-5 sm:grid-cols-3">
                            <div className="teachers__stat flex flex-col gap-0.5 rounded-lg border p-3">
                                <span className="teachers__stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Assigned Subjects</span>
                                <span className="teachers__stat-value text-[0.9375rem] font-bold">{subjectCount}</span>
                            </div>
                            <div className="teachers__stat flex flex-col gap-0.5 rounded-lg border p-3">
                                <span className="teachers__stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Total Units</span>
                                <span className="teachers__stat-value text-[0.9375rem] font-bold">{totalUnits}</span>
                            </div>
                            <div className="teachers__stat flex flex-col gap-0.5 rounded-lg border p-3">
                                <span className="teachers__stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Classes Handled</span>
                                <span className="teachers__stat-value text-[0.9375rem] font-bold">{classCount}</span>
                            </div>
                        </div>

                        {/* Assigned subjects table */}
                        <section className="teachers__subjects p-5" aria-label="Assigned subjects">
                            <div className="teachers__subjects-head flex items-start justify-between gap-4">
                                <div className="teachers__subjects-heading min-w-0">
                                    <h4 className="teachers__subjects-title text-[0.9375rem] font-bold">Assigned Subjects</h4>
                                    <p className="teachers__subjects-subtitle mt-1 text-[0.8125rem]">Subjects currently handled by {selectedTeacher.fullname}</p>
                                </div>
                                {!loadingTeacherDetails && (
                                    <span className="teachers__subjects-count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                        {subjectCount} {subjectCount === 1 ? "subject" : "subjects"}
                                    </span>
                                )}
                            </div>

                            {loadingTeacherDetails ? (
                                <div className="mt-4">
                                    <Skeleton count={3} lines={1} height="3.5rem" gap="0.75rem" />
                                </div>
                            ) : teacherSubjectsDetails && teacherSubjectsDetails.length > 0 ? (
                                <div className="teachers__subjects-table-wrap mt-4 overflow-x-auto rounded-xl border">
                                    <table className="teachers__subjects-table w-full min-w-[36rem] border-collapse text-sm">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Subject</th>
                                                <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Class</th>
                                                <th className="w-28 px-4 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Units</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {teacherSubjectsDetails.map((tsd) => (
                                                <tr key={`${tsd.classId}-${tsd.subjectId}`}>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <span className="teachers__subject-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
                                                                <FiBookOpen />
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="teachers__subject-name truncate text-[0.8125rem] font-bold">{tsd.subjectName}</p>
                                                                <p className="teachers__subject-meta mt-0.5 font-mono text-[0.6875rem]">{tsd.subjectCode} · #{tsd.subjectId}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <p className="teachers__subject-class text-[0.8125rem] font-semibold">Grade {tsd.classGradeLevel} – {tsd.classSection}</p>
                                                        <p className="teachers__subject-meta mt-0.5 font-mono text-[0.6875rem]">Class ID #{tsd.classId}</p>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <span className="teachers__subject-unit inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[0.6875rem] font-bold">
                                                            {tsd.subjectUnit} unit{tsd.subjectUnit > 1 ? "s" : ""}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="teachers__no-subjects mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
                                    <span className="teachers__no-subjects-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                        <FiBookOpen />
                                    </span>
                                    <p className="teachers__no-subjects-title mt-3 text-sm font-bold">No subjects assigned</p>
                                    <p className="teachers__no-subjects-text mt-1 text-[0.8125rem]">Subjects will appear here once this teacher is assigned to a class.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>

            {/* ==================== Create / Edit Teacher modal ==================== */}
            {modalStatus && (
                <div
                    className="teachers-modal fixed inset-0 z-[1000] grid place-items-center p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="teachers-modal-title"
                    onMouseDown={handleOverlayMouseDown}
                >
                    <div className="teachers-modal__panel w-full max-w-[36rem] overflow-y-auto rounded-3xl bg-white shadow-xl">
                        <header className="teachers-modal__header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="teachers-modal__heading">
                                <span className="teachers-modal__eyebrow">{modalStatus === "create" ? "New record" : "Update record"}</span>
                                <h3 id="teachers-modal-title" className="teachers-modal__title mt-0.5 text-xl font-bold">
                                    {modalStatus === "create" ? "Create Teacher" : "Edit Teacher"}
                                </h3>
                                <p className="teachers-modal__subtitle mt-1 text-[0.8125rem]">
                                    {modalStatus === "create" ? "Add a new teacher to the teaching staff" : "Update this teacher's details"}
                                </p>
                            </div>
                            <button type="button" className="teachers-modal__close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg" onClick={closeModal} aria-label="Close modal">
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <form className="teachers-form p-6" onSubmit={handleSubmit} noValidate>
                            <div className="teachers-form__grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="teachers-form__field flex flex-col gap-1.5 sm:col-span-2">
                                    <label htmlFor="teacher-email" className="teachers-form__label text-[0.8125rem] font-semibold">Email</label>
                                    <input
                                        id="teacher-email"
                                        type="email"
                                        className="teachers-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="teacher@school.edu.ph"
                                        autoFocus
                                        onChange={handleCreateModalInputChange}
                                        name="email"
                                        value={form.email}
                                    />
                                </div>
                                <div className="teachers-form__field flex flex-col gap-1.5">
                                    <label htmlFor="teacher-firstname" className="teachers-form__label text-[0.8125rem] font-semibold">First Name</label>
                                    <input
                                        id="teacher-firstname"
                                        type="text"
                                        className="teachers-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Maria"
                                        onChange={handleCreateModalInputChange}
                                        name="firstname"
                                        value={form.firstname}
                                    />
                                </div>
                                <div className="teachers-form__field flex flex-col gap-1.5">
                                    <label htmlFor="teacher-middlename" className="teachers-form__label text-[0.8125rem] font-semibold">Middle Name</label>
                                    <input
                                        id="teacher-middlename"
                                        type="text"
                                        className="teachers-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Santos"
                                        onChange={handleCreateModalInputChange}
                                        name="middlename"
                                        value={form.middlename}
                                    />
                                </div>
                                <div className="teachers-form__field flex flex-col gap-1.5">
                                    <label htmlFor="teacher-lastname" className="teachers-form__label text-[0.8125rem] font-semibold">Last Name</label>
                                    <input
                                        id="teacher-lastname"
                                        type="text"
                                        className="teachers-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Dela Cruz"
                                        onChange={handleCreateModalInputChange}
                                        name="lastname"
                                        value={form.lastname}
                                    />
                                </div>
                                <div className="teachers-form__field flex flex-col gap-1.5">
                                    <label htmlFor="teacher-suffix" className="teachers-form__label text-[0.8125rem] font-semibold">
                                        Suffix <span className="teachers-form__optional">(optional)</span>
                                    </label>
                                    <select
                                        id="teacher-suffix"
                                        className="teachers-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
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
                            </div>

                            <footer className="teachers-form__footer mt-6 flex justify-end gap-3 border-t pt-5">
                                <button type="button" className="teachers-form__cancel rounded-lg border px-4 py-2.5 text-sm font-semibold" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="teachers-form__submit inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold">
                                    {submitting
                                        ? (modalStatus === "edit" ? "Saving…" : "Creating…")
                                        : (modalStatus === "edit" ? "Save Changes" : "Create Teacher")}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete teacher confirmation */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete teacher?"
                description={`This will permanently remove ${deleteTarget?.fullname ?? "this teacher"} and their account. Subject assignments will also be removed. This cannot be undone.`}
                confirmLabel="Delete"
                pendingLabel="Deleting…"
                pending={deletingTeacher}
                confirmIcon={<FiTrash2 aria-hidden="true" />}
                tone="danger"
                triggerRef={deleteTriggerRef}
                onConfirm={handleConfirmDelete}
                onClose={closeDeleteConfirm}
            />
        </section>
    );
}
