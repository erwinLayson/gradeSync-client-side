import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AdminTeacherAttendance from "../pages/admin/AdminTeacherAttendance";
import * as monitoringApi from "../api/attendanceMonitoring";
import * as baseApi from "../api/api";
import type {
  AttendanceMonitoringResponse,
  AttendanceSessionDetailResponse,
} from "../constant/attendanceMonitoring";

vi.mock("../api/attendanceMonitoring", () => ({
  fetchAttendanceMonitoring: vi.fn(),
  fetchAttendanceSessionDetail: vi.fn(),
}));

vi.mock("../api/api", () => ({
  getAPICall: vi.fn(),
  postAPICall: vi.fn(),
}));

const mockSchoolYears = [
  { id: 1, startYear: "2026", endYear: "2027", isActive: 1 },
  { id: 2, startYear: "2025", endYear: "2026", isActive: 0 },
];

const mockClassrooms = [
  { id: 101, section: "Section A", gradeLevel: 11 },
  { id: 102, section: "Section B", gradeLevel: 12 },
];

const mockSubjects = [
  { id: 11, name: "English", code: "ENG11" },
  { id: 12, name: "Mathematics", code: "MATH11" },
  { id: 13, name: "Science", code: "SCI12" },
];

const mockFaculties = [
  { id: 201, firstname: "Juan", lastname: "Dela Cruz" },
  { id: 202, firstname: "Maria", lastname: "Santos" },
];

const mockMonitoringData: AttendanceMonitoringResponse = {
  schoolYear: { id: 1, startYear: "2026", endYear: "2027", isActive: true },
  selectedMonth: 8,
  selectedYear: 2026,
  summary: {
    totalClassrooms: 2,
    totalSubjects: 3,
    totalPresent: 49,
    totalAbsent: 3,
    overallAttendanceRate: 94.2,
  },
  dates: [
    { date: "2026-08-01", dayNumber: 1, dayOfWeek: 6, dayAbbr: "SAT", isWeekend: true },
    { date: "2026-08-02", dayNumber: 2, dayOfWeek: 0, dayAbbr: "SUN", isWeekend: true },
    { date: "2026-08-03", dayNumber: 3, dayOfWeek: 1, dayAbbr: "MON", isWeekend: false },
    { date: "2026-08-04", dayNumber: 4, dayOfWeek: 2, dayAbbr: "TUE", isWeekend: false },
    { date: "2026-08-05", dayNumber: 5, dayOfWeek: 3, dayAbbr: "WED", isWeekend: false },
  ],
  classrooms: [
    {
      classId: 101,
      section: "Section A",
      gradeLevel: 11,
      totalEnrolled: 17,
      subjects: [
        {
          classSubjectId: 1,
          subjectId: 11,
          subjectName: "English",
          subjectCode: "ENG11",
          facultyId: 201,
          teacherName: "Dela Cruz, Juan",
          attendanceByDate: {
            "2026-08-01": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 17,
              attendanceRate: 0,
              statusType: "weekend",
              sessionCount: 0,
              classSubjectId: 1,
              date: "2026-08-01",
            },
            "2026-08-02": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 17,
              attendanceRate: 0,
              statusType: "weekend",
              sessionCount: 0,
              classSubjectId: 1,
              date: "2026-08-02",
            },
            "2026-08-03": {
              hasSession: true,
              presentCount: 17, // 100% -> Green
              totalEnrolled: 17,
              attendanceRate: 100,
              statusType: "submitted",
              sessionCount: 1,
              classSubjectId: 1,
              date: "2026-08-03",
            },
            "2026-08-04": {
              hasSession: true,
              presentCount: 15, // 15/17 = 88.2% -> Neutral
              totalEnrolled: 17,
              attendanceRate: 88.2,
              statusType: "submitted",
              sessionCount: 1,
              classSubjectId: 1,
              date: "2026-08-04",
            },
            "2026-08-05": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 17,
              attendanceRate: 0,
              statusType: "missing",
              sessionCount: 0,
              classSubjectId: 1,
              date: "2026-08-05",
            },
          },
        },
        {
          classSubjectId: 2,
          subjectId: 12,
          subjectName: "Mathematics",
          subjectCode: "MATH11",
          facultyId: 202,
          teacherName: "Santos, Maria",
          attendanceByDate: {
            "2026-08-01": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 17,
              attendanceRate: 0,
              statusType: "weekend",
              sessionCount: 0,
              classSubjectId: 2,
              date: "2026-08-01",
            },
            "2026-08-02": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 17,
              attendanceRate: 0,
              statusType: "weekend",
              sessionCount: 0,
              classSubjectId: 2,
              date: "2026-08-02",
            },
            "2026-08-03": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 17,
              attendanceRate: 0,
              statusType: "missing",
              sessionCount: 0,
              classSubjectId: 2,
              date: "2026-08-03",
            },
            "2026-08-04": {
              hasSession: true,
              presentCount: 12, // 12/17 = 70.6% -> Red (< 75%)
              totalEnrolled: 17,
              attendanceRate: 70.6,
              statusType: "submitted",
              sessionCount: 1,
              classSubjectId: 2,
              date: "2026-08-04",
            },
            "2026-08-05": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 17,
              attendanceRate: 0,
              statusType: "missing",
              sessionCount: 0,
              classSubjectId: 2,
              date: "2026-08-05",
            },
          },
        },
      ],
    },
    {
      classId: 102,
      section: "Section B",
      gradeLevel: 12,
      totalEnrolled: 20,
      subjects: [
        {
          classSubjectId: 3,
          subjectId: 13,
          subjectName: "Science",
          subjectCode: "SCI12",
          facultyId: 201,
          teacherName: "Dela Cruz, Juan",
          attendanceByDate: {
            "2026-08-01": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 20,
              attendanceRate: 0,
              statusType: "weekend",
              sessionCount: 0,
              classSubjectId: 3,
              date: "2026-08-01",
            },
            "2026-08-02": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 20,
              attendanceRate: 0,
              statusType: "weekend",
              sessionCount: 0,
              classSubjectId: 3,
              date: "2026-08-02",
            },
            "2026-08-03": {
              hasSession: true,
              presentCount: 18,
              totalEnrolled: 20,
              attendanceRate: 90,
              statusType: "submitted",
              sessionCount: 1,
              classSubjectId: 3,
              date: "2026-08-03",
            },
            "2026-08-04": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 20,
              attendanceRate: 0,
              statusType: "missing",
              sessionCount: 0,
              classSubjectId: 3,
              date: "2026-08-04",
            },
            "2026-08-05": {
              hasSession: false,
              presentCount: 0,
              totalEnrolled: 20,
              attendanceRate: 0,
              statusType: "missing",
              sessionCount: 0,
              classSubjectId: 3,
              date: "2026-08-05",
            },
          },
        },
      ],
    },
  ],
};

const mockSessionDetail: AttendanceSessionDetailResponse = {
  sessionInfo: {
    classSubjectId: 1,
    classId: 101,
    classroomName: "Grade 11 - Section A",
    section: "Section A",
    gradeLevel: 11,
    subjectId: 11,
    subjectName: "English",
    subjectCode: "ENG11",
    facultyId: 201,
    teacherName: "Dela Cruz, Juan",
    date: "2026-08-03",
    submissionTimestamp: "2026-08-03T08:30:00.000Z",
    quarter: 1,
    status: "Submitted",
  },
  summary: {
    totalEnrolled: 17,
    present: 16,
    absent: 1,
    late: 0,
    excused: 0,
    attendanceRate: 94.1,
  },
  students: [
    {
      studentId: 1001,
      lrn: "2026001",
      studentName: "Alvarez, Bea",
      status: "present",
      recordedAt: "2026-08-03T08:30:00.000Z",
    },
    {
      studentId: 1002,
      lrn: "2026002",
      studentName: "Bernardo, Carlos",
      status: "absent",
      recordedAt: "2026-08-03T08:30:00.000Z",
    },
    {
      studentId: 1003,
      lrn: "2026003",
      studentName: "Castillo, Diana",
      status: "present",
      recordedAt: "2026-08-03T08:30:00.000Z",
    },
  ],
};

function renderComponent() {
  return render(
    <MemoryRouter>
      <AdminTeacherAttendance />
    </MemoryRouter>,
  );
}

describe("AdminTeacherAttendance (Teacher Attendance Monitoring Matrix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(baseApi.getAPICall).mockImplementation(async (url: string) => {
      if (url === "/schoolYear") return { data: mockSchoolYears, success: true, message: "OK" };
      if (url === "/classrooms") return { data: mockClassrooms, success: true, message: "OK" };
      if (url === "/subjects") return { data: mockSubjects, success: true, message: "OK" };
      if (url === "/faculties") return { data: mockFaculties, success: true, message: "OK" };
      return { data: [], success: true, message: "OK" };
    });

    vi.mocked(monitoringApi.fetchAttendanceMonitoring).mockResolvedValue(mockMonitoringData);
    vi.mocked(monitoringApi.fetchAttendanceSessionDetail).mockResolvedValue(mockSessionDetail);
  });

  it("renders page header and all 5 attendance summary cards with accurate metrics", async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Teacher Attendance Monitoring")).toBeInTheDocument();
    });

    // Check 5 summary cards
    expect(screen.getByText("Classrooms")).toBeInTheDocument();
    expect(screen.getByText("Subjects")).toBeInTheDocument();
    expect(screen.getByText("Present")).toBeInTheDocument();
    expect(screen.getByText("Absent")).toBeInTheDocument();
    expect(screen.getByText("Overall Attendance Rate")).toBeInTheDocument();

    const cardValues = Array.from(
      container.querySelectorAll(".att-summary-card__value"),
    ).map((el) => el.textContent?.trim());

    expect(cardValues).toEqual(["2", "3", "49", "3", "94.2%"]);
  });

  it("generates dynamic date headers with day abbreviations and day numbers, highlighting weekends", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Section A")).toBeInTheDocument();
    });

    // Check date columns in the header
    expect(screen.getByText("SAT")).toBeInTheDocument();
    expect(screen.getByText("SUN")).toBeInTheDocument();
    expect(screen.getByText("MON")).toBeInTheDocument();
    expect(screen.getByText("TUE")).toBeInTheDocument();
    expect(screen.getByText("WED")).toBeInTheDocument();

    const satHeader = screen.getByTitle("2026-08-01");
    expect(satHeader).toHaveClass("att-date-header--weekend");

    const monHeader = screen.getByTitle("2026-08-03");
    expect(monHeader).not.toHaveClass("att-date-header--weekend");
  });

  it("renders hierarchical classroom grouping rows and subject rows without redundant section/grade display", async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Section A")).toBeInTheDocument();
    });

    // Classroom grouping rows
    const groupingRows = container.querySelectorAll(".att-row-grouping");
    expect(groupingRows.length).toBe(2);
    expect(groupingRows[0]?.textContent).toContain("Section A");
    expect(groupingRows[0]?.textContent).toContain("11");
    expect(groupingRows[0]?.textContent).toContain("17 Enrolled");

    expect(groupingRows[1]?.textContent).toContain("Section B");
    expect(groupingRows[1]?.textContent).toContain("12");
    expect(groupingRows[1]?.textContent).toContain("20 Enrolled");

    // Subjects under Section A
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Mathematics")).toBeInTheDocument();
    expect(screen.getAllByTitle("Teacher: Dela Cruz, Juan").length).toBe(2);
    expect(screen.getByTitle("Teacher: Santos, Maria")).toBeInTheDocument();

    // Subject under Section B
    expect(screen.getByText("Science")).toBeInTheDocument();
  });

  it("displays attendance cell values as Present/Enrolled with correct conditional color thresholds", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("17/17")).toBeInTheDocument();
    });

    // Green (100% >= 95%)
    const greenBadge = screen.getByText("17/17");
    expect(greenBadge).toHaveClass("att-cell-badge--green");

    // Neutral (88.2% is between 75% and 94%)
    const neutralBadge = screen.getByText("15/17");
    expect(neutralBadge).toHaveClass("att-cell-badge--neutral");

    // Red (70.6% < 75%)
    const redBadge = screen.getByText("12/17");
    expect(redBadge).toHaveClass("att-cell-badge--red");
  });

  it("opens the detailed attendance modal when a submitted cell is clicked", async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("17/17")).toBeInTheDocument();
    });

    const cellButton = screen.getByText("17/17");
    await user.click(cellButton);

    await waitFor(() => {
      expect(monitoringApi.fetchAttendanceSessionDetail).toHaveBeenCalledWith(1, "2026-08-03", 1);
      expect(screen.getByText("Attendance Session Details")).toBeInTheDocument();
    });

    const modal = screen.getByRole("dialog");
    const modalWithin = within(modal);

    // SECTION 1: Attendance Information inside modal
    expect(modalWithin.getByText("Section 1: Attendance Information")).toBeInTheDocument();
    expect(modalWithin.getByText("English")).toBeInTheDocument();
    expect(modalWithin.getByText("Grade 11")).toBeInTheDocument();

    // SECTION 2: Attendance Summary
    expect(modalWithin.getByText("Section 2: Attendance Summary")).toBeInTheDocument();
    expect(modalWithin.getByText("Total Enrolled")).toBeInTheDocument();

    // SECTION 3: Student Attendance Records
    expect(modalWithin.getByText(/Section 3: Student Attendance Records/)).toBeInTheDocument();
    expect(modalWithin.getByText("Alvarez, Bea")).toBeInTheDocument();
    expect(modalWithin.getByText("Bernardo, Carlos")).toBeInTheDocument();
    expect(modalWithin.getByText("Castillo, Diana")).toBeInTheDocument();
    expect(modalWithin.getByText("2026001")).toBeInTheDocument();

    // Student status badges
    expect(modalWithin.getAllByText("present").length).toBeGreaterThan(0);
    expect(modalWithin.getByText("absent")).toBeInTheDocument();
  });

  it("allows searching students inside the session detail modal", async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("17/17")).toBeInTheDocument();
    });

    await user.click(screen.getByText("17/17"));

    await waitFor(() => {
      expect(screen.getByText("Alvarez, Bea")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search student or LRN...");
    await user.type(searchInput, "Bernardo");

    expect(screen.getByText("Bernardo, Carlos")).toBeInTheDocument();
    expect(screen.queryByText("Alvarez, Bea")).not.toBeInTheDocument();
  });

  it("triggers data reload when month or filters change", async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Section A")).toBeInTheDocument();
    });

    const callsBefore = vi.mocked(monitoringApi.fetchAttendanceMonitoring).mock.calls.length;

    // Click next month button
    const nextBtn = screen.getByLabelText("Next Month");
    await user.click(nextBtn);

    await waitFor(() => {
      expect(vi.mocked(monitoringApi.fetchAttendanceMonitoring).mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    });
  });

  it("resets filters when clicking the Reset Filters button", async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Section A")).toBeInTheDocument();
    });

    const resetBtn = screen.getByRole("button", { name: /Reset Filters/i });
    await user.click(resetBtn);

    await waitFor(() => {
      expect(monitoringApi.fetchAttendanceMonitoring).toHaveBeenCalled();
    });
  });

  it("renders EmptyState when no classrooms match the active filters", async () => {
    vi.mocked(monitoringApi.fetchAttendanceMonitoring).mockResolvedValueOnce({
      ...mockMonitoringData,
      classrooms: [],
      summary: {
        totalClassrooms: 0,
        totalSubjects: 0,
        totalPresent: 0,
        totalAbsent: 0,
        overallAttendanceRate: null,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No classrooms or attendance data found")).toBeInTheDocument();
    });
  });
});
