import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus, FiX, FiArrowLeft, FiEdit, FiTrash2, FiHome, FiUsers, FiBookOpen, FiUserPlus, FiUserCheck, FiRefreshCw, FiMoreVertical, FiEye } from "react-icons/fi";

import { 
    getAPICall, 
    postAPICall, 
    patchAPICall,
    putAPICall,
    deleteAPICall
} from "../../api/api";
import Skeleton from "../../components/Skeleton";
import { toast } from "../../helper/toast";

import "../../style/adminClassrooms.css";

import type { 
ClassroomResponseProps,
ClassroomWithStudentsProps, 
ClassroomFacultiesWithSubjectProps, 
subjectFacultiesProps, 
subjectNotInClassProps,
EditSubjectFacultyProps

} from "../../constant/classrooms.js";

import type { Faculty } from "../../constant/faculties.js";

// Helper functions
import { Validate } from "../../helper/validate.js";

import useClassroom from "../../hooks/useClassroom.js";

// Components
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageSection, PageShell } from "../../components/PageLayout";
import { EmptyState } from "../../components/EmptyState";
import { ModalDialog } from "../../components/ModalDialog";

// Main component
export default function AdminClassrooms() {
// Classsroom data states
// const [classrooms, setClassrooms] = useState<ClassroomResponseProps[] | null>(null);
const {classrooms, refetchClassroom, loading, setLoading} = useClassroom<ClassroomResponseProps[]>()
const [classroomFacultiesWithSubject, setClassroomFacultiesWithSubject] = useState<ClassroomFacultiesWithSubjectProps[] | null>(null);
const [newClassroom, setNewClassroom] = useState<Omit<ClassroomResponseProps, "id" | "gradeLevel" | "totalStudent"> & { gradeLevel: string }>({
section: "",
gradeLevel: ""
});

// Subjects data states
const [selectedClassroom, setSelectedClassroom] = useState<ClassroomWithStudentsProps | null>(null);
const [subjectFaculties, setSubjectFaculties] = useState<subjectFacultiesProps[] | null>(null);
const [subjectsNotInClass, setSubjectsNotInClass] = useState<subjectNotInClassProps[] | null>(null);
const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
const [newClassroomSubjectAdded, setNewClassroomSubjectAdded] = useState<{classId: number,subjectId: number, facultyId: number}[] | null>(null);
const [editSubjectFaculty, setEditSubjectFaculty] = useState<EditSubjectFacultyProps | null>(null);

// Class adviser states
const [allFaculties, setAllFaculties] = useState<Faculty[] | null>(null);
const [adviserSelection, setAdviserSelection] = useState<number | null>(null);
const [assigningAdviser, setAssigningAdviser] = useState(false);
// facultyId -> section name of the class they already advise (one class per faculty)
const [adviserTakenBy, setAdviserTakenBy] = useState<Record<number, string>>({});

// Edit classroom state (the classroom being edited in the modal)
const [editingClassroom, setEditingClassroom] = useState<ClassroomResponseProps | null>(null);

// Archive classroom confirmation dialog states
const [archiveTarget, setArchiveTarget] = useState<ClassroomResponseProps | null>(null);
const [archiving, setArchiving] = useState(false);
const archiveTriggerRef = useRef<HTMLButtonElement>(null);

// Conditional rendering states
const [pageStatus, setPageStatus] = useState<"view-students" | "view-subjects">("view-students");
const [modalStatus, setModalStatus] = useState<"create-class" | "edit-class" | "create-subject" | "edit-subject-faculties" | "assign-adviser" | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);
const triggerRef = useRef<HTMLButtonElement>(null);

// Delete subject confirmation dialog states
const [deleteTarget, setDeleteTarget] = useState<{ subjectId: number; facultyId: number; classId: number } | null>(null);
const [deletingSubject, setDeletingSubject] = useState(false);
const deleteTriggerRef = useRef<HTMLButtonElement>(null);

// Student removal states
const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
const [removingStudent, setRemovingStudent] = useState(false);
const [removeTarget, setRemoveTarget] = useState<{ enrollmentId: number; studentName: string } | null>(null);
const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
const removeTriggerRef = useRef<HTMLButtonElement>(null);

// Clear all students from classroom states
const [clearClassConfirm, setClearClassConfirm] = useState(false);
const [clearingClass, setClearingClass] = useState(false);

// Card dropdown menu state
const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);

// Close card dropdown on outside click
useEffect(() => {
    if (cardMenuOpen === null) return;
    function handleClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest(".classrooms__item-menu-wrap")) {
            setCardMenuOpen(null);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
}, [cardMenuOpen]);

// Selected classroom Functions
function handleSelectedClassroom(e: React.MouseEvent<HTMLElement>) {
const target = e.currentTarget;
const classroomId = target.id;

(async () => {
try {
    setLoading(true);
    const response = await getAPICall<ClassroomWithStudentsProps>(`/class/${classroomId}/students`);

    setSelectedClassroom(response.data ?? null);
}catch {
    // Error toast is handled by the axios interceptor in api.ts
}finally {
    setLoading(false);
}
})()

}

// Create Classroom modal Functions & data
const closeModal = useCallback(() => {
setIsModalOpen(false);
setSelectedSubjectIds([]);
triggerRef.current?.focus();
}, []);

function handleModalClose() {
closeModal();
setNewClassroom({section: "", gradeLevel: ""});
setSelectedSubjectIds([]);
setNewClassroomSubjectAdded([]);
setSubjectFaculties([]);
setModalStatus(null);
setEditSubjectFaculty(null);
setAdviserSelection(null);
setAllFaculties(null);
setAdviserTakenBy({});
setEditingClassroom(null);
setSubjectsNotInClass(null);
}

// Open the assign-adviser modal: loads the faculty list and preselects the current adviser.
// Also builds the map of faculties who already advise another class (one class per faculty).
async function handleAssignAdviserClick() {
if (!selectedClassroom) return;

try {
    const [facultiesResponse, classroomsResponse] = await Promise.all([
        // Adviser candidates are teaching faculty only: a register faculty
        // member must never appear in this dropdown (plan §6.2).
        getAPICall<Faculty[]>("/faculties?role=teacher"),
        getAPICall<ClassroomResponseProps[]>("/classrooms")
    ]);
    setAllFaculties(facultiesResponse.data ?? null);
    // A faculty counts as "taken" only when they advise a DIFFERENT classroom.
    const taken: Record<number, string> = {};
    for (const classroom of classroomsResponse.data ?? []) {
        if (
            classroom.id !== selectedClassroom.id &&
            classroom.adviserId != null &&
            classroom.adviserFullname
        ) {
            taken[classroom.adviserId] = classroom.section;
        }
    }
    setAdviserTakenBy(taken);
} catch {
    setAllFaculties(null);
    setAdviserTakenBy({});
}
setAdviserSelection(selectedClassroom.adviserId ?? null);
setModalStatus("assign-adviser");
setIsModalOpen(true);
}

// Submit the adviser assignment (facultyId null clears the adviser)
async function handleSubmitOfAssignAdviser(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();
if (!selectedClassroom || assigningAdviser) return;

setAssigningAdviser(true);
try {
    await putAPICall<{ facultyId: number | null }, null>(
        `/classrooms/${selectedClassroom.id}/adviser`,
        { facultyId: adviserSelection }
    );
    // Update the detail view in place and refresh the classroom list cards.
    const faculty = (allFaculties ?? []).find((t) => t.id === adviserSelection) ?? null;
    setSelectedClassroom((prev) => (prev ? { ...prev, adviserId: adviserSelection, adviserFullname: faculty?.fullname ?? null } : prev));
    refetchClassroom();
    handleModalClose();
} catch {
    // Error toast is handled by the axios interceptor; keep the modal open to retry.
} finally {
    setAssigningAdviser(false);
}
}



// Handle form submission for creating a new classroom
async function handleSubmitOfCreateClassroomModalForm(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();

// Only the create-class form is wired to the API; the subject modals are handled separately.
if (modalStatus !== "create-class") {
return;
}

if (!Validate(newClassroom)) {
return;
}
try {
await postAPICall<Omit<ClassroomResponseProps, "id" | "gradeLevel" | "totalStudent"> & { gradeLevel: string }, null>("/classrooms", newClassroom);
refetchClassroom()
setNewClassroom({ section: "", gradeLevel: "" });
handleModalClose();
}catch {
// Error toast is handled by the axios interceptor in api.ts
}
}

// Open the edit-classroom modal pre-filled with the card's values
function handleEditClassroomClick(classroom: ClassroomResponseProps) {
setNewClassroom({ section: classroom.section, gradeLevel: String(classroom.gradeLevel) });
setEditingClassroom(classroom);
setModalStatus("edit-class");
setIsModalOpen(true);
}

// Handle form submission for editing an existing classroom
async function handleSubmitOfEditClassroomModalForm(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();

if (modalStatus !== "edit-class" || !editingClassroom) {
return;
}

if (!Validate(newClassroom)) {
return;
}

try {
await putAPICall<Omit<ClassroomResponseProps, "id" | "gradeLevel" | "totalStudent"> & { gradeLevel: string }, null>(
    `/classrooms/${editingClassroom.id}`,
    newClassroom
);
refetchClassroom();
handleModalClose();
}catch {
// Error toast is handled by the axios interceptor in api.ts
}
}

// Handle input changes for the new classroom form
function handleNewClassroomInputChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
const { name, value } = e.target;
setNewClassroom((prev) => ({
...prev,
[name]: value
}));
}

// Fetch classroom faculties with subjects
async function fetchClassroomFacultiesWithSubject() {
if (!selectedClassroom) return;

const response = await getAPICall<ClassroomFacultiesWithSubjectProps[]>(`/classrooms/${selectedClassroom.id}/faculties-subject`);
setClassroomFacultiesWithSubject(response.data ?? null);
}

// Handle the click event for changing the subject faculty
async function handleChangeSubjectFacultyClickEvent(subjectId: number, classroomId: number) {
await fetchSubjectFaculties(Number(subjectId), Number(classroomId));
setModalStatus("edit-subject-faculties");
setIsModalOpen(true);
}

const closeDeleteConfirm = useCallback(() => setDeleteTarget(null), []);

// handle the delete subject from classroom confirm action
async function handleConfirmDeleteSubject() {
    if (!deleteTarget || deletingSubject) return;

    setDeletingSubject(true);
    try {
        await deleteAPICall<null, null>(`/classrooms/${deleteTarget.classId}/subjects/${deleteTarget.subjectId}/faculties/${deleteTarget.facultyId}`);
        fetchClassroomFacultiesWithSubject();
        setDeleteTarget(null);
        deleteTriggerRef.current?.focus();
    } catch {
        // Error toast is handled by the axios interceptor in api.ts; keep the dialog open to retry.
    } finally {
        setDeletingSubject(false);
    }
}

// The subject being deleted, used to show its name in the confirmation dialog
const pendingDeleteSubject = deleteTarget
    ? (classroomFacultiesWithSubject ?? []).find(
        (item) => item.subjectId === deleteTarget.subjectId && item.facultyId === deleteTarget.facultyId,
    ) ?? null
    : null;

const closeArchiveConfirm = useCallback(() => setArchiveTarget(null), []);

// handle the archive classroom confirm action
async function handleConfirmArchiveClassroom() {
    if (!archiveTarget || archiving) return;

    setArchiving(true);
    try {
        await deleteAPICall<null, null>(`/classrooms/${archiveTarget.id}`);
        refetchClassroom();
        setArchiveTarget(null);
        archiveTriggerRef.current?.focus();
    } catch {
        // Error toast is handled by the axios interceptor in api.ts; keep the dialog open to retry.
    } finally {
        setArchiving(false);
    }
}

// ================= Student Removal Handlers =================

const closeRemoveConfirm = useCallback(() => setRemoveTarget(null), []);
const closeBulkRemoveConfirm = useCallback(() => setBulkRemoveOpen(false), []);

// Toggle selection of a single student
function handleToggleStudentSelection(enrollmentId: number) {
    setSelectedStudentIds((prev) =>
        prev.includes(enrollmentId) ? prev.filter((id) => id !== enrollmentId) : [...prev, enrollmentId]
    );
}

// Toggle select all students
function handleToggleSelectAll() {
    if (!selectedClassroom?.students) return;
    const allIds = selectedClassroom.students.map((s) => s.enrollmentId);
    setSelectedStudentIds((prev) =>
        prev.length === allIds.length ? [] : allIds
    );
}

// Open single remove confirmation dialog
function handleRemoveStudentClick(enrollmentId: number, studentName: string) {
    setRemoveTarget({ enrollmentId, studentName });
}

// Confirm single student removal
async function handleConfirmRemoveStudent() {
    if (!removeTarget || !selectedClassroom || removingStudent) return;

    setRemovingStudent(true);
    try {
        await deleteAPICall(`/classrooms/${selectedClassroom.id}/enrollments`, {
            enrollmentIds: [removeTarget.enrollmentId]
        });
        // Refresh the classroom data
        const response = await getAPICall<ClassroomWithStudentsProps>(`/class/${selectedClassroom.id}/students`);
        setSelectedClassroom(response.data ?? null);
        setSelectedStudentIds((prev) => prev.filter((id) => id !== removeTarget.enrollmentId));
        setRemoveTarget(null);
        removeTriggerRef.current?.focus();
    } catch {
        // Error toast is handled by the axios interceptor in api.ts
    } finally {
        setRemovingStudent(false);
    }
}

// Open bulk remove confirmation dialog
function handleBulkRemoveClick() {
    if (selectedStudentIds.length === 0) return;
    setBulkRemoveOpen(true);
}

// Confirm bulk removal
async function handleConfirmBulkRemove() {
    if (!selectedClassroom || selectedStudentIds.length === 0 || removingStudent) return;

    setRemovingStudent(true);
    try {
        await deleteAPICall(`/classrooms/${selectedClassroom.id}/enrollments`, {
            enrollmentIds: selectedStudentIds
        });
        // Refresh the classroom data
        const response = await getAPICall<ClassroomWithStudentsProps>(`/class/${selectedClassroom.id}/students`);
        setSelectedClassroom(response.data ?? null);
        setSelectedStudentIds([]);
        setBulkRemoveOpen(false);
    } catch {
        // Error toast is handled by the axios interceptor in api.ts
    } finally {
        setRemovingStudent(false);
    }
}

// Clear all students from the selected classroom
async function handleConfirmClearClass() {
    if (!selectedClassroom || clearingClass) return;

    setClearingClass(true);
    try {
        await deleteAPICall(`/classrooms/${selectedClassroom.id}/enrollments/clear`);
        toast.success(`All students cleared from ${selectedClassroom.section}.`);
        // Refresh the classroom data
        const response = await getAPICall<ClassroomWithStudentsProps>(`/class/${selectedClassroom.id}/students`);
        setSelectedClassroom(response.data ?? null);
        setSelectedStudentIds([]);
        setClearClassConfirm(false);
        refetchClassroom();
    } catch {
        // Error toast handled by API interceptor
    } finally {
        setClearingClass(false);
    }
}

// Derived: select-all state
const allStudentsSelected = selectedClassroom?.students
    ? selectedStudentIds.length === selectedClassroom.students.length && selectedClassroom.students.length > 0
    : false;

// fetch subject faculties for a specific subject in a classroom
async function fetchSubjectFaculties(subjectId: number, classroomId: number) {
    const response = await getAPICall<subjectFacultiesProps[]>(`/subjects/${subjectId}/classrooms/${classroomId}/assigned-faculties`);
    setSubjectFaculties(response.data ?? null);
}

// Handle the change event for selecting a new faculty for a subject in the edit-subject-faculties modal
function handleEditSubjectFacultyChangeEvent(e: React.ChangeEvent<HTMLInputElement>, subjectId: number) {
  const {value, checked} = e.target;

  setEditSubjectFaculty(
    checked ? { subjectId, facultyId: Number(value) } : null
  )
}

// Handle form submission for editing subject faculties
async function handleSubmitOfEditSubjectFaculties(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();

if(!selectedClassroom || !editSubjectFaculty) return;

await patchAPICall<EditSubjectFacultyProps, null>(`/classrooms/${selectedClassroom?.id}/subjects`, editSubjectFaculty);
handleModalClose();
fetchClassroomFacultiesWithSubject();
}

// Fetch subjects not in class
async function subjectsNotInClassFunc() {
if (!selectedClassroom) return;
const response = await getAPICall<subjectNotInClassProps[]>(`/subjects/classrooms/${selectedClassroom.id}/faculties`);

setSubjectsNotInClass(response.data ?? null);
setSelectedSubjectIds([]);
setIsModalOpen(true);
setModalStatus("create-subject");
}

// Track selected subjects in the add-subject modal
function handleSubjectSelectionChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
const { checked, value } = e.target;
const subjectId = Number(value);
setSelectedSubjectIds((prev) =>
checked ? [...prev, subjectId] : prev.filter((id) => id !== subjectId)
);

setNewClassroomSubjectAdded((prev) => {
if (!selectedClassroom) return prev;
return checked ? [...(prev ?? [])] : (prev ?? []).filter((item) => item.subjectId !== subjectId);
})
}

// Handle the selection of a faculty for a new classroom subject
function handleNewClassroomSubjectAddedChangeEvent(e: React.ChangeEvent<HTMLInputElement>, subjectId: number) {
if(!selectedClassroom) return;

const { checked, value } = e.target;
const facultyId = Number(value);


if(checked) {
setNewClassroomSubjectAdded((prev) => {
  const existing = prev?.find((item) => item.subjectId === subjectId);
  if(existing) {
      return prev?.map((item) => item.subjectId === subjectId ? { ...item, facultyId } : item) ?? null;
  } else {
      return [...(prev ?? []), { classId: selectedClassroom.id, subjectId, facultyId }];
  }
})
}else {
setNewClassroomSubjectAdded((prev) =>
(prev ?? []).filter((item) => item.subjectId !== subjectId)
)
}
} 

// handle form submission for adding new classroom subjects
async function handleSubmitOfNewClassroomSubjects(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();
if (!selectedClassroom) return;

// A subject only lands in `newClassroomSubjectAdded` once its faculty radio
// is picked. If a subject was checked but has no faculty, it would otherwise
// be silently dropped — abort with a clear message instead.
if (selectedSubjectIds.length === 0) {
  toast.warning("Select at least one subject to add.");
  return;
}
const needsFaculty = selectedSubjectIds.filter((subjectId) =>
  !(newClassroomSubjectAdded ?? []).some((item) => item.subjectId === subjectId && item.facultyId)
);
if (needsFaculty.length > 0) {
  toast.warning(
    `Assign a faculty for ${needsFaculty.length === 1 ? "the selected subject" : `${needsFaculty.length} selected subjects`} before adding.`
  );
  return;
}

try {
  await postAPICall("/classrooms/subjects", {
      newSubjects: newClassroomSubjectAdded
  });
  // Reset the form
  setNewClassroomSubjectAdded(null);
  setSelectedSubjectIds([]);
  setIsModalOpen(false);
  fetchClassroomFacultiesWithSubject();
} catch {
  // Error toast handled by API interceptor
}
}


// Loading State
if (loading) {
return (
<PageShell className="classrooms" busy label="Loading classrooms">
    <PageSection className="classrooms__card" flush>
        <div className="classrooms__header flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="classrooms__heading min-w-0">
                <h2 className="classrooms__title text-base font-bold">Classroom Records</h2>
                <p className="classrooms__subtitle mt-1 text-[0.8125rem]">Loading classrooms…</p>
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
<PageShell className="classrooms">
{/* classroom list  */}
<PageSection className="classrooms__card" flush>
    <div className="classrooms__header flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="classrooms__heading min-w-0">
            <div className="flex gap-2 items-center">
                {selectedClassroom && (
                    <button
                        type="button"
                        className="classrooms__back inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                        onClick={() => (
                            setSelectedClassroom(null),
                            setClassroomFacultiesWithSubject(null),
                            setPageStatus("view-students")
                        )}
                        aria-label="Back to classroom list"
                    >
                        <FiArrowLeft />
                    </button>
                )}
                <h2 className="classrooms__title text-base font-bold">Classroom Records</h2>
            </div>
            <p className="classrooms__subtitle mt-1 text-[0.8125rem]">Manage school classrooms</p>
        </div>
        <div className="classrooms__actions flex flex-wrap items-center gap-2">
            

            {selectedClassroom ? (
                <div className="flex items-center gap-2">
                    {(selectedClassroom.students?.length ?? 0) > 0 && (
                        <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-[0.8125rem] font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={clearingClass}
                            onClick={() => setClearClassConfirm(true)}
                        >
                            {clearingClass ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiTrash2 aria-hidden="true" />}
                            {clearingClass ? "Clearing…" : `Clear All (${selectedClassroom.students.length})`}
                        </button>
                    )}
                </div>
            ) : (
            <>
                <span className="classrooms__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">{classrooms?.length ?? 0} {classrooms?.length === 1 ? "classroom" : "classrooms"}</span>
                <button
                    ref={triggerRef}
                    type="button"
                    className="classrooms__add inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                    onClick={() => (
                        setIsModalOpen(true),
                        setModalStatus("create-class")
                    )}
                    aria-label="Open create classroom form"
                >
                    <FiPlus aria-hidden="true" />
                    <span className="hidden md:block">Add Classroom</span>
                </button>

                <button
                    type="button"
                    className="classrooms__refresh inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                    onClick={() => refetchClassroom()}
                    aria-label="Refresh classroom list"
                >
                    <span className="classrooms__refresh-icon" aria-hidden="true">⟳</span>
                    <span className="hidden md:block">Refresh</span>
                </button>
                
            </>
        )}
        </div>
    </div>

    {/*=================== Classroom Card ========================*/}
    {!selectedClassroom && (
        <div>
            {classrooms && classrooms.length > 0 ? (
                <div className="classrooms__grid grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                    {classrooms.map((classroom) => (
                        <article className="classrooms__item flex cursor-pointer flex-col overflow-hidden rounded-xl border" key={classroom.id} id={String(classroom.id)} onClick={handleSelectedClassroom}>
                            <div className="classrooms__item-head flex items-start justify-between gap-3 p-5 pb-4">
                                <div className="classrooms__item-heading min-w-0">
                                    <span className="classrooms__item-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Grade {classroom.gradeLevel}</span>
                                    <h3 className="classrooms__item-name mt-1 truncate text-[1.0625rem] font-bold">{classroom.section}</h3>
                                    <div className="classrooms__item-adviser-wrap mt-2">
                                        <span className="classrooms__item-adviser-name text-[0.8125rem] font-semibold">
                                            {classroom.adviserFullname || ""}
                                        </span>
                                        {!classroom.adviserFullname && (
                                            <span className="classrooms__item-adviser-name classrooms__item-adviser--none text-[0.75rem]">No adviser assigned</span>
                                        )}
                                        <span className="classrooms__item-adviser-label text-[0.6875rem]">Class Adviser</span>
                                    </div>
                                </div>
                                <div className="classrooms__item-actions flex shrink-0 items-center gap-1.5">
                                    <button
                                        type="button"
                                        className="classrooms__item-action inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditClassroomClick(classroom);
                                        }}
                                        aria-label={`Edit ${classroom.section}`}
                                        title="Edit classroom"
                                    >
                                        <FiEdit />
                                    </button>
                                    <div className="classrooms__item-menu-wrap relative">
                                        <button
                                            type="button"
                                            className="classrooms__item-action inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCardMenuOpen(cardMenuOpen === classroom.id ? null : classroom.id);
                                            }}
                                            aria-label={`More actions for ${classroom.section}`}
                                            aria-haspopup="true"
                                            aria-expanded={cardMenuOpen === classroom.id}
                                            title="More actions"
                                        >
                                            <FiMoreVertical />
                                        </button>
                                        {cardMenuOpen === classroom.id && (
                                            <div className="classrooms__item-menu" role="menu">
                                                <button
                                                    type="button"
                                                    className="classrooms__item-menu-item"
                                                    role="menuitem"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCardMenuOpen(null);
                                                        const article = (e.currentTarget as HTMLElement).closest("article");
                                                        if (article) {
                                                            handleSelectedClassroom({ ...e, currentTarget: article } as React.MouseEvent<HTMLElement>);
                                                        }
                                                    }}
                                                >
                                                    <FiEye aria-hidden="true" /> View Class
                                                </button>
                                                <button
                                                    type="button"
                                                    className="classrooms__item-menu-item"
                                                    role="menuitem"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCardMenuOpen(null);
                                                        handleEditClassroomClick(classroom);
                                                    }}
                                                >
                                                    <FiEdit aria-hidden="true" /> Edit Classroom
                                                </button>
                                                <button
                                                    type="button"
                                                    className="classrooms__item-menu-item classrooms__item-menu-item--danger"
                                                    role="menuitem"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCardMenuOpen(null);
                                                        archiveTriggerRef.current = e.currentTarget;
                                                        setArchiveTarget(classroom);
                                                    }}
                                                >
                                                    <FiTrash2 aria-hidden="true" /> Delete Classroom
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="classrooms__item-body flex items-center justify-between p-4 pt-0">
                                <div className="classrooms__item-stats flex items-center gap-4">
                                    <span className="classrooms__item-student-count inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                                        <FiUsers aria-hidden="true" className="text-[0.875rem]" />
                                        {classroom.totalStudent} {classroom.totalStudent === 1 ? "Student" : "Students"}
                                    </span>
                                    <span className="classrooms__item-id-badge inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[0.6875rem] font-medium">
                                        #{classroom.id}
                                    </span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <EmptyState
                    className="classrooms__empty"
                    icon={<FiHome />}
                    title="No classrooms found"
                    description="Classrooms will appear here once they are created."
                />
            )}
        </div>
    )}


    {/*==================== Classroom Details ====================*/}
    {selectedClassroom && (
        <div className="classrooms__details">
            {/* Hero banner */}
            <div className="classrooms__details-hero flex items-center justify-between gap-4 p-6">
                <div className="classrooms__details-main flex min-w-0 items-center gap-4">
                    <span className="classrooms__details-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl" aria-hidden="true">
                        <FiHome />
                    </span>
                    <div className="classrooms__details-heading min-w-0">
                        <span className="classrooms__details-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Classroom</span>
                        <h3 className="classrooms__details-title mt-1 truncate text-[1.375rem] font-bold">{selectedClassroom.section}</h3>
                        <p className="classrooms__details-subtitle mt-0.5 truncate text-[0.8125rem]">
                            Grade {selectedClassroom.gradeLevel} &middot; Classroom #{selectedClassroom.id}
                        </p>
                    </div>
                </div>
                <div className="classrooms__details-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="classrooms__details-badge-count text-[1.375rem] font-bold leading-none">{selectedClassroom.students?.length ?? 0}</span>
                    <span className="classrooms__details-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Enrolled</span>
                </div>
            </div>

            {/*=================== Quick stats ===================*/}
            <div className="classrooms__details-stats grid grid-cols-1 gap-3 border-b p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="classrooms__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                    <span className="classrooms__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Grade Level</span>
                    <span className="classrooms__details-stat-value text-[0.9375rem] font-bold">Grade {selectedClassroom.gradeLevel}</span>
                </div>
                <div className="classrooms__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                    <span className="classrooms__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Classroom ID</span>
                    <span className="classrooms__details-stat-value text-[0.9375rem] font-bold">#{selectedClassroom.id}</span>
                </div>
                <div className="classrooms__details-stat flex flex-col gap-0.5 rounded-lg border p-3">
                    <span className="classrooms__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Enrolled Students</span>
                    <span className="classrooms__details-stat-value text-[0.9375rem] font-bold">{selectedClassroom.students?.length ?? 0}</span>
                </div>
                <div className="classrooms__details-stat flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="classrooms__details-stat-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Class Adviser</span>
                        <button
                            type="button"
                            className="classrooms__adviser-edit inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[0.6875rem] font-bold"
                            onClick={handleAssignAdviserClick}
                            aria-label={selectedClassroom.adviserFullname ? "Change class adviser" : "Assign class adviser"}
                        >
                            <FiUserCheck aria-hidden="true" />
                            {selectedClassroom.adviserFullname ? "Change" : "Assign"}
                        </button>
                    </div>
                    <span className={`classrooms__details-stat-value truncate text-[0.8125rem] font-bold ${selectedClassroom.adviserFullname ? "" : "classrooms__item-adviser--none"}`}>
                        {selectedClassroom.adviserFullname || "Not assigned"}
                    </span>
                </div>
            </div>

            {/*================= Enrolled students table ================*/}
            <section className="classrooms__students p-5" aria-label="Enrolled students">
                <div className="classrooms__students-header grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end">
                    <div className="classrooms__students-head">
                        <div className="classrooms__students-heading min-w-0">
                            <h4 className="classrooms__students-title text-[0.9375rem] font-bold">Enrolled Students</h4>
                            <p className="classrooms__students-subtitle mt-1 text-[0.8125rem]">Students currently assigned to {selectedClassroom.section}</p>
                        </div>
                    </div>
                    <div className="classrooms__students-actions flex items-center justify-start gap-2 md:justify-end">
                        {pageStatus === "view-students" && (
                            <>
                                <span className="classrooms__students-count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                    {(selectedClassroom.students ?? []).length} student{(selectedClassroom.students ?? []).length === 1 ? "" : "s"}
                                </span>
                                {selectedStudentIds.length > 0 && (
                                    <button
                                        type="button"
                                        ref={removeTriggerRef}
                                        className="classrooms__remove-selected inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                                        onClick={handleBulkRemoveClick}
                                        aria-label={`Remove ${selectedStudentIds.length} selected student(s)`}
                                    >
                                        <FiTrash2 aria-hidden="true" />
                                        Remove {selectedStudentIds.length} Selected
                                    </button>
                                )}
                            </>
                        )}

                        {pageStatus === "view-subjects" && (
                            <div className="classrooms__students-subjects flex items-center gap-2">
                                <span className="classrooms__students-subjects-count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold">
                                    {(classroomFacultiesWithSubject ?? []).length} subject{(classroomFacultiesWithSubject ?? []).length === 1 ? "" : "s"}
                                </span>
                                <button className="classrooms__students-subjects-add inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
                                onClick={subjectsNotInClassFunc}
                                >
                                    Add Subjects
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="classrooms__tabs mt-4 flex gap-1 border-b">
                    <button
                        type="button"
                        className={`classrooms__tab relative px-3 py-2.5 text-xs font-bold ${
                            pageStatus === "view-students" ? "classrooms__tab--active" : ""
                        }`}
                        aria-pressed={pageStatus === "view-students"}
                        onClick={() => setPageStatus("view-students")}
                    >
                        Student
                    </button>
                    <button
                        type="button"
                        className={`classrooms__tab relative px-3 py-2.5 text-xs font-bold ${
                            pageStatus === "view-subjects" ? "classrooms__tab--active" : ""
                        }`}
                        aria-pressed={pageStatus === "view-subjects"}
                        onClick={() => (
                            setPageStatus("view-subjects"),
                            fetchClassroomFacultiesWithSubject()
                        )}
                    >
                        Subject
                    </button>
                </div>

                
                {/* classroom table  & page status view students*/}
                {pageStatus === "view-students" && (
                    <div className="data-table__wrap mt-4 rounded-xl">
                        {selectedClassroom.students && selectedClassroom.students.length > 0 ? (
                            
                                <table className="data-table min-w-[64rem]">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="data-table__th w-10">
                                                <input
                                                    type="checkbox"
                                                    className="classrooms__checkbox"
                                                    checked={allStudentsSelected}
                                                    onChange={handleToggleSelectAll}
                                                    aria-label="Select all students"
                                                />
                                            </th>
                                            <th scope="col" className="data-table__th w-32">LRN</th>
                                            <th scope="col" className="data-table__th w-48">Student Name</th>
                                            <th scope="col" className="data-table__th data-table__th--center w-16">Sex</th>
                                            <th scope="col" className="data-table__th data-table__th--center w-16">Age</th>
                                            <th scope="col" className="data-table__th w-28">Birthdate</th>
                                            <th scope="col" className="data-table__th w-56">Email</th>
                                            <th scope="col" className="data-table__th w-32">Enrollment ID</th>
                                            <th scope="col" className="data-table__th w-20">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedClassroom.students.map((student) => (
                                            <tr key={student.enrollmentId} className={`data-table__row${selectedStudentIds.includes(student.enrollmentId) ? " classrooms__row--selected" : ""}`}>
                                                <td className="data-table__td w-10">
                                                    <input
                                                        type="checkbox"
                                                        className="classrooms__checkbox"
                                                        checked={selectedStudentIds.includes(student.enrollmentId)}
                                                        onChange={() => handleToggleStudentSelection(student.enrollmentId)}
                                                        aria-label={`Select ${student.fullname}`}
                                                    />
                                                </td>
                                                <td className="data-table__td data-table__td--mono">
                                                    {student.studentLrn}
                                                </td>
                                                <td className="data-table__td">
                                                    <span className="data-table__value">{student.fullname}</span>
                                                    <span className="data-table__sub">Student ID #{student.studentId}</span>
                                                </td>
                                                <td className="data-table__td data-table__td--center">
                                                    <span className={`classrooms__sex inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold capitalize classrooms__sex--${student.studentSex.toLowerCase()}`}>
                                                        {student.studentSex}
                                                    </span>
                                                </td>
                                                <td className="data-table__td data-table__td--center">
                                                    {student.studentAge}
                                                </td>
                                                <td className="data-table__td data-table__td--muted">
                                                    {student.studentBirthdate}
                                                </td>
                                                <td className="data-table__td data-table__td--muted">
                                                    <span className="data-table__truncate">{student.studentEmail}</span>
                                                </td>
                                                <td className="data-table__td data-table__td--mono">
                                                    #{student.enrollmentId}
                                                </td>
                                                <td className="data-table__td">
                                                    <button
                                                        type="button"
                                                        className="classrooms__item-action classrooms__item-action--danger inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                                        onClick={() => handleRemoveStudentClick(student.enrollmentId, student.fullname)}
                                                        aria-label={`Remove ${student.fullname} from classroom`}
                                                        title="Remove student"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                        ) : (
                            <div className="classrooms__students-empty flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
                                <span className="classrooms__students-empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                    <FiUsers />
                                </span>
                                <p className="classrooms__students-empty-title mt-3 text-sm font-bold">No students enrolled</p>
                                <p className="classrooms__students-empty-text mt-1 text-[0.8125rem]">Students will appear here once they are enrolled in this classroom.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* =========================== pages status view-subjects ======================*/}
                {pageStatus === "view-subjects" && (
                    <section className="classrooms__subjects mt-4" aria-label="Classroom subjects">
                        {classroomFacultiesWithSubject && classroomFacultiesWithSubject.length > 0 ? (
                            <div className="data-table__wrap rounded-xl">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th scope="col" className="data-table__th w-48">Faculty</th>
                                            <th scope="col" className="data-table__th w-48">Subject</th>
                                            <th scope="col" className="data-table__th data-table__th--actions w-24">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classroomFacultiesWithSubject.map((item) => (
                                            <tr key={`${item.facultyId}-${item.subjectId}`} className="data-table__row">
                                                <td className="data-table__td">
                                                    <span className="data-table__value">{item.facultyFullname}</span>
                                                    <span className="data-table__sub">{item.code} &middot; {item.unit} unit{item.unit > 1 ? "s" : ""}</span>
                                                </td>
                                                <td className="data-table__td">
                                                    <span className="classrooms__subjects-subject inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold">
                                                        <span className="classrooms__subjects-subject-icon" aria-hidden="true">
                                                            <FiBookOpen />
                                                        </span>
                                                        {item.subjectName}
                                                    </span>
                                                </td>

                                                <td className="data-table__td data-table__td--actions">
                                                    <button className="classrooms__subjects-actions-icon inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                                    onClick={() => 
                                                        handleChangeSubjectFacultyClickEvent(item.subjectId, selectedClassroom.id)
                                                    }
                                                    aria-label={`Change faculty for ${item.subjectName}`}
                                                    >
                                                        <FiEdit />
                                                    </button>
                                                    <button 
                                                    className="classrooms__subjects-actions-icon inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                                    onClick={(e) => {
                                                        // Capture the clicked button so focus returns to it when the dialog closes
                                                        deleteTriggerRef.current = e.currentTarget;
                                                        setDeleteTarget({ subjectId: item.subjectId, facultyId: item.facultyId, classId: selectedClassroom.id });
                                                    }}
                                                    aria-label={`Delete ${item.subjectName} from classroom`}
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="classrooms__subjects-empty flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
                                <span className="classrooms__subjects-empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                    <FiBookOpen />
                                </span>
                                <p className="classrooms__subjects-empty-title mt-3 text-sm font-bold">No subjects assigned</p>
                                <p className="classrooms__subjects-empty-text mt-1 text-[0.8125rem]">Subjects will appear here once they are assigned to this classroom.</p>
                            </div>
                        )}
                    </section>
                )}
            </section>
        </div>
    )}

</PageSection>

{/* classroom Modal */}
<ModalDialog
    open={isModalOpen}
    onClose={handleModalClose}
    labelledById="classrooms-modal-title"
    className="classrooms-modal__panel flex w-full max-w-[36rem] flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
>
            <header className="classrooms-modal__header flex shrink-0 items-start justify-between gap-4 p-6 pb-5">
                <div className="classrooms-modal__heading">
                    <span className="classrooms-modal__eyebrow uppercase tracking-[0.08em]">
                        {modalStatus === "create-class" && "Create Classroom" }
                        {modalStatus === "edit-class" && "Edit Classroom" }
                        {modalStatus === "create-subject" && "Create Subject" }
                        {modalStatus === "edit-subject-faculties" && "Assign Faculty" }
                        {modalStatus === "assign-adviser" && "Class Adviser" }
                    </span>
                    <h3 id="classrooms-modal-title" className="classrooms-modal__title mt-0.5 text-xl font-bold">
                        {modalStatus === "create-class" && "New Classroom Section" }
                        {modalStatus === "edit-class" && "Update Classroom Section" }
                        {modalStatus === "create-subject" && "New Subject" }
                        {modalStatus === "edit-subject-faculties" && "Change Subject Faculty" }
                        {modalStatus === "assign-adviser" && "Assign Class Adviser" }
                    </h3>
                    <p className="classrooms-modal__subtitle mt-1 text-[0.8125rem]">
                        {modalStatus === "create-class" && "Fill out the form below to create a new classroom." }
                        {modalStatus === "edit-class" && `Update the section and grade level for ${editingClassroom?.section ?? "this classroom"}.` }
                        {modalStatus === "create-subject" && `Select the subjects to add to ${selectedClassroom?.section ?? "this classroom"}.` }
                        {modalStatus === "edit-subject-faculties" && "Choose the faculty who will handle this subject in the classroom." }
                        {modalStatus === "assign-adviser" && `Choose the adviser for ${selectedClassroom?.section ?? "this classroom"}. Each faculty advises at most one class.` }
                    </p>
                </div>
                <button type="button" className="classrooms-modal__close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg" onClick={handleModalClose} aria-label="Close modal">
                    <FiX aria-hidden="true" />
                </button>
            </header>

            <form className="classrooms-form flex min-h-0 flex-1 flex-col p-6" onSubmit={
              modalStatus === "create-class" ? handleSubmitOfCreateClassroomModalForm :
              modalStatus === "edit-class" ? handleSubmitOfEditClassroomModalForm :
              modalStatus === "create-subject" ? handleSubmitOfNewClassroomSubjects :
              modalStatus === "edit-subject-faculties" ? handleSubmitOfEditSubjectFaculties :
              modalStatus === "assign-adviser" ? handleSubmitOfAssignAdviser :
              () => {}
            } noValidate>

                {/* Create / Edit Classroom Form */}
                {(modalStatus === "create-class" || modalStatus === "edit-class") && (
                    <div className="classrooms-form__grid grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
                    <div className="classrooms-form__field flex flex-col gap-1.5">
                        <label htmlFor="classroom-section" className="classrooms-form__label text-[0.8125rem] font-semibold">Section</label>
                        <input
                            id="classroom-section"
                            type="text"
                            className="classrooms-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            placeholder="Rizal"
                            autoFocus
                            name="section"
                            onChange={handleNewClassroomInputChangeEvent}
                            value={newClassroom.section}
                        />
                    </div>
                    <div className="classrooms-form__field flex flex-col gap-1.5">
                        <label htmlFor="classroom-grade" className="classrooms-form__label text-[0.8125rem] font-semibold">Grade Level</label>
                        <input
                            id="classroom-grade"
                            type="number"
                            min={1}
                            max={12}
                            className="classrooms-form__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            placeholder="7"
                            name="gradeLevel"
                            onChange={handleNewClassroomInputChangeEvent}
                            value={newClassroom.gradeLevel}
                        />
                    </div>
                </div>
                )}
                
                {/* Add Subject modal form */}
                {modalStatus === "create-subject" && (
                    <div className="classrooms-subject-picker flex min-h-0 flex-1 flex-col gap-3.5">
                        <div className="classrooms-subject-picker__head flex items-center justify-between gap-4">
                            <p className="classrooms-subject-picker__hint text-[0.8125rem]">
                                Select subjects to add to <strong className="font-bold">{selectedClassroom?.section}</strong>
                            </p>
                            <span className="classrooms-subject-picker__count shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold" aria-live="polite">
                                {subjectsNotInClass === null ? "…" : `${selectedSubjectIds.length} of ${subjectsNotInClass.length} selected`}
                            </span>
                        </div>

                        {subjectsNotInClass && subjectsNotInClass.length > 0 ? (
                            <div className="classrooms-subject-picker__grid flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto pr-1">
                                {subjectsNotInClass.map((st) => (
                                    <div key={st.subjectId} className="classrooms-subject-picker__field rounded-lg border">
                                        <label className="classrooms-subject-picker__label relative flex cursor-pointer items-center gap-2.5 p-2.5 text-sm" htmlFor={`add-subject-${st.subjectId}`}>
                                            <input
                                                type="checkbox"
                                                name="subjects"
                                                id={`add-subject-${st.subjectId}`}
                                                value={st.subjectId}
                                                checked={selectedSubjectIds.includes(st.subjectId)}
                                                onChange={handleSubjectSelectionChangeEvent}
                                            />
                                            <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                                <span className="classrooms-subject-picker__name truncate text-sm font-bold">{st.subjectName}</span>
                                                <span className="classrooms-subject-picker__meta flex items-center gap-1.5 text-xs">
                                                    <span className="classrooms-subject-picker__code shrink-0 rounded-full px-1.5 py-px font-mono text-[0.625rem] font-bold">{st.subjectCode}</span>
                                                </span>
                                            </span>
                                            <span className="classrooms-subject-picker__check inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">✓</span>
                                        </label>

                                        {selectedSubjectIds.includes(st.subjectId) && (
                                            <div className="classrooms-subject-picker__faculties border-t border-dashed px-3 pb-3 pt-2.5" aria-live="polite">
                                                <div className="classrooms-subject-picker__faculties-head flex items-center justify-between gap-2">
                                                    <span className="classrooms-subject-picker__faculties-title text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Assign faculty</span>
                                                    {st.faculties.length > 0 && (
                                                        <span className="classrooms-subject-picker__faculties-count shrink-0 rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold">
                                                            {st.faculties.length} faculty{st.faculties.length === 1 ? "" : "s"}
                                                        </span>
                                                    )}
                                                </div>

                                                {st.faculties.length > 0 ? (
                                                    <div className="classrooms-subject-picker__faculties-list mt-2 flex flex-col gap-1.5">
                                                        {st.faculties.map((t) => (
                                                            <label
                                                                key={t.facultyId}
                                                                className="classrooms-subject-picker__faculty-option relative flex cursor-pointer items-center gap-2.5 rounded-lg border p-2"
                                                                htmlFor={`add-subject-faculty-${st.subjectId}-${t.facultyId}`}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={`add-subject-faculty-${st.subjectId}`}
                                                                    id={`add-subject-faculty-${st.subjectId}-${t.facultyId}`}
                                                                    value={t.facultyId}
                                                                    onChange={(e) => handleNewClassroomSubjectAddedChangeEvent(e, st.subjectId)}
                                                                />
                                                                <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                                                    <span className="classrooms-subject-picker__name truncate text-sm font-bold">{t.facultyFullname}</span>
                                                                </span>
                                                                <span className="classrooms-subject-picker__check inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">✓</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="classrooms-subject-picker__faculties-empty mt-2 rounded-lg border border-dashed bg-white p-2 text-xs">
                                                        No faculties are currently teaching this subject.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="classrooms-subject-picker__empty flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
                                <span className="classrooms-subject-picker__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                    <FiBookOpen />
                                </span>
                                <p className="classrooms-subject-picker__empty-title mt-3 text-sm font-bold">No subjects available</p>
                                <p className="classrooms-subject-picker__empty-text mt-1 text-[0.8125rem]">All subjects are already assigned to this classroom.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Assign Class Adviser modal form */}
                {modalStatus === "assign-adviser" && (
                    <div className="classrooms-subject-picker flex min-h-0 flex-1 flex-col gap-3.5">
                        <div className="classrooms-subject-picker__head flex items-center justify-between gap-4">
                            <p className="classrooms-subject-picker__hint text-[0.8125rem]">
                                Select the class adviser for <strong className="font-bold">{selectedClassroom?.section}</strong>
                            </p>
                            <span className="classrooms-subject-picker__count shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold" aria-live="polite">
                                {allFaculties === null ? "…" : `${allFaculties.length} faculty${allFaculties.length === 1 ? "" : "s"}`}
                            </span>
                        </div>

                        {allFaculties && allFaculties.length > 0 ? (
                            <div className="classrooms-subject-picker__grid flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto pr-1">
                                {/* Explicit "no adviser" option — radios cannot be deselected by clicking again */}
                                <div className={`classrooms-subject-picker__field rounded-lg border ${adviserSelection === null ? "classrooms-subject-picker__field--selected" : ""}`}>
                                    <label className="classrooms-subject-picker__label relative flex cursor-pointer items-center gap-2.5 p-2.5 text-sm" htmlFor="assign-adviser-none">
                                        <input
                                            type="radio"
                                            name="class-adviser"
                                            id="assign-adviser-none"
                                            value=""
                                            checked={adviserSelection === null}
                                            onChange={() => setAdviserSelection(null)}
                                        />
                                        <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                            <span className="classrooms-subject-picker__name truncate text-sm font-bold">No class adviser</span>
                                            <span className="classrooms-subject-picker__meta flex items-center gap-1.5 text-xs">
                                                <span className="classrooms-subject-picker__code shrink-0 rounded-full px-1.5 py-px font-mono text-[0.625rem] font-bold">Unassigned</span>
                                                {selectedClassroom?.adviserId == null && (
                                                    <span className="classrooms-adviser-badge shrink-0 rounded-full px-2 py-px text-[0.625rem] font-bold">Current</span>
                                                )}
                                            </span>
                                        </span>
                                        <span className="classrooms-subject-picker__check inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">✓</span>
                                    </label>
                                </div>
                                {allFaculties.map((faculty) => {
                                    const isCurrent = selectedClassroom?.adviserId === faculty.id;
                                    const takenSection = adviserTakenBy[faculty.id];
                                    const isTaken = takenSection !== undefined;
                                    return (
                                        <div key={faculty.id} className={`classrooms-subject-picker__field rounded-lg border ${isCurrent ? "classrooms-subject-picker__field--selected" : ""} ${isTaken ? "classrooms-subject-picker__field--taken" : ""}`}>
                                            <label className={`classrooms-subject-picker__label relative flex cursor-pointer items-center gap-2.5 p-2.5 text-sm ${isTaken ? "classrooms-subject-picker__label--taken" : ""}`} htmlFor={`assign-adviser-${faculty.id}`}>
                                                <input
                                                    type="radio"
                                                    name="class-adviser"
                                                    id={`assign-adviser-${faculty.id}`}
                                                    value={faculty.id}
                                                    disabled={isTaken}
                                                    checked={adviserSelection === faculty.id}
                                                    onChange={() => setAdviserSelection(faculty.id)}
                                                />
                                                <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                                    <span className="classrooms-subject-picker__name truncate text-sm font-bold">{faculty.fullname}</span>
                                                    <span className="classrooms-subject-picker__meta flex items-center gap-1.5 text-xs">
                                                        <span className="classrooms-subject-picker__code shrink-0 rounded-full px-1.5 py-px font-mono text-[0.625rem] font-bold">{faculty.email}</span>
                                                        {isCurrent && (
                                                            <span className="classrooms-adviser-badge shrink-0 rounded-full px-2 py-px text-[0.625rem] font-bold">Current adviser</span>
                                                        )}
                                                        {isTaken && !isCurrent && (
                                                            <span className="classrooms-adviser-badge classrooms-adviser-badge--taken shrink-0 rounded-full px-2 py-px text-[0.625rem] font-bold">
                                                                Advises {takenSection}
                                                            </span>
                                                        )}
                                                    </span>
                                                </span>
                                                <span className="classrooms-subject-picker__check inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">✓</span>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : allFaculties !== null ? (
                            <div className="classrooms-subject-picker__empty flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
                                <span className="classrooms-subject-picker__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                    <FiUserCheck />
                                </span>
                                <p className="classrooms-subject-picker__empty-title mt-3 text-sm font-bold">No faculties available</p>
                                <p className="classrooms-subject-picker__empty-text mt-1 text-[0.8125rem]">Create a faculty record before assigning a class adviser.</p>
                            </div>
                        ) : (
                            <div className="classrooms-subject-picker__empty flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
                                <p className="classrooms-subject-picker__empty-title mt-3 text-sm font-bold">Loading faculties…</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Edit Subject Faculties modal form */}
                {modalStatus === "edit-subject-faculties" && (
                    <div className="classrooms-subject-picker flex min-h-0 flex-1 flex-col gap-3.5">
                        <div className="classrooms-subject-picker__head flex items-center justify-between gap-4">
                            <p className="classrooms-subject-picker__hint text-[0.8125rem]">
                                Choose a faculty for <strong className="font-bold">{subjectFaculties?.[0]?.subjectName ?? "this subject"}</strong>
                            </p>
                            <span className="classrooms-subject-picker__count shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold" aria-live="polite">
                                {subjectFaculties === null ? "…" : `${subjectFaculties.length} faculty${subjectFaculties.length === 1 ? "" : "s"} available`}
                            </span>
                        </div>

                        {subjectFaculties && subjectFaculties.length > 0 ? (
                            <div className="classrooms-subject-picker__grid flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto pr-1">
                                {subjectFaculties.map((st) => (
                                    <div key={st.facultyId} className="classrooms-subject-picker__field rounded-lg border">
                                        <label className="classrooms-subject-picker__label relative flex cursor-pointer items-center gap-2.5 p-2.5 text-sm" htmlFor={`edit-faculty-${st.facultyId}`}>
                                          <input
                                              type="radio"
                                              name="subject-faculties"
                                              id={`edit-faculty-${st.facultyId}`}
                                              value={st.facultyId}
                                              onChange={(e) => {
                                                handleEditSubjectFacultyChangeEvent(e, st.subjectId);
                                              }}
                                          />
                                            <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                                <span className="classrooms-subject-picker__name truncate text-sm font-bold">
                                                  {st.facultyFullname}
                                                </span>
                                                <span className="classrooms-subject-picker__meta flex items-center gap-1.5 text-xs">
                                                    <span className="classrooms-subject-picker__code shrink-0 rounded-full px-1.5 py-px font-mono text-[0.625rem] font-bold">{st.subjectCode}</span>
                                                    <span className="classrooms-subject-picker__faculty truncate">{st.subjectName} &middot; {st.subjectUnit} unit{st.subjectUnit === 1 ? "" : "s"}</span>
                                                </span>
                                            </span>
                                            <span className="classrooms-subject-picker__check inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">✓</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="classrooms-subject-picker__empty flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
                                <span className="classrooms-subject-picker__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                    <FiUserPlus />
                                </span>
                                <p className="classrooms-subject-picker__empty-title mt-3 text-sm font-bold">No faculties available</p>
                                <p className="classrooms-subject-picker__empty-text mt-1 text-[0.8125rem]">No faculties are currently teaching this subject.</p>
                            </div>
                        )}
                    </div>
                )}

                {modalStatus === "assign-adviser" && adviserSelection === null && selectedClassroom?.adviserId != null && (
                    <p className="classrooms-form__hint px-6 text-[0.75rem]">The adviser will be removed — no adviser will be assigned to this classroom.</p>
                )}

                <footer className="classrooms-form__footer mt-6 flex shrink-0 justify-end gap-3 border-t pt-5">
                    <button type="button" className="classrooms-form__cancel rounded-lg border px-4 py-2.5 text-sm font-semibold" onClick={handleModalClose}>
                        Cancel
                    </button>
                    <button type="submit" className="classrooms-form__submit inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold" disabled={assigningAdviser}>
                        {modalStatus === "create-class" && "Create Classroom"}
                        {modalStatus === "edit-class" && "Save Changes"}
                        {modalStatus === "create-subject" && "Create Subject"}
                        {modalStatus === "edit-subject-faculties" && "Update Assigned Faculties"}
                        {modalStatus === "assign-adviser" && (assigningAdviser ? "Saving…" : adviserSelection === null ? "Remove Adviser" : "Assign Adviser")}
                    </button>
                </footer>
            </form>
</ModalDialog>

{/* Delete subject confirmation dialog */}
<ConfirmDialog
    open={deleteTarget !== null}
    title="Delete subject from classroom?"
    description={
        pendingDeleteSubject
            ? `This will remove ${pendingDeleteSubject.subjectName} and its assigned faculty from ${selectedClassroom?.section ?? "this classroom"}. This cannot be undone.`
            : "This will remove the subject and its assigned faculty from the classroom. This cannot be undone."
    }
    confirmLabel="Delete"
    confirmIcon={<FiTrash2 aria-hidden="true" />}
    icon={<FiTrash2 aria-hidden="true" />}
    tone="danger"
    pending={deletingSubject}
    pendingLabel="Deleting…"
    onConfirm={handleConfirmDeleteSubject}
    onClose={closeDeleteConfirm}
    triggerRef={deleteTriggerRef}
/>

{/* Archive classroom confirmation dialog */}
<ConfirmDialog
    open={archiveTarget !== null}
    title="Archive classroom?"
    description={
        archiveTarget
            ? `${archiveTarget.section} will be hidden from all classroom lists and cannot be restored through the app. Students enrolled in the current school year must be transferred first — enrollments, records, and grades from other years are preserved.`
            : "This classroom will be hidden permanently."
    }
    confirmLabel="Archive"
    confirmIcon={<FiTrash2 aria-hidden="true" />}
    icon={<FiTrash2 aria-hidden="true" />}
    tone="danger"
    pending={archiving}
    pendingLabel="Archiving…"
    onConfirm={handleConfirmArchiveClassroom}
    onClose={closeArchiveConfirm}
    triggerRef={archiveTriggerRef}
/>

{/* Single student removal confirmation dialog */}
<ConfirmDialog
    open={removeTarget !== null}
    title="Remove student from classroom?"
    description={
        removeTarget
            ? `${removeTarget.studentName} will be removed from ${selectedClassroom?.section ?? "this classroom"}. Their enrollment will be marked as unenrolled, and they can be re-enrolled later.`
            : "This student will be removed from the classroom."
    }
    confirmLabel="Remove Student"
    confirmIcon={<FiTrash2 aria-hidden="true" />}
    icon={<FiTrash2 aria-hidden="true" />}
    tone="danger"
    pending={removingStudent}
    pendingLabel="Removing…"
    onConfirm={handleConfirmRemoveStudent}
    onClose={closeRemoveConfirm}
    triggerRef={removeTriggerRef}
/>

{/* Bulk student removal confirmation dialog */}
<ConfirmDialog
    open={bulkRemoveOpen}
    title={`Remove ${selectedStudentIds.length} student(s)?`}
    description={`These ${selectedStudentIds.length} student(s) will be removed from ${selectedClassroom?.section ?? "this classroom"}. Their enrollments will be marked as unenrolled, and they can be re-enrolled later.`}
    confirmLabel={`Remove ${selectedStudentIds.length} Student(s)`}
    confirmIcon={<FiTrash2 aria-hidden="true" />}
    icon={<FiTrash2 aria-hidden="true" />}
    tone="danger"
    pending={removingStudent}
    pendingLabel="Removing…"
    onConfirm={handleConfirmBulkRemove}
    onClose={closeBulkRemoveConfirm}
    triggerRef={removeTriggerRef}
/>

{/* Clear all students from classroom confirmation dialog */}
<ConfirmDialog
    open={clearClassConfirm}
    title={`Clear all students from ${selectedClassroom?.section ?? "this classroom"}?`}
    description={`This will remove all ${selectedClassroom?.students?.length ?? 0} student(s) from ${selectedClassroom?.section ?? "this classroom"}. Scores, attendance, and submission records will be deleted. Enrollments will be marked as completed. This cannot be undone from this page.`}
    confirmLabel={clearingClass ? "Clearing…" : "Clear All Students"}
    confirmIcon={clearingClass ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiTrash2 aria-hidden="true" />}
    icon={<FiTrash2 aria-hidden="true" />}
    tone="danger"
    pending={clearingClass}
    pendingLabel="Clearing…"
    onConfirm={handleConfirmClearClass}
    onClose={() => setClearClassConfirm(false)}
/>
</PageShell>
);
}
