import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { getTeacherDashboardLinks } from "../constant/navigation";
import { Sidebar } from "../components/Sidebar";
import FacultyDashboard from "../pages/faculty/FacultyDashboard";

// Mock hooks used by Sidebar
const mockUser = {
  id: 10,
  email: "teacher@test.com",
  role: "teacher" as const,
  facultyRole: "teacher",
};

let mockHasAdvisoryClass = false;
let mockAdvisoryLoading = false;

vi.mock("../hooks/useUser", () => ({
  useUser: () => ({
    user: mockUser,
    loading: false,
    fetchUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    auth: true,
    loading: false,
    logout: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("../hooks/useSchoolInfo", () => ({
  useSchoolInfo: () => ({
    schoolName: "Test School",
    schoolLogo: null,
  }),
}));

vi.mock("../hooks/useTeacherAdvisoryClass", () => ({
  useTeacherAdvisoryClass: () => ({
    hasAdvisoryClass: mockHasAdvisoryClass,
    advisoryClass: mockHasAdvisoryClass ? { classroom: { id: 1, section: "Sapphire" } } : null,
    loading: mockAdvisoryLoading,
    error: null,
    refetch: vi.fn(),
  }),
  invalidateTeacherAdvisoryClassCache: vi.fn(),
}));

// Mock hooks used by FacultyDashboard
let mockAdviserClasses: Array<{ id: number; section: string }> = [];

vi.mock("../hooks/useAcademicSettings", () => ({
  useAcademicSettings: () => ({
    quarters: [1, 2, 3, 4],
    currentQuarter: 1,
  }),
}));

vi.mock("../hooks/useFacultyOverview", () => ({
  useFacultyOverview: () => ({
    faculty: { id: 10, fullname: "Maria Santos", email: "teacher@test.com" },
    classes: [
      {
        classId: 1,
        classSection: "Sapphire",
        classGradeLevel: 7,
        subjects: [{ classSubjectId: 101, subjectName: "Math 7" }],
      },
    ],
    adviserClasses: mockAdviserClasses,
    adviserClassStats: mockAdviserClasses.length > 0 ? [
      { classId: 1, classSection: "Sapphire", classGradeLevel: 7, totalStudents: 30, maleCount: 15, femaleCount: 15 }
    ] : [],
    honorStudents: null,
    totalStudents: mockAdviserClasses.length > 0 ? 30 : 0,
    totalSubjects: 1,
    weeklyHours: 4,
    loading: false,
    error: false,
  }),
}));

describe("Teacher Navigation Links — Advisory Class Conditional Display", () => {
  beforeEach(() => {
    mockHasAdvisoryClass = false;
    mockAdvisoryLoading = false;
    mockAdviserClasses = [];
  });

  describe("getTeacherDashboardLinks helper", () => {
    it("hides advisory-only links (My Class, Reports) when teacher has no advisory class", () => {
      const links = getTeacherDashboardLinks(false);
      const allLabels = links.flatMap((group) => group.sections.map((s) => s.label));

      expect(allLabels).not.toContain("My Class");
      expect(allLabels).not.toContain("Reports");
      expect(allLabels).toContain("Dashboard");
      expect(allLabels).toContain("Attendance");
      expect(allLabels).toContain("Gradebook");
      expect(allLabels).toContain("Student Records");
      expect(allLabels).toContain("My Amendments");
      expect(allLabels).toContain("Settings");
    });

    it("includes advisory-only links (My Class, Reports) when teacher has an advisory class", () => {
      const links = getTeacherDashboardLinks(true);
      const allLabels = links.flatMap((group) => group.sections.map((s) => s.label));

      expect(allLabels).toContain("My Class");
      expect(allLabels).toContain("Reports");
      expect(allLabels).toContain("Dashboard");
      expect(allLabels).toContain("Attendance");
      expect(allLabels).toContain("Gradebook");
      expect(allLabels).toContain("Student Records");
      expect(allLabels).toContain("My Amendments");
      expect(allLabels).toContain("Settings");
    });
  });

  describe("Sidebar navigation rendering", () => {
    it("does not render My Class or Reports links when teacher has no advisory class", () => {
      mockHasAdvisoryClass = false;

      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );

      // Advisory links should NOT exist
      expect(screen.queryByRole("link", { name: /my class/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /reports/i })).not.toBeInTheDocument();

      // Non-advisory links SHOULD exist
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /attendance/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /gradebook/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /student records/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /my amendments/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    });

    it("renders My Class and Reports links when teacher has an advisory class", () => {
      mockHasAdvisoryClass = true;

      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );

      // Advisory links SHOULD exist
      expect(screen.getByRole("link", { name: /my class/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /reports/i })).toBeInTheDocument();

      // Non-advisory links SHOULD also exist
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /attendance/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /gradebook/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /student records/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /my amendments/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    });
  });

  describe("FacultyDashboard Quick Actions navigation rendering", () => {
    it("hides My Class quick action when teacher has no advisory class", () => {
      mockAdviserClasses = [];

      render(
        <MemoryRouter>
          <FacultyDashboard />
        </MemoryRouter>
      );

      // "My Class" button in quick actions should be hidden
      expect(screen.queryByRole("button", { name: /my class/i })).not.toBeInTheDocument();

      // Other quick actions remain available
      expect(screen.getByRole("button", { name: /gradebook/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /attendance/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /student records/i })).toBeInTheDocument();
    });

    it("shows My Class quick action when teacher has an advisory class", () => {
      mockAdviserClasses = [{ id: 1, section: "Sapphire" }];

      render(
        <MemoryRouter>
          <FacultyDashboard />
        </MemoryRouter>
      );

      // "My Class" button in quick actions should be visible
      expect(screen.getByRole("button", { name: /my class/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /gradebook/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /attendance/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /student records/i })).toBeInTheDocument();
    });
  });
});
