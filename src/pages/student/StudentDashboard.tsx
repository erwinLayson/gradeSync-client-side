import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiAward,
    FiBookOpen,
    FiCalendar,
    FiHome,
    FiUser,
} from "react-icons/fi";

import { getAPICall } from "../../api/api";
import { PageShell } from "../../components/PageLayout";
import Skeleton from "../../components/Skeleton";

import type { StudentClass, StudentClassesData } from "../../constant/studentClasses";

import "../../style/studentDashboard.css";

// ==================== Types ====================

interface AcademicSettingsData {
    id: number;
    currentQuarter: number;
    numQuarters: number;
    enrollmentOpen: boolean | number;
    submissionsLocked: boolean | number;
}

// ==================== Component ====================

export default function StudentDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<StudentClassesData["student"] | null>(null);
    const [currentClass, setCurrentClass] = useState<StudentClass | null>(null);
    const [currentQuarter, setCurrentQuarter] = useState(1);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const [classesRes, settingsRes] = await Promise.all([
                    getAPICall<StudentClassesData>("/students/classes", { toast: false }),
                    getAPICall<AcademicSettingsData>("/students/current-quarter", { toast: false }),
                ]);
                if (cancelled) return;

                const classes = classesRes.data?.classes ?? [];
                setStudent(classesRes.data?.student ?? null);
                setCurrentClass(classes[0] ?? null);

                const quarter = settingsRes.data?.currentQuarter ?? 1;
                setCurrentQuarter(quarter);
            } catch {
                // Error toast handled by API interceptor
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    // ==================== Loading ====================
    if (loading) {
        return (
            <PageShell className="student-dashboard">
                <div className="student-dashboard__header">
                    <Skeleton lines={2} gap="0.5rem" className="max-w-md" />
                </div>
                <div className="student-dashboard__stats-grid">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="student-dashboard__stat-card student-dashboard__stat-card--primary">
                            <Skeleton lines={2} gap="0.5rem" />
                        </div>
                    ))}
                </div>
                <div className="student-dashboard__section-card">
                    <Skeleton lines={1} className="w-48 mb-6" />
                    <div className="student-dashboard__subjects-grid">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="student-dashboard__subject-card">
                                <Skeleton lines={3} gap="0.75rem" />
                            </div>
                        ))}
                    </div>
                </div>
            </PageShell>
        );
    }

    // ==================== Empty state ====================
    if (!student || !currentClass) {
        return (
            <PageShell className="student-dashboard">
                <div className="student-dashboard__header">
                    <h1 className="student-dashboard__title">Student Dashboard</h1>
                    <p className="student-dashboard__subtitle">Welcome back, {student?.fullname ?? "Student"}</p>
                </div>
                <div className="student-dashboard__section-card">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 text-xl" aria-hidden="true">
                            <FiHome />
                        </span>
                        <p className="mt-3 text-base font-bold text-neutral-800">No classes found</p>
                        <p className="mt-1 text-sm text-neutral-500 max-w-sm">
                            You are not enrolled in any class yet. Contact the registrar if you believe this is a mistake.
                        </p>
                    </div>
                </div>
            </PageShell>
        );
    }

    // ==================== Derived data ====================
    const subjects = currentClass.subjects ?? [];
    const totalSubjects = subjects.length;

    return (
        <PageShell className="student-dashboard">
            {/* ==================== Header ==================== */}
            <header className="student-dashboard__header">
                <h1 className="student-dashboard__title">Student Dashboard</h1>
                <p className="student-dashboard__subtitle">
                    Welcome back, <span className="student-dashboard__subtitle-highlight">{student.fullname}</span>. School Year: <span className="student-dashboard__subtitle-highlight">{currentClass.schoolYear}</span>
                </p>
            </header>

            {/* ==================== 4 Stat Cards ==================== */}
            <div className="student-dashboard__stats-grid">
                {/* 1. MY CLASS */}
                <div className="student-dashboard__stat-card student-dashboard__stat-card--primary">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--primary" aria-hidden="true">
                        <FiBookOpen />
                    </span>
                    <div>
                        <span className="student-dashboard__stat-label block">MY CLASS</span>
                        <span className="student-dashboard__stat-value block">
                            Grade {currentClass.gradeLevel} - {currentClass.section}
                        </span>
                    </div>
                </div>

                {/* 2. SUBJECTS */}
                <div className="student-dashboard__stat-card student-dashboard__stat-card--accent">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--accent" aria-hidden="true">
                        <FiAward />
                    </span>
                    <div>
                        <span className="student-dashboard__stat-label block">SUBJECTS</span>
                        <span className="student-dashboard__stat-value block">
                            {totalSubjects}
                        </span>
                    </div>
                </div>

                {/* 3. ADVISER */}
                <div className="student-dashboard__stat-card student-dashboard__stat-card--dark">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--dark" aria-hidden="true">
                        <FiUser />
                    </span>
                    <div>
                        <span className="student-dashboard__stat-label block">ADVISER</span>
                        <span className="student-dashboard__stat-value block truncate" title={currentClass.adviser ?? undefined}>
                            {currentClass.adviser ?? "—"}
                        </span>
                    </div>
                </div>

                {/* 4. STATUS */}
                <div className="student-dashboard__stat-card student-dashboard__stat-card--status">
                    <span className="student-dashboard__stat-icon student-dashboard__stat-icon--status" aria-hidden="true">
                        <FiCalendar />
                    </span>
                    <div>
                        <span className="student-dashboard__stat-label block">STATUS</span>
                        <span className="student-dashboard__status-pill">
                            Active
                        </span>
                    </div>
                </div>
            </div>

            {/* ==================== Attendance by Subject ==================== */}
            <section className="student-dashboard__section-card" aria-label="Attendance by Subject">
                <div className="student-dashboard__section-header">
                    <h2 className="student-dashboard__section-title">ATTENDANCE BY SUBJECT</h2>
                </div>

                {subjects.length === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">No subjects found for this class.</p>
                ) : (
                    <div className="student-dashboard__subjects-grid">
                        {subjects.map((subject) => {
                            const att = subject.attendance?.find((a) => a.quarter === currentQuarter);
                            const total = att?.totalDays ?? 0;
                            const present = att?.presentDays ?? 0;
                            const absent = Math.max(0, total - present);
                            const rate = att?.percentage !== null && att?.percentage !== undefined
                                ? Math.round(att.percentage)
                                : (total > 0 ? Math.round((present / total) * 100) : 0);

                            return (
                                <div
                                    key={subject.classSubjectId ?? subject.name}
                                    className="student-dashboard__subject-card"
                                    onClick={() => navigate("/student/classrooms")}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            navigate("/student/classrooms");
                                        }
                                    }}
                                >
                                    <div className="student-dashboard__subject-head">
                                        <span className="student-dashboard__subject-icon" aria-hidden="true">
                                            <FiBookOpen />
                                        </span>
                                        <div className="student-dashboard__subject-info">
                                            <h3 className="student-dashboard__subject-name" title={subject.name}>
                                                {subject.name}
                                            </h3>
                                            <p
                                                className="student-dashboard__subject-sub"
                                                title={`Grade ${currentClass.gradeLevel} - ${currentClass.section}${subject.faculty ? ` • ${subject.faculty}` : ""}`}
                                            >
                                                Grade {currentClass.gradeLevel} - {currentClass.section}
                                                {subject.faculty ? ` • ${subject.faculty}` : ""}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="student-dashboard__metrics-row">
                                        <div className="student-dashboard__metric">
                                            <span className="student-dashboard__metric-label">TOTAL</span>
                                            <span className="student-dashboard__metric-value">{total}</span>
                                        </div>
                                        <div className="student-dashboard__metric">
                                            <span className="student-dashboard__metric-label">PRESENT</span>
                                            <span className="student-dashboard__metric-value student-dashboard__metric-value--present">
                                                {present}
                                            </span>
                                        </div>
                                        <div className="student-dashboard__metric">
                                            <span className="student-dashboard__metric-label">ABSENT</span>
                                            <span className="student-dashboard__metric-value student-dashboard__metric-value--absent">
                                                {absent}
                                            </span>
                                        </div>
                                        <div className="student-dashboard__metric">
                                            <span className="student-dashboard__metric-label">RATE</span>
                                            <span
                                                className={`student-dashboard__metric-value ${
                                                    rate > 0
                                                        ? "student-dashboard__metric-value--rate-good"
                                                        : "student-dashboard__metric-value--rate-low"
                                                }`}
                                            >
                                                {rate}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </PageShell>
    );
}
