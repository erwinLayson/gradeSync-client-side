export type AmendmentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'expired'
  | 'revoked';

export type AmendmentRecordType =
  | 'gradebook_score'
  | 'student_record_grade'
  | 'attendance';

export type AmendmentAction =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'modified'
  | 'expired';

export type AmendmentPermissionStatus =
  | 'active'
  | 'consumed'
  | 'revoked'
  | 'expired';

export interface AmendmentRequestDetails {
  assessmentId?: number | null;
  assessmentTitle?: string | null;
  attendanceDate?: string | null;
  currentValue?: number | string | null;
  proposedValue?: number | string | null;
  currentValues?: Record<string, unknown> | null;
  proposedValues?: Record<string, unknown> | null;
  studentId?: number;
  [key: string]: unknown;
}

export interface AmendmentRequest {
  id: number;
  requestNumber: string;
  requesterFacultyId: number;
  requesterName?: string;
  enrollmentId: number;
  studentName?: string;
  studentLrn?: string | number;
  classSubjectId?: number | null;
  subjectName?: string | null;
  classId: number;
  classroomId?: number;
  section?: string;
  gradeLevel?: number;
  quarter: number;
  recordType: AmendmentRecordType;
  reason: string;
  details: string | AmendmentRequestDetails;
  status: AmendmentStatus;
  reviewerUserId?: number | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  completedAt?: string | null;
  created_at: string;
  updated_at?: string;
  permission?: AmendmentPermission | null;
  auditLogs?: AmendmentAuditLog[];
}

export interface AmendmentPermission {
  id: number;
  requestId: number;
  facultyId: number;
  enrollmentId: number;
  classSubjectId?: number | null;
  classId: number;
  quarter: number;
  recordType: AmendmentRecordType;
  assessmentId?: number | null;
  attendanceDate?: string | null;
  status: AmendmentPermissionStatus;
  expiresAt: string;
  consumedAt?: string | null;
  created_at: string;
}

export interface AmendmentAuditLog {
  id: number;
  requestId?: number | null;
  action: AmendmentAction | string;
  actorUserId: number;
  actorName?: string;
  actorRole: string;
  recordType: AmendmentRecordType;
  enrollmentId: number;
  quarter: number;
  targetTable: string;
  targetRecordId: string;
  beforeState?: string | null;
  afterState?: string | null;
  diff?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  created_at: string;
}

export interface SubmitAmendmentPayload {
  recordType: AmendmentRecordType;
  studentId: number;
  enrollmentId: number;
  classSubjectId?: number | null;
  classroomId: number;
  quarter: number;
  currentValues?: Record<string, unknown> | null;
  proposedValues?: Record<string, unknown> | null;
  reason: string;
  details?: Record<string, unknown> | null;
}

export const AMENDMENT_STATUS_LABELS: Record<AmendmentStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved (Active)',
  rejected: 'Rejected',
  completed: 'Completed',
  expired: 'Expired',
  revoked: 'Revoked',
};

export const AMENDMENT_STATUS_BADGE_CLASSES: Record<AmendmentStatus, string> = {
  pending:
    'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  approved:
    'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
  rejected:
    'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
  completed:
    'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
  expired:
    'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  revoked:
    'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
};

export const AMENDMENT_RECORD_TYPE_LABELS: Record<AmendmentRecordType, string> = {
  gradebook_score: 'Gradebook Assessment Score',
  student_record_grade: 'Student Record Quarterly Grade',
  attendance: 'Daily Attendance Record',
};

export function getAmendmentStatusLabel(status?: AmendmentStatus | string | null): string {
  if (!status) return 'Unknown';
  if (status in AMENDMENT_STATUS_LABELS) {
    return AMENDMENT_STATUS_LABELS[status as AmendmentStatus];
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getAmendmentStatusBadgeClass(status?: AmendmentStatus | string | null): string {
  if (!status || !(status in AMENDMENT_STATUS_BADGE_CLASSES)) {
    return 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
  return AMENDMENT_STATUS_BADGE_CLASSES[status as AmendmentStatus];
}

export function getAmendmentRecordTypeLabel(recordType?: AmendmentRecordType | string | null): string {
  if (!recordType) return 'Amendment';
  if (recordType in AMENDMENT_RECORD_TYPE_LABELS) {
    return AMENDMENT_RECORD_TYPE_LABELS[recordType as AmendmentRecordType];
  }
  return recordType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
