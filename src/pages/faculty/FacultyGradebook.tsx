import {
    FiArrowLeft,
    FiBookOpen,
    FiCheck,
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight,
    FiChevronUp,
    FiEdit3,
    FiPlus,
    FiSave,
    FiTrash2,
    FiUsers,
    FiX,
} from "react-icons/fi";
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
    type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

import { deleteAPICall, getAPICall, patchAPICall, postAPICall, putAPICall } from "../../api/api";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ModalDialog } from "../../components/ModalDialog";
import { PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
import { toast } from "../../helper/toast";
import { computeFlatQuarterGradePreview, isPassing } from "../../helper/grades";

import type { Assessment, AssessmentType } from "../../constant/assessment";
import type { GradeWeights } from "../../constant/gradingWeights";
import type { SubjectComponent } from "../../constant/subjects";

import "../../style/facultyGradebook.css";

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
    // Per-component grades computed by the server for composite subjects (MAPEH).
    componentGrades?: ComponentGrade[] | null;
}

/** One sub-component's server-computed grade (server: computeCompositeQuarterGrade). */
interface ComponentGrade {
    componentId: number;
    componentName: string;
    componentCode: string;
    weight: number;
    grade: number | null;
}

interface GradebookDetails {
    classId: number;
    classSubjectId: number;
    classSection: string;
    classLevel: number;
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    hasComponents: boolean;
    components: SubjectComponent[];
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
    // Server-provided component grades (composite subjects only).
    componentGrades: ComponentGrade[];
    // True when quarterGrade/remarks came from the server instead of the live preview.
    fromServer: boolean;
}

// ================= Constants =================

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

const WEIGHT_CONFIGS: Array<{
    key: keyof GradeWeights;
    label: string;
    color: string;
}> = [
    { key: "writtenWorkWeight", label: "Written Work", color: "#176B3A" },
    { key: "performanceTaskWeight", label: "Performance Task", color: "#16A34A" },
    { key: "quarterlyAssessmentWeight", label: "Quarterly Assessment", color: "#0F766E" },
    { key: "attendanceWeight", label: "Attendance", color: "#10B981" },
];

// ================= Helpers =================

function computeStudentRow(
    student: StudentGradebookRow,
    assessments: Assessment[],
    weights: GradeWeights,
    draftRow: Record<number, string> | undefined,
    attendance: StudentAttendanceSummary | null,
    isCompositeSubject: boolean,
): ComputedRow {
    const preview = computeFlatQuarterGradePreview(assessments, weights, draftRow, attendance);

    if (isCompositeSubject) {
        return {
            totalScore: preview.totalScore,
            totalMaxScore: preview.totalMaxScore,
            quarterGrade: student.quarterGrade,
            remarks: student.remarks,
            componentGrades: student.componentGrades ?? [],
            fromServer: true,
        };
    }

    return {
        totalScore: preview.totalScore,
        totalMaxScore: preview.totalMaxScore,
        quarterGrade: preview.quarterGrade,
        remarks: preview.remarks,
        componentGrades: [],
        fromServer: false,
    };
}

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

function toDateInputValue(dateGiven: string | null): string {
    if (!dateGiven) return "";
    const date = new Date(dateGiven);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getInitials(name: string): string {
    if (!name) return "";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function FacultyGradebook() {
    const navigate = useNavigate();
    const { classId } = useParams();
    const { quarters } = useAcademicSettings();
    const classSubjectId = Number(classId);

    // ================ Page Data ================
    const [loading, setLoading] = useState<boolean>(true);
    const [quarter, setQuarter] = useState<number>(1);
    const [gradeBookDetails, setGradeBookDetails] = useState<GradebookDetails | null>(null);
    const [draftScores, setDraftScores] = useState<DraftScores>({});
    const [savingScores, setSavingScores] = useState<boolean>(false);

    // ================ Mobile preview collapse / expand state ================
    const [isStudentColCollapsed, setIsStudentColCollapsed] = useState<boolean>(false);
    const [expandedStudentIds, setExpandedStudentIds] = useState<Set<number>>(new Set());

    const toggleStudentRow = useCallback((enrollmentId: number) => {
        setExpandedStudentIds((prev) => {
            const next = new Set(prev);
            if (next.has(enrollmentId)) {
                next.delete(enrollmentId);
            } else {
                next.add(enrollmentId);
            }
            return next;
        });
    }, []);

    // ================ Component tabs (for composite subjects) ================
    const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);

    // ================ Assessment modal / delete state ================
    const [modal, setModal] = useState<AssessmentModalState>(null);
    const [modalForm, setModalForm] = useState<AssessmentFormState>(EMPTY_ASSESSMENT_FORM);
    const [savingAssessment, setSavingAssessment] = useState<boolean>(false);
    const [deletingAssessment, setDeletingAssessment] = useState<Assessment | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);

    // ================ Grading weights state ================
    const [weightsForm, setWeightsForm] = useState<Record<keyof GradeWeights, string>>({
        writtenWorkWeight: "30",
        performanceTaskWeight: "50",
        quarterlyAssessmentWeight: "20",
        attendanceWeight: "0",
    });
    const [savingWeights, setSavingWeights] = useState<boolean>(false);

    // Sync weightsForm with loaded gradeBookDetails
    useEffect(() => {
        if (gradeBookDetails) {
            setWeightsForm({
                writtenWorkWeight: String(gradeBookDetails.gradingWeights.writtenWorkWeight ?? ""),
                performanceTaskWeight: String(gradeBookDetails.gradingWeights.performanceTaskWeight ?? ""),
                quarterlyAssessmentWeight: String(gradeBookDetails.gradingWeights.quarterlyAssessmentWeight ?? ""),
                attendanceWeight: String(gradeBookDetails.gradingWeights.attendanceWeight ?? ""),
            });
        }
    }, [gradeBookDetails]);

    // ================= Fetch gradebook details ================
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quarter]);

    function handleQuarterChange(targetQuarter: number) {
        if (targetQuarter === quarter) return;
        setLoading(true);
        setQuarter(targetQuarter);
    }

    // ================= Derived state ================
    const isCompositeSubject = Boolean(gradeBookDetails?.hasComponents);
    const components = gradeBookDetails?.components ?? [];

    const assessments = useMemo(() => {
        const allAssessments = gradeBookDetails?.assessment ?? [];
        if (isCompositeSubject && selectedComponentId !== null) {
            return allAssessments.filter((a) => a.componentId === selectedComponentId);
        }
        return allAssessments;
    }, [gradeBookDetails, isCompositeSubject, selectedComponentId]);

    const students = useMemo(() => gradeBookDetails?.student ?? [], [gradeBookDetails]);

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
                    student,
                    assessments,
                    gradeBookDetails.gradingWeights,
                    draftScores[student.enrollmentId],
                    student.attendance,
                    isCompositeSubject,
                ),
            );
        }
        return rows;
    }, [gradeBookDetails, students, assessments, draftScores, isCompositeSubject]);

    const passedCount = computedRows.filter((row) => row.remarks === "Passed").length;
    const failedCount = computedRows.filter((row) => row.remarks === "Failed").length;

    // ModuLearn-style grouped assessment categories
    const groupedAssessments = useMemo(() => {
        const ww = assessments.filter((a) => a.type === "written_work");
        const pt = assessments.filter((a) => a.type === "performance_task");
        const qa = assessments.filter((a) => a.type === "quarterly_assessment");
        return [
            {
                type: "written_work" as const,
                meta: ASSESSMENT_TYPE_META.written_work,
                weight: gradeBookDetails?.gradingWeights.writtenWorkWeight ?? 0,
                color: "#176B3A",
                items: ww,
            },
            {
                type: "performance_task" as const,
                meta: ASSESSMENT_TYPE_META.performance_task,
                weight: gradeBookDetails?.gradingWeights.performanceTaskWeight ?? 0,
                color: "#16A34A",
                items: pt,
            },
            {
                type: "quarterly_assessment" as const,
                meta: ASSESSMENT_TYPE_META.quarterly_assessment,
                weight: gradeBookDetails?.gradingWeights.quarterlyAssessmentWeight ?? 0,
                color: "#0F766E",
                items: qa,
            },
        ];
    }, [assessments, gradeBookDetails]);

    const activeGroups = useMemo(() => {
        return groupedAssessments.filter((g) => g.items.length > 0);
    }, [groupedAssessments]);

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
            dateGiven: modalForm.dateGiven || null,
        };

        setSavingAssessment(true);
        try {
            if (modal.mode === "create") {
                const createPayload: any = {
                    classSubjectId: gradeBookDetails.classSubjectId,
                    quarter,
                    ...payload,
                };
                if (isCompositeSubject && selectedComponentId !== null) {
                    createPayload.componentId = selectedComponentId;
                }
                await postAPICall("/assessments", createPayload, { toast: false });
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
    function handleWeightsInputChange(event: ChangeEvent<HTMLInputElement>) {
        const { name, value } = event.target;
        setWeightsForm((prev) => ({ ...prev, [name]: value }));
    }

    const weightsTotal = useMemo(() => {
        const values = [
            Number(weightsForm.writtenWorkWeight) || 0,
            Number(weightsForm.performanceTaskWeight) || 0,
            Number(weightsForm.quarterlyAssessmentWeight) || 0,
            Number(weightsForm.attendanceWeight) || 0,
        ];
        return values.reduce((sum, value) => sum + value, 0);
    }, [weightsForm]);

    async function handleWeightsSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!gradeBookDetails || savingWeights) return;

        if (Object.values(weightsForm).some((raw) => raw.trim() === "")) {
            toast.warning("All weight fields are required.");
            return;
        }

        const writtenWorkWeight = Number(weightsForm.writtenWorkWeight);
        const performanceTaskWeight = Number(weightsForm.performanceTaskWeight);
        const quarterlyAssessmentWeight = Number(weightsForm.quarterlyAssessmentWeight);
        const attendanceWeight = Number(weightsForm.attendanceWeight);

        if (
            [writtenWorkWeight, performanceTaskWeight, quarterlyAssessmentWeight, attendanceWeight].some(
                (value) => value < 0,
            )
        ) {
            toast.warning("All weights must be 0 or greater.");
            return;
        }
        if (weightsTotal > 100) {
            toast.warning(`Weights total ${weightsTotal}%, which exceeds the maximum of 100%.`);
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
            await fetchGradebook(quarter);
        } finally {
            setSavingWeights(false);
        }
    }

    const handleBackToClassList = () => {
        navigate("/faculty/classes");
    };

    if (loading) {
        return (
            <PageShell className="faculty-gradebook" busy>
                <div className="space-y-4 p-6">
                    <Skeleton lines={2} gap="0.75rem" />
                    <Skeleton lines={4} gap="1rem" />
                    <Skeleton lines={8} gap="0.75rem" />
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell className="faculty-gradebook space-y-6">
            {/* ==================== Compact Page Header (ModuLearn style) ==================== */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <button
                        type="button"
                        className="faculty-gradebook__back inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs mb-1"
                        aria-label="Back to class list"
                        onClick={handleBackToClassList}
                    >
                        <FiArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Classes</span>
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                        Gradebook
                    </h1>
                    <p className="text-sm font-medium text-gray-500">
                        {gradeBookDetails ? (
                            <>
                                Grade {gradeBookDetails.classLevel} &middot;{" "}
                                {gradeBookDetails.classSection.toLowerCase().startsWith("section")
                                    ? gradeBookDetails.classSection
                                    : `Section ${gradeBookDetails.classSection}`}{" "}
                                &middot;{" "}
                                <span className="font-bold text-gray-700">{gradeBookDetails.subjectName}</span>{" "}
                                <span className="font-mono text-xs text-gray-400">({gradeBookDetails.subjectCode})</span>
                            </>
                        ) : (
                            "Manage grades, weights, and items for this subject."
                        )}
                    </p>
                </div>

                {/* Academic Period Selector aligned right */}
                <div className="flex flex-col sm:items-end">
                    <label htmlFor="academic-period-select" className="text-[0.6875rem] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Academic Period
                    </label>
                    <select
                        id="academic-period-select"
                        value={quarter}
                        onChange={(e) => handleQuarterChange(Number(e.target.value))}
                        className="faculty-gradebook__period-select cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-semibold shadow-2xs"
                    >
                        {quarters.map((q) => (
                            <option key={q} value={q}>
                                Quarter {q}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {/* ==================== Composite Subject Tabs (MAPEH etc.) ==================== */}
            {isCompositeSubject && components.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
                    <span className="text-xs font-bold text-gray-500 mr-1">Component:</span>
                    <button
                        type="button"
                        className={`faculty-gradebook__comp-tab cursor-pointer${
                            selectedComponentId === null ? " faculty-gradebook__comp-tab--active" : ""
                        }`}
                        onClick={() => setSelectedComponentId(null)}
                    >
                        All
                    </button>
                    {components.map((comp) => (
                        <button
                            key={comp.id}
                            type="button"
                            className={`faculty-gradebook__comp-tab cursor-pointer${
                                selectedComponentId === comp.id ? " faculty-gradebook__comp-tab--active" : ""
                            }`}
                            onClick={() => setSelectedComponentId(comp.id)}
                        >
                            {comp.name}
                            <span className="ml-1 text-[0.625rem] opacity-75 font-normal">({comp.weight}%)</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {/* ==================== Grading Weights Panel (ModuLearn Pattern) ==================== */}
            <section className="faculty-gradebook__weights-card p-5 sm:p-6 space-y-4" aria-labelledby="grading-weights-title">
                <h2 id="grading-weights-title" className="text-base font-bold text-gray-900">
                    Grading Weights
                </h2>

                <form onSubmit={handleWeightsSubmit} className="space-y-4" noValidate>
                    {/* Visual Segmented Progress Distribution Bar */}
                    <div className="faculty-gradebook__weights-bar" aria-label="Percentage distribution bar">
                        {WEIGHT_CONFIGS.map((config) => {
                            const val = Math.max(0, Number(weightsForm[config.key]) || 0);
                            const widthPercent = weightsTotal > 0 ? (val / Math.max(100, weightsTotal)) * 100 : 0;
                            return (
                                <div
                                    key={config.key}
                                    style={{
                                        width: `${widthPercent}%`,
                                        backgroundColor: config.color,
                                    }}
                                    className="h-full transition-all duration-300"
                                    title={`${config.label}: ${val}%`}
                                />
                            );
                        })}
                    </div>

                    {/* Component Input Boxes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {WEIGHT_CONFIGS.map((config) => (
                            <div key={config.key} className="faculty-gradebook__weight-box">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: config.color }}
                                        aria-hidden="true"
                                    />
                                    <label
                                        htmlFor={`weight-input-${config.key}`}
                                        className="text-xs font-bold text-gray-700 truncate cursor-pointer"
                                    >
                                        {config.label}
                                    </label>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                        id={`weight-input-${config.key}`}
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="1"
                                        name={config.key}
                                        value={weightsForm[config.key]}
                                        onChange={handleWeightsInputChange}
                                        className="faculty-gradebook__weight-input"
                                        aria-label={`${config.label} weight percentage`}
                                    />
                                    <span className="text-xs font-semibold text-gray-400">%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Controls: Total and Save Weights */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                            <span
                                className={`text-sm font-bold ${
                                    weightsTotal === 100
                                        ? "text-[#176B3A]"
                                        : "text-amber-600"
                                }`}
                            >
                                Total: {weightsTotal}%
                            </span>
                            {weightsTotal !== 100 && (
                                <span className="text-xs text-amber-600 font-medium">
                                    (Weights must equal 100%)
                                </span>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={savingWeights}
                            className="faculty-gradebook__weights-save-btn cursor-pointer inline-flex items-center gap-2"
                        >
                            {savingWeights ? "Saving…" : "Save Weights"}
                        </button>
                    </div>
                </form>
            </section>

            {/* ==================== Grade Sheet Panel (ModuLearn Pattern) ==================== */}
            <section className="faculty-gradebook__sheet-card" aria-labelledby="grade-sheet-title">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-gray-200">
                    <div>
                        <h2 id="grade-sheet-title" className="text-lg font-bold text-gray-900">
                            Grade Sheet
                        </h2>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">
                            {students.length} students &middot; {assessments.length} items
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Save status badge */}
                        {isDirty ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                Unsaved changes
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100">
                                <FiCheck className="w-3.5 h-3.5" /> Saved
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="faculty-gradebook__btn-secondary cursor-pointer inline-flex items-center gap-1.5"
                        >
                            <FiPlus className="w-3.5 h-3.5" />
                            <span>Add Item</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveScores}
                            disabled={!isDirty || savingScores}
                            className="faculty-gradebook__btn-primary cursor-pointer inline-flex items-center gap-1.5"
                        >
                            <FiSave className="w-3.5 h-3.5" />
                            <span>{savingScores ? "Saving…" : "Save All"}</span>
                        </button>
                    </div>
                </div>

                {/* Table or Empty States */}
                {assessments.length === 0 ? (
                    <div className="faculty-gradebook__empty flex flex-col items-center justify-center px-6 py-16 text-center">
                        <span
                            className="faculty-gradebook__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full text-lg mb-3"
                            aria-hidden="true"
                        >
                            <FiBookOpen />
                        </span>
                        <h3 className="faculty-gradebook__empty-title text-base font-bold">
                            No assessments yet for Quarter {quarter}
                        </h3>
                        <p className="faculty-gradebook__empty-text text-xs text-gray-500 mt-1 max-w-sm">
                            Add an assessment to start recording scores for this subject and quarter.
                        </p>
                        <button
                            type="button"
                            className="faculty-gradebook__btn-primary cursor-pointer mt-4 inline-flex items-center gap-1.5"
                            onClick={openCreateModal}
                        >
                            <FiPlus className="w-3.5 h-3.5" />
                            <span>Add Assessment</span>
                        </button>
                    </div>
                ) : students.length === 0 ? (
                    <div className="faculty-gradebook__empty flex flex-col items-center justify-center px-6 py-16 text-center">
                        <span
                            className="faculty-gradebook__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-full text-lg mb-3"
                            aria-hidden="true"
                        >
                            <FiUsers />
                        </span>
                        <h3 className="faculty-gradebook__empty-title text-base font-bold">
                            No students enrolled
                        </h3>
                        <p className="faculty-gradebook__empty-text text-xs text-gray-500 mt-1">
                            Students will appear here once they are enrolled in this class.
                        </p>
                    </div>
                ) : (
                    <div className="faculty-gradebook__table-container">
                        <table
                            className="faculty-gradebook__table"
                            style={{ minWidth: isStudentColCollapsed ? `${14 + assessments.length * 8}rem` : `${22 + assessments.length * 8}rem` }}
                        >
                            <thead>
                                {/* Header Row 1: Groups & Summaries */}
                                <tr>
                                    <th
                                        scope="col"
                                        rowSpan={2}
                                        className={`faculty-gradebook__sticky-col faculty-gradebook__th-summary px-3 py-3 text-left transition-all ${
                                            isStudentColCollapsed ? "w-16 min-w-[4rem]" : "min-w-[13rem]"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-1.5">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <FiUsers className="w-4 h-4 text-gray-400 shrink-0" />
                                                {!isStudentColCollapsed && <span>STUDENT</span>}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsStudentColCollapsed((prev) => !prev)}
                                                className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer shrink-0"
                                                title={isStudentColCollapsed ? "Expand student column" : "Collapse student column"}
                                                aria-label={isStudentColCollapsed ? "Expand student column" : "Collapse student column"}
                                            >
                                                {isStudentColCollapsed ? (
                                                    <FiChevronRight className="w-4 h-4 text-[#176B3A]" />
                                                ) : (
                                                    <FiChevronLeft className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </th>

                                    {/* Grouped Category Headers */}
                                    {activeGroups.map((group) => (
                                        <th
                                            key={group.type}
                                            colSpan={group.items.length}
                                            scope="colgroup"
                                            className="faculty-gradebook__th-group"
                                            style={{ borderTop: `3px solid ${group.color}` }}
                                        >
                                            <span
                                                className="inline-flex items-center justify-center gap-1.5"
                                                style={{ color: group.color }}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: group.color }}
                                                />
                                                {group.meta.label.toUpperCase()} ({group.weight}%)
                                            </span>
                                        </th>
                                    ))}

                                    {/* Summary Header: ATTENDANCE */}
                                    <th
                                        scope="col"
                                        rowSpan={2}
                                        className="faculty-gradebook__th-summary min-w-[6.5rem]"
                                    >
                                        ATTENDANCE
                                    </th>

                                    {/* Summary Header: FINAL GRADE */}
                                    <th
                                        scope="col"
                                        rowSpan={2}
                                        className="faculty-gradebook__th-summary min-w-[6.5rem]"
                                    >
                                        FINAL GRADE
                                    </th>

                                    {/* Summary Header: REMARKS */}
                                    <th
                                        scope="col"
                                        rowSpan={2}
                                        className="faculty-gradebook__th-summary min-w-[6.5rem]"
                                    >
                                        REMARKS
                                    </th>
                                </tr>

                                {/* Header Row 2: Individual Assessment Items */}
                                <tr>
                                    {activeGroups.map((group) => (
                                        <Fragment key={group.type}>
                                            {group.items.map((assessment) => (
                                                <th
                                                    key={assessment.id}
                                                    scope="col"
                                                    className="faculty-gradebook__th-sub min-w-[7.5rem]"
                                                >
                                                    <div className="flex flex-col items-center gap-1 group/item">
                                                        <span
                                                            className="font-bold text-gray-800 text-[0.75rem] max-w-[8rem] truncate leading-tight"
                                                            title={assessment.title}
                                                        >
                                                            {assessment.title}
                                                        </span>
                                                        <span className="font-mono text-[0.6875rem] text-gray-500">
                                                            /{assessment.maxScore}
                                                        </span>
                                                        {assessment.dateGiven && (
                                                            <span className="text-[0.625rem] text-gray-400">
                                                                {assessment.dateGiven}
                                                            </span>
                                                        )}
                                                        {/* Edit / Delete quick controls */}
                                                        <div className="flex items-center gap-1 mt-0.5 opacity-60 hover:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditModal(assessment)}
                                                                title={`Edit ${assessment.title}`}
                                                                className="p-1 hover:text-[#176B3A] rounded hover:bg-gray-200 cursor-pointer"
                                                            >
                                                                <FiEdit3 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeletingAssessment(assessment)}
                                                                title={`Delete ${assessment.title}`}
                                                                className="p-1 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                                                            >
                                                                <FiTrash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </th>
                                            ))}
                                        </Fragment>
                                    ))}
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
                                        componentGrades: [],
                                        fromServer: false,
                                    };
                                    const isRowExpanded = expandedStudentIds.has(student.enrollmentId);

                                    return (
                                        <Fragment key={student.enrollmentId}>
                                            <tr className="hover:bg-gray-50/70 transition-colors">
                                                {/* Sticky Student Column */}
                                                <td
                                                    className={`faculty-gradebook__sticky-col transition-all ${
                                                        isStudentColCollapsed
                                                            ? "w-16 min-w-[4rem] px-2 py-2 text-center"
                                                            : "px-4 py-2.5"
                                                    }`}
                                                >
                                                    {isStudentColCollapsed ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleStudentRow(student.enrollmentId)}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF5EE] text-[#176B3A] font-bold text-xs border border-[#176B3A]/20 cursor-pointer shadow-2xs hover:scale-105 transition-transform"
                                                            title={`${student.fullname}\nLRN: ${student.studentLrn}\nClick to toggle row details`}
                                                            aria-label={`Toggle row details for ${student.fullname}`}
                                                        >
                                                            {getInitials(student.fullname)}
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex flex-col min-w-0">
                                                                <span
                                                                    className="font-bold text-gray-900 text-[0.8125rem] leading-snug truncate"
                                                                    title={student.fullname}
                                                                >
                                                                    {student.fullname}
                                                                </span>
                                                                <span className="text-[0.6875rem] text-gray-400 font-mono mt-0.5 truncate">
                                                                    {student.studentLrn}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleStudentRow(student.enrollmentId)}
                                                                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer shrink-0"
                                                                title={isRowExpanded ? "Collapse student details" : "Expand student details"}
                                                                aria-label={isRowExpanded ? "Collapse student details" : "Expand student details"}
                                                            >
                                                                {isRowExpanded ? (
                                                                    <FiChevronUp className="w-3.5 h-3.5 text-[#176B3A]" />
                                                                ) : (
                                                                    <FiChevronDown className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Scores for Each Active Category */}
                                                {activeGroups.map((group) => (
                                                    <Fragment key={group.type}>
                                                        {group.items.map((assessment) => (
                                                            <td key={assessment.id} className="text-center px-1.5 py-2">
                                                                <input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    min={0}
                                                                    max={Number(assessment.maxScore)}
                                                                    step="0.01"
                                                                    className="faculty-gradebook__score-input"
                                                                    value={draftRow[assessment.id] ?? ""}
                                                                    placeholder="—"
                                                                    aria-label={`${student.fullname} score in ${assessment.title}`}
                                                                    onChange={(e) =>
                                                                        handleScoreChange(
                                                                            student.enrollmentId,
                                                                            assessment.id,
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                        ))}
                                                    </Fragment>
                                                ))}

                                                {/* ATTENDANCE */}
                                                <td className="text-center px-2 py-2">
                                                    {student.attendance && student.attendance.totalDays > 0 ? (
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className="font-mono text-xs font-bold text-gray-800">
                                                                {student.attendance.percentage.toFixed(0)}%
                                                            </span>
                                                            <div className="faculty-gradebook__attendance-bar-wrap">
                                                                <div
                                                                    className="faculty-gradebook__attendance-bar-fill"
                                                                    style={{
                                                                        width: `${Math.min(
                                                                            100,
                                                                            Math.max(0, student.attendance.percentage),
                                                                        )}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </td>

                                                {/* FINAL GRADE */}
                                                <td className="text-center px-2 py-2">
                                                    {computed.quarterGrade !== null ? (
                                                        <div className="inline-flex flex-col items-center">
                                                            <span
                                                                className={`font-mono text-sm font-extrabold ${
                                                                    isPassing(computed.quarterGrade)
                                                                        ? "text-[#176B3A]"
                                                                        : "text-red-600"
                                                                }`}
                                                            >
                                                                {computed.quarterGrade.toFixed(2)}
                                                            </span>
                                                            {computed.componentGrades.length > 0 && (
                                                                <span className="text-[0.625rem] text-gray-400 mt-0.5">
                                                                    {computed.componentGrades
                                                                        .map(
                                                                            (cg) =>
                                                                                `${cg.componentCode} ${
                                                                                    cg.grade === null ? "—" : cg.grade.toFixed(1)
                                                                                }`,
                                                                        )
                                                                        .join(" · ")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </td>

                                                {/* REMARKS */}
                                                <td className="text-center px-2 py-2">
                                                    {computed.remarks ? (
                                                        <span
                                                            className={`faculty-gradebook__remarks-badge ${
                                                                computed.remarks === "Passed"
                                                                    ? "faculty-gradebook__remarks-badge--passed"
                                                                    : "faculty-gradebook__remarks-badge--failed"
                                                            }`}
                                                        >
                                                            {computed.remarks}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Mobile / Compact Expanded Student Details Accordion */}
                                            {isRowExpanded && (
                                                <tr className="bg-[#F7FAF8] border-b border-gray-200">
                                                    <td
                                                        colSpan={1 + assessments.length + 3}
                                                        className="p-3 sm:p-4"
                                                    >
                                                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                                                                <div>
                                                                    <h4 className="font-bold text-sm text-gray-900">
                                                                        {student.fullname}
                                                                    </h4>
                                                                    <p className="text-xs text-gray-500 font-mono">
                                                                        LRN: {student.studentLrn}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold text-gray-500">
                                                                        Quarter Grade:{" "}
                                                                        <strong
                                                                            className={
                                                                                isPassing(computed.quarterGrade)
                                                                                    ? "text-[#176B3A]"
                                                                                    : "text-red-600"
                                                                            }
                                                                        >
                                                                            {computed.quarterGrade !== null
                                                                                ? computed.quarterGrade.toFixed(2)
                                                                                : "—"}
                                                                        </strong>
                                                                    </span>
                                                                    {computed.remarks && (
                                                                        <span
                                                                            className={`faculty-gradebook__remarks-badge ${
                                                                                computed.remarks === "Passed"
                                                                                    ? "faculty-gradebook__remarks-badge--passed"
                                                                                    : "faculty-gradebook__remarks-badge--failed"
                                                                            }`}
                                                                        >
                                                                            {computed.remarks}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Assessment Score Fields for Mobile Preview */}
                                                            <div className="space-y-3">
                                                                <span className="text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider block">
                                                                    Assessments & Scores
                                                                </span>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                                    {activeGroups.map((group) => (
                                                                        <div key={group.type} className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                                                                            <div
                                                                                className="flex items-center gap-1.5 text-xs font-bold"
                                                                                style={{ color: group.color }}
                                                                            >
                                                                                <span
                                                                                    className="w-2 h-2 rounded-full"
                                                                                    style={{ backgroundColor: group.color }}
                                                                                />
                                                                                <span>{group.meta.label} ({group.weight}%)</span>
                                                                            </div>
                                                                            <div className="space-y-1.5">
                                                                                {group.items.map((assessment) => (
                                                                                    <div
                                                                                        key={assessment.id}
                                                                                        className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-white border border-gray-200 text-xs"
                                                                                    >
                                                                                        <div className="min-w-0">
                                                                                            <p className="font-semibold text-gray-800 truncate" title={assessment.title}>
                                                                                                {assessment.title}
                                                                                            </p>
                                                                                            <p className="text-[0.625rem] text-gray-400 font-mono">
                                                                                                Max: {assessment.maxScore}
                                                                                            </p>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                                            <input
                                                                                                type="number"
                                                                                                inputMode="decimal"
                                                                                                min={0}
                                                                                                max={Number(assessment.maxScore)}
                                                                                                step="0.01"
                                                                                                value={draftRow[assessment.id] ?? ""}
                                                                                                placeholder="—"
                                                                                                className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center font-mono text-xs font-bold text-gray-800 focus:border-[#176B3A] focus:outline-none"
                                                                                                onChange={(e) =>
                                                                                                    handleScoreChange(
                                                                                                        student.enrollmentId,
                                                                                                        assessment.id,
                                                                                                        e.target.value,
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                            <span className="text-gray-400 text-[0.6875rem] font-mono">
                                                                                                /{assessment.maxScore}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Attendance info */}
                                                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                                                                <span>Attendance:</span>
                                                                <span className="font-mono font-bold text-gray-800">
                                                                    {student.attendance && student.attendance.totalDays > 0
                                                                        ? `${student.attendance.percentage.toFixed(0)}% (${student.attendance.presentDays}/${student.attendance.totalDays} days)`
                                                                        : "No records"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50/50 text-xs text-gray-500">
                    <p className="flex items-center gap-1.5 font-medium">
                        <FiUsers className="w-4 h-4 text-gray-400" />
                        <span>
                            {students.length} students &middot; {passedCount} passed &middot; {failedCount} failed
                        </span>
                    </p>
                    {isCompositeSubject ? (
                        <p className="text-[0.6875rem] text-gray-500">
                            Composite subject: the quarter grade is computed by the server from saved scores.
                        </p>
                    ) : null}
                </div>
            </section>

            {/* ==================== Assessment Create / Edit Modal ==================== */}
            <ModalDialog
                open={modal !== null}
                onClose={closeModal}
                labelledById="faculty-gradebook-modal-title"
                className="faculty-gradebook__modal-panel w-full max-w-[30rem] overflow-y-auto rounded-3xl bg-white shadow-xl"
            >
                {modal && (
                    <>
                        <header className="faculty-gradebook__modal-header flex items-start justify-between gap-4 p-6 pb-5">
                            <div className="faculty-gradebook__modal-heading">
                                <span className="faculty-gradebook__modal-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                                    {modal.mode === "create" ? "New record" : "Edit record"}
                                </span>
                                <h3
                                    id="faculty-gradebook-modal-title"
                                    className="faculty-gradebook__modal-title mt-0.5 text-xl font-bold"
                                >
                                    {modal.mode === "create" ? "Create Assessment" : "Edit Assessment"}
                                </h3>
                                <p className="faculty-gradebook__modal-subtitle mt-1 text-[0.8125rem]">
                                    {modal.mode === "create"
                                        ? `Add an assessment to Quarter ${quarter}`
                                        : `Update ${modal.assessment.title}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="faculty-gradebook__modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg cursor-pointer"
                                onClick={closeModal}
                                aria-label="Close modal"
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <form className="faculty-gradebook__form p-6" onSubmit={handleAssessmentSubmit} noValidate>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label
                                        htmlFor="assessment-title"
                                        className="faculty-gradebook__form-label block text-[0.8125rem] font-semibold mb-1"
                                    >
                                        Title
                                    </label>
                                    <input
                                        id="assessment-title"
                                        type="text"
                                        className="faculty-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="Quiz 1: Fractions"
                                        autoFocus
                                        name="title"
                                        value={modalForm.title}
                                        onChange={handleModalInputChange}
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="assessment-type"
                                        className="faculty-gradebook__form-label block text-[0.8125rem] font-semibold mb-1"
                                    >
                                        Type
                                    </label>
                                    <select
                                        id="assessment-type"
                                        className="faculty-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm cursor-pointer"
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
                                <div>
                                    <label
                                        htmlFor="assessment-max-score"
                                        className="faculty-gradebook__form-label block text-[0.8125rem] font-semibold mb-1"
                                    >
                                        Max Score
                                    </label>
                                    <input
                                        id="assessment-max-score"
                                        type="number"
                                        min={0.01}
                                        step="0.01"
                                        className="faculty-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        placeholder="20"
                                        name="maxScore"
                                        value={modalForm.maxScore}
                                        onChange={handleModalInputChange}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label
                                        htmlFor="assessment-date"
                                        className="faculty-gradebook__form-label block text-[0.8125rem] font-semibold mb-1"
                                    >
                                        Date Given{" "}
                                        <span className="faculty-gradebook__form-optional font-normal">(optional)</span>
                                    </label>
                                    <input
                                        id="assessment-date"
                                        type="date"
                                        className="faculty-gradebook__form-input w-full rounded-lg border px-3 py-2.5 text-sm"
                                        name="dateGiven"
                                        value={modalForm.dateGiven}
                                        onChange={handleModalInputChange}
                                    />
                                </div>
                            </div>

                            <footer className="faculty-gradebook__form-footer mt-6 flex justify-end gap-3 border-t pt-5">
                                <button
                                    type="button"
                                    className="faculty-gradebook__form-cancel rounded-lg border px-4 py-2.5 text-sm font-semibold cursor-pointer"
                                    onClick={closeModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="faculty-gradebook__form-submit inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold cursor-pointer"
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
                    </>
                )}
            </ModalDialog>

            {/* ==================== Delete Assessment Confirmation ==================== */}
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
        </PageShell>
    );
}
