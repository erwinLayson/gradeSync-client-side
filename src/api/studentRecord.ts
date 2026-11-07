import { getAPICall, postAPICall } from "./api";
import type {
    ClassRecordsResponse,
    SubmitAllResult,
    TeacherSubjectOption,
    SubjectClassRecordResponse,
    SubjectSubmissionSummaryRow,
    SubmissionSummaryRow
} from "../constant/studentRecord";

/**
 * Fetch all class subjects assigned to the authenticated teacher
 */
export const getMyAssignedSubjects = async () => {
    return getAPICall<TeacherSubjectOption[]>("/student-records/my-subjects");
};

/**
 * Fetch student roster and gradebook/attendance records for an assigned subject
 */
export const getSubjectClassRecords = async (classSubjectId: number, quarter: number = 1) => {
    return getAPICall<SubjectClassRecordResponse>(
        `/student-records/class-subjects/${classSubjectId}?quarter=${quarter}`
    );
};

/**
 * Submit all student records for an assigned class subject in a quarter
 */
export const submitSubjectRecords = async (classSubjectId: number, quarter: number) => {
    return postAPICall<undefined, { classSubjectId: number; quarter: number; status: "submitted"; totalStudents: number }>(
        `/student-records/class-subjects/${classSubjectId}/quarter/${quarter}/submit`,
        undefined
    );
};

/**
 * Submit a single student's subject record
 */
export const submitSingleStudentSubjectRecord = async (
    classSubjectId: number,
    enrollmentId: number,
    quarter: number
) => {
    return postAPICall<undefined, { enrollmentId: number; quarter: number; status: "submitted" }>(
        `/student-records/class-subjects/${classSubjectId}/students/${enrollmentId}/quarter/${quarter}/submit`,
        undefined
    );
};

/**
 * Reopen a submitted subject record
 */
export const reopenSubjectRecord = async (classSubjectId: number, quarter: number) => {
    return postAPICall<undefined, { status: "pending" }>(
        `/student-records/class-subjects/${classSubjectId}/quarter/${quarter}/reopen`,
        undefined
    );
};

/**
 * Admin/Register: Fetch subject-level submission summary
 */
export const getSubjectSubmissionSummary = async (schoolYearId?: number) => {
    const query = schoolYearId ? `?schoolYearId=${schoolYearId}` : "";
    return getAPICall<SubjectSubmissionSummaryRow[]>(`/student-records/subject-summary${query}`);
};

/**
 * Class Adviser: Fetch advised class records
 */
export const getMyClassRecords = async (quarter: number = 1) => {
    return getAPICall<ClassRecordsResponse>(`/student-records/my-class?quarter=${quarter}`);
};

/**
 * Class Adviser / Register: Fetch records for a specific class
 */
export const getClassRecords = async (classId: number, quarter: number = 1) => {
    return getAPICall<ClassRecordsResponse>(`/student-records/class/${classId}?quarter=${quarter}`);
};

/**
 * Class Adviser: Submit a single student's whole class record
 */
export const submitStudentRecord = async (classId: number, enrollmentId: number, quarter: number) => {
    return postAPICall<undefined, { recordId: number; status: "submitted" }>(
        `/student-records/class/${classId}/students/${enrollmentId}/quarter/${quarter}/submit`,
        undefined
    );
};

/**
 * Class Adviser: Submit all student records for a class
 */
export const submitAllStudentRecords = async (classId: number, quarter: number) => {
    return postAPICall<undefined, SubmitAllResult>(
        `/student-records/class/${classId}/quarter/${quarter}/submit-all`,
        undefined
    );
};

/**
 * Class Adviser: Reopen a whole class student record
 */
export const reopenStudentRecord = async (classId: number, enrollmentId: number, quarter: number) => {
    return postAPICall<undefined, { status: "pending" }>(
        `/student-records/class/${classId}/students/${enrollmentId}/quarter/${quarter}/reopen`,
        undefined
    );
};

/**
 * Admin/Register: Fetch class-level submission summary
 */
export const getSubmissionSummary = async (schoolYearId?: number) => {
    const query = schoolYearId ? `?schoolYearId=${schoolYearId}` : "";
    return getAPICall<SubmissionSummaryRow[]>(`/student-records/summary${query}`);
};

