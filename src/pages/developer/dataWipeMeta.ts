// Client-side metadata for the developer data-wipe tool
// (docs/developer-data-wipe-plan.md Phase B).
//
// The confirmation phrases MUST mirror server/src/model/systemWipe.ts
// WIPE_PHRASES — but the server is the authority: a mismatched phrase is
// rejected there regardless of what this file says. Keep both lists in sync.

export type WipeDomain =
    | "all"
    | "academics"
    | "attendance"
    | "enrollments"
    | "users"
    | "structure"
    | "settings"
    | "uploads";

export interface WipeDomainMeta {
    /** Server scope key sent in the POST body. */
    key: WipeDomain;
    /** The exact phrase the operator must type (case-sensitive). */
    phrase: string;
    label: string;
    /** One-sentence explanation of what the wipe removes. */
    description: string;
    /** Short line about what survives this specific domain. */
    keeps: string;
    /** Higher severity = stronger warning treatment in the UI. */
    severity: "critical" | "high" | "medium";
}

export const WIPE_DOMAINS: WipeDomainMeta[] = [
    {
        key: "academics",
        phrase: "WIPE GRADES",
        label: "Academic data",
        description:
            "Student scores, assessments, academic records, grading weights, subject and teacher assignments.",
        keeps: "Classrooms, subjects, enrollments, users and settings are kept.",
        severity: "high",
    },
    {
        key: "attendance",
        phrase: "WIPE ATTENDANCE",
        label: "Attendance",
        description: "All daily and per-student attendance records.",
        keeps: "Enrollments, classrooms and users are kept.",
        severity: "medium",
    },
    {
        key: "enrollments",
        phrase: "WIPE ENROLLMENTS",
        label: "Enrollments",
        description:
            "Enrollment records, class rosters and enrollment details. Academic data referencing enrollments must be wiped first (the server enforces this).",
        keeps: "Students, users, classrooms and subjects are kept.",
        severity: "high",
    },
    {
        key: "users",
        phrase: "WIPE USERS",
        label: "User accounts",
        description:
            "Every teacher and student account, plus the academic/attendance/enrollment data tied to them.",
        keeps: "Admin and developer logins always survive.",
        severity: "critical",
    },
    {
        key: "structure",
        phrase: "WIPE STRUCTURE",
        label: "Structure",
        description: "Classrooms and subjects (and their assignments).",
        keeps: "Users, enrollments and settings are kept.",
        severity: "high",
    },
    {
        key: "settings",
        phrase: "WIPE SETTINGS",
        label: "Settings",
        description: "School info, school years, academic settings and grading weight defaults.",
        keeps: "All records, users and structure are kept.",
        severity: "medium",
    },
    {
        key: "uploads",
        phrase: "WIPE UPLOADS",
        label: "Uploaded files",
        description: "Every file in the server's uploads directory on disk.",
        keeps: "Database rows are not touched.",
        severity: "medium",
    },
    {
        key: "all",
        phrase: "WIPE ALL DATA",
        label: "EVERYTHING",
        description:
            "Reports, grades, attendance, enrollments, teacher/student accounts, classrooms, subjects, school settings and uploaded files — in one irreversible action.",
        keeps: "Admin + developer logins and landing page content always survive.",
        severity: "critical",
    },
];

/** Format a raw row count for the status list, e.g. 1,204. */
export function formatCount(rows: number): string {
    return rows.toLocaleString();
}
