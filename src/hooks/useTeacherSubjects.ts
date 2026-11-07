import { useCallback, useEffect, useState } from "react";
import { getMyAssignedSubjects } from "../api/studentRecord";
import type { TeacherSubjectOption } from "../constant/studentRecord";

export function useTeacherSubjects() {
    const [subjects, setSubjects] = useState<TeacherSubjectOption[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getMyAssignedSubjects();
            const list = res.data ?? [];
            setSubjects(list);
            if (list.length > 0) {
                // Keep selected if still present, otherwise default to first
                setSelectedSubjectId((prev) => {
                    if (prev && list.some((s) => s.classSubjectId === prev)) {
                        return prev;
                    }
                    return list[0]!.classSubjectId;
                });
            } else {
                setSelectedSubjectId(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load assigned subjects");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubjects();
    }, [fetchSubjects]);

    const selectedSubject = subjects.find((s) => s.classSubjectId === selectedSubjectId) ?? null;

    return {
        subjects,
        selectedSubjectId,
        selectedSubject,
        setSelectedSubjectId,
        loading,
        error,
        refetchSubjects: fetchSubjects
    };
}

