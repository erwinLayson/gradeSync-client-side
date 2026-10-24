import type { Assessment, AssessmentType } from "../constant/assessment";
import type { GradeWeights } from "../constant/gradingWeights";

// ============================================================================
// Client grade helpers.
//
// The SERVER is the single source of truth for every stored grade
// (server/src/service/gradebook.ts -> computeQuarterGrade /
//  computeCompositeQuarterGrade, helper/calculateFinalGrade.ts,
//  helper/computeGeneralAverage.ts, helper/getRemarks.ts).
//
// The only calculation allowed on the client is the LIVE SCORE-ENTRY PREVIEW
// below, which exists so a faculty sees the effect of a score before saving it.
// It mirrors the server's flat `computeQuarterGrade` exactly:
//   per type t present and graded: pct_t = Σearned/Σmax * 100
//   weighted = Σ pct_t * w_t, active = Σ w_t          (attendance added the same way)
//   grade    = active === 0 ? null : round2(weighted / active)
//
// Composite subjects (e.g. MAPEH) are deliberately NOT aggregated here. Their
// quarter grade is always the server's: each component is graded on the server,
// then weighted by `component.weight`. See computeCompositeQuarterGrade.
// ============================================================================

// Mirrors the passing mark in server/src/helper/getRemarks.ts.
export const PASSING_GRADE = 75;

export function isPassing(grade: number | null | undefined): boolean {
    return grade !== null && grade !== undefined && grade >= PASSING_GRADE;
}

/** Stored grades are displayed with two decimals (e.g. 83 -> "83.00"). */
export function formatGrade(grade: number | null | undefined): string {
    return grade === null || grade === undefined ? "-" : grade.toFixed(2);
}

export interface FlatQuarterGradePreview {
    totalScore: number;
    totalMaxScore: number;
    quarterGrade: number | null;
    remarks: string | null;
}

const ASSESSMENT_TYPES: AssessmentType[] = ["written_work", "performance_task", "quarterly_assessment"];

/**
 * Mirrors the server's flat quarter-grade formula for the live score sheet.
 *
 * Deliberately identical to `computeQuarterGrade` in server/src/service/gradebook.ts.
 * The one intentional difference: a draft cell holding something that is not a
 * finite number is treated as "not graded", because the server rejects such a
 * value on save (`Score must be between 0 and maxScore`) so it can never become
 * a stored grade, and rendering "NaN" would be worse than rendering "—".
 */
export function computeFlatQuarterGradePreview(
    assessments: Assessment[],
    weights: GradeWeights,
    draftRow: Record<number, string> | undefined,
    attendance: { presentDays: number; totalDays: number } | null,
): FlatQuarterGradePreview {
    const draftScore = (assessmentId: number): number | null => {
        const raw = draftRow?.[assessmentId];
        if (raw === undefined || raw.trim() === "") return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    };

    const gradedAssessments = assessments.filter((assessment) => draftScore(assessment.id) !== null);

    const totalScore = gradedAssessments.reduce((sum, assessment) => sum + draftScore(assessment.id)!, 0);
    const totalMaxScore = gradedAssessments.reduce((sum, assessment) => sum + Number(assessment.maxScore), 0);

    const weightByType: Record<AssessmentType, number> = {
        written_work: Number(weights.writtenWorkWeight),
        performance_task: Number(weights.performanceTaskWeight),
        quarterly_assessment: Number(weights.quarterlyAssessmentWeight),
    };

    let weightedPercentageSum = 0;
    let activeWeightSum = 0;

    for (const assessmentType of ASSESSMENT_TYPES) {
        const typeAssessments = gradedAssessments.filter((assessment) => assessment.type === assessmentType);
        if (typeAssessments.length === 0) continue;

        const earnedScoreSum = typeAssessments.reduce((sum, assessment) => sum + draftScore(assessment.id)!, 0);
        const maxScoreSum = typeAssessments.reduce((sum, assessment) => sum + Number(assessment.maxScore), 0);
        if (maxScoreSum === 0) continue;

        const typePercentage = (earnedScoreSum / maxScoreSum) * 100;
        weightedPercentageSum += typePercentage * weightByType[assessmentType];
        activeWeightSum += weightByType[assessmentType];
    }

    const attendanceWeight = Number(weights.attendanceWeight);
    if (attendance && attendance.totalDays > 0 && attendanceWeight > 0) {
        const attendancePercentage = (attendance.presentDays / attendance.totalDays) * 100;
        weightedPercentageSum += attendancePercentage * attendanceWeight;
        activeWeightSum += attendanceWeight;
    }

    if (activeWeightSum === 0) {
        return { totalScore, totalMaxScore, quarterGrade: null, remarks: null };
    }

    const quarterGrade = Math.round((weightedPercentageSum / activeWeightSum) * 100) / 100;
    return {
        totalScore,
        totalMaxScore,
        quarterGrade,
        remarks: quarterGrade >= PASSING_GRADE ? "Passed" : "Failed",
    };
}
