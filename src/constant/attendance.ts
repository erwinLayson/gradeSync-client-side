// Shared attendance types for the faculty spreadsheet view.
//
// Mirrors the server payload from GET /attendance/range (service
// getAttendanceRangeService) and POST /attendance, so the grid never invents
// its own shape.

export type AttendanceStatus = "present" | "absent";

/** One row of the class-wide attendance matrix. */
export interface AttendanceMatrixStudent {
    enrollmentId: number;
    studentId: number;
    studentLrn: string;
    fullname: string;
}

/** One cell of the class-wide attendance matrix: a student on a date. */
export interface AttendanceMatrixCell {
    enrollmentId: number;
    /** Local yyyy-mm-dd, exactly as stored. */
    date: string;
    status: AttendanceStatus | null;
    quarter: number | null;
}

/**
 * The class-wide attendance grid: students as rows, every recorded date in the
 * selected school year / quarter / date range as columns, plus the cells
 * between them. `dates` only ever contains dates that have at least one
 * matching record, so a column is never empty.
 */
export interface AttendanceMatrix {
    classSubjectId: number;
    students: AttendanceMatrixStudent[];
    dates: string[];
    records: AttendanceMatrixCell[];
}

/** Body of POST /attendance — one day of attendance for one class subject. */
export interface AttendanceSavePayload {
    classSubjectId: number;
    date: string;
    quarter: number;
    entries: { enrollmentId: number; status: AttendanceStatus }[];
}

/** A quarter filter value: a specific quarter, or "all" to include everything. */
export type QuarterFilter = number | "all";

/** A school year as returned by GET /schoolYear. */
export interface SchoolYearOption {
    id: number;
    startYear: string;
    endYear: string;
    isActive?: boolean | number;
    // Authoritative completion marker: only 'completed' unlocks faculty role
    // changes (plan §7). Absent on older payloads — treat as not completed.
    status?: "ongoing" | "completed" | string;
}
