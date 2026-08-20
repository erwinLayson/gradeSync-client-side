import { useContext } from "react";
import { UserContext } from "../context/userContextDefinition";

export function useUser() {
    const context = useContext(UserContext);

    if(!context) {
        throw new Error("User Must be use inside the context provider")
    }

    return context;
}