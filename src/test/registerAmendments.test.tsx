import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RegisterAmendments from "../pages/register/RegisterAmendments";
import * as amendmentApi from "../api/amendments";
import type { AmendmentRequest } from "../constant/amendment";

const mockAdminUser = {
  id: 1,
  email: "admin@gradesync.test",
  role: "admin" as const,
};

vi.mock("../hooks/useUser", () => ({
  useUser: () => ({
    user: mockAdminUser,
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

const mockRequests: AmendmentRequest[] = [
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
    reason: "Encoding error on Written Work #1 activity sheet.",
    details: JSON.stringify({
      assessmentId: 101,
      assessmentTitle: "Written Work #1",
      currentValue: 14,
      proposedValue: 20,
    }),
    status: "pending",
    created_at: "2026-11-06T10:00:00Z",
    auditLogs: [
      {
        id: 1,
        action: "requested",
        actorUserId: 10,
        actorName: "Maria Santos",
        actorRole: "teacher",
        recordType: "gradebook_score",
        enrollmentId: 50,
        quarter: 1,
        targetTable: "amendment_requests",
        targetRecordId: "1",
        reason: "Initial submission",
        created_at: "2026-11-06T10:00:00Z",
      },
    ],
  },
  {
    id: 2,
    requestNumber: "AMD-2026-0002",
    requesterFacultyId: 11,
    requesterName: "Pedro Penduko",
    enrollmentId: 51,
    studentName: "Maria Clara",
    studentLrn: "987654321098",
    classSubjectId: null,
    subjectName: null,
    classId: 2,
    section: "Emerald",
    gradeLevel: 10,
    quarter: 1,
    recordType: "student_record_grade",
    reason: "Late project submission approved by department head.",
    details: JSON.stringify({
      currentValue: 82,
      proposedValue: 88,
    }),
    status: "approved",
    created_at: "2026-11-05T14:30:00Z",
    permission: {
      id: 99,
      requestId: 2,
      facultyId: 11,
      enrollmentId: 51,
      classId: 2,
      quarter: 1,
      recordType: "student_record_grade",
      status: "active",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      created_at: "2026-11-05T15:00:00Z",
    },
  },
  {
    id: 3,
    requestNumber: "AMD-2026-0003",
    requesterFacultyId: 12,
    requesterName: "Andres Bonifacio",
    enrollmentId: 52,
    studentName: "Jose Rizal",
    studentLrn: "112233445566",
    classSubjectId: 6,
    subjectName: "Araling Panlipunan 10",
    classId: 2,
    section: "Emerald",
    gradeLevel: 10,
    quarter: 1,
    recordType: "subject_record",
    reason: "Attendance and Quiz score update",
    details: JSON.stringify({}),
    status: "completed",
    created_at: "2026-11-06T11:00:00Z",
    auditLogs: [
      {
        id: 10,
        action: "modified",
        actorUserId: 12,
        actorName: "Andres Bonifacio",
        actorRole: "teacher",
        recordType: "subject_record",
        enrollmentId: 52,
        quarter: 1,
        targetTable: "student_scores",
        targetRecordId: "101",
        reason: "Amended score",
        diff: JSON.stringify({
          record: "Gradebook",
          field: "Written Work #2",
          previousValue: 85,
          updatedValue: 95,
        }),
        created_at: "2026-11-06T11:30:00Z",
      },
    ],
  },
];

describe("RegisterAmendments Console", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(amendmentApi.getAllAmendmentRequests).mockResolvedValue({
      success: true,
      message: "ok",
      data: mockRequests,
    });
    vi.mocked(amendmentApi.getAmendmentRequestById).mockImplementation((id: number) => {
      const found = mockRequests.find((r) => r.id === id);
      return Promise.resolve({
        success: true,
        message: "ok",
        data: found ?? mockRequests[0],
      });
    });
    vi.mocked(amendmentApi.getAmendmentAuditLogs).mockResolvedValue({
      success: true,
      message: "ok",
      data: [
        {
          id: 1,
          action: "requested",
          actorUserId: 10,
          actorName: "Maria Santos",
          actorRole: "teacher",
          recordType: "gradebook_score",
          enrollmentId: 50,
          quarter: 1,
          targetTable: "amendment_requests",
          targetRecordId: "1",
          reason: "Initial submission",
          created_at: "2026-11-06T10:00:00Z",
        },
      ],
    });
  });

  it("renders page header, KPI metrics, and requests table", async () => {
    render(<RegisterAmendments />);

    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });

    expect(screen.getByText("Record Amendments")).toBeInTheDocument();

    // Check KPIs
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
    expect(screen.getByText("Approved Active")).toBeInTheDocument();

    // Check Table Content
    expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Science 10")).toBeInTheDocument();

    expect(screen.getByText("AMD-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Maria Clara")).toBeInTheDocument();
  });

  it("filters requests when status tab or search query is changed", async () => {
    const user = userEvent.setup();
    render(<RegisterAmendments />);

    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });

    // Click 'Pending' tab
    const pendingTab = screen.getByRole("button", { name: /^Pending/i });
    await user.click(pendingTab);

    expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    expect(screen.queryByText("AMD-2026-0002")).not.toBeInTheDocument();

    // Click 'Approved' tab
    const approvedTab = screen.getByRole("button", { name: /^Approved/i });
    await user.click(approvedTab);

    expect(screen.queryByText("AMD-2026-0001")).not.toBeInTheDocument();
    expect(screen.getByText("AMD-2026-0002")).toBeInTheDocument();

    // Reset to 'All'
    const allTab = screen.getByRole("button", { name: /^All/i });
    await user.click(allTab);

    // Search query
    const searchInput = screen.getByPlaceholderText(/Search student, LRN/i);
    await user.type(searchInput, "Pedro");

    expect(screen.queryByText("AMD-2026-0001")).not.toBeInTheDocument();
    expect(screen.getByText("AMD-2026-0002")).toBeInTheDocument();
  });

  it("opens review modal with full request details and diff comparison", async () => {
    const user = userEvent.setup();
    render(<RegisterAmendments />);

    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });

    const reviewButtons = screen.getAllByRole("button", { name: /Review|View/i });
    await user.click(reviewButtons[0]);

    // Modal is open
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AMD-2026-0001" })).toBeInTheDocument();
    });

    expect(
      screen.getByText("Encoding error on Written Work #1 activity sheet.")
    ).toBeInTheDocument();

    // Diff values
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();

    // Audit logs
    expect(screen.getByText("Audit Trail History")).toBeInTheDocument();
    expect(screen.getByText("requested")).toBeInTheDocument();
  });

  it("renders audit log summary of modified fields for subject_record amendments", async () => {
    const user = userEvent.setup();
    render(<RegisterAmendments />);

    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0003")).toBeInTheDocument();
    });

    const req3Row = screen.getByText("AMD-2026-0003").closest("tr");
    expect(req3Row).toBeInTheDocument();
    const reviewBtn = req3Row!.querySelector("button");
    await user.click(reviewBtn!);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AMD-2026-0003" })).toBeInTheDocument();
    });

    // Should render the audit summary
    expect(screen.getByText("Actual Modified Fields (from Audit Log):")).toBeInTheDocument();
    expect(screen.getByText("Written Work #2")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("1 change(s) recorded")).toBeInTheDocument();

    // Should NOT render the placeholder Proposed Value: Modified
    expect(screen.queryByText("Modified")).not.toBeInTheDocument();
  });

  it("handles approving a pending amendment request", async () => {
    vi.mocked(amendmentApi.approveAmendmentRequest).mockResolvedValueOnce({
      success: true,
      message: "ok",
      data: {
        permission: {
          id: 100,
          requestId: 1,
          facultyId: 10,
          enrollmentId: 50,
          classId: 2,
          quarter: 1,
          recordType: "gradebook_score",
          status: "active",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date().toISOString(),
        },
        request: { ...mockRequests[0], status: "approved" },
      },
    });

    const user = userEvent.setup();
    render(<RegisterAmendments />);

    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });

    const reviewButtons = screen.getAllByRole("button", { name: /Review|View/i });
    await user.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve Amendment/i })).toBeInTheDocument();
    });

    // Click Approve
    await user.click(screen.getByRole("button", { name: /Approve Amendment/i }));

    // Approval dialog should appear
    expect(
      screen.getByRole("heading", { name: "Approve Amendment Request" })
    ).toBeInTheDocument();

    const confirmApproveBtn = screen.getByRole("button", { name: "Confirm Approval" });
    await user.click(confirmApproveBtn);

    await waitFor(() => {
      expect(amendmentApi.approveAmendmentRequest).toHaveBeenCalledWith(1, {
        durationHours: 24,
        reviewNotes: undefined,
      });
    });
  });

  it("handles rejecting a pending amendment request with justification reason", async () => {
    vi.mocked(amendmentApi.rejectAmendmentRequest).mockResolvedValueOnce({
      success: true,
      message: "ok",
      data: { ...mockRequests[0], status: "rejected" },
    });

    const user = userEvent.setup();
    render(<RegisterAmendments />);

    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });

    const reviewButtons = screen.getAllByRole("button", { name: /Review|View/i });
    await user.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    });

    // Click Reject
    await user.click(screen.getByRole("button", { name: "Reject" }));

    // Rejection dialog should appear
    expect(
      screen.getByRole("heading", { name: "Reject Amendment Request" })
    ).toBeInTheDocument();

    const reasonInput = screen.getByPlaceholderText(/Explain why this amendment/i);
    const confirmRejectBtn = screen.getByRole("button", { name: "Confirm Rejection" });

    // Initially disabled when empty
    expect(confirmRejectBtn).toBeDisabled();

    fireEvent.change(reasonInput, { target: { value: "Insufficient documentation for score change." } });
    expect(confirmRejectBtn).toBeEnabled();

    await user.click(confirmRejectBtn);

    await waitFor(() => {
      expect(amendmentApi.rejectAmendmentRequest).toHaveBeenCalledWith(1, {
        rejectionReason: "Insufficient documentation for score change.",
      });
    });
  });

  it("handles revoking an active amendment permission", async () => {
    vi.mocked(amendmentApi.revokeAmendmentPermission).mockResolvedValueOnce({
      success: true,
      message: "ok",
      data: { revoked: true },
    });

    const user = userEvent.setup();
    render(<RegisterAmendments />);

    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0002")).toBeInTheDocument();
    });

    // AMD-2026-0002 is approved with active permission
    const reviewButtons = screen.getAllByRole("button", { name: /Review|View/i });
    await user.click(reviewButtons[1]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Revoke Permission/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Revoke Permission/i }));

    expect(
      screen.getByRole("heading", { name: "Revoke Active Permission" })
    ).toBeInTheDocument();

    const confirmRevokeBtn = screen.getByRole("button", { name: "Confirm Revocation" });
    await user.click(confirmRevokeBtn);

    await waitFor(() => {
      expect(amendmentApi.revokeAmendmentPermission).toHaveBeenCalledWith(2, {
        reason: undefined,
      });
    });
  });

  it("loads request details and audit trail without calling forbidden system audit logs API", async () => {
    const user = userEvent.setup();
    render(<RegisterAmendments />);

    await waitFor(() => {
      expect(screen.getByText("AMD-2026-0001")).toBeInTheDocument();
    });

    const reviewButtons = screen.getAllByRole("button", { name: /Review|View/i });
    await user.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AMD-2026-0001" })).toBeInTheDocument();
    });

    expect(amendmentApi.getAmendmentRequestById).toHaveBeenCalledWith(1);
    expect(amendmentApi.getAmendmentAuditLogs).not.toHaveBeenCalled();
    expect(screen.getByText("requested")).toBeInTheDocument();
  });
});
