import { useState } from "react";
import { getAPICall } from "../api/api";

export default function useFaculties<T>() {
    const [faculties, setFaculties] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(false);


    async function fetchFaculties(endpoint: string):Promise<void> {
        try {
            setLoading(true);
            const response = await getAPICall<T>(endpoint);
            setFaculties(response.data ?? null);
        }catch {
            // Error toast is handled by the axios interceptor in api.ts
        }finally {
            setLoading(false);
        }
    }


    return { faculties, loading, fetchFaculties };
}