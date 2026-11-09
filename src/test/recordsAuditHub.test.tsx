import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AdminRecordsAuditHub from "../pages/admin/AdminRecordsAuditHub";
import * as amendmentApi from "../api/amendments";
import * as activityAuditApi from "../api/activityAudit";

let mockCurrentUser: {
  id: number;
  email: string;
  role: string;
  facultyRole: string | null;
} = {
  id: 1,
  email: "admin@gradesync.test",
  role: "admin",
  facultyRole: null,
};

vi.mock("../hooks/useUser", () => ({
  useUser: () => ({
    user: mockCurrentUser,
    loading: false,
    fetchUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../api/amendments", () => ({
  getAllAmendmentRequests: vi.fn(),
  getMyAmendmentRequests: vi.fn(),
  getAmendmentRequestById: vi.fn(),
  approveAmendmentRequest: vi.fn(),
  rejectAmendmentRequest: vi.fn(),
  revokeAmendmentPermission: vi.fn(),
  getAmendmentAuditLogs: vi.fn(),
}));

vi.mock("../api/activityAudit", () => ({
  fetchActivityAuditLogs: vi.fn(),
  fetchActivityAuditStats: vi.fn(),
  fetchActivityAuditDetail: vi.fn(),
}));

const mockRequests = [
  {
    id: 1,
    requestNumber: "AMD-2026-0001",
    requesterFacultyId: 10,
    requesterName: "Maria Santos",
    enrollmentId: 50,
    studentName: "Juan Dela Cruz",
    studentLrn: "123456789012",
    classSubjectId: 5,
    subjectName: "Science 10",
    classId: 2,
    section: "Emerald",
    gradeLevel: 10,
    quarter: 1,
    recordType: "gradebook_score",
    reason: "Encoding error on Written Work #1.",
    details: JSON.stringify({ currentValue: 14, proposedValue: 20 }),
    status: "pending",
    created_at: "2026-11-06T10:00:00Z",
  },
];

const mockStats = {
  total: 42,
  today: 5,
  thisWeek: 18,
  byRole: [{ role: "teacher", count: 30 }, { role: "admin", count: 12 }],
  byAction: [],
  byUser: [],
  recentActivities: [],
};

const mockLogs = [
  {
    id: 1,
    actorUserId: 101,
    actorName: "Maria Santos",
    actorRole: "teacher",
    actorFacultyId: 10,
    action: "grade_submitted",
    description: "Submitted quarter grades for Science 10.",
    entityType: "gradebook",
    entityId: "GB-101",
    schoolYearId: 1,
    schoolYear: "2025-2026",
    classroomId: 2,
    classroomName: "Grade 10 - Emerald",
    gradeLevel: 10,
    subjectId: 5,
    subjectName: "Science 10",
    quarter: 1,
    status: "success",
    created_at: "2026-11-08T10:15:30.000Z",
  },
];

describe("AdminRecordsAuditHub (Option A: Tabbed Hub)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 1,
      email: "admin@gradesync.test",
      role: "admin",
      facultyRole: null,
    };

    vi.mocked(amendmentApi.getAllAmendmentRequests).mockResolvedValue({
      success: true,
      message: "OK",
      data: mockRequests as any,
    });
    vi.mocked(activityAuditApi.fetchActivityAuditStats).mockResolvedValue({
      success: true,
      message: "OK",
      data: mockStats,
    });
    vi.mocked(activityAuditApi.fetchActivityAuditLogs).mockResolvedValue({
      success: true,
      message: "OK",
      data: {
        logs: mockLogs as any,
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    });
  });

  it("renders both 'Amendments' and 'Activity Logs' tabs for Admin user with Amendments active by default", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/amendments"]}>
        <Routes>
          <Route path="/admin/amendments" element={<AdminRecordsAuditHub />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify page header
    expect(screen.getByRole("heading", { name: "Record Amendments" })).toBeInTheDocument();

    // Verify tab buttons
    const amendmentsTab = screen.getByRole("tab", { name: /Amendments/i });
    const activityLogsTab = screen.getByRole("tab", { name: /Activity Logs/i });

    expect(amendmentsTab).toBeInTheDocument();
    expect(activityLogsTab).toBeInTheDocument();
    expect(amendmentsTab).toHaveAttribute("aria-selected", "true");
    expect(activityLogsTab).toHaveAttribute("aria-selected", "false");

    // Verify amendments content loaded
    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });
    expect(amendmentApi.getAllAmendmentRequests).toHaveBeenCalled();
  });

  it("switches to 'Activity Logs' tab when clicked, updating page header and rendering audit logs", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/admin/amendments"]}>
        <Routes>
          <Route path="/admin/amendments" element={<AdminRecordsAuditHub />} />
        </Routes>
      </MemoryRouter>
    );

    const activityLogsTab = screen.getByRole("tab", { name: /Activity Logs/i });
    await user.click(activityLogsTab);

    // Verify tab selection updated
    expect(activityLogsTab).toHaveAttribute("aria-selected", "true");

    // Verify page header updated
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Activity Audit & Monitoring" })).toBeInTheDocument();
    });

    // Verify activity logs API was called and content rendered
    await waitFor(() => {
      expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalled();
      expect(screen.getByText("Submitted quarter grades for Science 10.")).toBeInTheDocument();
    });
  });

  it("activates the 'Activity Logs' tab directly when URL has ?tab=activity-audit", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/amendments?tab=activity-audit"]}>
        <Routes>
          <Route path="/admin/amendments" element={<AdminRecordsAuditHub />} />
        </Routes>
      </MemoryRouter>
    );

    const activityLogsTab = screen.getByRole("tab", { name: /Activity Logs/i });
    expect(activityLogsTab).toHaveAttribute("aria-selected", "true");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Activity Audit & Monitoring" })).toBeInTheDocument();
    });
  });

  it("activates the 'Activity Logs' tab when rendered with defaultTab='activity-audit' (as on /admin/activity-audit route)", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/activity-audit"]}>
        <Routes>
          <Route
            path="/admin/activity-audit"
            element={<AdminRecordsAuditHub defaultTab="activity-audit" />}
          />
        </Routes>
      </MemoryRouter>
    );

    const activityLogsTab = screen.getByRole("tab", { name: /Activity Logs/i });
    expect(activityLogsTab).toHaveAttribute("aria-selected", "true");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Activity Audit & Monitoring" })).toBeInTheDocument();
    });
  });

  it("hides the Activity Logs tab for Register users, rendering only Amendments", async () => {
    mockCurrentUser = {
      id: 2,
      email: "register@gradesync.test",
      role: "teacher",
      facultyRole: "register",
    };

    render(
      <MemoryRouter initialEntries={["/register/amendments"]}>
        <Routes>
          <Route path="/register/amendments" element={<AdminRecordsAuditHub />} />
        </Routes>
      </MemoryRouter>
    );

    // Register user does not have admin audit privileges, so the tab bar is hidden
    expect(screen.queryByRole("tab", { name: /Activity Logs/i })).not.toBeInTheDocument();

    // The amendments content is displayed directly
    expect(screen.getByRole("heading", { name: "Record Amendments" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });
  });

  it("safely falls back to Amendments when a non-admin tries to pass ?tab=activity-audit", async () => {
    mockCurrentUser = {
      id: 2,
      email: "register@gradesync.test",
      role: "teacher",
      facultyRole: "register",
    };

    render(
      <MemoryRouter initialEntries={["/register/amendments?tab=activity-audit"]}>
        <Routes>
          <Route path="/register/amendments" element={<AdminRecordsAuditHub />} />
        </Routes>
      </MemoryRouter>
    );

    // Must not call forbidden activity audit APIs
    expect(activityAuditApi.fetchActivityAuditLogs).not.toHaveBeenCalled();
    expect(activityAuditApi.fetchActivityAuditStats).not.toHaveBeenCalled();

    // Must show amendments
    expect(screen.getByRole("heading", { name: "Record Amendments" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });
  });
});
