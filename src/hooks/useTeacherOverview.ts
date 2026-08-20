import { useEffect, useMemo, useState } from "react";

import { getAPICall } from "../api/api";
import { useUser } from "./useUser";

import type { TeacherDetails, TeacherSubjectDetails } from "../constant/teachers";
import type { ClassroomResponseProps } from "../constant/classrooms";

// ================= Types =================

export interface ClassGroup {
    classId: number;
    classSection: string;
    classGradeLevel: number;
    subjects: TeacherSubjectDetails[];
}

export interface AdviserClassStat {
    classId: number;
    classSection: string;
    classGradeLevel: number;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
}

export interface TeacherOverview {
    teacher: TeacherDetails;
    subjectDetails: TeacherSubjectDetails[];
    classrooms: ClassroomResponseProps[];
    classes: ClassGroup[];
    adviserClasses: ClassroomResponseProps[];
    adviserClassStats: AdviserClassStat[];
    totalStudents: number;
    totalSubjects: number;
    weeklyHours: number;
}

// ================= Hook =================

export function useTeacherOverview() {
    const { user, loading: userLoading } = useUser();
    const [data, setData] = useState<TeacherOverview | null>(null);
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
                // 1. Find the teacher record linked to the logged-in account
                const teacherRes = await getAPICall<TeacherDetails>(`/teachers/by-user/${user.id}`);
                const teacher = teacherRes.data ?? null;
                if (cancelled) return;

                if (!teacher) {
                    setLoading(false);
                    setError(true);
                    return;
                }

                // 2. Load subjects and classrooms in parallel
                const [subjectsRes, classroomsRes] = await Promise.all([
                    getAPICall<TeacherSubjectDetails[]>(`/teachers/${teacher.id}/subjects`),
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

                // 4. Filter adviser classes (where this teacher is the formal class adviser)
                const adviserClasses = classrooms.filter((cl) => cl.adviserId === teacher.id);

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

                // 6. Compute summary stats
                const totalStudents = adviserClasses.reduce(
                    (sum, cl) => sum + (cl.totalStudent ?? 0),
                    0,
                );
                const totalSubjects = subjectDetails.length;
                const weeklyHours = subjectDetails.reduce((sum, row) => sum + Number(row.subjectUnit), 0);

                setData({
                    teacher,
                    subjectDetails,
                    classrooms,
                    classes,
                    adviserClasses,
                    adviserClassStats,
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
    }, [user, userLoading]);

    // Derived helper: student count for a given classId
    const studentCountFor = useMemo(() => {
        if (!data) return () => 0;
        const { classrooms } = data;
        return (classId: number) => classrooms.find((cl) => cl.id === classId)?.totalStudent ?? 0;
    }, [data]);

    return {
        ...data,
        loading: userLoading || loading,
        error,
        studentCountFor,
    };
}
