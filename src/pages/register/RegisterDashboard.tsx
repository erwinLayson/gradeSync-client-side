import { FiChevronRight, FiClipboard, FiFileText, FiInbox, FiUserPlus, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";

/**
 * Register (registration/enrollment staff) landing page.
 *
 * Register handles enrollment, student records, SF10 printing, and the submission tracker.
 * See docs/register-role-implementation-plan.md.
 */
export default function RegisterDashboard() {
  const navigate = useNavigate();
  const { settings, loading } = useAcademicSettings();

  const enrollmentOpen = settings ? Boolean(settings.enrollmentOpen) : null;

  return (
    <PageShell className="register-dashboard">
      <PageHeader
        title="Enrollment & Records Workspace"
        description="Enroll students, register learners, print SF10 records, and track class grade submissions."
        meta={
          enrollmentOpen === false
            ? "Enrollment closed"
            : loading || enrollmentOpen === null
              ? "Checking status…"
              : "Enrollment open"
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PageSection className="register-dashboard__action">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft,#e8f0ff)] text-xl text-[var(--accent,#1d4ed8)]"
            aria-hidden="true"
          >
            <FiUsers />
          </span>
          <h3 className="mt-4 text-base font-bold text-neutral-900">Student records</h3>
          <p className="mt-1 text-[0.8125rem] text-neutral-500">
            Register a new learner, update a student's details, or remove a record. New learners
            are created here, then enrolled from the enrollment workspace.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#1d4ed8)] px-4 py-2.5 text-[0.8125rem] font-semibold text-white"
            onClick={() => navigate("/register/students")}
          >
            Open student records
            <FiChevronRight aria-hidden="true" />
          </button>
        </PageSection>

        <PageSection className="register-dashboard__action">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft,#e8f0ff)] text-xl text-[var(--accent,#1d4ed8)]"
            aria-hidden="true"
          >
            <FiClipboard />
          </span>
          <h3 className="mt-4 text-base font-bold text-neutral-900">Submission tracker</h3>
          <p className="mt-1 text-[0.8125rem] text-neutral-500">
            Track quarterly grade submissions across all classes, inspect pending student records,
            and advance the active school quarter.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#1d4ed8)] px-4 py-2.5 text-[0.8125rem] font-semibold text-white"
            onClick={() => navigate("/register/student-records")}
          >
            Open tracker
            <FiChevronRight aria-hidden="true" />
          </button>
        </PageSection>

        <PageSection className="register-dashboard__action">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft,#e8f0ff)] text-xl text-[var(--accent,#1d4ed8)]"
            aria-hidden="true"
          >
            <FiUserPlus />
          </span>
          <h3 className="mt-4 text-base font-bold text-neutral-900">Enroll a student</h3>
          <p className="mt-1 text-[0.8125rem] text-neutral-500">
            Search students who are not yet enrolled, assign a section and subjects, and confirm
            the enrollment.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent,#1d4ed8)] px-4 py-2.5 text-[0.8125rem] font-semibold text-white"
            onClick={() => navigate("/register/enrollments")}
          >
            Open enrollment
            <FiChevronRight aria-hidden="true" />
          </button>
        </PageSection>

        <PageSection className="register-dashboard__action">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-xl text-neutral-700"
            aria-hidden="true"
          >
            <FiFileText />
          </span>
          <h3 className="mt-4 text-base font-bold text-neutral-900">Print SF10 (Form-137)</h3>
          <p className="mt-1 text-[0.8125rem] text-neutral-500">
            Print a student's permanent record while you have them open in the enrollment
            workspace. Use the <span className="font-semibold">Print SF10</span> action on the
            selected student.
          </p>
          <p className="mt-4 flex items-start gap-2 text-[0.75rem] text-amber-700">
            <FiInbox className="mt-0.5 shrink-0" aria-hidden="true" />
            Student record editing, deletion, school-year setup, and report cards are handled by
            the school administrator.
          </p>
        </PageSection>
      </div>
    </PageShell>
  );
}
