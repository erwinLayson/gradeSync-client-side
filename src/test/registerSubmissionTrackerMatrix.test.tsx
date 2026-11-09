import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterStudentRecords from "../pages/register/RegisterStudentRecords";

// Mock API calls
vi.mock("../api/api", () => ({
    getAPICall: vi.fn(),
    patchAPICall: vi.fn(),
}));

vi.mock("../api/studentRecord", () => ({
    getSubjectSubmissionSummary: vi.fn(),
    getSubjectClassRecords: vi.fn(),
}));

vi.mock("../hooks/useAcademicSettings", () => ({
    useAcademicSettings: () => ({
        numQuarters: 4,
        quarters: [1, 2, 3, 4],
        currentQuarter: 1,
        loading: false,
    }),
    notifyAcademicSettingsUpdated: vi.fn(),
}));

import { getAPICall } from "../api/api";
import { getSubjectSubmissionSummary, getSubjectClassRecords } from "../api/studentRecord";

describe("Register Submission Tracker — Unified Spreadsheet Matrix", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock responses
        vi.mocked(getAPICall).mockImplementation(async (url: string) => {
            if (url === "/schoolYear") {
                return {
                    success: true,
                    message: "Success",
                    data: [
                        { id: 1, startYear: 2026, endYear: 2027, isActive: true },
                    ],
                };
            }
            if (url === "/academic-settings") {
                return {
                    success: true,
                    message: "Success",
                    data: {
                        id: 1,
                        currentQuarter: 1,
                        numQuarters: 4,
                        enrollmentOpen: true,
                        submissionsLocked: false,
                    },
                };
            }
            if (url.startsWith("/student-records/summary")) {
                return {
                    success: true,
                    message: "Success",
                    data: [
                        {
                            classId: 10,
                            section: "Rizal",
                            gradeLevel: 7,
                            adviserId: 1,
                            adviserFullname: "Erwin Sage Layson",
                            totalStudents: 2,
                            submitted: { 1: 2, 2: 0, 3: 0, 4: 0 },
                        },
                    ],
                };
            }
            return { success: true, message: "OK", data: null };
        });

        vi.mocked(getSubjectSubmissionSummary).mockResolvedValue({
            success: true,
            message: "Success",
            data: [
                {
                    classSubjectId: 1,
                    subjectId: 101,
                    subjectName: "Mathematics",
                    subjectCode: "Math-001",
                    classId: 10,
                    classSection: "Rizal",
                    classGradeLevel: 7,
                    teacherId: 1,
                    teacherName: "Erwin Sage Layson",
                    totalStudents: 2,
                    submitted: { 1: 2, 2: 0, 3: 0, 4: 0 },
                    statusByQuarter: { 1: "submitted", 2: "pending", 3: "pending", 4: "pending" },
                },
            ],
        });

        vi.mocked(getSubjectClassRecords).mockResolvedValue({
            success: true,
            message: "Success",
            data: {
                classSubjectId: 1,
                subjectId: 101,
                subjectName: "Mathematics",
                subjectCode: "Math-001",
                classId: 10,
                classSection: "Rizal",
                classGradeLevel: 7,
                quarter: 1,
                isSubjectSubmitted: true,
                submittedAt: "2026-11-09T08:00:00Z",
                submittedBy: 1,
                submittedByName: "Erwin Sage Layson",
                students: [
                    {
                        enrollmentId: 1001,
                        studentId: 1,
                        studentLrn: "123456789001",
                        fullname: "Doe, Jane, Sans",
                        studentSex: "Female",
                        writtenWorkScore: 100,
                        performanceTaskScore: 100,
                        quarterlyAssessmentScore: 100,
                        attendancePresentDays: 1,
                        attendanceTotalDays: 1,
                        attendanceRate: 100,
                        quarterGrade: 100,
                        source: "frozen",
                        isFrozen: true,
                        status: "submitted",
                        submittedAt: "2026-11-09T08:00:00Z",
                        hasActiveAmendment: false,
                    },
                ],
                progress: { total: 1, submitted: 1, pending: 0 },
            },
        });
    });

    it("renders the unified spreadsheet submission matrix with required table columns and legend", async () => {
        render(<RegisterStudentRecords />);

        // Wait for table to load
        expect(await screen.findByRole("columnheader", { name: /Classroom \/ Section/i })).toBeInTheDocument();

        // Verify legend items
        expect(screen.getByText("Submission Legend:")).toBeInTheDocument();
        expect(screen.getByText(/Complete \(100%\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Partial Submission/i)).toBeInTheDocument();
        expect(screen.getByText(/No Submissions \(0\)/i)).toBeInTheDocument();

        // Verify required table column headers in exact order
        expect(screen.getByRole("columnheader", { name: /Classroom \/ Section/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /Grade Level/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /^Subject$/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /^Students$/i })).toBeInTheDocument();

        // Verify dynamic quarter headers
        expect(screen.getByRole("columnheader", { name: /Q1/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /Q2/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /Q3/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /Q4/i })).toBeInTheDocument();

        // Verify active indicator for current quarter Q1
        expect(screen.getByText("Active")).toBeInTheDocument();

        // Verify Classroom / Section and Grade Level
        expect(screen.getByText("Rizal")).toBeInTheDocument();
        expect(screen.getByText("Grade 7")).toBeInTheDocument();

        // Verify Subject column shows Subject Name with Teacher Name underneath
        expect(screen.getByText("Mathematics")).toBeInTheDocument();
        expect(screen.getByText("Erwin Sage Layson")).toBeInTheDocument();

        // Verify Students count and quarter submission cell value
        expect(screen.getByText("2/2")).toBeInTheDocument();
    });

    it("opens detailed student submission modal when clicking a quarter cell", async () => {
        render(<RegisterStudentRecords />);

        const cellButton = await screen.findByLabelText(/Quarter 1 for Mathematics in Rizal: 2 of 2 submitted/i);
        fireEvent.click(cellButton);

        await waitFor(() => {
            // Verify modal title & header items
            expect(screen.getByText(/Mathematics \(Math-001\)/i)).toBeInTheDocument();
            expect(screen.getByText(/Rizal · Grade 7 · Quarter 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Subject Teacher:/i)).toBeInTheDocument();

            // Verify summary chips
            expect(screen.getByText(/Total Enrolled: 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Submitted: 1/i)).toBeInTheDocument();
            expect(screen.getByText(/Pending: 0/i)).toBeInTheDocument();

            // Verify individual student row
            expect(screen.getByText("Doe, Jane, Sans")).toBeInTheDocument();
            expect(screen.getByText("100.00")).toBeInTheDocument();
            expect(screen.getByText("Submitted")).toBeInTheDocument();
        });
    });

    it("groups consecutive subject rows under the same classroom section using rowSpan", async () => {
        vi.mocked(getSubjectSubmissionSummary).mockResolvedValueOnce({
            success: true,
            message: "Success",
            data: [
                {
                    classSubjectId: 1,
                    subjectId: 101,
                    subjectName: "English",
                    subjectCode: "Eng-001",
                    classId: 10,
                    classSection: "Rizal",
                    classGradeLevel: 7,
                    teacherId: 10,
                    teacherName: "John Lloyd Academia",
                    totalStudents: 40,
                    submitted: { 1: 35, 2: 0, 3: 0, 4: 0 },
                    statusByQuarter: { 1: "pending", 2: "pending", 3: "pending", 4: "pending" },
                },
                {
                    classSubjectId: 2,
                    subjectId: 102,
                    subjectName: "Mathematics",
                    subjectCode: "Math-001",
                    classId: 10,
                    classSection: "Rizal",
                    classGradeLevel: 7,
                    teacherId: 1,
                    teacherName: "Erwin Sage Layson",
                    totalStudents: 40,
                    submitted: { 1: 40, 2: 0, 3: 0, 4: 0 },
                    statusByQuarter: { 1: "submitted", 2: "pending", 3: "pending", 4: "pending" },
                },
            ],
        });

        render(<RegisterStudentRecords />);

        await waitFor(() => {
            expect(screen.getByText("English")).toBeInTheDocument();
            expect(screen.getByText("John Lloyd Academia")).toBeInTheDocument();
            expect(screen.getByText("Mathematics")).toBeInTheDocument();
        });

        // Classroom "Rizal" has rowSpan of 2
        const rizalCell = screen.getByText("Rizal").closest("td");
        expect(rizalCell).toHaveAttribute("rowspan", "2");

        // Verify subject-level submission ratios
        expect(screen.getByText("35/40")).toBeInTheDocument();
        expect(screen.getByText("40/40")).toBeInTheDocument();
    });

    it("disables advance button when a subject has not submitted records", async () => {
        vi.mocked(getSubjectSubmissionSummary).mockResolvedValueOnce({
            success: true,
            message: "Success",
            data: [
                {
                    classSubjectId: 1,
                    subjectId: 101,
                    subjectName: "Science",
                    subjectCode: "Sci-001",
                    classId: 10,
                    classSection: "Rizal",
                    classGradeLevel: 7,
                    teacherId: 2,
                    teacherName: "Maria Santos",
                    totalStudents: 2,
                    submitted: { 1: 0, 2: 0, 3: 0, 4: 0 },
                    statusByQuarter: { 1: "pending", 2: "pending", 3: "pending", 4: "pending" },
                },
            ],
        });

        render(<RegisterStudentRecords />);

        await waitFor(() => {
            const advanceBtn = screen.getByRole("button", { name: /Advance to Q2/i });
            expect(advanceBtn).toBeDisabled();
            expect(advanceBtn).toHaveAttribute(
                "title",
                "1 subject(s) have not submitted records for the current quarter",
            );
        });
    });

    it("supports filtering by class, grade level, school year, and quarter, and resets correctly", async () => {
        // Multi-classroom, multi-grade data
        vi.mocked(getAPICall).mockImplementation(async (url: string) => {
            if (url === "/schoolYear") {
                return {
                    success: true,
                    message: "Success",
                    data: [
                        { id: 1, startYear: 2026, endYear: 2027, isActive: true },
                        { id: 2, startYear: 2025, endYear: 2026, isActive: false },
                    ],
                };
            }
            if (url === "/academic-settings") {
                return {
                    success: true,
                    message: "Success",
                    data: {
                        id: 1,
                        currentQuarter: 1,
                        numQuarters: 4,
                        enrollmentOpen: true,
                        submissionsLocked: false,
                    },
                };
            }
            if (url.startsWith("/student-records/summary")) {
                return {
                    success: true,
                    message: "Success",
                    data: [
                        {
                            classId: 10,
                            section: "Rizal",
                            gradeLevel: 7,
                            adviserId: 1,
                            adviserFullname: "Erwin Sage Layson",
                            totalStudents: 2,
                            submitted: { 1: 2, 2: 0, 3: 0, 4: 0 },
                        },
                        {
                            classId: 20,
                            section: "Bonifacio",
                            gradeLevel: 8,
                            adviserId: 2,
                            adviserFullname: "Maria Santos",
                            totalStudents: 3,
                            submitted: { 1: 3, 2: 0, 3: 0, 4: 0 },
                        },
                    ],
                };
            }
            return { success: true, message: "OK", data: null };
        });

        vi.mocked(getSubjectSubmissionSummary).mockResolvedValue({
            success: true,
            message: "Success",
            data: [
                {
                    classSubjectId: 1,
                    subjectId: 101,
                    subjectName: "Mathematics",
                    subjectCode: "Math-001",
                    classId: 10,
                    classSection: "Rizal",
                    classGradeLevel: 7,
                    teacherId: 1,
                    teacherName: "Erwin Sage Layson",
                    totalStudents: 2,
                    submitted: { 1: 2, 2: 0, 3: 0, 4: 0 },
                    statusByQuarter: { 1: "submitted", 2: "pending", 3: "pending", 4: "pending" },
                },
                {
                    classSubjectId: 2,
                    subjectId: 102,
                    subjectName: "Science",
                    subjectCode: "Sci-002",
                    classId: 20,
                    classSection: "Bonifacio",
                    classGradeLevel: 8,
                    teacherId: 2,
                    teacherName: "Maria Santos",
                    totalStudents: 3,
                    submitted: { 1: 3, 2: 0, 3: 0, 4: 0 },
                    statusByQuarter: { 1: "submitted", 2: "pending", 3: "pending", 4: "pending" },
                },
            ],
        });

        render(<RegisterStudentRecords />);

        // Wait for table to load
        expect(await screen.findByText("Rizal")).toBeInTheDocument();
        expect(screen.getByText("Bonifacio")).toBeInTheDocument();

        // 1. Filter by Grade Level: Select Grade 7
        const gradeSelect = screen.getByLabelText("Filter by Grade Level");
        fireEvent.change(gradeSelect, { target: { value: "7" } });

        // Rizal (Grade 7) is shown, Bonifacio (Grade 8) is filtered out
        expect(screen.getByText("Rizal")).toBeInTheDocument();
        expect(screen.queryByText("Bonifacio")).not.toBeInTheDocument();

        // 2. Filter by Quarter: Select Quarter 1
        const quarterSelect = screen.getByLabelText("Filter by Quarter");
        fireEvent.change(quarterSelect, { target: { value: "1" } });

        // Only Q1 column is visible
        expect(screen.getByRole("columnheader", { name: /Q1/i })).toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: /Q2/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: /Q3/i })).not.toBeInTheDocument();

        // 3. Reset Filters
        const resetBtn = screen.getByRole("button", { name: /Reset Filters/i });
        fireEvent.click(resetBtn);

        // After reset, both classrooms and all 4 quarters are restored
        expect(screen.getByText("Rizal")).toBeInTheDocument();
        expect(screen.getByText("Bonifacio")).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /Q1/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /Q2/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /Q3/i })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: /Q4/i })).toBeInTheDocument();
    });
});
