import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import { FiCheck, FiInfo, FiSave, FiTrash2, FiX } from "react-icons/fi";

import { getAPICall, uploadFile } from "../api/api";
import { ConfirmDialog } from "./ConfirmDialog";

import type { SchoolSignaturePayload, SchoolSignatureProps } from "../constant/schoolInfo";

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// The school's authorized signature, drawn in Admin Settings → School
// Information. The canvas captures mouse/touch/stylus input; the PNG is POSTed
// as multipart/form-data to /school-info/signature (stored in the database, so
// it survives restarts on the deployment's ephemeral disk). The previously saved
// signature stays untouched — and is shown as a preview — until a replacement
// saves successfully.
export default function SignaturePad() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const padRef = useRef<SignaturePadLib | null>(null);
    const savedTimer = useRef<number | null>(null);

    const [saved, setSaved] = useState<SchoolSignatureProps | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasDrawing, setHasDrawing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);

    // Load the currently saved signature (null when none exists yet).
    useEffect(() => {
        let cancelled = false;
        async function loadSignature() {
            try {
                const response = await getAPICall<SchoolSignaturePayload>("/school-info/signature", {
                    toast: false,
                    skipErrorToast: true,
                });
                if (!cancelled) setSaved(response.data?.signature ?? null);
            } catch {
                if (!cancelled) setSaved(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadSignature();
        return () => { cancelled = true; };
    }, []);

    // Clear the "Saved" badge timer on unmount.
    useEffect(() => () => {
        if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    }, []);

    // Create the drawing surface once. Resizing is devicePixelRatio-aware and
    // preserves an in-progress drawing by snapshotting/restoring its vector data.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const pad = new SignaturePadLib(canvas, {
            minWidth: 0.8,
            maxWidth: 2.4,
            penColor: "#0f172a",
        });
        padRef.current = pad;

        const resize = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const data = pad.toData();
            canvas.width = Math.round(rect.width * ratio);
            canvas.height = Math.round(rect.height * ratio);
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.scale(ratio, ratio);

            if (data.length > 0) pad.fromData(data);
            else pad.clear();
        };

        resize();

        const syncDrawingState = () => setHasDrawing(!pad.isEmpty());
        pad.addEventListener("beginStroke", () => setHasDrawing(true));
        pad.addEventListener("endStroke", syncDrawingState);
        pad.addEventListener("afterUpdateStroke", syncDrawingState);

        const observer = new ResizeObserver(() => resize());
        if (wrapperRef.current) observer.observe(wrapperRef.current);
        window.addEventListener("resize", resize);

        return () => {
            pad.off();
            observer.disconnect();
            window.removeEventListener("resize", resize);
            padRef.current = null;
        };
    }, []);

    function clearDrawing() {
        const pad = padRef.current;
        if (!pad) return;
        pad.clear();
        setHasDrawing(false);
        setError(null);
    }

    function cancelDrawing() {
        clearDrawing();
        setConfirmOpen(false);
    }

    async function persist() {
        const pad = padRef.current;
        const canvas = canvasRef.current;
        if (!pad || !canvas) return;
        if (pad.isEmpty()) {
            setError("Draw your signature before saving.");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, "image/png");
            });
            if (!blob) {
                setError("Could not export the signature. Please try again.");
                return;
            }

            const file = new File([blob], "signature.png", { type: "image/png" });
            const response = await uploadFile<SchoolSignaturePayload>("/school-info/signature", file, { toast: false });
            const signature = response.data?.signature ?? null;
            if (signature) setSaved(signature);

            // Only discard the drawing once the save succeeded.
            pad.clear();
            setHasDrawing(false);
            setConfirmOpen(false);

            if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
            setJustSaved(true);
            savedTimer.current = window.setTimeout(() => setJustSaved(false), 2500);
        } catch {
            // The drawing and the previously saved signature stay intact; the API
            // interceptor surfaces the error toast.
            setError("Could not save the signature. Your drawing is unchanged — please try again.");
        } finally {
            setSaving(false);
        }
    }

    function requestSave() {
        const pad = padRef.current;
        if (!pad || saving || loading || pad.isEmpty()) return;
        // Replacing an existing signature asks for confirmation first.
        if (saved) {
            setConfirmOpen(true);
            return;
        }
        void persist();
    }

    const canSave = hasDrawing && !saving && !loading;

    return (
        <div className="settings__signature-block">
            <div className="settings__signature-grid">
                <div className="settings__signature-main">
                    <div>
                        <p className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Authorized Signature</p>
                        <p className="settings__note mt-1 text-[0.8125rem]">
                            Draw the school's authorized signature below using a mouse, touch, or stylus.
                        </p>
                    </div>

                    <div className="settings__signature-canvas-wrap" ref={wrapperRef}>
                        <canvas
                            ref={canvasRef}
                            className="settings__signature-canvas"
                            aria-label="Signature drawing area"
                        />
                        {!hasDrawing && !loading && (
                            <span className="settings__signature-hint" aria-hidden="true">Sign here</span>
                        )}
                    </div>
                </div>

                <div className="settings__signature-side">
                    <p className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Currently Saved</p>
                    <div className="settings__signature-preview">
                        {loading ? (
                            <span className="settings__signature-empty">Loading…</span>
                        ) : saved ? (
                            <img src={saved.dataUrl} alt="Saved authorized signature" />
                        ) : (
                            <span className="settings__signature-empty">No signature saved yet</span>
                        )}
                    </div>
                    {saved && !loading && (
                        <p className="settings__signature-meta">
                            {formatBytes(saved.byteSize)} · updated {formatDate(saved.updatedAt)}
                        </p>
                    )}
                </div>
            </div>

            <div className="settings__signature-actions">
                <button
                    type="button"
                    className="settings__btn settings__btn--ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={clearDrawing}
                    disabled={!hasDrawing || saving}
                >
                    <FiTrash2 aria-hidden="true" />
                    Clear
                </button>
                <button
                    type="button"
                    className="settings__btn settings__btn--ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={cancelDrawing}
                    disabled={(!hasDrawing && !error) || saving}
                >
                    <FiX aria-hidden="true" />
                    Cancel
                </button>
                <div className="settings__signature-actions-end">
                    {justSaved && (
                        <span className="settings__saved inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                            <FiCheck aria-hidden="true" />
                            Signature saved
                        </span>
                    )}
                    <button
                        type="button"
                        className="settings__btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={requestSave}
                        disabled={!canSave}
                    >
                        <FiSave aria-hidden="true" />
                        {saving ? "Saving…" : "Save Signature"}
                    </button>
                </div>
            </div>

            {error && (
                <p className="settings__error flex items-center gap-2 text-[0.8125rem] font-semibold" role="alert">
                    <FiInfo className="shrink-0" aria-hidden="true" />
                    {error}
                </p>
            )}

            <ConfirmDialog
                open={confirmOpen}
                title="Replace the saved signature?"
                description="A signature is already on file. Saving now replaces it with the new one you just drew. This cannot be undone."
                confirmLabel="Replace signature"
                confirmIcon={<FiSave aria-hidden="true" />}
                tone="primary"
                pending={saving}
                pendingLabel="Saving…"
                onConfirm={() => { void persist(); }}
                onClose={() => setConfirmOpen(false)}
            />
        </div>
    );
}
