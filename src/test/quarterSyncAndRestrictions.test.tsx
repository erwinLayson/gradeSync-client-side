import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import FacultyStudentRecords from "../pages/faculty/FacultyStudentRecords";
import FacultyGradebook from "../pages/faculty/FacultyGradebook";
import FacultyAttendance from "../pages/faculty/FacultyAttendance";

let mockCurrentQuarter = 2;
const mockSubmissionsLocked = false;

vi.mock("../hooks/useAcademicSettings", () => ({
    useAcademicSettings: () => ({
        quarters: [1, 2, 3, 4],
        numQuarters: 4,
        currentQuarter: mockCurrentQuarter,
        enrollmentOpen: true,
        submissionsLocked: mockSubmissionsLocked,
        settings: {
            currentQuarter: mockCurrentQuarter,
            submissionsLocked: mockSubmissionsLocked,
            numQuarters: 4,
        },
        loading: false,
    }),
    notifyAcademicSettingsUpdated: vi.fn(),
    invalidateAcademicSettingsCache: vi.fn(),
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

vi.mock("../hooks/useUser", () => ({
    useUser: () => ({
        user: { id: 1, role: "teacher", email: "teacher@test.com", fullname: "Teacher User" },
        loading: false,
    }),
}));

vi.mock("../hooks/useTeacherSubjects", () => ({
    useTeacherSubjects: () => ({
        subjects: [
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
                submissionStatus: { 1: "submitted", 2: "pending", 3: "pending", 4: "pending" },
            },
        ],
        selectedSubjectId: 101,
        selectedSubject: {
            classSubjectId: 101,
            subjectId: 1,
            subjectName: "Science 10",
            subjectCode: "SCI10",
            subjectUnit: 1,
            classId: 10,
            classSection: "Emerald",
            classGradeLevel: 10,
            totalStudents: 2,
            submissionStatus: { 1: "submitted", 2: "pending", 3: "pending", 4: "pending" },
        },
        setSelectedSubjectId: vi.fn(),
        loading: false,
        refetchSubjects: vi.fn(),
    }),
}));

vi.mock("../api/studentRecord", () => ({
    getMyAssignedSubjects: vi.fn().mockResolvedValue({
        data: [
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
                submissionStatus: { 1: "submitted", 2: "pending", 3: "pending", 4: "pending" },
            },
        ],
    }),
    getSubjectClassRecords: vi.fn().mockResolvedValue({
        data: {
            classSubjectId: 101,
            subjectId: 1,
            subjectName: "Science 10",
            subjectCode: "SCI10",
            classId: 10,
            classSection: "Emerald",
            classGradeLevel: 10,
            quarter: 2,
            isSubjectFinalized: false,
            gradingWeights: {
                writtenWorkWeight: 40,
                performanceTaskWeight: 40,
                quarterlyAssessmentWeight: 20,
            },
            progress: { total: 2, submitted: 0, pending: 2 },
            students: [],
        },
    }),
    submitSubjectRecords: vi.fn(),
    submitSingleStudentSubjectRecord: vi.fn(),
    reopenSubjectRecord: vi.fn(),
    getSubjectStudentAmendData: vi.fn(),
}));

let lastGradebookQuarterRequested: number | null = null;

vi.mock("../api/api", () => ({
    getAPICall: vi.fn().mockImplementation((url: string) => {
        if (url.includes("/gradebook/101/details")) {
            const urlObj = new URL(`http://localhost${url}`);
            lastGradebookQuarterRequested = Number(urlObj.searchParams.get("quarter"));
            return Promise.resolve({
                data: {
                    classSubjectId: 101,
                    subjectName: "Science",
                    subjectCode: "SCI101",
                    classId: 10,
                    classSection: "Emerald",
                    gradeLevel: 10,
                    hasComponents: false,
                    components: [],
                    quarter: lastGradebookQuarterRequested,
                    assessment: [],
                    gradingWeights: {
                        writtenWorkWeight: 40,
                        performanceTaskWeight: 40,
                        quarterlyAssessmentWeight: 20,
                        attendanceWeight: 0,
                    },
                    student: [],
                },
            });
        }
        if (url.includes("/faculties/by-user")) {
            return Promise.resolve({
                data: { id: 10, role: "teacher", employeeId: "EMP-001", department: "Science" },
            });
        }
        if (url.includes("/faculties/10/subjects")) {
            return Promise.resolve({
                data: [
                    {
                        classSubjectId: 101,
                        subjectName: "Science 10",
                        subjectCode: "SCI10",
                        classSection: "Emerald",
                        classGradeLevel: 10,
                        classId: 10,
                    },
                ],
            });
        }
        if (url.includes("/schoolYear")) {
            return Promise.resolve({
                data: [{ id: 1, startYear: 2026, endYear: 2027, isActive: 1 }],
            });
        }
        if (url.includes("/attendance/range")) {
            return Promise.resolve({
                data: {
                    classSubjectId: 101,
                    subjectName: "Science 10",
                    section: "Emerald",
                    dates: [],
                    students: [],
                    records: [],
                },
            });
        }
        if (url.includes("/student-records/my-class")) {
            return Promise.resolve({ data: null });
        }
        if (url.includes("/academic-settings")) {
            return Promise.resolve({
                data: { currentQuarter: mockCurrentQuarter, submissionsLocked: false, numQuarters: 4 },
            });
        }
        return Promise.resolve({ data: null });
    }),
    postAPICall: vi.fn().mockResolvedValue({ data: {} }),
    patchAPICall: vi.fn().mockResolvedValue({ data: {} }),
    deleteAPICall: vi.fn().mockResolvedValue({ data: {} }),
    putAPICall: vi.fn().mockResolvedValue({ data: {} }),
}));

describe("Automatic Quarter Synchronization & Historical Restrictions", () => {
    beforeEach(() => {
        mockCurrentQuarter = 2;
        lastGradebookQuarterRequested = null;
        vi.clearAllMocks();
    });

    it("FacultyStudentRecords automatically initializes to the active quarter (Quarter 2)", async () => {
        render(
            <MemoryRouter>
                <FacultyStudentRecords />
            </MemoryRouter>
        );

        await waitFor(() => {
            const select = screen.getByLabelText(/quarter/i) as HTMLSelectElement;
            expect(select.value).toBe("2");
        });
    });

    it("FacultyGradebook automatically initializes to the active quarter (Quarter 2)", async () => {
        render(
            <MemoryRouter initialEntries={["/faculty/classes/101/gradebook"]}>
                <Routes>
                    <Route path="/faculty/classes/:classId/gradebook" element={<FacultyGradebook />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            const periodSelect = screen.getByLabelText(/academic period/i) as HTMLSelectElement;
            expect(periodSelect.value).toBe("2");
            expect(lastGradebookQuarterRequested).toBe(2);
        });
    });

    it("FacultyGradebook prevents creating assessment when viewing historical Quarter 1", async () => {
        render(
            <MemoryRouter initialEntries={["/faculty/classes/101/gradebook"]}>
                <Routes>
                    <Route path="/faculty/classes/:classId/gradebook" element={<FacultyGradebook />} />
                </Routes>
            </MemoryRouter>
        );

        const periodSelect = (await screen.findByLabelText(/academic period/i)) as HTMLSelectElement;
        expect(periodSelect.value).toBe("2");

        // Switch to historical Quarter 1
        fireEvent.change(periodSelect, { target: { value: "1" } });

        await waitFor(() => {
            expect(screen.getByText(/Quarter 1 is locked \(Past Quarter\)/i)).toBeInTheDocument();
            // The empty state shows locked notice rather than an actionable add assessment button
            expect(screen.getByText(/Quarter 1 is locked — assessments cannot be added/i)).toBeInTheDocument();
        });
    });

    it("FacultyStudentRecords updates automatically when the quarter is advanced", async () => {
        const { rerender } = render(
            <MemoryRouter>
                <FacultyStudentRecords />
            </MemoryRouter>
        );

        const select = (await screen.findByLabelText(/quarter/i)) as HTMLSelectElement;
        expect(select.value).toBe("2");

        // Simulate registrar advancing to Quarter 3
        mockCurrentQuarter = 3;
        rerender(
            <MemoryRouter>
                <FacultyStudentRecords />
            </MemoryRouter>
        );

        await waitFor(() => {
            const updatedSelect = screen.getByLabelText(/quarter/i) as HTMLSelectElement;
            expect(updatedSelect.value).toBe("3");
        });
    });

    it("FacultyGradebook updates automatically when the quarter is advanced", async () => {
        const { rerender } = render(
            <MemoryRouter initialEntries={["/faculty/classes/101/gradebook"]}>
                <Routes>
                    <Route path="/faculty/classes/:classId/gradebook" element={<FacultyGradebook />} />
                </Routes>
            </MemoryRouter>
        );

        const periodSelect = (await screen.findByLabelText(/academic period/i)) as HTMLSelectElement;
        expect(periodSelect.value).toBe("2");

        // Simulate registrar advancing to Quarter 3
        mockCurrentQuarter = 3;
        rerender(
            <MemoryRouter initialEntries={["/faculty/classes/101/gradebook"]}>
                <Routes>
                    <Route path="/faculty/classes/:classId/gradebook" element={<FacultyGradebook />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            const updatedSelect = screen.getByLabelText(/academic period/i) as HTMLSelectElement;
            expect(updatedSelect.value).toBe("3");
        });
    });

    it("FacultyAttendance Create Attendance modal excludes previous quarters from selection", async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <FacultyAttendance />
            </MemoryRouter>
        );

        const createButton = await screen.findByRole("button", { name: /create attendance/i });
        await user.click(createButton);

        const modalHeading = await screen.findByText(/open a day for a subject/i);
        expect(modalHeading).toBeInTheDocument();

        // Check the quarter selector in the modal
        const quarterSelect = screen.getByLabelText(/quarter/i, { selector: "select" }) as HTMLSelectElement;
        const options = Array.from(quarterSelect.options).map((opt) => opt.value);

        // Quarter 1 (previous quarter) must NOT be present
        expect(options).not.toContain("1");
        // Quarters 2, 3, 4 (active and future) must be present
        expect(options).toContain("2");
        expect(options).toContain("3");
        expect(options).toContain("4");
        expect(quarterSelect.value).toBe("2");
    });
});
