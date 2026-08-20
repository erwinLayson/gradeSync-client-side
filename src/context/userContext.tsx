import { useEffect, useState, type ReactNode } from "react";

import { getAPICall, postAPICall } from "../api/api";
import type { User } from "../constant/users";
import { UserContext } from "./userContextDefinition";

export function UserContextProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    async function fetchUser() {
        setLoading(true);
        try {
            const response = await getAPICall<User>("/users/verify", { toast: false });
            const verifiedUser = response.data ?? null;
            setUser(verifiedUser);

            if (verifiedUser) {
                localStorage.setItem("user", JSON.stringify(verifiedUser));
            } else {
                localStorage.removeItem("user");
            }
        } catch {
            setUser(null);
            localStorage.removeItem("user");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchUser();
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    async function logout(): Promise<boolean> {
        try {
            await postAPICall("/users/logout", {});
            setUser(null);
            localStorage.removeItem("user");
            return true;
        } catch {
            return false;
        }
    }

    return (
        <UserContext.Provider value={{ user, loading, fetchUser, logout }}>
            {children}
        </UserContext.Provider>
    );
}