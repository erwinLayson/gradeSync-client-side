import { useMemo, useState } from "react";
import { FiCheckCircle, FiClipboard, FiSearch, FiX } from "react-icons/fi";
import { ModalDialog } from "./ModalDialog";
import type { AttendanceSessionDetailResponse } from "../constant/attendanceMonitoring";

interface AttendanceSessionDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: AttendanceSessionDetailResponse | null;
  loading?: boolean;
}

export function AttendanceSessionDetailModal({
  open,
  onClose,
  data,
  loading = false,
}: AttendanceSessionDetailModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    if (!searchQuery.trim()) return data.students;
    const q = searchQuery.toLowerCase();
    return data.students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.lrn.toLowerCase().includes(q) ||
        String(s.studentId).includes(q),
    );
  }, [data?.students, searchQuery]);

  if (!open) return null;

  const info = data?.sessionInfo;
  const summary = data?.summary;

  const formattedDate = info?.date
    ? new Date(`${info.date}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const formattedTimestamp = info?.submissionTimestamp
    ? new Date(info.submissionTimestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Not recorded";

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      scrollable
      className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      ariaLabel="Attendance Session Details"
    >
      {/* Modal Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 bg-[#F7FAF8]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EAF5EE] text-[#176B3A] flex items-center justify-center flex-shrink-0 shadow-xs border border-[#C4E3D1]">
            <FiClipboard size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-snug">
              Attendance Session Details
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {info ? `${info.classroomName} • ${info.subjectName}` : "Loading session..."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          aria-label="Close dialog"
        >
          <FiX size={20} />
        </button>
      </div>

      {/* Modal Body - Single unified scroll container */}
      <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
        {loading || !data ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 border-3 border-[#176B3A] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading attendance session records...</p>
          </div>
        ) : (
          <div className="att-modal-content">
            {/* SECTION 1: Attendance Information */}
            <div>
              <h4 className="att-modal-section-title">Section 1: Attendance Information</h4>
              <div className="att-modal-info-grid">
                <div className="att-modal-info-item">
                  <span className="att-modal-info-label">Classroom / Section</span>
                  <span className="att-modal-info-value">{info?.section}</span>
                </div>
                <div className="att-modal-info-item">
                  <span className="att-modal-info-label">Grade Level</span>
                  <span className="att-modal-info-value">Grade {info?.gradeLevel}</span>
                </div>
                <div className="att-modal-info-item">
                  <span className="att-modal-info-label">Subject</span>
                  <span className="att-modal-info-value">{info?.subjectName}</span>
                </div>
                <div className="att-modal-info-item">
                  <span className="att-modal-info-label">Attendance Date</span>
                  <span className="att-modal-info-value">{formattedDate}</span>
                </div>
                <div className="att-modal-info-item">
                  <span className="att-modal-info-label">Teacher (Creator)</span>
                  <span className="att-modal-info-value">{info?.teacherName}</span>
                </div>
                <div className="att-modal-info-item">
                  <span className="att-modal-info-label">Submission Timestamp</span>
                  <span className="att-modal-info-value">{formattedTimestamp}</span>
                </div>
                <div className="att-modal-info-item">
                  <span className="att-modal-info-label">Session Status</span>
                  <span className="att-modal-info-value">
                    <span className="inline-flex items-center gap-1.5 text-[#03543F] bg-[#DEF7EC] border border-[#BCF0DA] px-2.5 py-0.5 rounded-full font-bold text-xs">
                      <FiCheckCircle size={13} />
                      {info?.status || "Submitted"}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: Attendance Summary */}
            <div>
              <h4 className="att-modal-section-title">Section 2: Attendance Summary</h4>
              <div className="att-modal-summary-grid">
                <div className="att-modal-stat-card">
                  <span className="att-modal-stat-card__num">{summary?.totalEnrolled ?? 0}</span>
                  <span className="att-modal-stat-card__label">Total Enrolled</span>
                </div>
                <div className="att-modal-stat-card att-modal-stat-card--present">
                  <span className="att-modal-stat-card__num">{summary?.present ?? 0}</span>
                  <span className="att-modal-stat-card__label">Present</span>
                </div>
                <div className="att-modal-stat-card att-modal-stat-card--absent">
                  <span className="att-modal-stat-card__num">{summary?.absent ?? 0}</span>
                  <span className="att-modal-stat-card__label">Absent</span>
                </div>
                <div className="att-modal-stat-card att-modal-stat-card--late">
                  <span className="att-modal-stat-card__num">{summary?.late ?? 0}</span>
                  <span className="att-modal-stat-card__label">Late</span>
                </div>
                <div className="att-modal-stat-card att-modal-stat-card--excused">
                  <span className="att-modal-stat-card__num">{summary?.excused ?? 0}</span>
                  <span className="att-modal-stat-card__label">Excused</span>
                </div>
                <div className="att-modal-stat-card att-modal-stat-card--rate">
                  <span className="att-modal-stat-card__num">
                    {summary?.attendanceRate !== undefined ? `${summary.attendanceRate}%` : "—"}
                  </span>
                  <span className="att-modal-stat-card__label">Attendance Rate</span>
                </div>
              </div>
            </div>

            {/* SECTION 3: Student Attendance Records */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                <h4 className="att-modal-section-title !mb-0">
                  Section 3: Student Attendance Records ({filteredStudents.length})
                </h4>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search student or LRN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="att-modal-search-input"
                  />
                  <FiSearch className="absolute left-2.5 top-3 text-slate-400" size={14} />
                </div>
              </div>

              <div className="att-modal-roster-box">
                <div className="att-modal-table-viewport">
                  <table className="att-modal-table">
                    <thead>
                      <tr>
                        <th style={{ width: "140px" }}>Student ID / LRN</th>
                        <th>Student Name</th>
                        <th style={{ width: "130px", textAlign: "center" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-8 text-slate-500 font-medium">
                            No students match your search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st) => (
                          <tr key={st.studentId}>
                            <td className="font-mono text-xs text-slate-600 font-medium">
                              {st.lrn || st.studentId}
                            </td>
                            <td className="font-medium text-slate-800">
                              {st.studentName}
                            </td>
                            <td className="text-center">
                              <span
                                className={`att-status-pill att-status-pill--${st.status}`}
                              >
                                {st.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-[#F7FAF8]">
        <div className="text-xs text-slate-500">
          {info?.date && (
            <span>
              Session date: <strong className="text-slate-700">{info.date}</strong>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-[#EAF5EE] hover:text-[#176B3A] hover:border-[#176B3A] transition shadow-xs"
        >
          Close
        </button>
      </div>
    </ModalDialog>
  );
}
