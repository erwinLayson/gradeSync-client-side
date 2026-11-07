import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FacultyStudentRecords from "../pages/faculty/FacultyStudentRecords";
import * as studentRecordApi from "../api/studentRecord";
import type { TeacherSubjectOption, SubjectClassRecordResponse } from "../constant/studentRecord";

vi.mock("../hooks/useAcademicSettings", () => ({
    useAcademicSettings: () => ({
        quarters: [1, 2, 3, 4],
        numQuarters: 4,
        currentQuarter: 1,
        enrollmentOpen: true,
        submissionsLocked: false,
    }),
}));

vi.mock("../hooks/useMyAmendments", () => ({
    useMyAmendments: () => ({
        permissions: [],
        pendingRequests: [],
        hasActivePermission: vi.fn().mockReturnValue(false),
        getPendingRequest: vi.fn().mockReturnValue(undefined),
        refresh: vi.fn(),
    }),
}));

vi.mock("../api/api", () => ({
    getAPICall: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/academic-settings")) {
            return Promise.resolve({ data: { submissionsLocked: false } });
        }
        if (url.includes("/student-records/my-class")) {
            return Promise.reject(new Error("Not an adviser"));
        }
        return Promise.resolve({ data: null });
    }),
    postAPICall: vi.fn().mockResolvedValue({ data: {} }),
}));

vi.mock("../api/studentRecord", () => ({
    getMyAssignedSubjects: vi.fn(),
    getSubjectClassRecords: vi.fn(),
    submitSubjectRecords: vi.fn(),
    submitSingleStudentSubjectRecord: vi.fn(),
    reopenSubjectRecord: vi.fn(),
    getSubjectStudentAmendData: vi.fn().mockResolvedValue({
        message: "Success",
        success: true,
        data: {
            permission: { id: 77, requestId: 88, status: "active", expiresAt: "2026-11-08T00:00:00Z", recordType: "subject_record" },
            request: { id: 88, requestNumber: "AMD-2026-0001", status: "approved", reason: "Score encoding error", quarter: 1 },
            student: { enrollmentId: 201, fullname: "Juan Dela Cruz", studentLrn: "111111111111" },
            classSubject: { id: 101, subjectName: "Science 10", subjectCode: "SCI10", classSection: "Emerald", classGradeLevel: 10 },
            assessments: [
                { id: 1, title: "Written Work #1", type: "written_work", maxScore: 50, currentScore: 40 }
            ],
            attendance: [
                { id: 1, date: "2026-11-03", status: "absent" }
            ]
        }
    }),
}));

const mockSubjects: TeacherSubjectOption[] = [
    {
        classSubjectId: 101,
        subjectId: 1,
        subjectName: "Science 10",
        subjectCode: "SCI10",
        subjectUnit: 1,
        classId: 10,
        classSection: "Emerald",
        classGradeLevel: 10,
        totalStudents: 2,
        submissionStatus: { 1: "pending", 2: "pending", 3: "pending", 4: "pending" },
    },
    {
        classSubjectId: 102,
        subjectId: 2,
        subjectName: "Mathematics 10",
        subjectCode: "MATH10",
        subjectUnit: 1,
        classId: 11,
        classSection: "Diamond",
        classGradeLevel: 10,
        totalStudents: 1,
        submissionStatus: { 1: "submitted", 2: "pending", 3: "pending", 4: "pending" },
    },
];

const mockSubject101Records: SubjectClassRecordResponse = {
    classSubjectId: 101,
    subjectId: 1,
    subjectName: "Science 10",
    subjectCode: "SCI10",
    classId: 10,
    classSection: "Emerald",
    classGradeLevel: 10,
    quarter: 1,
    isSubjectSubmitted: false,
    submittedAt: null,
    submittedBy: null,
    students: [
        {
            enrollmentId: 201,
            studentId: 1,
            studentLrn: "111111111111",
            fullname: "Juan Dela Cruz",
            studentSex: "Male",
            writtenWorkScore: 90,
            performanceTaskScore: 85,
            quarterlyAssessmentScore: 88,
            attendancePresentDays: 45,
            attendanceTotalDays: 50,
            attendanceRate: 90,
            quarterGrade: 88.5,
            source: "computed",
            isFrozen: false,
            status: "pending",
            submittedAt: null,
            hasActiveAmendment: false,
        },
        {
            enrollmentId: 202,
            studentId: 2,
            studentLrn: "222222222222",
            fullname: "Maria Santos",
            studentSex: "Female",
            writtenWorkScore: 92,
            performanceTaskScore: 90,
            quarterlyAssessmentScore: 95,
            attendancePresentDays: 50,
            attendanceTotalDays: 50,
            attendanceRate: 100,
            quarterGrade: 92.0,
            source: "computed",
            isFrozen: false,
            status: "pending",
            submittedAt: null,
            hasActiveAmendment: false,
        },
    ],
    progress: { total: 2, submitted: 0, pending: 2 },
};

describe("FacultyStudentRecords Component (Subject Teacher Ownership)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(studentRecordApi.getMyAssignedSubjects).mockResolvedValue({
            message: "Success",
            success: true,
            data: mockSubjects,
        });
        vi.mocked(studentRecordApi.getSubjectClassRecords).mockResolvedValue({
            message: "Success",
            success: true,
            data: mockSubject101Records,
        });
    });

    it("renders assigned subjects without requiring class adviser designation", async () => {
        render(<FacultyStudentRecords />);

        await waitFor(() => {
            expect(screen.getAllByText("Science 10").length).toBeGreaterThan(0);
        });

        await waitFor(() => {
            expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
        });

        // Verifies subjects are listed and switcher is visible
        expect(screen.getByText(/Science 10 Students/i)).toBeInTheDocument();
        expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    });

    it("displays gradebook scores and subject attendance for enrolled students", async () => {
        render(<FacultyStudentRecords />);

        await waitFor(() => {
            expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
        });

        // Scores and attendance
        expect(screen.getByText("45 / 50 days")).toBeInTheDocument();
        expect(screen.getByText("(90%)")).toBeInTheDocument();
        expect(screen.getByText("50 / 50 days")).toBeInTheDocument();

        // Real component scores: Written Work, Performance Task, Quarterly Exam
        // Juan has WW: 90.00, PT: 85.00, QA: 88.00. Maria has WW: 92.00, PT: 90.00, QA: 95.00, Q1 Grade: 92.00.
        expect(screen.getAllByText("90.00").length).toBe(2);
        expect(screen.getByText("85.00")).toBeInTheDocument();
        expect(screen.getByText("88.00")).toBeInTheDocument();
        expect(screen.getAllByText("92.00").length).toBe(2);
        expect(screen.getByText("95.00")).toBeInTheDocument();
    });

    it("submits a single student's record when Submit button is clicked", async () => {
        vi.mocked(studentRecordApi.submitSingleStudentSubjectRecord).mockResolvedValue({
            message: "Submitted",
            success: true,
            data: { enrollmentId: 201, quarter: 1, status: "submitted" },
        });

        const user = userEvent.setup();
        render(<FacultyStudentRecords />);

        await waitFor(() => {
            expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
        });

        const submitButtons = screen.getAllByRole("button", { name: /^submit$/i });
        expect(submitButtons.length).toBeGreaterThan(0);

        await user.click(submitButtons[0]!);

        await waitFor(() => {
            expect(studentRecordApi.submitSingleStudentSubjectRecord).toHaveBeenCalledWith(101, 201, 1);
        });
    });

    it("opens the submit all confirmation dialog when clicking Submit All Pending", async () => {
        const user = userEvent.setup();
        render(<FacultyStudentRecords />);

        await waitFor(() => {
            expect(screen.getByText(/Submit All Pending/i)).toBeInTheDocument();
        });

        await user.click(screen.getByText(/Submit All Pending/i));

        expect(screen.getByText(/Submit all records for Science 10\?/i)).toBeInTheDocument();
    });

    it("opens AmendStudentRecordModal when clicking Amend Record for an authorized student", async () => {
        const authorizedRecords: SubjectClassRecordResponse = {
            ...mockSubject101Records,
            students: [
                {
                    ...mockSubject101Records.students[0]!,
                    status: "submitted",
                    isFrozen: true,
                    hasActiveAmendment: true,
                    activePermissionId: 77,
                    amendmentStatus: "approved",
                },
                mockSubject101Records.students[1]!,
            ],
        };

        vi.mocked(studentRecordApi.getSubjectClassRecords).mockResolvedValue({
            message: "Success",
            success: true,
            data: authorizedRecords,
        });

        const user = userEvent.setup();
        render(<FacultyStudentRecords />);

        await waitFor(() => {
            expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
        });

        const amendBtn = screen.getByRole("button", { name: /Amend Record/i });
        expect(amendBtn).toBeInTheDocument();

        await user.click(amendBtn);

        await waitFor(() => {
            expect(screen.getByText("Amend Student Records")).toBeInTheDocument();
            expect(screen.getByText(/Written Work Assessments/i)).toBeInTheDocument();
        });
    });

    it("displays Pending Review badge and disables request button when amendment is pending", async () => {
        const pendingRecords: SubjectClassRecordResponse = {
            ...mockSubject101Records,
            students: [
                {
                    ...mockSubject101Records.students[0]!,
                    status: "submitted",
                    isFrozen: true,
                    hasActiveAmendment: false,
                    activePermissionId: null,
                    amendmentStatus: "pending",
                },
                mockSubject101Records.students[1]!,
            ],
        };

        vi.mocked(studentRecordApi.getSubjectClassRecords).mockResolvedValue({
            message: "Success",
            success: true,
            data: pendingRecords,
        });

        render(<FacultyStudentRecords />);

        await waitFor(() => {
            expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
        });

        expect(screen.getByText(/Pending Review/i)).toBeInTheDocument();
        expect(screen.getByText(/Request Pending/i)).toBeInTheDocument();
    });
});
