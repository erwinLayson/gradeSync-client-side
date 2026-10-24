import { useEffect, useRef, useState } from "react";
import { FiCheck, FiImage, FiInfo, FiRefreshCw, FiSave, FiUpload, FiX } from "react-icons/fi";

import { getAPICall, uploadFile } from "../api/api";
import { ConfirmDialog } from "./ConfirmDialog";

import {
    ALLOWED_LOGO_MIME_TYPES,
    MAX_LOGO_BYTES,
    type SchoolLogoPayload,
    type SchoolLogoProps,
} from "../constant/schoolInfo";

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// The school logo uploader in Admin Settings -> School Information. The chosen
// image is POSTed as multipart/form-data to /school-info/logo (stored in the
// database so it survives restarts on the deployment's ephemeral disk). The
// previously saved logo stays untouched - and remains visible - until a
// replacement saves successfully.
export default function SchoolLogoUploader() {
    const inputRef = useRef<HTMLInputElement>(null);
    const savedTimer = useRef<number | null>(null);

    const [saved, setSaved] = useState<SchoolLogoProps | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);

    // Load the currently saved logo (null when none exists yet).
    useEffect(() => {
        let cancelled = false;
        async function loadLogo() {
            try {
                const response = await getAPICall<SchoolLogoPayload>("/school-info/logo", {
                    toast: false,
                    skipErrorToast: true,
                });
                if (!cancelled) setSaved(response.data?.logo ?? null);
            } catch {
                if (!cancelled) setSaved(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadLogo();
        return () => { cancelled = true; };
    }, []);

    // Release the object URL created for the selected file.
    useEffect(() => () => {
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    // Clear the "Saved" badge timer on unmount.
    useEffect(() => () => {
        if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    }, []);

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0] ?? null;
        // Allow choosing the same file again after a validation error.
        event.currentTarget.value = "";
        if (!file) return;

        if (!(ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
            setError("Choose a PNG, JPEG, or WebP image.");
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            setError(`Logo must be ${MAX_LOGO_BYTES / (1024 * 1024)} MB or smaller.`);
            return;
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError(null);
        setJustSaved(false);
    }

    function clearSelection() {
        setSelectedFile(null);
        setPreviewUrl(null);
        setError(null);
        setConfirmOpen(false);
    }

    async function persist() {
        if (!selectedFile) return;

        setSaving(true);
        setError(null);
        try {
            const response = await uploadFile<SchoolLogoPayload>("/school-info/logo", selectedFile, {
                toast: false,
            });
            const logo = response.data?.logo ?? null;
            if (logo) setSaved(logo);

            // Only discard the pending selection once the save succeeded.
            setSelectedFile(null);
            setPreviewUrl(null);
            setConfirmOpen(false);

            // Refresh the sidebar logo immediately.
            window.dispatchEvent(new Event("school-info-updated"));

            if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
            setJustSaved(true);
            savedTimer.current = window.setTimeout(() => setJustSaved(false), 2500);
        } catch {
            // The selected image and the previously saved logo stay intact; the
            // API interceptor surfaces the error toast.
            setError("Could not save the logo. Your selected image is unchanged - please try again.");
        } finally {
            setSaving(false);
        }
    }

    function requestSave() {
        if (!selectedFile || saving || loading) return;
        // Replacing an existing logo asks for confirmation first.
        if (saved) {
            setConfirmOpen(true);
            return;
        }
        void persist();
    }

    const preview = previewUrl ?? saved?.dataUrl ?? null;
    const canSave = Boolean(selectedFile) && !saving && !loading;

    return (
        <div className="settings__logo-block">
            <div className="settings__logo-row">
                <div className="settings__logo-preview">
                    {loading ? (
                        <span className="settings__logo-empty">Loading...</span>
                    ) : preview ? (
                        <img src={preview} alt="School logo preview" />
                    ) : (
                        <span className="settings__logo-empty">
                            <FiImage aria-hidden="true" />
                            No logo uploaded
                        </span>
                    )}
                </div>

                <div className="settings__logo-copy">
                    <div>
                        <p className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">School Logo</p>
                        <p className="settings__note mt-1 text-[0.8125rem]">
                            Upload a square PNG, JPEG, or WebP image up to {MAX_LOGO_BYTES / (1024 * 1024)} MB.
                            It appears in the sidebar for every user.
                        </p>
                    </div>

                    {saved && !loading && !selectedFile && (
                        <p className="settings__logo-meta">
                            {formatBytes(saved.byteSize)} - updated {formatDate(saved.updatedAt)}
                        </p>
                    )}
                    {selectedFile && (
                        <p className="settings__logo-meta">
                            {selectedFile.name} - {formatBytes(selectedFile.size)}
                        </p>
                    )}

                    <div className="settings__logo-actions">
                        <input
                            ref={inputRef}
                            type="file"
                            accept={ALLOWED_LOGO_MIME_TYPES.join(",")}
                            className="sr-only"
                            onChange={handleFileChange}
                            aria-label="Choose school logo"
                        />
                        <button
                            type="button"
                            className="settings__btn settings__btn--ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => inputRef.current?.click()}
                            disabled={saving || loading}
                        >
                            <FiUpload aria-hidden="true" />
                            {saved ? "Choose replacement" : "Choose image"}
                        </button>
                        {selectedFile && (
                            <button
                                type="button"
                                className="settings__btn settings__btn--ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={clearSelection}
                                disabled={saving}
                            >
                                <FiX aria-hidden="true" />
                                Cancel
                            </button>
                        )}
                        {justSaved && (
                            <span className="settings__saved inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                                <FiCheck aria-hidden="true" />
                                Logo saved
                            </span>
                        )}
                        <button
                            type="button"
                            className="settings__btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={requestSave}
                            disabled={!canSave}
                        >
                            {saving ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiSave aria-hidden="true" />}
                            {saving ? "Saving..." : "Save Logo"}
                        </button>
                    </div>
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
                title="Replace the saved school logo?"
                description="A logo is already on file. Saving now replaces it with the selected image. This cannot be undone."
                confirmLabel="Replace logo"
                confirmIcon={<FiSave aria-hidden="true" />}
                tone="primary"
                pending={saving}
                pendingLabel="Saving..."
                onConfirm={() => { void persist(); }}
                onClose={() => setConfirmOpen(false)}
            />
        </div>
    );
}
