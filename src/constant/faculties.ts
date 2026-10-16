// Faculty roles — mirrors server/src/constant/faculties.ts (plan §1). `teacher`
// keeps the teaching capabilities; `register` has none.
export const FACULTY_ROLES = {
    TEACHER: "teacher",
    REGISTER: "register",
} as const;

export type FacultyRole = (typeof FACULTY_ROLES)[keyof typeof FACULTY_ROLES];

export const FACULTY_ROLE_OPTIONS: { value: FacultyRole; label: string; hint: string }[] = [
    {
        value: "teacher",
        label: "Teacher",
        hint: "Teaching faculty — can be assigned classes, subjects and class-adviser duties.",
    },
    {
        value: "register",
        label: "Register",
        hint: "Registration staff — cannot be assigned teaching responsibilities.",
    },
];

/** Human label for a faculty role (falls back to the raw value). */
export function facultyRoleLabel(role?: FacultyRole | string | null): string {
    if (role === FACULTY_ROLES.TEACHER) return "Teacher";
    if (role === FACULTY_ROLES.REGISTER) return "Register";
    return role ? String(role) : "—";
}

export interface Faculty {
    id: number;
    fullname: string;
    email: string;
    role: FacultyRole;
}

export interface NewFacultyProps {
    email: string;
    firstname: string;
    middlename: string;
    lastname: string;
    suffix?: string | null;
    // Required on create; on edit it is sent as-is so an unchanged role never
    // trips the school-year role-change gate.
    role: FacultyRole;
}

export interface FacultyDetails extends Faculty {
    userId: number;
    firstname: string;
    middlename: string;
    lastname: string;
    suffix?: string | null;
}

export interface FacultySubjectDetails {
    classSubjectId: number,
    subjectId: number,
    subjectName: string,
    subjectCode: string,
    subjectUnit: number;
    classGradeLevel: number,
    classId: number,
    classSection: string
}