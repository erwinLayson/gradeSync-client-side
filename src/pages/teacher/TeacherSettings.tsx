import { useEffect, useState } from "react";
import {
    FiSave,
    FiUser,
    FiAlertCircle,
} from "react-icons/fi";

import { useUser } from "../../hooks/useUser";
import { getAPICall, patchAPICall, putAPICall } from "../../api/api";
import { toast } from "../../helper/toast";
import Skeleton from "../../components/Skeleton";


import "../../style/teacherSettings.css";

// ==================== Types ====================

interface TeacherProfile {
    id: number;
    userId: number;
    email: string;
    firstname: string;
    middlename: string;
    lastname: string;
    suffix: string | null;
    fullname: string;
}

interface PasswordForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

// ==================== Component ====================

export default function TeacherSettings() {
    const { user } = useUser();

    // Profile state
    const [profile, setProfile] = useState<TeacherProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Password state
    const [passwordForm, setPasswordForm] = useState<PasswordForm>({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [changingPassword, setChangingPassword] = useState(false);

    // ==================== Fetch Profile ====================
    useEffect(() => {
        async function fetchProfile() {
            if (!user?.id) return;
            try {
                const response = await getAPICall<TeacherProfile>(
                    `/teachers/by-user/${user.id}`
                );
                setProfile(response.data ?? null);
            } catch {
                // Error toast handled by API interceptor
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [user?.id]);

    // ==================== Profile Handlers ====================
    async function handleSaveProfile(e: React.FormEvent) {
        e.preventDefault();
        if (!profile || saving) return;

        setSaving(true);
        try {
            await patchAPICall(
                `/teachers/${profile.id}`,
                {
                    email: profile.email,
                    firstname: profile.firstname,
                    middlename: profile.middlename,
                    lastname: profile.lastname,
                    suffix: profile.suffix,
                },
                { toast: false }
            );
            toast.success("Profile updated successfully");
        } catch {
            // Error toast handled by API interceptor
        } finally {
            setSaving(false);
        }
    }

    function handleProfileChange(field: keyof TeacherProfile, value: string) {
        setProfile((prev) => (prev ? { ...prev, [field]: value } : null));
    }

    // ==================== Password Handlers ====================
    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        if (!profile || changingPassword) return;

        if (!passwordForm.currentPassword || !passwordForm.newPassword) {
            toast.warning("Please fill in all password fields");
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.warning("New passwords do not match");
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            toast.warning("Password must be at least 8 characters");
            return;
        }

        setChangingPassword(true);
        try {
            await putAPICall(
                `/users/${profile.userId}`,
                {
                    currentPassword: passwordForm.currentPassword,
                    password: passwordForm.newPassword,
                },
                { toast: false }
            );
            toast.success("Password changed successfully");
            setPasswordForm({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
        } catch {
            // Error toast handled by API interceptor
        } finally {
            setChangingPassword(false);
        }
    }

    // ====================
    if (loading) {
        return (
            <section className="teacher-settings flex flex-col gap-5">
                <div className="teacher-settings__header">
                    <div className="skeleton__bar" style={{ width: "8rem", height: "1.5rem" }} />
                    <div className="skeleton__bar mt-2" style={{ width: "14rem", height: "0.875rem" }} />
                </div>
                <div className="teacher-settings__card overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
                    <Skeleton lines={4} gap="1rem" />
                </div>
                <div className="teacher-settings__card overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
                    <Skeleton lines={2} gap="1rem" />
                </div>
            </section>
        );
    }

    return (
        <section className="teacher-settings flex flex-col gap-5">
            {/* Header */}
            <div className="teacher-settings__header">
                <h1 className="teacher-settings__title text-2xl font-bold">Settings</h1>
                <p className="teacher-settings__subtitle text-sm text-neutral-500">
                    Manage your profile and preferences
                </p>
            </div>

            {/* Profile Section */}
            <div className="teacher-settings__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="teacher-settings__card-header flex items-center gap-3 border-b p-5">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <FiUser size={20} />
                    </span>
                    <div>
                        <h2 className="text-base font-bold">Profile Information</h2>
                        <p className="text-sm text-neutral-500">Update your personal details</p>
                    </div>
                </div>

                <form onSubmit={handleSaveProfile} className="p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* First Name */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold">First Name</label>
                            <input
                                type="text"
                                value={profile?.firstname ?? ""}
                                onChange={(e) => handleProfileChange("firstname", e.target.value)}
                                className="rounded-lg border px-3 py-2.5 text-sm"
                            />
                        </div>

                        {/* Middle Name */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold">Middle Name</label>
                            <input
                                type="text"
                                value={profile?.middlename ?? ""}
                                onChange={(e) => handleProfileChange("middlename", e.target.value)}
                                className="rounded-lg border px-3 py-2.5 text-sm"
                            />
                        </div>

                        {/* Last Name */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold">Last Name</label>
                            <input
                                type="text"
                                value={profile?.lastname ?? ""}
                                onChange={(e) => handleProfileChange("lastname", e.target.value)}
                                className="rounded-lg border px-3 py-2.5 text-sm"
                            />
                        </div>

                        {/* Suffix */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold">Suffix (Optional)</label>
                            <select
                                value={profile?.suffix ?? ""}
                                onChange={(e) => handleProfileChange("suffix", e.target.value)}
                                className="rounded-lg border px-3 py-2.5 text-sm"
                            >
                                <option value="">None</option>
                                <option value="Jr.">Jr.</option>
                                <option value="Sr.">Sr.</option>
                                <option value="II">II</option>
                                <option value="III">III</option>
                                <option value="IV">IV</option>
                                <option value="V">V</option>
                            </select>
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <label className="text-sm font-semibold">Email</label>
                            <input
                                type="email"
                                value={profile?.email ?? ""}
                                onChange={(e) => handleProfileChange("email", e.target.value)}
                                className="rounded-lg border px-3 py-2.5 text-sm"
                            />
                            <p className="text-xs text-neutral-400">This is also your login email</p>
                        </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            <FiSave size={16} />
                            {saving ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Password Section */}
            <div className="teacher-settings__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="teacher-settings__card-header flex items-center gap-3 border-b p-5">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                        <FiAlertCircle size={20} />
                    </span>
                    <div>
                        <h2 className="text-base font-bold">Change Password</h2>
                        <p className="text-sm text-neutral-500">Update your account password</p>
                    </div>
                </div>

                <form onSubmit={handleChangePassword} className="p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {/* Current Password */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold">Current Password</label>
                            <input
                                type="password"
                                value={passwordForm.currentPassword}
                                onChange={(e) =>
                                    setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                                }
                                className="rounded-lg border px-3 py-2.5 text-sm"
                            />
                        </div>

                        {/* New Password */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold">New Password</label>
                            <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) =>
                                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                                }
                                className="rounded-lg border px-3 py-2.5 text-sm"
                            />
                        </div>

                        {/* Confirm Password */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold">Confirm New Password</label>
                            <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) =>
                                    setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                                }
                                className="rounded-lg border px-3 py-2.5 text-sm"
                            />
                        </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                        <button
                            type="submit"
                            disabled={changingPassword}
                            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                        >
                            <FiSave size={16} />
                            {changingPassword ? "Changing..." : "Change Password"}
                        </button>
                    </div>
                </form>
            </div>


        </section>
    );
}
