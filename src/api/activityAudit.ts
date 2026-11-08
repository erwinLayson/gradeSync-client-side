import { getAPICall } from "./api";
import type {
    ActivityAuditFilters,
    ActivityAuditLogRow,
    ActivityAuditStats,
} from "../constant/activityAudit";

export interface ActivityAuditLogsResponse {
    logs: ActivityAuditLogRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function fetchActivityAuditLogs(filters: Partial<ActivityAuditFilters>) {
    const params = new URLSearchParams();

    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.actorUserId) params.set("actorUserId", String(filters.actorUserId));
    if (filters.actorRole) params.set("actorRole", filters.actorRole);
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.schoolYearId) params.set("schoolYearId", String(filters.schoolYearId));
    if (filters.gradeLevel) params.set("gradeLevel", String(filters.gradeLevel));
    if (filters.classroomId) params.set("classroomId", String(filters.classroomId));
    if (filters.subjectId) params.set("subjectId", String(filters.subjectId));
    if (filters.quarter) params.set("quarter", String(filters.quarter));
    if (filters.status) params.set("status", filters.status);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.search) params.set("search", filters.search);

    const query = params.toString() ? `?${params.toString()}` : "";
    return getAPICall<ActivityAuditLogsResponse>(`/activity-audit${query}`);
}

export async function fetchActivityAuditStats(schoolYearId?: number) {
    const query = schoolYearId ? `?schoolYearId=${schoolYearId}` : "";
    return getAPICall<ActivityAuditStats>(`/activity-audit/stats${query}`);
}

export async function fetchActivityAuditDetail(id: number) {
    return getAPICall<ActivityAuditLogRow>(`/activity-audit/${id}`);
}
