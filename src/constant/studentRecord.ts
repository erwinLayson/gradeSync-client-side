// Client mirror of server/src/constant/studentRecord.ts — quarterly student-record
// submission workflow (class advisers). See docs/student-record-submission.md.

export interface ClassRecordSubject {
    classSubjectId: number;
    subjectId: number;
    subjectName: string;
    subjectCode: string;
}

export interface StudentSubjectGrade {
    subjectId: number;
    // Whether the student is enrolled in this subject (E7).
    enrolled: boolean;
    // Displayed grade: computed live while pending, frozen qN once submitted.
    grade: number | null;
    source: "computed" | "frozen";
}

export type RecordStatus = "pending" | "submitted";

export interface StudentClassRecordRow {
    enrollmentId: number;
    studentId: number;
    studentLrn: number | string;
    fullname: string;
    studentSex: string;
    status: RecordStatus;
    // Last freeze timestamp; kept after reopen for the audit trail (E5).
    submittedAt: string | null;
    recordId: number | null;
    subjects: StudentSubjectGrade[];
}

export interface ClassRecordsResponse {
    classId: number;
    section: string;
    gradeLevel: number;
    adviserId: number | null;
    adviserFullname: string | null;
    quarter: number;
    subjects: ClassRecordSubject[];
    students: StudentClassRecordRow[];
    progress: { total: number; submitted: number; pending: number };
}

export interface BlockedStudent {
    enrollmentId: number;
    fullname: string;
    missingSubjects: string[];
}

export interface SubmitAllResult {
    submitted: number;
    alreadySubmitted: number;
    blocked: BlockedStudent[];
}

export interface SubmissionSummaryRow {
    classId: number;
    section: string;
    gradeLevel: number;
    adviserId: number | null;
    adviserFullname: string | null;
    totalStudents: number;
    // quarter -> number of students with a submitted record for that quarter
    submitted: Record<number, number>;
}

export interface ClassSubjectSubmissionRow {
    id: number;
    classSubjectId: number;
    quarter: number;
    schoolYearId: number;
    status: RecordStatus;
    submittedAt: Date | string | null;
    submittedBy: number | null;
    totalStudents: number;
    submittedStudents: number;
    created_at?: string;
    updated_at?: string;
}

export interface TeacherSubjectOption {
    classSubjectId: number;
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    subjectUnit: number;
    classId: number;
    classSection: string;
    classGradeLevel: number;
    totalStudents: number;
    submissionStatus: Record<number, RecordStatus>;
}

export interface SubjectStudentRow {
    enrollmentId: number;
    studentId: number;
    studentLrn: string | number;
    fullname: string;
    studentSex: string;
    writtenWorkScore: number | null;
    performanceTaskScore: number | null;
    quarterlyAssessmentScore: number | null;
    attendancePresentDays: number;
    attendanceTotalDays: number;
    attendanceRate: number | null;
    quarterGrade: number | null;
    source: "computed" | "frozen";
    isFrozen: boolean;
    status: RecordStatus;
    submittedAt: string | null;
    hasActiveAmendment: boolean;
    activePermissionId?: number | null;
}

export interface SubjectClassRecordResponse {
    classSubjectId: number;
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    classId: number;
    classSection: string;
    classGradeLevel: number;
    quarter: number;
    isSubjectSubmitted: boolean;
    submittedAt: string | null;
    submittedBy: number | null;
    submittedByName?: string | null;
    students: SubjectStudentRow[];
    progress: { total: number; submitted: number; pending: number };
}

export interface SubjectSubmissionSummaryRow {
    classSubjectId: number;
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    classId: number;
    classSection: string;
    classGradeLevel: number;
    teacherId: number | null;
    teacherName: string;
    totalStudents: number;
    submitted: Record<number, number>;
    statusByQuarter: Record<number, RecordStatus>;
}
