import { useEffect, useState } from "react";

import type{User} from "../constant/users"
import {getAPICall, postAPICall} from "../api/api"

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        fetchUser();
    }, [])

    async function fetchUser() {
        try {
            setLoading(true);
            const response = await getAPICall<User>('/users/verify', { toast: false });
            setUser(response.data ?? null);
        }catch(err) {
            console.error("Error verifying user:", err);
        }finally {
            setLoading(false);
        }
    }

    async function logout(): Promise<boolean> {
        try {
            await postAPICall('/users/logout', {});
            setUser(null);
            return true;
        } catch (err) {
            console.error("Error logging out:", err);
            return false;
        }
    }

    return { user, loading, fetchUser, logout };
}