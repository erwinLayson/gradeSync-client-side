import { useEffect, useState } from "react";
import { getAPICall } from "../api/api";

export default function useClassroom<T>() {
    const [classrooms, setClassrooms] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClassroom();
    }, []);

    async function fetchClassroom() {
        try {
            setLoading(true);

            const response = await getAPICall<T>("/classrooms");

            setClassrooms(response.data ?? null);
        } catch (err) {
            console.error(err);
            setClassrooms(null);
        } finally {
            setLoading(false);
        }
    }

    return {
        classrooms,
        loading,
        setLoading,
        refetchClassroom: fetchClassroom,
    };
}