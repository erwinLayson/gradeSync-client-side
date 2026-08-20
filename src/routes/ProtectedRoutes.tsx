import {Navigate, Outlet} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import {useUser } from "../hooks/useUser"

interface ProtectedRoutesProps {
    allowedRoles: string[];
}

export default function ProtectedRoutes({allowedRoles}: ProtectedRoutesProps) {
    const {loading, auth} = useAuth();
    const {user} = useUser()

    if(loading) {
        return <div>Loading...</div>
    }

    if(!auth) {
        return <Navigate to="/login" replace />
    }

    if(!user  || !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />
    }

    return <Outlet />
}