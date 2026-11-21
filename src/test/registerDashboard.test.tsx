import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RegisterDashboard from "../pages/register/RegisterDashboard";
import type { RegisterDashboardData } from "../hooks/useRegisterDashboardData";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUser = {
  id: 42,
  email: "registrar.doe@deped.gov.ph",
  role: "faculty" as const,
  facultyRole: "register",
};

vi.mock("../hooks/useUser", () => ({
  useUser: () => ({
    user: mockUser,
    loading: false,
    fetchUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

let mockDashboardState: RegisterDashboardData = {
  academicContext: {
    activeSchoolYear: {
      id: 1,
      startYear: "2026",
      endYear: "2027",
      isActive: true,
    },
    currentQuarter: 2,
    numQuarters: 4,
    enrollmentOpen: true,
    submissionsLocked: false,
  },
  statistics: {
    totalStudents: 320,
    enrolledStudents: 295,
    eligibleNotEnrolledStudents: 25,
    submissionProgress: {
      submitted: 150,
      total: 200,
      percentage: 75,
    },
  },
  recentActivity: [
    {
      id: "reg-1",
      type: "registration",
      title: "Learner Registered",
      description: "Santos, Maria (LRN: 102938475610) registered in student registry",
      timestamp: null,
      link: "/register/students?search=102938475610",
    },
    {
      id: "amd-1",
      type: "amendment",
      title: "Amendment Requested",
      description: "AMD-2026-004: Dela Cruz, Juan (Grade 7 - Diamond) · Grade correction",
      timestamp: null,
      link: "/register/amendments",
    },
  ],
  loading: false,
  error: false,
  refetch: vi.fn(),
};

vi.mock("../hooks/useRegisterDashboardData", () => ({
  useRegisterDashboardData: () => mockDashboardState,
}));

describe("RegisterDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardState = {
      academicContext: {
        activeSchoolYear: {
          id: 1,
          startYear: "2026",
          endYear: "2027",
          isActive: true,
        },
        currentQuarter: 2,
        numQuarters: 4,
        enrollmentOpen: true,
        submissionsLocked: false,
      },
      statistics: {
        totalStudents: 320,
        enrolledStudents: 295,
        eligibleNotEnrolledStudents: 25,
        submissionProgress: {
          submitted: 150,
          total: 200,
          percentage: 75,
        },
      },
      recentActivity: [
        {
          id: "reg-1",
          type: "registration",
          title: "Learner Registered",
          description: "Santos, Maria (LRN: 102938475610) registered in student registry",
          timestamp: null,
          link: "/register/students?search=102938475610",
        },
        {
          id: "amd-1",
          type: "amendment",
          title: "Amendment Requested",
          description: "AMD-2026-004: Dela Cruz, Juan (Grade 7 - Diamond) · Grade correction",
          timestamp: null,
          link: "/register/amendments",
        },
      ],
      loading: false,
      error: false,
      refetch: vi.fn(),
    };
  });

  it("renders Section 1: greeting, registrar user identifier, and workspace description", () => {
    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /registrar\.doe/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Enrollment & Records Workspace/i)
    ).toBeInTheDocument();
  });

  it("renders Section 2: active academic context (active SY, quarter, enrollment window)", () => {
    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Active Academic Context")).toBeInTheDocument();
    expect(screen.getByText("Active School Year")).toBeInTheDocument();
    expect(screen.getAllByText("SY 2026–2027").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Quarter 2 of 4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Enrollment open")).toBeInTheDocument();
  });

  it("renders Section 3: overview statistics with accurate active school year scoping", () => {
    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    // Total students
    expect(screen.getByText("Total Students")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
    expect(screen.getByText("Registered Learners")).toBeInTheDocument();

    // Enrolled students for active SY
    expect(screen.getByText("Enrolled Students")).toBeInTheDocument();
    expect(screen.getByText("295")).toBeInTheDocument();

    // Eligible not yet enrolled
    expect(screen.getByText("Eligible (Not Enrolled)")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Assignment")).toBeInTheDocument();

    // Quarterly submission progress
    expect(screen.getByText("Q2 Submissions")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/150 \/ 200 Records/i)).toBeInTheDocument();
  });

  it("renders Section 4: quick action cards and navigates to correct routes on click", () => {
    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    // 1. Student Records
    const studentRecordsBtn = screen.getByRole("button", { name: /open student records/i });
    expect(studentRecordsBtn).toBeInTheDocument();
    fireEvent.click(studentRecordsBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/register/students");

    // 2. Enrollment
    const enrollmentBtn = screen.getByRole("button", { name: /open enrollment/i });
    expect(enrollmentBtn).toBeInTheDocument();
    fireEvent.click(enrollmentBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/register/enrollments");

    // 3. Submission Tracker
    const submissionBtn = screen.getByRole("button", { name: /open tracker/i });
    expect(submissionBtn).toBeInTheDocument();
    fireEvent.click(submissionBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/register/student-records");

    // 4. Amendments
    const amendmentsBtn = screen.getByRole("button", { name: /open amendments/i });
    expect(amendmentsBtn).toBeInTheDocument();
    fireEvent.click(amendmentsBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/register/amendments");
  });

  it("verifies Submission Tracker description emphasizes monitoring progress and incomplete records", () => {
    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Monitor quarterly grade submission progress across all classes and identify incomplete student records/i)
    ).toBeInTheDocument();
  });

  it("renders Section 5: recent activity feed and links", () => {
    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("Learner Registered")).toBeInTheDocument();
    expect(screen.getByText(/Santos, Maria/i)).toBeInTheDocument();
    expect(screen.getByText("Amendment Requested")).toBeInTheDocument();
    expect(screen.getByText(/AMD-2026-004/i)).toBeInTheDocument();

    // Click on the "View in module" button for the first activity
    const viewButtons = screen.getAllByRole("button", { name: /view in module/i });
    expect(viewButtons.length).toBe(2);
    fireEvent.click(viewButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/register/students?search=102938475610");
  });

  it("renders SF10 Permanent Record guidance with direct link to Student Records", () => {
    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Permanent Records" })).toBeInTheDocument();
    expect(
      screen.getByText(/Official DepEd Form 137 \/ SF10 permanent records are generated and printed directly through the student-specific record workflow/i)
    ).toBeInTheDocument();

    const sf10ActionBtn = screen.getByRole("button", { name: /go to student records/i });
    expect(sf10ActionBtn).toBeInTheDocument();
    fireEvent.click(sf10ActionBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/register/students");
  });

  it("strictly enforces role boundaries: DOES NOT expose quarter advancement or SF9 generation", () => {
    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    // Quarter advancement is strictly an admin feature, never register
    expect(screen.queryByText(/advance quarter/i)).toBeNull();
    expect(screen.queryByText(/advance academic quarter/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /advance/i })).toBeNull();

    // SF9 / Report card generation is for advisers/teachers/admins, never register dashboard
    expect(screen.queryByText(/generate sf9/i)).toBeNull();
    expect(screen.queryByText(/report card generation/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /sf9/i })).toBeNull();
  });

  it("handles empty database state gracefully without crashing or showing NaN", () => {
    mockDashboardState = {
      academicContext: {
        activeSchoolYear: null,
        currentQuarter: 1,
        numQuarters: 4,
        enrollmentOpen: null,
        submissionsLocked: false,
      },
      statistics: {
        totalStudents: 0,
        enrolledStudents: 0,
        eligibleNotEnrolledStudents: 0,
        submissionProgress: {
          submitted: 0,
          total: 0,
          percentage: 0,
        },
      },
      recentActivity: [],
      loading: false,
      error: false,
      refetch: vi.fn(),
    };

    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    expect(screen.getAllByText("No active school year").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Checking status…")).toBeInTheDocument();
    expect(screen.getByText("Enrolled Students")).toBeInTheDocument();
    expect(screen.getByText("Active Year")).toBeInTheDocument();
    expect(screen.getByText("No recent activity")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("renders error state when initial load fails", () => {
    const mockRefetch = vi.fn();
    mockDashboardState = {
      academicContext: {
        activeSchoolYear: null,
        currentQuarter: 1,
        numQuarters: 4,
        enrollmentOpen: null,
        submissionsLocked: false,
      },
      statistics: {
        totalStudents: 0,
        enrolledStudents: 0,
        eligibleNotEnrolledStudents: 0,
        submissionProgress: {
          submitted: 0,
          total: 0,
          percentage: 0,
        },
      },
      recentActivity: [],
      loading: false,
      error: true,
      refetch: mockRefetch,
    };

    render(
      <MemoryRouter>
        <RegisterDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Unable to load dashboard data")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });
});
