import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AnalyticsReports from "../pages/admin/Analytics-Reports";
import * as apiModule from "../api/api";
import type { SchoolYear } from "../constant/schoolYear";

vi.mock("../api/api", () => ({
    API: {
        defaults: { baseURL: "http://localhost/api" },
        get: vi.fn(),
    },
    getAPICall: vi.fn(),
    postAPICall: vi.fn(),
    patchAPICall: vi.fn(),
    deleteAPICall: vi.fn(),
}));

const mockSchoolYears: SchoolYear[] = [
    { id: 1, startYear: "2024", endYear: "2025", isActive: false, status: "completed" },
    { id: 2, startYear: "2025", endYear: "2026", isActive: true, status: "ongoing" },
];

const mockAnalyticsSummary = {
    totalStudents: 150,
    totalTeachers: 12,
    totalSections: 6,
    overallGpa: 88.5,
    quarter: 1,
    schoolYearsWithEnrollments: [1, 2],
    enrollmentByGrade: [
        { gradeLevel: 7, count: 50 },
        { gradeLevel: 8, count: 50 },
        { gradeLevel: 9, count: 50 },
    ],
    attendanceTrend: [
        { month: "2025-09", rate: 95 },
        { month: "2025-10", rate: 94 },
    ],
    subjectPerformance: [],
};

const mockRankingsAllGrades = {
    schoolYearId: 2,
    quarter: 1,
    gradeLevel: null,
    groups: [
        {
            gradeLevel: 7,
            totalEligible: 4,
            rankings: [
                {
                    rank: 1,
                    studentId: 101,
                    studentName: "Santos, Maria",
                    studentLrn: "123456789001",
                    gradeLevel: 7,
                    section: "Diamond",
                    generalAverage: 96.5,
                },
                {
                    rank: 2,
                    studentId: 102,
                    studentName: "Reyes, Carlo",
                    studentLrn: "123456789002",
                    gradeLevel: 7,
                    section: "Diamond",
                    generalAverage: 94.25,
                },
                {
                    rank: 2,
                    studentId: 103,
                    studentName: "Dela Cruz, Juan",
                    studentLrn: "123456789003",
                    gradeLevel: 7,
                    section: "Emerald",
                    generalAverage: 94.25,
                },
                {
                    rank: 4,
                    studentId: 104,
                    studentName: "Bautista, Ana",
                    studentLrn: "123456789004",
                    gradeLevel: 7,
                    section: "Diamond",
                    generalAverage: 91.0,
                },
            ],
        },
        {
            gradeLevel: 8,
            totalEligible: 2,
            rankings: [
                {
                    rank: 1,
                    studentId: 201,
                    studentName: "Aquino, Ben",
                    studentLrn: "123456789005",
                    gradeLevel: 8,
                    section: "Ruby",
                    generalAverage: 95.0,
                },
                {
                    rank: 2,
                    studentId: 202,
                    studentName: "Luna, Antonio",
                    studentLrn: null,
                    gradeLevel: 8,
                    section: "Ruby",
                    generalAverage: 93.0,
                },
            ],
        },
    ],
};

const mockRankingsGrade7Only = {
    schoolYearId: 2,
    quarter: 1,
    gradeLevel: 7,
    groups: [mockRankingsAllGrades.groups[0]!],
};

const mockRankingsManyStudents = {
    schoolYearId: 2,
    quarter: 1,
    gradeLevel: 7,
    groups: [
        {
            gradeLevel: 7,
            totalEligible: 12,
            rankings: Array.from({ length: 12 }, (_, i) => ({
                rank: i + 1,
                studentId: 300 + i,
                studentName: `Student ${String.fromCharCode(65 + i)}`,
                studentLrn: `1234567890${i < 9 ? "0" + (i + 1) : i + 1}`,
                gradeLevel: 7,
                section: "Section A",
                generalAverage: 98 - i * 0.5,
            })),
        },
    ],
};

describe("Admin Reports & Analytics — Student Quarterly Rankings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setupMocks = (rankingsResponse = mockRankingsAllGrades) => {
        vi.mocked(apiModule.getAPICall).mockImplementation(async (url: string) => {
            if (url === "/schoolYear") {
                return { success: true, message: "ok", data: mockSchoolYears };
            }
            if (url.startsWith("/analytics?") || url === "/analytics") {
                return { success: true, message: "ok", data: mockAnalyticsSummary };
            }
            if (url.startsWith("/analytics/student-rankings")) {
                return { success: true, message: "ok", data: rankingsResponse };
            }
            return { success: true, message: "ok", data: null };
        });
    };

    it("replaces Top Performing Students and Subject Summary with Student Quarterly Rankings", async () => {
        setupMocks();

        render(
            <MemoryRouter>
                <AnalyticsReports />
            </MemoryRouter>
        );

        // Section headings should exist
        expect(await screen.findByRole("heading", { name: /Student Quarterly Rankings/i })).toBeInTheDocument();
        expect(screen.getByText("Academic Standings")).toBeInTheDocument();
        expect(screen.getByText(/Official academic rankings calculated independently per grade level/i)).toBeInTheDocument();

        // Old sections must NOT be present
        expect(screen.queryByRole("heading", { name: /Top Performing Students/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /Subject Summary/i })).not.toBeInTheDocument();
    });

    it("displays filters for School Year, Quarter, and Grade Level", async () => {
        setupMocks();

        render(
            <MemoryRouter>
                <AnalyticsReports />
            </MemoryRouter>
        );

        await screen.findByRole("heading", { name: /Student Quarterly Rankings/i });

        const sySelect = screen.getByLabelText("Filter rankings by School Year");
        const quarterSelect = screen.getByLabelText("Filter rankings by Quarter");
        const gradeSelect = screen.getByLabelText("Filter rankings by Grade Level");

        expect(sySelect).toBeInTheDocument();
        expect(quarterSelect).toBeInTheDocument();
        expect(gradeSelect).toBeInTheDocument();

        // Options check
        expect(gradeSelect).toHaveValue("all");
        expect(quarterSelect).toHaveValue("1");
    });

    it("renders separate ranking tables for each grade level starting at Rank 1 with competition ranking", async () => {
        setupMocks();

        render(
            <MemoryRouter>
                <AnalyticsReports />
            </MemoryRouter>
        );

        await screen.findByRole("heading", { name: /Student Quarterly Rankings/i });

        // Both grade levels are displayed with independent headers
        expect(await screen.findByRole("heading", { name: "Grade 7" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Grade 8" })).toBeInTheDocument();

        // Count chips
        expect(screen.getByText("4 eligible students")).toBeInTheDocument();
        expect(screen.getByText("2 eligible students")).toBeInTheDocument();

        // Verify Grade 7 students
        expect(screen.getByText("Santos, Maria")).toBeInTheDocument();
        expect(screen.getByText("Reyes, Carlo")).toBeInTheDocument();
        expect(screen.getByText("Dela Cruz, Juan")).toBeInTheDocument();
        expect(screen.getByText("Bautista, Ana")).toBeInTheDocument();

        // Verify Grade 8 students
        expect(screen.getByText("Aquino, Ben")).toBeInTheDocument();
        expect(screen.getByText("Luna, Antonio")).toBeInTheDocument();

        // Verify fallback student ID when LRN is null
        expect(screen.getByText("202")).toBeInTheDocument();

        // Verify competition ranking (Rank 1, 2, 2, 4 in Grade 7)
        // Maria is Rank 1, Carlo and Juan are tied at Rank 2, Ana skips to Rank 4
        expect(screen.getByText("96.50")).toBeInTheDocument();
        expect(screen.getAllByText("94.25")).toHaveLength(2);
        expect(screen.getByText("91.00")).toBeInTheDocument();

        // Verify Grade 8 restarts at Rank 1
        expect(screen.getByText("95.00")).toBeInTheDocument();
        expect(screen.getByText("93.00")).toBeInTheDocument();

        // Check top 3 visual distinctions
        const rankBadges = document.querySelectorAll(".analytics__rank");
        const rankClasses = Array.from(rankBadges).map((el) => el.className);
        expect(rankClasses.some((c) => c.includes("analytics__rank--1"))).toBe(true);
        expect(rankClasses.some((c) => c.includes("analytics__rank--2"))).toBe(true);
        expect(rankClasses.some((c) => c.includes("analytics__rank--rest"))).toBe(true);
    });

    it("updates rankings when filtering by specific Grade Level", async () => {
        const user = userEvent.setup();
        setupMocks();

        render(
            <MemoryRouter>
                <AnalyticsReports />
            </MemoryRouter>
        );

        await screen.findByRole("heading", { name: /Student Quarterly Rankings/i });

        // Change grade level filter to Grade 7
        const gradeSelect = screen.getByLabelText("Filter rankings by Grade Level");
        await user.selectOptions(gradeSelect, "7");

        await waitFor(() => {
            expect(apiModule.getAPICall).toHaveBeenCalledWith(
                expect.stringContaining("/analytics/student-rankings?schoolYearId=2&quarter=1&gradeLevel=7")
            );
        });
    });

    it("updates rankings when changing Quarter", async () => {
        const user = userEvent.setup();
        setupMocks();

        render(
            <MemoryRouter>
                <AnalyticsReports />
            </MemoryRouter>
        );

        await screen.findByRole("heading", { name: /Student Quarterly Rankings/i });

        const quarterSelect = screen.getByLabelText("Filter rankings by Quarter");
        await user.selectOptions(quarterSelect, "2");

        await waitFor(() => {
            expect(apiModule.getAPICall).toHaveBeenCalledWith(
                expect.stringContaining("/analytics/student-rankings?schoolYearId=2&quarter=2")
            );
        });
    });

    it("supports pagination when students exceed 10 per grade level", async () => {
        const user = userEvent.setup();
        setupMocks(mockRankingsManyStudents);

        render(
            <MemoryRouter>
                <AnalyticsReports />
            </MemoryRouter>
        );

        await screen.findByRole("heading", { name: /Student Quarterly Rankings/i });
        expect(await screen.findByText("Student A")).toBeInTheDocument();
        expect(screen.getByText("Student J")).toBeInTheDocument();
        // Page 1 should NOT show Student K or Student L
        expect(screen.queryByText("Student K")).not.toBeInTheDocument();

        expect(screen.getByText(/Showing 1 to 10 of 12 students/i)).toBeInTheDocument();
        expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

        // Next page
        const nextBtn = screen.getByRole("button", { name: "Next page for Grade 7" });
        expect(nextBtn).toBeEnabled();
        await user.click(nextBtn);

        // Now page 2 is active
        expect(screen.getByText(/Showing 11 to 12 of 12 students/i)).toBeInTheDocument();
        expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
        expect(screen.getByText("Student K")).toBeInTheDocument();
        expect(screen.getByText("Student L")).toBeInTheDocument();
        expect(screen.queryByText("Student A")).not.toBeInTheDocument();

        // Previous button works
        const prevBtn = screen.getByRole("button", { name: "Previous page for Grade 7" });
        expect(prevBtn).toBeEnabled();
        await user.click(prevBtn);

        expect(screen.getByText("Student A")).toBeInTheDocument();
    });

    it("displays an empty state when no finalized quarterly averages exist", async () => {
        setupMocks({
            schoolYearId: 2,
            quarter: 1,
            gradeLevel: null,
            groups: [],
        });

        render(
            <MemoryRouter>
                <AnalyticsReports />
            </MemoryRouter>
        );

        await screen.findByRole("heading", { name: /Student Quarterly Rankings/i });
        expect(
            await screen.findByText(/No finalized quarterly averages found for any grade level in Quarter 1/i)
        ).toBeInTheDocument();
    });

    it("handles error state and retries successfully", async () => {
        const user = userEvent.setup();
        let shouldFail = true;

        vi.mocked(apiModule.getAPICall).mockImplementation(async (url: string) => {
            if (url === "/schoolYear") {
                return { success: true, message: "ok", data: mockSchoolYears };
            }
            if (url.startsWith("/analytics?") || url === "/analytics") {
                return { success: true, message: "ok", data: mockAnalyticsSummary };
            }
            if (url.startsWith("/analytics/student-rankings")) {
                if (shouldFail) {
                    throw new Error("Network error");
                }
                return { success: true, message: "ok", data: mockRankingsAllGrades };
            }
            return { success: true, message: "ok", data: null };
        });

        render(
            <MemoryRouter>
                <AnalyticsReports />
            </MemoryRouter>
        );

        expect(
            await screen.findByText("Failed to load quarterly rankings. Please try again.")
        ).toBeInTheDocument();

        const retryBtn = screen.getByRole("button", { name: /Retry/i });
        expect(retryBtn).toBeInTheDocument();

        // Turn off error and click retry
        shouldFail = false;
        await user.click(retryBtn);

        expect(await screen.findByText("Santos, Maria")).toBeInTheDocument();
        expect(screen.queryByText("Failed to load quarterly rankings. Please try again.")).not.toBeInTheDocument();
    });
});
