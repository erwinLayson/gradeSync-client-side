// ============================================================
// Attendance Monitoring Constants & Types (Admin side)
// ============================================================

import type { AttendanceStatus } from "./attendance";

export interface MonitoringDateInfo {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1..31
  dayOfWeek: number; // 0..6 (0 = Sun)
  dayAbbr: string; // 'SUN', 'MON', etc.
  isWeekend: boolean;
}

export type CellStatusType = "submitted" | "missing" | "weekend" | "no_schedule";

export interface MonitoringSubjectCell {
  hasSession: boolean;
  presentCount: number;
  totalEnrolled: number;
  attendanceRate: number; // 0 - 100
  statusType: CellStatusType;
  sessionCount: number;
  classSubjectId: number;
  date: string;
}

export interface MonitoringSubjectRow {
  classSubjectId: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  facultyId: number;
  teacherName: string;
  attendanceByDate: Record<string, MonitoringSubjectCell>;
}

export interface MonitoringClassroomGroup {
  classId: number;
  section: string;
  gradeLevel: number;
  totalEnrolled: number;
  subjects: MonitoringSubjectRow[];
}

export interface MonitoringSummaryStats {
  totalClassrooms: number;
  totalSubjects: number;
  totalPresent: number;
  totalAbsent: number;
  overallAttendanceRate: number | null; // e.g. 94.5 or null
}

export interface SchoolYearMeta {
  id: number;
  startYear: string;
  endYear: string;
  isActive: boolean;
}

export interface AttendanceMonitoringResponse {
  schoolYear: SchoolYearMeta | null;
  selectedMonth: number; // 1 - 12
  selectedYear: number;
  summary: MonitoringSummaryStats;
  dates: MonitoringDateInfo[];
  classrooms: MonitoringClassroomGroup[];
}

export interface MonitoringFiltersState {
  schoolYearId: number | "all";
  month: number; // 1 - 12
  year: number;
  classId: number | "all";
  gradeLevel: number | "all";
  subjectId: number | "all";
  facultyId: number | "all";
}

export interface AttendanceSessionDetailResponse {
  sessionInfo: {
    classSubjectId: number;
    classId: number;
    classroomName: string;
    section: string;
    gradeLevel: number;
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    facultyId: number;
    teacherName: string;
    date: string;
    submissionTimestamp: string | null;
    quarter: number | null;
    status: string;
  };
  summary: {
    totalEnrolled: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  };
  students: {
    studentId: number;
    lrn: string;
    studentName: string;
    status: AttendanceStatus | "unmarked";
    recordedAt: string | null;
  }[];
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

