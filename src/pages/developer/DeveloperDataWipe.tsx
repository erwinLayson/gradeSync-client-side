import { useCallback, useEffect, useRef, useState } from "react";
import {
    FiAlertTriangle,
    FiCheckCircle,
    FiDatabase,
    FiFile,
    FiRefreshCw,
    FiShield,
    FiTrash2,
    FiXCircle,
} from "react-icons/fi";

import { EmptyState } from "../../components/EmptyState";
import { ModalDialog } from "../../components/ModalDialog";
import { PageCard } from "../../components/PageCard";
import { SkeletonLine } from "../../components/Skeleton";
import { getAPICall, postAPICall } from "../../api/api";
import { WIPE_DOMAINS, formatCount, type WipeDomain, type WipeDomainMeta } from "./dataWipeMeta";
import "../../style/developerDashboard.css";
import "../../style/dataWipe.css";

/**
 * Developer data-wipe tool (docs/developer-data-wipe-plan.md Phase B).
 *
 * Server contract (Phase A):
 *   GET  /system/wipe/status → { tables: { table, rows }[] }   (developer only)
 *   POST /system/wipe        → { scope, confirmation }         (developer only)
 *
 * The typed phrase is UX here; the server re-validates it against its own
 * WIPE_PHRASES map and refuses to delete the last admin/developer logins.
 */

interface WipeStatusRow {
    table: string;
    rows: number;
}

interface WipeReceiptTable {
    table: string;
    deleted: number;
}

interface WipeResultData {
    tables: WipeReceiptTable[];
    uploadFilesDeleted?: number;
    durationMs: number;
}

interface WipeModalState {
    domain: WipeDomainMeta;
    domainKey: WipeDomain;
}

const SEVERITY_LABEL: Record<WipeDomainMeta["severity"], string> = {
    critical: "Critical",
    high: "High impact",
    medium: "Standard",
};

export default function DeveloperDataWipe() {
    const [status, setStatus] = useState<WipeStatusRow[] | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [wipeModal, setWipeModal] = useState<WipeModalState | null>(null);
    const [confirmation, setConfirmation] = useState("");
    const [wiping, setWiping] = useState(false);

    // Per-row receipt from the last completed wipe (table → deleted count).
    const [lastReceipt, setLastReceipt] = useState<WipeReceiptTable[] | null>(null);
    const [receiptMeta, setReceiptMeta] = useState<{ label: string; durationMs: number; files?: number } | null>(null);

    const statusTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
    const phraseInputRef = useRef<HTMLInputElement>(null);

    const fetchStatus = useCallback(async (silent: boolean) => {
        if (silent) setRefreshing(true);
        else setStatusLoading(true);
        try {
            const body = await getAPICall<{ tables: WipeStatusRow[] }>("/system/wipe/status", {
                skipErrorToast: silent,
            });
            setStatus(body.data?.tables ?? []);
            setStatusError(false);
        } catch {
            setStatusError(true);
        } finally {
            setStatusLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void fetchStatus(false);
    }, [fetchStatus]);

    function openWipeModal(domainMeta: WipeDomainMeta, domainKey: WipeDomain) {
        setConfirmation("");
        setLastReceipt(null);
        setReceiptMeta(null);
        setWipeModal({ domain: domainMeta, domainKey });
    }

    function closeWipeModal() {
        if (wiping) return; // lockClose guards Escape/backdrop, but belt-and-suspenders
        setWipeModal(null);
        setConfirmation("");
    }

    async function handleConfirmWipe() {
        if (!wipeModal || confirmation !== wipeModal.domain.phrase || wiping) return;

        setWiping(true);
        try {
            const body = await postAPICall<{ scope: WipeDomain; confirmation: string }, WipeResultData>(
                "/system/wipe",
                { scope: wipeModal.domainKey, confirmation },
                { toast: false }, // the receipt panel is the feedback, a toast on top is noise
            );

            setLastReceipt(body.data?.tables ?? []);
            setReceiptMeta({
                label: wipeModal.domain.label,
                durationMs: body.data?.durationMs ?? 0,
                files: body.data?.uploadFilesDeleted,
            });
            // Refresh the status card so counts reflect the wipe immediately.
            void fetchStatus(true);
        } catch {
            // Error toast already surfaced by the interceptor (phrase mismatch,
            // guardrails, FK errors). Keep the modal open so the operator can
            // read the message and retry or cancel.
        } finally {
            setWiping(false);
        }
    }

    const totalRows =
        status?.reduce((sum, row) => sum + row.rows, 0) ?? 0;

    return (
        <section className="flex flex-col gap-5">
            {/* ==================== Header card ==================== */}
            <PageCard className="analytics__card">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                        <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">System</span>
                        <h3 className="analytics__title mt-1 text-base font-bold">Data Wipe</h3>
                        <p className="analytics__subtitle mt-1 text-[0.8125rem]">
                            Permanently delete system data by domain. Every action is irreversible —
                            run a <code className="data-wipe__code">mysqldump</code> backup first.
                        </p>
                    </div>
                    <span className="analytics__chip inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                        <FiShield aria-hidden="true" />
                        Developer only
                    </span>
                </div>
            </PageCard>

            {/* ==================== Status card ==================== */}
            <PageCard variant="flat" className="analytics__card" ariaBusy={statusLoading} ariaLabel="Wipe status">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-neutral-800">Current data</h4>
                        <p className="mt-0.5 text-[0.75rem] text-neutral-500">
                            Row counts per table, so you know exactly what each wipe will delete.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!statusLoading && !statusError && (
                            <span className="data-wipe__total inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
                                <FiDatabase aria-hidden="true" />
                                {formatCount(totalRows)} rows total
                            </span>
                        )}
                        <button
                            type="button"
                            className="data-wipe__refresh inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                            onClick={() => void fetchStatus(true)}
                            disabled={refreshing || statusLoading}
                        >
                            <FiRefreshCw className={refreshing ? "data-wipe__spin" : ""} aria-hidden="true" />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="p-5" aria-busy={statusLoading}>
                    {statusLoading ? (
                        <ul className="data-wipe__status-grid grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 9 }).map((_, index) => (
                                <li key={index} className="data-wipe__status-row flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                                    <SkeletonLine width="55%" height="0.75rem" />
                                    <SkeletonLine width="3rem" height="1rem" radius="0.375rem" />
                                </li>
                            ))}
                        </ul>
                    ) : statusError ? (
                        <EmptyState
                            icon={<FiAlertTriangle />}
                            title="Could not load data status"
                            description="The server did not return table counts. Check the connection and try again."
                            action={
                                <button
                                    type="button"
                                    className="data-wipe__refresh mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                                    onClick={() => void fetchStatus(false)}
                                >
                                    <FiRefreshCw aria-hidden="true" />
                                    Retry
                                </button>
                            }
                        />
                    ) : (
                        <ul className="data-wipe__status-grid grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {status?.map((row) => (
                                <li key={row.table} className="data-wipe__status-row flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                                    <span className="data-wipe__status-table truncate text-[0.8125rem]">{row.table}</span>
                                    <span className="data-wipe__status-count shrink-0 text-sm font-bold">{formatCount(row.rows)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </PageCard>

            {/* ==================== Wipe actions ==================== */}
            <PageCard variant="flat" className="analytics__card">
                <div className="border-b p-5">
                    <h4 className="text-sm font-bold text-neutral-800">Wipe actions</h4>
                    <p className="mt-0.5 text-[0.75rem] text-neutral-500">
                        Each action requires typing its exact confirmation phrase. Phrases are re-validated on the server.
                    </p>
                </div>

                <ul className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-2">
                    {WIPE_DOMAINS.map((domainMeta) => {
                        const critical = domainMeta.severity === "critical";
                        return (
                            <li
                                key={domainMeta.phrase}
                                className={`data-wipe__action data-wipe__action--${domainMeta.severity} flex flex-col gap-3 rounded-xl border p-4`}
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold text-neutral-800">{domainMeta.label}</span>
                                        <span className={`data-wipe__severity data-wipe__severity--${domainMeta.severity} px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide`}>
                                            {SEVERITY_LABEL[domainMeta.severity]}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-neutral-500">{domainMeta.description}</p>
                                    <p className="data-wipe__keeps mt-1.5 text-[0.75rem]">
                                        <FiCheckCircle className="mr-1 inline" aria-hidden="true" />
                                        {domainMeta.keeps}
                                    </p>
                                </div>

                                <div className="mt-auto flex items-center justify-between gap-3">
                                    <code className="data-wipe__code text-[0.6875rem]">{domainMeta.phrase}</code>
                                    <button
                                        type="button"
                                        className={`data-wipe__button ${critical ? "data-wipe__button--critical" : ""} inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold`}
                                        onClick={(event) => {
                                            statusTriggerRefs.current.set(domainMeta.phrase, event.currentTarget);
                                            openWipeModal(domainMeta, domainMeta.key);
                                        }}
                                    >
                                        <FiTrash2 aria-hidden="true" />
                                        Wipe
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </PageCard>

            {/* ==================== Typed-phrase wipe modal ==================== */}
            <ModalDialog
                open={wipeModal !== null}
                onClose={closeWipeModal}
                lockClose={wiping}
                labelledById="data-wipe-modal-title"
                describedById="data-wipe-modal-desc"
                initialFocusRef={phraseInputRef}
                restoreFocusRef={{
                    current:
                        wipeModal !== null
                            ? statusTriggerRefs.current.get(wipeModal.domain.phrase) ?? null
                            : null,
                }}
                className="confirm-dialog__panel data-wipe__modal"
            >
                {wipeModal && (
                    <>
                        <button
                            type="button"
                            className="confirm-dialog__close"
                            onClick={closeWipeModal}
                            disabled={wiping}
                            aria-label="Close dialog"
                        >
                            <FiXCircle aria-hidden="true" />
                        </button>

                        <span
                            className={`confirm-dialog__icon ${wipeModal.domain.severity === "critical" ? "data-wipe__modal-icon--critical" : ""}`}
                            aria-hidden="true"
                        >
                            <FiAlertTriangle />
                        </span>

                        <h2 id="data-wipe-modal-title" className="confirm-dialog__title">
                            Wipe {wipeModal.domain.label}?
                        </h2>
                        <p id="data-wipe-modal-desc" className="confirm-dialog__text">
                            This permanently deletes {wipeModal.domain.description.toLowerCase().startsWith("every") ? "" : "the "}
                            {wipeModal.domain.label.toLowerCase()} data described below. It cannot be undone.
                        </p>

                        <div className="data-wipe__modal-box" role="note">
                            <p className="text-[0.8125rem] leading-relaxed text-neutral-600">{wipeModal.domain.description}</p>
                            <p className="data-wipe__keeps mt-2 text-[0.75rem]">
                                <FiCheckCircle className="mr-1 inline" aria-hidden="true" />
                                {wipeModal.domain.keeps}
                            </p>
                        </div>

                        <label className="data-wipe__phrase-label mt-4 block text-[0.75rem] font-bold uppercase tracking-wide text-neutral-600" htmlFor="data-wipe-phrase">
                            Type <code className="data-wipe__code">{wipeModal.domain.phrase}</code> to confirm
                        </label>
                        <input
                            id="data-wipe-phrase"
                            ref={phraseInputRef}
                            type="text"
                            className="data-wipe__phrase-input mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
                            value={confirmation}
                            spellCheck={false}
                            autoComplete="off"
                            disabled={wiping}
                            onChange={(event) => setConfirmation(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && confirmation === wipeModal.domain.phrase && !wiping) {
                                    void handleConfirmWipe();
                                }
                            }}
                            aria-describedby="data-wipe-phrase-hint"
                        />
                        <p id="data-wipe-phrase-hint" className="mt-1.5 text-[0.6875rem] text-neutral-400">
                            The phrase is case-sensitive and checked again on the server.
                        </p>

                        <div className="confirm-dialog__actions mt-5">
                            <button
                                type="button"
                                className="confirm-dialog__cancel"
                                onClick={closeWipeModal}
                                disabled={wiping}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={`confirm-dialog__confirm confirm-dialog__confirm--danger ${wipeModal.domain.severity === "critical" ? "data-wipe__confirm-critical" : ""}`}
                                onClick={() => void handleConfirmWipe()}
                                disabled={wiping || confirmation !== wipeModal.domain.phrase}
                            >
                                <FiTrash2 aria-hidden="true" />
                                {wiping ? "Wiping…" : "Wipe now"}
                            </button>
                        </div>
                    </>
                )}
            </ModalDialog>

            {/* ==================== Receipt modal (post-wipe) ==================== */}
            <ModalDialog
                open={receiptMeta !== null}
                onClose={() => {
                    setReceiptMeta(null);
                    setLastReceipt(null);
                    setWipeModal(null);
                    setConfirmation("");
                }
                }
                labelledById="data-wipe-receipt-title"
                className="confirm-dialog__panel data-wipe__modal"
            >
                {receiptMeta && (
                    <>
                        <span className="confirm-dialog__icon data-wipe__modal-icon--done" aria-hidden="true">
                            <FiCheckCircle />
                        </span>
                        <h2 id="data-wipe-receipt-title" className="confirm-dialog__title">
                            {receiptMeta.label} wiped
                        </h2>
                        <p className="confirm-dialog__text">
                            Completed in {receiptMeta.durationMs}ms
                            {receiptMeta.files !== undefined ? ` — ${formatCount(receiptMeta.files)} file(s) deleted from disk.` : "."}
                        </p>

                        {lastReceipt && lastReceipt.length > 0 && (
                            <div className="data-wipe__receipt mt-3 max-h-56 overflow-y-auto rounded-lg border p-3">
                                <ul className="flex flex-col gap-1.5">
                                    {lastReceipt.map((row) => (
                                        <li key={row.table} className="flex items-center justify-between gap-3 text-[0.8125rem]">
                                            <span className="data-wipe__status-table truncate">{row.table}</span>
                                            <span className="shrink-0 font-bold">{formatCount(row.deleted)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="confirm-dialog__actions mt-5">
                            <button
                                type="button"
                                className="confirm-dialog__confirm confirm-dialog__confirm--primary"
                                onClick={() => {
                                    setReceiptMeta(null);
                                    setLastReceipt(null);
                                    setWipeModal(null);
                                    setConfirmation("");
                                }}
                                autoFocus
                            >
                                Done
                            </button>
                        </div>
                    </>
                )}
            </ModalDialog>

            {/* ==================== Footer hint ==================== */}
            <p className="analytics__subtitle flex items-center gap-2 px-1 text-[0.75rem]">
                <FiFile className="shrink-0" aria-hidden="true" />
                No in-app backup is kept. The documented recovery path is a pre-wipe <code className="data-wipe__code">mysqldump</code> snapshot.
            </p>
        </section>
    );
}
;
