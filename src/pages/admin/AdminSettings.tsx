import { useEffect, useRef, useState } from "react";
import {
    FiCalendar,
    FiCheck,
    FiChevronDown,
    FiHome,
    FiInfo,
    FiLock,
    FiPercent,
    FiSave,
    FiSettings,
} from "react-icons/fi";

import { useUser } from "../../hooks/useUser";
import { invalidateSchoolInfoCache } from "../../hooks/useSchoolInfo";
import { getAPICall, patchAPICall, putAPICall } from "../../api/api.js";

import type { SchoolInfoProps } from "../../constant/schoolInfo.js";
import type { GradeWeights } from "../../constant/gradingWeights.js";

import "../../style/adminSettings.css";

// ==================== Admin Settings ====================
// All four sections are wired to the backend:
//   • School Information → GET/PATCH /school-info
//   • Academic Year      → GET/PATCH /academic-settings + PATCH /schoolYear/:id/activate
//   • Grading Weights    → GET/PATCH /grading-weight-defaults
//   • Login Credentials  → PUT /users/:id

interface AcademicSettingsData {
    id: number;
    currentQuarter: number;
    enrollmentOpen: boolean | number;
}

interface SchoolYear {
    id: number;
    startYear: string;
    endYear: string;
    isActive?: boolean | number;
}

export default function AdminSettings() {
    const { user } = useUser();

    const [savedSection, setSavedSection] = useState<string | null>(null);
    const [credentialError, setCredentialError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const savedTimer = useRef<number | null>(null);

    /* ==================== School Information ==================== */
    const [schoolLoading, setSchoolLoading] = useState(true);
    const [schoolSaving, setSchoolSaving] = useState(false);
    const [schoolError, setSchoolError] = useState<string | null>(null);
    const [schoolForm, setSchoolForm] = useState({
        schoolId: "",
        name: "",
        district: "",
        division: "",
        region: "",
        principal: "",
        address: ""
    });

    useEffect(() => {
        let cancelled = false;
        async function loadSchoolInfo() {
            try {
                const response = await getAPICall<SchoolInfoProps>("/school-info", { toast: false });
                if (cancelled || !response.data) return;
                const info = response.data;
                setSchoolForm({
                    schoolId: String(info.schoolId),
                    name: info.name ?? "",
                    district: info.district ?? "",
                    division: info.division ?? "",
                    region: info.region ?? "",
                    principal: info.principal ?? "",
                    address: info.address ?? ""
                });
            } catch {
                // Error toast is handled by the axios interceptor in api.ts
            } finally {
                if (!cancelled) setSchoolLoading(false);
            }
        }
        loadSchoolInfo();
        return () => { cancelled = true; };
    }, []);

    function handleSchoolChange(event: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = event.currentTarget;
        setSchoolForm((prev) => ({ ...prev, [name]: value }));
    }

    async function handleSaveSchool(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const { schoolId, name, district, division, region } = schoolForm;
        if (!schoolId.trim() || Number.isNaN(Number(schoolId)) || Number(schoolId) <= 0) {
            setSchoolError("School ID must be a valid number.");
            return;
        }
        if (!name.trim() || !district.trim() || !division.trim() || !region.trim()) {
            setSchoolError("All fields are required.");
            return;
        }

        setSchoolError(null);
        setSchoolSaving(true);
        try {
            await patchAPICall("/school-info", {
                schoolId: Number(schoolId),
                name: name.trim(),
                district: district.trim(),
                division: division.trim(),
                region: region.trim(),
                principal: schoolForm.principal.trim() || null,
                address: schoolForm.address.trim() || null
            });
            // Refresh the sidebar/header school name immediately.
            invalidateSchoolInfoCache();
            window.dispatchEvent(new Event("school-info-updated"));
            handleSave("school");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setSchoolSaving(false);
        }
    }

    /* ==================== Grading Weights ==================== */
    const [weightsLoading, setWeightsLoading] = useState(true);
    const [weightsSaving, setWeightsSaving] = useState(false);
    const [weightsError, setWeightsError] = useState<string | null>(null);
    const [weightsForm, setWeightsForm] = useState<Record<keyof GradeWeights, string>>({
        writtenWorkWeight: "",
        performanceTaskWeight: "",
        quarterlyAssessmentWeight: "",
        attendanceWeight: ""
    });

    useEffect(() => {
        let cancelled = false;
        async function loadWeights() {
            try {
                const response = await getAPICall<GradeWeights>("/grading-weight-defaults", { toast: false });
                if (cancelled || !response.data) return;
                const weights = response.data;
                setWeightsForm({
                    writtenWorkWeight: String(weights.writtenWorkWeight),
                    performanceTaskWeight: String(weights.performanceTaskWeight),
                    quarterlyAssessmentWeight: String(weights.quarterlyAssessmentWeight),
                    attendanceWeight: String(weights.attendanceWeight)
                });
            } catch {
                // Error toast is handled by the axios interceptor in api.ts
            } finally {
                if (!cancelled) setWeightsLoading(false);
            }
        }
        loadWeights();
        return () => { cancelled = true; };
    }, []);

    function handleWeightsChange(event: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = event.currentTarget;
        setWeightsForm((prev) => ({ ...prev, [name]: value }));
    }

    function weightValue(key: keyof GradeWeights): number {
        const raw = weightsForm[key].trim();
        if (raw === "") return Number.NaN;
        return Number(raw);
    }

    function weightDisplay(key: keyof GradeWeights): string {
        const value = weightValue(key);
        return Number.isNaN(value) ? "—" : String(Math.round(value * 100) / 100);
    }

    function barWidth(key: keyof GradeWeights): number {
        const value = weightValue(key);
        return Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
    }

    const weightsTotal = (() => {
        const keys: (keyof GradeWeights)[] = [
            "writtenWorkWeight",
            "performanceTaskWeight",
            "quarterlyAssessmentWeight",
            "attendanceWeight"
        ];
        let sum = 0;
        for (const key of keys) {
            const value = weightValue(key);
            if (Number.isNaN(value)) return Number.NaN;
            sum += value;
        }
        return sum;
    })();

    async function handleSaveWeights(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const keys: (keyof GradeWeights)[] = [
            "writtenWorkWeight",
            "performanceTaskWeight",
            "quarterlyAssessmentWeight",
            "attendanceWeight"
        ];
        const values = keys.map((key) => weightValue(key));

        if (values.some(Number.isNaN)) {
            setWeightsError("All weight fields must be numbers.");
            return;
        }
        if (values.some((value) => value < 0)) {
            setWeightsError("All weights must be 0 or greater.");
            return;
        }
        const total = values.reduce((sum, value) => sum + value, 0);
        if (Math.abs(total - 100) > 0.001) {
            setWeightsError(`Weights total ${Math.round(total * 100) / 100}, but they must total exactly 100.`);
            return;
        }

        setWeightsError(null);
        setWeightsSaving(true);
        try {
            await patchAPICall("/grading-weight-defaults", {
                writtenWorkWeight: weightValue("writtenWorkWeight"),
                performanceTaskWeight: weightValue("performanceTaskWeight"),
                quarterlyAssessmentWeight: weightValue("quarterlyAssessmentWeight"),
                attendanceWeight: weightValue("attendanceWeight")
            });
            handleSave("weights");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setWeightsSaving(false);
        }
    }

    /* ==================== Academic Year ==================== */
    const [academicLoading, setAcademicLoading] = useState(true);
    const [academicSaving, setAcademicSaving] = useState(false);
    const [academicError, setAcademicError] = useState<string | null>(null);
    const [academicForm, setAcademicForm] = useState({
        currentQuarter: "1",
        enrollmentOpen: true
    });
    const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
    const [selectedSchoolYearId, setSelectedSchoolYearId] = useState("");
    // The school year that was active when the page loaded — only re-activate
    // when the admin actually picks a different year.
    const [initialActiveSchoolYearId, setInitialActiveSchoolYearId] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function loadAcademicSettings() {
            try {
                const [settingsResponse, yearsResponse] = await Promise.all([
                    getAPICall<AcademicSettingsData>("/academic-settings", { toast: false }),
                    getAPICall<SchoolYear[]>("/schoolYear", { toast: false })
                ]);
                if (cancelled) return;

                const settings = settingsResponse.data;
                if (settings) {
                    setAcademicForm({
                        currentQuarter: String(settings.currentQuarter),
                        enrollmentOpen: Boolean(settings.enrollmentOpen)
                    });
                }

                const years = yearsResponse.data ?? [];
                setSchoolYears(years);
                const active = years.find((sy) => Boolean(sy.isActive));
                const initialId = active ? String(active.id) : years.length > 0 ? String(years[0].id) : "";
                setSelectedSchoolYearId(initialId);
                setInitialActiveSchoolYearId(initialId);
            } catch {
                // Error toast is handled by the axios interceptor in api.ts
            } finally {
                if (!cancelled) setAcademicLoading(false);
            }
        }
        loadAcademicSettings();
        return () => { cancelled = true; };
    }, []);

    const selectedSchoolYear = schoolYears.find((sy) => String(sy.id) === selectedSchoolYearId) ?? null;

    function handleAcademicChange(event: React.ChangeEvent<HTMLSelectElement>) {
        const { name, value } = event.currentTarget;
        if (name === "enrollmentOpen") {
            setAcademicForm((prev) => ({ ...prev, enrollmentOpen: value === "open" }));
        } else if (name === "currentQuarter") {
            setAcademicForm((prev) => ({ ...prev, currentQuarter: value }));
        }
    }

    async function handleSaveAcademic(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setAcademicError(null);
        setAcademicSaving(true);
        try {
            await patchAPICall("/academic-settings", {
                currentQuarter: Number(academicForm.currentQuarter),
                enrollmentOpen: academicForm.enrollmentOpen ? 1 : 0
            });

            // Activate the chosen school year if it isn't already the active one.
            if (selectedSchoolYearId && selectedSchoolYearId !== initialActiveSchoolYearId) {
                const response = await patchAPICall<object, SchoolYear[]>(
                    `/schoolYear/${selectedSchoolYearId}/activate`,
                    {},
                    { toast: false }
                );
                const refreshed = response.data;
                if (refreshed) {
                    setSchoolYears(refreshed);
                    const active = refreshed.find((sy) => Boolean(sy.isActive));
                    setInitialActiveSchoolYearId(active ? String(active.id) : selectedSchoolYearId);
                }
            }

            handleSave("academic");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
        } finally {
            setAcademicSaving(false);
        }
    }

    function handleSave(section: string) {
        if (savedTimer.current !== null) {
            window.clearTimeout(savedTimer.current);
        }
        setSavedSection(section);
        savedTimer.current = window.setTimeout(() => setSavedSection(null), 2000);
    }

    async function handleSaveCredentials(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        // Capture the form element before any await — event.currentTarget is
        // nulled by React once the handler yields, so it can't be used after.
        const form = event.currentTarget;
        const formData = new FormData(form);
        const currentPassword = String(formData.get("settings-current-password") ?? "");
        const newPassword = String(formData.get("settings-new-password") ?? "");
        const confirmPassword = String(formData.get("settings-confirm-password") ?? "");

        if (newPassword !== confirmPassword) {
            setCredentialError("New password and confirmation do not match.");
            return;
        }
        if (newPassword.length < 8) {
            setCredentialError("New password must be at least 8 characters long.");
            return;
        }
        if (!user?.id) {
            setCredentialError("Account information is still loading. Please try again.");
            return;
        }

        setCredentialError(null);
        setSubmitting(true);
        try {
            // Existing endpoint: verifies currentPassword before applying the change.
            // The body uses `password` (the endpoint's field name), not `newPassword`.
            // The user stays signed in after a successful password change.
            await putAPICall(`/users/${user.id}`, { currentPassword, password: newPassword });
            form.reset();
            handleSave("credentials");
        } catch {
            // Error toast is handled by the axios interceptor in api.ts
            setSubmitting(false);
        }
    }

    return (
        <section className="settings flex flex-col gap-5">
            {/* ==================== Hero header ==================== */}
            <div className="settings__hero relative overflow-hidden rounded-2xl p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <span className="settings__hero-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl" aria-hidden="true">
                            <FiSettings />
                        </span>
                        <div className="min-w-0">
                            <span className="settings__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Configuration</span>
                            <h2 className="settings__hero-title mt-1 text-xl font-bold sm:text-2xl">School Settings</h2>
                            <p className="settings__hero-sub mt-1 text-[0.8125rem]">Manage school information, the academic year, and grading defaults.</p>
                        </div>
                    </div>
                    <span className="settings__hero-badge inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
                        <FiCalendar aria-hidden="true" />
                        {selectedSchoolYear ? `SY ${selectedSchoolYear.startYear}–${selectedSchoolYear.endYear}` : "SY —"}
                    </span>
                </div>
            </div>

            {/* ==================== School Information ==================== */}
            <div className="settings__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="settings__head flex flex-wrap items-center justify-between gap-4 border-b p-5">
                    <div className="flex items-start gap-3">
                        <span className="settings__icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiHome />
                        </span>
                        <div className="min-w-0">
                            <h3 className="settings__title text-base font-bold">School Information</h3>
                            <p className="settings__subtitle mt-1 text-[0.8125rem]">Official details shown on reports, forms, and the sidebar.</p>
                        </div>
                    </div>
                    <span className="settings__badge inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">Live</span>
                </div>

                <form className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2" onSubmit={handleSaveSchool}>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-school-id" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">School ID</label>
                        <input
                            id="settings-school-id"
                            name="schoolId"
                            type="text"
                            inputMode="numeric"
                            className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={schoolForm.schoolId}
                            onChange={handleSchoolChange}
                            disabled={schoolLoading}
                        />
                    </div>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-school-name" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">School Name</label>
                        <input
                            id="settings-school-name"
                            name="name"
                            type="text"
                            className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={schoolForm.name}
                            onChange={handleSchoolChange}
                            disabled={schoolLoading}
                        />
                    </div>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-district" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">District</label>
                        <input
                            id="settings-district"
                            name="district"
                            type="text"
                            className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={schoolForm.district}
                            onChange={handleSchoolChange}
                            disabled={schoolLoading}
                        />
                    </div>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-division" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Division</label>
                        <input
                            id="settings-division"
                            name="division"
                            type="text"
                            className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={schoolForm.division}
                            onChange={handleSchoolChange}
                            disabled={schoolLoading}
                        />
                    </div>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-region" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Region</label>
                        <input
                            id="settings-region"
                            name="region"
                            type="text"
                            className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={schoolForm.region}
                            onChange={handleSchoolChange}
                            disabled={schoolLoading}
                        />
                    </div>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-principal" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Principal</label>
                        <input
                            id="settings-principal"
                            name="principal"
                            type="text"
                            className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={schoolForm.principal}
                            onChange={handleSchoolChange}
                            disabled={schoolLoading}
                        />
                    </div>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-address" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Address</label>
                        <input
                            id="settings-address"
                            name="address"
                            type="text"
                            className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={schoolForm.address}
                            onChange={handleSchoolChange}
                            disabled={schoolLoading}
                        />
                    </div>

                    <footer className="settings__footer col-span-full mt-2 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                        <div className="min-w-0">
                            {schoolError ? (
                                <p className="settings__error flex items-center gap-2 text-[0.8125rem] font-semibold" role="alert">
                                    <FiInfo className="shrink-0" aria-hidden="true" />
                                    {schoolError}
                                </p>
                            ) : (
                                <p className="settings__note flex items-center gap-2 text-[0.8125rem]">
                                    <FiInfo className="settings__note-icon" aria-hidden="true" />
                                    Changes are saved to the database.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {savedSection === "school" && (
                                <span className="settings__saved inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                                    <FiCheck aria-hidden="true" />
                                    Changes saved
                                </span>
                            )}
                            <button
                                type="submit"
                                disabled={schoolLoading || schoolSaving}
                                className="settings__btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiSave aria-hidden="true" />
                                {schoolSaving ? "Saving…" : "Save Changes"}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>

            {/* ==================== Academic Year ==================== */}
            <div className="settings__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="settings__head flex flex-wrap items-center justify-between gap-4 border-b p-5">
                    <div className="flex items-start gap-3">
                        <span className="settings__icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiCalendar />
                        </span>
                        <div className="min-w-0">
                            <h3 className="settings__title text-base font-bold">Academic Year</h3>
                            <p className="settings__subtitle mt-1 text-[0.8125rem]">Set the active school year and quarter used across the system.</p>
                        </div>
                    </div>
                </div>

                <form className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={handleSaveAcademic}>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-school-year" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">School Year</label>
                        <select
                            id="settings-school-year"
                            className="settings__select w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={selectedSchoolYearId}
                            onChange={(event) => setSelectedSchoolYearId(event.target.value)}
                            disabled={academicLoading}
                        >
                            {schoolYears.length > 0 ? (
                                schoolYears.map((sy) => (
                                    <option key={sy.id} value={sy.id}>
                                        SY {sy.startYear}–{sy.endYear}
                                    </option>
                                ))
                            ) : (
                                <option value="">Loading…</option>
                            )}
                        </select>
                    </div>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-quarter" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Current Quarter</label>
                        <select
                            id="settings-quarter"
                            name="currentQuarter"
                            className="settings__select w-full rounded-lg border px-3 py-2.5 text-sm"
                            value={academicForm.currentQuarter}
                            onChange={handleAcademicChange}
                            disabled={academicLoading}
                        >
                            <option value="1">Quarter 1</option>
                            <option value="2">Quarter 2</option>
                            <option value="3">Quarter 3</option>
                            <option value="4">Quarter 4</option>
                        </select>
                    </div>
                    <div className="settings__field flex flex-col gap-1.5">
                        <label htmlFor="settings-enrollment-status" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Enrollment Status</label>
                        <div
                            className={`settings__status ${academicForm.enrollmentOpen ? "settings__status--open" : "settings__status--closed"}`}
                        >
                            <span
                                className={`settings__status-dot ${academicForm.enrollmentOpen ? "" : "settings__status-dot--closed"}`}
                                aria-hidden="true"
                            />
                            <select
                                id="settings-enrollment-status"
                                name="enrollmentOpen"
                                className="settings__status-select"
                                value={academicForm.enrollmentOpen ? "open" : "closed"}
                                onChange={handleAcademicChange}
                                disabled={academicLoading}
                                aria-label="Enrollment status"
                            >
                                <option value="open">Open</option>
                                <option value="closed">Closed</option>
                            </select>
                            <FiChevronDown className="settings__status-chevron" aria-hidden="true" />
                        </div>
                    </div>

                    <footer className="settings__footer col-span-full mt-2 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                        <div className="min-w-0">
                            {academicError ? (
                                <p className="settings__error flex items-center gap-2 text-[0.8125rem] font-semibold" role="alert">
                                    <FiInfo className="shrink-0" aria-hidden="true" />
                                    {academicError}
                                </p>
                            ) : (
                                <p className="settings__note flex items-center gap-2 text-[0.8125rem]">
                                    <FiInfo className="settings__note-icon" aria-hidden="true" />
                                    Closing enrollment blocks new enrollments on the Enrollments page; changing the active school year affects reporting.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {savedSection === "academic" && (
                                <span className="settings__saved inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                                    <FiCheck aria-hidden="true" />
                                    Changes saved
                                </span>
                            )}
                            <button
                                type="submit"
                                disabled={academicLoading || academicSaving}
                                className="settings__btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiSave aria-hidden="true" />
                                {academicSaving ? "Saving…" : "Save Changes"}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>

            {/* ==================== Grading Weights ==================== */}
            <div className="settings__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="settings__head flex flex-wrap items-center justify-between gap-4 border-b p-5">
                    <div className="flex items-start gap-3">
                        <span className="settings__icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiPercent />
                        </span>
                        <div className="min-w-0">
                            <h3 className="settings__title text-base font-bold">Grading Weights</h3>
                            <p className="settings__subtitle mt-1 text-[0.8125rem]">DepEd DO 8, s. 2015 defaults applied to new class subjects.</p>
                        </div>
                    </div>
                    <span className="settings__badge inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">Default profile</span>
                </div>

                <form onSubmit={handleSaveWeights}>
                    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="settings__field flex flex-col gap-1.5">
                            <label htmlFor="settings-weight-ww" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Written Work</label>
                            <div className="relative">
                                <input
                                    id="settings-weight-ww"
                                    name="writtenWorkWeight"
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="settings__input w-full rounded-lg border px-3 py-2.5 pr-10 text-sm"
                                    value={weightsForm.writtenWorkWeight}
                                    onChange={handleWeightsChange}
                                    disabled={weightsLoading}
                                />
                                <span className="settings__suffix pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true">%</span>
                            </div>
                        </div>
                        <div className="settings__field flex flex-col gap-1.5">
                            <label htmlFor="settings-weight-pt" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Performance Tasks</label>
                            <div className="relative">
                                <input
                                    id="settings-weight-pt"
                                    name="performanceTaskWeight"
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="settings__input w-full rounded-lg border px-3 py-2.5 pr-10 text-sm"
                                    value={weightsForm.performanceTaskWeight}
                                    onChange={handleWeightsChange}
                                    disabled={weightsLoading}
                                />
                                <span className="settings__suffix pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true">%</span>
                            </div>
                        </div>
                        <div className="settings__field flex flex-col gap-1.5">
                            <label htmlFor="settings-weight-qa" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Quarterly Assessment</label>
                            <div className="relative">
                                <input
                                    id="settings-weight-qa"
                                    name="quarterlyAssessmentWeight"
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="settings__input w-full rounded-lg border px-3 py-2.5 pr-10 text-sm"
                                    value={weightsForm.quarterlyAssessmentWeight}
                                    onChange={handleWeightsChange}
                                    disabled={weightsLoading}
                                />
                                <span className="settings__suffix pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true">%</span>
                            </div>
                        </div>
                        <div className="settings__field flex flex-col gap-1.5">
                            <label htmlFor="settings-weight-att" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Attendance</label>
                            <div className="relative">
                                <input
                                    id="settings-weight-att"
                                    name="attendanceWeight"
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="settings__input w-full rounded-lg border px-3 py-2.5 pr-10 text-sm"
                                    value={weightsForm.attendanceWeight}
                                    onChange={handleWeightsChange}
                                    disabled={weightsLoading}
                                />
                                <span className="settings__suffix pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Distribution bar + total */}
                    <div className="px-5 pb-2">
                        <div className="settings__weights-bar flex h-2.5 w-full overflow-hidden rounded-full" aria-hidden="true">
                            <span className="settings__weights-seg settings__weights-seg--ww block h-full" style={{ width: `${barWidth("writtenWorkWeight")}%` }} />
                            <span className="settings__weights-seg settings__weights-seg--pt block h-full" style={{ width: `${barWidth("performanceTaskWeight")}%` }} />
                            <span className="settings__weights-seg settings__weights-seg--qa block h-full" style={{ width: `${barWidth("quarterlyAssessmentWeight")}%` }} />
                            {barWidth("attendanceWeight") > 0 && (
                                <span className="settings__weights-seg settings__weights-seg--att block h-full" style={{ width: `${barWidth("attendanceWeight")}%` }} />
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 pb-5 text-[0.75rem] font-semibold">
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            <span className="flex items-center gap-1.5 text-[#065F46]">
                                <span className="settings__legend-dot settings__legend-dot--ww" aria-hidden="true" />
                                Written Work {weightDisplay("writtenWorkWeight")}%
                            </span>
                            <span className="flex items-center gap-1.5 text-[#065F46]">
                                <span className="settings__legend-dot settings__legend-dot--pt" aria-hidden="true" />
                                Performance Tasks {weightDisplay("performanceTaskWeight")}%
                            </span>
                            <span className="flex items-center gap-1.5 text-[#B45309]">
                                <span className="settings__legend-dot settings__legend-dot--qa" aria-hidden="true" />
                                Quarterly Assessment {weightDisplay("quarterlyAssessmentWeight")}%
                            </span>
                            <span className="flex items-center gap-1.5 text-[#64748B]">
                                <span className="settings__legend-dot settings__legend-dot--off" aria-hidden="true" />
                                Attendance {weightDisplay("attendanceWeight")}%
                            </span>
                        </div>
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold ${
                                Number.isNaN(weightsTotal)
                                    ? "bg-[#FEF2F2] text-[#EF4444]"
                                    : Math.abs(weightsTotal - 100) <= 0.001
                                      ? "bg-[#D1FAE5] text-[#065F46]"
                                      : "bg-[#FEF3C7] text-[#B45309]"
                            }`}
                        >
                            Total: {Number.isNaN(weightsTotal) ? "—" : Math.round(weightsTotal * 100) / 100}%
                        </span>
                    </div>

                    <footer className="settings__footer flex flex-wrap items-center justify-between gap-3 border-t p-5">
                        <div className="min-w-0">
                            {weightsError ? (
                                <p className="settings__error flex items-center gap-2 text-[0.8125rem] font-semibold" role="alert">
                                    <FiInfo className="shrink-0" aria-hidden="true" />
                                    {weightsError}
                                </p>
                            ) : (
                                <p className="settings__note flex items-center gap-2 text-[0.8125rem]">
                                    <FiInfo className="settings__note-icon" aria-hidden="true" />
                                    Defaults apply to class subjects that haven't customized their weights; teachers can override per subject in their gradebook. Weights must total exactly 100.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {savedSection === "weights" && (
                                <span className="settings__saved inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                                    <FiCheck aria-hidden="true" />
                                    Changes saved
                                </span>
                            )}
                            <button
                                type="submit"
                                disabled={weightsLoading || weightsSaving}
                                className="settings__btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiSave aria-hidden="true" />
                                {weightsSaving ? "Saving…" : "Save Changes"}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>

            {/* ==================== Login Credentials ==================== */}
            <div className="settings__card overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="settings__head flex flex-wrap items-center justify-between gap-4 border-b p-5">
                    <div className="flex items-start gap-3">
                        <span className="settings__icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiLock />
                        </span>
                        <div className="min-w-0">
                            <h3 className="settings__title text-base font-bold">Login Credentials</h3>
                            <p className="settings__subtitle mt-1 text-[0.8125rem]">Update the email and password you use to sign in to your admin account.</p>
                        </div>
                    </div>
                    <span className="settings__badge inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">Admin account</span>
                </div>

                <form onSubmit={handleSaveCredentials}>
                    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                        <div className="settings__field flex flex-col gap-1.5">
                            <label htmlFor="settings-login-email" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Login Email</label>
                            <input
                                id="settings-login-email"
                                name="settings-login-email"
                                type="email"
                                className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm"
                                value={user?.email}
                            />
                        </div>
                        <div className="settings__field flex flex-col gap-1.5">
                            <label htmlFor="settings-current-password" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Current Password</label>
                            <input id="settings-current-password" name="settings-current-password" type="password" className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="••••••••" autoComplete="current-password" />
                        </div>
                        <div className="settings__field flex flex-col gap-1.5">
                            <label htmlFor="settings-new-password" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">New Password</label>
                            <input id="settings-new-password" name="settings-new-password" type="password" className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="At least 8 characters" autoComplete="new-password" />
                        </div>
                        <div className="settings__field flex flex-col gap-1.5">
                            <label htmlFor="settings-confirm-password" className="settings__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">Confirm New Password</label>
                            <input id="settings-confirm-password" name="settings-confirm-password" type="password" className="settings__input w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="Repeat the new password" autoComplete="new-password" />
                        </div>
                    </div>

                    <div className="px-5 pb-5">
                        <p className="settings__note flex items-start gap-2 text-[0.8125rem]">
                            <FiInfo className="settings__note-icon mt-0.5 shrink-0" aria-hidden="true" />
                            Passwords must be at least 8 characters long. You'll stay signed in after updating your password.
                        </p>
                        <p className="settings__note mt-2 flex items-start gap-2 text-[0.8125rem]">
                            <FiInfo className="settings__note-icon mt-0.5 shrink-0" aria-hidden="true" />
                            Email changes are not supported yet — the login email is read-only.
                        </p>
                    </div>

                    <footer className="settings__footer flex flex-wrap items-center justify-between gap-3 border-t p-5">
                        <div className="min-w-0">
                            {credentialError ? (
                                <p className="settings__error flex items-center gap-2 text-[0.8125rem] font-semibold" role="alert">
                                    <FiInfo className="shrink-0" aria-hidden="true" />
                                    {credentialError}
                                </p>
                            ) : (
                                <p className="settings__note flex items-center gap-2 text-[0.8125rem]">
                                    <FiInfo className="settings__note-icon" aria-hidden="true" />
                                    You'll stay signed in after updating your password.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {savedSection === "credentials" && (
                                <span className="settings__saved inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
                                    <FiCheck aria-hidden="true" />
                                    Credentials updated
                                </span>
                            )}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="settings__btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.8125rem] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FiSave aria-hidden="true" />
                                {submitting ? "Updating…" : "Update Credentials"}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
        </section>
    );
}
