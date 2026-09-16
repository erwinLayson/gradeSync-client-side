import { useState } from "react";
import { getAPICall } from "../api/api";

function useSubjects<T>() {
    const [subjects, setSubjects] = useState<T | null>(null);
    const [subjectsLoading, setSubjectsLoading] = useState(true);

    const fetchSubjects = async (endpoint: string) => {
        try {
            setSubjectsLoading(true);
            const response = await getAPICall<T>(endpoint);
            setSubjects(response.data ?? null);
        }catch {
            setSubjects(null)
        }finally {
            setSubjectsLoading(false);
        }
    }


    return {subjects, subjectsLoading, fetchSubjects}
}


export default useSubjects;