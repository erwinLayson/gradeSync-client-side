import { useUser } from "./useUser";

export function useAuth() {
    const { user, loading, fetchUser, logout } = useUser();

    return { auth: Boolean(user), loading, Authenticate: fetchUser, logout };
}