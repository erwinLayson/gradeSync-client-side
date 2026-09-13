import { useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiMail, FiUser, FiAlertCircle, FiCheckCircle } from "react-icons/fi";

import { putAPICall } from "../../api/api";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "../../hooks/useUser";
import "../../style/analyticsReports.css";
import "../../style/developerDashboard.css";

/*
 * Endpoints:
 *   PUT /users/:id   { currentPassword, password }   (existing shared endpoint,
 *                                                    same as AdminSettings/TeacherSettings)
 */
export default function DeveloperSettings() {
    const { user } = useUser();
    const { auth } = useAuth();
    const email = auth ? user?.email ?? "" : "";

    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // Capture the form before awaiting — event.currentTarget is nulled by
        // React once the handler yields (same pattern as AdminSettings).
        const form = event.currentTarget;
        const formData = new FormData(form);
        const currentPassword = String(formData.get("developer-current-password") ?? "");
        const newPassword = String(formData.get("developer-new-password") ?? "");
        const confirmPassword = String(formData.get("developer-confirm-password") ?? "");

        if (!user?.id) {
            setError("Account information is still loading. Please try again.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("New password and confirmation do not match.");
            return;
        }
        if (newPassword.length < 8) {
            setError("New password must be at least 8 characters long.");
            return;
        }

        setError(null);
        setSaved(false);
        setSubmitting(true);
        try {
            await putAPICall(`/users/${user.id}`, { currentPassword, password: newPassword });
            form.reset();
            setSaved(true);
        } catch {
            // Error toast handled by the axios interceptor in api.ts
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="flex flex-col gap-5">
            {/* ==================== Account card ==================== */}
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b p-5">
                    <span className="analytics__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Configuration</span>
                    <h3 className="analytics__title mt-1 text-base font-bold">Developer Settings</h3>
                    <p className="analytics__subtitle mt-1 text-[0.8125rem]">Account details for the developer role</p>
                </div>

                <div className="p-5">
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--neutral-border)] p-4">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--neutral-border)] text-lg text-[var(--primary)]" aria-hidden="true">
                            <FiUser />
                        </span>
                        <div className="min-w-0">
                            <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Account email</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
                                <FiMail aria-hidden="true" />
                                {email || "Not signed in"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ==================== Password card ==================== */}
            <div className="analytics__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b p-5">
                    <h3 className="text-base font-bold text-neutral-800">Change Password</h3>
                    <p className="mt-1 text-[0.8125rem] text-neutral-500">
                        You stay signed in after a successful change.
                    </p>
                </div>

                <form className="flex flex-col gap-4 p-5" onSubmit={handlePasswordChange}>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="developer-current-password" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">
                            Current password
                        </label>
                        <div className="relative">
                            <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                            <input
                                id="developer-current-password"
                                name="developer-current-password"
                                type={showPassword ? "text" : "password"}
                                required
                                autoComplete="current-password"
                                className="developer-search w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="developer-new-password" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">
                                New password
                            </label>
                            <input
                                id="developer-new-password"
                                name="developer-new-password"
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={8}
                                autoComplete="new-password"
                                className="developer-search w-full rounded-lg border px-3 py-2.5 text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="developer-confirm-password" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">
                                Confirm new password
                            </label>
                            <input
                                id="developer-confirm-password"
                                name="developer-confirm-password"
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={8}
                                autoComplete="new-password"
                                className="developer-search w-full rounded-lg border px-3 py-2.5 text-sm"
                            />
                        </div>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] font-semibold text-neutral-600">
                        <input
                            type="checkbox"
                            checked={showPassword}
                            onChange={(event) => setShowPassword(event.target.checked)}
                            className="h-4 w-4 accent-[var(--primary)]"
                        />
                        {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                        Show passwords
                    </label>

                    {error && (
                        <p className="flex items-center gap-2 rounded-lg bg-[#fef2f2] px-3 py-2.5 text-[0.8125rem] font-semibold text-[#B91C1C]" role="alert">
                            <FiAlertCircle aria-hidden="true" />
                            {error}
                        </p>
                    )}
                    {saved && (
                        <p className="flex items-center gap-2 rounded-lg bg-[#ecfdf5] px-3 py-2.5 text-[0.8125rem] font-semibold text-[#065F46]" role="status">
                            <FiCheckCircle aria-hidden="true" />
                            Password updated successfully.
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                    >
                        <FiLock aria-hidden="true" />
                        {submitting ? "Updating…" : "Update password"}
                    </button>
                </form>
            </div>
        </section>
    );
}
