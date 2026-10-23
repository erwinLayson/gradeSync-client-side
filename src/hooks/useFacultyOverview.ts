import { useEffect, useState } from "react";

import { getAPICall } from "../api/api";
import { useUser } from "./useUser";

import type { FacultyDetails, FacultySubjectDetails } from "../constant/faculties";
import type { ClassroomResponseProps } from "../constant/classrooms";

// ================= Types =================

export interface ClassGroup {
    classId: number;
    classSection: string;
    classGradeLevel: number;
    subjects: FacultySubjectDetails[];
}

export interface AdviserClassStat {
    classId: number;
    classSection: string;
    classGradeLevel: number;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
}

// One ranked student in the adviser's class honor roll.
export interface AdviserHonorStudent {
    rank: number;
    enrollmentId: number;
    studentId: number;
    studentLrn: string;
    fullname: string;
    average: number;
    gradedSubjects: number;
}

// Top students of the advised class, ranked by average quarter grade.
export interface AdviserHonorStudents {
    classId: number;
    classSection: string;
    classGradeLevel: number;
    quarter: number;
    passingGrade: number;
    students: AdviserHonorStudent[];
}

export interface FacultyOverview {
    faculty: FacultyDetails;
    subjectDetails: FacultySubjectDetails[];
    classrooms: ClassroomResponseProps[];
    classes: ClassGroup[];
    adviserClasses: ClassroomResponseProps[];
    adviserClassStats: AdviserClassStat[];
    honorStudents: AdviserHonorStudents | null;
    totalStudents: number;
    totalSubjects: number;
    weeklyHours: number;
}

// ================= Hook =================

export function useFacultyOverview(quarter = 1) {
    const { user, loading: userLoading } = useUser();
    const [data, setData] = useState<FacultyOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (userLoading) return;

        let cancelled = false;

        async function load() {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                // 1. Find the faculty record linked to the logged-in account
                const facultyRes = await getAPICall<FacultyDetails>(`/faculties/by-user/${user.id}`);
                const faculty = facultyRes.data ?? null;
                if (cancelled) return;

                if (!faculty) {
                    setLoading(false);
                    setError(true);
                    return;
                }

                // 2. Load subjects and classrooms in parallel
                const [subjectsRes, classroomsRes] = await Promise.all([
                    getAPICall<FacultySubjectDetails[]>(`/faculties/${faculty.id}/subjects`),
                    getAPICall<ClassroomResponseProps[]>("/classrooms"),
                ]);
                if (cancelled) return;

                const subjectDetails = subjectsRes.data ?? [];
                const classrooms = classroomsRes.data ?? [];

                // 3. Group flat subject rows into per-class cards
                const map = new Map<number, ClassGroup>();
                for (const row of subjectDetails) {
                    const group = map.get(row.classId);
                    if (group) {
                        group.subjects.push(row);
                    } else {
                        map.set(row.classId, {
                            classId: row.classId,
                            classSection: row.classSection,
                            classGradeLevel: row.classGradeLevel,
                            subjects: [row],
                        });
                    }
                }
                const classes = [...map.values()];

                // 4. Filter adviser classes (where this faculty is the formal class adviser)
                const adviserClasses = classrooms.filter((cl) => cl.adviserId === faculty.id);

                // 5. Fetch student gender counts for adviser classes
                const adviserClassStats: AdviserClassStat[] = await Promise.all(
                    adviserClasses.map(async (cl) => {
                        try {
                            const rosterRes = await getAPICall<{
                                students: { studentSex: string }[];
                            }>(`/class/${cl.id}/students`, { toast: false });
                            const students = rosterRes.data?.students ?? [];
                            const maleCount = students.filter(
                                (s) => s.studentSex?.toLowerCase() === "male",
                            ).length;
                            const femaleCount = students.filter(
                                (s) => s.studentSex?.toLowerCase() === "female",
                            ).length;
                            return {
                                classId: cl.id,
                                classSection: cl.section,
                                classGradeLevel: cl.gradeLevel,
                                totalStudents: students.length,
                                maleCount,
                                femaleCount,
                            };
                        } catch {
                            return {
                                classId: cl.id,
                                classSection: cl.section,
                                classGradeLevel: cl.gradeLevel,
                                totalStudents: cl.totalStudent ?? 0,
                                maleCount: 0,
                                femaleCount: 0,
                            };
                        }
                    }),
                );
                if (cancelled) return;

                // 6. Honor roll for the advised class. Adviser-only: no request
                // is sent when the faculty advises no class, and the server also
                // returns null in that case.
                let honorStudents: AdviserHonorStudents | null = null;
                if (adviserClasses.length > 0) {
                    try {
                        const honorRes = await getAPICall<AdviserHonorStudents | null>(
                            `/classrooms/my-advised-class/honor-students?quarter=${quarter}`,
                            { toast: false },
                        );
                        if (cancelled) return;
                        honorStudents = honorRes.data ?? null;
                    } catch {
                        // Non-blocking: the dashboard simply hides the honor roll.
                    }
                }
                if (cancelled) return;

                // 7. Compute summary stats
                const totalStudents = adviserClasses.reduce(
                    (sum, cl) => sum + (cl.totalStudent ?? 0),
                    0,
                );
                const totalSubjects = subjectDetails.length;
                const weeklyHours = subjectDetails.reduce((sum, row) => sum + Number(row.subjectUnit), 0);

                setData({
                    faculty,
                    subjectDetails,
                    classrooms,
                    classes,
                    adviserClasses,
                    adviserClassStats,
                    honorStudents,
                    totalStudents,
                    totalSubjects,
                    weeklyHours,
                });
            } catch {
                // Error toast handled by the API interceptor
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [user, userLoading, quarter]);

    return {
        ...data,
        loading: userLoading || loading,
        error,
    };
}
