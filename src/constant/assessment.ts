// Matches the server's AssessmentType — assessments store the singular
// "quarterly_assessment" value in the database.
export type AssessmentType = "written_work" | "performance_task" | "quarterly_assessment"

export interface Assessment {
    id: number,
    classSubjectId: number;
    quarter: number
    type: AssessmentType,
    title: string;
    maxScore: number;
    dateGiven: string | null;
    created_at?: string;
}