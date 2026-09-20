// Shared types for the student self-service views (My Classrooms, Prospectus).
// Mirrors the GET /students/classes response.

export type AssessmentType = "written_work" | "performance_task" | "quarterly_assessment";

export interface AssessmentActivity {
    id: number;
    quarter: number;
    type: AssessmentType;
    title: string;
    maxScore: number;
    dateGiven: string | null;
    score: number | null;
}

export interface AttendanceRecord {
    date: string;
    status: string | null;
}

export interface AttendanceQuarter {
    quarter: number;
    presentDays: number;
    totalDays: number;
    percentage: number | null;
    records: AttendanceRecord[];
}

export interface SubjectGrade {
    // null for frozen record rows (from student_academic_record_subjects) — those
    // have no live class-subject id, teacher, or unit; they carry the official
    // snapshot grades instead. Live gradebook rows always have a real id.
    classSubjectId: number | null;
    subjectId: number | null;
    name: string;
    code: string;
    unit: number | null;
    teacher: string | null;
    quarters: (number | null)[];
    final: number | null;
    remarks: string | null;
    assessments: AssessmentActivity[];
    attendance: AttendanceQuarter[];
}

export interface StudentClass {
    enrollmentId: number;
    classId: number;
    section: string;
    gradeLevel: number;
    schoolYearId: number;
    schoolYear: string;
    adviser: string | null;
    subjects: SubjectGrade[];
    generalAverage: number | null;
}

export interface StudentClassesData {
    student: {
        id: number;
        lrn: string;
        email: string;
        fullname: string;
    };
    classes: StudentClass[];
}

export const TYPE_LABELS: Record<AssessmentType, string> = {
    written_work: "Written Work",
    performance_task: "Performance Task",
    quarterly_assessment: "Quarterly Assessment",
};
