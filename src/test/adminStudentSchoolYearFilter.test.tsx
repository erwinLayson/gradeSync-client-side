import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import StudentManagement from "../components/StudentManagement";
import * as apiModule from "../api/api";
import type { SchoolYear } from "../constant/schoolYear";
import type { StudentListResponse, StudentResponseProps } from "../constant/students";

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
    { id: 1, startYear: "2025", endYear: "2026", isActive: false, status: "completed" },
    { id: 2, startYear: "2026", endYear: "2027", isActive: true, status: "ongoing" },
];

const mockStudentsSY1: StudentResponseProps[] = [
    {
        id: 101,
        lrn: 123456789001,
        email: "alice@student.test",
        fullname: "Santos, Alice M.",
        birthdate: "2010-05-12",
        age: 16,
        sex: "Female",
        status: "active",
    },
];

const mockStudentsSY2: StudentResponseProps[] = [
    {
        id: 102,
        lrn: 123456789002,
        email: "bob@student.test",
        fullname: "Dela Cruz, Bob K.",
        birthdate: "2010-08-20",
        age: 16,
        sex: "Male",
        status: "active",
    },
];

const mockAllStudents: StudentResponseProps[] = [
    mockStudentsSY1[0]!,
    mockStudentsSY2[0]!,
];

describe("Admin Student Registry — School Year Filter", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(apiModule.getAPICall).mockImplementation((path: string) => {
            if (path === "/schoolYear") {
                return Promise.resolve({
                    success: true,
                    message: "ok",
                    data: mockSchoolYears,
                });
            }

            if (path.startsWith("/students?")) {
                const url = new URL(`http://localhost${path}`);
                const syId = url.searchParams.get("schoolYearId");

                let returnedStudents = mockAllStudents;
                if (syId === "1") returnedStudents = mockStudentsSY1;
                else if (syId === "2") returnedStudents = mockStudentsSY2;

                const responseData: StudentListResponse = {
                    students: returnedStudents,
                    total: returnedStudents.length,
                    page: 1,
                    pageSize: 25,
                };

                return Promise.resolve({
                    success: true,
                    message: "ok",
                    data: responseData,
                });
            }

            if (path === "/academic-settings" || path === "/students/current-quarter") {
                return Promise.resolve({
                    success: true,
                    message: "ok",
                    data: { quarters: 4, activeQuarter: 1 },
                });
            }

            return Promise.resolve({ success: true, message: "ok", data: [] });
        });
    });

    it("renders the School Year filter dropdown and populates school year options", async () => {
        render(
            <MemoryRouter initialEntries={["/admin/students"]}>
                <StudentManagement basePath="/admin/students" />
            </MemoryRouter>
        );

        // Find the School Year select element
        const sySelect = await screen.findByRole("combobox", { name: /filter by school year/i });
        expect(sySelect).toBeInTheDocument();

        // Default option should be "All School Years"
        expect(sySelect).toHaveValue("");

        // Check options inside the dropdown
        await waitFor(() => {
            expect(screen.getByRole("option", { name: "All School Years" })).toBeInTheDocument();
            expect(screen.getByRole("option", { name: "2025 - 2026" })).toBeInTheDocument();
            expect(screen.getByRole("option", { name: "2026 - 2027 (Current)" })).toBeInTheDocument();
        });
    });

    it("filters students enrolled in the selected school year when an option is picked", async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={["/admin/students"]}>
                <StudentManagement basePath="/admin/students" />
            </MemoryRouter>
        );

        // Initially both students appear
        expect(await screen.findByText("Santos, Alice M.")).toBeInTheDocument();
        expect(screen.getByText("Dela Cruz, Bob K.")).toBeInTheDocument();

        const sySelect = screen.getByRole("combobox", { name: /filter by school year/i });

        // Select SY 2025 - 2026 (id: 1)
        await user.selectOptions(sySelect, "1");

        // Should call /students with schoolYearId=1
        await waitFor(() => {
            expect(apiModule.getAPICall).toHaveBeenCalledWith(
                expect.stringContaining("schoolYearId=1"),
                expect.anything()
            );
        });

        // Now only Alice appears
        await waitFor(() => {
            expect(screen.getByText("Santos, Alice M.")).toBeInTheDocument();
            expect(screen.queryByText("Dela Cruz, Bob K.")).not.toBeInTheDocument();
        });
    });

    it("resets filter when selecting 'All School Years' again", async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={["/admin/students?schoolYearId=1"]}>
                <StudentManagement basePath="/admin/students" />
            </MemoryRouter>
        );

        const sySelect = await screen.findByRole("combobox", { name: /filter by school year/i });
        expect(sySelect).toHaveValue("1");

        // Select All School Years ("")
        await user.selectOptions(sySelect, "");

        await waitFor(() => {
            expect(apiModule.getAPICall).toHaveBeenCalledWith(
                expect.not.stringContaining("schoolYearId"),
                expect.anything()
            );
        });

        await waitFor(() => {
            expect(screen.getByText("Santos, Alice M.")).toBeInTheDocument();
            expect(screen.getByText("Dela Cruz, Bob K.")).toBeInTheDocument();
        });
    });

    it("shows Reset filters button when School Year filter is active and resets when clicked", async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={["/admin/students?schoolYearId=2"]}>
                <StudentManagement basePath="/admin/students" />
            </MemoryRouter>
        );

        const resetButton = await screen.findByRole("button", { name: /clear active filters/i });
        expect(resetButton).toBeInTheDocument();

        await user.click(resetButton);

        await waitFor(() => {
            const sySelect = screen.getByRole("combobox", { name: /filter by school year/i });
            expect(sySelect).toHaveValue("");
        });
    });
});

