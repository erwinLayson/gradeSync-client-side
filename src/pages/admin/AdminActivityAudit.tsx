import { useCallback, useEffect, useState } from "react";
import {
    FiActivity,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiEye,
    FiFileText,
    FiRefreshCw,
    FiSearch,
    FiShield,
    FiX,
    FiXCircle,
} from "react-icons/fi";

import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import { ModalDialog } from "../../components/ModalDialog";
import { EmptyState } from "../../components/EmptyState";
import Skeleton from "../../components/Skeleton";

import {
    fetchActivityAuditDetail,
    fetchActivityAuditLogs,
    fetchActivityAuditStats,
} from "../../api/activityAudit";

import type {
    ActivityAuditFilters,
    ActivityAuditLogRow,
    ActivityAuditStats,
} from "../../constant/activityAudit";
import { AUDIT_ACTIONS, formatActionLabel } from "../../constant/activityAudit";

import "../../style/adminActivityAudit.css";

const ACTION_OPTIONS = [
    { value: "", label: "All Actions" },
    { value: AUDIT_ACTIONS.REPORT_CARD_GENERATED, label: "Report Card Generated" },
    { value: AUDIT_ACTIONS.GRADE_SUBMITTED, label: "Grade Submitted" },
    { value: AUDIT_ACTIONS.ACTIVITY_CREATED, label: "Assessment Created" },
    { value: AUDIT_ACTIONS.ACTIVITY_UPDATED, label: "Assessment Updated" },
    { value: AUDIT_ACTIONS.ACTIVITY_DELETED, label: "Assessment Deleted" },
    { value: AUDIT_ACTIONS.ATTENDANCE_RECORDED, label: "Attendance Recorded" },
    { value: AUDIT_ACTIONS.ATTENDANCE_UPDATED, label: "Attendance Updated" },
    { value: AUDIT_ACTIONS.STUDENT_ENROLLED, label: "Student Enrolled" },
    { value: AUDIT_ACTIONS.ENROLLMENT_STATUS_UPDATED, label: "Enrollment Updated" },
];

const ROLE_OPTIONS = [
    { value: "", label: "All Roles" },
    { value: "teacher", label: "Teacher" },
    { value: "register", label: "Register" },
    { value: "admin", label: "Admin" },
];

function getActionBadgeClass(action: string): string {
    if (action.includes("report_card")) return "audit-action-badge--report";
    if (action.includes("grade")) return "audit-action-badge--grade";
    if (action.includes("activity")) return "audit-action-badge--assessment";
    if (action.includes("attendance")) return "audit-action-badge--attendance";
    if (action.includes("enrollment")) return "audit-action-badge--enrollment";
    return "audit-action-badge--default";
}

function getRoleBadgeClass(role: string): string {
    const lower = (role || "").toLowerCase();
    if (lower === "admin") return "audit-role-badge--admin";
    if (lower === "teacher") return "audit-role-badge--teacher";
    if (lower === "register") return "audit-role-badge--register";
    return "audit-role-badge--unknown";
}

export default function AdminActivityAudit() {
    const [stats, setStats] = useState<ActivityAuditStats | null>(null);
    const [logs, setLogs] = useState<ActivityAuditLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 15;

    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Modal state
    const [selectedLog, setSelectedLog] = useState<ActivityAuditLogRow | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    // Load statistics
    const loadStats = useCallback(async () => {
        try {
            setStatsLoading(true);
            const res = await fetchActivityAuditStats();
            if (res?.data) {
                setStats(res.data);
            }
        } catch (err) {
            console.error("Failed to load audit stats:", err);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    // Load audit logs
    const loadLogs = useCallback(async () => {
        try {
            setLoading(true);
            const filters: Partial<ActivityAuditFilters> = {
                page,
                limit,
            };
            if (search.trim()) filters.search = search.trim();
            if (roleFilter) filters.actorRole = roleFilter;
            if (actionFilter) filters.action = actionFilter;
            if (statusFilter) filters.status = statusFilter;
            if (dateFrom) filters.dateFrom = dateFrom;
            if (dateTo) filters.dateTo = dateTo;

            const res = await fetchActivityAuditLogs(filters);
            if (res?.data) {
                setLogs(res.data.logs || []);
                setTotal(res.data.total || 0);
                setTotalPages(res.data.totalPages || 1);
            }
        } catch (err) {
            console.error("Failed to load audit logs:", err);
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, roleFilter, actionFilter, statusFilter, dateFrom, dateTo]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const handleResetFilters = () => {
        setSearch("");
        setRoleFilter("");
        setActionFilter("");
        setStatusFilter("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    const handleInspect = async (id: number) => {
        try {
            setDetailLoading(true);
            setModalOpen(true);
            const res = await fetchActivityAuditDetail(id);
            if (res?.data) {
                setSelectedLog(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch log detail:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <PageShell className="audit-page">
            <PageHeader
                title="Activity Audit & Monitoring"
                description="Comprehensive historical audit trail of teacher and register operations across the academic system."
            />

            {/* KPI Summary Cards */}
            <div className="audit-kpis">
                <div className="audit-kpi">
                    <div className="audit-kpi__icon audit-kpi__icon--total">
                        <FiActivity />
                    </div>
                    <div>
                        <div className="audit-kpi__label">Total Activities</div>
                        <div className="audit-kpi__value">
                            {statsLoading ? "—" : stats?.total.toLocaleString() ?? 0}
                        </div>
                    </div>
                </div>

                <div className="audit-kpi">
                    <div className="audit-kpi__icon audit-kpi__icon--today">
                        <FiClock />
                    </div>
                    <div>
                        <div className="audit-kpi__label">Today</div>
                        <div className="audit-kpi__value">
                            {statsLoading ? "—" : stats?.today.toLocaleString() ?? 0}
                        </div>
                    </div>
                </div>

                <div className="audit-kpi">
                    <div className="audit-kpi__icon audit-kpi__icon--week">
                        <FiCalendar />
                    </div>
                    <div>
                        <div className="audit-kpi__label">This Week</div>
                        <div className="audit-kpi__value">
                            {statsLoading ? "—" : stats?.thisWeek.toLocaleString() ?? 0}
                        </div>
                    </div>
                </div>

                <div className="audit-kpi">
                    <div className="audit-kpi__icon audit-kpi__icon--active">
                        <FiShield />
                    </div>
                    <div>
                        <div className="audit-kpi__label">Active Roles</div>
                        <div className="audit-kpi__value">
                            {statsLoading ? "—" : stats?.byRole?.length ?? 0}
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filters Toolbar */}
            <PageSection title="Audit Records" description="Filter and inspect actions performed by teachers and register personnel.">
                <div className="audit-toolbar">
                    <div className="audit-toolbar__row">
                        <div className="audit-search-input">
                            <FiSearch />
                            <input
                                type="text"
                                placeholder="Search by description, actor, or ID…"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>

                        <select
                            className="audit-select"
                            value={roleFilter}
                            onChange={(e) => {
                                setRoleFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        <select
                            className="audit-select"
                            value={actionFilter}
                            onChange={(e) => {
                                setActionFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            {ACTION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        <select
                            className="audit-select"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All Statuses</option>
                            <option value="success">Success</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>

                    <div className="audit-toolbar__row">
                        <div className="audit-date-group">
                            <span className="text-xs text-slate-500 font-medium">From:</span>
                            <input
                                type="date"
                                className="audit-date-input"
                                value={dateFrom}
                                onChange={(e) => {
                                    setDateFrom(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>

                        <div className="audit-date-group">
                            <span className="text-xs text-slate-500 font-medium">To:</span>
                            <input
                                type="date"
                                className="audit-date-input"
                                value={dateTo}
                                onChange={(e) => {
                                    setDateTo(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>

                        <button
                            type="button"
                            className="audit-btn-reset"
                            onClick={handleResetFilters}
                            title="Reset all filters"
                        >
                            <FiRefreshCw /> Reset
                        </button>
                    </div>
                </div>

                {/* Audit Logs Table */}
                {loading ? (
                    <div className="p-6">
                        <Skeleton count={5} lines={1} height="2.5rem" radius="0.5rem" />
                    </div>
                ) : logs.length === 0 ? (
                    <EmptyState
                        icon={<FiFileText />}
                        title="No audit logs found"
                        description="No activities matched the chosen filters or search query."
                    />
                ) : (
                    <div className="audit-table-wrapper">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Activity</th>
                                    <th>Description</th>
                                    <th>Academic Context</th>
                                    <th>Timestamp</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td>
                                            <div className="font-semibold text-slate-900">{log.actorName}</div>
                                            <div className="text-xs text-slate-500">ID #{log.actorUserId}</div>
                                        </td>
                                        <td>
                                            <span className={`audit-role-badge ${getRoleBadgeClass(log.actorRole)}`}>
                                                {log.actorRole}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`audit-action-badge ${getActionBadgeClass(log.action)}`}>
                                                {formatActionLabel(log.action)}
                                            </span>
                                        </td>
                                        <td className="max-w-xs truncate" title={log.description}>
                                            {log.description}
                                        </td>
                                        <td>
                                            <div className="audit-context-tags">
                                                {log.schoolYear && (
                                                    <span className="audit-tag audit-tag--sy">SY {log.schoolYear}</span>
                                                )}
                                                {log.classroomName && (
                                                    <span className="audit-tag">{log.classroomName}</span>
                                                )}
                                                {log.subjectName && (
                                                    <span className="audit-tag">{log.subjectName}</span>
                                                )}
                                                {log.quarter && (
                                                    <span className="audit-tag">Q{log.quarter}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap text-xs text-slate-600">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td>
                                            <span
                                                className={`audit-status-pill ${
                                                    log.status === "success"
                                                        ? "audit-status-pill--success"
                                                        : "audit-status-pill--failed"
                                                }`}
                                            >
                                                {log.status === "success" ? <FiCheckCircle /> : <FiXCircle />}
                                                {log.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="audit-btn-inspect"
                                                onClick={() => handleInspect(log.id)}
                                            >
                                                <FiEye /> Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination Bar */}
                        <div className="audit-pagination">
                            <div>
                                Showing {logs.length} of {total} activities (Page {page} of {totalPages})
                            </div>
                            <div className="audit-pagination__controls">
                                <button
                                    type="button"
                                    className="audit-pagination__btn"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    className="audit-pagination__btn"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </PageSection>

            {/* Inspection Modal */}
            <ModalDialog
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedLog(null);
                }}
                className="max-w-2xl w-full p-6 bg-white rounded-xl shadow-xl"
                ariaLabel="Activity Audit Details"
            >
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FiActivity className="text-blue-600" /> Activity Audit Record Details
                    </h3>
                    <button
                        type="button"
                        onClick={() => {
                            setModalOpen(false);
                            setSelectedLog(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                        <FiX size={20} />
                    </button>
                </div>

                {detailLoading || !selectedLog ? (
                    <div className="p-4">
                        <Skeleton count={4} lines={1} height="2rem" radius="0.5rem" />
                    </div>
                ) : (
                    <div>
                        <div className="audit-modal-grid">
                            <div className="audit-modal-item">
                                <span className="audit-modal-item__label">Actor</span>
                                <span className="audit-modal-item__value">
                                    {selectedLog.actorName} (User #{selectedLog.actorUserId})
                                </span>
                            </div>

                            <div className="audit-modal-item">
                                <span className="audit-modal-item__label">Role</span>
                                <span className="audit-modal-item__value">
                                    <span className={`audit-role-badge ${getRoleBadgeClass(selectedLog.actorRole)}`}>
                                        {selectedLog.actorRole}
                                    </span>
                                </span>
                            </div>

                            <div className="audit-modal-item">
                                <span className="audit-modal-item__label">Action</span>
                                <span className="audit-modal-item__value">
                                    <span className={`audit-action-badge ${getActionBadgeClass(selectedLog.action)}`}>
                                        {formatActionLabel(selectedLog.action)}
                                    </span>
                                </span>
                            </div>

                            <div className="audit-modal-item">
                                <span className="audit-modal-item__label">Timestamp</span>
                                <span className="audit-modal-item__value">
                                    {new Date(selectedLog.created_at).toLocaleString()}
                                </span>
                            </div>

                            <div className="audit-modal-item">
                                <span className="audit-modal-item__label">IP Address</span>
                                <span className="audit-modal-item__value">{selectedLog.ipAddress || "—"}</span>
                            </div>

                            <div className="audit-modal-item">
                                <span className="audit-modal-item__label">Outcome</span>
                                <span className="audit-modal-item__value">
                                    <span
                                        className={`audit-status-pill ${
                                            selectedLog.status === "success"
                                                ? "audit-status-pill--success"
                                                : "audit-status-pill--failed"
                                        }`}
                                    >
                                        {selectedLog.status}
                                    </span>
                                </span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <span className="audit-modal-item__label">Description</span>
                            <p className="mt-1 text-sm text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                {selectedLog.description}
                            </p>
                        </div>

                        {(selectedLog.classroomName || selectedLog.subjectName || selectedLog.schoolYear) && (
                            <div className="mb-4">
                                <span className="audit-modal-item__label">Academic Scope</span>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {selectedLog.schoolYear && (
                                        <span className="audit-tag audit-tag--sy">SY {selectedLog.schoolYear}</span>
                                    )}
                                    {selectedLog.classroomName && (
                                        <span className="audit-tag">{selectedLog.classroomName}</span>
                                    )}
                                    {selectedLog.subjectName && (
                                        <span className="audit-tag">{selectedLog.subjectName}</span>
                                    )}
                                    {selectedLog.quarter && (
                                        <span className="audit-tag">Quarter {selectedLog.quarter}</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {selectedLog.diff && (
                            <div className="mb-4">
                                <span className="audit-modal-item__label">Attribute Diffs</span>
                                <div className="mt-1 audit-diff-viewer">
                                    {JSON.stringify(selectedLog.diff, null, 2)}
                                </div>
                            </div>
                        )}

                        {selectedLog.metadata && (
                            <div className="mb-4">
                                <span className="audit-modal-item__label">Operation Metadata</span>
                                <div className="mt-1 audit-diff-viewer">
                                    {JSON.stringify(selectedLog.metadata, null, 2)}
                                </div>
                            </div>
                        )}

                        {selectedLog.beforeState && (
                            <div className="mb-4">
                                <span className="audit-modal-item__label">Before State Snapshot</span>
                                <div className="mt-1 audit-diff-viewer">
                                    {JSON.stringify(selectedLog.beforeState, null, 2)}
                                </div>
                            </div>
                        )}

                        {selectedLog.afterState && (
                            <div className="mb-4">
                                <span className="audit-modal-item__label">After State Snapshot</span>
                                <div className="mt-1 audit-diff-viewer">
                                    {JSON.stringify(selectedLog.afterState, null, 2)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ModalDialog>
        </PageShell>
    );
}
