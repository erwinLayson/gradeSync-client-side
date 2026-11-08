export const AUDIT_ACTIONS = {
    REPORT_CARD_GENERATED: "report_card_generated",
    GRADE_SUBMITTED: "grade_submitted",
    ACTIVITY_CREATED: "activity_created",
    ACTIVITY_UPDATED: "activity_updated",
    ACTIVITY_DELETED: "activity_deleted",
    ATTENDANCE_RECORDED: "attendance_recorded",
    ATTENDANCE_UPDATED: "attendance_updated",
    STUDENT_ENROLLED: "student_enrolled",
    ENROLLMENT_STATUS_UPDATED: "enrollment_status_updated",
} as const;

export type ActivityAuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

export interface ActivityAuditLogRow {
    id: number;
    actorUserId: number;
    actorName: string;
    actorRole: string;
    actorFacultyId: number | null;
    action: ActivityAuditAction;
    description: string;
    entityType: string;
    entityId: string | null;
    schoolYearId: number | null;
    schoolYear: string | null;
    classroomId: number | null;
    classroomName: string | null;
    gradeLevel: number | null;
    subjectId: number | null;
    subjectName: string | null;
    quarter: number | null;
    status: "success" | "failed";
    beforeState: any | null;
    afterState: any | null;
    diff: any | null;
    metadata: any | null;
    ipAddress: string | null;
    userAgent: string | null;
    created_at: string;
}

export interface ActivityAuditStats {
    total: number;
    today: number;
    thisWeek: number;
    byRole: { role: string; count: number }[];
    byAction: { action: string; count: number }[];
    byUser: { actorUserId: number; actorName: string; actorRole: string; count: number }[];
    recentActivities: ActivityAuditLogRow[];
}

export interface ActivityAuditFilters {
    actorUserId?: number;
    actorRole?: string;
    action?: string;
    entityType?: string;
    schoolYearId?: number;
    gradeLevel?: number;
    classroomId?: number;
    subjectId?: number;
    quarter?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page: number;
    limit: number;
}

export function formatActionLabel(action: string): string {
    switch (action) {
        case AUDIT_ACTIONS.REPORT_CARD_GENERATED:
            return "Report Card Generated";
        case AUDIT_ACTIONS.GRADE_SUBMITTED:
            return "Grade Submitted";
        case AUDIT_ACTIONS.ACTIVITY_CREATED:
            return "Assessment Created";
        case AUDIT_ACTIONS.ACTIVITY_UPDATED:
            return "Assessment Updated";
        case AUDIT_ACTIONS.ACTIVITY_DELETED:
            return "Assessment Deleted";
        case AUDIT_ACTIONS.ATTENDANCE_RECORDED:
            return "Attendance Recorded";
        case AUDIT_ACTIONS.ATTENDANCE_UPDATED:
            return "Attendance Updated";
        case AUDIT_ACTIONS.STUDENT_ENROLLED:
            return "Student Enrolled";
        case AUDIT_ACTIONS.ENROLLMENT_STATUS_UPDATED:
            return "Enrollment Updated";
        default:
            return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
}
