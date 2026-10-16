import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus, FiX, FiArrowLeft, FiBookOpen, FiUsers, FiTrash2, FiAlertTriangle, FiEdit } from "react-icons/fi";

import { getAPICall, postAPICall, putAPICall, deleteAPICall } from "../../api/api";
import Skeleton from "../../components/Skeleton";

import "../../style/adminSubjects.css";

// Helpers Functions
import { Validate } from "../../helper/validate";

// Types
import type { Subject, NewSubject, SubjectWithFaculties, ComponentCreateProps } from "../../constant/subjects";
import type { Faculty } from "../../constant/faculties";

// Components
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageSection, PageShell } from "../../components/PageLayout";
import { EmptyState } from "../../components/EmptyState";
import { ModalDialog } from "../../components/ModalDialog";

interface newAssignedFaculties {
subjectId: number | null;
facultiesId: number[] | null
}

// A faculty queued for removal from the selected subject
interface RemoveFacultyTarget {
    facultyId: number;
    facultyName: string;
}

export default function AdminSubjects() {
const [subjects, setSubjects] = useState<Subject[] | null>(null);
const [selectedSubject, setSelectedSubject] = useState<SubjectWithFaculties | null>(null);
const [unassignedFaculties, setUnassignedFaculties] = useState<Faculty[] | null>(null);
const [newAssignedFaculties, setNewAssignedFaculties] = useState<newAssignedFaculties | null>(null);
const [newSubject, setNewSubject] = useState<NewSubject>({
    name: "",
    code: "",
    unit: "",
    hasComponents: false,
    components: [],
});
const [loading, setLoading] = useState<boolean>(false);
const [isModalOpen, setIsModalOpen] = useState(false);
const [modalStatus, setModalStatus] = useState<"create" | "edit" | "assign" | null>(null);
const triggerRef = useRef<HTMLButtonElement>(null);

// Edit subject state (the subject being edited in the modal)
const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

// Delete subject confirmation dialog state
const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
const [deletingSubject, setDeletingSubject] = useState(false);
const deleteTriggerRef = useRef<HTMLButtonElement>(null);

// Remove-faculty confirmation dialog state
const [removeTarget, setRemoveTarget] = useState<RemoveFacultyTarget | null>(null);
const [removingFaculty, setRemovingFaculty] = useState(false);
const removeTriggerRef = useRef<HTMLButtonElement>(null);

//  Create Subject modal Functions & data
const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingSubject(null);
    triggerRef.current?.focus();
}, []);

// Handle input change for create subject modal
function handleSubjectCreateModalInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setNewSubject((prev) => ({ ...prev, [name]: value }));
}

// Handle toggle for hasComponents checkbox
function handleHasComponentsToggle() {
    setNewSubject((prev) => ({
        ...prev,
        hasComponents: !prev.hasComponents,
        components: !prev.hasComponents ? (prev.components ?? []) : [],
    }));
}

// Handle adding a new component
function handleAddComponent() {
    setNewSubject((prev) => ({
        ...prev,
        components: [
            ...(prev.components ?? []),
            { name: "", code: "", weight: 25 },
        ],
    }));
}

// Handle updating a component
function handleComponentChange(index: number, field: keyof ComponentCreateProps, value: string | number) {
    setNewSubject((prev) => {
        const components = [...(prev.components ?? [])];
        components[index] = { ...components[index]!, [field]: value };
        return { ...prev, components };
    });
}

// Handle removing a component
function handleRemoveComponent(index: number) {
    setNewSubject((prev) => ({
        ...prev,
        components: (prev.components ?? []).filter((_, i) => i !== index),
    }));
}

// Calculate total component weight
function getTotalComponentWeight(): number {
    return (newSubject.components ?? []).reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
}

// Handle form submission for creating a new subject
async function handleCreateModalForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!Validate(newSubject)) {
        return;
    }

    try {
        // Call API to create subject
        await postAPICall<NewSubject, null>('/subjects', newSubject);

        setNewSubject({ name: "", code: "", unit: "", hasComponents: false, components: [] });
        fetchSubjects();
        closeModal();
    }catch {
        // Error toast is handled by the axios interceptor in api.ts
    }
}

// Open the edit-subject modal pre-filled with the card's values.
// Components are loaded from the detail endpoint so the editor shows the
// real sub-components instead of an empty list (which used to be silently
// saved and confused admins working on composite subjects).
async function handleEditSubjectClick(subject: Subject) {
    setNewSubject({
        name: subject.name,
        code: subject.code,
        unit: String(subject.unit),
        hasComponents: subject.hasComponents ?? false,
        components: [],
    });
    setEditingSubject(subject);
    setModalStatus("edit");
    setIsModalOpen(true);

    if (!subject.hasComponents) return;

    try {
        const response = await getAPICall<SubjectWithFaculties>(`/subjects/${subject.id}/faculties`);
        const components = (response.data?.components ?? []).map(({ name, code, weight }) => ({
            name,
            code,
            weight,
        }));
        setNewSubject((prev) => ({ ...prev, components }));
    } catch {
        // Error toast is handled by the axios interceptor; the modal stays open
        // so name/code/unit can still be edited.
    }
}

// Handle form submission for editing an existing subject
async function handleEditModalForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!editingSubject) {
        return;
    }

    if (!Validate(newSubject)) {
        return;
    }

    try {
        await putAPICall<NewSubject, null>(`/subjects/${editingSubject.id}`, newSubject);
        await fetchSubjects();
        // Keep the detail view in sync if this subject is currently open.
        if (selectedSubject?.id === editingSubject.id) {
            await fetchSelectedSubjectDetails(editingSubject.id);
        }
        setNewSubject({ name: "", code: "", unit: "", hasComponents: false, components: [] });
        setEditingSubject(null);
        closeModal();
    } catch {
        // Error toast is handled by the axios interceptor in api.ts
    }
}

async function handleAssignModalForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSubject || !newAssignedFaculties) return;

    try {
        await postAPICall<newAssignedFaculties, null>(`/subjects/${selectedSubject.id}/assign-faculties`, newAssignedFaculties);
        await fetchUnassignedFaculties();
        await fetchSelectedSubjectDetails(selectedSubject.id);
        setNewAssignedFaculties(null);
        closeModal();
    } catch {
        // Error toast is handled by the axios interceptor in api.ts
    }
}

// Close the remove-faculty confirmation dialog
const closeRemoveConfirm = useCallback(() => setRemoveTarget(null), []);

// Close the delete-subject confirmation dialog
const closeDeleteConfirm = useCallback(() => setDeleteTarget(null), []);

// Confirm and execute deleting an unused subject (server blocks while referenced)
async function handleConfirmDeleteSubject() {
    if (!deleteTarget || deletingSubject) return;

    setDeletingSubject(true);
    try {
        await deleteAPICall<null, null>(`/subjects/${deleteTarget.id}`);
        await fetchSubjects();
        // If the deleted subject was open in the detail view, go back to the list.
        if (selectedSubject?.id === deleteTarget.id) {
            setSelectedSubject(null);
        }
        setDeleteTarget(null);
        deleteTriggerRef.current?.focus();
    } catch {
        // Error toast is handled by the axios interceptor; keep the dialog open to retry.
    } finally {
        setDeletingSubject(false);
    }
}

// Confirm and execute removing a faculty from the selected subject
async function handleConfirmRemoveFaculty() {
    if (!selectedSubject || !removeTarget || removingFaculty) return;

    setRemovingFaculty(true);
    try {
        await deleteAPICall<{ removed: boolean; warning: string | null }, null>(
            `/subjects/${selectedSubject.id}/faculties/${removeTarget.facultyId}`
        );
        // Refresh both the assigned list and the assign-modal pool so the
        // removed faculty immediately becomes assignable again.
        await fetchSelectedSubjectDetails(selectedSubject.id);
        await fetchUnassignedFaculties();
        setRemoveTarget(null);
        removeTriggerRef.current?.focus();
    } catch {
        // Error toast is handled by the axios interceptor; keep the dialog open to retry.
    } finally {
        setRemovingFaculty(false);
    }
}

// This function will fetch faculties that are not assigned to the selected subject
async function fetchUnassignedFaculties() {
    if (!selectedSubject) return;
    
    const response = await getAPICall<Faculty[]>(`/subjects/${selectedSubject.id}/unassigned-faculties`);
    setUnassignedFaculties(response.data ?? null);
}

// Handle checkbox change for assigning faculties to the selected subject
async function handleAssignFacultyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const {checked, value} = e.target;

    if(checked) {
        setNewAssignedFaculties((prev) => {
            const curent = prev ?? {
                subjectId: selectedSubject?.id ?? null,
                facultiesId: []
            }
            return {
                ...curent,
                facultiesId: [...(curent.facultiesId ?? []), Number(value)]
            }
        })
    }else {
        setNewAssignedFaculties((prev) => {
            const curent = prev ?? {
                subjectId: selectedSubject?.id ?? null,
                facultiesId: []
            }
            return {
                ...curent,
                facultiesId: (curent.facultiesId ?? []).filter((id) => id !== Number(value))
            }
        })
    }
}

// Handle subject selection to view details
async function handleSelectedSubject(e: React.MouseEvent<HTMLElement>) {
    const target = e.currentTarget;
    const subjectId = target.id;


    await fetchSelectedSubjectDetails(Number(subjectId));
}

// Fetch selected subject details along with assigned faculties
async function fetchSelectedSubjectDetails(subjectId: number) {
    try {
        setLoading(true);
        const response = await getAPICall<SubjectWithFaculties>(`/subjects/${subjectId}/faculties`);
        setSelectedSubject(response.data ?? null);
    } catch {
        // Error toast is handled by the axios interceptor in api.ts
    } finally {
        setLoading(false);
    }
  }

// Fetch subjects on component mount
useEffect(() => {
    fetchSubjects();
}, []);

// Fetch subjects function
async function fetchSubjects() {
    try {
        setLoading(true);

        const response = await getAPICall<Subject[]>('/subjects');
        setSubjects(response.data ?? null);
    } catch {
        // Error toast is handled by the axios interceptor in api.ts
    } finally {
        setLoading(false);
    }
}

// Render loading state
if (loading) {
    return (        <PageShell className="subjects" busy label="Loading subjects">
            <PageSection className="subjects__card" flush>
                <div className="subjects__header flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="subjects__heading min-w-0">
                        <h2 className="subjects__title text-base font-bold">Subject Records</h2>
                        <p className="subjects__subtitle mt-1 text-[0.8125rem]">Loading subjects…</p>
                    </div>
                </div>
                <div className="p-6">
                    <Skeleton count={4} lines={1} height="9.5rem" radius="0.75rem" grid="repeat(2, 1fr)" />
                </div>
            </PageSection>
        </PageShell>
    );
}

return (
    <PageShell className="subjects">
        <PageSection className="subjects__card" flush>
            <div className="subjects__header flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="subjects__heading min-w-0">
                    <h2 className="subjects__title text-base font-bold">Subject Records</h2>
                    <p className="subjects__subtitle mt-1 text-[0.8125rem]">Manage school subjects</p>
                </div>
                <div className="subjects__actions flex flex-wrap items-center gap-2">
                    {selectedSubject ? (
                        <button onClick={() => setSelectedSubject(null)} className="subjects__back inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold" aria-label="Back to subject list">
                            <FiArrowLeft /> <span className="text-sm font-bold">Back to List</span>
                        </button>
                      ) : (
                        <>
                        <span className="subjects__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                        {subjects?.length ?? 0} {subjects?.length === 1 ? "subject" : "subjects"}
                        </span>
                            <button
                                ref={triggerRef}
                                type="button"
                                className="subjects__add inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={() => (
                                    setModalStatus("create"),
                                    setIsModalOpen(true)
                                )}
                                aria-label="Open create subject form"
                            >
                                <FiPlus aria-hidden="true" />
                                <span className="hidden md:block">Add Subject</span>
                            </button>
                            <button
                                type="button"
                                className="subjects__refresh inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={() => fetchSubjects()}
                                aria-label="Refresh subject list"
                            >
                                <span className="subjects__refresh-icon" aria-hidden="true">⟳</span>
                                <span className="hidden md:block">Refresh</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
            
            {/* This is a simple grid of subject cards */}
            {!selectedSubject && (
                <div>
                    {subjects && subjects.length > 0 ? (
                        <div className="subjects__grid grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                            {subjects.map((subject) => (
                                <article className="subjects__item flex cursor-pointer flex-col overflow-hidden rounded-xl border" key={subject.id} id={String(subject.id)} onClick={handleSelectedSubject} tabIndex={0} aria-label={`View details for ${subject.name}`}>
                                    <div className="subjects__item-head flex items-start justify-between gap-3 p-5 pb-4">
                                        <div className="subjects__item-heading min-w-0">
                                            <span className="subjects__item-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Subject</span>
                                            <h3 className="subjects__item-name mt-1 truncate text-[1.0625rem] font-bold">{subject.name}</h3>
                                        </div>
                                        <div className="subjects__item-actions flex shrink-0 items-center gap-1.5">
                                            <button
                                                type="button"
                                                className="subjects__item-action inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditSubjectClick(subject);
                                                }}
                                                aria-label={`Edit ${subject.name}`}
                                                title="Edit subject"
                                            >
                                                <FiEdit />
                                            </button>
                                            <button
                                                type="button"
                                                className="subjects__item-action subjects__item-action--danger inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteTriggerRef.current = e.currentTarget;
                                                    setDeleteTarget(subject);
                                                }}
                                                aria-label={`Delete ${subject.name}`}
                                                title="Delete subject"
                                            >
                                                <FiTrash2 />
                                            </button>
                                            <span className="subjects__item-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg" aria-hidden="true">
                                                <FiBookOpen />
                                            </span>
                                        </div>
                                    </div>
                                    <div className="subjects__item-body flex flex-wrap items-center gap-6 p-4">
                                        <div className="subjects__item-stat flex min-w-0 flex-col">
                                            <span className="subjects__item-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subject Code</span>
                                            <span className="subjects__item-code text-sm font-bold">{subject.code}</span>
                                        </div>
                                        <div className="subjects__item-stat flex min-w-0 flex-col">
                                            <span className="subjects__item-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Units</span>
                                            <span className="subjects__item-unit text-sm font-bold">{subject.unit}</span>
                                        </div>
                                        <div className="subjects__item-stat flex min-w-0 flex-col">
                                            <span className="subjects__item-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subject ID</span>
                                            <span className="subjects__item-id font-mono text-[0.8125rem]">#{subject.id}</span>
                                        </div>
                                        {subject.hasComponents && (
                                            <div className="subjects__item-stat flex min-w-0 flex-col">
                                                <span className="subjects__item-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Type</span>
                                                <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-[0.6875rem] font-bold text-green-700">
                                                    <FiBookOpen size={10} />
                                                    Composite
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            className="subjects__empty"
                            icon={<FiBookOpen />}
                            title="No subjects found"
                            description="Subjects will appear here once they are created."
                        />
                    )}
                </div>
            )}

            {/* This is the selected subject details view */}
            {selectedSubject && (
                <div className="subjects__details">
                    {/* Hero banner */}
                    <div className="subjects__details-hero flex items-center justify-between gap-4 p-6">
                        <div className="subjects__details-main flex min-w-0 items-center gap-4">
                            <span className="subjects__details-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl" aria-hidden="true">
                                <FiBookOpen />
                            </span>
                            <div className="subjects__details-heading min-w-0">
                                <span className="subjects__details-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Subject</span>
                                <h3 className="subjects__details-title mt-1 truncate text-[1.375rem] font-bold">{selectedSubject.name}</h3>
                                <p className="subjects__details-subtitle mt-0.5 truncate text-[0.8125rem]">
                                    {selectedSubject.code} &middot; Subject #{selectedSubject.id}
                                </p>
                            </div>
                        </div>
                        <div className="subjects__details-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                            <span className="subjects__details-badge-count text-[1.375rem] font-bold leading-none">{selectedSubject.faculties?.length ?? 0}</span>
                            <span className="subjects__details-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Faculties</span>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="subjects__details-stats grid grid-cols-1 gap-3 border-b p-5 sm:grid-cols-3">
                        <div className="subjects__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                            <span className="subjects__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subject Code</span>
                            <span className="subjects__details-stat-value text-[0.9375rem] font-bold">{selectedSubject.code}</span>
                        </div>
                        <div className="subjects__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                            <span className="subjects__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Units</span>
                            <span className="subjects__details-stat-value text-[0.9375rem] font-bold">{selectedSubject.unit}</span>
                        </div>
                        <div className="subjects__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                            <span className="subjects__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Subject ID</span>
                            <span className="subjects__details-stat-value text-[0.9375rem] font-bold">#{selectedSubject.id}</span>
                        </div>
                    </div>

                    {/* Components section */}
                    {selectedSubject.hasComponents && selectedSubject.components && selectedSubject.components.length > 0 && (
                        <section className="subjects__components border-b p-5" aria-label="Sub-components">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h4 className="text-[0.9375rem] font-bold">Sub-Components</h4>
                                    <p className="mt-0.5 text-[0.8125rem]">This subject has {selectedSubject.components.length} sub-components</p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                                    <FiBookOpen size={12} />
                                    Composite Subject
                                </span>
                            </div>
                            <div className="data-table__wrap mt-3 rounded-xl">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="data-table__th data-table__th--center w-12">#</th>
                                            <th scope="col" className="data-table__th w-56">Name</th>
                                            <th scope="col" className="data-table__th w-24">Code</th>
                                            <th scope="col" className="data-table__th data-table__th--num w-24">Weight</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSubject.components.map((comp, index) => (
                                            <tr key={comp.id} className="data-table__row">
                                                <td className="data-table__td data-table__td--center data-table__td--mono w-12">{index + 1}</td>
                                                <td className="data-table__td data-table__td--primary">{comp.name}</td>
                                                <td className="data-table__td data-table__td--mono">{comp.code}</td>
                                                <td className="data-table__td data-table__td--num">{comp.weight}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* Assigned faculties table */}
                    <section className="subjects__faculties p-5" aria-label="Assigned faculties">
                        <div className="subjects__faculties-head flex items-start justify-between gap-4">
                            <div className="subjects__faculties-heading min-w-0">
                                <h4 className="subjects__faculties-title text-[0.9375rem] font-bold">Assigned Faculties</h4>
                                <p className="subjects__faculties-subtitle mt-1 text-[0.8125rem]">Faculties currently handling {selectedSubject.name}</p>
                            </div>
                            <div className="subjects__faculties-actions flex items-center gap-2">
                                <span className="subjects__faculties-count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">{(selectedSubject.faculties ?? []).length} faculty{(selectedSubject.faculties ?? []).length === 1 ? "" : "s"}</span>

                                <button className="subjects__faculties-button inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold" onClick={() => (
                                    setModalStatus("assign"),
                                    fetchUnassignedFaculties(),
                                    setIsModalOpen(true)
                                )} >
                                    <FiUsers />
                                    <span className="subjects__faculties-button-text">Assign Faculty</span>
                                </button>
                            </div>
                        </div>

                        {selectedSubject.faculties && selectedSubject.faculties.length > 0 ? (
                            <div className="data-table__wrap mt-4 rounded-xl">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="data-table__th data-table__th--center w-12">#</th>
                                            <th scope="col" className="data-table__th w-56">Faculty Name</th>
                                            <th scope="col" className="data-table__th w-24">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSubject.faculties.map((faculty, index) => (
                                            <tr key={`${faculty.id}-${index}`} className="data-table__row">
                                                <td className="data-table__td data-table__td--center data-table__td--mono w-12">{index + 1}</td>
                                                <td className="data-table__td">
                                                    <span className="data-table__value">{faculty.name}</span>
                                                    <span className="data-table__sub">Faculty ID #{faculty.id}</span>
                                                </td>
                                                <td className="data-table__td">
                                                    <button
                                                        type="button"
                                                        className="subjects__faculties-remove inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                                        onClick={(e) => {
                                                            // Capture the clicked button so focus returns to it when the dialog closes
                                                            removeTriggerRef.current = e.currentTarget;
                                                            setRemoveTarget({ facultyId: faculty.id, facultyName: faculty.name });
                                                        }}
                                                        aria-label={`Remove ${faculty.name} from ${selectedSubject.name}`}
                                                        title="Remove from subject"
                                                    >
                                                        <FiTrash2 aria-hidden="true" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="subjects__faculties-empty mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
                                <span className="subjects__faculties-empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                    <FiUsers />
                                </span>
                                <p className="subjects__faculties-empty-title mt-3 text-sm font-bold">No faculties assigned</p>
                                <p className="subjects__faculties-empty-text mt-1 text-[0.8125rem]">Faculties will appear here once they are assigned to this subject.</p>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </PageSection>


        {/* Create/Edit/Assign subject Modal */}
        <ModalDialog
            open={isModalOpen}
            onClose={closeModal}
            labelledById="subjects-modal-title"
            className="subjects-modal__panel w-full max-w-[36rem] overflow-y-auto rounded-3xl bg-white shadow-xl"
        >
                    <header className="subjects-modal__header flex items-start justify-between gap-4 p-6 pb-5">
                        {/* Create Subject Heading */}
                        {modalStatus === "create" && (
                            <div className="subjects-modal__heading">
                                <span className="subjects-modal__eyebrow uppercase tracking-[0.08em]">New record</span>
                                <h3 id="subjects-modal-title" className="subjects-modal__title mt-0.5 text-xl font-bold">Create Subject</h3>
                                <p className="subjects-modal__subtitle mt-1 text-[0.8125rem]">Add a new subject to the curriculum</p>
                            </div>
                        )}

                        {/* Edit Subject Heading */}
                        {modalStatus === "edit" && (
                            <div className="subjects-modal__heading">
                                <span className="subjects-modal__eyebrow uppercase tracking-[0.08em]">Edit record</span>
                                <h3 id="subjects-modal-title" className="subjects-modal__title mt-0.5 text-xl font-bold">Edit Subject</h3>
                                <p className="subjects-modal__subtitle mt-1 text-[0.8125rem]">Update the subject details</p>
                            </div>
                        )}

                        {/* Assign Subject Heading */}
                        {modalStatus === "assign" && (
                            <div className="subjects-modal__heading">
                                <span className="subjects-modal__eyebrow uppercase tracking-[0.08em]">Assign</span>
                                <h3 id="subjects-modal-title" className="subjects-modal__title mt-0.5 text-xl font-bold">Assign Subject</h3>
                                <p className="subjects-modal__subtitle mt-1 text-[0.8125rem]">Assign a subject to a faculty</p>
                            </div>
                        )}
                        <button type="button" className="subjects-modal__close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg" onClick={closeModal} aria-label="Close modal">
                            <FiX aria-hidden="true" />
                        </button>
                    </header>

                    <form className="subjects-form p-6" onSubmit={modalStatus === "create" ? handleCreateModalForm : modalStatus === "edit" ? handleEditModalForm : modalStatus === "assign" ? handleAssignModalForm : undefined} noValidate>

                        {/* Create / Edit Subject Form */}
                        {(modalStatus === "create" || modalStatus === "edit") && (
                            <div className="flex flex-col gap-4">
                                <div className="subjects-form__grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="subjects-form__field flex flex-col gap-1.5">
                                        <label htmlFor="subject-name" className="subjects-form__label text-[0.8125rem] font-semibold">Subject Name</label>
                                        <input
                                            id="subject-name"
                                            type="text"
                                            className="subjects-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                            placeholder="Mathematics"
                                            autoFocus
                                            name="name"
                                            onChange={handleSubjectCreateModalInputChange}
                                            value={newSubject.name}
                                        />
                                    </div>
                                    <div className="subjects-form__field flex flex-col gap-1.5">
                                        <label htmlFor="subject-code" className="subjects-form__label text-[0.8125rem] font-semibold">Subject Code</label>
                                        <input
                                            id="subject-code"
                                            type="text"
                                            className="subjects-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                            placeholder="MATH101"
                                            name="code"
                                            onChange={handleSubjectCreateModalInputChange}
                                            value={newSubject.code}
                                        />
                                    </div>
                                    <div className="subjects-form__field flex flex-col gap-1.5">
                                        <label htmlFor="subject-unit" className="subjects-form__label text-[0.8125rem] font-semibold">Units</label>
                                        <input
                                            id="subject-unit"
                                            type="number"
                                            min={1}
                                            max={10}
                                            className="subjects-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                            placeholder="3"
                                            name="unit"
                                            onChange={handleSubjectCreateModalInputChange}
                                            value={newSubject.unit}
                                        />
                                    </div>
                                </div>

                                {/* Has Components Toggle */}
                                <div className="subjects-form__field flex items-center gap-3 rounded-lg border p-3">
                                    <input
                                        type="checkbox"
                                        id="hasComponents"
                                        checked={newSubject.hasComponents ?? false}
                                        onChange={handleHasComponentsToggle}
                                        className="h-4 w-4 rounded"
                                    />
                                    <label htmlFor="hasComponents" className="text-[0.8125rem] font-semibold">
                                        Has Sub-Components
                                    </label>
                                    <span className="text-[0.75rem] text-neutral-500">
                                        (e.g., MAPEH → Music, Arts, PE, Health)
                                    </span>
                                </div>

                                {/* Components Form */}
                                {newSubject.hasComponents && (
                                    <div className="subjects-form__components rounded-lg border p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h4 className="text-[0.8125rem] font-bold">Sub-Components</h4>
                                            <span className={`text-[0.75rem] font-semibold ${getTotalComponentWeight() === 100 ? 'text-green-600' : 'text-orange-500'}`}>
                                                Total: {getTotalComponentWeight()}%{getTotalComponentWeight() !== 100 ? ' (must equal 100%)' : ' ✓'}
                                            </span>
                                        </div>

                                        {(newSubject.components ?? []).length === 0 ? (
                                            <p className="text-[0.75rem] text-neutral-500">
                                                No components added yet. Click "Add Component" to start.
                                            </p>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {(newSubject.components ?? []).map((comp, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Name (e.g., Music)"
                                                            value={comp.name}
                                                            onChange={(e) => handleComponentChange(index, 'name', e.target.value)}
                                                            className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Code (e.g., MAPEH-M)"
                                                            value={comp.code}
                                                            onChange={(e) => handleComponentChange(index, 'code', e.target.value)}
                                                            className="w-28 rounded-lg border px-3 py-2 text-sm"
                                                        />
                                                        <input
                                                            type="number"
                                                            placeholder="%"
                                                            min={1}
                                                            max={100}
                                                            value={comp.weight}
                                                            onChange={(e) => handleComponentChange(index, 'weight', Number(e.target.value))}
                                                            className="w-16 rounded-lg border px-3 py-2 text-sm"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveComponent(index)}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                                                            aria-label="Remove component"
                                                        >
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleAddComponent}
                                            className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-blue-600 hover:text-blue-700"
                                        >
                                            <FiPlus size={12} />
                                            Add Component
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Assign Faculty Form */}
                        {modalStatus === "assign" && (
                            <div className="unassign-faculty-form flex flex-col gap-3.5">
                                <div className="unassign-faculty-form__head flex items-center justify-between gap-4">
                                    <p className="unassign-faculty-form__hint text-[0.8125rem]">
                                        Select faculties to assign to <strong className="font-bold">{selectedSubject?.name}</strong>
                                    </p>
                                    <span className="unassign-faculty-form__count shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                        {unassignedFaculties === null ? "…" : `${unassignedFaculties.length} available`}
                                    </span>
                                </div>

                                {unassignedFaculties === null ? (
                                    <div className="unassign-faculty-form__loading flex items-center justify-center gap-2.5 rounded-xl border border-dashed px-4 py-6 text-[0.8125rem]" aria-busy="true">
                                        <span className="unassign-faculty-form__loading-spinner h-4 w-4 shrink-0 rounded-full border-2" aria-hidden="true" />
                                        Loading unassigned faculties…
                                    </div>
                                ) : unassignedFaculties.length > 0 ? (
                                    <div className="unassign-faculty-form__grid grid grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                                        {unassignedFaculties.map((faculty) => (
                                            <div key={faculty.id} className="unassign-faculty-form__field rounded-lg border">
                                                <label className="unassign-faculty-form__label flex cursor-pointer items-center gap-2.5 p-2.5 text-sm font-medium">
                                                    <input
                                                        type="checkbox"
                                                        name="selectedFaculties"
                                                        value={faculty.id}
                                                        onChange={handleAssignFacultyChange}
                                                    />
                                                    {faculty.fullname}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="unassign-faculty-form__empty flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
                                        <span className="unassign-faculty-form__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                            <FiUsers />
                                        </span>
                                        <p className="unassign-faculty-form__empty-title mt-3 text-sm font-bold">No unassigned faculties</p>
                                        <p className="unassign-faculty-form__empty-text mt-1 text-[0.8125rem]">Every faculty is already assigned to this subject.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <footer className="subjects-form__footer mt-6 flex justify-end gap-3 border-t pt-5">
                            <button type="button" className="subjects-form__cancel rounded-lg border px-4 py-2.5 text-sm font-semibold" onClick={closeModal}>
                                Cancel
                            </button>
                            <button type="submit" className="subjects-form__submit inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold">
                                {modalStatus === "create" && "Create Subject"}
                                {modalStatus === "edit" && "Save Changes"}
                                {modalStatus === "assign" && "Assign Subject"}
                            </button>
                        </footer>
                    </form>
            </ModalDialog>

            {/* Remove faculty confirmation dialog */}
        <ConfirmDialog
            open={removeTarget !== null}
            title="Remove faculty from subject?"
            description={
                removeTarget && selectedSubject
                    ? `${removeTarget.facultyName} will no longer be assignable to ${selectedSubject.name}. This cannot be undone — reassign them later if needed.`
                    : "This will remove the faculty from the subject."
            }
            confirmLabel="Remove"
            confirmIcon={<FiTrash2 aria-hidden="true" />}
            icon={<FiAlertTriangle aria-hidden="true" />}
            tone="danger"
            pending={removingFaculty}
            pendingLabel="Removing…"
            onConfirm={handleConfirmRemoveFaculty}
            onClose={closeRemoveConfirm}
            triggerRef={removeTriggerRef}
        />

        {/* Delete subject confirmation dialog */}
        <ConfirmDialog
            open={deleteTarget !== null}
            title="Delete subject?"
            description={
                deleteTarget
                    ? `${deleteTarget.name} will be permanently deleted. This only works when the subject is not taught in any class, assigned to any faculty, or on any enrollment record — the app will tell you what's blocking it if it is. Past student records keep their own copy of the subject name, so they are not affected.`
                    : "This subject will be permanently deleted."
            }
            confirmLabel="Delete"
            confirmIcon={<FiTrash2 aria-hidden="true" />}
            icon={<FiAlertTriangle aria-hidden="true" />}
            tone="danger"
            pending={deletingSubject}
            pendingLabel="Deleting…"
            onConfirm={handleConfirmDeleteSubject}
            onClose={closeDeleteConfirm}
            triggerRef={deleteTriggerRef}
        />    </PageShell>
    );
}
