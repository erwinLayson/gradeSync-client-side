import { describe, it, expect } from "vitest";
import {
  PASSING_GRADE,
  isPassing,
  computeFlatQuarterGradePreview,
} from "../grades";
import type { Assessment } from "../../constant/assessment";
import type { GradeWeights } from "../../constant/gradingWeights";

describe("grades helper", () => {
  describe("PASSING_GRADE & isPassing", () => {
    it("defines PASSING_GRADE as 75", () => {
      expect(PASSING_GRADE).toBe(75);
    });

    it("returns true for passing grades (>= 75)", () => {
      expect(isPassing(75)).toBe(true);
      expect(isPassing(75.5)).toBe(true);
      expect(isPassing(92)).toBe(true);
      expect(isPassing(100)).toBe(true);
    });

    it("returns false for failing grades (< 75)", () => {
      expect(isPassing(74.99)).toBe(false);
      expect(isPassing(60)).toBe(false);
      expect(isPassing(0)).toBe(false);
    });

    it("returns false for null and undefined", () => {
      expect(isPassing(null)).toBe(false);
      expect(isPassing(undefined)).toBe(false);
    });
  });

  describe("computeFlatQuarterGradePreview", () => {
    const defaultWeights: GradeWeights = {
      writtenWorkWeight: 30,
      performanceTaskWeight: 50,
      quarterlyAssessmentWeight: 20,
      attendanceWeight: 0,
    };

    const mockAssessments: Assessment[] = [
      {
        id: 1,
        classSubjectId: 101,
        componentId: null,
        quarter: 1,
        type: "written_work",
        title: "Quiz 1",
        maxScore: 20,
        dateGiven: null,
      },
      {
        id: 2,
        classSubjectId: 101,
        componentId: null,
        quarter: 1,
        type: "performance_task",
        title: "Project 1",
        maxScore: 50,
        dateGiven: null,
      },
      {
        id: 3,
        classSubjectId: 101,
        componentId: null,
        quarter: 1,
        type: "quarterly_assessment",
        title: "Periodical Exam",
        maxScore: 50,
        dateGiven: null,
      },
    ];

    it("returns null grades and zero totals when draftRow is undefined or empty", () => {
      const resultEmpty = computeFlatQuarterGradePreview(
        mockAssessments,
        defaultWeights,
        undefined,
        null,
      );
      expect(resultEmpty).toEqual({
        totalScore: 0,
        totalMaxScore: 0,
        quarterGrade: null,
        remarks: null,
      });

      const resultBlank = computeFlatQuarterGradePreview(
        mockAssessments,
        defaultWeights,
        { 1: "", 2: "   " },
        null,
      );
      expect(resultBlank).toEqual({
        totalScore: 0,
        totalMaxScore: 0,
        quarterGrade: null,
        remarks: null,
      });
    });

    it("computes accurately for complete graded assessments with passing remarks", () => {
      // Written Work: 20/20 = 100% * 30 = 3000
      // Performance Task: 40/50 = 80% * 50 = 4000
      // Quarterly Assessment: 45/50 = 90% * 20 = 1800
      // Total weighted sum: 8800 / 100 = 88.0
      const draftRow = { 1: "20", 2: "40", 3: "45" };
      const result = computeFlatQuarterGradePreview(
        mockAssessments,
        defaultWeights,
        draftRow,
        null,
      );

      expect(result.totalScore).toBe(105);
      expect(result.totalMaxScore).toBe(120);
      expect(result.quarterGrade).toBe(88);
      expect(result.remarks).toBe("Passed");
    });

    it("computes failing grade and sets remarks to 'Failed'", () => {
      // 50% across all: 10/20, 25/50, 25/50 -> 50% overall
      const draftRow = { 1: "10", 2: "25", 3: "25" };
      const result = computeFlatQuarterGradePreview(
        mockAssessments,
        defaultWeights,
        draftRow,
        null,
      );

      expect(result.quarterGrade).toBe(50);
      expect(result.remarks).toBe("Failed");
    });

    it("handles partial score entry by only distributing across active weights", () => {
      // Only Written Work is graded: 18/20 = 90% * 30 / 30 = 90.0
      const draftRow = { 1: "18" };
      const result = computeFlatQuarterGradePreview(
        mockAssessments,
        defaultWeights,
        draftRow,
        null,
      );

      expect(result.totalScore).toBe(18);
      expect(result.totalMaxScore).toBe(20);
      expect(result.quarterGrade).toBe(90);
      expect(result.remarks).toBe("Passed");
    });

    it("safely ignores non-finite/invalid input strings without producing NaN", () => {
      const draftRow = { 1: "20", 2: "abc", 3: "undefined" };
      const result = computeFlatQuarterGradePreview(
        mockAssessments,
        defaultWeights,
        draftRow,
        null,
      );

      // Only assessment 1 is finite (20/20 = 100%)
      expect(result.totalScore).toBe(20);
      expect(result.totalMaxScore).toBe(20);
      expect(result.quarterGrade).toBe(100);
      expect(result.remarks).toBe("Passed");
      expect(Number.isNaN(result.quarterGrade)).toBe(false);
    });

    it("includes attendance weight and calculates combined weighted grade", () => {
      const weightsWithAttendance: GradeWeights = {
        writtenWorkWeight: 30,
        performanceTaskWeight: 50,
        quarterlyAssessmentWeight: 10,
        attendanceWeight: 10,
      };

      // Written Work: 20/20 = 100% * 30 = 3000
      // Attendance: 18 / 20 = 90% * 10 = 900
      // Active weight sum: 30 + 10 = 40
      // Weighted percentage sum: 3900 / 40 = 97.5
      const draftRow = { 1: "20" };
      const attendance = { presentDays: 18, totalDays: 20 };

      const result = computeFlatQuarterGradePreview(
        mockAssessments,
        weightsWithAttendance,
        draftRow,
        attendance,
      );

      expect(result.quarterGrade).toBe(97.5);
      expect(result.remarks).toBe("Passed");
    });

    it("ignores attendance if attendance totalDays is 0 or weight is 0", () => {
      const weightsNoAttendance: GradeWeights = {
        writtenWorkWeight: 40,
        performanceTaskWeight: 60,
        quarterlyAssessmentWeight: 0,
        attendanceWeight: 0,
      };

      const draftRow = { 1: "20" };
      const attendance = { presentDays: 0, totalDays: 0 };

      const result = computeFlatQuarterGradePreview(
        mockAssessments,
        weightsNoAttendance,
        draftRow,
        attendance,
      );

      expect(result.quarterGrade).toBe(100);
    });

    it("returns null quarterGrade when active weight sum is 0", () => {
      const zeroWeights: GradeWeights = {
        writtenWorkWeight: 0,
        performanceTaskWeight: 0,
        quarterlyAssessmentWeight: 0,
        attendanceWeight: 0,
      };

      const draftRow = { 1: "20" };
      const result = computeFlatQuarterGradePreview(
        mockAssessments,
        zeroWeights,
        draftRow,
        null,
      );

      expect(result.quarterGrade).toBeNull();
      expect(result.remarks).toBeNull();
    });
  });
});
