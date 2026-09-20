import { useState } from "react";
import {
    FiBarChart2,
    FiBookOpen,
    FiCheck,
    FiClipboard,
    FiDownload,
    FiFileText,
    FiFile,
    FiPrinter,
    FiUserCheck,
    FiUsers
} from "react-icons/fi";

import { PageCard } from "../../components/PageCard";
import { useAcademicSettings } from "../../hooks/useAcademicSettings";
import "../../style/adminReports.css";

// ==================== Hardcoded sample data (client-side only) ====================

const REPORT_TYPES = [
    {
        id: "master",
        label: "Student Master List",
        description: "All student records with LRN, demographics, and contact details.",
        meta: "1,248 records",
        icon: FiUsers
    },
    {
        id: "roster",
        label: "Class Roster",
        description: "Students grouped by class section with advisers and grade levels.",
        meta: "32 classes",
        icon: FiClipboard
    },
    {
        id: "grade",
        label: "Grade Sheet",
        description: "Quarterly grades per subject with final remarks for each learner.",
        meta: "4 quarters",
        icon: FiBarChart2
    },
    {
        id: "attendance",
        label: "Attendance Report",
        description: "Daily attendance summaries and present rates per class section.",
        meta: "SY 2025–2026",
        icon: FiUserCheck
    },
    {
        id: "teacher",
        label: "Teacher Load",
        description: "Teacher assignments, subject loads, and classes handled.",
        meta: "10 teachers",
        icon: FiBookOpen
    },
    {
        id: "subject",
        label: "Subject Directory",
        description: "Offered subjects with subject codes, units, and grade levels.",
        meta: "12 subjects",
        icon: FiFileText
    }
];

type ReportTypeId = "master" | "roster" | "grade" | "attendance" | "teacher" | "subject";

// Hardcoded preview rows per report type.
const MASTER_ROWS = [
    { lrn: "136840120001", name: "Alexandra R. Garcia", sex: "Male", grade: "Grade 7", section: "Section A" },
    { lrn: "136840120002", name: "Carlo T. Mendoza", sex: "Male", grade: "Grade 7", section: "Section B" },
    { lrn: "136840120003", name: "Diana L. Lorenzo", sex: "Female", grade: "Grade 8", section: "Section C" },
    { lrn: "136840120004", name: "Eduardo V. Silva", sex: "Male", grade: "Grade 8", section: "Section D" },
    { lrn: "136840120005", name: "Francesca M. Cruz", sex: "Female", grade: "Grade 9", section: "Section E" },
    { lrn: "136840120006", name: "Hannah P. Aguilar", sex: "Female", grade: "Grade 9", section: "Section F" }
];

const ROSTER_ROWS = [
    { section: "Section A - G7", adviser: "Juan Dela Cruz", students: 42, enrolled: 40 },
    { section: "Section B - G7", adviser: "Maria Santos", students: 40, enrolled: 39 },
    { section: "Section C - G8", adviser: "Carlos Reyes", students: 45, enrolled: 44 },
    { section: "Section D - G8", adviser: "Ana Gonzales", students: 43, enrolled: 43 },
    { section: "Section E - G9", adviser: "Pedro Ramos", students: 41, enrolled: 38 },
    { section: "Section F - G9", adviser: "Luz Villanueva", students: 39, enrolled: 37 }
];

const GRADE_ROWS = [
    { name: "Alexandra R. Garcia", subject: "Mathematics", q1: 91.9, q2: 88.8, q3: 90.1, q4: 92.4, final: 90.8, remarks: "Passed" },
    { name: "Carlo T. Mendoza", subject: "English", q1: 88.2, q2: 86.4, q3: 89.0, q4: 87.6, final: 87.8, remarks: "Passed" },
    { name: "Diana L. Lorenzo", subject: "Science", q1: 84.5, q2: 85.2, q3: 83.9, q4: 86.1, final: 84.9, remarks: "Passed" },
    { name: "Eduardo V. Silva", subject: "Filipino", q1: 82.0, q2: 80.6, q3: 81.4, q4: 83.2, final: 81.8, remarks: "Passed" },
    { name: "Francesca M. Cruz", subject: "Mathematics", q1: 79.3, q2: 81.0, q3: 78.5, q4: 80.2, final: 79.8, remarks: "Passed" },
    { name: "Hannah P. Aguilar", subject: "Science", q1: 70.5, q2: 72.1, q3: 69.8, q4: 71.4, final: 70.9, remarks: "Failed" }
];

const ATTENDANCE_ROWS = [
    { section: "Section A - G7", present: 936, absent: 64, rate: 93.6 },
    { section: "Section B - G7", present: 902, absent: 98, rate: 90.2 },
    { section: "Section C - G8", present: 968, absent: 32, rate: 96.8 },
    { section: "Section D - G8", present: 945, absent: 55, rate: 94.5 },
    { section: "Section E - G9", present: 891, absent: 109, rate: 89.1 },
    { section: "Section F - G9", present: 926, absent: 74, rate: 92.6 }
];

const TEACHER_ROWS = [
    { name: "Juan Dela Cruz", subject: "Mathematics", classes: 3, units: 9 },
    { name: "Maria Santos", subject: "English", classes: 2, units: 6 },
    { name: "Carlos Reyes", subject: "Science", classes: 2, units: 6 },
    { name: "Ana Gonzales", subject: "Araling Panlipunan", classes: 2, units: 4 },
    { name: "Pedro Ramos", subject: "Filipino", classes: 1, units: 3 },
    { name: "Luz Villanueva", subject: "Values Education", classes: 2, units: 4 }
];

const SUBJECT_ROWS = [
    { code: "MATH101", name: "Mathematics", units: 3, levels: "7–10" },
    { code: "ENG101", name: "English", units: 3, levels: "7–10" },
    { code: "SCI101", name: "Science", units: 3, levels: "7–10" },
    { code: "FIL101", name: "Filipino", units: 3, levels: "7–10" },
    { code: "AP101", name: "Araling Panlipunan", units: 2, levels: "7–10" },
    { code: "MAPEH101", name: "MAPEH", units: 2, levels: "7–10" }
];

const RECENT_REPORTS = [
    { name: "Student Master List", date: "Aug 10, 2026", format: "PDF", size: "2.4 MB" },
    { name: "Grade Sheet — Quarter 2", date: "Aug 08, 2026", format: "Excel", size: "1.1 MB" },
    { name: "Class Roster — SY 2025–2026", date: "Jul 30, 2026", format: "PDF", size: "860 KB" },
    { name: "Attendance Summary — Q1", date: "Jul 22, 2026", format: "CSV", size: "340 KB" }
];

const SCHOOL_YEARS = ["2025–2026", "2024–2025", "2023–2024"];
const GRADE_LEVELS = ["All Levels", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const SECTIONS = ["All Sections", "Section A", "Section B", "Section C", "Section D"];
const FORMATS = ["PDF", "Excel", "CSV"];

// ==================== Preview rendering ====================

function PreviewTable({ type }: { type: ReportTypeId }) {
    const { numQuarters } = useAcademicSettings();
    if (type === "master") {
        return (
            <table className="reports__table w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="px-6 py-3">LRN</th>
                        <th className="px-6 py-3">Student Name</th>
                        <th className="px-6 py-3">Sex</th>
                        <th className="px-6 py-3">Grade Level</th>
                        <th className="px-6 py-3">Section</th>
                    </tr>
                </thead>
                <tbody>
                    {MASTER_ROWS.map((row) => (
                        <tr key={row.lrn}>
                            <td className="reports__cell--lrn px-6 py-3.5">{row.lrn}</td>
                            <td className="reports__cell--name px-6 py-3.5">{row.name}</td>
                            <td className="px-6 py-3.5">
                                <span className="reports__sex-chip inline-flex px-2.5 py-0.5 text-[0.6875rem] font-semibold">{row.sex}</span>
                            </td>
                            <td className="px-6 py-3.5">{row.grade}</td>
                            <td className="reports__cell--muted px-6 py-3.5">{row.section}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    if (type === "roster") {
        return (
            <table className="reports__table w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="px-6 py-3">Class Section</th>
                        <th className="px-6 py-3">Adviser</th>
                        <th className="px-6 py-3">Enrolled</th>
                        <th className="px-6 py-3">Present</th>
                    </tr>
                </thead>
                <tbody>
                    {ROSTER_ROWS.map((row) => (
                        <tr key={row.section}>
                            <td className="reports__cell--name px-6 py-3.5">{row.section}</td>
                            <td className="px-6 py-3.5">{row.adviser}</td>
                            <td className="px-6 py-3.5">{row.students}</td>
                            <td className="reports__cell--muted px-6 py-3.5">{row.enrolled}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    if (type === "grade") {
        const quarterKeys = Array.from({ length: numQuarters }, (_, i) => `q${i + 1}` as const);
        return (
            <table className="reports__table w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="px-6 py-3">Student</th>
                        <th className="px-6 py-3">Subject</th>
                        {quarterKeys.map((q, i) => (
                            <th key={q} className="px-6 py-3">Q{i + 1}</th>
                        ))}
                        <th className="px-6 py-3">Final</th>
                        <th className="px-6 py-3">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {GRADE_ROWS.map((row) => (
                        <tr key={row.name}>
                            <td className="reports__cell--name px-6 py-3.5">{row.name}</td>
                            <td className="reports__cell--muted px-6 py-3.5">{row.subject}</td>
                            {quarterKeys.map((q) => (
                                <td key={q} className="px-6 py-3.5 font-mono">{(row as unknown as Record<string, number>)[q].toFixed(1)}</td>
                            ))}
                            <td className="px-6 py-3.5 font-mono font-bold">{row.final.toFixed(1)}</td>
                            <td className="px-6 py-3.5">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold ${row.remarks === "Passed" ? "bg-[#EAF5EE] text-[#176B3A]" : "bg-[#FEF2F2] text-[#EF4444]"}`}>
                                    {row.remarks}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    if (type === "attendance") {
        return (
            <table className="reports__table w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="px-6 py-3">Class Section</th>
                        <th className="px-6 py-3">Present</th>
                        <th className="px-6 py-3">Absent</th>
                        <th className="px-6 py-3">Present Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {ATTENDANCE_ROWS.map((row) => (
                        <tr key={row.section}>
                            <td className="reports__cell--name px-6 py-3.5">{row.section}</td>
                            <td className="px-6 py-3.5">{row.present}</td>
                            <td className="reports__cell--muted px-6 py-3.5">{row.absent}</td>
                            <td className="px-6 py-3.5">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[0.6875rem] font-bold ${row.rate >= 90 ? "bg-[#EAF5EE] text-[#176B3A]" : "bg-[#FEF3C7] text-[#B45309]"}`}>
                                    {row.rate}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    if (type === "teacher") {
        return (
            <table className="reports__table w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="px-6 py-3">Teacher</th>
                        <th className="px-6 py-3">Subject</th>
                        <th className="px-6 py-3">Classes</th>
                        <th className="px-6 py-3">Units</th>
                    </tr>
                </thead>
                <tbody>
                    {TEACHER_ROWS.map((row) => (
                        <tr key={row.name}>
                            <td className="reports__cell--name px-6 py-3.5">{row.name}</td>
                            <td className="reports__cell--muted px-6 py-3.5">{row.subject}</td>
                            <td className="px-6 py-3.5">{row.classes}</td>
                            <td className="px-6 py-3.5 font-mono">{row.units}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    return (
        <table className="reports__table w-full min-w-[42rem] border-collapse text-sm">
            <thead>
                <tr>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Units</th>
                    <th className="px-6 py-3">Grade Levels</th>
                </tr>
            </thead>
            <tbody>
                {SUBJECT_ROWS.map((row) => (
                    <tr key={row.code}>
                        <td className="reports__cell--lrn px-6 py-3.5">{row.code}</td>
                        <td className="reports__cell--name px-6 py-3.5">{row.name}</td>
                        <td className="px-6 py-3.5 font-mono">{row.units}</td>
                        <td className="reports__cell--muted px-6 py-3.5">{row.levels}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ==================== Page ====================

export default function AdminReports() {
    const { numQuarters } = useAcademicSettings();
    const QUARTERS = ["All Quarters", ...Array.from({ length: numQuarters }, (_, i) => `Quarter ${i + 1}`)];
    const reportTypes = REPORT_TYPES.map(t => t.id === "grade" ? { ...t, meta: `${numQuarters} quarters` } : t);
    const [selectedType, setSelectedType] = useState<ReportTypeId>("master");
    const [schoolYear, setSchoolYear] = useState(SCHOOL_YEARS[0]!);
    const [gradeLevel, setGradeLevel] = useState(GRADE_LEVELS[0]!);
    const [section, setSection] = useState(SECTIONS[0]!);
    const [quarter, setQuarter] = useState(QUARTERS[0]!);
    const [format, setFormat] = useState(FORMATS[0]!);

    const activeReport = reportTypes.find((type) => type.id === selectedType) ?? reportTypes[0]!;

    return (
        <section className="reports flex flex-col gap-5">
            {/* ==================== Report type picker ==================== */}
            <PageCard className="reports__card">
                <div className="reports__header flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="reports__heading min-w-0">
                        <span className="reports__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Report Builder</span>
                        <h2 className="reports__title mt-1 text-base font-bold">Choose a report type</h2>
                        <p className="reports__subtitle mt-1 text-[0.8125rem]">Select the report you want to generate, then preview it below.</p>
                    </div>
                    <span className="reports__preview-badge inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold">
                        {reportTypes.length} report types
                    </span>
                </div>

                <div className="reports__types grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {reportTypes.map((type) => {
                        const Icon = type.icon;
                        const isActive = type.id === selectedType;
                        return (
                            <button
                                key={type.id}
                                type="button"
                                className={`reports__type relative flex flex-col items-start gap-3 p-4 text-left ${isActive ? "reports__type--active" : ""}`}
                                onClick={() => setSelectedType(type.id as ReportTypeId)}
                                aria-pressed={isActive}
                            >
                                <div className="flex w-full items-start justify-between gap-3">
                                    <span className="reports__type-icon inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                                        <Icon />
                                    </span>
                                    {isActive && (
                                        <span className="reports__type-check inline-flex h-6 w-6 items-center justify-center rounded-full text-xs" aria-hidden="true">
                                            <FiCheck />
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="reports__type-name text-[0.9375rem] font-bold">{type.label}</h3>
                                    <p className="reports__type-desc mt-1 text-[0.8125rem] leading-relaxed">{type.description}</p>
                                </div>
                                <span className="reports__type-meta mt-auto inline-flex rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">{type.meta}</span>
                            </button>
                        );
                    })}
                </div>
            </PageCard>

            {/* ==================== Filters ==================== */}
            <PageCard className="reports__card">
                <div className="reports__toolbar flex flex-wrap items-end gap-4 p-5">
                    {[
                        { label: "School Year", value: schoolYear, setter: setSchoolYear, options: SCHOOL_YEARS },
                        { label: "Grade Level", value: gradeLevel, setter: setGradeLevel, options: GRADE_LEVELS },
                        { label: "Section", value: section, setter: setSection, options: SECTIONS },
                        { label: "Quarter", value: quarter, setter: setQuarter, options: QUARTERS },
                        { label: "Format", value: format, setter: setFormat, options: FORMATS }
                    ].map((field) => (
                        <label key={field.label} className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
                            <span className="reports__field-label text-[0.6875rem] font-bold uppercase tracking-[0.08em]">{field.label}</span>
                            <select
                                className="reports__select w-full rounded-lg border px-3 py-2.5 text-sm"
                                value={field.value}
                                onChange={(event) => field.setter(event.target.value)}
                            >
                                {field.options.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                    ))}
                </div>
            </PageCard>

            {/* ==================== Preview ==================== */}
            <PageCard className="reports__card">
                <div className="reports__preview-head flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                        <span className="reports__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">Preview</span>
                        <h3 className="reports__title mt-1 text-base font-bold">
                            {activeReport.label}
                            <span className="reports__preview-badge ml-2 inline-flex rounded-full px-2.5 py-0.5 align-middle text-[0.6875rem] font-semibold">
                                {format}
                            </span>
                        </h3>
                        <p className="reports__subtitle mt-1 text-[0.8125rem]">
                            {schoolYear} · {gradeLevel} · {section} · {quarter} · Showing the first 6 records
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="reports__btn reports__btn--ghost inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold">
                            <FiPrinter aria-hidden="true" />
                            Print
                        </button>
                        <button type="button" className="reports__btn inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold">
                            <FiDownload aria-hidden="true" />
                            Download {format}
                        </button>
                    </div>
                </div>

                <div className="reports__preview overflow-x-auto">
                    <PreviewTable type={selectedType} />
                </div>

                <div className="flex items-center justify-between gap-3 border-t p-4">
                    <p className="reports__subtitle flex items-center gap-2 text-[0.8125rem]">
                        <FiFile aria-hidden="true" />
                        Sample data only — connect to the live database for the full report.
                    </p>
                    <span className="reports__preview-badge inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold">6 of 1,248</span>
                </div>
            </PageCard>

            {/* ==================== Recent reports ==================== */}
            <PageCard className="reports__card">
                <div className="reports__header flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                        <span className="reports__eyebrow text-[0.625rem] font-bold uppercase tracking-[0.12em]">History</span>
                        <h3 className="reports__title mt-1 text-base font-bold">Recent reports</h3>
                        <p className="reports__subtitle mt-1 text-[0.8125rem]">Previously generated reports, ready to download again.</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 p-5 pt-0">
                    {RECENT_REPORTS.map((report) => (
                        <div key={report.name} className="reports__recent-row flex items-center gap-4 p-4">
                            <span className="reports__recent-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base" aria-hidden="true">
                                <FiFileText />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="reports__recent-name truncate text-[0.875rem] font-bold">{report.name}</p>
                                <p className="reports__recent-meta mt-0.5 text-[0.75rem]">{report.date} · {report.size}</p>
                            </div>
                            <span className="reports__format-chip inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold">{report.format}</span>
                            <button
                                type="button"
                                className="reports__recent-download inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm"
                                aria-label={`Download ${report.name}`}
                            >
                                <FiDownload aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            </PageCard>
        </section>
    );
}