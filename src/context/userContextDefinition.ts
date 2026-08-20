import { createContext } from "react";

import type { User } from "../constant/users";

export interface UserContextValue {
    user: User | null;
    loading: boolean;
    fetchUser: () => Promise<void>;
    logout: () => Promise<boolean>;
}

export const UserContext = createContext<UserContextValue>({
    user: null,
    loading: true,
    fetchUser: async () => undefined,
    logout: async () => false,
});
