import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  submitAmendmentRequest,
  approveAmendmentRequest,
  rejectAmendmentRequest,
  revokeAmendmentPermission,
  patchSingleStudentScore,
  patchSingleStudentAttendance,
  applyUnifiedSubjectAmendment,
} from "../api/amendments";
import * as apiModule from "../api/api";

vi.mock("../api/api", () => ({
  getAPICall: vi.fn(),
  postAPICall: vi.fn(),
  patchAPICall: vi.fn(),
}));

describe("Amendment API — Toast behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits amendment request with { toast: false } to prevent duplicate toast in UI", async () => {
    vi.mocked(apiModule.postAPICall).mockResolvedValueOnce({
      success: true,
      message: "Amendment request submitted successfully",
      data: {} as any,
    });

    await submitAmendmentRequest({
      studentId: 10,
      classroomId: 2,
      enrollmentId: 5,
      quarter: 1,
      recordType: "gradebook_score",
      reason: "Test justification reason",
    });

    expect(apiModule.postAPICall).toHaveBeenCalledWith(
      "/amendments",
      expect.anything(),
      expect.objectContaining({ toast: false })
    );
  });

  it("approves amendment request with { toast: false } to prevent duplicate toast in UI", async () => {
    vi.mocked(apiModule.postAPICall).mockResolvedValueOnce({
      success: true,
      message: "Amendment request approved successfully",
      data: {} as any,
    });

    await approveAmendmentRequest(1, { durationHours: 24 });

    expect(apiModule.postAPICall).toHaveBeenCalledWith(
      "/amendments/requests/1/approve",
      { durationHours: 24 },
      expect.objectContaining({ toast: false })
    );
  });

  it("rejects amendment request with { toast: false } to prevent duplicate toast in UI", async () => {
    vi.mocked(apiModule.postAPICall).mockResolvedValueOnce({
      success: true,
      message: "Amendment request rejected",
      data: {} as any,
    });

    await rejectAmendmentRequest(1, { rejectionReason: "Invalid justification" });

    expect(apiModule.postAPICall).toHaveBeenCalledWith(
      "/amendments/requests/1/reject",
      expect.anything(),
      expect.objectContaining({ toast: false })
    );
  });

  it("revokes amendment permission with { toast: false } to prevent duplicate toast in UI", async () => {
    vi.mocked(apiModule.postAPICall).mockResolvedValueOnce({
      success: true,
      message: "Permission revoked",
      data: {} as any,
    });

    await revokeAmendmentPermission(1, { reason: "Time expired" });

    expect(apiModule.postAPICall).toHaveBeenCalledWith(
      "/amendments/requests/1/revoke",
      { reason: "Time expired" },
      expect.objectContaining({ toast: false })
    );
  });

  it("patches student score with { toast: false } to prevent duplicate toast in UI", async () => {
    vi.mocked(apiModule.patchAPICall).mockResolvedValueOnce({
      success: true,
      message: "Score updated",
      data: {} as any,
    });

    await patchSingleStudentScore(12, 5, { score: 95 });

    expect(apiModule.patchAPICall).toHaveBeenCalledWith(
      "/assessments/12/scores/5",
      { score: 95 },
      expect.objectContaining({ toast: false })
    );
  });

  it("patches student attendance with { toast: false } to prevent duplicate toast in UI", async () => {
    vi.mocked(apiModule.patchAPICall).mockResolvedValueOnce({
      success: true,
      message: "Attendance updated",
      data: {} as any,
    });

    await patchSingleStudentAttendance(3, 5, {
      date: "2026-11-02",
      status: "present",
      quarter: 1,
    });

    expect(apiModule.patchAPICall).toHaveBeenCalledWith(
      "/attendance/class-subjects/3/students/5",
      expect.anything(),
      expect.objectContaining({ toast: false })
    );
  });

  it("applies unified amendment with { toast: false } to prevent duplicate toast in UI", async () => {
    vi.mocked(apiModule.postAPICall).mockResolvedValueOnce({
      success: true,
      message: "Modifications applied",
      data: {} as any,
    });

    await applyUnifiedSubjectAmendment(10, { markAsCompleted: true });

    expect(apiModule.postAPICall).toHaveBeenCalledWith(
      "/amendments/10/apply",
      { markAsCompleted: true },
      expect.objectContaining({ toast: false })
    );
  });
});

