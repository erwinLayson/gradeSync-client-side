import { getAPICall } from "./api";
import type {
  AttendanceMonitoringResponse,
  AttendanceSessionDetailResponse,
  MonitoringFiltersState,
} from "../constant/attendanceMonitoring";

export async function fetchAttendanceMonitoring(
  filters: Partial<MonitoringFiltersState>,
  options?: { skipErrorToast?: boolean },
): Promise<AttendanceMonitoringResponse> {
  const query = new URLSearchParams();

  if (filters.schoolYearId !== undefined && filters.schoolYearId !== "all") {
    query.set("schoolYearId", String(filters.schoolYearId));
  }
  if (filters.month !== undefined) {
    query.set("month", String(filters.month));
  }
  if (filters.year !== undefined) {
    query.set("year", String(filters.year));
  }
  if (filters.classId !== undefined && filters.classId !== "all") {
    query.set("classId", String(filters.classId));
  }
  if (filters.gradeLevel !== undefined && filters.gradeLevel !== "all") {
    query.set("gradeLevel", String(filters.gradeLevel));
  }
  if (filters.subjectId !== undefined && filters.subjectId !== "all") {
    query.set("subjectId", String(filters.subjectId));
  }
  if (filters.facultyId !== undefined && filters.facultyId !== "all") {
    query.set("facultyId", String(filters.facultyId));
  }

  const queryString = query.toString();
  const endpoint = queryString ? `/attendance/monitoring?${queryString}` : "/attendance/monitoring";

  const response = await getAPICall<AttendanceMonitoringResponse>(endpoint, {
    skipErrorToast: options?.skipErrorToast,
  });

  if (!response.data) {
    throw new Error("Missing response data from attendance monitoring endpoint");
  }

  return response.data;
}

export async function fetchAttendanceSessionDetail(
  classSubjectId: number,
  date: string,
  schoolYearId?: number,
  options?: { skipErrorToast?: boolean },
): Promise<AttendanceSessionDetailResponse> {
  const query = new URLSearchParams();
  query.set("classSubjectId", String(classSubjectId));
  query.set("date", date);
  if (schoolYearId !== undefined) {
    query.set("schoolYearId", String(schoolYearId));
  }

  const response = await getAPICall<AttendanceSessionDetailResponse>(
    `/attendance/monitoring/session-detail?${query.toString()}`,
    { skipErrorToast: options?.skipErrorToast },
  );

  if (!response.data) {
    throw new Error("Missing response data from session detail endpoint");
  }

  return response.data;
}

