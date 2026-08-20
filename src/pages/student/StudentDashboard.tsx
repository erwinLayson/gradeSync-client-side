import { useNavigate } from "react-router-dom";
import {
    FiAward,
    FiBookOpen,
    FiCalendar,
    FiChevronRight,
    FiHome,
    FiUser,
    FiUsers,
} from "react-icons/fi";

import { getInitials } from "../../helper/initials";

import "../../style/studentDashboard.css";

// ==================== Hardcoded mock data (client-only preview) ====================
const MOCK_STUDENT = {
    fullname: "Alexandra R. Garcia",
    email: "alexandra.garcia@student.edu",
    lrn: "123456789001",
    gradeLevel: 7,
    section: "Section A - G7",
    schoolYear: "2026–2027",
};

interface MockSubject {
    name: string;
    code: string;
    teacher: string;
    final: number | null;
}

const MOCK_SUBJECTS: MockSubject[] = [
    { name: "Mathematics", code: "MATH101", teacher: "Mr. Juan Dela Cruz", final: 90 },
    { name: "English", code: "ENG101", teacher: "Ms. Maria Santos", final: 88 },
    { name: "Science", code: "SCI101", teacher: "Mr. Pedro Reyes", final: 93 },
    { name: "Filipino", code: "FIL101", teacher: "Ms. Ana Cruz", final: 86 },
    { name: "Araling Panlipunan", code: "AP101", teacher: "Mr. Carlos Diaz", final: 82 },
    { name: "MAPEH", code: "MAPEH101", teacher: "Ms. Liza Ramos", final: null },
];

const GENERAL_AVERAGE = 89;
const ATTENDANCE = 96;

function gradeClass(final: number | null): string {
    if (final === null) return "student-dashboard__grade-ng";
    return final >= 90 ? "student-dashboard__grade-good" : "student-dashboard__grade-warn";
}

export default function StudentDashboard() {
    const navigate = useNavigate();

    return (
        <section className="student-dashboard__page flex flex-col gap-5">
            {/* ==================== Hero banner ==================== */}
            <div className="student-dashboard__hero flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex min-w-0 items-center gap-4">
                    <span
                        className="student-dashboard__hero-avatar inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                        aria-hidden="true"
                    >
                        {getInitials(MOCK_STUDENT.fullname)}
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__hero-eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">
                            Welcome back
                        </span>
                        <h2 className="student-dashboard__hero-name mt-1 truncate text-[1.375rem] font-bold">
                            {MOCK_STUDENT.fullname}
                        </h2>
                        <p className="student-dashboard__hero-role mt-0.5 truncate text-[0.8125rem]">
                            LRN {MOCK_STUDENT.lrn} &middot; Grade {MOCK_STUDENT.gradeLevel} &middot; {MOCK_STUDENT.section}
                        </p>
                    </div>
                </div>
                <div className="student-dashboard__hero-badge flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3.5 py-2.5">
                    <span className="student-dashboard__hero-badge-count text-[1.375rem] font-bold leading-none">
                        {MOCK_STUDENT.schoolYear}
                    </span>
                    <span className="student-dashboard__hero-badge-label text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                        School Year
                    </span>
                </div>
            </div>

            {/* ==================== Quick stats ==================== */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="student-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--green inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiAward />
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            General Average
                        </span>
                        <span className="student-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {GENERAL_AVERAGE}
                        </span>
                    </div>
                </div>

                <div className="student-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--blue inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Subjects
                        </span>
                        <span className="student-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {MOCK_SUBJECTS.length}
                        </span>
                    </div>
                </div>

                <div className="student-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--amber inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiUsers />
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            Attendance
                        </span>
                        <span className="student-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {ATTENDANCE}%
                        </span>
                    </div>
                </div>

                <div className="student-dashboard__stat flex items-center gap-3 rounded-xl border p-4">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--violet inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                        <FiCalendar />
                    </span>
                    <div className="min-w-0">
                        <span className="student-dashboard__stat-label block text-[0.625rem] font-bold uppercase tracking-[0.08em]">
                            School Year
                        </span>
                        <span className="student-dashboard__stat-value mt-0.5 block text-[1.125rem] font-bold">
                            {MOCK_STUDENT.schoolYear}
                        </span>
                    </div>
                </div>
            </div>

            {/* ==================== Subjects + quick links ==================== */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* My subjects */}
                <section className="student-dashboard__panel overflow-hidden rounded-2xl lg:col-span-2" aria-label="My subjects">
                    <div className="border-b px-5 py-4">
                        <h3 className="text-[0.9375rem] font-bold text-neutral-900">My Subjects</h3>
                        <p className="mt-1 text-[0.8125rem] text-neutral-500">
                            Your subjects this school year with the latest final grade.
                        </p>
                    </div>

                    <div className="flex flex-col">
                        {MOCK_SUBJECTS.map((subject) => (
                            <div key={subject.code} className="student-dashboard__subject-row flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="student-dashboard__subject-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                        <FiBookOpen />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-neutral-900">{subject.name}</p>
                                        <p className="mt-0.5 truncate text-xs text-neutral-400">
                                            {subject.code} &middot; {subject.teacher}
                                        </p>
                                    </div>
                                </div>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${gradeClass(subject.final)}`}>
                                    {subject.final === null ? "No grade" : subject.final}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Quick links */}
                <section className="flex flex-col gap-4" aria-label="Quick links">
                    <div className="min-w-0">
                        <h3 className="text-[0.9375rem] font-bold text-neutral-900">Quick Access</h3>
                        <p className="mt-1 text-[0.8125rem] text-neutral-500">
                            Jump straight to what you need.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="student-dashboard__link flex w-full cursor-pointer items-center gap-3 rounded-xl p-4 text-left"
                        onClick={() => navigate("/student/classes")}
                    >
                        <span className="student-dashboard__link-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiHome />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-neutral-900">My Classes</p>
                            <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                Subjects, activities, scores &amp; attendance
                            </p>
                        </div>
                        <FiChevronRight className="student-dashboard__link-arrow shrink-0" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="student-dashboard__link flex w-full cursor-pointer items-center gap-3 rounded-xl p-4 text-left"
                        onClick={() => navigate("/student/prospectus")}
                    >
                        <span className="student-dashboard__link-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiAward />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-neutral-900">Prospectus</p>
                            <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                Your academic history by school year
                            </p>
                        </div>
                        <FiChevronRight className="student-dashboard__link-arrow shrink-0" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        className="student-dashboard__link flex w-full cursor-pointer items-center gap-3 rounded-xl p-4 text-left"
                        onClick={() => navigate("/student/profile")}
                    >
                        <span className="student-dashboard__link-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                            <FiUser />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-neutral-900">My Profile</p>
                            <p className="mt-0.5 truncate text-[0.8125rem] text-neutral-500">
                                Personal and guardian information
                            </p>
                        </div>
                        <FiChevronRight className="student-dashboard__link-arrow shrink-0" aria-hidden="true" />
                    </button>
                </section>
            </div>

            {/* ==================== Footer note ==================== */}
            <p className="flex items-center gap-2 text-[0.8125rem] text-neutral-500">
                <FiCalendar className="shrink-0" aria-hidden="true" />
                This is a preview dashboard. Data shown is for demonstration only.
            </p>
        </section>
    );
}
