import { getAPICall, postAPICall, patchAPICall } from './api';
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
 */
export const submitAmendmentRequest = async (data: SubmitAmendmentPayload) => {
  const payload = {
    ...data,
    classId: data.classroomId,
    details: data.details ?? {
      studentId: data.studentId,
      currentValues: data.currentValues ?? null,
      proposedValues: data.proposedValues ?? null,
    },
  };
  return postAPICall<typeof payload, AmendmentRequest>('/amendments', payload);
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
 */
export const approveAmendmentRequest = async (
  id: number,
  data?: { durationHours?: number; reviewNotes?: string },
) => {
  return postAPICall<typeof data, { permission: AmendmentPermission; request: AmendmentRequest }>(
    `/amendments/requests/${id}/approve`,
    data ?? {},
  );
};

/**
 * Reject an amendment request with justification (Registrar / Admin)
 */
export const rejectAmendmentRequest = async (
  id: number,
  data: { rejectionReason: string },
) => {
  const payload = {
    reason: data.rejectionReason,
    rejectionReason: data.rejectionReason,
  };
  return postAPICall<typeof payload, AmendmentRequest>(
    `/amendments/requests/${id}/reject`,
    payload,
  );
};

/**
 * Revoke an active amendment permission before expiration (Registrar / Admin)
 */
export const revokeAmendmentPermission = async (
  id: number,
  data?: { reason?: string },
) => {
  return postAPICall<typeof data, { revoked: boolean }>(
    `/amendments/requests/${id}/revoke`,
    data ?? {},
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
 */
export const patchSingleStudentScore = async (
  assessmentId: number,
  enrollmentId: number,
  data: { score: number; reason?: string },
) => {
  return patchAPICall<typeof data, { assessmentId: number; enrollmentId: number; score: number }>(
    `/assessments/${assessmentId}/scores/${enrollmentId}`,
    data,
  );
};

/**
 * Patch a single student's daily attendance under an approved amendment permission
 */
export const patchSingleStudentAttendance = async (
  classSubjectId: number,
  enrollmentId: number,
  data: { date: string; status: string; quarter: number; reason?: string },
) => {
  return patchAPICall<typeof data, { classSubjectId: number; enrollmentId: number; status: string }>(
    `/attendance/class-subjects/${classSubjectId}/students/${enrollmentId}`,
    data,
  );
};
