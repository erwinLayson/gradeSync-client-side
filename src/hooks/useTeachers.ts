import { useState } from "react";
import { getAPICall } from "../api/api";

export default function useTeachers<T>() {
    const [teachers, setTeachers] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(false);


    async function fetchTeachers(endpoint: string):Promise<void> {
        try {
            setLoading(true);
            const response = await getAPICall<T>(endpoint);
            setTeachers(response.data ?? null);
        }catch {
            // Error toast is handled by the axios interceptor in api.ts
        }finally {
            setLoading(false);
        }
    }


    return { teachers, loading, fetchTeachers };
}