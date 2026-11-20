import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiCheckSquare,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiInfo,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiUserPlus,
  FiUsers,
  FiClipboard,
} from "react-icons/fi";

import { useUser } from "../../hooks/useUser";
import { useRegisterDashboardData } from "../../hooks/useRegisterDashboardData";
import { KpiCard } from "../../components/KpiCard";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";

import "../../style/analyticsReports.css";
import "../../style/adminDashboard.css";
import "../../style/registerDashboard.css";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Register (Registration & Enrollment Staff) Dashboard.
 *
 * Reorganized into 5 key operational sections:
 * 1. Dashboard greeting and description
 * 2. Active academic context (active SY & current academic quarter)
 * 3. Overview statistics (total students, active enrollments, eligible not enrolled, submission progress)
 * 4. Quick actions (Student Records, Enrollment, Submission Tracker, Amendments)
 * 5. Recent Activity & SF10 Permanent Record Guidance
 */
export default function RegisterDashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const {
    academicContext,
    statistics,
    recentActivity,
    loading,
    error,
    refetch,
  } = useRegisterDashboardData();

  const greeting = getGreeting();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const { activeSchoolYear, currentQuarter, numQuarters, enrollmentOpen } = academicContext;

  const schoolYearLabel = activeSchoolYear
    ? `SY ${activeSchoolYear.startYear}–${activeSchoolYear.endYear}`
    : "No active school year";

  const quarterLabel = `Quarter ${currentQuarter} of ${numQuarters}`;

  const enrollmentStatusText =
    enrollmentOpen === null
      ? "Checking status…"
      : enrollmentOpen
        ? "Enrollment open"
        : "Enrollment closed";

  // ==================== Error State ====================
  if (error && statistics.totalStudents === 0 && !activeSchoolYear) {
    return (
      <PageShell className="register-dashboard">
        <PageSection>
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <span
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-700"
              aria-hidden="true"
            >
              <FiAlertCircle />
            </span>
            <div>
              <h2 className="text-lg font-bold text-neutral-800">Unable to load dashboard data</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Failed to communicate with the server. Please verify your connection and try again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-[#176B3A] hover:text-[#176B3A]"
            >
              <FiRefreshCw aria-hidden="true" />
              Retry
            </button>
          </div>
        </PageSection>
      </PageShell>
    );
  }

  // ==================== Render ====================
  const userIdentifier = user?.email ? user.email.split("@")[0] : "Registrar";

  return (
    <PageShell className="register-dashboard" busy={loading}>
      {/* ============================================================ */}
      {/* 1. Dashboard Greeting & Description                          */}
      {/* ============================================================ */}
      <PageHeader
        title={`${greeting}, ${userIdentifier}`}
        description="Enrollment & Records Workspace — Track active enrollments, manage student registrations, monitor submission progress, and process record amendments."
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{schoolYearLabel}</span>
            <span>·</span>
            <span>{quarterLabel}</span>
            <span>·</span>
            <span>Today · {today}</span>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-[#176B3A] hover:text-[#176B3A] disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* ============================================================ */}
      {/* 2. Active Academic Context                                   */}
      {/* ============================================================ */}
      <div className="register-context">
        <h3 className="register-context__heading">Active Academic Context</h3>
        <div className="register-context__grid">
          {/* Active School Year */}
          <div className="register-context__item">
            <span className="register-context__icon" aria-hidden="true">
              <FiCalendar />
            </span>
            <div className="min-w-0">
              <span className="register-context__label">Active School Year</span>
              <span className="register-context__value">{schoolYearLabel}</span>
            </div>
          </div>

          {/* Current Academic Quarter */}
          <div className="register-context__item">
            <span className="register-context__icon register-context__icon--blue" aria-hidden="true">
              <FiClock />
            </span>
            <div className="min-w-0">
              <span className="register-context__label">Academic Period</span>
              <span className="register-context__value">{quarterLabel}</span>
            </div>
          </div>

          {/* Enrollment Window Status */}
          <div className="register-context__item">
            <span
              className={`register-context__icon ${
                enrollmentOpen ? "" : "register-context__icon--gold"
              }`}
              aria-hidden="true"
            >
              {enrollmentOpen ? <FiCheckCircle /> : <FiInfo />}
            </span>
            <div className="min-w-0">
              <span className="register-context__label">Enrollment Window</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    enrollmentOpen ? "bg-emerald-600" : "bg-amber-600"
                  }`}
                  aria-hidden="true"
                />
                <span className="register-context__value m-0">{enrollmentStatusText}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. Overview Statistics (4 KPI Cards)                         */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Total Students */}
        <KpiCard
          label="Total Students"
          value={statistics.totalStudents.toLocaleString()}
          icon={FiUsers}
          loading={loading}
          trend={{ tone: "flat", text: "Registered Learners" }}
        />

        {/* KPI 2: Enrolled Students for Active School Year */}
        <KpiCard
          label="Enrolled Students"
          value={statistics.enrolledStudents.toLocaleString()}
          icon={FiUserCheck}
          loading={loading}
          trend={{
            tone: "live",
            text: activeSchoolYear
              ? `SY ${activeSchoolYear.startYear}–${activeSchoolYear.endYear}`
              : "Active Year",
          }}
        />

        {/* KPI 3: Eligible Students Not Yet Enrolled */}
        <KpiCard
          label="Eligible (Not Enrolled)"
          value={statistics.eligibleNotEnrolledStudents.toLocaleString()}
          icon={FiUserPlus}
          loading={loading}
          trend={{
            tone: statistics.eligibleNotEnrolledStudents > 0 ? "down" : "flat",
            text: "Awaiting Assignment",
          }}
        />

        {/* KPI 4: Quarterly Submission Progress */}
        <KpiCard
          label={`Q${currentQuarter} Submissions`}
          value={`${statistics.submissionProgress.percentage}%`}
          icon={FiClipboard}
          loading={loading}
          trend={{
            tone: statistics.submissionProgress.percentage === 100 ? "live" : "flat",
            text: `${statistics.submissionProgress.submitted} / ${statistics.submissionProgress.total} Records`,
          }}
        />
      </div>

      {/* ============================================================ */}
      {/* 4. Quick Actions                                             */}
      {/* ============================================================ */}
      <PageSection
        title="Quick Actions"
        description="Direct navigation to core registration and records management workflows"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Action 1: Student Records */}
          <div className="register-action-card">
            <div>
              <span className="register-action-card__icon-wrap" aria-hidden="true">
                <FiUsers />
              </span>
              <h4 className="register-action-card__title">Student Records</h4>
              <p className="register-action-card__description">
                Register new learners, update profile details, search directory, and print
                official SF10 / Form-137 permanent records.
              </p>
            </div>
            <button
              type="button"
              className="register-action-card__btn"
              onClick={() => navigate("/register/students")}
            >
              Open Student Records
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          {/* Action 2: Enrollment */}
          <div className="register-action-card">
            <div>
              <span
                className="register-action-card__icon-wrap register-action-card__icon-wrap--gold"
                aria-hidden="true"
              >
                <FiUserPlus />
              </span>
              <h4 className="register-action-card__title">Enrollment</h4>
              <p className="register-action-card__description">
                Enroll eligible learners into classrooms and subjects for the active school year
                with section capacity validation.
              </p>
            </div>
            <button
              type="button"
              className="register-action-card__btn register-action-card__btn--gold"
              onClick={() => navigate("/register/enrollments")}
            >
              Open Enrollment
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          {/* Action 3: Submission Tracker */}
          <div className="register-action-card">
            <div>
              <span className="register-action-card__icon-wrap" aria-hidden="true">
                <FiClipboard />
              </span>
              <h4 className="register-action-card__title">Submission Tracker</h4>
              <p className="register-action-card__description">
                Monitor quarterly grade submission progress across all classes and identify
                incomplete student records.
              </p>
            </div>
            <button
              type="button"
              className="register-action-card__btn"
              onClick={() => navigate("/register/student-records")}
            >
              Open Tracker
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          {/* Action 4: Amendments */}
          <div className="register-action-card">
            <div>
              <span
                className="register-action-card__icon-wrap register-action-card__icon-wrap--gold"
                aria-hidden="true"
              >
                <FiCheckSquare />
              </span>
              <h4 className="register-action-card__title">Amendments</h4>
              <p className="register-action-card__description">
                Review, approve, or reject grade and attendance amendment requests submitted by
                teaching faculty with full audit logging.
              </p>
            </div>
            <button
              type="button"
              className="register-action-card__btn register-action-card__btn--gold"
              onClick={() => navigate("/register/amendments")}
            >
              Open Amendments
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </PageSection>

      {/* ============================================================ */}
      {/* 5. Recent Activity & Permanent Record Guidance               */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent Activity List (2 cols) */}
        <div className="lg:col-span-2">
          <PageSection
            title="Recent Activity"
            description="Recent student registrations, enrollments, and record amendment updates"
          >
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500"
                  aria-hidden="true"
                >
                  <FiClock />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-800">No recent activity</p>
                <p className="mt-1 text-xs text-slate-500">
                  New student registrations and amendment updates will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="register-activity-feed">
                {recentActivity.map((item) => (
                  <div key={item.id} className="register-activity-item">
                    <span
                      className={`register-activity-item__icon ${
                        item.type === "registration"
                          ? "register-activity-item__icon--reg"
                          : "register-activity-item__icon--amd"
                      }`}
                      aria-hidden="true"
                    >
                      {item.type === "registration" ? <FiUserPlus /> : <FiCheckSquare />}
                    </span>
                    <div className="register-activity-item__content">
                      <div className="flex items-center justify-between gap-2">
                        <span className="register-activity-item__title">{item.title}</span>
                      </div>
                      <p className="register-activity-item__desc">{item.description}</p>
                      <button
                        type="button"
                        onClick={() => navigate(item.link)}
                        className="register-activity-item__link cursor-pointer"
                      >
                        <span>View in module</span>
                        <FiArrowRight aria-hidden="true" className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        </div>

        {/* Permanent Records Guidance Box (1 col) */}
        <div className="lg:col-span-1">
          <div className="register-guidance-box flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2.5 text-[#176B3A]">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF5EE] text-lg"
                  aria-hidden="true"
                >
                  <FiFileText />
                </span>
                <h4 className="text-base font-bold text-slate-900">Permanent Records</h4>
              </div>

              <p className="mt-3 text-[0.8125rem] leading-relaxed text-slate-600">
                Official DepEd Form 137 / SF10 permanent records are generated and printed
                directly through the student-specific record workflow.
              </p>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                <span className="font-bold text-slate-800">Workflow Note:</span>
                <p className="mt-1">
                  Open any learner in <span className="font-semibold">Student Records</span> and
                  select <span className="font-semibold">Print SF10</span> to reconstruct their
                  complete academic history.
                </p>
              </div>

              <div className="mt-4 flex items-start gap-2 text-xs text-amber-700">
                <FiShield className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  Report card (SF9) generation is strictly handled by designated classroom advisers
                  and administrators.
                </span>
              </div>
            </div>

            <button
              type="button"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs transition-colors hover:border-[#176B3A] hover:text-[#176B3A]"
              onClick={() => navigate("/register/students")}
            >
              <span>Go to Student Records</span>
              <FiArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
