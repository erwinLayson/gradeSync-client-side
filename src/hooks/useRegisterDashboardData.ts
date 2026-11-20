import { useCallback, useEffect, useState } from "react";
import { getAPICall } from "../api/api";
import type { SchoolYear, ActiveSchoolYearResponse } from "../constant/schoolYear";
import type { StudentListResponse, StudentResponseProps } from "../constant/students";
import type { SubmissionSummaryRow } from "../constant/studentRecord";
import type { AmendmentRequest } from "../constant/amendment";

export interface RegisterActivityItem {
    id: string;
    type: "registration" | "enrollment" | "amendment";
    title: string;
    description: string;
    timestamp: string | null;
    link: string;
}

export interface RegisterDashboardData {
    academicContext: {
        activeSchoolYear: SchoolYear | null;
        currentQuarter: number;
        numQuarters: number;
        enrollmentOpen: boolean | null;
        submissionsLocked: boolean;
    };
    statistics: {
        totalStudents: number;
        enrolledStudents: number;
        eligibleNotEnrolledStudents: number;
        submissionProgress: {
            submitted: number;
            total: number;
            percentage: number;
        };
    };
    recentActivity: RegisterActivityItem[];
    loading: boolean;
    error: boolean;
    refetch: () => Promise<void>;
}

interface AcademicSettingsApiData {
    currentQuarter?: number;
    numQuarters?: number;
    enrollmentOpen?: boolean | number;
    submissionsLocked?: boolean | number;
}

export function useRegisterDashboardData(): RegisterDashboardData {
    const [academicContext, setAcademicContext] = useState<RegisterDashboardData["academicContext"]>({
        activeSchoolYear: null,
        currentQuarter: 1,
        numQuarters: 4,
        enrollmentOpen: null,
        submissionsLocked: false,
    });

    const [statistics, setStatistics] = useState<RegisterDashboardData["statistics"]>({
        totalStudents: 0,
        enrolledStudents: 0,
        eligibleNotEnrolledStudents: 0,
        submissionProgress: {
            submitted: 0,
            total: 0,
            percentage: 0,
        },
    });

    const [recentActivity, setRecentActivity] = useState<RegisterActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setError(false);

        try {
            // 1. Fetch active school year & academic settings in parallel
            const [activeSyRes, settingsRes] = await Promise.all([
                getAPICall<ActiveSchoolYearResponse>("/schoolYear/active", { toast: false }).catch(() => null),
                getAPICall<AcademicSettingsApiData>("/academic-settings", { toast: false }).catch(() => null),
            ]);

            const activeYear = activeSyRes?.data?.activeSchoolYear ?? null;
            const settings = settingsRes?.data;
            const currentQuarter = Number(settings?.currentQuarter) || 1;
            const numQuarters = Number(settings?.numQuarters) || 4;
            const enrollmentOpen = settings?.enrollmentOpen !== undefined ? Boolean(settings.enrollmentOpen) : null;
            const submissionsLocked = Boolean(settings?.submissionsLocked);

            setAcademicContext({
                activeSchoolYear: activeYear,
                currentQuarter,
                numQuarters,
                enrollmentOpen,
                submissionsLocked,
            });

            // 2. Fetch statistics and activity concurrently
            const syIdParam = activeYear?.id;

            const [
                totalStudentsRes,
                enrolledStudentsRes,
                notEnrolledRes,
                submissionSummaryRes,
                recentStudentsRes,
                amendmentsRes,
            ] = await Promise.all([
                // Total active students
                getAPICall<StudentListResponse>("/students?limit=1", { toast: false }).catch(() => null),

                // Enrolled students in active school year
                syIdParam
                    ? getAPICall<StudentListResponse>(`/students?schoolYearId=${syIdParam}&status=enrolled&limit=1`, { toast: false }).catch(() => null)
                    : Promise.resolve(null),

                // Eligible students not yet enrolled
                getAPICall<StudentResponseProps[]>(
                    syIdParam ? `/students/not-enrolled?search=&schoolYearId=${syIdParam}` : "/students/not-enrolled?search=",
                    { toast: false }
                ).catch(() => null),

                // Submission summary for current quarter
                getAPICall<SubmissionSummaryRow[]>(
                    syIdParam ? `/student-records/summary?schoolYearId=${syIdParam}` : "/student-records/summary",
                    { toast: false }
                ).catch(() => null),

                // Recent student registrations
                getAPICall<StudentListResponse>("/students?limit=6", { toast: false }).catch(() => null),

                // Recent amendments
                getAPICall<AmendmentRequest[]>("/amendments/requests", { toast: false }).catch(() => null),
            ]);

            // Compute statistics
            const totalStudents = totalStudentsRes?.data?.total ?? 0;
            const enrolledStudents = syIdParam ? (enrolledStudentsRes?.data?.total ?? 0) : 0;
            const eligibleNotEnrolledStudents = notEnrolledRes?.data?.length ?? 0;

            // Compute submission progress for currentQuarter across all classes
            let submittedRecords = 0;
            let totalExpectedRecords = 0;

            if (submissionSummaryRes?.data && Array.isArray(submissionSummaryRes.data)) {
                for (const row of submissionSummaryRes.data) {
                    const rowTotal = Number(row.totalStudents) || 0;
                    totalExpectedRecords += rowTotal;
                    const rowSubmitted = Number(row.submitted?.[currentQuarter]) || 0;
                    submittedRecords += rowSubmitted;
                }
            }

            const submissionPercentage = totalExpectedRecords > 0
                ? Math.round((submittedRecords / totalExpectedRecords) * 100)
                : 0;

            setStatistics({
                totalStudents,
                enrolledStudents,
                eligibleNotEnrolledStudents,
                submissionProgress: {
                    submitted: submittedRecords,
                    total: totalExpectedRecords,
                    percentage: submissionPercentage,
                },
            });

            // 3. Assemble unified recent activity feed
            const activities: RegisterActivityItem[] = [];

            // Add recent registrations
            const recentStudents = recentStudentsRes?.data?.students ?? [];
            for (const s of recentStudents) {
                activities.push({
                    id: `reg-${s.id}`,
                    type: "registration",
                    title: "Learner Registered",
                    description: `${s.fullname} (LRN: ${s.lrn}) registered in student registry`,
                    timestamp: s.birthdate ? null : null, // birthdate is not reg time; we use created_at if available
                    link: `/register/students?search=${encodeURIComponent(String(s.lrn))}`,
                });
            }

            // Add recent amendment events
            const recentAmendments = amendmentsRes?.data ?? [];
            for (const a of recentAmendments.slice(0, 6)) {
                const statusLabel =
                    a.status === "approved"
                        ? "Amendment Approved"
                        : a.status === "rejected"
                          ? "Amendment Rejected"
                          : a.status === "revoked"
                            ? "Amendment Revoked"
                            : "Amendment Requested";

                activities.push({
                    id: `amd-${a.id}`,
                    type: "amendment",
                    title: statusLabel,
                    description: `${a.requestNumber}: ${a.studentName ?? "Student"} (${a.section ?? "Class"}) · ${a.reason ?? "Record change"}`,
                    timestamp: null,
                    link: "/register/amendments",
                });
            }

            setRecentActivity(activities.slice(0, 8));
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboardData();
    }, [loadDashboardData]);

    return {
        academicContext,
        statistics,
        recentActivity,
        loading,
        error,
        refetch: loadDashboardData,
    };
}
