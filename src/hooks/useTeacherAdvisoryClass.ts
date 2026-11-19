import { useCallback, useEffect, useState } from "react";
import { getAPICall } from "../api/api";
import { useUser } from "./useUser";
import { ROLES } from "../constant/users";
import { FACULTY_ROLES } from "../constant/faculties";
import type { ClassroomResponseProps, ClassroomFacultiesWithSubjectProps } from "../constant/classrooms";

export interface AdvisedClassData {
    classroom: ClassroomResponseProps | null;
    facultiesWithSubjects?: ClassroomFacultiesWithSubjectProps[];
}

interface AdvisoryClassCache {
    userId: number;
    data: AdvisedClassData | null;
    hasAdvisoryClass: boolean;
}

let memoryCache: AdvisoryClassCache | null = null;
let inflightPromise: Promise<AdvisedClassData | null> | null = null;

export function invalidateTeacherAdvisoryClassCache() {
    memoryCache = null;
    inflightPromise = null;
}

export function useTeacherAdvisoryClass() {
    const { user, loading: userLoading } = useUser();
    const isTeacher = user?.role === ROLES.TEACHER && user?.facultyRole !== FACULTY_ROLES.REGISTER;

    const [hasAdvisoryClass, setHasAdvisoryClass] = useState<boolean>(() => {
        if (!user || !isTeacher) return false;
        if (memoryCache && memoryCache.userId === user.id) {
            return memoryCache.hasAdvisoryClass;
        }
        return false;
    });

    const [advisoryClass, setAdvisoryClass] = useState<AdvisedClassData | null>(() => {
        if (!user || !isTeacher) return null;
        if (memoryCache && memoryCache.userId === user.id) {
            return memoryCache.data;
        }
        return null;
    });

    const [loading, setLoading] = useState<boolean>(() => {
        if (!user || !isTeacher) return false;
        if (memoryCache && memoryCache.userId === user.id) return false;
        return true;
    });

    const [error, setError] = useState<string | null>(null);

    const checkAdvisory = useCallback(async (userId: number) => {
        setLoading(true);
        setError(null);
        try {
            if (!inflightPromise) {
                inflightPromise = getAPICall<AdvisedClassData>("/classrooms/my-advised-class", {
                    toast: false,
                    skipErrorToast: true,
                })
                    .then((res) => res.data ?? null)
                    .catch(() => null);
            }

            const data = await inflightPromise;
            const hasClass = Boolean(data && data.classroom && data.classroom.id);

            memoryCache = {
                userId,
                data,
                hasAdvisoryClass: hasClass,
            };

            setAdvisoryClass(data);
            setHasAdvisoryClass(hasClass);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to check advisory class");
            setHasAdvisoryClass(false);
            setAdvisoryClass(null);
        } finally {
            inflightPromise = null;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (userLoading) return;

        if (!user || !isTeacher) {
            setHasAdvisoryClass(false);
            setAdvisoryClass(null);
            setLoading(false);
            return;
        }

        if (memoryCache && memoryCache.userId === user.id) {
            setHasAdvisoryClass(memoryCache.hasAdvisoryClass);
            setAdvisoryClass(memoryCache.data);
            setLoading(false);
            return;
        }

        void checkAdvisory(user.id);
    }, [user, userLoading, isTeacher, checkAdvisory]);

    return {
        hasAdvisoryClass,
        advisoryClass,
        loading: userLoading || loading,
        error,
        refetch: () => (user?.id ? checkAdvisory(user.id) : Promise.resolve()),
    };
}
