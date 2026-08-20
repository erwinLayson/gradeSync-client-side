import {Navigate, Outlet} from "react-router-dom";

import { useUser } from "../hooks/useUser";

interface ProtectedRoutesProps {
    allowedRoles: string[];
}

export default function ProtectedRoutes({allowedRoles}: ProtectedRoutesProps) {
    const {loading, user} = useUser();

    if(loading) {
        return <div>Loading...</div>
    }

    if(!user) {
        return <Navigate to="/login" replace />
    }

    if(!allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />
    }

    return <Outlet />
}