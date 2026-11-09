import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiChevronLeft,
  FiChevronRight,
  FiPercent,
  FiRefreshCw,
  FiRotateCcw,
  FiUserCheck,
  FiUserX,
  FiUsers,
} from "react-icons/fi";

import { PageHeader, PageShell } from "../../components/PageLayout";
import { EmptyState } from "../../components/EmptyState";
import { AttendanceSessionDetailModal } from "../../components/AttendanceSessionDetailModal";
import Skeleton from "../../components/Skeleton";
import { toast } from "../../helper/toast";

import { fetchAttendanceMonitoring, fetchAttendanceSessionDetail } from "../../api/attendanceMonitoring";
import { getAPICall } from "../../api/api";

import type {
  AttendanceMonitoringResponse,
  AttendanceSessionDetailResponse,
  MonitoringClassroomGroup,
  MonitoringDateInfo,
  MonitoringSubjectCell,
  MonitoringSubjectRow,
} from "../../constant/attendanceMonitoring";
import { MONTH_NAMES } from "../../constant/attendanceMonitoring";
import type { SchoolYearOption } from "../../constant/attendance";

import "../../style/adminAttendanceMonitoring.css";

interface ClassroomOption {
  id: number;
  section: string;
  gradeLevel: number;
}

interface SubjectOption {
  id: number;
  name: string;
  code: string;
}

interface FacultyOption {
  id: number;
  firstname: string;
  lastname: string;
}

export default function AdminTeacherAttendance() {
  const now = new Date();

  // Selected filters
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | "all">("all");
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedClassId, setSelectedClassId] = useState<number | "all">("all");
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<number | "all">("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "all">("all");
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | "all">("all");

  // Options for filter selects
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
  const [classroomsList, setClassroomsList] = useState<ClassroomOption[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectOption[]>([]);
  const [facultiesList, setFacultiesList] = useState<FacultyOption[]>([]);

  // Main monitoring matrix data
  const [data, setData] = useState<AttendanceMonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedSessionDetail, setSelectedSessionDetail] =
    useState<AttendanceSessionDetailResponse | null>(null);

  // Load dropdown options once
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getAPICall<SchoolYearOption[]>("/schoolYear", { toast: false }).catch(() => ({ data: [] })),
      getAPICall<ClassroomOption[]>("/classrooms", { toast: false }).catch(() => ({ data: [] })),
      getAPICall<SubjectOption[]>("/subjects", { toast: false }).catch(() => ({ data: [] })),
      getAPICall<FacultyOption[]>("/faculties", { toast: false }).catch(() => ({ data: [] })),
    ]).then(([syRes, crRes, subRes, facRes]) => {
      if (cancelled) return;
      if (syRes.data) {
        setSchoolYears(syRes.data);
        const activeSy = syRes.data.find((sy) => Boolean(sy.isActive));
        if (activeSy) {
          setSelectedSchoolYearId(activeSy.id);
        }
      }
      if (crRes.data) setClassroomsList(crRes.data);
      if (subRes.data) setSubjectsList(subRes.data);
      if (facRes.data) setFacultiesList(facRes.data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch monitoring data
  const loadMonitoringData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchAttendanceMonitoring(
      {
        schoolYearId: selectedSchoolYearId,
        month: selectedMonth,
        year: selectedYear,
        classId: selectedClassId,
        gradeLevel: selectedGradeLevel,
        subjectId: selectedSubjectId,
        facultyId: selectedFacultyId,
      },
      { skipErrorToast: true },
    )
      .then((res) => {
        setData(res);
        if (res.selectedYear && res.selectedYear !== selectedYear) {
          setSelectedYear(res.selectedYear);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load attendance monitoring data";
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    selectedSchoolYearId,
    selectedMonth,
    selectedYear,
    selectedClassId,
    selectedGradeLevel,
    selectedSubjectId,
    selectedFacultyId,
  ]);

  useEffect(() => {
    loadMonitoringData();
  }, [loadMonitoringData]);

  // Navigate months
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    const activeSy = schoolYears.find((sy) => Boolean(sy.isActive));
    setSelectedSchoolYearId(activeSy ? activeSy.id : "all");
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
    setSelectedClassId("all");
    setSelectedGradeLevel("all");
    setSelectedSubjectId("all");
    setSelectedFacultyId("all");
  };

  // Cell click handler
  const handleCellClick = async (cell: MonitoringSubjectCell) => {
    if (!cell.hasSession) return;
    setModalLoading(true);
    setModalOpen(true);
    setSelectedSessionDetail(null);

    try {
      const syId = selectedSchoolYearId !== "all" ? selectedSchoolYearId : data?.schoolYear?.id;
      const detail = await fetchAttendanceSessionDetail(cell.classSubjectId, cell.date, syId);
      setSelectedSessionDetail(detail);
    } catch {
      toast.error("Failed to load attendance session details");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  // Distinct grade levels from classrooms list
  const gradeLevels = useMemo(() => {
    const set = new Set<number>();
    classroomsList.forEach((c) => {
      if (c.gradeLevel) set.add(c.gradeLevel);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [classroomsList]);

  // Summary Metrics
  const summary = data?.summary ?? {
    totalClassrooms: 0,
    totalSubjects: 0,
    totalPresent: 0,
    totalAbsent: 0,
    overallAttendanceRate: null,
  };

  const dates: MonitoringDateInfo[] = data?.dates ?? [];
  const classrooms: MonitoringClassroomGroup[] = data?.classrooms ?? [];

  return (
    <PageShell className="att-monitoring-page" busy={loading}>
      {/* Page Header */}
      <PageHeader
        title="Teacher Attendance Monitoring"
        description="Spreadsheet-style monthly student attendance monitoring across classrooms and subjects."
        actions={
          <button
            type="button"
            onClick={loadMonitoringData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {/* SECTION A: Attendance Summary Cards */}
      <div className="att-summary-grid">
        {/* Card 1: Classrooms */}
        <div className="att-summary-card">
          <div className="att-summary-card__icon att-summary-card__icon--classrooms">
            <FiUsers />
          </div>
          <div>
            <div className="att-summary-card__label">Classrooms</div>
            <div className="att-summary-card__value">
              {loading && !data ? "—" : summary.totalClassrooms}
            </div>
            <div className="att-summary-card__sub">Included in view</div>
          </div>
        </div>

        {/* Card 2: Subjects */}
        <div className="att-summary-card">
          <div className="att-summary-card__icon att-summary-card__icon--subjects">
            <FiBookOpen />
          </div>
          <div>
            <div className="att-summary-card__label">Subjects</div>
            <div className="att-summary-card__value">
              {loading && !data ? "—" : summary.totalSubjects}
            </div>
            <div className="att-summary-card__sub">Represented in matrix</div>
          </div>
        </div>

        {/* Card 3: Present */}
        <div className="att-summary-card">
          <div className="att-summary-card__icon att-summary-card__icon--present">
            <FiUserCheck />
          </div>
          <div>
            <div className="att-summary-card__label">Present</div>
            <div className="att-summary-card__value">
              {loading && !data ? "—" : summary.totalPresent.toLocaleString()}
            </div>
            <div className="att-summary-card__sub">Total marked present</div>
          </div>
        </div>

        {/* Card 4: Absent */}
        <div className="att-summary-card">
          <div className="att-summary-card__icon att-summary-card__icon--absent">
            <FiUserX />
          </div>
          <div>
            <div className="att-summary-card__label">Absent</div>
            <div className="att-summary-card__value">
              {loading && !data ? "—" : summary.totalAbsent.toLocaleString()}
            </div>
            <div className="att-summary-card__sub">Total marked absent</div>
          </div>
        </div>

        {/* Card 5: Overall Attendance Rate */}
        <div className="att-summary-card">
          <div className="att-summary-card__icon att-summary-card__icon--rate">
            <FiPercent />
          </div>
          <div>
            <div className="att-summary-card__label">Overall Attendance Rate</div>
            <div className="att-summary-card__value">
              {loading && !data
                ? "—"
                : summary.overallAttendanceRate !== null
                  ? `${summary.overallAttendanceRate}%`
                  : "N/A"}
            </div>
            <div className="att-summary-card__sub">Period attendance rate</div>
          </div>
        </div>
      </div>

      {/* FILTERS TOOLBAR */}
      <div className="att-filter-bar">
        <div className="att-filter-row">
          {/* 1. School Year */}
          <div className="att-filter-group">
            <label htmlFor="filter-sy">School Year</label>
            <select
              id="filter-sy"
              className="att-filter-select"
              value={selectedSchoolYearId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSchoolYearId(val === "all" ? "all" : Number(val));
              }}
            >
              <option value="all">Active / All Years</option>
              {schoolYears.map((sy) => (
                <option key={sy.id} value={sy.id}>
                  SY {sy.startYear}–{sy.endYear} {Boolean(sy.isActive) ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Month + Year Navigator */}
          <div className="att-filter-group" style={{ minWidth: "220px", flex: "1 1 220px" }}>
            <label htmlFor="filter-month">Reporting Month</label>
            <div className="att-month-navigator">
              <button
                type="button"
                className="att-nav-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
                aria-label="Previous Month"
              >
                <FiChevronLeft size={18} />
              </button>
              <select
                id="filter-month"
                className="att-filter-select flex-1"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name} {selectedYear}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="att-nav-btn"
                onClick={handleNextMonth}
                title="Next Month"
                aria-label="Next Month"
              >
                <FiChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* 3. Classroom / Section */}
          <div className="att-filter-group">
            <label htmlFor="filter-classroom">Classroom</label>
            <select
              id="filter-classroom"
              className="att-filter-select"
              value={selectedClassId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedClassId(val === "all" ? "all" : Number(val));
              }}
            >
              <option value="all">All Classrooms</option>
              {classroomsList.map((c) => (
                <option key={c.id} value={c.id}>
                  Grade {c.gradeLevel} - {c.section}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Grade Level */}
          <div className="att-filter-group" style={{ minWidth: "120px", flex: "1 1 120px" }}>
            <label htmlFor="filter-grade">Grade Level</label>
            <select
              id="filter-grade"
              className="att-filter-select"
              value={selectedGradeLevel}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedGradeLevel(val === "all" ? "all" : Number(val));
              }}
            >
              <option value="all">All Grades</option>
              {gradeLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  Grade {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Subject */}
          <div className="att-filter-group">
            <label htmlFor="filter-subject">Subject</label>
            <select
              id="filter-subject"
              className="att-filter-select"
              value={selectedSubjectId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSubjectId(val === "all" ? "all" : Number(val));
              }}
            >
              <option value="all">All Subjects</option>
              {subjectsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* 6. Teacher */}
          <div className="att-filter-group">
            <label htmlFor="filter-teacher">Teacher</label>
            <select
              id="filter-teacher"
              className="att-filter-select"
              value={selectedFacultyId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFacultyId(val === "all" ? "all" : Number(val));
              }}
            >
              <option value="all">All Teachers</option>
              {facultiesList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.lastname}, {f.firstname}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="att-filter-actions">
            <button
              type="button"
              className="att-btn-reset"
              onClick={handleResetFilters}
              title="Reset all filters to defaults"
            >
              <FiRotateCcw />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="att-legend-bar">
        <span className="font-semibold text-slate-700">Attendance Rate Color Legend:</span>
        <div className="att-legend-items">
          <div className="att-legend-item">
            <span className="att-legend-chip att-legend-chip--green" />
            <span>High (≥ 95%)</span>
          </div>
          <div className="att-legend-item">
            <span className="att-legend-chip att-legend-chip--neutral" />
            <span>Moderate (75% – 94%)</span>
          </div>
          <div className="att-legend-item">
            <span className="att-legend-chip att-legend-chip--red" />
            <span>Low (&lt; 75%)</span>
          </div>
          <div className="att-legend-item">
            <span className="att-legend-chip att-legend-chip--weekend" />
            <span>Weekend</span>
          </div>
          <div className="att-legend-item">
            <span className="att-legend-chip att-legend-chip--empty" />
            <span>No Submission (-)</span>
          </div>
        </div>
        <span className="text-xs text-slate-500 italic">
          * Click on any colored attendance cell to inspect full session records.
        </span>
      </div>

      {/* SECTION B: Spreadsheet-Style Attendance Matrix */}
      <div className="att-matrix-card">
        {loading && !data ? (
          <div className="p-8 flex flex-col gap-4">
            <Skeleton width="100%" height="2.5rem" radius="0.5rem" />
            <Skeleton width="100%" height="20rem" radius="0.5rem" />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-rose-600 font-medium mb-3">{error}</p>
            <button
              type="button"
              onClick={loadMonitoringData}
              className="px-4 py-2 bg-[#176B3A] text-white rounded-lg text-sm font-semibold hover:bg-[#0D4F2B] transition shadow-xs"
            >
              Retry
            </button>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<FiUsers size={24} />}
              title="No classrooms or attendance data found"
              description="No classrooms match your active filter criteria for this reporting month."
              action={
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 bg-[#176B3A] text-white rounded-lg text-sm font-semibold hover:bg-[#0D4F2B] transition shadow-xs"
                >
                  Reset Filters
                </button>
              }
            />
          </div>
        ) : (
          <div className="att-matrix-viewport">
            <table className="att-matrix-table" aria-label="Teacher Attendance Matrix">
              <thead>
                <tr>
                  <th className="att-col-classroom" scope="col">
                    Classroom / Section
                  </th>
                  <th className="att-col-grade" scope="col">
                    Grade
                  </th>
                  <th className="att-col-subject" scope="col">
                    Subject
                  </th>
                  {dates.map((d) => (
                    <th
                      key={d.date}
                      className={`att-col-date ${d.isWeekend ? "att-date-header--weekend" : ""}`}
                      scope="col"
                      title={d.date}
                    >
                      <div className="att-date-header">
                        <span className="att-date-header__abbr">{d.dayAbbr}</span>
                        <span className="att-date-header__num">{d.dayNumber}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classrooms.map((group) => (
                  <ClassroomGroupingSection
                    key={group.classId}
                    group={group}
                    dates={dates}
                    onCellClick={handleCellClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance Session Detail Modal */}
      <AttendanceSessionDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={selectedSessionDetail}
        loading={modalLoading}
      />
    </PageShell>
  );
}

// Subcomponent for rendering a classroom grouping banner and its subject rows underneath
interface ClassroomGroupingSectionProps {
  group: MonitoringClassroomGroup;
  dates: MonitoringDateInfo[];
  onCellClick: (cell: MonitoringSubjectCell) => void;
}

function ClassroomGroupingSection({ group, dates, onCellClick }: ClassroomGroupingSectionProps) {
  return (
    <>
      {/* 1. Classroom Grouping Row */}
      <tr className="att-row-grouping" aria-label={`Classroom ${group.section} Grade ${group.gradeLevel}`}>
        {/* Col 1: Section name */}
        <td className="att-col-classroom" title={`Section ${group.section}`}>
          {group.section}
        </td>
        {/* Col 2: Grade */}
        <td className="att-col-grade">
          {group.gradeLevel}
        </td>
        {/* Col 3: Enrolled count summary */}
        <td className="att-col-subject">
          {group.totalEnrolled} Enrolled • {group.subjects.length} Subjects
        </td>
        {/* Date columns in grouping row: subtle dividers */}
        {dates.map((d) => (
          <td
            key={d.date}
            className={`att-col-date ${d.isWeekend ? "att-col-date--weekend" : ""}`}
          />
        ))}
      </tr>

      {/* 2. Subjects underneath this classroom */}
      {group.subjects.length === 0 ? (
        <tr className="att-row-subject">
          <td className="att-col-classroom" />
          <td className="att-col-grade" />
          <td className="att-col-subject italic text-slate-400 text-xs">
            No subjects assigned
          </td>
          {dates.map((d) => (
            <td key={d.date} className="att-col-date text-slate-300">
              -
            </td>
          ))}
        </tr>
      ) : (
        group.subjects.map((subj) => (
          <SubjectRow
            key={subj.classSubjectId}
            subject={subj}
            dates={dates}
            onCellClick={onCellClick}
          />
        ))
      )}
    </>
  );
}

// Subcomponent for one subject row underneath a classroom grouping
interface SubjectRowProps {
  subject: MonitoringSubjectRow;
  dates: MonitoringDateInfo[];
  onCellClick: (cell: MonitoringSubjectCell) => void;
}

function SubjectRow({ subject, dates, onCellClick }: SubjectRowProps) {
  return (
    <tr className="att-row-subject">
      {/* Col 1 & 2: visually grouped by classroom above, not repeated */}
      <td className="att-col-classroom" />
      <td className="att-col-grade" />

      {/* Col 3: Subject Name and Teacher Name */}
      <td className="att-col-subject">
        <div className="att-subject-cell-content">
          <span className="att-subject-name" title={subject.subjectName}>
            {subject.subjectName}
          </span>
          <span className="att-subject-teacher" title={`Teacher: ${subject.teacherName}`}>
            {subject.teacherName}
          </span>
        </div>
      </td>

      {/* Dynamic Date Cells */}
      {dates.map((d) => {
        const cell = subject.attendanceByDate[d.date];

        // 1. Weekend Cell
        if (d.isWeekend) {
          return (
            <td key={d.date} className="att-col-date att-cell--weekend">
              <span className="text-slate-400 select-none">-</span>
            </td>
          );
        }

        // 2. Submitted Cell
        if (cell?.hasSession) {
          const rate = cell.attendanceRate;
          let badgeClass = "att-cell-badge--neutral";
          if (rate >= 95) {
            badgeClass = "att-cell-badge--green";
          } else if (rate < 75) {
            badgeClass = "att-cell-badge--red";
          }

          const cellDisplay = `${cell.presentCount}/${cell.totalEnrolled}`;
          const tooltip = `${d.date}: ${cell.presentCount}/${cell.totalEnrolled} Present (${rate}%) • Click to inspect session`;

          return (
            <td key={d.date} className="att-col-date">
              <button
                type="button"
                className={`att-cell-badge ${badgeClass} att-cell-badge--interactive`}
                onClick={() => onCellClick(cell)}
                title={tooltip}
                aria-label={`Attendance for ${subject.subjectName} on ${d.date}: ${cellDisplay} present (${rate}%). Click to view details.`}
              >
                {cellDisplay}
              </button>
            </td>
          );
        }

        // 3. No Session / Missing on Weekday
        return (
          <td
            key={d.date}
            className="att-col-date att-cell--empty"
            title={`No attendance recorded for ${subject.subjectName} on ${d.date}`}
          >
            <span className="text-slate-400 select-none">-</span>
          </td>
        );
      })}
    </tr>
  );
}

