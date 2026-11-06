import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiFilter,
  FiLayers,
  FiRefreshCw,
  FiSearch,
  FiSlash,
  FiX,
  FiXCircle,
} from "react-icons/fi";

import {
  approveAmendmentRequest,
  getAllAmendmentRequests,
  getAmendmentAuditLogs,
  getAmendmentRequestById,
  getMyAmendmentRequests,
  rejectAmendmentRequest,
  revokeAmendmentPermission,
} from "../../api/amendments";
import { ModalDialog } from "../../components/ModalDialog";
import { PageHeader, PageSection, PageShell } from "../../components/PageLayout";
import {
  getAmendmentRecordTypeLabel,
  getAmendmentStatusBadgeClass,
  getAmendmentStatusLabel,
  type AmendmentAuditLog,
  type AmendmentRequest,
  type AmendmentRequestDetails,
} from "../../constant/amendment";
import { toast } from "../../helper/toast";
import { useUser } from "../../hooks/useUser";

import "../../style/registerAmendments.css";

// ================= Helpers =================

function parseDetails(
  details: string | AmendmentRequestDetails | undefined | null
): AmendmentRequestDetails {
  if (!details) return {};
  if (typeof details === "string") {
    try {
      return JSON.parse(details);
    } catch {
      return {};
    }
  }
  return details;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRemainingTime(expiresAt?: string | null): { text: string; isExpired: boolean } {
  if (!expiresAt) return { text: "Unknown", isExpired: true };
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diffMs = exp - now;

  if (diffMs <= 0) {
    return { text: "Expired", isExpired: true };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return { text: `${hours}h ${minutes}m remaining`, isExpired: false };
  }
  return { text: `${minutes}m remaining`, isExpired: false };
}

function extractDiffDisplay(
  request: AmendmentRequest
): {
  currentDisplay: string;
  proposedDisplay: string;
  contextNote?: string;
} {
  const details = parseDetails(request.details);

  let currentDisplay = "None";
  let proposedDisplay = "None";
  let contextNote: string | undefined;

  if (request.recordType === "gradebook_score") {
    if (details.assessmentTitle) {
      contextNote = `Assessment: ${details.assessmentTitle}`;
    }
    if (details.currentValue !== undefined && details.currentValue !== null) {
      currentDisplay = `${details.currentValue}`;
    } else if (details.currentValues && typeof details.currentValues === "object") {
      const val = (details.currentValues as Record<string, unknown>).score ?? (details.currentValues as Record<string, unknown>).value;
      currentDisplay = val !== undefined && val !== null ? String(val) : "No Score";
    }

    if (details.proposedValue !== undefined && details.proposedValue !== null) {
      proposedDisplay = `${details.proposedValue}`;
    } else if (details.proposedValues && typeof details.proposedValues === "object") {
      const val = (details.proposedValues as Record<string, unknown>).score ?? (details.proposedValues as Record<string, unknown>).value;
      proposedDisplay = val !== undefined && val !== null ? String(val) : "No Score";
    }
  } else if (request.recordType === "attendance") {
    const rawDate = details.attendanceDate || (details.date as string | undefined);
    if (rawDate) {
      contextNote = `Date: ${formatDate(rawDate)}`;
    }
    if (details.currentValue !== undefined && details.currentValue !== null) {
      currentDisplay = String(details.currentValue);
    } else if (details.currentValues && typeof details.currentValues === "object") {
      const val = (details.currentValues as Record<string, unknown>).status ?? (details.currentValues as Record<string, unknown>).value;
      currentDisplay = val !== undefined && val !== null ? String(val) : "Unrecorded";
    }

    if (details.proposedValue !== undefined && details.proposedValue !== null) {
      proposedDisplay = String(details.proposedValue);
    } else if (details.proposedValues && typeof details.proposedValues === "object") {
      const val = (details.proposedValues as Record<string, unknown>).status ?? (details.proposedValues as Record<string, unknown>).value;
      proposedDisplay = val !== undefined && val !== null ? String(val) : "Unrecorded";
    }
  } else {
    // student_record_grade
    if (request.subjectName) {
      contextNote = `Subject: ${request.subjectName}`;
    }
    if (details.currentValue !== undefined && details.currentValue !== null) {
      currentDisplay = `${details.currentValue}`;
    } else if (details.currentValues && typeof details.currentValues === "object") {
      const val = (details.currentValues as Record<string, unknown>).grade ?? (details.currentValues as Record<string, unknown>).value;
      currentDisplay = val !== undefined && val !== null ? String(val) : "—";
    }

    if (details.proposedValue !== undefined && details.proposedValue !== null) {
      proposedDisplay = `${details.proposedValue}`;
    } else if (details.proposedValues && typeof details.proposedValues === "object") {
      const val = (details.proposedValues as Record<string, unknown>).grade ?? (details.proposedValues as Record<string, unknown>).value;
      proposedDisplay = val !== undefined && val !== null ? String(val) : "—";
    }
  }

  return { currentDisplay, proposedDisplay, contextNote };
}

// ================= Component =================

export default function RegisterAmendments() {
  const { user, loading: userLoading } = useUser();

  const isFacultyWorkspace = typeof window !== "undefined" && window.location.pathname.startsWith("/faculty");
  const isTeacher = user?.role === "teacher" && user?.facultyRole !== "register";
  const canReview = !isFacultyWorkspace && (user?.role === "admin" || user?.facultyRole === "register");

  // Data states
  const [requests, setRequests] = useState<AmendmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Review Modal state
  const [activeRequest, setActiveRequest] = useState<AmendmentRequest | null>(null);
  const [auditLogs, setAuditLogs] = useState<AmendmentAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Action Dialog States
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveDurationHours, setApproveDurationHours] = useState(24);
  const [approveReviewNotes, setApproveReviewNotes] = useState("");
  const [isSubmittingApprove, setIsSubmittingApprove] = useState(false);

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");
  const [isSubmittingRevoke, setIsSubmittingRevoke] = useState(false);

  const reviewModalTitleId = useId();
  const approveDialogTitleId = useId();
  const rejectDialogTitleId = useId();
  const revokeDialogTitleId = useId();

  // Load list of requests
  const fetchRequests = useCallback(async (showIndicator = true) => {
    if (userLoading) return;
    if (showIndicator) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      if (isFacultyWorkspace || (isTeacher && !canReview)) {
        const response = await getMyAmendmentRequests();
        setRequests(Array.isArray(response?.data) ? response.data : []);
      } else {
        const response = await getAllAmendmentRequests();
        setRequests(Array.isArray(response?.data) ? response.data : []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load amendment requests";
      toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [userLoading, isFacultyWorkspace, isTeacher, canReview]);

  useEffect(() => {
    if (!userLoading) {
      fetchRequests(true);
    }
  }, [fetchRequests, userLoading]);

  // Fetch full details and audit logs when a request is opened
  const handleOpenReview = useCallback(async (req: AmendmentRequest) => {
    setActiveRequest(req);
    setAuditLogs(req.auditLogs ?? []);
    setLoadingAudit(true);

    try {
      const [detailRes, auditRes] = await Promise.allSettled([
        getAmendmentRequestById(req.id),
        getAmendmentAuditLogs({ requestId: req.id }),
      ]);

      if (detailRes.status === "fulfilled" && detailRes.value?.data) {
        setActiveRequest(detailRes.value.data);
        if (detailRes.value.data.auditLogs?.length) {
          setAuditLogs(detailRes.value.data.auditLogs);
        }
      }

      if (auditRes.status === "fulfilled" && Array.isArray(auditRes.value?.data)) {
        setAuditLogs(auditRes.value.data);
      }
    } catch (err) {
      console.error("Failed to load full amendment details", err);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const handleCloseReview = () => {
    setActiveRequest(null);
    setAuditLogs([]);
  };

  // Approval handler
  const handleConfirmApprove = async () => {
    if (!activeRequest) return;
    setIsSubmittingApprove(true);

    try {
      await approveAmendmentRequest(activeRequest.id, {
        durationHours: approveDurationHours,
        reviewNotes: approveReviewNotes.trim() || undefined,
      });

      toast.success(
        `Amendment approved with a ${approveDurationHours}-hour editing window.`
      );
      setIsApproveOpen(false);
      setApproveReviewNotes("");
      setApproveDurationHours(24);

      // Refresh both list and the opened modal details
      await fetchRequests(false);
      await handleOpenReview(activeRequest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve amendment request";
      toast.error(msg);
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  // Rejection handler
  const handleConfirmReject = async () => {
    if (!activeRequest) return;
    const reasonTrimmed = rejectionReason.trim();
    if (!reasonTrimmed) {
      toast.error("Please enter a valid rejection reason.");
      return;
    }

    setIsSubmittingReject(true);

    try {
      await rejectAmendmentRequest(activeRequest.id, {
        rejectionReason: reasonTrimmed,
      });

      toast.success("Amendment request has been rejected.");
      setIsRejectOpen(false);
      setRejectionReason("");

      // Refresh list and modal
      await fetchRequests(false);
      await handleOpenReview(activeRequest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject amendment request";
      toast.error(msg);
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Revocation handler
  const handleConfirmRevoke = async () => {
    if (!activeRequest) return;
    setIsSubmittingRevoke(true);

    try {
      await revokeAmendmentPermission(activeRequest.id, {
        reason: revocationReason.trim() || undefined,
      });

      toast.success("Active editing permission has been revoked.");
      setIsRevokeOpen(false);
      setRevocationReason("");

      // Refresh list and modal
      await fetchRequests(false);
      await handleOpenReview(activeRequest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke amendment permission";
      toast.error(msg);
    } finally {
      setIsSubmittingRevoke(false);
    }
  };

  // Metrics counts
  const kpiStats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending").length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const completed = requests.filter((r) => r.status === "completed").length;
    const rejected = requests.filter((r) => r.status === "rejected").length;
    return { pending, approved, completed, rejected };
  }, [requests]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Status filter
      if (statusFilter !== "all" && req.status !== statusFilter) {
        return false;
      }
      // Quarter filter
      if (quarterFilter !== "all" && String(req.quarter) !== quarterFilter) {
        return false;
      }
      // Record type filter
      if (recordTypeFilter !== "all" && req.recordType !== recordTypeFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = req.requestNumber?.toLowerCase().includes(q);
        const studentMatch = req.studentName?.toLowerCase().includes(q);
        const lrnMatch = String(req.studentLrn ?? "").toLowerCase().includes(q);
        const requesterMatch = req.requesterName?.toLowerCase().includes(q);
        const subjectMatch = req.subjectName?.toLowerCase().includes(q);
        const sectionMatch = req.section?.toLowerCase().includes(q);

        if (
          !numMatch &&
          !studentMatch &&
          !lrnMatch &&
          !requesterMatch &&
          !subjectMatch &&
          !sectionMatch
        ) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, quarterFilter, recordTypeFilter, searchQuery]);

  return (
    <PageShell className="amendments-page">
      <PageHeader
        title={isFacultyWorkspace || (isTeacher && !canReview) ? "My Amendments" : "Record Amendments"}
        description={
          isFacultyWorkspace || (isTeacher && !canReview)
            ? "Track the status of your submitted grade and attendance amendment requests."
            : "Review, approve, or reject formal faculty requests to modify locked quarterly records."
        }
        actions={
          <button
            type="button"
            onClick={() => fetchRequests(false)}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FiRefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        }
      />

      {/* KPI Metric Cards */}
      <div className="amendments-kpis">
        <div className="amendments-kpi">
          <div className="amendments-kpi__icon amendments-kpi__icon--pending">
            <FiClock aria-hidden="true" />
          </div>
          <div className="amendments-kpi__content">
            <div className="amendments-kpi__label">Pending Review</div>
            <div className="amendments-kpi__val">{kpiStats.pending}</div>
          </div>
        </div>

        <div className="amendments-kpi">
          <div className="amendments-kpi__icon amendments-kpi__icon--approved">
            <FiCheckCircle aria-hidden="true" />
          </div>
          <div className="amendments-kpi__content">
            <div className="amendments-kpi__label">Approved Active</div>
            <div className="amendments-kpi__val">{kpiStats.approved}</div>
          </div>
        </div>

        <div className="amendments-kpi">
          <div className="amendments-kpi__icon amendments-kpi__icon--completed">
            <FiLayers aria-hidden="true" />
          </div>
          <div className="amendments-kpi__content">
            <div className="amendments-kpi__label">Completed Edits</div>
            <div className="amendments-kpi__val">{kpiStats.completed}</div>
          </div>
        </div>

        <div className="amendments-kpi">
          <div className="amendments-kpi__icon amendments-kpi__icon--rejected">
            <FiSlash aria-hidden="true" />
          </div>
          <div className="amendments-kpi__content">
            <div className="amendments-kpi__label">Rejected</div>
            <div className="amendments-kpi__val">{kpiStats.rejected}</div>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <PageSection
        title={
          <div className="flex items-center gap-2">
            <span>Amendment Requests</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {filteredRequests.length}
            </span>
          </div>
        }
      >
        {/* Filters and Search Bar */}
        <div className="mb-4 space-y-3">
          {/* Status Tabs */}
          <div className="amendments-tabs">
            {(
              [
                { key: "all", label: "All" },
                { key: "pending", label: "Pending" },
                { key: "approved", label: "Approved" },
                { key: "rejected", label: "Rejected" },
                { key: "completed", label: "Completed" },
                { key: "revoked", label: "Revoked" },
              ] as const
            ).map((tab) => {
              const count =
                tab.key === "all"
                  ? requests.length
                  : requests.filter((r) => r.status === tab.key).length;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`amendments-tab ${
                    statusFilter === tab.key ? "amendments-tab--active" : ""
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="amendments-tab__count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Quarter, Record Type, and Search Controls */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Quarter Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <FiCalendar className="text-slate-400" aria-hidden="true" />
                <select
                  value={quarterFilter}
                  onChange={(e) => setQuarterFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  aria-label="Filter by Quarter"
                >
                  <option value="all">All Quarters</option>
                  <option value="1">Quarter 1</option>
                  <option value="2">Quarter 2</option>
                  <option value="3">Quarter 3</option>
                  <option value="4">Quarter 4</option>
                </select>
              </div>

              {/* Record Type Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <FiFilter className="text-slate-400" aria-hidden="true" />
                <select
                  value={recordTypeFilter}
                  onChange={(e) => setRecordTypeFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  aria-label="Filter by Record Type"
                >
                  <option value="all">All Record Types</option>
                  <option value="gradebook_score">Gradebook Score</option>
                  <option value="student_record_grade">Student Record Grade</option>
                  <option value="attendance">Daily Attendance</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <FiSearch
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, LRN, teacher, AMD-..."
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="amendments-table-wrapper">
          <table className="amendments-table">
            <thead>
              <tr>
                <th>Request #</th>
                <th>Requester</th>
                <th>Student</th>
                <th>Target & Scope</th>
                <th>Requested At</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FiRefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
                      <span className="text-xs font-medium">Loading amendment requests…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FiFileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No amendment requests found
                      </p>
                      <p className="text-xs text-slate-400">
                        {searchQuery || statusFilter !== "all" || quarterFilter !== "all" || recordTypeFilter !== "all"
                          ? "No requests match the selected search and filter criteria."
                          : "There are currently no record amendment requests in the system."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {req.requestNumber}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {req.requesterName || `Faculty #${req.requesterFacultyId}`}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Teacher
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {req.studentName || `Student #${req.enrollmentId}`}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          LRN: {req.studentLrn || "—"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {req.subjectName || "Quarter Final Grade"}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {req.section ? `Grade ${req.gradeLevel ?? ""} - ${req.section} · ` : ""}
                          Q{req.quarter} · {getAmendmentRecordTypeLabel(req.recordType)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {formatDateTime(req.created_at)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`amendment-badge ${getAmendmentStatusBadgeClass(
                          req.status
                        )}`}
                      >
                        {getAmendmentStatusLabel(req.status)}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenReview(req)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                      >
                        <FiEye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{canReview && req.status === "pending" ? "Review" : "View"}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      {/* Review Modal Dialog */}
      {activeRequest && (
        <ModalDialog
          open={Boolean(activeRequest)}
          onClose={handleCloseReview}
          labelledById={reviewModalTitleId}
          className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between border-b border-slate-100 p-6 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <FiFileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    id={reviewModalTitleId}
                    className="text-lg font-semibold text-slate-900 dark:text-white"
                  >
                    {activeRequest.requestNumber}
                  </h3>
                  <span
                    className={`amendment-badge ${getAmendmentStatusBadgeClass(
                      activeRequest.status
                    )}`}
                  >
                    {getAmendmentStatusLabel(activeRequest.status)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Requested on {formatDateTime(activeRequest.created_at)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseReview}
              aria-label="Close dialog"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <FiX className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
            {/* Metadata Card */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/40">
              <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  Requester (Faculty):
                </span>
                <p className="font-medium text-slate-900 dark:text-white">
                  {activeRequest.requesterName || `Faculty #${activeRequest.requesterFacultyId}`}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  Student Name:
                </span>
                <p className="font-medium text-slate-900 dark:text-white">
                  {activeRequest.studentName || `Student #${activeRequest.enrollmentId}`}
                  <span className="ml-1 text-[11px] text-slate-400 font-mono">
                    (LRN: {activeRequest.studentLrn || "—"})
                  </span>
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  Class & Section:
                </span>
                <p className="font-medium text-slate-900 dark:text-white">
                  {activeRequest.section
                    ? `Grade ${activeRequest.gradeLevel ?? ""} - ${activeRequest.section}`
                    : "Assigned Class"}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  Subject & Quarter:
                </span>
                <p className="font-medium text-slate-900 dark:text-white">
                  {activeRequest.subjectName || "General / Final Grade"} · Quarter {activeRequest.quarter}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  Record Type:
                </span>
                <p className="font-medium text-slate-900 dark:text-white">
                  {getAmendmentRecordTypeLabel(activeRequest.recordType)}
                </p>
              </div>

              {activeRequest.reviewerName && (
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    Reviewed By:
                  </span>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {activeRequest.reviewerName}
                    {activeRequest.reviewedAt && (
                      <span className="block text-[11px] text-slate-400">
                        {formatDateTime(activeRequest.reviewedAt)}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Justification Reason */}
            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Teacher's Justification / Reason
              </h4>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                <p className="whitespace-pre-wrap leading-relaxed">{activeRequest.reason}</p>
              </div>
            </div>

            {/* Rejection Notice if Rejected */}
            {activeRequest.status === "rejected" && activeRequest.rejectionReason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <FiAlertCircle className="h-4 w-4" />
                  <span>Rejection Reason:</span>
                </div>
                <p className="whitespace-pre-wrap">{activeRequest.rejectionReason}</p>
              </div>
            )}

            {/* Comparison View (Diff) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Value Comparison (Diff)
                </h4>
                {extractDiffDisplay(activeRequest).contextNote && (
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {extractDiffDisplay(activeRequest).contextNote}
                  </span>
                )}
              </div>

              <div className="amendment-diff-container">
                <div className="amendment-diff-box amendment-diff-box--current">
                  <div className="amendment-diff-label">Current Value</div>
                  <div className="amendment-diff-value">
                    {extractDiffDisplay(activeRequest).currentDisplay}
                  </div>
                </div>

                <div className="amendment-diff-arrow">
                  <FiArrowRight />
                </div>

                <div className="amendment-diff-box amendment-diff-box--proposed">
                  <div className="amendment-diff-label">Proposed Value</div>
                  <div className="amendment-diff-value">
                    {extractDiffDisplay(activeRequest).proposedDisplay}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Permission Status (if approved or permission attached) */}
            {activeRequest.permission && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiClock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">
                      Permission Status:{" "}
                      <span className="uppercase">{activeRequest.permission.status}</span>
                    </span>
                  </div>
                  {activeRequest.permission.status === "active" && (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatRemainingTime(activeRequest.permission.expiresAt).text}
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-emerald-800 dark:text-emerald-300 border-t border-emerald-200/60 pt-2 dark:border-emerald-800/40">
                  <div>
                    <span className="font-semibold">Expires: </span>
                    {formatDateTime(activeRequest.permission.expiresAt)}
                  </div>
                  {activeRequest.permission.consumedAt && (
                    <div>
                      <span className="font-semibold">Consumed: </span>
                      {formatDateTime(activeRequest.permission.consumedAt)}
                    </div>
                  )}
                </div>

                {canReview && activeRequest.permission.status === "active" && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsRevokeOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-slate-700"
                    >
                      <FiSlash className="h-3.5 w-3.5" />
                      <span>Revoke Permission</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Audit Log History Section */}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Audit Trail History
              </h4>

              {loadingAudit ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  <FiRefreshCw className="inline-block mr-1 h-3.5 w-3.5 animate-spin" />
                  Loading audit events…
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                  No audit log events recorded for this request yet.
                </div>
              ) : (
                <div className="amendments-audit-list">
                  {auditLogs.map((log) => {
                    const dotClass =
                      log.action === "approved"
                        ? "amendments-audit-dot--approved"
                        : log.action === "rejected"
                        ? "amendments-audit-dot--rejected"
                        : log.action === "revoked"
                        ? "amendments-audit-dot--revoked"
                        : log.action === "modified"
                        ? "amendments-audit-dot--modified"
                        : "amendments-audit-dot--requested";

                    return (
                      <div key={log.id} className="amendments-audit-item">
                        <div className={`amendments-audit-dot ${dotClass}`} />
                        <div className="text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white capitalize">
                              {log.action}
                            </span>
                            <span className="text-[11px] text-slate-400">·</span>
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {log.actorName || `User #${log.actorUserId}`} ({log.actorRole})
                            </span>
                            <span className="text-[11px] text-slate-400">·</span>
                            <span className="text-[11px] text-slate-400">
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>

                          {log.reason && (
                            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 italic">
                              "{log.reason}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 p-4 px-6 dark:border-slate-800 dark:bg-slate-800/40">
            <button
              type="button"
              onClick={handleCloseReview}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Close
            </button>

            {canReview && activeRequest.status === "pending" && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRejectOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-slate-700"
                >
                  <FiXCircle className="h-4 w-4" />
                  <span>Reject</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsApproveOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none dark:bg-emerald-700 dark:hover:bg-emerald-600"
                >
                  <FiCheckCircle className="h-4 w-4" />
                  <span>Approve Amendment</span>
                </button>
              </div>
            )}
          </div>
        </ModalDialog>
      )}

      {/* Approval Confirmation Dialog */}
      {isApproveOpen && activeRequest && (
        <ModalDialog
          open={isApproveOpen}
          onClose={() => !isSubmittingApprove && setIsApproveOpen(false)}
          lockClose={isSubmittingApprove}
          labelledById={approveDialogTitleId}
          className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <FiCheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id={approveDialogTitleId}
                  className="text-base font-semibold text-slate-900 dark:text-white"
                >
                  Approve Amendment Request
                </h3>
                <p className="text-xs text-slate-500">
                  Grant a temporary editing window for {activeRequest.requestNumber}.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Editing Window Duration
                </label>
                <select
                  value={approveDurationHours}
                  onChange={(e) => setApproveDurationHours(Number(e.target.value))}
                  disabled={isSubmittingApprove}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours (Default Standard)</option>
                  <option value={48}>48 Hours (2 Days)</option>
                  <option value={72}>72 Hours (3 Days)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  The teacher will be authorized to update only this single student's record during this window.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reviewer Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={approveReviewNotes}
                  onChange={(e) => setApproveReviewNotes(e.target.value)}
                  placeholder="Optional approval notes for the audit trail..."
                  disabled={isSubmittingApprove}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsApproveOpen(false)}
                disabled={isSubmittingApprove}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isSubmittingApprove}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmittingApprove ? "Approving…" : "Confirm Approval"}
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Rejection Confirmation Dialog */}
      {isRejectOpen && activeRequest && (
        <ModalDialog
          open={isRejectOpen}
          onClose={() => !isSubmittingReject && setIsRejectOpen(false)}
          lockClose={isSubmittingReject}
          labelledById={rejectDialogTitleId}
          className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <FiAlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id={rejectDialogTitleId}
                  className="text-base font-semibold text-slate-900 dark:text-white"
                >
                  Reject Amendment Request
                </h3>
                <p className="text-xs text-slate-500">
                  Please provide a mandatory explanation for rejecting this request.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this amendment request is being rejected..."
                disabled={isSubmittingReject}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <p className="text-[11px] text-slate-500">
                This note will be recorded permanently in the audit trail and visible to the requesting faculty member.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRejectOpen(false)}
                disabled={isSubmittingReject}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject || !rejectionReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {isSubmittingReject ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Revocation Confirmation Dialog */}
      {isRevokeOpen && activeRequest && (
        <ModalDialog
          open={isRevokeOpen}
          onClose={() => !isSubmittingRevoke && setIsRevokeOpen(false)}
          lockClose={isSubmittingRevoke}
          labelledById={revokeDialogTitleId}
          className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <FiSlash className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id={revokeDialogTitleId}
                  className="text-base font-semibold text-slate-900 dark:text-white"
                >
                  Revoke Active Permission
                </h3>
                <p className="text-xs text-slate-500">
                  Immediately void the unconsumed editing permission for {activeRequest.requestNumber}.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Revocation Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                placeholder="Reason for revoking permission before expiration..."
                disabled={isSubmittingRevoke}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRevokeOpen(false)}
                disabled={isSubmittingRevoke}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isSubmittingRevoke}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {isSubmittingRevoke ? "Revoking…" : "Confirm Revocation"}
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </PageShell>
  );
}
