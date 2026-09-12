import {Navigate, Outlet} from "react-router-dom";
import { FiLoader } from "react-icons/fi";

import { useAuth } from "../hooks/useAuth";
import {useUser } from "../hooks/useUser"
import logo1 from "../assets/logo1.webp";
import "../style/protectedRoutes.css";

interface ProtectedRoutesProps {
    allowedRoles: string[];
}

function RouteLoadingSplash() {
    return (
        <div
            className="protected-route__splash"
            role="status"
            aria-live="polite"
            aria-label="Checking your session"
        >
            <div className="protected-route__logo" aria-hidden="true">
                <img src={logo1} alt="" />
            </div>
            <FiLoader className="protected-route__spin" size={22} aria-hidden="true" />
            <p className="protected-route__status">Loading…</p>
        </div>
    );
}

export default function ProtectedRoutes({allowedRoles}: ProtectedRoutesProps) {
    const {loading, auth} = useAuth();
    const {user} = useUser()

    if(loading) {
        return <RouteLoadingSplash />;
    }

    if(!auth) {
        return <Navigate to="/login" replace />
    }

    if(!user  || !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />
    }

    return <Outlet />
}