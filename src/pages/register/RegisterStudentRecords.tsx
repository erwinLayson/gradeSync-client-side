import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FiAlertTriangle,
    FiBookOpen,
    FiCheckCircle,
    FiClock,
    FiRefreshCw,
    FiRotateCcw,
    FiSkipForward,
    FiUsers,
    FiX,
} from "react-icons/fi";

import { getAPICall, patchAPICall } from "../../api/api";
import { getSubjectClassRecords, getSubjectSubmissionSummary } from "../../api/studentRecord";
import { notifyAcademicSettingsUpdated, useAcademicSettings } from "../../hooks/useAcademicSettings";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ModalDialog } from "../../components/ModalDialog";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";
import { toast } from "../../helper/toast";

import type {
    SubmissionSummaryRow,
    SubjectSubmissionSummaryRow,
    SubjectClassRecordResponse,
} from "../../constant/studentRecord";
import type { SchoolYear } from "../../constant/schoolYear.js";

import "../../style/adminStudentRecords.css";
import "../../style/submissionTrackerMatrix.css";

// ================= Types =================

interface AcademicSettingsData {
    id: number;
    currentQuarter: number;
    numQuarters: number;
    enrollmentOpen: boolean | number;
    submissionsLocked: boolean | number;
}

interface SubjectDrilldownState {
    row: SubjectSubmissionSummaryRow;
    quarter: number;
    data: SubjectClassRecordResponse | null;
}

interface ClassroomMatrixGroup {
    classId: number;
    section: string;
    gradeLevel: number;
    adviserFullname: string | null;
    totalEnrolled: number;
    subjects: SubjectSubmissionSummaryRow[];
}

// ================= Helpers =================

function formatSubmittedAt(iso: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ================= Component =================

export default function RegisterStudentRecords() {
    const { numQuarters, quarters } = useAcademicSettings();

    // ================= State =================
    const [loading, setLoading] = useState(true);
    const [years, setYears] = useState<SchoolYear[]>([]);
    const [selectedYearId, setSelectedYearId] = useState("");
    const [currentQuarter, setCurrentQuarter] = useState<number | null>(null);

    // Class sections summary & subjects summary
    const [summary, setSummary] = useState<SubmissionSummaryRow[]>([]);
    const [subjectSummary, setSubjectSummary] = useState<SubjectSubmissionSummaryRow[]>([]);

    // ================= Filters State =================
    const [selectedGradeLevel, setSelectedGradeLevel] = useState<number | "all">("all");
    const [selectedClassId, setSelectedClassId] = useState<number | "all">("all");
    const [selectedQuarter, setSelectedQuarter] = useState<number | "all">("all");

    // Subject drill-down modal: subject + quarter -> roster with individual student submission statuses.
    const [subjectDrilldown, setSubjectDrilldown] = useState<SubjectDrilldownState | null>(null);
    const [subjectDrilldownLoading, setSubjectDrilldownLoading] = useState(false);

    // Advance quarter state
    const [confirmAdvance, setConfirmAdvance] = useState(false);
    const [advancing, setAdvancing] = useState(false);

    // ================= Load school years + current quarter =================
    useEffect(() => {
        let cancelled = false;

        async function loadContext() {
            try {
                const yearsResponse = await getAPICall<SchoolYear[]>("/schoolYear", { toast: false });
                if (cancelled) return;

                const yearsData = yearsResponse.data ?? [];
                setYears(yearsData);
                const active = yearsData.find((sy) => Boolean(sy.isActive));
                const initialId = active ? String(active.id) : yearsData[0] ? String(yearsData[0].id) : "";
                setSelectedYearId(initialId);

                if (!initialId) setLoading(false);
            } catch {
                if (!cancelled) setLoading(false);
            }

            try {
                const settingsResponse = await getAPICall<AcademicSettingsData>("/academic-settings", { toast: false });
                if (cancelled) return;

                const settings = settingsResponse.data;
                if (settings) {
                    setCurrentQuarter(Number(settings.currentQuarter));
                }
            } catch {
                // Error toast handled by API interceptor
            }
        }

        loadContext();
        return () => {
            cancelled = true;
        };
    }, []);

    // ================= Load data for the selected year =================
    const loadData = useCallback(async () => {
        if (!selectedYearId) {
            setSummary([]);
            setSubjectSummary([]);
            return;
        }

        setLoading(true);
        try {
            const [sumRes, subjRes] = await Promise.all([
                getAPICall<SubmissionSummaryRow[]>(
                    `/student-records/summary?schoolYearId=${selectedYearId}`,
                    { toast: false },
                ),
                getSubjectSubmissionSummary(Number(selectedYearId)).catch(() => ({ data: [] })),
            ]);
            setSummary(sumRes.data ?? []);
            setSubjectSummary(subjRes?.data ?? []);
        } catch {
            setSummary([]);
            setSubjectSummary([]);
        } finally {
            setLoading(false);
        }
    }, [selectedYearId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const refetchData = useCallback(async () => {
        if (!selectedYearId) return;
        try {
            const [sumRes, subjRes] = await Promise.all([
                getAPICall<SubmissionSummaryRow[]>(
                    `/student-records/summary?schoolYearId=${selectedYearId}`,
                    { toast: false },
                ),
                getSubjectSubmissionSummary(Number(selectedYearId)).catch(() => ({ data: [] })),
            ]);
            setSummary(sumRes.data ?? []);
            setSubjectSummary(subjRes?.data ?? []);
        } catch {
            // Error toast handled by API interceptor
        }
    }, [selectedYearId]);

    useEffect(() => {
        async function refreshYears() {
            try {
                const response = await getAPICall<SchoolYear[]>("/schoolYear", { toast: false });
                if (response.data) setYears(response.data);
            } catch {
                // Error toast handled by API interceptor
            }
        }

        const onFocus = () => {
            void refreshYears();
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    function handleYearChange(yearId: string) {
        if (yearId === selectedYearId) return;
        setLoading(true);
        setSelectedYearId(yearId);
    }

    const selectedYear = years.find((sy) => String(sy.id) === selectedYearId) ?? null;
    const activeYear = years.find((sy) => Boolean(sy.isActive)) ?? null;

    // ================= Classroom Grouping (Classroom -> Subjects) =================
    const classroomGroups = useMemo<ClassroomMatrixGroup[]>(() => {
        const groupsMap = new Map<number, ClassroomMatrixGroup>();

        for (const c of summary) {
            groupsMap.set(c.classId, {
                classId: c.classId,
                section: c.section,
                gradeLevel: c.gradeLevel,
                adviserFullname: c.adviserFullname,
                totalEnrolled: c.totalStudents,
                subjects: [],
            });
        }

        for (const s of subjectSummary) {
            let group = groupsMap.get(s.classId);
            if (!group) {
                group = {
                    classId: s.classId,
                    section: s.classSection,
                    gradeLevel: s.classGradeLevel,
                    adviserFullname: null,
                    totalEnrolled: s.totalStudents,
                    subjects: [],
                };
                groupsMap.set(s.classId, group);
            }
            group.subjects.push(s);
        }

        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
            if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
            return a.section.localeCompare(b.section);
        });

        for (const g of sortedGroups) {
            g.subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
        }

        return sortedGroups;
    }, [summary, subjectSummary]);

    // ================= Dynamic Filter Options & Filtering =================
    const gradeLevels = useMemo(() => {
        const set = new Set<number>();
        summary.forEach((c) => {
            if (c.gradeLevel) set.add(c.gradeLevel);
        });
        return Array.from(set).sort((a, b) => a - b);
    }, [summary]);

    const availableClasses = useMemo(() => {
        return summary
            .filter((c) => selectedGradeLevel === "all" || c.gradeLevel === Number(selectedGradeLevel))
            .sort((a, b) => {
                if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
                return a.section.localeCompare(b.section);
            });
    }, [summary, selectedGradeLevel]);

    const visibleQuarters = useMemo(() => {
        if (selectedQuarter === "all") return quarters;
        return [Number(selectedQuarter)];
    }, [selectedQuarter, quarters]);

    const filteredGroups = useMemo(() => {
        return classroomGroups.filter((group) => {
            if (selectedGradeLevel !== "all" && group.gradeLevel !== Number(selectedGradeLevel)) {
                return false;
            }
            if (selectedClassId !== "all" && group.classId !== Number(selectedClassId)) {
                return false;
            }
            return true;
        });
    }, [classroomGroups, selectedGradeLevel, selectedClassId]);

    const isFiltered =
        selectedGradeLevel !== "all" ||
        selectedClassId !== "all" ||
        selectedQuarter !== "all" ||
        (activeYear !== null && selectedYearId !== String(activeYear.id));

    const handleResetFilters = () => {
        if (activeYear) {
            setSelectedYearId(String(activeYear.id));
        }
        setSelectedGradeLevel("all");
        setSelectedClassId("all");
        setSelectedQuarter("all");
    };

    // ================= Advance Quarter Validation =================
    const activeYearSummary =
        activeYear && String(activeYear.id) === selectedYearId
            ? summary
            : years.find((sy) => String(sy.id) === selectedYearId && Boolean(sy.isActive))
              ? summary
              : [];

    const activeYearSubjectSummary =
        activeYear && String(activeYear.id) === selectedYearId
            ? subjectSummary
            : years.find((sy) => String(sy.id) === selectedYearId && Boolean(sy.isActive))
              ? subjectSummary
              : [];

    const classesWithoutAdviser = activeYearSummary.filter((row) => !row.adviserId);
    const incompleteClasses =
        currentQuarter === null
            ? []
            : activeYearSummary.filter(
                  (row) =>
                      row.adviserId &&
                      row.totalStudents > 0 &&
                      (row.submitted[currentQuarter] ?? 0) < row.totalStudents,
              );

    const incompleteSubjects =
        currentQuarter === null
            ? []
            : activeYearSubjectSummary.filter(
                  (row) =>
                      row.totalStudents > 0 &&
                      (row.statusByQuarter[currentQuarter] !== "submitted" ||
                          (row.submitted[currentQuarter] ?? 0) < row.totalStudents),
              );

    const advanceBlockedReason =
        !activeYear
            ? "No active school year — an Administrator must activate one in Admin Settings before advancing."
            : selectedYear && String(activeYear.id) !== String(selectedYear.id)
                ? `Quarter advancement only applies to the active school year (SY ${activeYear.startYear}–${activeYear.endYear}). Switch to the active year to advance.`
                : currentQuarter === null
                    ? "Loading the current quarter…"
                    : currentQuarter >= numQuarters
                        ? `Quarter ${numQuarters} is the final quarter`
                        : classesWithoutAdviser.length > 0
                            ? `${classesWithoutAdviser.length} class section(s) have no assigned adviser`
                            : incompleteSubjects.length > 0
                                ? `${incompleteSubjects.length} subject(s) have not submitted records for the current quarter`
                                : incompleteClasses.length > 0
                                    ? `${incompleteClasses.length} class section(s) have not completed adviser finalization for the current quarter`
                                    : null;

    const canAdvance = advanceBlockedReason === null;

    async function handleAdvanceQuarter() {
        if (activeYear && String(activeYear.id) !== selectedYearId) {
            setSelectedYearId(String(activeYear.id));
            await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, 0);
                return () => clearTimeout(timer);
            });
        }

        if (currentQuarter === null || currentQuarter >= numQuarters || advancing) return;
        setAdvancing(true);
        try {
            const nextQuarter = currentQuarter + 1;
            await patchAPICall("/academic-settings", {
                currentQuarter: nextQuarter,
            });

            setCurrentQuarter(nextQuarter);
            notifyAcademicSettingsUpdated();

            refetchData();

            toast.success(`Quarter advanced to Q${nextQuarter}`);
            setConfirmAdvance(false);
        } catch {
            // Error toast handled by API interceptor
        } finally {
            setAdvancing(false);
        }
    }

    // ================= Subject Drill-down modal =================
    async function openSubjectDrilldown(row: SubjectSubmissionSummaryRow, quarter: number) {
        setSubjectDrilldown({ row, quarter, data: null });
        setSubjectDrilldownLoading(true);
        try {
            const response = await getSubjectClassRecords(row.classSubjectId, quarter);
            setSubjectDrilldown((prev) =>
                prev && prev.row.classSubjectId === row.classSubjectId && prev.quarter === quarter
                    ? { ...prev, data: response.data ?? null }
                    : prev,
            );
        } catch {
            // Error toast handled by API interceptor
        } finally {
            setSubjectDrilldownLoading(false);
        }
    }

    // ================= Loading =================
    if (loading) {
        return (
            <PageShell className="tracker" busy label="Loading submission tracker">
                <PageSection flush>
                    <div className="tracker__loading p-6">
                        <Skeleton lines={6} gap="1rem" />
                    </div>
                </PageSection>
            </PageShell>
        );
    }

    return (
        <PageShell className="tracker">
            {/* ==================== Header ==================== */}
            <PageHeader
                title="Submission Tracker"
                description="Unified quarter submission matrix by classroom section and assigned subject teacher."
                meta={
                    <>
                        Quarter {currentQuarter ?? "—"}
                        {selectedYear ? ` · SY ${selectedYear.startYear}–${selectedYear.endYear}` : " · SY —"}
                    </>
                }
            />

            {(!activeYear || !selectedYear || String(activeYear.id) !== String(selectedYear.id)) && (
                <div
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                        !activeYear
                            ? "border-amber-300 bg-amber-50 text-amber-900"
                            : "border-blue-200 bg-blue-50 text-blue-900"
                    }`}
                    role="status"
                >
                    <div className="flex items-start gap-3">
                        <FiAlertTriangle className={`mt-0.5 shrink-0 ${!activeYear ? "text-amber-600" : "text-blue-600"}`} aria-hidden="true" />
                        <div>
                            <strong className="font-bold">Quarter advancement is unavailable here.</strong>{" "}
                            {activeYear
                                ? `Quarter advancement only applies to the active school year (SY ${activeYear.startYear}–${activeYear.endYear}), but you are currently
                              viewing ${selectedYear ? `SY ${selectedYear.startYear}–${selectedYear.endYear} (Historical)` : "no school year"}.`
                                : "No school year is currently active. An Administrator must activate a school year in Admin Settings before quarters can be advanced."}
                        </div>
                    </div>
                    {activeYear && selectedYear && String(activeYear.id) !== String(selectedYear.id) && (
                        <button
                            type="button"
                            className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                            onClick={() => handleYearChange(String(activeYear.id))}
                        >
                            Switch to SY {activeYear.startYear}–{activeYear.endYear}
                        </button>
                    )}
                </div>
            )}

            {/* ==================== Filters Bar ==================== */}
            <div className="sub-filter-bar">
                <div className="sub-filter-row">
                    {/* 1. School Year */}
                    <div className="sub-filter-group">
                        <label htmlFor="sub-filter-sy">School Year</label>
                        <select
                            id="sub-filter-sy"
                            className="sub-filter-select"
                            value={selectedYearId}
                            onChange={(e) => handleYearChange(e.target.value)}
                            aria-label="Filter by School Year"
                        >
                            {years.map((sy) => (
                                <option key={sy.id} value={sy.id}>
                                    SY {sy.startYear}–{sy.endYear}{sy.isActive ? " (Active)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Grade Level */}
                    <div className="sub-filter-group">
                        <label htmlFor="sub-filter-grade">Grade Level</label>
                        <select
                            id="sub-filter-grade"
                            className="sub-filter-select"
                            value={selectedGradeLevel}
                            onChange={(e) => {
                                const val = e.target.value === "all" ? "all" : Number(e.target.value);
                                setSelectedGradeLevel(val);
                                if (val !== "all" && selectedClassId !== "all") {
                                    const cls = summary.find((c) => c.classId === selectedClassId);
                                    if (cls && cls.gradeLevel !== val) {
                                        setSelectedClassId("all");
                                    }
                                }
                            }}
                            aria-label="Filter by Grade Level"
                        >
                            <option value="all">All Grade Levels</option>
                            {gradeLevels.map((gl) => (
                                <option key={gl} value={gl}>
                                    Grade {gl}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Class / Section */}
                    <div className="sub-filter-group">
                        <label htmlFor="sub-filter-class">Class / Section</label>
                        <select
                            id="sub-filter-class"
                            className="sub-filter-select"
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value === "all" ? "all" : Number(e.target.value))}
                            aria-label="Filter by Class or Section"
                        >
                            <option value="all">All Classes</option>
                            {availableClasses.map((c) => (
                                <option key={c.classId} value={c.classId}>
                                    {c.section} (Grade {c.gradeLevel})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 4. Quarter */}
                    <div className="sub-filter-group">
                        <label htmlFor="sub-filter-quarter">Quarter</label>
                        <select
                            id="sub-filter-quarter"
                            className="sub-filter-select"
                            value={selectedQuarter}
                            onChange={(e) => setSelectedQuarter(e.target.value === "all" ? "all" : Number(e.target.value))}
                            aria-label="Filter by Quarter"
                        >
                            <option value="all">All Quarters</option>
                            {quarters.map((q) => (
                                <option key={q} value={q}>
                                    Quarter {q}{q === currentQuarter ? " (Current)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Actions: Reset button and Advance button */}
                    <div className="sub-filter-actions">
                        {isFiltered && (
                            <button
                                type="button"
                                className="sub-btn-reset"
                                onClick={handleResetFilters}
                                title="Reset all filters to defaults"
                            >
                                <FiRotateCcw className="h-3.5 w-3.5" />
                                Reset Filters
                            </button>
                        )}
                        <button
                            type="button"
                            className="settings__btn inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[0.8125rem] font-bold disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!canAdvance || advancing}
                            onClick={() => setConfirmAdvance(true)}
                            title={advanceBlockedReason ?? "Advance to the next quarter"}
                        >
                            {advancing ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSkipForward aria-hidden="true" />}
                            {advancing ? "Advancing…" : `Advance to Q${(currentQuarter ?? 0) + 1}`}
                        </button>
                    </div>
                </div>
            </div>

            {/* ==================== Legend Bar ==================== */}
            <div className="sub-legend-bar">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Submission Legend:
                </span>
                <div className="sub-legend-items">
                    <div className="sub-legend-item">
                        <span className="sub-legend-chip sub-legend-chip--green" />
                        <span>Complete (100%)</span>
                    </div>
                    <div className="sub-legend-item">
                        <span className="sub-legend-chip sub-legend-chip--neutral" />
                        <span>Partial Submission</span>
                    </div>
                    <div className="sub-legend-item">
                        <span className="sub-legend-chip sub-legend-chip--empty" />
                        <span>No Submissions (0)</span>
                    </div>
                </div>
                <span className="sub-legend-note">
                    * Click on any quarter cell to inspect student records and submission status.
                </span>
            </div>

            {/* ==================== Unified Spreadsheet-Style Matrix ==================== */}
            <PageSection className="tracker__card" flush>
                {classroomGroups.length === 0 ? (
                    <div className="tracker__empty flex flex-col items-center justify-center px-6 py-20 text-center">
                        <span className="tracker__empty-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" aria-hidden="true">
                            <FiBookOpen />
                        </span>
                        <h3 className="tracker__empty-title mt-4 text-base font-bold">No classes yet</h3>
                        <p className="tracker__empty-text mt-1 max-w-md text-[0.8125rem] leading-relaxed">
                            No classrooms or student records exist for this school year. Classes and subjects will appear here once configured.
                        </p>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="tracker__empty flex flex-col items-center justify-center px-6 py-16 text-center">
                        <span className="tracker__empty-icon inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" aria-hidden="true">
                            <FiBookOpen />
                        </span>
                        <h3 className="tracker__empty-title mt-3 text-base font-bold text-slate-800 dark:text-slate-200">
                            No matching classes or subjects
                        </h3>
                        <p className="tracker__empty-text mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">
                            No classrooms or assigned subjects match your selected filters.
                        </p>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#176B3A] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D4F2B] transition"
                        >
                            <FiRotateCcw className="h-3.5 w-3.5" />
                            Reset Filters
                        </button>
                    </div>
                ) : (
                    <div className="sub-matrix-card">
                        <div className="sub-matrix-viewport">
                            <table className="sub-matrix-table" aria-label="Spreadsheet Submission Matrix">
                                <thead>
                                    <tr>
                                        <th className="sub-col-matrix-class" scope="col">
                                            Classroom / Section
                                        </th>
                                        <th className="sub-col-matrix-grade" scope="col">
                                            Grade Level
                                        </th>
                                        <th className="sub-col-matrix-subject" scope="col">
                                            Subject
                                        </th>
                                        <th className="sub-col-matrix-students sub-col-divider" scope="col">
                                            Students
                                        </th>
                                        {visibleQuarters.map((q) => {
                                            const isCurrent = currentQuarter === q;
                                            return (
                                                <th
                                                    key={q}
                                                    className={`sub-col-quarter ${isCurrent ? "sub-quarter-header--current" : ""}`}
                                                    scope="col"
                                                    title={`Quarter ${q}${isCurrent ? " (Current Quarter)" : ""}`}
                                                >
                                                    <div className="sub-quarter-header">
                                                        <span className="sub-quarter-header__abbr">
                                                            {isCurrent ? "Current" : "Quarter"}
                                                        </span>
                                                        <span className="sub-quarter-header__num">Q{q}</span>
                                                        {isCurrent && (
                                                            <span className="sub-quarter-current-badge">Active</span>
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredGroups.map((group) => {
                                        if (group.subjects.length === 0) {
                                            return (
                                                <tr
                                                    key={`class-${group.classId}`}
                                                    className="sub-matrix-row border-b-2 border-slate-200 dark:border-slate-800"
                                                >
                                                    <td className="sub-col-matrix-class px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-900 dark:text-white">
                                                                {group.section}
                                                            </span>
                                                            {group.adviserFullname && (
                                                                <span className="text-[0.6875rem] text-slate-500 font-normal">
                                                                    Adviser: {group.adviserFullname}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="sub-col-matrix-grade px-3 py-3 text-center text-slate-700 dark:text-slate-300 font-medium">
                                                        Grade {group.gradeLevel}
                                                    </td>
                                                    <td className="sub-col-matrix-subject px-4 py-3 italic text-slate-400 text-xs">
                                                        No subjects assigned
                                                    </td>
                                                    <td className="sub-col-matrix-students sub-col-divider px-3 py-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                                        {group.totalEnrolled}
                                                    </td>
                                                    {visibleQuarters.map((q) => (
                                                        <td key={q} className="sub-col-quarter px-2 py-3 text-center">
                                                            <span className="sub-cell-badge sub-cell-badge--empty">
                                                                <span className="sub-cell-badge__ratio">—</span>
                                                            </span>
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        }

                                        return group.subjects.map((subj, idx) => {
                                            const isLastSubject = idx === group.subjects.length - 1;
                                            return (
                                                <tr
                                                    key={`subj-${subj.classSubjectId}`}
                                                    className={`sub-matrix-row ${
                                                        isLastSubject
                                                            ? "border-b-2 border-slate-300 dark:border-slate-700"
                                                            : "border-b border-slate-100 dark:border-slate-800/60"
                                                    }`}
                                                >
                                                    {idx === 0 && (
                                                        <td
                                                            rowSpan={group.subjects.length}
                                                            className="sub-col-matrix-class px-4 py-3 align-top font-bold text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800"
                                                        >
                                                            <div className="flex flex-col sticky top-12">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                                                    {group.section}
                                                                </span>
                                                                {group.adviserFullname && (
                                                                    <span className="text-[0.6875rem] text-slate-500 font-normal mt-0.5">
                                                                        Adviser: {group.adviserFullname}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {idx === 0 && (
                                                        <td
                                                            rowSpan={group.subjects.length}
                                                            className="sub-col-matrix-grade px-3 py-3 align-top text-center text-slate-700 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-slate-800"
                                                        >
                                                            <div className="sticky top-12">
                                                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                                                                    Grade {group.gradeLevel}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="sub-col-matrix-subject px-4 py-2.5">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                                                {subj.subjectName}
                                                            </span>
                                                            <span className="text-[0.75rem] text-slate-500 dark:text-slate-400">
                                                                {subj.teacherName || "Unassigned"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="sub-col-matrix-students sub-col-divider px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                                        {subj.totalStudents}
                                                    </td>
                                                    {visibleQuarters.map((q) => {
                                                        const submittedCount = subj.submitted[q] ?? 0;
                                                        const total = subj.totalStudents;
                                                        const isCurrent = q === currentQuarter;
                                                        const isSubmitted =
                                                            subj.statusByQuarter[q] === "submitted" ||
                                                            (total > 0 && submittedCount === total);
                                                        const isPartial = !isSubmitted && submittedCount > 0 && submittedCount < total;

                                                        let badgeClass = "sub-cell-badge--empty";
                                                        if (total > 0) {
                                                            if (isSubmitted) badgeClass = "sub-cell-badge--green";
                                                            else if (isPartial) badgeClass = "sub-cell-badge--neutral";
                                                        }

                                                        return (
                                                            <td
                                                                key={q}
                                                                className={`sub-col-quarter px-2 py-2.5 text-center ${
                                                                    isCurrent ? "sub-col-quarter--current" : ""
                                                                }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openSubjectDrilldown(subj, q)}
                                                                    className={`sub-cell-badge ${badgeClass} cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#176b3a]`}
                                                                    aria-label={`Quarter ${q} for ${subj.subjectName} in ${group.section}: ${submittedCount} of ${total} submitted`}
                                                                    title={`Click to inspect Quarter ${q} student submissions for ${subj.subjectName}`}
                                                                >
                                                                    <span className="sub-cell-badge__ratio">
                                                                        {total > 0 ? `${submittedCount}/${total}` : "—"}
                                                                    </span>
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </PageSection>

            {/* ==================== Admin Locking Notice ==================== */}
            <div className="tracker__notice mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <FiAlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                    The administrator can lock grade submissions from the Settings page to prevent faculties from submitting student records.
                </span>
            </div>

            {/* ==================== Detailed Student Submission Modal ==================== */}
            <ModalDialog
                open={subjectDrilldown !== null}
                onClose={() => setSubjectDrilldown(null)}
                labelledById="subject-tracker-modal-title"
                scrollable
                maxWidth="max-w-[48rem]"
                className="tracker__modal-panel w-full rounded-2xl border border-[var(--neutral-border)] bg-white shadow-2xl dark:bg-slate-900 dark:border-slate-800"
            >
                {subjectDrilldown && (
                    <div className="flex h-full max-h-[calc(90dvh-2.5rem)] flex-col" role="document">
                        <header className="tracker__modal-header shrink-0 flex items-start justify-between gap-4 p-6 pb-4 border-b border-[var(--neutral-border)] dark:border-slate-800">
                            <div className="tracker__modal-heading min-w-0">
                                <span className="tracker__modal-eyebrow text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-400">
                                    {subjectDrilldown.row.classSection} &middot; Grade {subjectDrilldown.row.classGradeLevel} &middot; Quarter {subjectDrilldown.quarter}
                                </span>
                                <h3 id="subject-tracker-modal-title" className="tracker__modal-title mt-0.5 truncate text-xl font-bold text-slate-900 dark:text-white">
                                    {subjectDrilldown.row.subjectName} {subjectDrilldown.row.subjectCode ? `(${subjectDrilldown.row.subjectCode})` : ""}
                                </h3>
                                <p className="tracker__modal-subtitle mt-1 truncate text-[0.8125rem] text-slate-600 dark:text-slate-400">
                                    Subject Teacher: <strong className="font-semibold text-slate-800 dark:text-slate-200">{subjectDrilldown.row.teacherName || "Unassigned"}</strong> &middot; Classroom: <strong className="font-semibold text-slate-800 dark:text-slate-200">{subjectDrilldown.row.classSection}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                className="tracker__modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg cursor-pointer text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                onClick={() => setSubjectDrilldown(null)}
                                aria-label="Close modal"
                            >
                                <FiX aria-hidden="true" />
                            </button>
                        </header>

                        <div className="min-h-0 flex-1 overflow-y-auto p-6">
                            {/* Summary Metrics Chips */}
                            {subjectDrilldown.data && (
                                <div className="mb-4 flex flex-wrap items-center gap-3">
                                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        <FiUsers className="text-slate-500" />
                                        <span>Total Enrolled: {subjectDrilldown.data.progress.total}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                        <FiCheckCircle className="text-emerald-600" />
                                        <span>Submitted: {subjectDrilldown.data.progress.submitted}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                        <FiClock className="text-amber-600" />
                                        <span>Pending: {subjectDrilldown.data.progress.pending}</span>
                                    </div>
                                </div>
                            )}

                            {subjectDrilldownLoading ? (
                                <div className="flex min-h-[12rem] items-center justify-center">
                                    <FiRefreshCw className="animate-spin text-2xl text-gray-400" aria-hidden="true" />
                                </div>
                            ) : subjectDrilldown.data ? (
                                subjectDrilldown.data.students.length === 0 ? (
                                    <div className="tracker__modal-empty py-10 text-center text-[0.8125rem] text-slate-500">
                                        No students enrolled in this subject for this quarter.
                                    </div>
                                ) : (
                                    <div className="tracker__modal-table-wrap overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                        <table className="tracker__modal-table w-full border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                                                    <th className="px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                        Student
                                                    </th>
                                                    <th className="px-3 py-2.5 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                        Q{subjectDrilldown.quarter} Grade
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                        Status
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em]">
                                                        Submitted At
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                {subjectDrilldown.data.students.map((student) => {
                                                    const isSubmitted = student.status === "submitted" || Boolean(student.isFrozen);
                                                    return (
                                                        <tr key={student.enrollmentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                            <td className="px-4 py-2.5">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-[0.8125rem] font-bold text-slate-900 dark:text-white">
                                                                        {student.fullname}
                                                                    </p>
                                                                    <p className="font-mono text-[0.6875rem] text-slate-500">
                                                                        LRN {student.studentLrn} · {student.studentSex}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                                                {student.quarterGrade !== null ? student.quarterGrade.toFixed(2) : "—"}
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                {isSubmitted ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.6875rem] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                        <FiCheckCircle className="h-3 w-3" aria-hidden="true" />
                                                                        Submitted
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.6875rem] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                                        <FiClock className="h-3 w-3" aria-hidden="true" />
                                                                        Pending
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-[0.75rem] text-slate-500 dark:text-slate-400">
                                                                {formatSubmittedAt(student.submittedAt) ?? "—"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : (
                                <div className="tracker__modal-empty py-10 text-center text-[0.8125rem] text-slate-500">
                                    Could not load this subject&apos;s records.
                                </div>
                            )}
                        </div>

                        <footer className="shrink-0 flex items-center justify-end gap-3 p-4 px-6 border-t border-[var(--neutral-border)] bg-neutral-50 dark:border-slate-800 dark:bg-slate-900">
                            <button
                                type="button"
                                onClick={() => setSubjectDrilldown(null)}
                                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-neutral-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                Close
                            </button>
                        </footer>
                    </div>
                )}
            </ModalDialog>

            {/* ==================== Advance Quarter Confirm Dialog ==================== */}
            <ConfirmDialog
                open={confirmAdvance}
                title={`Advance to Quarter ${(currentQuarter ?? 0) + 1}?`}
                description={`This will change the active quarter from Q${currentQuarter} to Q${(currentQuarter ?? 0) + 1}. Faculties will then be able to submit records for the new quarter. This action cannot be undone from this page.`}
                confirmLabel={advancing ? "Advancing…" : "Advance Quarter"}
                confirmIcon={advancing ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSkipForward aria-hidden="true" />}
                tone="primary"
                pending={advancing}
                onConfirm={handleAdvanceQuarter}
                onClose={() => setConfirmAdvance(false)}
            />
        </PageShell>
    );
}
