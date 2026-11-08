import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AdminActivityAudit from "../pages/admin/AdminActivityAudit";
import * as activityAuditApi from "../api/activityAudit";
import type { ActivityAuditLogRow, ActivityAuditStats } from "../constant/activityAudit";

vi.mock("../api/activityAudit", () => ({
    fetchActivityAuditLogs: vi.fn(),
    fetchActivityAuditStats: vi.fn(),
    fetchActivityAuditDetail: vi.fn(),
}));

const mockStats: ActivityAuditStats = {
    total: 125,
    today: 14,
    thisWeek: 58,
    byRole: [
        { role: "teacher", count: 80 },
        { role: "register", count: 35 },
        { role: "admin", count: 10 },
    ],
    byAction: [
        { action: "grade_submitted", count: 45 },
        { action: "activity_created", count: 30 },
    ],
    byUser: [],
    recentActivities: [],
};

const mockLogs: ActivityAuditLogRow[] = [
    {
        id: 1,
        actorUserId: 101,
        actorName: "Maria Elizabeth Kristina Dela Cruz-Rodriguez", // Very long user name
        actorRole: "teacher",
        actorFacultyId: 10,
        action: "grade_submitted",
        description: "Bulk synchronized grade calculations across 45 student quarterly assessment sheets following teacher request and administrative override verification protocol.", // Very lengthy description
        entityType: "gradebook",
        entityId: "GB-9901",
        schoolYearId: 1,
        schoolYear: "2025-2026",
        classroomId: 5,
        classroomName: "Grade 10 - Special Program in Science and Technology - Titanium", // Very long section
        gradeLevel: 10,
        subjectId: 12,
        subjectName: "Advanced Physics and Biomechanical Engineering", // Very long subject
        quarter: 2,
        status: "success",
        beforeState: { score: 85 },
        afterState: { score: 92 },
        diff: { score: { before: 85, after: 92 } },
        metadata: { client: "web", batchSize: 45 },
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        created_at: "2026-11-08T10:15:30.000Z",
    },
    {
        id: 2,
        actorUserId: 4,
        actorName: "Li", // Very short name
        actorRole: "admin",
        actorFacultyId: null,
        action: "report_card_generated",
        description: "Generated student report card PDF.", // Short description
        entityType: "report_card",
        entityId: "RC-101",
        schoolYearId: null,
        schoolYear: null,
        classroomId: null,
        classroomName: null,
        gradeLevel: null,
        subjectId: null,
        subjectName: null,
        quarter: null, // Missing academic context
        status: "failed",
        beforeState: null,
        afterState: null,
        diff: null,
        metadata: { reason: "Missing registrar digital seal" },
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        created_at: "2026-11-08T12:00:00.000Z",
    },
    {
        id: 3,
        actorUserId: 52,
        actorName: "Roberto Santos",
        actorRole: "register",
        actorFacultyId: 22,
        action: "student_enrolled",
        description: "Enrolled new transferee student into Grade 7 Section Rizal.",
        entityType: "enrollment",
        entityId: "ENR-7002",
        schoolYearId: 1,
        schoolYear: "2025-2026",
        classroomId: 2,
        classroomName: "Grade 7 - Rizal",
        gradeLevel: 7,
        subjectId: null,
        subjectName: null,
        quarter: null,
        status: "success",
        beforeState: null,
        afterState: { enrolled: true },
        diff: null,
        metadata: null,
        ipAddress: "192.168.1.105",
        userAgent: "Mozilla/5.0",
        created_at: "2026-11-08T08:30:15.000Z",
    },
];

describe("AdminActivityAudit Data Table Rendering & Layout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(activityAuditApi.fetchActivityAuditStats).mockResolvedValue({
            status: 200,
            data: mockStats,
            message: "Stats loaded",
        } as any);

        vi.mocked(activityAuditApi.fetchActivityAuditLogs).mockResolvedValue({
            status: 200,
            data: {
                logs: mockLogs,
                total: 3,
                page: 1,
                limit: 15,
                totalPages: 1,
            },
            message: "Logs loaded",
        } as any);

        vi.mocked(activityAuditApi.fetchActivityAuditDetail).mockResolvedValue({
            status: 200,
            data: mockLogs[0],
            message: "Detail loaded",
        } as any);
    });

    it("renders exactly the six required table column headers", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
            expect(screen.getByText("Total Activities")).toBeInTheDocument();
        });

        // Verify the 6 exact column headers
        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();

        const headers = screen.getAllByRole("columnheader");
        expect(headers).toHaveLength(6);

        expect(headers[0]).toHaveTextContent("User");
        expect(headers[1]).toHaveTextContent("Role");
        expect(headers[2]).toHaveTextContent("Activity");
        expect(headers[3]).toHaveTextContent("Description");
        expect(headers[4]).toHaveTextContent("Academic Context");
        expect(headers[5]).toHaveTextContent("Timestamp");
    });

    it("uses intentional colgroup widths for fixed column layout", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Total Activities")).toBeInTheDocument();
        });

        const table = screen.getByRole("table");
        expect(table.className).toContain("audit-table");

        const colgroup = table.querySelector("colgroup");
        expect(colgroup).toBeInTheDocument();
        const cols = colgroup?.querySelectorAll("col");
        expect(cols).toHaveLength(6);

        // Verify width definitions exist on all 6 columns
        cols?.forEach((col) => {
            expect(col.style.width).toMatch(/%$/);
        });
    });

    it("renders user names and secondary user IDs correctly without line-breaking", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Maria Elizabeth Kristina Dela Cruz-Rodriguez")).toBeInTheDocument();
        });

        // Long user name and ID
        const longNameEl = screen.getByText("Maria Elizabeth Kristina Dela Cruz-Rodriguez");
        expect(longNameEl.className).toContain("audit-user-name");
        expect(longNameEl).toHaveAttribute("title", "Maria Elizabeth Kristina Dela Cruz-Rodriguez");

        const idEl = screen.getByText("ID #101");
        expect(idEl.className).toContain("audit-user-id");

        // Short user name
        const shortNameEl = screen.getByText("Li");
        expect(shortNameEl).toBeInTheDocument();
        expect(screen.getByText("ID #4")).toBeInTheDocument();
    });

    it("renders role badges compactly and with semantic classes", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("teacher")).toBeInTheDocument();
        });

        const teacherBadge = screen.getByText("teacher");
        expect(teacherBadge.className).toContain("audit-role-badge--teacher");

        const adminBadge = screen.getByText("admin");
        expect(adminBadge.className).toContain("audit-role-badge--admin");

        const registerBadge = screen.getByText("register");
        expect(registerBadge.className).toContain("audit-role-badge--register");
    });

    it("renders activity badges alongside status indicators", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Grade Submitted")).toBeInTheDocument();
        });

        // Success status badge
        const successBadges = screen.getAllByText("success");
        expect(successBadges.length).toBeGreaterThan(0);
        expect(successBadges[0].className).toContain("audit-status-badge--success");

        // Failed status badge
        const failedBadge = screen.getByText("failed");
        expect(failedBadge.className).toContain("audit-status-badge--failed");
    });

    it("renders truncated descriptions with complete title tooltips and inline Details buttons", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Bulk synchronized grade calculations/)).toBeInTheDocument();
        });

        const descEl = screen.getByText(/Bulk synchronized grade calculations/);
        expect(descEl.className).toContain("audit-description-text");
        expect(descEl).toHaveAttribute("title", mockLogs[0].description);

        const detailsButtons = screen.getAllByRole("button", { name: /view details/i });
        expect(detailsButtons.length).toBe(3);
    });

    it("renders academic context in a structured vertical layout and handles missing context gracefully", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Grade 10 - Special Program in Science and Technology - Titanium")).toBeInTheDocument();
        });

        // Primary line: Section & Quarter
        const sectionEl = screen.getByText("Grade 10 - Special Program in Science and Technology - Titanium");
        expect(sectionEl.className).toContain("audit-context-section");
        expect(screen.getByText("Q2")).toHaveClass("audit-context-badge--quarter");

        // Secondary line: School Year & Subject
        const syBadges = screen.getAllByText("SY 2025-2026");
        expect(syBadges[0]).toHaveClass("audit-context-badge--sy");
        expect(screen.getByText("Advanced Physics and Biomechanical Engineering")).toHaveClass("audit-context-subject");

        // Missing context renders fallback em-dash
        const emptyDash = screen.getByTitle("No academic context recorded");
        expect(emptyDash).toHaveTextContent("—");
        expect(emptyDash.className).toContain("audit-context-empty");
    });

    it("formats timestamps consistently and prevents clipping", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Total Activities")).toBeInTheDocument();
        });

        // All 3 timestamp cells contain formatted dates
        const timestampCells = document.querySelectorAll(".audit-timestamp-value");
        expect(timestampCells).toHaveLength(3);
        timestampCells.forEach((el) => {
            expect(el.textContent).not.toBe("—");
            expect(el.className).toContain("audit-timestamp-value");
        });
    });

    it("opens inspection modal with fixed header, scrollable body, and fixed footer", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Total Activities")).toBeInTheDocument();
        });

        // Click the first inline details button
        const detailsButtons = screen.getAllByRole("button", { name: /view details/i });
        fireEvent.click(detailsButtons[0]);

        await waitFor(() => {
            expect(activityAuditApi.fetchActivityAuditDetail).toHaveBeenCalledWith(1);
            expect(screen.getByRole("dialog")).toBeInTheDocument();
            expect(screen.getByText("Activity Audit Record Details")).toBeInTheDocument();
            expect(screen.getByText("Attribute Diffs")).toBeInTheDocument();
        });

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveClass("modal-dialog--scrollable");

        // Panel has max-height constraints and flex-col layout
        const panel = dialog.querySelector(".audit-modal-panel");
        expect(panel).toBeInTheDocument();
        expect(panel?.className).toContain("flex-col");
        expect(panel?.className).toContain("max-h-[90vh]");
        expect(panel?.className).toContain("overflow-hidden");

        // Fixed header has shrink-0
        const header = dialog.querySelector(".audit-modal-header");
        expect(header).toBeInTheDocument();
        expect(header?.className).toContain("shrink-0");

        // Scrollable content body has min-h-0 flex-1 overflow-y-auto
        const body = dialog.querySelector(".audit-modal-body");
        expect(body).toBeInTheDocument();
        expect(body?.className).toContain("min-h-0");
        expect(body?.className).toContain("flex-1");
        expect(body?.className).toContain("overflow-y-auto");

        // Fixed footer has shrink-0 and Close button
        const footer = dialog.querySelector(".audit-modal-footer");
        expect(footer).toBeInTheDocument();
        expect(footer?.className).toContain("shrink-0");
        const footerCloseBtn = screen.getByRole("button", { name: /^close$/i });
        expect(footerCloseBtn).toBeInTheDocument();

        // Clicking footer Close button closes the dialog
        fireEvent.click(footerCloseBtn);
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    it("supports search, role, action, and status filtering without breaking existing logic", async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/search by description/i)).toBeInTheDocument();
        });

        // Search input filter
        const searchInput = screen.getByPlaceholderText(/search by description/i);
        await user.type(searchInput, "physics");

        await waitFor(() => {
            expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalledWith(
                expect.objectContaining({ search: "physics" })
            );
        });

        // Role select filter
        const selects = screen.getAllByRole("combobox");
        const roleSelect = selects[0];
        await user.selectOptions(roleSelect, "teacher");

        await waitFor(() => {
            expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalledWith(
                expect.objectContaining({ actorRole: "teacher" })
            );
        });

        // Action select filter
        const actionSelect = selects[1];
        await user.selectOptions(actionSelect, "grade_submitted");

        await waitFor(() => {
            expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalledWith(
                expect.objectContaining({ action: "grade_submitted" })
            );
        });

        // Status select filter
        const statusSelect = selects[2];
        await user.selectOptions(statusSelect, "failed");

        await waitFor(() => {
            expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalledWith(
                expect.objectContaining({ status: "failed" })
            );
        });

        // Reset button
        const resetBtn = screen.getByRole("button", { name: /reset/i });
        await user.click(resetBtn);

        await waitFor(() => {
            expect(searchInput).toHaveValue("");
            expect(roleSelect).toHaveValue("");
            expect(actionSelect).toHaveValue("");
            expect(statusSelect).toHaveValue("");
        });
    });

    it("has dedicated scroll container and mobile hint for responsive overflow handling", async () => {
        render(
            <MemoryRouter>
                <AdminActivityAudit />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Total Activities")).toBeInTheDocument();
        });

        const wrapper = document.querySelector(".audit-table-wrapper");
        expect(wrapper).toBeInTheDocument();
        expect(wrapper).toHaveAttribute("role", "region");
        expect(wrapper).toHaveAttribute("tabindex", "0");

        const mobileHint = document.querySelector(".audit-responsive-hint");
        expect(mobileHint).toBeInTheDocument();
    });
});
