import { useState } from "react";
import { getAPICall } from "../api/api";

function useSubjects<T>() {
    const [subjects, setSubjects] = useState<T | null>(null);
    const [subjectsLoading, setSubjectsLoading] = useState(true);

    const fetchSubjects = async (endpont: string) => {
        try {
            setSubjectsLoading(true);
            const response = await getAPICall<T>(endpont);
            console.log(response.data)
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