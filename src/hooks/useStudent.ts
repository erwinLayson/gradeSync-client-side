import { useState } from "react";
import { getAPICall, type RequestOptions } from "../api/api";

export default function useStudent<StudentType>() {
    const [students, setStudents] = useState<StudentType | null>(null);
    const [loading, setLoading] = useState<boolean>(true);


    async function fetchStudents(endpoint?: string, options?: RequestOptions) {
        try {
            setLoading(true);

            const response = await getAPICall<StudentType>(endpoint ?? "/students" , options);
            setStudents(response.data ?? null);
        }catch {
            // Error toast is handled by the axios interceptor in api.ts
        }finally {
            setLoading(false);
        }
    }

    return { students, loading, refetchStudents: fetchStudents };
}