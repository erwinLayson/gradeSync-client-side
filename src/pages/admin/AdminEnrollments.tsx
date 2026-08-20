import {
  FiArrowRight,
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiInbox,
  FiLock,
  FiMail,
  FiSearch,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";

import "../../style/adminEnrollments.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAPICall, postAPICall } from "../../api/api";

// Hooks
import useClassroom from "../../hooks/useClassroom.ts";
import useSubjects from "../../hooks/useSubject.ts";

// Components
import { ConfirmDialog } from "../../components/ConfirmDialog";

// Types
import type {
  ClassroomResponseProps,
  ClassroomTeachersWithSubjectProps,
} from "../../constant/classrooms.ts";
import type { StudentResponseProps } from "../../constant/students";

interface SchoolYear {
  id: number;
  startYear: string;
  endYear: string;
}

interface AcademicSettingsData {
  id: number;
  currentQuarter: number;
  enrollmentOpen: boolean | number;
}

const CAPACITY = 40;

const STEPS = [
  { label: "Find Student", hint: "Search the registry" },
  { label: "Assign Section", hint: "Classroom + subjects" },
  { label: "Review & Enroll", hint: "Confirm details" },
] as const;

export default function AdminEnrollments() {
  // ============ Step 1 — student search ============
  const [students, setStudents] = useState<StudentResponseProps[] | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentResponseProps | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // ============ Step 2 — classrooms & subjects ============
  const { classrooms, loading, setLoading, refetchClassroom } = useClassroom<ClassroomResponseProps[]>();
  const [selectedClassroom, setSelectedClassroom] = useState<ClassroomResponseProps | null>(null);
  const {
    subjects: classSubjects,
    subjectsLoading,
    fetchSubjects: fetchClassSubjects,
  } = useSubjects<ClassroomTeachersWithSubjectProps[]>();
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);

  // ============ School year ============
  const [schoolYear, setSchoolYear] = useState<SchoolYear[] | null>(null);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | null>(null);

  // ============ Enrollment window (from Admin Settings) ============
  const [enrollmentOpen, setEnrollmentOpen] = useState<boolean | null>(null);

  // ============ Enrollment submission ============
  const [enrolling, setEnrolling] = useState(false);
  const [creatingSchoolYear, setCreatingSchoolYear] = useState(false);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  // ================== debounce the search input (1s) ================
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchQuery);
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ================== fetch students ================
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
    getAPICall<SchoolYear[]>("/schoolYear").then((response) => {
      setSchoolYear(response.data ?? null);
      // Default the school year to the first available one
      setSelectedSchoolYearId((current) => current ?? response.data?.[0]?.id ?? null);
    });
    getAPICall<AcademicSettingsData>("/academic-settings", { toast: false }).then((response) => {
      setEnrollmentOpen(Boolean(response.data?.enrollmentOpen));
    });
  }, [fetchStudents]);

  // ================== classroom selection ================
  async function handleSelectClassroom(classroom: ClassroomResponseProps) {
    setSelectedClassroom(classroom);
    setSelectedSubjectIds([]);

    await fetchClassSubjects(`/classrooms/${classroom.id}/teachers-subject/`);
  }

  // ================== subject selection ================
  function toggleSubject(subjectId: number) {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  }

// ================== derived state ================
  const activeStep = !selectedStudent ? 1 : !selectedClassroom ? 2 : 3;
  const selectedSubjects =
    classSubjects?.filter((cs) => selectedSubjectIds.includes(cs.subjectId)) ?? [];
  const totalUnits = selectedSubjects.reduce((sum, cs) => sum + Number(cs.unit), 0);
  const selectedSchoolYear =
    schoolYear?.find((sy) => sy.id === selectedSchoolYearId) ?? null;

  const classroomPct = selectedClassroom
    ? Math.min(100, Math.round(((Number(selectedClassroom.totalStudent) || 0) / CAPACITY) * 100))
    : 0;

  const nextStartYear = new Date().getFullYear();
  const nextEndYear = nextStartYear + 1;

  const canEnroll = Boolean(
    selectedStudent &&
      selectedClassroom &&
      selectedSubjectIds.length > 0 &&
      selectedSchoolYearId &&
      enrollmentOpen !== false,
  );

  // ================== handle enrollment submission ================
  async function handleEnroll() {
    if (!selectedStudent || !selectedClassroom || !selectedSchoolYearId) return;
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
        },
      );

      // Reset the flow and refresh the lists — the student is now enrolled.
      setSelectedStudent(null);
      setSelectedClassroom(null);
      setSelectedSubjectIds([]);
      fetchStudents();
      refetchClassroom();
    } catch {
      // Error toast is handled by the axios interceptor in api.ts
    } finally {
      setEnrolling(false);
    }
  }

  const closeCreateConfirm = useCallback(() => setConfirmCreateOpen(false), []);

  // =================== handle creating a new school year ===================
  async function handleCreateSchoolYear() {
    if (creatingSchoolYear) return;

    setCreatingSchoolYear(true);
    try {
      const response = await postAPICall<object, SchoolYear>("/schoolYear", {});

      // Refresh the list and auto-select the newly created school year.
      const listResponse = await getAPICall<SchoolYear[]>("/schoolYear");
      const updated = listResponse.data ?? null;
      setSchoolYear(updated);
      setSelectedSchoolYearId((current) => response.data?.id ?? updated?.[0]?.id ?? current);
      closeCreateConfirm();
      createTriggerRef.current?.focus();
    } catch {
      // Error toast is handled by the axios interceptor in api.ts; keep the dialog open to retry.
    } finally {
      setCreatingSchoolYear(false);
    }
  }

  return (
    <section className="enrollments flex flex-col gap-5">
      {/* ============ Hero header ============ */}
      <header className="enrollments__hero p-6 sm:p-8">
        <div className="enrollments__hero-glow enrollments__hero-glow--one" aria-hidden="true" />
        <div className="enrollments__hero-glow enrollments__hero-glow--two" aria-hidden="true" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span
              className="enrollments__hero-icon inline-flex h-14 w-14 shrink-0 items-center justify-center text-2xl"
              aria-hidden="true"
            >
              <FiUserPlus />
            </span>
            <div>
              <p className="enrollments__hero-eyebrow text-[0.6875rem] font-bold uppercase tracking-[0.14em]">
                Enrollment Management
              </p>
              <h2 className="enrollments__hero-title mt-1 text-2xl font-extrabold tracking-tight">
                Enroll a Student
              </h2>
              <p className="enrollments__hero-subtitle mt-1 text-sm">
                Search, assign a section, and confirm in one flow.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`enrollments__hero-status inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold ${
                enrollmentOpen === false ? "enrollments__hero-status--closed" : ""
              }`}
              title="Controlled in Admin Settings → Academic Year"
            >
              {enrollmentOpen === false ? (
                <>
                  <FiLock aria-hidden="true" />
                  Enrollment Closed
                </>
              ) : enrollmentOpen === null ? (
                <>
                  <FiCalendar aria-hidden="true" />
                  Checking status…
                </>
              ) : (
                <>
                  <FiCheckCircle aria-hidden="true" />
                  Enrollment Open
                </>
              )}
            </span>

            <button
              ref={createTriggerRef}
              className="enrollments__hero-status inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setConfirmCreateOpen(true)}
              disabled={creatingSchoolYear}
            >
              <FiCheckCircle aria-hidden="true" />
              {creatingSchoolYear ? "Creating…" : "Create new School Year"}
            </button>

            <label className="enrollments__year-select inline-flex cursor-pointer items-center gap-2 px-3.5 py-2 hover:bg-[var(--neutral-hover)] text-xs font-bold">
              <FiCalendar aria-hidden="true" />
              <select
                value={selectedSchoolYearId ?? ""}
                onChange={(e) => setSelectedSchoolYearId(Number(e.target.value))}
                aria-label="Select school year"
                className="text-[0.8125rem] font-semibold max-h-10 px-1.5 py-1 text-sm"
              >
                {schoolYear && schoolYear.length > 0 ? (
                  schoolYear.map((sy) => (
                    <option key={sy.id} value={sy.id}>
                      {sy.startYear} – {sy.endYear}
                    </option>
                  ))
                ) : (
                  <option value="">Loading…</option>
                )}
              </select>
            </label>
          </div>
        </div>
      </header>

      {/* ============ Closed enrollment banner ============ */}
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

      {/* ============ Stepper ============ */}
      <nav
        className="enrollments__steps flex items-center gap-4 overflow-x-auto px-5 py-4"
        aria-label="Enrollment progress"
      >
        {STEPS.map((step, i) => {
          const n = i + 1;
          const done = activeStep > n;
          const active = activeStep === n;

          return (
            <div
              key={step.label}
              className={`enrollments__step flex shrink-0 items-center gap-3 ${
                done ? "enrollments__step--done" : ""
              } ${active ? "enrollments__step--active" : ""}`}
            >
              <span
                className="enrollments__step-badge inline-flex h-9 w-9 shrink-0 items-center justify-center text-sm"
                aria-hidden="true"
              >
                {done ? <FiCheck /> : n}
              </span>
              <span className="enrollments__step-label flex min-w-0 flex-col gap-0.5">
                <span className="enrollments__step-name text-[0.8125rem] font-bold">
                  {step.label}
                </span>
                <span className="enrollments__step-hint text-[0.625rem]">{step.hint}</span>
              </span>
              {i < STEPS.length - 1 && (
                <span className="enrollments__step-line min-w-10 flex-1" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </nav>

      {/* ============ 3-column layout ============ */}
      <div className="enrollments__layout grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,16rem)]">
        {/* ============ Step 1 — student search ============ */}
        <aside className="enrollments__panel">
          <header className="enrollments__panel-head flex items-start justify-between gap-3 p-5">
            <div>
              <span className="enrollments__step-tag inline-flex items-center px-2 py-0.5 text-[0.625rem] font-bold uppercase">
                Step 1
              </span>
              <h3 className="enrollments__panel-title mt-2 text-base font-bold">Find Student</h3>
              <p className="enrollments__panel-subtitle mt-0.5 text-xs">
                Search students who aren't enrolled yet
              </p>
            </div>
            {searchDebounced && (
              <span className="enrollments__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-[0.6875rem] font-semibold">
                {students?.length ?? 0} result{students?.length === 1 ? "" : "s"}
              </span>
            )}
          </header>

          <div className="enrollments__search mx-5 mt-4">
            <FiSearch className="enrollments__search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name or LRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search students"
              className="w-full py-2.5 pl-9 pr-3 text-sm"
            />
          </div>

          <div className="enrollments__results px-5 pb-5" aria-live="polite">
            {loading && searchDebounced ? (
              <div
                className="enrollments__results-state flex items-center justify-center gap-2 px-3 py-4 text-center text-xs"
                aria-busy="true"
              >
                Searching students…
              </div>
            ) : students && students.length > 0 ? (
              students.map((s) => (
                <label
                  className={`enrollments__result flex items-center gap-2.5 p-2 ${
                    selectedStudent?.id === s.id ? "enrollments__result--active" : ""
                  }`}
                  key={String(s.lrn)}
                  htmlFor={`student-${s.lrn}`}
                >
                  <input
                    type="radio"
                    name="students"
                    id={`student-${s.lrn}`}
                    value={s.id}
                    checked={selectedStudent?.id === s.id}
                    onChange={() => setSelectedStudent(s)}
                  />
                  <span className="enrollments__avatar inline-flex h-9 w-9 shrink-0 items-center justify-center text-xs">
                    {s.fullname.charAt(0).toUpperCase()}
                  </span>
                  <span className="enrollments__result-info flex min-w-0 flex-col gap-px">
                    <span className="enrollments__result-name text-[0.8125rem] font-semibold">
                      {s.fullname}
                    </span>
                    <span className="enrollments__result-lrn text-[0.6875rem]">{s.lrn}</span>
                  </span>
                  <span
                    className={`enrollments__result-sex ml-auto shrink-0 px-2 py-0.5 text-[0.625rem] ${
                      s.sex.toLowerCase() === "male"
                        ? "enrollments__result-sex--male"
                        : "enrollments__result-sex--female"
                    }`}
                  >
                    {s.sex.charAt(0).toUpperCase()}
                  </span>
                </label>
              ))
            ) : searchDebounced ? (
              <div className="enrollments__results-state flex items-center justify-center gap-2 px-3 py-4 text-center text-xs">
                No students found for &ldquo;{searchDebounced}&rdquo;
              </div>
            ) : (
              <div className="enrollments__results-state enrollments__results-state--hint flex items-center justify-center gap-2 px-3 py-6 text-center text-xs">
                Type a name or LRN to find students not yet enrolled.
              </div>
            )}
          </div>

          {/* Selected student profile */}
          {selectedStudent && (
            <div className="enrollments__profile mx-5 mb-5 p-4">
              <div className="enrollments__profile-head flex items-center gap-3">
                <span className="enrollments__avatar enrollments__avatar--lg inline-flex h-12 w-12 shrink-0 items-center justify-center text-sm">
                  {selectedStudent.fullname.charAt(0).toUpperCase()}
                </span>
                <div className="enrollments__profile-heading min-w-0">
                  <h4 className="enrollments__profile-name text-[0.9375rem] font-bold">
                    {selectedStudent.fullname}
                  </h4>
                  <p className="enrollments__profile-email mt-1 flex items-center gap-1.5 text-xs">
                    <FiMail aria-hidden="true" />
                    {selectedStudent.email}
                  </p>
                </div>
              </div>
              <dl className="enrollments__profile-stats mt-3.5 grid grid-cols-2 gap-2">
                <div className="enrollments__profile-stat flex flex-col gap-0.5 p-2">
                  <dt className="text-[0.5625rem] font-bold uppercase">LRN</dt>
                  <dd className="text-xs">{selectedStudent.lrn}</dd>
                </div>
                <div className="enrollments__profile-stat flex flex-col gap-0.5 p-2">
                  <dt className="text-[0.5625rem] font-bold uppercase">Age</dt>
                  <dd className="text-xs">{selectedStudent.age}</dd>
                </div>
                <div className="enrollments__profile-stat flex flex-col gap-0.5 p-2">
                  <dt className="text-[0.5625rem] font-bold uppercase">Sex</dt>
                  <dd className="text-xs">{selectedStudent.sex}</dd>
                </div>
                <div className="enrollments__profile-stat flex flex-col gap-0.5 p-2">
                  <dt className="text-[0.5625rem] font-bold uppercase">Birthdate</dt>
                  <dd className="text-xs">{selectedStudent.birthdate}</dd>
                </div>
              </dl>
            </div>
          )}
        </aside>

        {/* ============ Step 2 — classroom & subjects ============ */}
        <div className="enrollments__panel">
          {selectedStudent ? (
            <>
              <header className="enrollments__panel-head flex items-start justify-between gap-3 p-5">
                <div>
                  <span className="enrollments__step-tag inline-flex items-center px-2 py-0.5 text-[0.625rem] font-bold uppercase">
                    Step 2
                  </span>
                  <h3 className="enrollments__panel-title mt-2 text-base font-bold">
                    Assign a Section
                  </h3>
                  <p className="enrollments__panel-subtitle mt-0.5 text-xs">
                    Pick the classroom for {selectedStudent.fullname.split(" ")[0] || "this student"}
                  </p>
                </div>
                <span className="enrollments__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-[0.6875rem] font-semibold">
                  {classrooms?.length ?? 0} available
                </span>
              </header>

              {/* Classroom picker */}
              <div className="enrollments__classes px-5 pt-4">
                {classrooms === null ? (
                  loading ? (
                    <div
                      className="enrollments__results-state flex items-center justify-center gap-2 px-3 py-4 text-center text-xs"
                      aria-busy="true"
                    >
                      Loading classrooms…
                    </div>
                  ) : (
                    <div className="enrollments__results-state flex items-center justify-center gap-2 px-3 py-4 text-center text-xs">
                      No classrooms available.
                    </div>
                  )
                ) : classrooms.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {classrooms.map((c) => {
                      const enrolled = Number(c.totalStudent) || 0;
                      const pct = Math.min(100, Math.round((enrolled / CAPACITY) * 100));
                      const slotsLeft = Math.max(0, CAPACITY - enrolled);
                      const isLow = slotsLeft > 0 && slotsLeft <= 4;
                      const isFull = slotsLeft === 0;
                      const isActive = selectedClassroom?.id === c.id;

                      return (
                        <label
                          key={String(c.id)}
                          className={`enrollments__class relative flex cursor-pointer flex-col gap-3.5 overflow-hidden p-4 isolate ${
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
                              className="enrollments__class-monogram inline-flex h-10 w-10 shrink-0 items-center justify-center text-base"
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

                          <span className="flex flex-col gap-1">
                            <span className="enrollments__class-grade self-start px-2 py-0.5 text-[0.625rem] font-bold uppercase">
                              Grade {c.gradeLevel}
                            </span>
                            <span className="enrollments__class-section text-lg font-extrabold">
                              {c.section}
                            </span>
                          </span>

                          <span className="enrollments__class-capacity">
                            <span className="enrollments__class-capacity-meta flex items-center justify-between gap-2 text-[0.6875rem]">
                              <span className="flex items-center gap-1 font-semibold">
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

                          <span className="enrollments__class-foot inline-flex items-center gap-1.5 text-xs">
                            {isFull
                              ? "Class is full"
                              : `${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="enrollments__results-state flex items-center justify-center gap-2 px-3 py-4 text-center text-xs">
                    No classrooms available.
                  </div>
                )}
              </div>

              {/* Subject picker */}
              {selectedClassroom && (
                <section className="enrollments__subjects mt-5 border-t border-[var(--neutral-border)] p-5">
                  <div className="enrollments__section-head flex items-center justify-between gap-3">
                    <div>
                      <h4 className="enrollments__section-title text-sm font-bold">Subjects</h4>
                      <p className="enrollments__section-subtitle mt-0.5 text-xs">
                        Grade {selectedClassroom.gradeLevel} – {selectedClassroom.section}
                      </p>
                    </div>
                    <span className="enrollments__count inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 text-[0.6875rem] font-semibold">
                      {selectedSubjectIds.length}/{classSubjects?.length ?? 0} selected
                    </span>
                  </div>

                  {subjectsLoading ? (
                    <div
                      className="enrollments__results-state flex items-center justify-center gap-2 px-3 py-4 text-center text-xs"
                      aria-busy="true"
                    >
                      Loading subjects…
                    </div>
                  ) : classSubjects && classSubjects.length > 0 ? (
                    <div className="enrollments__subjects-list mt-4 flex flex-col gap-2">
                      {classSubjects.map((cs) => {
                        const checked = selectedSubjectIds.includes(cs.subjectId);

                        return (
                          <label
                            key={cs.subjectId}
                            className={`enrollments__subject relative flex cursor-pointer items-center gap-2.5 p-2.5 ${
                              checked ? "enrollments__subject--checked" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              name="subject"
                              checked={checked}
                              onChange={() => toggleSubject(cs.subjectId)}
                            />
                            <span
                              className="enrollments__subject-check inline-flex items-center justify-center"
                              aria-hidden="true"
                            >
                              <FiCheck />
                            </span>
                            <span
                              className="enrollments__subject-icon inline-flex items-center justify-center"
                              aria-hidden="true"
                            >
                              <FiBookOpen />
                            </span>
                            <span className="enrollments__subject-info flex min-w-0 flex-col gap-px">
                              <span className="enrollments__subject-name text-[0.8125rem]">
                                {cs.subjectName}
                              </span>
                              <span className="enrollments__subject-teacher text-[0.6875rem]">
                                {cs.teacherFullname}
                              </span>
                            </span>
                            <span className="enrollments__subject-code ml-auto shrink-0 px-2 py-0.5 text-[0.625rem]">
                              {cs.code}
                            </span>
                            <span className="enrollments__subject-unit text-xs">
                              {cs.unit} unit{cs.unit === 1 ? "" : "s"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="enrollments__results-state flex items-center justify-center gap-2 px-3 py-4 text-center text-xs">
                      No subjects assigned to this section yet.
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            <div className="enrollments__placeholder flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <span
                className="enrollments__placeholder-icon inline-flex items-center justify-center text-lg"
                aria-hidden="true"
              >
                <FiInbox />
              </span>
              <p className="enrollments__placeholder-title text-sm font-bold">
                Select a student first
              </p>
              <p className="enrollments__placeholder-text text-xs">
                Search and pick a student in Step 1 to unlock section &amp; subject assignment.
              </p>
            </div>
          )}
        </div>

        {/* ============ Step 3 — review & enroll (sticky) ============ */}
        <aside className="enrollments__panel enrollments__panel--summary flex flex-col lg:col-span-2 xl:sticky xl:top-5 xl:col-span-1">
          <header className="enrollments__panel-head flex items-start justify-between gap-3 p-5">
            <div>
              <span className="enrollments__step-tag inline-flex items-center px-2 py-0.5 text-[0.625rem] font-bold uppercase">
                Step 3
              </span>
              <h3 className="enrollments__panel-title mt-2 text-base font-bold">Review & Enroll</h3>
              <p className="enrollments__panel-subtitle mt-0.5 text-xs">Confirm the enrollment</p>
            </div>
          </header>

          <div className="enrollments__summary flex flex-1 flex-col gap-5 p-5 pb-6">
            {/* Student */}
            <div className="enrollments__summary-block flex flex-col gap-2">
              <span className="enrollments__summary-label text-[0.625rem] font-bold uppercase">
                Student
              </span>
              {selectedStudent ? (
                <div className="enrollments__summary-row flex items-center gap-2.5 p-2.5">
                  <span
                    className="enrollments__summary-icon inline-flex h-9 w-9 shrink-0 items-center justify-center"
                    aria-hidden="true"
                  >
                    <FiUserPlus />
                  </span>
                  <span className="enrollments__summary-line flex min-w-0 flex-col gap-px">
                    <strong>{selectedStudent.fullname}</strong>
                    <span>{selectedStudent.email}</span>
                  </span>
                </div>
              ) : (
                <div className="enrollments__summary-row enrollments__summary-row--empty flex items-center justify-center gap-2.5 p-3 text-xs">
                  No student selected
                </div>
              )}
            </div>

            {/* Section */}
            <div className="enrollments__summary-block flex flex-col gap-2">
              <span className="enrollments__summary-label text-[0.625rem] font-bold uppercase">
                Section
              </span>
              {selectedClassroom ? (
                <div className="enrollments__summary-row flex items-center gap-2.5 p-2.5">
                  <span
                    className="enrollments__summary-icon inline-flex h-9 w-9 shrink-0 items-center justify-center"
                    aria-hidden="true"
                  >
                    <FiUsers />
                  </span>
                  <span className="enrollments__summary-line flex min-w-0 flex-col gap-px">
                    <strong>
                      Grade {selectedClassroom.gradeLevel} – {selectedClassroom.section}
                    </strong>
                    <span>
                      {Number(selectedClassroom.totalStudent) || 0}/{CAPACITY} enrolled
                    </span>
                  </span>
                  <span className="enrollments__summary-bar w-16 shrink-0" aria-hidden="true">
                    <span
                      className="enrollments__summary-bar-fill"
                      style={{ width: `${classroomPct}%` }}
                    />
                  </span>
                </div>
              ) : (
                <div className="enrollments__summary-row enrollments__summary-row--empty flex items-center justify-center gap-2.5 p-3 text-xs">
                  No section selected
                </div>
              )}
            </div>

            {/* Subjects */}
            <div className="enrollments__summary-block flex flex-col gap-2">
              <span className="enrollments__summary-label text-[0.625rem] font-bold uppercase">
                Subjects
              </span>
              {selectedSubjects.length > 0 ? (
                <>
                  <ul className="enrollments__summary-list flex flex-col gap-1.5">
                    {selectedSubjects.map((cs) => (
                      <li
                        key={cs.subjectId}
                        className="flex items-center justify-between gap-2 rounded-md border border-[var(--neutral-border)] bg-white px-2.5 py-1.5"
                      >
                        <span className="enrollments__summary-subject inline-flex items-center gap-1.5 text-xs">
                          <FiBookOpen aria-hidden="true" />
                          {cs.subjectName}
                        </span>
                        <span className="enrollments__summary-unit shrink-0 text-xs">
                          {cs.unit} unit{cs.unit === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="enrollments__summary-total flex items-center justify-between pt-2 text-xs">
                    <span>Total units</span>
                    <strong className="text-sm">{totalUnits}</strong>
                  </div>
                </>
              ) : (
                <div className="enrollments__summary-empty px-3 py-2.5 text-xs">
                  No subjects selected
                </div>
              )}
            </div>

            {/* School year */}
            <div className="enrollments__summary-block flex flex-col gap-2">
              <span className="enrollments__summary-label text-[0.625rem] font-bold uppercase">
                School Year
              </span>
              {selectedSchoolYear ? (
                <div className="enrollments__summary-row flex items-center gap-2.5 p-2.5">
                  <span
                    className="enrollments__summary-icon inline-flex h-9 w-9 shrink-0 items-center justify-center"
                    aria-hidden="true"
                  >
                    <FiCalendar />
                  </span>
                  <span className="enrollments__summary-line flex min-w-0 flex-col gap-px">
                    <strong>
                      {selectedSchoolYear.startYear} – {selectedSchoolYear.endYear}
                    </strong>
                    <span>Enrollment period</span>
                  </span>
                </div>
              ) : (
                <div className="enrollments__summary-row enrollments__summary-row--empty flex items-center justify-center gap-2.5 p-3 text-xs">
                  No school year selected
                </div>
              )}
            </div>

            {/* Readiness checklist */}
            <div className="enrollments__summary-block flex flex-col gap-2">
              <span className="enrollments__summary-label text-[0.625rem] font-bold uppercase">
                Readiness
              </span>
              <ul className="enrollments__summary-list flex flex-col gap-1.5">
                {[
                  { ok: Boolean(selectedStudent), label: "Student selected" },
                  { ok: Boolean(selectedClassroom), label: "Section chosen" },
                  { ok: selectedSubjectIds.length > 0, label: "Subjects picked" },
                ].map((item) => (
                  <li
                    key={item.label}
                    className={`enrollments__summary-hint flex items-center gap-2 text-xs ${
                      item.ok ? "enrollments__summary-hint--ok" : ""
                    }`}
                  >
                    <FiCheck aria-hidden="true" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              className="enrollments__submit inline-flex w-full items-center justify-center gap-2 py-3 text-sm"
              disabled={!canEnroll || enrolling}
              onClick={handleEnroll}
              title={enrollmentOpen === false ? "Enrollment is currently closed" : undefined}
            >
              <FiCheckCircle aria-hidden="true" />
              {enrolling ? "Enrolling…" : "Enroll Student"}
              <FiArrowRight aria-hidden="true" />
            </button>
            <p className="enrollments__summary-note text-[0.6875rem]">
              {enrollmentOpen === false
                ? "Enrollment is closed — reopen it in Admin Settings to continue."
                : canEnroll
                  ? "All set — click to finalize the enrollment."
                  : "Complete Steps 1–2 to enable enrollment."}
            </p>
          </div>
        </aside>
      </div>

      {/* ============ Create school year confirmation ============ */}
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
    </section>
  );
}
