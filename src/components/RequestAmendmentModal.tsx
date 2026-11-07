import { useState, useEffect, useId, type FormEvent } from 'react';
import { FiFileText, FiX, FiLoader, FiShield } from 'react-icons/fi';
import { ModalDialog } from './ModalDialog';
import { submitAmendmentRequest } from '../api/amendments';
import type {
  AmendmentRecordType,
  AmendmentRequest,
  SubmitAmendmentPayload,
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
  currentValueDisplay,
}: RequestAmendmentModalProps) {
  const [reason, setReason] = useState('');
  const [selectedRecordType, setSelectedRecordType] = useState<AmendmentRecordType>(recordType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const titleId = useId();
  const descId = useId();
  const reasonId = useId();

  // Reset fields whenever dialog opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setSelectedRecordType(recordType);
      setIsSubmitting(false);
      setErrorMessage(null);
    }
  }, [isOpen, recordType]);

  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= 10;
  const canSubmit = !isSubmitting && isReasonValid;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isReasonValid) {
      setErrorMessage('Justification reason must be at least 10 characters long.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: SubmitAmendmentPayload = {
        recordType: selectedRecordType,
        studentId,
        enrollmentId,
        classSubjectId: classSubjectId ?? null,
        classroomId,
        quarter,
        reason: trimmedReason,
        details: {
          studentId,
          studentName,
          studentLrn: String(studentLrn),
          subjectName: subjectName ?? null,
          classSection: classSection ?? null,
          quarter,
          requestedScope: selectedRecordType,
          currentQuarterGrade: currentValueDisplay ?? null,
          reason: trimmedReason,
          requestedAt: new Date().toISOString(),
        },
      };

      const response = await submitAmendmentRequest(payload);

      if (response?.data) {
        toast.success('Amendment request submitted successfully');
        onSuccess?.(response.data);
      }
      onClose();
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
      {/* Header */}
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
              Request temporary authorization to correct locked student records.
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
                <span className="text-slate-400 dark:text-slate-500">Subject:</span>{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {subjectName ?? 'Subject Record'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">Period:</span>{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Quarter {quarter}
                  {classSection ? ` · ${classSection}` : ''}
                </span>
              </div>
              {currentValueDisplay !== undefined && currentValueDisplay !== null && (
                <div className="col-span-2">
                  <span className="text-slate-400 dark:text-slate-500">Current Quarter Grade:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {String(currentValueDisplay)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Scope Authorization Information */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-2.5 dark:border-slate-800 dark:bg-slate-850">
            <label className="block font-semibold text-slate-800 dark:text-slate-200">
              Requested Authorization Scope
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label
                className={`flex cursor-pointer items-center justify-center rounded-lg border p-2.5 text-center text-xs font-semibold transition ${
                  selectedRecordType === 'subject_record'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="recordScope"
                  value="subject_record"
                  checked={selectedRecordType === 'subject_record'}
                  onChange={() => setSelectedRecordType('subject_record')}
                  className="sr-only"
                />
                Both (Grades & Attendance)
              </label>

              <label
                className={`flex cursor-pointer items-center justify-center rounded-lg border p-2.5 text-center text-xs font-semibold transition ${
                  selectedRecordType === 'gradebook_score'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="recordScope"
                  value="gradebook_score"
                  checked={selectedRecordType === 'gradebook_score'}
                  onChange={() => setSelectedRecordType('gradebook_score')}
                  className="sr-only"
                />
                Gradebook Only
              </label>

              <label
                className={`flex cursor-pointer items-center justify-center rounded-lg border p-2.5 text-center text-xs font-semibold transition ${
                  selectedRecordType === 'attendance'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="recordScope"
                  value="attendance"
                  checked={selectedRecordType === 'attendance'}
                  onChange={() => setSelectedRecordType('attendance')}
                  className="sr-only"
                />
                Attendance Only
              </label>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Upon approval, you can freely edit the authorized records for this student and quarter. All modifications are automatically tracked with before-and-after audit entries.
            </p>
          </div>

          {/* Reason / Justification Field */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor={reasonId}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Detailed Justification / Reason <span className="text-rose-500">*</span>
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
              placeholder="Explain why this student's records require modification (e.g., encoded score clerical error, excused absence medical certificate submitted late)..."
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

          {/* Automatic Audit Notice */}
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50/60 p-2.5 text-[11px] leading-relaxed text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <FiShield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              You do not need to declare individual score or attendance changes now. Once approved by the registrar, you can correct the records and GradeSync will automatically audit each change.
            </span>
          </div>
        </div>

        {/* Dialog Actions */}
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
