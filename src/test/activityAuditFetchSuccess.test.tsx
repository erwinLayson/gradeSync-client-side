import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AdminRecordsAuditHub from "../pages/admin/AdminRecordsAuditHub";
import AdminActivityAudit from "../pages/admin/AdminActivityAudit";
import * as activityAuditApi from "../api/activityAudit";
import * as amendmentApi from "../api/amendments";
import type { ActivityAuditLogRow, ActivityAuditStats } from "../constant/activityAudit";

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

const mockStats: ActivityAuditStats = {
  total: 125,
  today: 14,
  thisWeek: 58,
  byRole: [{ role: "teacher", count: 80 }],
  byAction: [],
  byUser: [],
  recentActivities: [],
};

const makeLog = (id: number): ActivityAuditLogRow => ({
  id,
  actorUserId: 100 + id,
  actorName: `Actor ${id}`,
  actorRole: "teacher",
  actorFacultyId: 10,
  action: "grade_submitted",
  description: `Successful audit log entry ${id}`,
  entityType: "gradebook",
  entityId: `GB-${id}`,
  schoolYearId: 1,
  schoolYear: "2025-2026",
  classroomId: 2,
  classroomName: "Grade 10 - Emerald",
  gradeLevel: 10,
  subjectId: 5,
  subjectName: "Science 10",
  quarter: 1,
  status: "success",
  beforeState: null,
  afterState: null,
  diff: null,
  metadata: null,
  ipAddress: "127.0.0.1",
  userAgent: "Mozilla/5.0",
  created_at: "2026-11-08T10:15:30.000Z",
});

const mockLogs: ActivityAuditLogRow[] = [makeLog(1), makeLog(2)];

const logsResponse = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  message: "OK",
  data: {
    logs: mockLogs,
    total: 2,
    page: 1,
    limit: 15,
    totalPages: 1,
    ...overrides,
  },
});

const lastLogsFilters = () => {
  const calls = vi.mocked(activityAuditApi.fetchActivityAuditLogs).mock.calls;
  return calls[calls.length - 1]?.[0];
};

const renderHub = (entry: string, defaultTab?: "activity-audit") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/admin/amendments"
          element={<AdminRecordsAuditHub defaultTab={defaultTab} />}
        />
        <Route
          path="/admin/activity-audit"
          element={<AdminRecordsAuditHub defaultTab={defaultTab} />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("Activity Logs tab — logs are fetched on success (no error)", () => {
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
      data: [],
    } as never);

    vi.mocked(activityAuditApi.fetchActivityAuditStats).mockResolvedValue({
      success: true,
      message: "OK",
      data: mockStats,
    });
    vi.mocked(activityAuditApi.fetchActivityAuditLogs).mockResolvedValue(logsResponse());
    vi.mocked(activityAuditApi.fetchActivityAuditDetail).mockResolvedValue({
      success: true,
      message: "OK",
      data: mockLogs[0],
    });
  });

  describe("every way the Activity Logs tab can be opened fetches the logs", () => {
    it.each([
      ["?tab=activity-audit", "/admin/amendments?tab=activity-audit", undefined],
      ["?tab=activity-logs", "/admin/amendments?tab=activity-logs", undefined],
      ["?tab=audit", "/admin/amendments?tab=audit", undefined],
      ["?tab=logs", "/admin/amendments?tab=logs", undefined],
    ])("opens via URL alias %s and renders fetched logs", async (_label, entry) => {
      renderHub(entry);

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalled();
        expect(screen.getByText("Successful audit log entry 1")).toBeInTheDocument();
      });
      expect(screen.getByRole("heading", { name: "Activity Audit & Monitoring" })).toBeInTheDocument();
    });

    it("opens via the defaultTab prop (the /admin/activity-audit route) and fetches logs", async () => {
      renderHub("/admin/activity-audit", "activity-audit");

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalled();
        expect(screen.getByText("Successful audit log entry 2")).toBeInTheDocument();
      });
    });

    it("fetches logs after clicking the Activity Logs tab from the Amendments tab", async () => {
      const user = userEvent.setup();
      renderHub("/admin/amendments");

      expect(activityAuditApi.fetchActivityAuditLogs).not.toHaveBeenCalled();

      await user.click(screen.getByRole("tab", { name: /Activity Logs/i }));

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalled();
        expect(screen.getByText("Successful audit log entry 1")).toBeInTheDocument();
      });
    });

    it("re-fetches logs when switching away to Amendments and back to Activity Logs", async () => {
      const user = userEvent.setup();
      renderHub("/admin/amendments?tab=activity-audit");

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalledTimes(1);
      });

      await user.click(screen.getByRole("tab", { name: /Amendments/i }));
      await user.click(screen.getByRole("tab", { name: /Activity Logs/i }));

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalledTimes(2);
        expect(screen.getByText("Successful audit log entry 1")).toBeInTheDocument();
      });
    });

    it("fetches logs when the standalone AdminActivityAudit component is rendered", async () => {
      render(<AdminActivityAudit />);

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalled();
        expect(screen.getByText("Successful audit log entry 1")).toBeInTheDocument();
      });
      expect(screen.getByRole("heading", { name: "Activity Audit & Monitoring" })).toBeInTheDocument();
    });
  });

  describe("every filter that triggers a successful logs fetch", () => {
    const openTab = async () => {
      renderHub("/admin/amendments?tab=activity-audit");
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by description/i)).toBeInTheDocument();
      });
    };

    it("fetches with default pagination on initial mount", async () => {
      await openTab();

      expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalledWith({
        page: 1,
        limit: 15,
      });
    });

    it("fetches with a trimmed search term", async () => {
      const user = userEvent.setup();
      await openTab();

      await user.type(screen.getByPlaceholderText(/search by description/i), "  physics  ");

      await waitFor(() => {
        expect(lastLogsFilters()).toEqual(
          expect.objectContaining({ search: "physics", page: 1, limit: 15 })
        );
      });
    });

    it("fetches with each role filter", async () => {
      const user = userEvent.setup();
      await openTab();
      const roleSelect = screen.getAllByRole("combobox")[0];

      for (const role of ["teacher", "register", "admin"]) {
        await user.selectOptions(roleSelect, role);
        await waitFor(() => {
          expect(lastLogsFilters()).toEqual(
            expect.objectContaining({ actorRole: role })
          );
        });
      }
    });

    it("fetches with an action filter", async () => {
      const user = userEvent.setup();
      await openTab();

      await user.selectOptions(screen.getAllByRole("combobox")[1], "grade_submitted");

      await waitFor(() => {
        expect(lastLogsFilters()).toEqual(
          expect.objectContaining({ action: "grade_submitted" })
        );
      });
    });

    it("fetches with both success and failed status filters", async () => {
      const user = userEvent.setup();
      await openTab();
      const statusSelect = screen.getAllByRole("combobox")[2];

      for (const status of ["success", "failed"]) {
        await user.selectOptions(statusSelect, status);
        await waitFor(() => {
          expect(lastLogsFilters()).toEqual(expect.objectContaining({ status }));
        });
      }
    });

    it("fetches with a date range filter", async () => {
      await openTab();
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs).toHaveLength(2);

      fireEvent.change(dateInputs[0], { target: { value: "2026-01-01" } });
      fireEvent.change(dateInputs[1], { target: { value: "2026-12-31" } });

      await waitFor(() => {
        expect(lastLogsFilters()).toEqual(
          expect.objectContaining({ dateFrom: "2026-01-01", dateTo: "2026-12-31" })
        );
      });
    });

    it("fetches with every filter combined in a single successful request", async () => {
      const user = userEvent.setup();
      await openTab();

      await user.type(screen.getByPlaceholderText(/search by description/i), "grade");

      const [roleSelect, actionSelect, statusSelect] = screen.getAllByRole("combobox");
      await user.selectOptions(roleSelect, "teacher");
      await user.selectOptions(actionSelect, "grade_submitted");
      await user.selectOptions(statusSelect, "failed");

      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: "2026-01-01" } });
      fireEvent.change(dateInputs[1], { target: { value: "2026-12-31" } });

      await waitFor(() => {
        expect(lastLogsFilters()).toEqual({
          page: 1,
          limit: 15,
          search: "grade",
          actorRole: "teacher",
          action: "grade_submitted",
          status: "failed",
          dateFrom: "2026-01-01",
          dateTo: "2026-12-31",
        });
      });
    });

    it("fetches the next page, the previous page, and restores defaults on Reset", async () => {
      const user = userEvent.setup();
      vi.mocked(activityAuditApi.fetchActivityAuditLogs).mockResolvedValue(
        logsResponse({ page: 2, totalPages: 3 })
      );
      await openTab();

      await user.click(screen.getByRole("button", { name: /next/i }));
      await waitFor(() => {
        expect(lastLogsFilters()).toEqual(expect.objectContaining({ page: 2 }));
        expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /previous/i }));
      await waitFor(() => {
        expect(lastLogsFilters()).toEqual(expect.objectContaining({ page: 1 }));
      });

      await user.type(screen.getByPlaceholderText(/search by description/i), "grade");
      await waitFor(() => {
        expect(lastLogsFilters()).toEqual(
          expect.objectContaining({ search: "grade" })
        );
      });

      await user.click(screen.getByRole("button", { name: /reset/i }));
      await waitFor(() => {
        expect(lastLogsFilters()).toEqual({ page: 1, limit: 15 });
      });
    });

    it("fetches log detail successfully when a row is inspected", async () => {
      const user = userEvent.setup();
      await openTab();

      const detailsButton = screen.getAllByRole("button", { name: /view details/i })[0];
      await user.click(detailsButton);

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditDetail).toHaveBeenCalledWith(1);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Activity Audit Record Details")).toBeInTheDocument();
      });
      expect(screen.getByText(/Audit record #1/)).toBeInTheDocument();
    });

    it("fetches stats successfully and renders the KPI values", async () => {
      renderHub("/admin/amendments?tab=activity-audit");

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditStats).toHaveBeenCalled();
      });
      const totalLabel = screen.getByText("Total Activities");
      expect(totalLabel.nextElementSibling).toHaveTextContent("125");
    });
  });

  describe("successful responses with unusual but valid payloads", () => {
    it("treats an empty log list as a successful fetch and shows the empty state", async () => {
      vi.mocked(activityAuditApi.fetchActivityAuditLogs).mockResolvedValue(
        logsResponse({ logs: [], total: 0, totalPages: 1 })
      );

      renderHub("/admin/amendments?tab=activity-audit");

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalled();
        expect(screen.getByText("No audit logs found")).toBeInTheDocument();
      });
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("applies safe defaults when the successful payload omits logs/total/totalPages", async () => {
      vi.mocked(activityAuditApi.fetchActivityAuditLogs).mockResolvedValue({
        success: true,
        message: "OK",
        data: {} as never,
      });

      renderHub("/admin/amendments?tab=activity-audit");

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalled();
        expect(screen.getByText("No audit logs found")).toBeInTheDocument();
      });
    });

    it("does not break when a successful response has no data envelope", async () => {
      vi.mocked(activityAuditApi.fetchActivityAuditLogs).mockResolvedValue({
        success: true,
        message: "OK",
      } as never);

      renderHub("/admin/amendments?tab=activity-audit");

      await waitFor(() => {
        expect(activityAuditApi.fetchActivityAuditLogs).toHaveBeenCalled();
        expect(screen.getByText("No audit logs found")).toBeInTheDocument();
      });
    });
  });
});
