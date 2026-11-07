import { useState, useEffect, useId, type FormEvent } from 'react';
import { FiFileText, FiX, FiInfo, FiLoader, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { ModalDialog } from './ModalDialog';
import { submitAmendmentRequest, submitSubjectRecordAmendment } from '../api/amendments';
import {
  getAmendmentRecordTypeLabel,
  type AmendmentRecordType,
  type AmendmentRequest,
  type SubmitAmendmentPayload,
  type SubjectAmendmentChanges,
} from '../constant/amendment';
import { toast } from '../helper/toast';

export interface RequestAmendmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (request: AmendmentRequest) => void;
  recordType: AmendmentRecordType;
  studentId: number;
  studentName: string;
  studentLrn: string | number;
  enrollmentId: number;
  classSubjectId?: number | null;
  subjectName?: string | null;
  classroomId: number;
  classSection?: string | null;
  quarter: number;
  assessmentId?: number | null;
  assessmentTitle?: string | null;
  currentValueDisplay?: string | number | null;
  proposedValueLabel?: string;
  proposedValuePlaceholder?: string;
}

export function RequestAmendmentModal({
  isOpen,
  onClose,
  onSuccess,
  recordType,
  studentId,
  studentName,
  studentLrn,
  enrollmentId,
  classSubjectId,
  subjectName,
  classroomId,
  classSection,
  quarter,
  assessmentId,
  assessmentTitle,
  currentValueDisplay,
  proposedValueLabel,
  proposedValuePlaceholder,
}: RequestAmendmentModalProps) {
  const [proposedValue, setProposedValue] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subject Record Unified Fields
  const [includeScore, setIncludeScore] = useState(true);
  const [assessmentName, setAssessmentName] = useState(assessmentTitle ?? '');
  const [proposedScore, setProposedScore] = useState('');
  const [includeAttendance, setIncludeAttendance] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [proposedAttendanceStatus, setProposedAttendanceStatus] = useState('present');

  const titleId = useId();
  const descId = useId();
  const proposedValId = useId();
  const reasonId = useId();

  // Reset fields whenever dialog opens
  useEffect(() => {
    if (isOpen) {
      setProposedValue('');
      setReason('');
      setIsSubmitting(false);
      setErrorMessage(null);
      setIncludeScore(true);
      setAssessmentName(assessmentTitle ?? '');
      setProposedScore('');
      setIncludeAttendance(false);
      setAttendanceDate(new Date().toISOString().slice(0, 10));
      setProposedAttendanceStatus('present');
    }
  }, [isOpen, assessmentTitle]);

  const trimmedReason = reason.trim();
  const trimmedValue = proposedValue.trim();
  const isReasonValid = trimmedReason.length >= 10;
  
  const isSubjectRecord = recordType === 'subject_record';
  const hasSubjectTarget = isSubjectRecord
    ? (includeScore && proposedScore.trim().length > 0) || (includeAttendance && attendanceDate.trim().length > 0) || trimmedValue.length > 0
    : trimmedValue.length > 0;
  const canSubmit = !isSubmitting && hasSubjectTarget && isReasonValid;

  const defaultProposedLabel =
    recordType === 'attendance'
      ? 'Proposed Attendance Status'
      : recordType === 'gradebook_score'
      ? 'Proposed Assessment Score'
      : 'Proposed Grade';

  const defaultProposedPlaceholder =
    recordType === 'attendance'
      ? 'e.g. Present, Absent, Excused'
      : recordType === 'gradebook_score'
      ? 'e.g. 95'
      : 'e.g. 88';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!hasSubjectTarget) {
      setErrorMessage(
        isSubjectRecord
          ? 'Please specify at least one proposed gradebook score or attendance modification.'
          : 'Please enter the proposed value.'
      );
      return;
    }

    if (!isReasonValid) {
      setErrorMessage('Justification reason must be at least 10 characters long.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isSubjectRecord && classSubjectId) {
        const changes: SubjectAmendmentChanges = {};
        if (includeScore && (proposedScore.trim() || trimmedValue)) {
          changes.gradebook = [
            {
              assessmentId: assessmentId || 0,
              assessmentTitle: assessmentName.trim() || assessmentTitle || 'Assessment Score',
              currentScore: typeof currentValueDisplay === 'number' ? currentValueDisplay : null,
              proposedScore: Number(proposedScore.trim() || trimmedValue),
            },
          ];
        }
        if (includeAttendance && attendanceDate.trim()) {
          changes.attendance = [
            {
              date: attendanceDate.trim(),
              proposedStatus: proposedAttendanceStatus,
            },
          ];
        }

        const response = await submitSubjectRecordAmendment({
          enrollmentId,
          classSubjectId,
          classId: classroomId,
          quarter,
          reason: trimmedReason,
          changes,
          details: {
            studentId,
            studentName,
            studentLrn: String(studentLrn),
            subjectName: subjectName ?? null,
            currentValue: currentValueDisplay ?? null,
            proposedValue: proposedScore || trimmedValue,
          },
        });

        if (response?.data) {
          toast.success('Subject amendment request submitted successfully');
          onSuccess?.(response.data as any);
        }
        onClose();
      } else {
        const payload: SubmitAmendmentPayload = {
          recordType,
          studentId,
          enrollmentId,
          classSubjectId: classSubjectId ?? null,
          classroomId,
          quarter,
          currentValues:
            currentValueDisplay !== undefined && currentValueDisplay !== null
              ? { value: currentValueDisplay }
              : null,
          proposedValues: { value: trimmedValue },
          reason: trimmedReason,
          details: {
            studentId,
            studentName,
            studentLrn: String(studentLrn),
            assessmentId: assessmentId ?? null,
            assessmentTitle: assessmentTitle ?? null,
            currentValue: currentValueDisplay ?? null,
            proposedValue: trimmedValue,
          },
        };

        const response = await submitAmendmentRequest(payload);

        if (response?.data) {
          toast.success('Amendment request submitted successfully');
          onSuccess?.(response.data);
        }
        onClose();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to submit amendment request';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      lockClose={isSubmitting}
      scrollable
      labelledById={titleId}
      describedById={descId}
      className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header (stays visible; the form body below scrolls) */}
      <div className="flex shrink-0 items-start justify-between border-b border-slate-100 p-6 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <FiFileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
              Request Record Amendment
            </h3>
            <p id={descId} className="text-xs text-slate-500 dark:text-slate-400">
              Submit a formal request to unlock and amend this locked quarterly record.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <FiX className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <div className="flex-auto space-y-4 overflow-y-auto overscroll-contain p-6">
          {/* Record Context Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {studentName}
              </span>
              <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                LRN: {studentLrn}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <div>
                <span className="text-slate-400 dark:text-slate-500">Record Type:</span>{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {getAmendmentRecordTypeLabel(recordType)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">Period:</span>{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Quarter {quarter}
                  {classSection ? ` · ${classSection}` : ''}
                </span>
              </div>
              {subjectName && (
                <div className="col-span-2">
                  <span className="text-slate-400 dark:text-slate-500">Subject:</span>{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {subjectName}
                  </span>
                </div>
              )}
              {assessmentTitle && (
                <div className="col-span-2">
                  <span className="text-slate-400 dark:text-slate-500">Assessment:</span>{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {assessmentTitle}
                  </span>
                </div>
              )}
              {currentValueDisplay !== undefined && currentValueDisplay !== null && (
                <div className="col-span-2">
                  <span className="text-slate-400 dark:text-slate-500">Current Recorded Value:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {String(currentValueDisplay)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Proposed Value Field or Unified Subject Record Controls */}
          {isSubjectRecord ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/30">
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Modifications Included in this Request:
              </span>

              {/* Assessment Score Option */}
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeScore}
                    onChange={(e) => setIncludeScore(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Modify Gradebook Assessment Score</span>
                </label>

                {includeScore && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Assessment / Component Title
                      </label>
                      <input
                        type="text"
                        value={assessmentName}
                        onChange={(e) => setAssessmentName(e.target.value)}
                        placeholder="e.g. Written Work #2, Quarterly Exam"
                        disabled={isSubmitting}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Proposed Score <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={proposedScore}
                        onChange={(e) => setProposedScore(e.target.value)}
                        placeholder="e.g. 95"
                        disabled={isSubmitting}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Subject Attendance Option */}
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeAttendance}
                    onChange={(e) => setIncludeAttendance(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Modify Subject Attendance Record</span>
                </label>

                {includeAttendance && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Attendance Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        disabled={isSubmitting}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Proposed Status <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={proposedAttendanceStatus}
                        onChange={(e) => setProposedAttendanceStatus(e.target.value)}
                        disabled={isSubmitting}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="excused">Excused</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor={proposedValId}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {proposedValueLabel ?? defaultProposedLabel}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                id={proposedValId}
                type="text"
                required
                value={proposedValue}
                onChange={(e) => setProposedValue(e.target.value)}
                placeholder={proposedValuePlaceholder ?? defaultProposedPlaceholder}
                disabled={isSubmitting}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-emerald-400"
              />
            </div>
          )}

          {/* Reason / Justification Field */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor={reasonId}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Justification & Detailed Reason <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-[11px] ${
                  trimmedReason.length < 10
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {trimmedReason.length}/10 chars min
              </span>
            </div>
            <textarea
              id={reasonId}
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain specifically why this record needs correction (e.g., calculation discrepancy, excused absence medical certificate submission)..."
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-emerald-400"
            />
            {trimmedReason.length > 0 && trimmedReason.length < 10 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Please enter at least 10 characters to explain the justification.
              </p>
            )}
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Compliance Notice */}
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50/60 p-2.5 text-[11px] leading-relaxed text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <FiInfo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Amendment requests require Registrar or Admin review. Once approved, a temporary editing window is issued and changes are permanently logged in the audit trail.
            </span>
          </div>
        </div>

        {/* Dialog Actions (stays visible outside the scrolling body) */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {isSubmitting ? (
              <>
                <FiLoader className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Amendment Request'
            )}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
