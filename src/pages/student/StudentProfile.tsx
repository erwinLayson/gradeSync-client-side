import { useEffect, useState } from "react";
import {
    FiCheck,
    FiInfo,
    FiSave,
    FiUser,
} from "react-icons/fi";

import { getAPICall, patchAPICall } from "../../api/api.js";

import type { StudentDetailsProps, StudentDetailsUpdateProps } from "../../constant/studentDetails.js";
import { GUARDIAN_RELATIONS } from "../../constant/studentDetails.js";

// ==================== Types ====================
interface StudentProfileData {
    student: {
        id: number;
        lrn: string;
        email: string;
        firstname?: string;
        middlename?: string;
        lastname?: string;
        suffix?: string | null;
        fullname: string;
        birthdate: string;
        sex: string;
    };
    details: StudentDetailsProps | null;
}

const EMPTY_FORM: StudentDetailsUpdateProps = {
    birthplace: "",
    permanentAddress: "",
    religion: "",
    contactNumber: "",
    guardianName: "",
    guardianRelation: "",
    guardianContact: "",
    guardianOccupation: "",
};

export default function StudentProfile() {
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<StudentProfileData["student"] | null>(null);
    const [form, setForm] = useState<StudentDetailsUpdateProps>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function loadProfile() {
            try {
                const response = await getAPICall<StudentProfileData>("/students/details", { toast: false });
                if (cancelled) return;
                setStudent(response.data?.student ?? null);
                const details = response.data?.details ?? null;
                setForm({
                    birthplace: details?.birthplace ?? "",
                    permanentAddress: details?.permanentAddress ?? "",
                    religion: details?.religion ?? "",
                    contactNumber: details?.contactNumber ?? "",
                    guardianName: details?.guardianName ?? "",
                    guardianRelation: details?.guardianRelation ?? "",
                    guardianContact: details?.guardianContact ?? "",
                    guardianOccupation: details?.guardianOccupation ?? "",
                });
            } catch {
                // Error toast is handled by the axios interceptor in api.ts
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadProfile();
        return () => {
            cancelled = true;
        };
    }, []);

    function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = event.currentTarget;
        setForm((prev) => ({ ...prev, [name]: value }));
        setSaved(false);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError(null);
        setSaving(true);
        try {
            // Blank optional fields are stored as null so the record stays clean.
            const payload: StudentDetailsUpdateProps = {};
            for (const [key, value] of Object.entries(form)) {
                const trimmed = typeof value === "string" ? value.trim() : value;
                (payload as Record<string, string | null>)[key] = trimmed || null;
            }

            await patchAPICall<StudentDetailsUpdateProps, StudentDetailsProps>("/students/details", payload);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 2000);
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setSaving(false);
        }
    }

    const fieldClass = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60";

    return (
        <section className="flex flex-col gap-5">
            {/* ============ Header ============ */}
            <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600" aria-hidden="true">
                        <FiUser />
                    </span>
                    <div>
                        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-neutral-400">
                            Student Information
                        </p>
                        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">
                            My Profile
                        </h2>
                        <p className="mt-1 text-sm text-neutral-500">
                            Your personal details and guardian information.
                        </p>
                    </div>
                </div>
                <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700">
                    <FiInfo aria-hidden="true" />
                    Basic info is managed by the school — only the Additional Information section can be edited here.
                </p>
            </header>

            {loading ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-neutral-400 shadow-sm">
                    Loading your profile…
                </div>
            ) : (
                <>
                    {/* ============ Read-only student info ============ */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        <div className="border-b px-6 py-4">
                            <h3 className="text-base font-bold text-neutral-900">Basic Information</h3>
                        </div>
                        <dl className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex flex-col gap-1">
                                <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Full Name</dt>
                                <dd className="text-sm font-semibold text-neutral-800">{student?.fullname ?? "—"}</dd>
                            </div>
                            <div className="flex flex-col gap-1">
                                <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">LRN</dt>
                                <dd className="text-sm font-semibold text-neutral-800">{student?.lrn ?? "—"}</dd>
                            </div>
                            <div className="flex flex-col gap-1">
                                <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Email</dt>
                                <dd className="text-sm font-semibold text-neutral-800">{student?.email ?? "—"}</dd>
                            </div>
                            <div className="flex flex-col gap-1">
                                <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Birthdate</dt>
                                <dd className="text-sm font-semibold text-neutral-800">{student?.birthdate ?? "—"}</dd>
                            </div>
                            <div className="flex flex-col gap-1">
                                <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-400">Sex</dt>
                                <dd className="text-sm font-semibold text-neutral-800">{student?.sex ?? "—"}</dd>
                            </div>
                        </dl>
                    </div>

                    {/* ============ Editable additional information ============ */}
                    <form className="overflow-hidden rounded-2xl bg-white shadow-sm" onSubmit={handleSubmit}>
                        <div className="border-b px-6 py-4">
                            <h3 className="text-base font-bold text-neutral-900">Additional Information</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-birthplace" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-500">
                                    Place of Birth
                                </label>
                                <input
                                    id="profile-birthplace"
                                    name="birthplace"
                                    type="text"
                                    className={fieldClass}
                                    value={form.birthplace ?? ""}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-address" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-500">
                                    Permanent Address
                                </label>
                                <input
                                    id="profile-address"
                                    name="permanentAddress"
                                    type="text"
                                    className={fieldClass}
                                    value={form.permanentAddress ?? ""}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-religion" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-500">
                                    Religion
                                </label>
                                <input
                                    id="profile-religion"
                                    name="religion"
                                    type="text"
                                    className={fieldClass}
                                    value={form.religion ?? ""}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-contact" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-500">
                                    Contact Number
                                </label>
                                <input
                                    id="profile-contact"
                                    name="contactNumber"
                                    type="text"
                                    className={fieldClass}
                                    value={form.contactNumber ?? ""}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-guardian-name" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-500">
                                    Guardian Name
                                </label>
                                <input
                                    id="profile-guardian-name"
                                    name="guardianName"
                                    type="text"
                                    className={fieldClass}
                                    value={form.guardianName ?? ""}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-guardian-relation" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-500">
                                    Guardian Relation
                                </label>
                                <select
                                    id="profile-guardian-relation"
                                    name="guardianRelation"
                                    className={fieldClass}
                                    value={form.guardianRelation ?? ""}
                                    onChange={handleChange}
                                >
                                    <option value="">Select…</option>
                                    {GUARDIAN_RELATIONS.map((relation) => (
                                        <option key={relation} value={relation}>
                                            {relation}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-guardian-contact" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-500">
                                    Guardian Contact
                                </label>
                                <input
                                    id="profile-guardian-contact"
                                    name="guardianContact"
                                    type="text"
                                    className={fieldClass}
                                    value={form.guardianContact ?? ""}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-guardian-occupation" className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-neutral-500">
                                    Guardian Occupation
                                </label>
                                <input
                                    id="profile-guardian-occupation"
                                    name="guardianOccupation"
                                    type="text"
                                    className={fieldClass}
                                    value={form.guardianOccupation ?? ""}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {error && <p className="px-6 pb-2 text-[0.8125rem] font-medium text-red-600">{error}</p>}

                        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-5">
                            <p className="text-[0.8125rem] text-neutral-500">
                                These details are used on your student records (Form 137/138).
                            </p>
                            <div className="flex items-center gap-3">
                                {saved && (
                                    <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-emerald-600">
                                        <FiCheck aria-hidden="true" />
                                        Saved
                                    </span>
                                )}
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <FiSave aria-hidden="true" />
                                    {saving ? "Saving…" : "Save Changes"}
                                </button>
                            </div>
                        </footer>
                    </form>
                </>
            )}
        </section>
    );
}
