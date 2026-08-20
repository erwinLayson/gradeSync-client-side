import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus, FiX, FiArrowLeft, FiEdit, FiTrash2, FiHome, FiUsers, FiBookOpen, FiUserPlus, FiUserCheck, FiRefreshCw } from "react-icons/fi";

import { 
    getAPICall, 
    postAPICall, 
    patchAPICall,
    putAPICall,
    deleteAPICall
} from "../../api/api";
import { toast } from "../../helper/toast";

import "../../style/adminClassrooms.css";

import type { 
ClassroomResponseProps,
ClassroomWithStudentsProps, 
ClassroomTeachersWithSubjectProps, 
subjectTeachersProps, 
subjectNotInClassProps,
EditSubjectTeacherProps

} from "../../constant/classrooms.js";

import type { Teacher } from "../../constant/teachers.js";

// Helper functions
import { Validate } from "../../helper/validate.js";
import { getInitials } from "../../helper/initials.js";

import useClassroom from "../../hooks/useClassroom.js";

// Components
import { ConfirmDialog } from "../../components/ConfirmDialog";

// Main component
export default function AdminClassrooms() {
// Classsroom data states
// const [classrooms, setClassrooms] = useState<ClassroomResponseProps[] | null>(null);
const {classrooms, refetchClassroom, loading, setLoading} = useClassroom<ClassroomResponseProps[]>()
const [classroomTeachersWithSubject, setClassroomTeachersWithSubject] = useState<ClassroomTeachersWithSubjectProps[] | null>(null);
const [newClassroom, setNewClassroom] = useState<Omit<ClassroomResponseProps, "id" | "gradeLevel" | "totalStudent"> & { gradeLevel: string }>({
section: "",
gradeLevel: ""
});

// Subjects data states
const [selectedClassroom, setSelectedClassroom] = useState<ClassroomWithStudentsProps | null>(null);
const [subjectTeachers, setSubjectTeachers] = useState<subjectTeachersProps[] | null>(null);
const [subjectsNotInClass, setSubjectsNotInClass] = useState<subjectNotInClassProps[] | null>(null);
const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
const [newClassroomSubjectAdded, setNewClassroomSubjectAdded] = useState<{classId: number,subjectId: number, teacherId: number}[] | null>(null);
const [editSubjectTeacher, setEditSubjectTeacher] = useState<EditSubjectTeacherProps | null>(null);

// Class adviser states
const [allTeachers, setAllTeachers] = useState<Teacher[] | null>(null);
const [adviserSelection, setAdviserSelection] = useState<number | null>(null);
const [assigningAdviser, setAssigningAdviser] = useState(false);
// teacherId -> section name of the class they already advise (one class per teacher)
const [adviserTakenBy, setAdviserTakenBy] = useState<Record<number, string>>({});

// Edit classroom state (the classroom being edited in the modal)
const [editingClassroom, setEditingClassroom] = useState<ClassroomResponseProps | null>(null);

// Archive classroom confirmation dialog states
const [archiveTarget, setArchiveTarget] = useState<ClassroomResponseProps | null>(null);
const [archiving, setArchiving] = useState(false);
const archiveTriggerRef = useRef<HTMLButtonElement>(null);

// Conditional rendering states
const [pageStatus, setPageStatus] = useState<"view-students" | "view-subjects">("view-students");
const [modalStatus, setModalStatus] = useState<"create-class" | "edit-class" | "create-subject" | "edit-subject-teachers" | "assign-adviser" | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);
const triggerRef = useRef<HTMLButtonElement>(null);

// Delete subject confirmation dialog states
const [deleteTarget, setDeleteTarget] = useState<{ subjectId: number; teacherId: number; classId: number } | null>(null);
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

function handleOverlayMouseDown(event: React.MouseEvent<HTMLDivElement>) {
if (event.target === event.currentTarget) {
closeModal();
setModalStatus(null);
setNewClassroomSubjectAdded(null);
setSelectedSubjectIds([]);
setSubjectsNotInClass(null);
setEditSubjectTeacher(null);
setAdviserSelection(null);
setAllTeachers(null);
setAdviserTakenBy({});
setEditingClassroom(null);
}
}

useEffect(() => {
if (!isModalOpen) return;

const handleKeyDown = (event: KeyboardEvent) => {
if (event.key === "Escape") {
    closeModal();
    setModalStatus(null);
}
};

document.addEventListener("keydown", handleKeyDown);
const previousOverflow = document.body.style.overflow;
document.body.style.overflow = "hidden";

return () => {
document.removeEventListener("keydown", handleKeyDown);
document.body.style.overflow = previousOverflow;
};
}, [isModalOpen, closeModal]);

function handleModalClose() {
closeModal();
setNewClassroom({section: "", gradeLevel: ""});
setSelectedSubjectIds([]);
setNewClassroomSubjectAdded([]);
setSubjectTeachers([]);
setModalStatus(null);
setEditSubjectTeacher(null);
setAdviserSelection(null);
setAllTeachers(null);
setEditingClassroom(null);
}

// Open the assign-adviser modal: loads the teacher list and preselects the current adviser.
// Also builds the map of teachers who already advise another class (one class per teacher).
async function handleAssignAdviserClick() {
if (!selectedClassroom) return;

try {
    const [teachersResponse, classroomsResponse] = await Promise.all([
        getAPICall<Teacher[]>("/teachers"),
        getAPICall<ClassroomResponseProps[]>("/classrooms")
    ]);
    setAllTeachers(teachersResponse.data ?? null);
    // A teacher counts as "taken" only when they advise a DIFFERENT classroom.
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
    setAllTeachers(null);
    setAdviserTakenBy({});
}
setAdviserSelection(selectedClassroom.adviserId ?? null);
setModalStatus("assign-adviser");
setIsModalOpen(true);
}

// Submit the adviser assignment (teacherId null clears the adviser)
async function handleSubmitOfAssignAdviser(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();
if (!selectedClassroom || assigningAdviser) return;

setAssigningAdviser(true);
try {
    await putAPICall<{ teacherId: number | null }, null>(
        `/classrooms/${selectedClassroom.id}/adviser`,
        { teacherId: adviserSelection }
    );
    // Update the detail view in place and refresh the classroom list cards.
    const teacher = (allTeachers ?? []).find((t) => t.id === adviserSelection) ?? null;
    setSelectedClassroom((prev) => (prev ? { ...prev, adviserId: adviserSelection, adviserFullname: teacher?.fullname ?? null } : prev));
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
closeModal();
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

// Fetch classroom teachers with subjects
async function fetchClassroomTeachersWithSubject() {
if (!selectedClassroom) return;

const response = await getAPICall<ClassroomTeachersWithSubjectProps[]>(`/classrooms/${selectedClassroom.id}/teachers-subject`);
setClassroomTeachersWithSubject(response.data ?? null);
}

// Handle the click event for changing the subject teacher
async function handleChangeSubjectTeacherClickEvent(subjectId: number, classroomId: number) {
await fetchSubjectTeachers(Number(subjectId), Number(classroomId));
setModalStatus("edit-subject-teachers");
setIsModalOpen(true);
}

const closeDeleteConfirm = useCallback(() => setDeleteTarget(null), []);

// handle the delete subject from classroom confirm action
async function handleConfirmDeleteSubject() {
    if (!deleteTarget || deletingSubject) return;

    setDeletingSubject(true);
    try {
        await deleteAPICall<null, null>(`/classrooms/${deleteTarget.classId}/subjects/${deleteTarget.subjectId}/teachers/${deleteTarget.teacherId}`);
        fetchClassroomTeachersWithSubject();
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
    ? (classroomTeachersWithSubject ?? []).find(
        (item) => item.subjectId === deleteTarget.subjectId && item.teacherId === deleteTarget.teacherId,
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

// fetch subject teachers for a specific subject in a classroom
async function fetchSubjectTeachers(subjectId: number, classroomId: number) {
    const response = await getAPICall<subjectTeachersProps[]>(`/subjects/${subjectId}/classrooms/${classroomId}/assigned-teachers`);
    setSubjectTeachers(response.data ?? null);
}

// Handle the change event for selecting a new teacher for a subject in the edit-subject-teachers modal
function handleEditSubjectTeacherChangeEvent(e: React.ChangeEvent<HTMLInputElement>, subjectId: number) {
  const {value, checked} = e.target;

  setEditSubjectTeacher(
    checked ? { subjectId, teacherId: Number(value) } : null
  )
}

// Handle form submission for editing subject teachers
async function handleSubmitOfEditSubjectTeachers(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();

if(!selectedClassroom || !editSubjectTeacher) return;

await patchAPICall<EditSubjectTeacherProps, null>(`/classrooms/${selectedClassroom?.id}/subjects`, editSubjectTeacher);
handleModalClose();
fetchClassroomTeachersWithSubject();
}

// Fetch subjects not in class
async function subjectsNotInClassFunc() {
if (!selectedClassroom) return;
const response = await getAPICall<subjectNotInClassProps[]>(`/subjects/classrooms/${selectedClassroom.id}/teachers`);

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

// Handle the selection of a teacher for a new classroom subject
function handleNewClassroomSubjectAddedChangeEvent(e: React.ChangeEvent<HTMLInputElement>, subjectId: number) {
if(!selectedClassroom) return;

const { checked, value } = e.target;
const teacherId = Number(value);


if(checked) {
setNewClassroomSubjectAdded((prev) => {
  const existing = prev?.find((item) => item.subjectId === subjectId);
  if(existing) {
      return prev?.map((item) => item.subjectId === subjectId ? { ...item, teacherId } : item) ?? null;
  } else {
      return [...(prev ?? []), { classId: selectedClassroom.id, subjectId, teacherId }];
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
if (!selectedClassroom || !newClassroomSubjectAdded) return;

for (const newSubject of newClassroomSubjectAdded) {
  Validate(newSubject);
}

try {
  await postAPICall("/classrooms/subjects", {
      newSubjects: newClassroomSubjectAdded
  });
  // Reset the form
  setNewClassroomSubjectAdded(null);
  setIsModalOpen(false);
  fetchClassroomTeachersWithSubject();
} catch (error) {
  console.error("Error submitting new classroom subjects:", error);
}
}


// Loading State
if (loading) {
return (
<section className="classrooms flex flex-col gap-5">
    <div className="classrooms__card overflow-hidden rounded-2xl bg-white shadow-sm" aria-busy="true" aria-label="Loading classrooms">
        <div className="classrooms__header flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="classrooms__heading min-w-0">
                <h2 className="classrooms__title text-base font-bold">Classroom Records</h2>
                <p className="classrooms__subtitle mt-1 text-[0.8125rem]">Loading classrooms…</p>
            </div>
        </div>
        <div className="classrooms__skeleton grid grid-cols-1 gap-4 p-6 sm:grid-cols-2" aria-hidden="true">
            <div className="classrooms__skeleton-row" />
            <div className="classrooms__skeleton-row" />
            <div className="classrooms__skeleton-row" />
            <div className="classrooms__skeleton-row" />
        </div>
    </div>
</section>
);
}

return (
<section className="classrooms flex flex-col gap-5">
{/* classroom list  */}
<div className="classrooms__card overflow-hidden rounded-2xl bg-white shadow-sm">
    <div className="classrooms__header flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="classrooms__heading min-w-0">
            <h2 className="classrooms__title text-base font-bold">Classroom Records</h2>
            <p className="classrooms__subtitle mt-1 text-[0.8125rem]">Manage school classrooms</p>
        </div>
        <div className="classrooms__actions flex flex-wrap items-center gap-2">
            

            {selectedClassroom ? (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="classrooms__back inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                        onClick={() => (
                            setSelectedClassroom(null),
                            setClassroomTeachersWithSubject(null),
                            setPageStatus("view-students")
                        )}
                        aria-label="Back to classroom list"
                    >
                        <FiArrowLeft /> <span className="text-sm font-bold">Back to List</span>
                    </button>
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
                    Add Classroom
                </button>

                <button
                    type="button"
                    className="classrooms__refresh inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                    onClick={() => refetchClassroom()}
                    aria-label="Refresh classroom list"
                >
                    <span className="classrooms__refresh-icon" aria-hidden="true">⟳</span>
                    Refresh
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
                                    <span className="classrooms__item-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Classroom</span>
                                    <h3 className="classrooms__item-name mt-1 truncate text-[1.0625rem] font-bold">{classroom.section}</h3>
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
                                    <button
                                        type="button"
                                        className="classrooms__item-action classrooms__item-action--danger inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            archiveTriggerRef.current = e.currentTarget;
                                            setArchiveTarget(classroom);
                                        }}
                                        aria-label={`Archive ${classroom.section}`}
                                        title="Archive classroom"
                                    >
                                        <FiTrash2 />
                                    </button>
                                    <span className="classrooms__item-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg" aria-hidden="true">
                                        <FiHome />
                                    </span>
                                </div>
                            </div>
                            <div className="classrooms__item-body flex flex-wrap items-center gap-6 p-4">
                                <div className="classrooms__item-stat flex min-w-0 flex-col">
                                    <span className="classrooms__item-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Grade Level</span>
                                    <span className="classrooms__item-grade text-sm font-bold">Grade {classroom.gradeLevel}</span>
                                </div>
                                <div className="classrooms__item-stat flex min-w-0 flex-col">
                                    <span className="classrooms__item-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Classroom ID</span>
                                    <span className="classrooms__item-id font-mono text-[0.8125rem]">#{classroom.id}</span>
                                </div>
                                <div className="classrooms__item-stat flex min-w-0 flex-col">
                                    <span className="classrooms__item-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Total Students</span>
                                    <span className="classrooms__item-id font-mono text-[0.8125rem]">{classroom.totalStudent}</span>
                                </div>
                                <div className="classrooms__item-stat flex min-w-0 flex-col">
                                    <span className="classrooms__item-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">Class Adviser</span>
                                    <span className={`classrooms__item-adviser truncate text-[0.8125rem] font-bold ${classroom.adviserFullname ? "" : "classrooms__item-adviser--none"}`}>
                                        {classroom.adviserFullname || "Not assigned"}
                                    </span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="classrooms__empty flex flex-col items-center justify-center px-6 py-14 text-center">
                    <span className="classrooms__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                        <FiHome />
                    </span>
                    <p className="classrooms__empty-title mt-3 text-sm font-bold">No classrooms found</p>
                    <p className="classrooms__empty-text mt-1 text-[0.8125rem]">Classrooms will appear here once they are created.</p>
                </div>
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
                                    {(classroomTeachersWithSubject ?? []).length} subject{(classroomTeachersWithSubject ?? []).length === 1 ? "" : "s"}
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
                            fetchClassroomTeachersWithSubject()
                        )}
                    >
                        Subject
                    </button>
                </div>

                
                {/* classroom table  & page status view students*/}
                {pageStatus === "view-students" && (
                    <div className="classrooms__students-table-wrap mt-4 overflow-x-auto rounded-xl border">
                        {selectedClassroom.students && selectedClassroom.students.length > 0 ? (
                            
                                <table className="classrooms__students-table w-full min-w-[52rem] border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="classrooms__th-checkbox px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    className="classrooms__checkbox"
                                                    checked={allStudentsSelected}
                                                    onChange={handleToggleSelectAll}
                                                    aria-label="Select all students"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">LRN</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Student Name</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Sex</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Age</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Birthdate</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Email</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Enrollment ID</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedClassroom.students.map((student) => (
                                            <tr key={student.enrollmentId} className={selectedStudentIds.includes(student.enrollmentId) ? "classrooms__row--selected" : ""}>
                                                <td className="classrooms__td-checkbox px-4 py-3.5">
                                                    <input
                                                        type="checkbox"
                                                        className="classrooms__checkbox"
                                                        checked={selectedStudentIds.includes(student.enrollmentId)}
                                                        onChange={() => handleToggleStudentSelection(student.enrollmentId)}
                                                        aria-label={`Select ${student.fullname}`}
                                                    />
                                                </td>
                                                <td className="classrooms__cell--lrn px-4 py-3.5 font-mono text-[0.8125rem]">
                                                    {student.studentLrn}
                                                </td>
                                                <td className="classrooms__cell--name px-4 py-3.5">
                                                    <div className="classrooms__student-cell flex items-center gap-3">
                                                        <span className="classrooms__student-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold uppercase" aria-hidden="true">
                                                            {getInitials(student.fullname)}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="classrooms__student-name truncate text-[0.8125rem] font-bold">{student.fullname}</p>
                                                            <p className="classrooms__student-meta mt-0.5 font-mono text-[0.6875rem]">Student ID #{student.studentId}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`classrooms__sex inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold capitalize classrooms__sex--${student.studentSex.toLowerCase()}`}>
                                                        {student.studentSex}
                                                    </span>
                                                </td>
                                                <td className="classrooms__cell--age px-4 py-3.5">
                                                    {student.studentAge}
                                                </td>
                                                <td className="classrooms__cell--date px-4 py-3.5">
                                                    {student.studentBirthdate}
                                                </td>
                                                <td className="classrooms__cell--email px-4 py-3.5">
                                                    {student.studentEmail}
                                                </td>
                                                <td className="classrooms__cell--id px-4 py-3.5 font-mono text-[0.8125rem]">
                                                    #{student.enrollmentId}
                                                </td>
                                                <td className="classrooms__cell--action px-4 py-3.5">
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
                        {classroomTeachersWithSubject && classroomTeachersWithSubject.length > 0 ? (
                            <div className="classrooms__subjects-table-wrap overflow-x-auto rounded-xl border">
                                <table className="classrooms__subjects-table w-full min-w-[32rem] border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Teacher</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Subject</th>
                                            <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classroomTeachersWithSubject.map((item) => (
                                            <tr key={`${item.teacherId}-${item.subjectId}`}>
                                                <td className="px-4 py-3.5">
                                                    <div className="classrooms__subjects-teacher inline-flex items-center gap-3">
                                                        <span className="classrooms__subjects-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold" aria-hidden="true">
                                                            {getInitials(item.teacherFullname)}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <span className="classrooms__subjects-teacher-name block truncate text-[0.8125rem] font-bold">{item.teacherFullname}</span>
                                                            <span className="classrooms__subjects-teacher-meta mt-0.5 block font-mono text-[0.6875rem]">{item.code} &middot; {item.unit} unit{item.unit > 1 ? "s" : ""}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="classrooms__subjects-subject inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold">
                                                        <span className="classrooms__subjects-subject-icon" aria-hidden="true">
                                                            <FiBookOpen />
                                                        </span>
                                                        {item.subjectName}
                                                    </span>
                                                </td>

                                                <td className="classrooms__subjects-actions px-4 py-3.5">
                                                    <button className="classrooms__subjects-actions-icon inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                                    onClick={() => 
                                                        handleChangeSubjectTeacherClickEvent(item.subjectId, selectedClassroom.id)
                                                    }
                                                    aria-label={`Change teacher for ${item.subjectName}`}
                                                    >
                                                        <FiEdit />
                                                    </button>
                                                    <button 
                                                    className="classrooms__subjects-actions-icon inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                                    onClick={(e) => {
                                                        // Capture the clicked button so focus returns to it when the dialog closes
                                                        deleteTriggerRef.current = e.currentTarget;
                                                        setDeleteTarget({ subjectId: item.subjectId, teacherId: item.teacherId, classId: selectedClassroom.id });
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

</div>

{/* classroom Modal */}
{isModalOpen && (
    <div
        className="classrooms-modal fixed inset-0 z-[1000] grid place-items-center p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="classrooms-modal-title"
        onMouseDown={handleOverlayMouseDown}
    >
        <div className="classrooms-modal__panel flex w-full max-w-[36rem] flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
            <header className="classrooms-modal__header flex shrink-0 items-start justify-between gap-4 p-6 pb-5">
                <div className="classrooms-modal__heading">
                    <span className="classrooms-modal__eyebrow uppercase tracking-[0.08em]">
                        {modalStatus === "create-class" && "Create Classroom" }
                        {modalStatus === "edit-class" && "Edit Classroom" }
                        {modalStatus === "create-subject" && "Create Subject" }
                        {modalStatus === "edit-subject-teachers" && "Assign Teacher" }
                        {modalStatus === "assign-adviser" && "Class Adviser" }
                    </span>
                    <h3 id="classrooms-modal-title" className="classrooms-modal__title mt-0.5 text-xl font-bold">
                        {modalStatus === "create-class" && "New Classroom Section" }
                        {modalStatus === "edit-class" && "Update Classroom Section" }
                        {modalStatus === "create-subject" && "New Subject" }
                        {modalStatus === "edit-subject-teachers" && "Change Subject Teacher" }
                        {modalStatus === "assign-adviser" && "Assign Class Adviser" }
                    </h3>
                    <p className="classrooms-modal__subtitle mt-1 text-[0.8125rem]">
                        {modalStatus === "create-class" && "Fill out the form below to create a new classroom." }
                        {modalStatus === "edit-class" && `Update the section and grade level for ${editingClassroom?.section ?? "this classroom"}.` }
                        {modalStatus === "create-subject" && `Select the subjects to add to ${selectedClassroom?.section ?? "this classroom"}.` }
                        {modalStatus === "edit-subject-teachers" && "Choose the teacher who will handle this subject in the classroom." }
                        {modalStatus === "assign-adviser" && `Choose the adviser for ${selectedClassroom?.section ?? "this classroom"}. Each teacher advises at most one class.` }
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
              modalStatus === "edit-subject-teachers" ? handleSubmitOfEditSubjectTeachers :
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
                                            <span className="classrooms-subject-picker__avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase" aria-hidden="true">
                                                {st.subjectName.trim().charAt(0) || "?"}
                                            </span>
                                            <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                                <span className="classrooms-subject-picker__name truncate text-sm font-bold">{st.subjectName}</span>
                                                <span className="classrooms-subject-picker__meta flex items-center gap-1.5 text-xs">
                                                    <span className="classrooms-subject-picker__code shrink-0 rounded-full px-1.5 py-px font-mono text-[0.625rem] font-bold">{st.subjectCode}</span>
                                                </span>
                                            </span>
                                            <span className="classrooms-subject-picker__check inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">✓</span>
                                        </label>

                                        {selectedSubjectIds.includes(st.subjectId) && (
                                            <div className="classrooms-subject-picker__teachers border-t border-dashed px-3 pb-3 pt-2.5" aria-live="polite">
                                                <div className="classrooms-subject-picker__teachers-head flex items-center justify-between gap-2">
                                                    <span className="classrooms-subject-picker__teachers-title text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Assign teacher</span>
                                                    {st.teachers.length > 0 && (
                                                        <span className="classrooms-subject-picker__teachers-count shrink-0 rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold">
                                                            {st.teachers.length} teacher{st.teachers.length === 1 ? "" : "s"}
                                                        </span>
                                                    )}
                                                </div>

                                                {st.teachers.length > 0 ? (
                                                    <div className="classrooms-subject-picker__teachers-list mt-2 flex flex-col gap-1.5">
                                                        {st.teachers.map((t) => (
                                                            <label
                                                                key={t.teacherId}
                                                                className="classrooms-subject-picker__teacher-option relative flex cursor-pointer items-center gap-2.5 rounded-lg border p-2"
                                                                htmlFor={`add-subject-teacher-${st.subjectId}-${t.teacherId}`}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={`add-subject-teacher-${st.subjectId}`}
                                                                    id={`add-subject-teacher-${st.subjectId}-${t.teacherId}`}
                                                                    value={t.teacherId}
                                                                    onChange={(e) => handleNewClassroomSubjectAddedChangeEvent(e, st.subjectId)}
                                                                />
                                                                <span className="classrooms-subject-picker__avatar classrooms-subject-picker__avatar--sm inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase" aria-hidden="true">
                                                                    {t.teacherFullname.trim().charAt(0) || "?"}
                                                                </span>
                                                                <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                                                    <span className="classrooms-subject-picker__name truncate text-sm font-bold">{t.teacherFullname}</span>
                                                                </span>
                                                                <span className="classrooms-subject-picker__check inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">✓</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="classrooms-subject-picker__teachers-empty mt-2 rounded-lg border border-dashed bg-white p-2 text-xs">
                                                        No teachers are currently teaching this subject.
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
                                {allTeachers === null ? "…" : `${allTeachers.length} teacher${allTeachers.length === 1 ? "" : "s"}`}
                            </span>
                        </div>

                        {allTeachers && allTeachers.length > 0 ? (
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
                                        <span className="classrooms-subject-picker__avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase classrooms-subject-picker__avatar--sm" aria-hidden="true">—</span>
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
                                {allTeachers.map((teacher) => {
                                    const isCurrent = selectedClassroom?.adviserId === teacher.id;
                                    const takenSection = adviserTakenBy[teacher.id];
                                    const isTaken = takenSection !== undefined;
                                    return (
                                        <div key={teacher.id} className={`classrooms-subject-picker__field rounded-lg border ${isCurrent ? "classrooms-subject-picker__field--selected" : ""} ${isTaken ? "classrooms-subject-picker__field--taken" : ""}`}>
                                            <label className={`classrooms-subject-picker__label relative flex cursor-pointer items-center gap-2.5 p-2.5 text-sm ${isTaken ? "classrooms-subject-picker__label--taken" : ""}`} htmlFor={`assign-adviser-${teacher.id}`}>
                                                <input
                                                    type="radio"
                                                    name="class-adviser"
                                                    id={`assign-adviser-${teacher.id}`}
                                                    value={teacher.id}
                                                    disabled={isTaken}
                                                    checked={adviserSelection === teacher.id}
                                                    onChange={() => setAdviserSelection(teacher.id)}
                                                />
                                                <span className="classrooms-subject-picker__avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase" aria-hidden="true">
                                                    {teacher.fullname.trim().charAt(0) || "?"}
                                                </span>
                                                <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                                    <span className="classrooms-subject-picker__name truncate text-sm font-bold">{teacher.fullname}</span>
                                                    <span className="classrooms-subject-picker__meta flex items-center gap-1.5 text-xs">
                                                        <span className="classrooms-subject-picker__code shrink-0 rounded-full px-1.5 py-px font-mono text-[0.625rem] font-bold">{teacher.email}</span>
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
                        ) : allTeachers !== null ? (
                            <div className="classrooms-subject-picker__empty flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
                                <span className="classrooms-subject-picker__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full" aria-hidden="true">
                                    <FiUserCheck />
                                </span>
                                <p className="classrooms-subject-picker__empty-title mt-3 text-sm font-bold">No teachers available</p>
                                <p className="classrooms-subject-picker__empty-text mt-1 text-[0.8125rem]">Create a teacher record before assigning a class adviser.</p>
                            </div>
                        ) : (
                            <div className="classrooms-subject-picker__empty flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center">
                                <p className="classrooms-subject-picker__empty-title mt-3 text-sm font-bold">Loading teachers…</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Edit Subject Teachers modal form */}
                {modalStatus === "edit-subject-teachers" && (
                    <div className="classrooms-subject-picker flex min-h-0 flex-1 flex-col gap-3.5">
                        <div className="classrooms-subject-picker__head flex items-center justify-between gap-4">
                            <p className="classrooms-subject-picker__hint text-[0.8125rem]">
                                Choose a teacher for <strong className="font-bold">{subjectTeachers?.[0]?.subjectName ?? "this subject"}</strong>
                            </p>
                            <span className="classrooms-subject-picker__count shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold" aria-live="polite">
                                {subjectTeachers === null ? "…" : `${subjectTeachers.length} teacher${subjectTeachers.length === 1 ? "" : "s"} available`}
                            </span>
                        </div>

                        {subjectTeachers && subjectTeachers.length > 0 ? (
                            <div className="classrooms-subject-picker__grid flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto pr-1">
                                {subjectTeachers.map((st) => (
                                    <div key={st.teacherId} className="classrooms-subject-picker__field rounded-lg border">
                                        <label className="classrooms-subject-picker__label relative flex cursor-pointer items-center gap-2.5 p-2.5 text-sm" htmlFor={`edit-teacher-${st.teacherId}`}>
                                          <input
                                              type="radio"
                                              name="subject-teachers"
                                              id={`edit-teacher-${st.teacherId}`}
                                              value={st.teacherId}
                                              onChange={(e) => {
                                                handleEditSubjectTeacherChangeEvent(e, st.subjectId);
                                              }}
                                          />
                                            <span className="classrooms-subject-picker__avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase" aria-hidden="true">
                                              {st.teacherFullname.trim().charAt(0) || "?"}
                                            </span>
                                            <span className="classrooms-subject-picker__info flex min-w-0 flex-col">
                                                <span className="classrooms-subject-picker__name truncate text-sm font-bold">
                                                  {st.teacherFullname}
                                                </span>
                                                <span className="classrooms-subject-picker__meta flex items-center gap-1.5 text-xs">
                                                    <span className="classrooms-subject-picker__code shrink-0 rounded-full px-1.5 py-px font-mono text-[0.625rem] font-bold">{st.subjectCode}</span>
                                                    <span className="classrooms-subject-picker__teacher truncate">{st.subjectName} &middot; {st.subjectUnit} unit{st.subjectUnit === 1 ? "" : "s"}</span>
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
                                <p className="classrooms-subject-picker__empty-title mt-3 text-sm font-bold">No teachers available</p>
                                <p className="classrooms-subject-picker__empty-text mt-1 text-[0.8125rem]">No teachers are currently teaching this subject.</p>
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
                        {modalStatus === "edit-subject-teachers" && "Update Assigned Teachers"}
                        {modalStatus === "assign-adviser" && (assigningAdviser ? "Saving…" : adviserSelection === null ? "Remove Adviser" : "Assign Adviser")}
                    </button>
                </footer>
            </form>
        </div>
    </div>
)}

{/* Delete subject confirmation dialog */}
<ConfirmDialog
    open={deleteTarget !== null}
    title="Delete subject from classroom?"
    description={
        pendingDeleteSubject
            ? `This will remove ${pendingDeleteSubject.subjectName} and its assigned teacher from ${selectedClassroom?.section ?? "this classroom"}. This cannot be undone.`
            : "This will remove the subject and its assigned teacher from the classroom. This cannot be undone."
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
</section>
);
}
