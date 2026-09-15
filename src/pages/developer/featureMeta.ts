// Human-friendly labels/descriptions for known feature keys. Unknown keys
// returned by the API still render (key-as-label) so nothing is hidden from
// the developer — this list only adds friendly copy.
export interface FeatureRow {
    key: string;
    label: string;
    description: string;
}

export const FEATURE_META: Record<string, Omit<FeatureRow, "key">> = {
    reports_analytics: {
        label: "Reports & Analytics",
        description: "Admin analytics dashboards covering enrollment, grades and attendance trends.",
    },
    reports_generation: {
        label: "Report Generation",
        description: "Printable reports: master lists, class rosters, grade sheets and attendance summaries.",
    },
    submission_tracker: {
        label: "Submission Tracker",
        description: "Quarterly submission workflow for advisers freezing class records (SF10 / Form-137).",
    },
    // Role login switches (docs/role-login-switches-plan.md) — also surfaced
    // as dedicated switches on /developer/users. login_developer intentionally
    // has no entry: it must never exist as a toggleable flag.
    login_admin: {
        label: "Admin Logins",
        description: "Master switch for admin account logins. While disabled, no admin can sign in (existing sessions expire naturally).",
    },
    login_teacher: {
        label: "Teacher Logins",
        description: "Master switch for teacher account logins. While disabled, no teacher can sign in (existing sessions expire naturally).",
    },
    login_student: {
        label: "Student Logins",
        description: "Master switch for student account logins. While disabled, no student can sign in (existing sessions expire naturally).",
    },
};
