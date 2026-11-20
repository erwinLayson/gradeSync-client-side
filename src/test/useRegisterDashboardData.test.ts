import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRegisterDashboardData } from "../hooks/useRegisterDashboardData";
import { getAPICall } from "../api/api";

vi.mock("../api/api", () => ({
  getAPICall: vi.fn(),
}));

describe("useRegisterDashboardData hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches active school year, academic settings, and scopes statistics to the active school year", async () => {
    vi.mocked(getAPICall).mockImplementation(async (url: string) => {
      if (url === "/schoolYear/active") {
        return {
          success: true,
          message: "Success",
          data: {
            activeSchoolYear: {
              id: 5,
              startYear: 2026,
              endYear: 2027,
              isActive: true,
            },
          },
        };
      }
      if (url === "/academic-settings") {
        return {
          success: true,
          message: "Success",
          data: {
            currentQuarter: 2,
            numQuarters: 4,
            enrollmentOpen: true,
            submissionsLocked: false,
          },
        };
      }
      if (url === "/students?limit=1") {
        return {
          success: true,
          message: "Success",
          data: {
            total: 350,
            students: [],
          },
        };
      }
      if (url === "/students?schoolYearId=5&status=enrolled&limit=1") {
        return {
          success: true,
          message: "Success",
          data: {
            total: 280,
            students: [],
          },
        };
      }
      if (url.startsWith("/students/not-enrolled")) {
        return {
          success: true,
          message: "Success",
          data: [
            { id: 101, lrn: "1111", fullname: "Student One" },
            { id: 102, lrn: "2222", fullname: "Student Two" },
          ],
        };
      }
      if (url === "/student-records/summary?schoolYearId=5") {
        return {
          success: true,
          message: "Success",
          data: [
            {
              classroomId: 1,
              section: "Diamond",
              gradeLevel: 7,
              totalStudents: 40,
              submitted: { 1: 40, 2: 30, 3: 0, 4: 0 },
            },
            {
              classroomId: 2,
              section: "Emerald",
              gradeLevel: 8,
              totalStudents: 40,
              submitted: { 1: 40, 2: 30, 3: 0, 4: 0 },
            },
          ],
        };
      }
      if (url === "/students?limit=6") {
        return {
          success: true,
          message: "Success",
          data: {
            total: 350,
            students: [
              {
                id: 1,
                lrn: "123456789012",
                fullname: "Dela Cruz, Juan",
                status: "enrolled",
                createdAt: "2026-11-15T08:00:00Z",
              },
            ],
          },
        };
      }
      if (url === "/amendments/requests") {
        return {
          success: true,
          message: "Success",
          data: [
            {
              id: 99,
              requestNumber: "AMD-2026-001",
              status: "pending",
              reason: "Correction of 1st Quarter grade",
              studentName: "Reyes, Maria",
              section: "Grade 7 - Sapphire",
            },
          ],
        };
      }
      return { success: true, message: "Default", data: null };
    });

    const { result } = renderHook(() => useRegisterDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Academic context
    expect(result.current.academicContext.activeSchoolYear?.id).toBe(5);
    expect(result.current.academicContext.currentQuarter).toBe(2);
    expect(result.current.academicContext.enrollmentOpen).toBe(true);

    // Overview statistics
    expect(result.current.statistics.totalStudents).toBe(350);
    expect(result.current.statistics.enrolledStudents).toBe(280);
    expect(result.current.statistics.eligibleNotEnrolledStudents).toBe(2);

    // Submission progress (quarter 2: 30+30=60 out of 40+40=80 -> 75%)
    expect(result.current.statistics.submissionProgress.submitted).toBe(60);
    expect(result.current.statistics.submissionProgress.total).toBe(80);
    expect(result.current.statistics.submissionProgress.percentage).toBe(75);

    // Recent activity
    expect(result.current.recentActivity.length).toBe(2);
    const registrationItem = result.current.recentActivity.find((a) => a.type === "registration");
    expect(registrationItem).toBeDefined();
    expect(registrationItem?.title).toBe("Learner Registered");
    expect(registrationItem?.description).toContain("Dela Cruz, Juan");

    const amendmentItem = result.current.recentActivity.find((a) => a.type === "amendment");
    expect(amendmentItem).toBeDefined();
    expect(amendmentItem?.title).toBe("Amendment Requested");
    expect(amendmentItem?.description).toContain("Reyes, Maria");
    expect(amendmentItem?.description).toContain("AMD-2026-001");
  });

  it("handles missing active school year gracefully without throwing or counting historical enrollments", async () => {
    vi.mocked(getAPICall).mockImplementation(async (url: string) => {
      if (url === "/schoolYear/active") {
        return {
          success: true,
          message: "No active SY",
          data: { activeSchoolYear: null },
        };
      }
      if (url === "/academic-settings") {
        return {
          success: true,
          message: "Success",
          data: {
            currentQuarter: 1,
            numQuarters: 4,
            enrollmentOpen: false,
          },
        };
      }
      if (url === "/students?limit=1") {
        return {
          success: true,
          message: "Success",
          data: { total: 10, students: [] },
        };
      }
      if (url.startsWith("/students/not-enrolled")) {
        return {
          success: true,
          message: "Success",
          data: [],
        };
      }
      return { success: true, message: "Success", data: [] };
    });

    const { result } = renderHook(() => useRegisterDashboardData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.academicContext.activeSchoolYear).toBeNull();
    expect(result.current.statistics.totalStudents).toBe(10);
    expect(result.current.statistics.enrolledStudents).toBe(0);
    expect(result.current.statistics.eligibleNotEnrolledStudents).toBe(0);
    expect(result.current.statistics.submissionProgress.percentage).toBe(0);
  });
});
