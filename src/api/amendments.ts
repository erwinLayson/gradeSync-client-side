import { getAPICall, postAPICall, patchAPICall, type RequestOptions } from './api';
import type {
  AmendmentAuditLog,
  AmendmentPermission,
  AmendmentRequest,
  SubmitAmendmentPayload,
} from '../constant/amendment';

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Submit a new amendment request (teacher / class adviser)
 * Default options: { toast: false } to prevent duplicate toasts since
 * RequestAmendmentModal explicitly presents its own success toast.
 */
export const submitAmendmentRequest = async (
  data: SubmitAmendmentPayload,
  options?: RequestOptions,
) => {
  const payload = {
    ...data,
    classId: data.classroomId,
    details: data.details ?? {
      studentId: data.studentId,
      currentValues: data.currentValues ?? null,
      proposedValues: data.proposedValues ?? null,
    },
  };
  return postAPICall<typeof payload, AmendmentRequest>('/amendments', payload, {
    toast: false,
    ...options,
  });
};

/**
 * Fetch amendment requests initiated by the authenticated faculty member
 */
export const getMyAmendmentRequests = async (params?: {
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const qs = buildQueryString(params);
  return getAPICall<AmendmentRequest[]>(`/amendments/my-requests${qs}`);
};

/**
 * Fetch all amendment requests (Registrar and Admin review)
 */
export const getAllAmendmentRequests = async (params?: {
  status?: string;
  facultyId?: number;
  quarter?: number;
  recordType?: string;
  page?: number;
  limit?: number;
}) => {
  const qs = buildQueryString(params);
  return getAPICall<AmendmentRequest[]>(`/amendments/requests${qs}`);
};

/**
 * Fetch detailed view of a single amendment request by ID
 */
export const getAmendmentRequestById = async (id: number) => {
  return getAPICall<AmendmentRequest>(`/amendments/requests/${id}`);
};

/**
 * Approve an amendment request and unlock a temporary edit window (Registrar / Admin)
 * Default options: { toast: false } to prevent duplicate toasts since
 * RegisterAmendments explicitly presents its own success toast.
 */
export const approveAmendmentRequest = async (
  id: number,
  data?: { durationHours?: number; reviewNotes?: string },
  options?: RequestOptions,
) => {
  return postAPICall<typeof data, { permission: AmendmentPermission; request: AmendmentRequest }>(
    `/amendments/requests/${id}/approve`,
    data ?? {},
    {
      toast: false,
      ...options,
    },
  );
};

/**
 * Reject an amendment request with justification (Registrar / Admin)
 * Default options: { toast: false } to prevent duplicate toasts since
 * RegisterAmendments explicitly presents its own success toast.
 */
export const rejectAmendmentRequest = async (
  id: number,
  data: { rejectionReason: string },
  options?: RequestOptions,
) => {
  const payload = {
    reason: data.rejectionReason,
    rejectionReason: data.rejectionReason,
  };
  return postAPICall<typeof payload, AmendmentRequest>(
    `/amendments/requests/${id}/reject`,
    payload,
    {
      toast: false,
      ...options,
    },
  );
};

/**
 * Revoke an active amendment permission before expiration (Registrar / Admin)
 * Default options: { toast: false } to prevent duplicate toasts since
 * RegisterAmendments explicitly presents its own success toast.
 */
export const revokeAmendmentPermission = async (
  id: number,
  data?: { reason?: string },
  options?: RequestOptions,
) => {
  return postAPICall<typeof data, { revoked: boolean }>(
    `/amendments/requests/${id}/revoke`,
    data ?? {},
    {
      toast: false,
      ...options,
    },
  );
};

/**
 * Fetch system amendment audit trail logs with filtering
 */
export const getAmendmentAuditLogs = async (params?: {
  requestId?: number;
  facultyId?: number;
  enrollmentId?: number;
  action?: string;
  page?: number;
  limit?: number;
}) => {
  const qs = buildQueryString(params);
  return getAPICall<AmendmentAuditLog[]>(`/amendments/audit-logs${qs}`);
};

/**
 * Patch a single student's assessment score under an approved amendment permission
 * Default options: { toast: false } to prevent duplicate toasts since
 * FacultyGradebook explicitly presents its own success toast.
 */
export const patchSingleStudentScore = async (
  assessmentId: number,
  enrollmentId: number,
  data: { score: number; reason?: string },
  options?: RequestOptions,
) => {
  return patchAPICall<typeof data, { assessmentId: number; enrollmentId: number; score: number }>(
    `/assessments/${assessmentId}/scores/${enrollmentId}`,
    data,
    {
      toast: false,
      ...options,
    },
  );
};

/**
 * Patch a single student's daily attendance under an approved amendment permission
 * Default options: { toast: false } to prevent duplicate toasts since
 * FacultyAttendance explicitly presents its own success toast.
 */
export const patchSingleStudentAttendance = async (
  classSubjectId: number,
  enrollmentId: number,
  data: { date: string; status: string; quarter: number; reason?: string },
  options?: RequestOptions,
) => {
  return patchAPICall<typeof data, { classSubjectId: number; enrollmentId: number; status: string }>(
    `/attendance/class-subjects/${classSubjectId}/students/${enrollmentId}`,
    data,
    {
      toast: false,
      ...options,
    },
  );
};

/**
 * Submit a unified subject amendment request (covering gradebook and/or attendance)
 */
export const submitSubjectRecordAmendment = async (
  data: {
    enrollmentId: number;
    classSubjectId: number;
    quarter: number;
    reason: string;
    changes: import('../constant/amendment').SubjectAmendmentChanges;
    classId?: number;
    details?: Record<string, unknown>;
  },
  options?: RequestOptions,
) => {
  return postAPICall<typeof data, { id: number; requestNumber: string }>(
    '/amendments/subject-record',
    data,
    {
      toast: false,
      ...options,
    },
  );
};

/**
 * Apply approved unified subject amendment and recalculate quarter grade
 * Default options: { toast: false } to prevent duplicate toasts since
 * AmendStudentRecordModal explicitly presents its own success toast.
 */
export const applyUnifiedSubjectAmendment = async (
  permissionId: number,
  data?: {
    changes?: {
      gradebook?: Array<{ assessmentId: number; score?: number | string | null; proposedScore?: number | string | null }>;
      attendance?: Array<{ date: string; status?: string; proposedStatus?: string }>;
    };
    markAsCompleted?: boolean;
  },
  options?: RequestOptions,
) => {
  return postAPICall<typeof data, { success: boolean; modifiedCount: number; newQuarterGrade: number | null; status: string }>(
    `/amendments/${permissionId}/apply`,
    data ?? {},
    {
      toast: false,
      ...options,
    },
  );
};
