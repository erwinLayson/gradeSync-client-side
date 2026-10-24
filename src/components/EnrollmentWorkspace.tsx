import {
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiLock,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";

import "../style/adminEnrollments.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAPICall, postAPICall } from "../api/api";

// Hooks
import useClassroom from "../hooks/useClassroom.ts";
import useSubjects from "../hooks/useSubject.ts";

// Components
import { ConfirmDialog } from "./ConfirmDialog";
import { PageHeader, PageShell } from "./PageLayout";
import type { PastGradesView } from "../pages/admin/StudentPastGradesModal";

// Types
import type {
  ClassroomResponseProps,
  ClassroomFacultiesWithSubjectProps,
} from "../constant/classrooms.ts";
import type { StudentResponseProps } from "../constant/students";

interface SchoolYear {
  id: number;
  startYear: string;
  endYear: string;
  status?: "ongoing" | "completed" | string;
}

interface AcademicSettingsData {
  id: number;
  currentQuarter: number;
  numQuarters: number;
  enrollmentOpen: boolean | number;
}

export interface EnrollmentWorkspaceProps {
  /**
   * Admin and Register: create a new school year from the header.
   */
  allowSchoolYearCreation?: boolean;
}

const CAPACITY = 40;

const STEPS = [
  { id: 1, label: "School Year" },
  { id: 2, label: "Student" },
  { id: 3, label: "Grade Level" },
  { id: 4, label: "Class" },
  { id: 5, label: "Subjects" },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "S";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Shared enrollment workspace matching the reference design layout.
 * Retains the green theme palette and all existing logic.
 */
export default function EnrollmentWorkspace({
  allowSchoolYearCreation = false,
}: EnrollmentWorkspaceProps) {
  // ============ Student Search ============
  const [students, setStudents] = useState<StudentResponseProps[] | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentResponseProps | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // ============ Classrooms, Subjects & Grade Level ============
  const { classrooms, loading, setLoading, refetchClassroom } = useClassroom<ClassroomResponseProps[]>();
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<number | null>(null);
  const [selectedClassroom, setSelectedClassroom] = useState<ClassroomResponseProps | null>(null);
  const {
    subjects: classSubjects,
    subjectsLoading,
    fetchSubjects: fetchClassSubjects,
  } = useSubjects<ClassroomFacultiesWithSubjectProps[]>();
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);

  // ============ Past Grades (Selected Student) ============
  const [pastGrades, setPastGrades] = useState<PastGradesView | null>(null);
  const [pastGradesLoading, setPastGradesLoading] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});

  // ============ School Year ============
  const [schoolYear, setSchoolYear] = useState<SchoolYear[] | null>(null);
  const [schoolYearLoading, setSchoolYearLoading] = useState(true);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | null>(null);

  // ============ Enrollment Window ============
  const [enrollmentOpen, setEnrollmentOpen] = useState<boolean | null>(null);

  // ============ Submission State ============
  const [enrolling, setEnrolling] = useState(false);
  const [creatingSchoolYear, setCreatingSchoolYear] = useState(false);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  // ================== Debounce Search Input ==================
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchQuery);
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ================== Fetch Not-Enrolled Students ==================
  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);

      if (!searchDebounced) {
        return;
      }

      const schoolYearParam = selectedSchoolYearId ? `&schoolYearId=${selectedSchoolYearId}` : "";
      const response = await getAPICall<StudentResponseProps[]>(
        `/students/not-enrolled?search=${encodeURIComponent(searchDebounced)}${schoolYearParam}`,
      );

      setStudents(response.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, setLoading, selectedSchoolYearId]);

  useEffect(() => {
    fetchStudents();
    getAPICall<SchoolYear[]>("/schoolYear")
      .then((response) => {
        setSchoolYear(response.data ?? []);
        setSelectedSchoolYearId((current) => current ?? response.data?.[0]?.id ?? null);
      })
      .catch(() => {
        // Keep the flow usable: an outage is not the same as "still loading".
        setSchoolYear([]);
      })
      .finally(() => setSchoolYearLoading(false));
    getAPICall<AcademicSettingsData>("/academic-settings", { toast: false }).then((response) => {
      setEnrollmentOpen(Boolean(response.data?.enrollmentOpen));
    });
  }, [fetchStudents]);

  // ================== Load Past Grades When Student Selected ==================
  useEffect(() => {
    if (!selectedStudent) {
      setPastGrades(null);
      setPastGradesLoading(false);
      setSelectedGradeLevel(null);
      setSelectedClassroom(null);
      setSelectedSubjectIds([]);
      setExpandedYears({});
      return;
    }

    let cancelled = false;
    setPastGradesLoading(true);
    setSelectedClassroom(null);
    setSelectedSubjectIds([]);

    getAPICall<PastGradesView>(`/students/${selectedStudent.id}/past-submitted-grades`, { toast: false })
      .then((response) => {
        if (cancelled) return;
        const data = response.data ?? null;
        setPastGrades(data);

        if (data && data.classes && data.classes.length > 0) {
          const sorted = [...data.classes].sort((a, b) => b.gradeLevel - a.gradeLevel);
          const highest = sorted[0];
          const isPassed = highest.generalAverage !== null ? highest.generalAverage >= 75 : true;
          const nextGrade = isPassed ? highest.gradeLevel + 1 : highest.gradeLevel;
          setSelectedGradeLevel(nextGrade);
          // Auto-expand the most recent school year
          setExpandedYears({ [highest.enrollmentId]: true });
        } else {
          setSelectedGradeLevel(7);
          setExpandedYears({});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPastGrades(null);
          setSelectedGradeLevel(7);
          setExpandedYears({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPastGradesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.id]);

  // Available grade levels from classrooms or standard 7-12
  const availableGradeLevels = useMemo(() => {
    const levels = new Set<number>();
    if (classrooms) {
      classrooms.forEach((c) => {
        if (typeof c.gradeLevel === "number") {
          levels.add(c.gradeLevel);
        }
      });
    }
    [7, 8, 9, 10, 11, 12].forEach((g) => levels.add(g));
    return Array.from(levels).sort((a, b) => a - b);
  }, [classrooms]);

  // Recommended grade level from past submitted records
  const recommendedGradeLevel = useMemo(() => {
    if (!pastGrades || !pastGrades.classes || pastGrades.classes.length === 0) {
      return null;
    }
    const sorted = [...pastGrades.classes].sort((a, b) => b.gradeLevel - a.gradeLevel);
    const highest = sorted[0];
    const isPassed = highest.generalAverage !== null ? highest.generalAverage >= 75 : true;
    return isPassed ? highest.gradeLevel + 1 : highest.gradeLevel;
  }, [pastGrades]);

  // Filter classrooms by the selected grade level
  const filteredClassrooms = useMemo(() => {
    if (!classrooms) return null;
    if (selectedGradeLevel === null) return classrooms;
    return classrooms.filter((c) => c.gradeLevel === selectedGradeLevel);
  }, [classrooms, selectedGradeLevel]);

  function handleGradeLevelChange(newGrade: number) {
    setSelectedGradeLevel(newGrade);
    if (selectedClassroom && selectedClassroom.gradeLevel !== newGrade) {
      setSelectedClassroom(null);
      setSelectedSubjectIds([]);
    }
  }

  // ================== Classroom Selection ==================
  async function handleSelectClassroom(classroom: ClassroomResponseProps) {
    setSelectedClassroom(classroom);
    setSelectedSubjectIds([]);

    await fetchClassSubjects(`/classrooms/${classroom.id}/faculties-subject/`);
  }

  // ================== Subject Selection ==================
  function toggleSubject(subjectId: number) {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  }

  function handleToggleAllSubjects() {
    if (!classSubjects || classSubjects.length === 0) return;
    if (selectedSubjectIds.length === classSubjects.length) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(classSubjects.map((s) => s.subjectId));
    }
  }

  // Toggle year accordion
  const toggleYearAccordion = (enrollmentId: number) => {
    setExpandedYears((prev) => ({
      ...prev,
      [enrollmentId]: !prev[enrollmentId],
    }));
  };

  // Reset student selection
  function handleClearStudent() {
    setSelectedStudent(null);
    setSelectedGradeLevel(null);
    setSelectedClassroom(null);
    setSelectedSubjectIds([]);
    setPastGrades(null);
    setSearchQuery("");
  }

  // ================== Derived State ==================
  const selectedSubjects =
    classSubjects?.filter((cs) => selectedSubjectIds.includes(cs.subjectId)) ?? [];
  const totalUnits = selectedSubjects.reduce((sum, cs) => sum + Number(cs.unit), 0);
  const selectedSchoolYear =
    schoolYear?.find((sy) => sy.id === selectedSchoolYearId) ?? null;

  const nextStartYear = new Date().getFullYear();
  const nextEndYear = nextStartYear + 1;

  const canEnroll = Boolean(
    selectedStudent &&
      selectedClassroom &&
      selectedGradeLevel &&
      selectedClassroom.gradeLevel === selectedGradeLevel &&
      selectedSubjectIds.length > 0 &&
      selectedSchoolYearId &&
      enrollmentOpen !== false,
  );

  // Stepper state
  const isStep1Done = Boolean(selectedSchoolYearId);
  const isStep2Done = Boolean(selectedStudent);
  const isStep3Done = Boolean(selectedGradeLevel);
  const isStep4Done = Boolean(selectedClassroom);
  const isStep5Done = selectedSubjectIds.length > 0;

  const currentStep = !selectedStudent
    ? 2
    : !selectedGradeLevel
      ? 3
      : !selectedClassroom
        ? 4
        : !isStep5Done
          ? 5
          : 5;

  const guidanceText = useMemo(() => {
    if (enrollmentOpen === false) return "Enrollment is closed in Admin Settings.";
    if (!selectedStudent) return "Select a student to continue.";
    if (!selectedGradeLevel) return "Select a grade level for this enrollment.";
    if (!selectedClassroom) return "Select a class to continue.";
    if (selectedSubjectIds.length === 0) return "Select at least one subject to enroll.";
    return "All details verified. Ready to enroll.";
  }, [enrollmentOpen, selectedStudent, selectedGradeLevel, selectedClassroom, selectedSubjectIds.length]);

  // ================== Handle Enrollment Submission ==================
  async function handleEnroll() {
    if (!selectedStudent || !selectedClassroom || !selectedSchoolYearId || !selectedGradeLevel) return;
    if (selectedSubjectIds.length === 0) return;

    setEnrolling(true);
    try {
      await postAPICall(
        "/enrollments",
        {
          studentId: selectedStudent.id,
          classId: selectedClassroom.id,
          schoolYearId: selectedSchoolYearId,
          subjectIds: selectedSubjectIds,
          gradeLevel: selectedGradeLevel,
        },
      );

      // Reset the flow and refresh lists
      handleClearStudent();
      fetchStudents();
      refetchClassroom();
    } catch {
      // Error toast is handled by axios interceptor
    } finally {
      setEnrolling(false);
    }
  }

  const closeCreateConfirm = useCallback(() => setConfirmCreateOpen(false), []);

  // ================== Create School Year ==================
  async function handleCreateSchoolYear() {
    if (creatingSchoolYear) return;

    setCreatingSchoolYear(true);
    try {
      const response = await postAPICall<object, SchoolYear>("/schoolYear", {});
      const listResponse = await getAPICall<SchoolYear[]>("/schoolYear");
      const updated = listResponse.data ?? null;
      setSchoolYear(updated);
      setSelectedSchoolYearId((current) => response.data?.id ?? updated?.[0]?.id ?? current);
      closeCreateConfirm();
      createTriggerRef.current?.focus();
    } catch {
      // Handled by axios interceptor
    } finally {
      setCreatingSchoolYear(false);
    }
  }

  return (
    <PageShell className="enrollments">
      {/* ============ Header ============ */}
      <PageHeader
        title="Enrollments"
        description="Enroll students into classes for a school year."
        meta={
          enrollmentOpen === false
            ? "Enrollment closed"
            : enrollmentOpen === null
              ? "Checking status…"
              : "Enrollment open"
        }
        actions={
          allowSchoolYearCreation ? (
            <button
              ref={createTriggerRef}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--neutral-border)] bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 transition-colors hover:border-[var(--primary)] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setConfirmCreateOpen(true)}
              disabled={creatingSchoolYear}
            >
              <FiCheckCircle aria-hidden="true" />
              {creatingSchoolYear ? "Creating…" : "Create new School Year"}
            </button>
          ) : undefined
        }
      />

      {/* ============ Closed Enrollment Banner ============ */}
      {enrollmentOpen === false && (
        <div
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <FiLock className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-bold">Enrollment is closed.</strong> New students can’t be
            enrolled right now. Reopen enrollment in{" "}
            <span className="font-semibold">Admin Settings → Academic Year</span> to continue.
          </p>
        </div>
      )}

      {/* ============ Top Stepper Bar (Matching Reference) ============ */}
      <nav
        className="enrollments__stepper-wrap flex items-center justify-between gap-3 overflow-x-auto px-6 py-4"
        aria-label="Enrollment progress"
      >
        {STEPS.map((step, idx) => {
          const isDone =
            (step.id === 1 && isStep1Done) ||
            (step.id === 2 && isStep2Done) ||
            (step.id === 3 && isStep3Done) ||
            (step.id === 4 && isStep4Done) ||
            (step.id === 5 && isStep5Done);

          const isActive = currentStep === step.id;

          return (
            <div key={step.id} className="flex flex-1 items-center gap-3 min-w-0">
              <div className="flex items-center gap-2.5 shrink-0">
                <span
                  className={`enrollments__stepper-circle ${
                    isDone
                      ? "enrollments__stepper-circle--done"
                      : isActive
                        ? "enrollments__stepper-circle--active"
                        : "enrollments__stepper-circle--inactive"
                  }`}
                >
                  {isDone ? <FiCheck /> : step.id}
                </span>
                <span
                  className={`text-xs whitespace-nowrap font-semibold ${
                    isDone || isActive ? "text-[var(--text-dark)] font-bold" : "text-neutral-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <span
                  className={`enrollments__stepper-line ${
                    isDone ? "enrollments__stepper-line--done" : ""
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* ============ 2-Column Layout (Matching Reference) ============ */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
        {/* ============ Left Column: Stacked Step Cards ============ */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Card 1: School Year */}
          <section className="enrollments__card p-5">
            <header className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <span className="enrollments__step-num" aria-hidden="true">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-dark)]">School Year</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Which school year is this enrollment for?
                  </p>
                </div>
              </div>
            </header>

            <div className="max-w-md">
              <select
                value={selectedSchoolYearId ?? ""}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  if (nextId) setSelectedSchoolYearId(nextId);
                }}
                aria-label="Select school year"
                disabled={schoolYearLoading || !schoolYear?.length}
                className="w-full rounded-lg border border-[var(--neutral-border)] bg-[var(--surface-bg)] px-3.5 py-2.5 text-xs font-semibold text-neutral-800 transition focus:border-[var(--primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {schoolYearLoading ? (
                  <option value="">Loading school years…</option>
                ) : schoolYear && schoolYear.length > 0 ? (
                  schoolYear.map((sy) => (
                    <option key={sy.id} value={sy.id}>
                      {sy.startYear}–{sy.endYear} {sy.status === "ongoing" ? "— Current" : ""}
                    </option>
                  ))
                ) : (
                  <option value="">No school years available</option>
                )}
              </select>
            </div>
          </section>

          {/* Card 2: Student */}
          <section className="enrollments__card p-5">
            <header className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <span className="enrollments__step-num" aria-hidden="true">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-dark)]">Student</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Search by name or email, then pick from the results.
                  </p>
                </div>
              </div>
              {searchDebounced && !selectedStudent && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-neutral-600">
                  {students?.length ?? 0} result{students?.length === 1 ? "" : "s"}
                </span>
              )}
            </header>

            {/* Search Input */}
            <div className="relative max-w-md mb-4">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                placeholder="Search student by name or LRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search students"
                className="w-full rounded-lg border border-[var(--neutral-border)] bg-[var(--surface-bg)] py-2.5 pl-9 pr-3 text-xs text-neutral-800 transition focus:border-[var(--primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

            {/* If student is selected: Selected Chip + Previous School Years */}
            {selectedStudent ? (
              <div className="flex flex-col gap-4">
                {/* Selected Student Pill/Chip */}
                <div className="enrollments__student-chip">
                  <span className="enrollments__avatar-circle">
                    {getInitials(selectedStudent.fullname)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-neutral-900 leading-tight truncate">
                      {selectedStudent.fullname}
                    </div>
                    <div className="text-[0.6875rem] text-neutral-500 truncate">
                      {selectedStudent.email} · LRN: {selectedStudent.lrn}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearStudent}
                    aria-label="Deselect student"
                    className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700"
                  >
                    <FiX size={13} />
                  </button>
                </div>

                {/* Previous school years section (Exact match to reference) */}
                <div className="enrollments__past-years-box p-4 rounded-xl border border-neutral-200 bg-neutral-50/70">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white border border-neutral-200 text-neutral-700 text-xs">
                        <FiBookOpen />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900">Previous school years</h4>
                        <p className="text-[0.6875rem] text-neutral-500">
                          {pastGradesLoading
                            ? "Retrieving past academic history…"
                            : pastGrades && pastGrades.classes.length > 0
                              ? `${pastGrades.classes.length} school year${
                                  pastGrades.classes.length === 1 ? "" : "s"
                                } on record, excluding current year.`
                              : "No previous school years on record (New student / Transferee)."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Accordion List of Past School Years */}
                  {pastGradesLoading ? (
                    <div className="py-6 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
                      <FiCalendar className="animate-spin text-neutral-400" />
                      Loading past grades…
                    </div>
                  ) : pastGrades && pastGrades.classes.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {pastGrades.classes.map((cls) => {
                        const isExpanded = Boolean(expandedYears[cls.enrollmentId]);

                        return (
                          <div
                            key={cls.enrollmentId}
                            className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-2xs"
                          >
                            {/* Accordion Header */}
                            <button
                              type="button"
                              onClick={() => toggleYearAccordion(cls.enrollmentId)}
                              className="w-full flex items-center justify-between gap-3 p-3 text-left transition hover:bg-neutral-50/80"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-neutral-500 text-xs">
                                  {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                                </span>
                                <div className="min-w-0">
                                  <span className="font-bold text-xs text-neutral-900 mr-2">
                                    {cls.schoolYear}
                                  </span>
                                  <span className="text-[0.6875rem] text-neutral-500 truncate">
                                    Grade {cls.gradeLevel} · {cls.section}
                                    {cls.adviser ? ` · Adviser: ${cls.adviser}` : ""} · completed
                                  </span>
                                </div>
                              </div>

                              {cls.generalAverage !== null && (
                                <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[0.6875rem] font-bold text-neutral-800 tabular-nums">
                                  Average {cls.generalAverage.toFixed(2)}
                                </span>
                              )}
                            </button>

                            {/* Expanded Subjects Table (Matching Reference) */}
                            {isExpanded && (
                              <div className="border-t border-neutral-100 p-3 bg-neutral-50/40">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="border-b border-neutral-200 text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">
                                        <th className="py-1.5 px-2">Subject</th>
                                        <th className="py-1.5 px-2 text-center">Quarter 1</th>
                                        <th className="py-1.5 px-2 text-center">Quarter 2</th>
                                        <th className="py-1.5 px-2 text-center">Quarter 3</th>
                                        <th className="py-1.5 px-2 text-center">Quarter 4</th>
                                        <th className="py-1.5 px-2 text-right">Final Grade</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                      {cls.subjects.map((sub) => (
                                        <tr key={sub.code}>
                                          <td className="py-1.5 px-2 font-medium text-neutral-800">
                                            {sub.name}
                                          </td>
                                          {sub.quarters.map((q, qIdx) => (
                                            <td
                                              key={qIdx}
                                              className="py-1.5 px-2 text-center tabular-nums text-neutral-600"
                                            >
                                              {q !== null ? q.toFixed(2) : "—"}
                                            </td>
                                          ))}
                                          <td className="py-1.5 px-2 text-right font-bold tabular-nums text-neutral-900">
                                            {sub.final !== null ? sub.final.toFixed(2) : "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-neutral-200 font-bold">
                                        <td colSpan={5} className="py-2 px-2 text-neutral-700">
                                          General Average
                                        </td>
                                        <td className="py-2 px-2 text-right tabular-nums text-neutral-900">
                                          {cls.generalAverage !== null
                                            ? cls.generalAverage.toFixed(2)
                                            : "—"}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-neutral-500">
                      No finalized past school-year grades on record for this student.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Search Results Dropdown List when searching */
              <div className="rounded-lg border border-[var(--neutral-border)] bg-white max-h-56 overflow-y-auto divide-y divide-neutral-100 shadow-xs">
                {loading && searchDebounced ? (
                  <div className="p-4 text-center text-xs text-neutral-500">Searching students…</div>
                ) : students && students.length > 0 ? (
                  students.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudent(s)}
                      className="w-full flex items-center justify-between p-3 text-left transition hover:bg-neutral-50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="enrollments__avatar-circle">
                          {getInitials(s.fullname)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-neutral-900 truncate">
                            {s.fullname}
                          </div>
                          <div className="text-[0.6875rem] text-neutral-500 truncate">
                            {s.email} · LRN: {s.lrn}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-[var(--primary)]">
                        Select →
                      </span>
                    </button>
                  ))
                ) : searchDebounced ? (
                  <div className="p-4 text-center text-xs text-neutral-500">
                    No students found for &ldquo;{searchDebounced}&rdquo;.
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-neutral-400">
                    Type a name or LRN above to search not-yet-enrolled candidates.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Card 3: Grade Level */}
          <section className="enrollments__card p-5">
            <header className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <span className="enrollments__step-num" aria-hidden="true">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-dark)]">Grade Level</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Select the grade level for this enrollment.
                  </p>
                </div>
              </div>
              {recommendedGradeLevel && selectedStudent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.6875rem] font-bold text-emerald-800 border border-emerald-200">
                  <FiCheckCircle />
                  Recommended: Grade {recommendedGradeLevel}
                </span>
              )}
            </header>

            {!selectedStudent ? (
              <div className="py-6 text-center text-xs text-neutral-400">
                Select a student first.
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Select Grade Level">
                {availableGradeLevels.map((gl) => {
                  const isSelected = selectedGradeLevel === gl;
                  const isRecommended = recommendedGradeLevel === gl;

                  return (
                    <button
                      key={gl}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleGradeLevelChange(gl)}
                      className={`enrollments__grade-square relative ${
                        isSelected ? "enrollments__grade-square--active" : ""
                      }`}
                    >
                      <span>{gl}</span>
                      {isRecommended && !isSelected && (
                        <span
                          className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                          title="Recommended based on past grades"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Card 4: Class */}
          <section className="enrollments__card p-5">
            <header className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <span className="enrollments__step-num" aria-hidden="true">
                  4
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-dark)]">Class</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Classes matching the selected grade level.
                  </p>
                </div>
              </div>
              {selectedGradeLevel && filteredClassrooms && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-neutral-600">
                  {filteredClassrooms.length} available
                </span>
              )}
            </header>

            {!selectedGradeLevel ? (
              <div className="py-6 text-center text-xs text-neutral-400">
                Select a grade level first.
              </div>
            ) : filteredClassrooms === null || loading ? (
              <div className="py-6 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
                <FiCalendar className="animate-spin text-neutral-400" />
                Loading classrooms…
              </div>
            ) : filteredClassrooms.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredClassrooms.map((c) => {
                  const enrolled = Number(c.totalStudent) || 0;
                  const pct = Math.min(100, Math.round((enrolled / CAPACITY) * 100));
                  const slotsLeft = Math.max(0, CAPACITY - enrolled);
                  const isLow = slotsLeft > 0 && slotsLeft <= 4;
                  const isFull = slotsLeft === 0;
                  const isActive = selectedClassroom?.id === c.id;

                  return (
                    <label
                      key={String(c.id)}
                      className={`enrollments__class relative flex cursor-pointer flex-col gap-3 overflow-hidden p-4 isolate ${
                        isActive ? "enrollments__class--active" : ""
                      } ${isLow ? "enrollments__class--low" : ""} ${
                        isFull ? "enrollments__class--full" : ""
                      }`}
                      htmlFor={`classroom-${c.id}`}
                    >
                      <input
                        type="radio"
                        name="classroom"
                        id={`classroom-${c.id}`}
                        value={c.id}
                        checked={isActive}
                        onChange={() => handleSelectClassroom(c)}
                      />

                      <span className="flex items-start justify-between gap-3">
                        <span
                          className="enrollments__class-monogram inline-flex h-9 w-9 shrink-0 items-center justify-center text-sm font-bold"
                          aria-hidden="true"
                        >
                          {c.section.charAt(0)}
                        </span>
                        <span
                          className="enrollments__class-check inline-flex items-center justify-center"
                          aria-hidden="true"
                        >
                          <FiCheck />
                        </span>
                      </span>

                      <span className="flex flex-col gap-0.5">
                        <span className="enrollments__class-grade self-start px-2 py-0.5 text-[0.625rem] font-bold uppercase">
                          Grade {c.gradeLevel}
                        </span>
                        <span className="enrollments__class-section text-base font-extrabold text-neutral-900">
                          {c.section}
                        </span>
                      </span>

                      <span className="enrollments__class-capacity">
                        <span className="enrollments__class-capacity-meta flex items-center justify-between gap-2 text-[0.6875rem]">
                          <span className="flex items-center gap-1 font-semibold text-neutral-700">
                            <FiUsers aria-hidden="true" />
                            {enrolled}/{CAPACITY} enrolled
                          </span>
                          <span className="enrollments__class-slots-pct px-1.5 py-0.5 text-[0.625rem]">
                            {pct}% full
                          </span>
                        </span>
                        <span className="enrollments__class-bar mt-2 block" aria-hidden="true">
                          <span
                            className="enrollments__class-bar-fill block"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      </span>

                      <span className="enrollments__class-foot inline-flex items-center gap-1.5 text-xs text-neutral-500">
                        {isFull
                          ? "Class is full"
                          : `${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left`}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500">
                No sections found for Grade {selectedGradeLevel}.
              </div>
            )}
          </section>

          {/* Card 5: Subjects */}
          <section className="enrollments__card p-5">
            <header className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <span className="enrollments__step-num" aria-hidden="true">
                  5
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-dark)]">Subjects</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Subjects assigned to this class — choose which to enroll.
                  </p>
                </div>
              </div>
              {selectedClassroom && classSubjects && classSubjects.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleAllSubjects}
                    className="rounded-lg border border-[var(--neutral-border)] bg-white px-2.5 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    {selectedSubjectIds.length === classSubjects.length ? "Deselect All" : "Select All"}
                  </button>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-neutral-600">
                    {selectedSubjectIds.length}/{classSubjects.length} selected
                  </span>
                </div>
              )}
            </header>

            {!selectedClassroom ? (
              <div className="py-6 text-center text-xs text-neutral-400">
                Select a class first.
              </div>
            ) : subjectsLoading ? (
              <div className="py-6 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
                <FiCalendar className="animate-spin text-neutral-400" />
                Loading subjects…
              </div>
            ) : classSubjects && classSubjects.length > 0 ? (
              <div className="flex flex-col gap-2">
                {classSubjects.map((cs) => {
                  const checked = selectedSubjectIds.includes(cs.subjectId);

                  return (
                    <label
                      key={cs.subjectId}
                      className={`enrollments__subject relative flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                        checked
                          ? "border-[var(--primary)] bg-emerald-50/40"
                          : "border-neutral-200 bg-white hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSubject(cs.subjectId)}
                        className="rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="enrollments__subject-icon inline-flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 text-xs">
                        <FiBookOpen />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-xs font-bold text-neutral-900 truncate">
                          {cs.subjectName}
                        </span>
                        <span className="text-[0.6875rem] text-neutral-500 truncate">
                          {cs.facultyFullname}
                        </span>
                      </div>
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[0.625rem] font-mono font-semibold text-neutral-600">
                        {cs.code}
                      </span>
                      <span className="text-xs font-medium text-neutral-700">
                        {cs.unit === null || cs.unit === undefined
                          ? "No units"
                          : `${cs.unit} unit${cs.unit === 1 ? "" : "s"}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500">
                No subjects assigned to this section yet.
              </div>
            )}
          </section>
        </div>

        {/* ============ Right Column: Enrollment Summary (Sticky Card) ============ */}
        <aside className="enrollments__summary-card sticky top-5 flex flex-col p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-neutral-900 mb-5">Enrollment summary</h3>

          {/* SCHOOL YEAR */}
          <div className="flex flex-col gap-1 pb-4">
            <span className="text-[0.625rem] font-extrabold uppercase tracking-wider text-neutral-400">
              SCHOOL YEAR
            </span>
            <div className="text-xs font-bold text-neutral-900">
              {selectedSchoolYear
                ? `${selectedSchoolYear.startYear}–${selectedSchoolYear.endYear}`
                : "Not selected"}
            </div>
          </div>

          {/* STUDENT */}
          <div className="enrollments__summary-divider pt-4 pb-4 flex flex-col gap-1.5">
            <span className="text-[0.625rem] font-extrabold uppercase tracking-wider text-neutral-400">
              STUDENT
            </span>
            {selectedStudent ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="enrollments__avatar-circle h-7 w-7 text-[0.6875rem]">
                  {getInitials(selectedStudent.fullname)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-neutral-900 truncate">
                    {selectedStudent.fullname}
                  </div>
                  <div className="text-[0.6875rem] text-neutral-500 truncate">
                    {selectedStudent.email}
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-xs text-neutral-400">Not selected</span>
            )}
          </div>

          {/* GRADE LEVEL */}
          <div className="enrollments__summary-divider pt-4 pb-4 flex flex-col gap-1">
            <span className="text-[0.625rem] font-extrabold uppercase tracking-wider text-neutral-400">
              GRADE LEVEL
            </span>
            <div className="text-xs font-bold text-neutral-900">
              {selectedGradeLevel ? `Grade ${selectedGradeLevel}` : "Not selected"}
            </div>
          </div>

          {/* CLASS */}
          <div className="enrollments__summary-divider pt-4 pb-4 flex flex-col gap-1">
            <span className="text-[0.625rem] font-extrabold uppercase tracking-wider text-neutral-400">
              CLASS
            </span>
            <div className="text-xs font-bold text-neutral-900">
              {selectedClassroom
                ? `Grade ${selectedClassroom.gradeLevel} – ${selectedClassroom.section}`
                : "Not selected"}
            </div>
          </div>

          {/* SUBJECTS */}
          <div className="enrollments__summary-divider pt-4 pb-5 flex flex-col gap-1">
            <span className="text-[0.625rem] font-extrabold uppercase tracking-wider text-neutral-400">
              SUBJECTS
            </span>
            <div className="text-xs font-bold text-neutral-900">
              {selectedSubjectIds.length > 0
                ? `${selectedSubjectIds.length} subject${
                    selectedSubjectIds.length === 1 ? "" : "s"
                  } (${totalUnits} units)`
                : "Not available"}
            </div>
          </div>

          {/* Guidance Banner (Amber/Yellow matching reference) */}
          <div
            className={`enrollments__guidance-box p-3 text-center text-xs font-medium mb-4 ${
              canEnroll ? "enrollments__guidance-box--ready" : ""
            }`}
          >
            {guidanceText}
          </div>

          {/* Enroll Student Action Button */}
          <button
            type="button"
            onClick={handleEnroll}
            disabled={!canEnroll || enrolling}
            className="enrollments__submit w-full py-3 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enrolling ? "Enrolling…" : "Enroll student"}
          </button>
        </aside>
      </div>

      {/* ============ Create School Year Modal (Admin Only) ============ */}
      {allowSchoolYearCreation && (
        <ConfirmDialog
          open={confirmCreateOpen}
          title="Create a new school year?"
          description={`A new school year (${nextStartYear} – ${nextEndYear}) will be created for the upcoming academic period.`}
          confirmLabel="Create School Year"
          confirmIcon={<FiCalendar aria-hidden="true" />}
          icon={<FiCalendar aria-hidden="true" />}
          tone="primary"
          pending={creatingSchoolYear}
          pendingLabel="Creating…"
          onConfirm={handleCreateSchoolYear}
          onClose={closeCreateConfirm}
          triggerRef={createTriggerRef}
        />
      )}

      
    </PageShell>
  );
}

