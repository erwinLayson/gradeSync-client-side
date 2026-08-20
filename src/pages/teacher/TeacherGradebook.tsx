import {
    FiArrowLeft,
    FiBookOpen,
    FiEdit3,
    FiPlus,
    FiSave,
    FiSettings,
    FiTrash2,
    FiUsers,
    FiX,
} from "react-icons/fi";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
    type FormEvent,
    type MouseEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

import { deleteAPICall, getAPICall, patchAPICall, postAPICall, putAPICall } from "../../api/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { getInitials } from "../../helper/initials";
import { toast } from "../../helper/toast";

import type { Assessment, AssessmentType } from "../../constant/assessment";
import type { GradeWeights } from "../../constant/gradingWeights";

import "../../style/teacherGradebook.css";

// ================= Types =================

interface StudentAttendanceSummary {
    presentDays: number;
    totalDays: number;
    percentage: number;
}

interface StudentGradebookRow {
    enrollmentId: number;
    studentId: number;
    studentLrn: number | string;
    fullname: string;
    scores: Record<number, number>;
    totalScore: number;
    totalMaxScore: number;
    attendance: StudentAttendanceSummary | null;
    quarterGrade: number | null;
    remarks: string | null;
}

interface GradebookDetails {
    classId: number;
    classSubjectId: number;
    classSection: string;
    classLevel: number;
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    quarter: number;
    assessment: Assessment[];
    gradingWeights: GradeWeights;
    student: StudentGradebookRow[];
}

/** Draft score sheet: draftScores[enrollmentId][assessmentId] -> raw input string. */
type DraftScores = Record<number, Record<number, string>>;

interface AssessmentFormState {
    title: string;
    type: AssessmentType;
    maxScore: string;
    dateGiven: string;
}

type AssessmentModalState = { mode: "create" } | { mode: "edit"; assessment: Assessment } | null;

interface ComputedRow {
    totalScore: number;
    totalMaxScore: number;
    quarterGrade: number | null;
    remarks: string | null;
}

// ================= Constants =================

const QUARTERS = [1, 2, 3, 4] as const;

const ASSESSMENT_TYPE_META: Record<AssessmentType, { label: string; short: string }> = {
    written_work: { label: "Written Work", short: "WW" },
    performance_task: { label: "Performance Task", short: "PT" },
    quarterly_assessment: { label: "Quarterly Assessment", short: "QA" },
};

const EMPTY_ASSESSMENT_FORM: AssessmentFormState = {
    title: "",
    type: "written_work",
    maxScore: "",
    dateGiven: "",
};

const WEIGHTS_FIELD_LABELS: Array<{ key: keyof GradeWeights; label: string; hint?: string }> = [
    { key: "writtenWorkWeight", label: "Written Work" },
    { key: "performanceTaskWeight", label: "Performance Task" },
    { key: "quarterlyAssessmentWeight", label: "Quarterly Assessment" },
    { key: "attendanceWeight", label: "Attendance", hint: "Set 0 to exclude attendance from the grade" },
];

// ================= Helpers =================

// Recompute totals / quarter grade / remarks for one student from the draft
// scores, mirroring the server's formula (weighted percentages per component).
function computeStudentRow(
    assessments: Assessment[],
    weights: GradeWeights,
    draftRow: Record<number, string> | undefined,
    attendance: StudentAttendanceSummary | null,
): ComputedRow {
    const gradedAssessments = assessments.filter((assessment) => {
        const raw = draftRow?.[assessment.id];
        return raw !== undefined && raw.trim() !== "";
    });

    const totalScore = gradedAssessments.reduce((sum, assessment) => sum + Number(draftRow?.[assessment.id]), 0);
    const totalMaxScore = gradedAssessments.reduce((sum, assessment) => sum + Number(assessment.maxScore), 0);

    const weightByType: Record<AssessmentType, number> = {
        written_work: Number(weights.writtenWorkWeight),
        performance_task: Number(weights.performanceTaskWeight),
        quarterly_assessment: Number(weights.quarterlyAssessmentWeight),
    };

    const assessmentTypes: AssessmentType[] = ["written_work", "performance_task", "quarterly_assessment"];

    let weightedPercentageSum = 0;
    let activeWeightSum = 0;

    for (const assessmentType of assessmentTypes) {
        const typeAssessments = gradedAssessments.filter((assessment) => assessment.type === assessmentType);
        if (typeAssessments.length === 0) continue;

        const earnedScoreSum = typeAssessments.reduce((sum, assessment) => sum + Number(draftRow?.[assessment.id]), 0);
        const maxScoreSum = typeAssessments.reduce((sum, assessment) => sum + Number(assessment.maxScore), 0);
        if (maxScoreSum === 0) continue;

        const typePercentage = (earnedScoreSum / maxScoreSum) * 100;
        weightedPercentageSum += typePercentage * weightByType[assessmentType];
        activeWeightSum += weightByType[assessmentType];
    }

    const attendanceWeight = Number(weights.attendanceWeight);
    if (attendance && attendance.totalDays > 0 && attendanceWeight > 0) {
        const attendancePercentage = (attendance.presentDays / attendance.totalDays) * 100;
        weightedPercentageSum += attendancePercentage * attendanceWeight;
        activeWeightSum += attendanceWeight;
    }

    const quarterGrade =
        activeWeightSum === 0 ? null : Math.round((weightedPercentageSum / activeWeightSum) * 100) / 100;
    const remarks = quarterGrade === null ? null : quarterGrade >= 75 ? "Passed" : "Failed";

    return { totalScore, totalMaxScore, quarterGrade, remarks };
}

// Build the draft map from freshly fetched data (server scores -> input strings).
function buildDraftScores(data: GradebookDetails | null): DraftScores {
    const draft: DraftScores = {};
    if (!data) return draft;

    for (const student of data.student) {
        const row: Record<number, string> = {};
        for (const assessment of data.assessment) {
            const score = student.scores[assessment.id];
            row[assessment.id] = score === undefined ? "" : String(score);
        }
        draft[student.enrollmentId] = row;
    }
    return draft;
}

// Convert a display date ("Aug 15, 2026") to a yyyy-mm-dd value for date inputs.
function toDateInputValue(dateGiven: string | null): string {
    if (!dateGiven) return "";
    const date = new Date(dateGiven);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export default function TeacherGradebook() {
    const navigate = useNavigate();
    const { classId } = useParams(); // URL param is actually the class_subjects id
    const classSubjectId = Number(classId);

    // ================ pages Data ================
    const [loading, setLoading] = useState<boolean>(true);
    const [quarter, setQuarter] = useState<number>(1);
    const [gradeBookDetails, setGradeBookDetails] = useState<GradebookDetails | null>(null);
    const [draftScores, setDraftScores] = useState<DraftScores>({});
    const [savingScores, setSavingScores] = useState<boolean>(false);

    // ================ Assessment modal / delete state ================
    const [modal, setModal] = useState<AssessmentModalState>(null);
    const [modalForm, setModalForm] = useState<AssessmentFormState>(EMPTY_ASSESSMENT_FORM);
    const [savingAssessment, setSavingAssessment] = useState<boolean>(false);
    const [deletingAssessment, setDeletingAssessment] = useState<Assessment | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    // ================ Grading weights editor state ================
    const [weightsModalOpen, setWeightsModalOpen] = useState<boolean>(false);
    const [weightsForm, setWeightsForm] = useState<Record<keyof GradeWeights, string>>({
        writtenWorkWeight: "",
        performanceTaskWeight: "",
        quarterlyAssessmentWeight: "",
        attendanceWeight: "",
    });
    const [savingWeights, setSavingWeights] = useState<boolean>(false);

    // ================= Fetch gradebook details ================
    // No synchronous setState in this function's pre-await path, so calling it
    // from the mount/quarter effect does not trigger cascading renders.
    async function fetchGradebook(targetQuarter: number) {
        if (Number.isNaN(classSubjectId)) return;
        try {
            const response = await getAPICall<GradebookDetails>(
                `/gradebook/${classSubjectId}/details?quarter=${targetQuarter}`,
            );
            const data = response.data ?? null;
            setGradeBookDetails(data);
            setDraftScores(buildDraftScores(data));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchGradebook(quarter);
        // fetchGradebook is recreated every render; quarter is the only input
        // that should trigger a refetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quarter]);

    function handleQuarterChange(targetQuarter: number) {
        if (targetQuarter === quarter) return;
        setLoading(true);
        setQuarter(targetQuarter);
    }

    // ================= Derived state ================
    const assessments = useMemo(() => gradeBookDetails?.assessment ?? [], [gradeBookDetails]);
    const students = useMemo(() => gradeBookDetails?.student ?? [], [gradeBookDetails]);

    const assessmentCounts = useMemo(() => {
        const counts: Record<AssessmentType, number> = {
            written_work: 0,
            performance_task: 0,
            quarterly_assessment: 0,
        };
        for (const assessment of assessments) {
            counts[assessment.type] += 1;
        }
        return counts;
    }, [assessments]);

    const isDirty = useMemo(() => {
        if (!gradeBookDetails) return false;
        for (const student of students) {
            const draftRow = draftScores[student.enrollmentId];
            for (const assessment of assessments) {
                const loaded = student.scores[assessment.id];
                const current = draftRow?.[assessment.id] ?? "";
                if (current !== (loaded === undefined ? "" : String(loaded))) {
                    return true;
                }
            }
        }
        return false;
    }, [gradeBookDetails, students, assessments, draftScores]);

    const computedRows = useMemo(() => {
        const rows: ComputedRow[] = [];
        if (!gradeBookDetails) return rows;
        for (const student of students) {
            rows.push(
                computeStudentRow(
                    assessments,
                    gradeBookDetails.gradingWeights,
                    draftScores[student.enrollmentId],
                    student.attendance,
                ),
            );
        }
        return rows;
    }, [gradeBookDetails, students, assessments, draftScores]);

    const passedCount = computedRows.filter((row) => row.remarks === "Passed").length;
    const failedCount = computedRows.filter((row) => row.remarks === "Failed").length;

    const attendanceWeight = useMemo(
        () => (gradeBookDetails ? Number(gradeBookDetails.gradingWeights.attendanceWeight) : 0),
        [gradeBookDetails],
    );

    // ================= Score sheet handlers ================
    function handleScoreChange(enrollmentId: number, assessmentId: number, value: string) {
        setDraftScores((prev) => {
            const row = { ...(prev[enrollmentId] ?? {}) };
            row[assessmentId] = value;
            return { ...prev, [enrollmentId]: row };
        });
    }

    async function handleSaveScores() {
        if (!gradeBookDetails || !isDirty || savingScores) return;
        setSavingScores(true);
        try {
            // Only touch assessments whose sheet actually changed.
            const changedAssessmentIds = new Set<number>();
            for (const student of students) {
                const draftRow = draftScores[student.enrollmentId];
                for (const assessment of assessments) {
                    const loaded = student.scores[assessment.id];
                    const current = draftRow?.[assessment.id] ?? "";
                    if (current !== (loaded === undefined ? "" : String(loaded))) {
                        changedAssessmentIds.add(assessment.id);
                    }
                }
            }

            const assessmentsToSave = assessments.filter((assessment) => changedAssessmentIds.has(assessment.id));
            if (assessmentsToSave.length === 0) return;

            await Promise.all(
                assessmentsToSave.map((assessment) => {
                    const scores = students
                        .map((student) => {
                            const raw = draftScores[student.enrollmentId]?.[assessment.id];
                            const score = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
                            return { enrollmentId: student.enrollmentId, score };
                        })
                        .filter((entry) => !Number.isNaN(entry.score));

                    return postAPICall(`/assessments/${assessment.id}/scores`, { scores }, { toast: false });
                }),
            );

            toast.success("Scores saved successfully");
            await fetchGradebook(quarter);
        } finally {
            setSavingScores(false);
        }
    }

    // ================= Assessment modal handlers ================
    function openCreateModal() {
        setModalForm({ ...EMPTY_ASSESSMENT_FORM });
        setModal({ mode: "create" });
    }

    function openEditModal(assessment: Assessment) {
        setModalForm({
            title: assessment.title,
            type: assessment.type,
            maxScore: String(assessment.maxScore),
            dateGiven: toDateInputValue(assessment.dateGiven),
        });
        setModal({ mode: "edit", assessment });
    }

    const closeModal = useCallback(() => {
        setModal(null);
    }, []);

    function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) {
            closeModal();
        }
    }

    function handleModalInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = event.target;
        setModalForm((prev) => ({ ...prev, [name]: value }));
    }

    async function handleAssessmentSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!gradeBookDetails || !modal || savingAssessment) return;

        const title = modalForm.title.trim();
        const maxScore = Number(modalForm.maxScore);

        if (!title) {
            toast.warning("Please fill in the title field.");
            return;
        }
        if (Number.isNaN(maxScore) || maxScore <= 0) {
            toast.warning("Max score must be a number greater than 0.");
            return;
        }

        const payload = {
            title,
            type: modalForm.type,
            maxScore,
            // Empty string clears the date on edit; null is fine on create too.
            dateGiven: modalForm.dateGiven || null,
        };

        setSavingAssessment(true);
        try {
            if (modal.mode === "create") {
                await postAPICall(
                    "/assessments",
                    {
                        classSubjectId: gradeBookDetails.classSubjectId,
                        quarter,
                        ...payload,
                    },
                    { toast: false },
                );
                toast.success("Assessment created successfully");
            } else {
                await patchAPICall(`/assessments/${modal.assessment.id}`, payload, { toast: false });
                toast.success("Assessment updated successfully");
            }
            setModal(null);
            await fetchGradebook(quarter);
        } finally {
            setSavingAssessment(false);
        }
    }

    // Escape closes any open modal + locks body scroll while one is open
    useEffect(() => {
        if (!modal && !weightsModalOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (modal) closeModal();
            if (weightsModalOpen) setWeightsModalOpen(false);
        };

        document.addEventListener("keydown", handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [modal, weightsModalOpen, closeModal]);

    // ================= Delete assessment ================
    async function handleDeleteAssessment() {
        if (!deletingAssessment || deleting) return;
        setDeleting(true);
        try {
            await deleteAPICall(`/assessments/${deletingAssessment.id}`, { toast: false });
            toast.success("Assessment deleted successfully");
            setDeletingAssessment(null);
            await fetchGradebook(quarter);
        } finally {
            setDeleting(false);
        }
    }

    // ================= Grading weights handlers ================
    function openWeightsModal() {
        if (!gradeBookDetails) return;
        const weights = gradeBookDetails.gradingWeights;
        setWeightsForm({
            writtenWorkWeight: String(weights.writtenWorkWeight),
            performanceTaskWeight: String(weights.performanceTaskWeight),
            quarterlyAssessmentWeight: String(weights.quarterlyAssessmentWeight),
            attendanceWeight: String(weights.attendanceWeight),
        });
        setWeightsModalOpen(true);
    }

    function closeWeightsModal() {
        setWeightsModalOpen(false);
    }

    function handleWeightsOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) {
            closeWeightsModal();
        }
    }

    function handleWeightsInputChange(event: ChangeEvent<HTMLInputElement>) {
        const { name, value } = event.target;
        setWeightsForm((prev) => ({ ...prev, [name]: value }));
    }

    const weightsTotal = useMemo(() => {
        const values = Object.values(weightsForm).map((raw) => (raw.trim() === "" ? Number.NaN : Number(raw)));
        return values.some(Number.isNaN) ? Number.NaN : values.reduce((sum, value) => sum + value, 0);
    }, [weightsForm]);

    async function handleWeightsSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!gradeBookDetails || savingWeights) return;

        // Empty fields must be filled in — never silently convert them to 0.
        if (Object.values(weightsForm).some((raw) => raw.trim() === "")) {
            toast.warning("All weight fields are required.");
            return;
        }

        const [writtenWorkWeight, performanceTaskWeight, quarterlyAssessmentWeight, attendanceWeight] =
            Object.values(weightsForm).map(Number);
        if (
            [writtenWorkWeight, performanceTaskWeight, quarterlyAssessmentWeight, attendanceWeight].some(
                (value) => value < 0,
            )
        ) {
            toast.warning("All weights must be 0 or greater.");
            return;
        }
        if (weightsTotal > 100) {
            toast.warning(`Weights total ${weightsTotal}, which exceeds the maximum of 100.`);
            return;
        }

        setSavingWeights(true);
        try {
            await putAPICall(
                `/class-subjects/${gradeBookDetails.classSubjectId}/weights`,
                {
                    writtenWorkWeight,
                    performanceTaskWeight,
                    quarterlyAssessmentWeight,
                    attendanceWeight,
                },
                { toast: false },
            );
            toast.success("Grading weights updated successfully");
            setWeightsModalOpen(false);
            await fetchGradebook(quarter);
        } finally {
            setSavingWeights(false);
        }
    }

    // =============== handle back to class List button ================
    const handleBackToClassList = () => {
        navigate("/teacher/classes");
    };

    if (loading) {
        return (
            <div className="teacher-gradebook__loading flex h-full w-full items-center justify-center">
                <FiUsers className="animate-spin text-4xl text-gray-500" />
            </div>
        );
    }

    return (
        <section className="teacher-gradebook flex flex-col gap-5">
            {/* ==================== Back button ==================== */}
            <button
                type="button"
                className="teacher-gradebook__back inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-lg border px-3.5 py-2 text-[0.8125rem] font-semibold"
                aria-label="Back to class list"
                onClick={handleBackToClassList}
            >
                <FiArrowLeft aria-hidden="true" />
                <span className="text-sm font-bold">Back to Classes</span>
            </button>

            {/* ==================== Hero banner ==================== */}
            {gradeBookDetails && (
                <div className="teacher-gradebook__hero flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="teacher-gradebook__hero-main flex min-w-0 items-center gap-4">
                        <span
                            className="teacher-gradebook__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl"
                            aria-hidden="true"
                        >
                            <FiBookOpen />
                        </span>
                        <div className="teacher-gradebook__hero-heading min-w-0">
                            <span className="teacher-gradebook__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                                Grade {gradeBookDetails.classLevel} &middot; {gradeBookDetails.classSection}
                            </span>
                            <h2 className="teacher-gradebook__hero-name mt-1 truncate text-[1.375rem] font-bold">
                                {gradeBookDetails.subjectName}
                            </h2>
                            <p className="teacher-gradebook__hero-role mt-0.5 truncate text-[0.8125rem]">
                                {gradeBookDetails.subjectCode}
                            </p>
                        </div>
                    </div>
                    <div className="teacher-gradebook__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                        <span className="teacher-gradebook__hero-badge-count text-[1.375rem] font-bold leading-none">
                            Q{quarter}
                        </span>
                        <span className="teacher-gradebook__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Quarter
                        </span>
                    </div>
                </div>
            )}

            {/* ==================== Quarter tabs + actions ==================== */}
            <div className="teacher-gradebook__toolbar flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="teacher-gradebook__tabs flex items-center gap-1.5" role="tablist" aria-label="Select quarter">
                    {QUARTERS.map((q) => (
                        <button
                            key={q}
                            type="button"
                            role="tab"
                            aria-selected={quarter === q}
                            aria-label={`Quarter ${q}`}
                            className={`teacher-gradebook__tab inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-[0.8125rem] font-bold transition-colors${
                                quarter === q ? " teacher-gradebook__tab--active" : ""
                            }`}
                            onClick={() => handleQuarterChange(q)}
                        >
                            Quarter {q}
                        </button>
                    ))}
                </div>
                <div className="teacher-gradebook__toolbar-actions flex items-center gap-2">
                    <button
                        type="button"
                        className="teacher-gradebook__weights inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-[0.8125rem] font-bold"
                        disabled={!gradeBookDetails}
                        onClick={openWeightsModal}
                    >
                        <FiSettings aria-hidden="true" />
                        Grading Weights
                    </button>
                    <button
                        type="button"
                        className="teacher-gradebook__add inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-bold"
                        onClick={openCreateModal}
                    >
                        <FiPlus aria-hidden="true" />
                        Add Assessment
                    </button>
                </div>
            </div>

            {/* ==================== Component summary ==================== */}
            <div className="teacher-gradebook__chips grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(Object.keys(ASSESSMENT_TYPE_META) as AssessmentType[]).map((type) => {
                    const meta = ASSESSMENT_TYPE_META[type];
                    const count = assessmentCounts[type];
                    return (
                        <div key={type} className="teacher-gradebook__chip flex items-center gap-3 rounded-xl border p-4">
                            <span
                                className="teacher-gradebook__chip-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold"
                                aria-hidden="true"
                            >
                                {meta.short}
                            </span>
                            <div className="min-w-0">
                                <span className="teacher-gradebook__chip-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                    {meta.label}
                                </span>
                                <span className="teacher-gradebook__chip-value mt-0.5 block text-[1.125rem] font-bold">
                                    {count} assessment{count === 1 ? "" : "s"}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ==================== Score sheet ==================== */}
            <div className="teacher-gradebook__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="teacher-gradebook__card-head flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="teacher-gradebook__card-heading min-w-0">
                        <h3 className="teacher-gradebook__card-title text-base font-bold">Score Sheet</h3>
                        <p className="teacher-gradebook__card-subtitle mt-1 text-[0.8125rem]">
                            {students.length} students &middot; Quarter {quarter}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="teacher-gradebook__save inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-bold hover:cursor-pointer"
                        disabled={!isDirty || savingScores}
                        onClick={handleSaveScores}
                    >
                        <FiSave/> {savingScores ? "Saving…" : isDirty ? "Save Scores" : "Saved"}
                    </button>
                </div>

                {assessments.length === 0 ? (
                    <div className="teacher-gradebook__empty flex flex-col items-center justify-center px-6 py-16 text-center">
                        <span
                            className="teacher-gradebook__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full"
                            aria-hidden="true"
                        >
                            <FiBookOpen />
                        </span>
                        <p className="teacher-gradebook__empty-title mt-3 text-sm font-bold">
                            No assessments yet for Quarter {quarter}
                        </p>
                        <p className="teacher-gradebook__empty-text mt-1 text-[0.8125rem]">
                            Add an assessment to start recording scores for this class.
                        </p>
                        <button
                            type="button"
                            className="teacher-gradebook__add teacher-gradebook__empty-add mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-bold"
                            onClick={openCreateModal}
                        >
                            <FiPlus aria-hidden="true" />
                            Add Assessment
                        </button>
                    </div>
                ) : students.length === 0 ? (
                    <div className="teacher-gradebook__empty flex flex-col items-center justify-center px-6 py-16 text-center">
                        <span
                            className="teacher-gradebook__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full"
                            aria-hidden="true"
                        >
                            <FiUsers />
                        </span>
                        <p className="teacher-gradebook__empty-title mt-3 text-sm font-bold">No students enrolled</p>
                        <p className="teacher-gradebook__empty-text mt-1 text-[0.8125rem]">
                            Students will appear here once they are enrolled in this class.
                        </p>
                    </div>
                ) : (
                    <div className="teacher-gradebook__sheet-wrap overflow-x-auto">
                        <table className="teacher-gradebook__sheet w-full min-w-[60rem] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Student
                                    </th>

                                    {assessments.map((assessment) => (
                                        <th
                                            key={assessment.id}
                                            className="px-3 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]"
                                        >
                                            <div className="teacher-gradebook__assessment-cell flex min-w-[9rem] flex-col gap-1">
                                                <span className="teacher-gradebook__assessment-title flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em]">
                                                    <span className="teacher-gradebook__assessment-type inline-flex items-center rounded px-1.5 py-0.5 text-[0.625rem] font-bold">
                                                        {ASSESSMENT_TYPE_META[assessment.type].short}
                                                    </span>
                                                    <span className="truncate">{assessment.title}</span>
                                                </span>
                                                <span className="teacher-gradebook__assessment-meta font-mono text-[0.6875rem]">
                                                    {assessment.dateGiven ? `${assessment.dateGiven} · ` : ""}max{" "}
                                                    {assessment.maxScore}
                                                </span>
                                                <span className="teacher-gradebook__assessment-actions flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="teacher-gradebook__assessment-action inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded"
                                                        aria-label={`Edit ${assessment.title}`}
                                                        onClick={() => openEditModal(assessment)}
                                                    >
                                                        <FiEdit3 aria-hidden="true" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="teacher-gradebook__assessment-action teacher-gradebook__assessment-action--danger inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded"
                                                        aria-label={`Delete ${assessment.title}`}
                                                        onClick={() => setDeletingAssessment(assessment)}
                                                    >
                                                        <FiTrash2 aria-hidden="true" />
                                                    </button>
                                                </span>
                                            </div>
                                        </th>
                                    ))}

                                    <th className="px-3 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Total
                                    </th>
                                    <th className="px-3 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        <div className="flex flex-col gap-1">
                                            <span>Attendance</span>
                                            <span className="teacher-gradebook__attendance-meta font-mono text-[0.6875rem]">
                                                weight {attendanceWeight}%
                                            </span>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Grade
                                    </th>
                                    <th className="px-3 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                        Remarks
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, index) => {
                                    const draftRow = draftScores[student.enrollmentId] ?? {};
                                    const computed = computedRows[index] ?? {
                                        totalScore: 0,
                                        totalMaxScore: 0,
                                        quarterGrade: null,
                                        remarks: null,
                                    };
                                    return (
                                        <tr key={student.enrollmentId}>
                                            <td className="teacher-gradebook__cell--student px-4 py-3.5">
                                                <div className="teacher-gradebook__student-cell flex items-center gap-3">
                                                    <span
                                                        className="teacher-gradebook__student-avatar inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-bold uppercase"
                                                        aria-hidden="true"
                                                    >
                                                        {getInitials(student.fullname)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="teacher-gradebook__student-name truncate text-[0.8125rem] font-bold">
                                                            {student.fullname}
                                                        </p>
                                                        <p className="teacher-gradebook__student-lrn mt-0.5 font-mono text-[0.6875rem]">
                                                            LRN {student.studentLrn}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {assessments.map((assessment) => (
                                                <td
                                                    key={assessment.id}
                                                    className="teacher-gradebook__cell--score px-3 py-3.5 text-center"
                                                >
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        min={0}
                                                        max={Number(assessment.maxScore)}
                                                        step="0.01"
                                                        className="teacher-gradebook__score-input"
                                                        value={draftRow[assessment.id] ?? ""}
                                                        placeholder="—"
                                                        aria-label={`${student.fullname} score in ${assessment.title}`}
                                                        onChange={(event) =>
                                                            handleScoreChange(
                                                                student.enrollmentId,
                                                                assessment.id,
                                                                event.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                            ))}

                                            <td className="teacher-gradebook__cell--total px-3 py-3.5 text-center font-mono text-[0.8125rem] font-bold">
                                                {computed.totalMaxScore > 0
                                                    ? `${Math.round(computed.totalScore)}/${computed.totalMaxScore}`
                                                    : "—"}
                                            </td>
                                            <td className="px-3 py-3.5 text-center">
                                                {student.attendance && student.attendance.totalDays > 0 ? (
                                                    <span
                                                        className={`teacher-gradebook__attendance inline-flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1${
                                                            attendanceWeight > 0
                                                                ? student.attendance.percentage >= 90
                                                                    ? " teacher-gradebook__attendance--good"
                                                                    : student.attendance.percentage >= 75
                                                                      ? " teacher-gradebook__attendance--warn"
                                                                      : " teacher-gradebook__attendance--low"
                                                                : " teacher-gradebook__attendance--off"
                                                        }`}
                                                        title={
                                                            attendanceWeight > 0
                                                                ? undefined
                                                                : "Attendance is not counted toward the grade (weight is 0)"
                                                        }
                                                    >
                                                        <span className="font-mono text-[0.8125rem] font-bold leading-none">
                                                            {student.attendance.percentage.toFixed(0)}%
                                                        </span>
                                                        <span className="teacher-gradebook__attendance-days text-[0.625rem] leading-none">
                                                            {student.attendance.presentDays}/{student.attendance.totalDays} days
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="teacher-gradebook__attendance-empty"
                                                        title="No attendance records for this class yet"
                                                    >
                                                        No records
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3.5 text-center">
                                                {computed.quarterGrade !== null ? (
                                                    <span
                                                        className={`teacher-gradebook__grade inline-flex items-center justify-center rounded-lg px-2 py-1 font-mono text-[0.8125rem] font-bold${
                                                            computed.quarterGrade >= 75
                                                                ? " teacher-gradebook__grade--pass"
                                                                : " teacher-gradebook__grade--fail"
                                                        }`}
                                                    >
                                                        {computed.quarterGrade.toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[0.8125rem] text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3.5 text-center">
                                                {computed.remarks ? (
                                                    <span
                                                        className={`teacher-gradebook__remarks inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold${
                                                            computed.remarks === "Passed"
                                                                ? " teacher-gradebook__remarks--passed"
                                                                : " teacher-gradebook__remarks--failed"
                                                        }`}
                                                    >
                                                        {computed.remarks}
                                                    </span>
                                                ) : (
                                                    <span className="text-[0.8125rem] text-gray-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ==================== Sheet footer ==================== */}
                <div className="teacher-gradebook__card-foot flex flex-wrap items-center justify-between gap-3 p-5">
                    <p className="teacher-gradebook__foot-note flex items-center gap-2 text-[0.8125rem]">
                        <FiUsers aria-hidden="true" />
                        {students.length} students &middot; {passedCount} passed &middot; {failedCount} failed
                    </p>
                    
                </div>
            </div>

            {/* ==================== Assessment create/edit modal ==================== */}
            {modal && (
                <div
                    className="teacher-gradebook__modal fixed inset-0 z-[1000] grid place-items-center p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="teacher-gradebook-modal-title"
                    onMouseDown={handleOverlayMouseDown}
                >
                    <div className="teacher-gradebook__modal-panel w-full max-w-[30rem] overflow-y-auto rounded-3xl bg-white shadow-xl">
                        <header className="teacher-gradebook__modal-header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="teacher-gradebook__modal-heading">
                                <span className="teacher-gradebook__modal-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                    {modal.mode === "create" ? "New record" : "Edit record"}
                                </span>
                                <h3 id="teacher-gradebook-modal-title" className="teacher-gradebook__modal-title mt-0.5 text-xl font-bold">
                                    {modal.mode === "create" ? "Create Assessment" : "Edit Assessment"}
                                </h3>
                                <p className="teacher-gradebook__modal-subtitle mt-1 text-[0.8125rem]">
                                    {modal.mode === "create"
                                        ? `Add an assessment to Quarter ${quarter}`
                                        : `Update ${modal.assessment.title}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="teacher-gradebook__modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                                onClick={closeModal}
                                aria-label="Close modal"
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <form className="teacher-gradebook__form p-6" onSubmit={handleAssessmentSubmit} noValidate>
                            <div className="teacher-gradebook__form-grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="teacher-gradebook__form-field sm:col-span-2">
                                    <label
                                        htmlFor="assessment-title"
                                        className="teacher-gradebook__form-label text-[0.8125rem] font-semibold"
                                    >
                                        Title
                                    </label>
                                    <input
                                        id="assessment-title"
                                        type="text"
                                        className="teacher-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Quiz 1: Fractions"
                                        autoFocus
                                        name="title"
                                        value={modalForm.title}
                                        onChange={handleModalInputChange}
                                    />
                                </div>
                                <div className="teacher-gradebook__form-field">
                                    <label
                                        htmlFor="assessment-type"
                                        className="teacher-gradebook__form-label text-[0.8125rem] font-semibold"
                                    >
                                        Type
                                    </label>
                                    <select
                                        id="assessment-type"
                                        className="teacher-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        name="type"
                                        value={modalForm.type}
                                        onChange={handleModalInputChange}
                                    >
                                        {(Object.keys(ASSESSMENT_TYPE_META) as AssessmentType[]).map((type) => (
                                            <option key={type} value={type}>
                                                {ASSESSMENT_TYPE_META[type].label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="teacher-gradebook__form-field">
                                    <label
                                        htmlFor="assessment-max-score"
                                        className="teacher-gradebook__form-label text-[0.8125rem] font-semibold"
                                    >
                                        Max Score
                                    </label>
                                    <input
                                        id="assessment-max-score"
                                        type="number"
                                        min={0.01}
                                        step="0.01"
                                        className="teacher-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="20"
                                        name="maxScore"
                                        value={modalForm.maxScore}
                                        onChange={handleModalInputChange}
                                    />
                                </div>
                                <div className="teacher-gradebook__form-field sm:col-span-2">
                                    <label
                                        htmlFor="assessment-date"
                                        className="teacher-gradebook__form-label text-[0.8125rem] font-semibold"
                                    >
                                        Date Given{" "}
                                        <span className="teacher-gradebook__form-optional font-normal">(optional)</span>
                                    </label>
                                    <input
                                        id="assessment-date"
                                        type="date"
                                        className="teacher-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        name="dateGiven"
                                        value={modalForm.dateGiven}
                                        onChange={handleModalInputChange}
                                    />
                                </div>
                            </div>

                            <footer className="teacher-gradebook__form-footer mt-6 flex justify-end gap-3 border-t pt-5">
                                <button
                                    type="button"
                                    className="teacher-gradebook__form-cancel rounded-lg border px-4 py-2.5 text-sm font-semibold"
                                    onClick={closeModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="teacher-gradebook__form-submit inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold"
                                    disabled={savingAssessment}
                                >
                                    {savingAssessment
                                        ? "Saving…"
                                        : modal.mode === "create"
                                          ? "Create Assessment"
                                          : "Save Changes"}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== Grading weights modal ==================== */}
            {weightsModalOpen && (
                <div
                    className="teacher-gradebook__modal fixed inset-0 z-[1000] grid place-items-center p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="teacher-gradebook-weights-title"
                    onMouseDown={handleWeightsOverlayMouseDown}
                >
                    <div className="teacher-gradebook__modal-panel w-full max-w-[30rem] overflow-y-auto rounded-3xl bg-white shadow-xl">
                        <header className="teacher-gradebook__modal-header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="teacher-gradebook__modal-heading">
                                <span className="teacher-gradebook__modal-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                    Class subject settings
                                </span>
                                <h3
                                    id="teacher-gradebook-weights-title"
                                    className="teacher-gradebook__modal-title mt-0.5 text-xl font-bold"
                                >
                                    Grading Weights
                                </h3>
                                <p className="teacher-gradebook__modal-subtitle mt-1 text-[0.8125rem]">
                                    Set how each component counts toward the quarter grade
                                </p>
                            </div>
                            <button
                                type="button"
                                className="teacher-gradebook__modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                                onClick={closeWeightsModal}
                                aria-label="Close modal"
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <form className="teacher-gradebook__form p-6" onSubmit={handleWeightsSubmit} noValidate>
                            <div className="teacher-gradebook__form-grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {WEIGHTS_FIELD_LABELS.map((field) => (
                                    <div
                                        key={field.key}
                                        className={`teacher-gradebook__form-field${field.key === "attendanceWeight" ? " sm:col-span-2" : ""}`}
                                    >
                                        <label
                                            htmlFor={`weights-${field.key}`}
                                            className="teacher-gradebook__form-label text-[0.8125rem] font-semibold"
                                        >
                                            {field.label}
                                            <span className="teacher-gradebook__form-suffix font-normal"> %</span>
                                        </label>
                                        <input
                                            id={`weights-${field.key}`}
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="0.5"
                                            className="teacher-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                            placeholder="0"
                                            name={field.key}
                                            value={weightsForm[field.key]}
                                            onChange={handleWeightsInputChange}
                                        />
                                        {field.hint && (
                                            <p className="teacher-gradebook__form-hint mt-1 text-[0.6875rem]">{field.hint}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="teacher-gradebook__weights-total-wrap mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                                <span className="teacher-gradebook__weights-total-label text-[0.8125rem] font-semibold">
                                    Total
                                </span>
                                <span
                                    className={`teacher-gradebook__weights-total font-mono text-[0.8125rem] font-bold${
                                        Number.isNaN(weightsTotal)
                                            ? ""
                                            : weightsTotal > 100
                                              ? " teacher-gradebook__weights-total--over"
                                              : " teacher-gradebook__weights-total--ok"
                                    }`}
                                    aria-live="polite"
                                >
                                    {Number.isNaN(weightsTotal) ? "—" : `${weightsTotal}/100`}
                                </span>
                            </div>

                            <footer className="teacher-gradebook__form-footer mt-6 flex justify-end gap-3 border-t pt-5">
                                <button
                                    type="button"
                                    className="teacher-gradebook__form-cancel rounded-lg border px-4 py-2.5 text-sm font-semibold"
                                    onClick={closeWeightsModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="teacher-gradebook__form-submit inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold"
                                    disabled={savingWeights}
                                >
                                    {savingWeights ? "Saving…" : "Save Weights"}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== Delete assessment confirmation ==================== */}
            <ConfirmDialog
                open={deletingAssessment !== null}
                title="Delete Assessment"
                description={`This will permanently delete "${deletingAssessment?.title ?? ""}" and all of its recorded scores. This action cannot be undone.`}
                confirmLabel="Delete"
                confirmIcon={<FiTrash2 aria-hidden="true" />}
                pending={deleting}
                pendingLabel="Deleting…"
                onConfirm={handleDeleteAssessment}
                onClose={() => setDeletingAssessment(null)}
            />
        </section>
    );
}
