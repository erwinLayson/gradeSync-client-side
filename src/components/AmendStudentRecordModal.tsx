import { useEffect, useState, useId } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiLoader,
  FiPlus,
  FiSave,
  FiShield,
  FiX,
} from 'react-icons/fi';
import { ModalDialog } from './ModalDialog';
import { TabNav } from './TabNav';
import { getSubjectStudentAmendData } from '../api/studentRecord';
import { applyUnifiedSubjectAmendment } from '../api/amendments';
import { toast } from '../helper/toast';
import type { SubjectStudentAmendData } from '../constant/studentRecord';

export interface AmendStudentRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classSubjectId: number;
  enrollmentId: number;
  quarter: number;
  permissionId: number;
  studentName?: string;
  subjectName?: string;
}

export function AmendStudentRecordModal({
  isOpen,
  onClose,
  onSuccess,
  classSubjectId,
  enrollmentId,
  quarter,
  permissionId,
  studentName,
  subjectName,
}: AmendStudentRecordModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubjectStudentAmendData | null>(null);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [newAttendanceDate, setNewAttendanceDate] = useState('');
  const [newAttendanceStatus, setNewAttendanceStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [activeTab, setActiveTab] = useState<'grades' | 'attendance'>('grades');
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const titleId = useId();

  // Load student amendment data
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);

    async function loadData() {
      try {
        const res = await getSubjectStudentAmendData(classSubjectId, enrollmentId, quarter);
        if (!cancelled && res.data) {
          setData(res.data);

          // Populate initial scores
          const initialScores: Record<number, string> = {};
          for (const a of res.data.assessments) {
            initialScores[a.id] = a.currentScore !== null ? String(a.currentScore) : '';
          }
          setScores(initialScores);

          // Populate initial attendance
          const initialAttendance: Record<string, string> = {};
          for (const att of res.data.attendance) {
            initialAttendance[att.date] = att.status;
          }
          setAttendance(initialAttendance);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load amendment data');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, classSubjectId, enrollmentId, quarter]);

  if (!isOpen) return null;

  // Compute modified fields
  const changedAssessments: Array<{ assessmentId: number; score: number }> = [];
  if (data?.assessments) {
    for (const a of data.assessments) {
      const userValStr = (scores[a.id] ?? '').trim();
      const userVal = userValStr === '' ? null : Number(userValStr);
      if (userVal !== null && !isNaN(userVal) && userVal !== a.currentScore) {
        changedAssessments.push({ assessmentId: a.id, score: userVal });
      }
    }
  }

  const changedAttendance: Array<{ date: string; status: string }> = [];
  if (data?.attendance) {
    const existingDatesMap = new Map(data.attendance.map((a) => [a.date, a.status]));
    for (const [date, status] of Object.entries(attendance)) {
      const origStatus = existingDatesMap.get(date);
      if (!origStatus || origStatus !== status) {
        changedAttendance.push({ date, status });
      }
    }
  }

  const totalModificationsCount = changedAssessments.length + changedAttendance.length;

  const handleAddAttendanceDate = () => {
    if (!newAttendanceDate) {
      toast.error('Please select a valid date');
      return;
    }
    if (attendance[newAttendanceDate]) {
      toast.error('Attendance for this date is already recorded');
      return;
    }
    setAttendance((prev) => ({
      ...prev,
      [newAttendanceDate]: newAttendanceStatus,
    }));
    setNewAttendanceDate('');
  };

  const handleSave = async (markAsCompleted: boolean) => {
    if (markAsCompleted) {
      setIsCompleting(true);
    } else {
      setIsSaving(true);
    }

    try {
      const payload = {
        changes: {
          gradebook: changedAssessments,
          attendance: changedAttendance,
        },
        markAsCompleted,
      };

      const res = await applyUnifiedSubjectAmendment(permissionId, payload);
      if (res.data?.success) {
        if (markAsCompleted) {
          toast.success(
            `Amendment completed! ${res.data.modifiedCount} modification(s) audited and records re-frozen.`
          );
          onSuccess();
          onClose();
        } else {
          toast.success(
            `Saved! ${res.data.modifiedCount} change(s) recorded in the audit trail. Status updated to In Progress.`
          );
          onSuccess();
          // Reload local state to update base values
          const updated = await getSubjectStudentAmendData(classSubjectId, enrollmentId, quarter);
          if (updated.data) {
            setData(updated.data);
          }
        }
      }
    } catch {
      // Error toast is handled by the axios interceptor in api.ts
    } finally {
      setIsSaving(false);
      setIsCompleting(false);
    }
  };

  const writtenWorks = data?.assessments.filter((a) => a.type === 'written_work') ?? [];
  const performanceTasks = data?.assessments.filter((a) => a.type === 'performance_task') ?? [];
  const quarterlyExams = data?.assessments.filter((a) => a.type === 'quarterly_assessment') ?? [];

  return (
    <ModalDialog
      open={isOpen}
      onClose={() => {
        if (!isSaving && !isCompleting) onClose();
      }}
      lockClose={isSaving || isCompleting}
      scrollable
      labelledById={titleId}
      className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between border-b border-slate-100 p-6 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <FiEdit3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
              Amend Student Records
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {studentName ?? data?.student.fullname} &middot; {subjectName ?? data?.classSubject.subjectName} (Q{quarter})
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving || isCompleting}
          aria-label="Close dialog"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <FiX className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FiLoader className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-xs font-semibold">Loading student record items…</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Active Permission Banner */}
          <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/70 px-6 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <FiShield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold">
                Amendment Authorized ({data?.request.requestNumber})
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <FiClock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Permission Active</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-2.5 dark:border-slate-800 dark:bg-slate-850">
              <TabNav<'grades' | 'attendance'>
              size="sm"
              tabs={[
                {
                  id: "grades",
                  label: "Gradebook Assessment Scores",
                  count: changedAssessments.length > 0 ? changedAssessments.length : undefined,
                },
                {
                  id: "attendance",
                  label: "Subject Attendance",
                  count: changedAttendance.length > 0 ? changedAttendance.length : undefined,
                },
              ]}
              activeTab={activeTab}
              onChange={(tabId) => setActiveTab(tabId)}
              ariaLabel="Amendment categories"
            />
          </div>

          {/* Body Content */}
          <div className="flex-auto space-y-6 overflow-y-auto overscroll-contain p-6 text-xs">
            {activeTab === 'grades' && (
              <div className="space-y-5">
                {/* Written Works */}
                <div>
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Written Work Assessments ({writtenWorks.length})
                  </h4>
                  {writtenWorks.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-400">
                      No written work assessments defined for Q{quarter}.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {writtenWorks.map((a) => {
                        const originalScore = a.currentScore;
                        const currentInput = scores[a.id] ?? '';
                        const isChanged =
                          currentInput.trim() !== '' &&
                          Number(currentInput) !== originalScore;

                        return (
                          <div
                            key={a.id}
                            className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${isChanged
                                ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-600 dark:bg-emerald-950/20'
                                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850'
                              }`}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {a.title}
                              </span>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Max Score: {a.maxScore} &middot; Original:{' '}
                                {originalScore !== null ? originalScore : '—'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isChanged && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                  {originalScore ?? '—'} &rarr; {currentInput}
                                </span>
                              )}
                              <input
                                type="number"
                                min={0}
                                max={a.maxScore}
                                value={scores[a.id] ?? ''}
                                onChange={(e) =>
                                  setScores((prev) => ({ ...prev, [a.id]: e.target.value }))
                                }
                                placeholder="Score"
                                className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-center font-mono text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Performance Tasks */}
                <div>
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Performance Tasks ({performanceTasks.length})
                  </h4>
                  {performanceTasks.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-400">
                      No performance tasks defined for Q{quarter}.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {performanceTasks.map((a) => {
                        const originalScore = a.currentScore;
                        const currentInput = scores[a.id] ?? '';
                        const isChanged =
                          currentInput.trim() !== '' &&
                          Number(currentInput) !== originalScore;

                        return (
                          <div
                            key={a.id}
                            className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${isChanged
                                ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-600 dark:bg-emerald-950/20'
                                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850'
                              }`}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {a.title}
                              </span>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Max Score: {a.maxScore} &middot; Original:{' '}
                                {originalScore !== null ? originalScore : '—'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isChanged && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                  {originalScore ?? '—'} &rarr; {currentInput}
                                </span>
                              )}
                              <input
                                type="number"
                                min={0}
                                max={a.maxScore}
                                value={scores[a.id] ?? ''}
                                onChange={(e) =>
                                  setScores((prev) => ({ ...prev, [a.id]: e.target.value }))
                                }
                                placeholder="Score"
                                className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-center font-mono text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quarterly Exam */}
                <div>
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Quarterly Assessment
                  </h4>
                  {quarterlyExams.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-400">
                      No quarterly exam defined for Q{quarter}.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {quarterlyExams.map((a) => {
                        const originalScore = a.currentScore;
                        const currentInput = scores[a.id] ?? '';
                        const isChanged =
                          currentInput.trim() !== '' &&
                          Number(currentInput) !== originalScore;

                        return (
                          <div
                            key={a.id}
                            className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${isChanged
                                ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-600 dark:bg-emerald-950/20'
                                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850'
                              }`}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {a.title}
                              </span>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Max Score: {a.maxScore} &middot; Original:{' '}
                                {originalScore !== null ? originalScore : '—'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isChanged && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                                  {originalScore ?? '—'} &rarr; {currentInput}
                                </span>
                              )}
                              <input
                                type="number"
                                min={0}
                                max={a.maxScore}
                                value={scores[a.id] ?? ''}
                                onChange={(e) =>
                                  setScores((prev) => ({ ...prev, [a.id]: e.target.value }))
                                }
                                placeholder="Score"
                                className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-center font-mono text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'attendance' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Recorded Attendance Dates ({Object.keys(attendance).length})
                  </h4>
                </div>

                {/* Add new date input */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="min-w-[140px] flex-1">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Add Date:
                    </label>
                    <input
                      type="date"
                      value={newAttendanceDate}
                      onChange={(e) => setNewAttendanceDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Status:
                    </label>
                    <select
                      value={newAttendanceStatus}
                      onChange={(e) => setNewAttendanceStatus(e.target.value as 'present' | 'absent' | 'late' | 'excused')}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </div>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleAddAttendanceDate}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <FiPlus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Attendance table */}
                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Original</th>
                        <th className="px-4 py-2.5 text-right">Corrected Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {Object.keys(attendance).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-400">
                            No attendance records recorded yet.
                          </td>
                        </tr>
                      ) : (
                        Object.keys(attendance)
                          .sort()
                          .map((d) => {
                            const originalItem = data?.attendance.find((x) => x.date === d);
                            const orig = originalItem?.status ?? '—';
                            const current = attendance[d];
                            const isChanged = orig !== current;

                            return (
                              <tr
                                key={d}
                                className={
                                  isChanged
                                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                                    : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                                }
                              >
                                <td className="px-4 py-2.5 font-mono font-medium text-slate-800 dark:text-slate-200">
                                  {d}
                                </td>
                                <td className="px-4 py-2.5 capitalize text-slate-500 dark:text-slate-400">
                                  {orig}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <select
                                    value={current}
                                    onChange={(e) =>
                                      setAttendance((prev) => ({
                                        ...prev,
                                        [d]: e.target.value,
                                      }))
                                    }
                                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize focus:outline-none ${isChanged
                                        ? 'border-emerald-500 bg-white text-emerald-800 dark:border-emerald-600 dark:bg-slate-800 dark:text-emerald-300'
                                        : 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                      }`}
                                  >
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                    <option value="late">Late</option>
                                    <option value="excused">Excused</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-850">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Pending Modifications:
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-bold ${totalModificationsCount > 0
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
              >
                {totalModificationsCount} field(s)
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isCompleting}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving || isCompleting || totalModificationsCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
              >
                {isSaving ? (
                  <FiLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FiSave className="h-3.5 w-3.5" />
                )}
                Save Modifications
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSaving || isCompleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCompleting ? (
                  <FiLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FiCheckCircle className="h-3.5 w-3.5" />
                )}
                Save & Complete Amendment
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
