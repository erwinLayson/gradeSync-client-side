import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { FiLoader } from "react-icons/fi";

import { useAuth } from "../hooks/useAuth";
import { useUser } from "../hooks/useUser";
import { getAPICall } from "../api/api";
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
            <div className="protected-route__loader protected-route__bounce" aria-hidden="true">
                <span className="protected-route__bounce-dot" />
                <span className="protected-route__bounce-dot" />
                <span className="protected-route__bounce-dot" />
            </div>
            <FiLoader className="protected-route__spin" size={22} aria-hidden="true" />
            <p className="protected-route__status">Loading…</p>
        </div>
    );
}

export default function ProtectedRoutes({ allowedRoles }: ProtectedRoutesProps) {
    const { loading, auth } = useAuth();
    const { user } = useUser();

    // The verified faculty role drives faculty workspaces. It is resolved
    // asynchronously once on first entry: GET /faculties/by-user/:id resolves
    // the account to its authoritative faculties.role (register | teacher).
    const [facultyRole, setFacultyRole] = useState<string | null>(null);
    const [isFetchingFaculty, setIsFetchingFaculty] = useState(false);
    const [facultyLookupComplete, setFacultyLookupComplete] = useState(false);

    // The async identity check happens once per session: the account is a
    // faculty account, and if this workspace is a faculty workspace, resolve
    // the account's verified faculties.role. A register member must never be
    // routed into a teacher workspace, and a teacher must never reach a
    // register-only workspace.
    const resolveFacultyRole = useCallback(async () => {
        if (
            !user?.id ||
            user.role !== "teacher" ||
            user.facultyRole ||
            facultyLookupComplete ||
            isFetchingFaculty
        ) {
            return;
        }
        setIsFetchingFaculty(true);
        try {
            const response = await getAPICall<{ id: number; role: string }>(
                `/faculties/by-user/${user.id}`,
                { toast: false, skipErrorToast: true },
            );
            const faculty = response.data;
            if (!faculty) {
                return;
            }
            setFacultyRole(faculty.role);
        } catch {
            // Missing/pending faculty row: do not route a faculty workspace.
        } finally {
            setFacultyLookupComplete(true);
            setIsFetchingFaculty(false);
        }
    }, [facultyLookupComplete, isFetchingFaculty, user]);

    // Faculty workspaces are authorized by the authenticated user's verified
    // faculty role, not by the user-role claim alone (register is no longer a
    // user role). The frontend mirror must not advertise a workspace the
    // backend would refuse.
    useEffect(() => {
        // `resolveFacultyRole` is async: never `await` it at the top level of
        // the effect (or the component body), which is what produced "await is
        // only allowed within async functions". The `setTimeout` deferral also
        // keeps its setState calls out of the synchronous effect body
        // (react-hooks/set-state-in-effect).
        const timer = window.setTimeout(() => {
            void resolveFacultyRole();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [resolveFacultyRole]);

    if (loading) {
        return <RouteLoadingSplash />;
    }

    if (!auth) {
        return <Navigate to="/login" replace />;
    }

    if (user?.role === "teacher") {
        // The verified session may already carry the faculty role (login
        // response / /users/verify); fall back to the async lookup result.
        const resolvedFacultyRole = user.facultyRole ?? facultyRole;

        // Only wait for the lookup when the session did not already carry the
        // role — otherwise a present `user.facultyRole` would leave the
        // loading splash stuck on forever.
        if (!resolvedFacultyRole && !facultyLookupComplete) {
            return <RouteLoadingSplash />;
        }

        if (!resolvedFacultyRole || !allowedRoles.includes(resolvedFacultyRole)) {
            return <Navigate to="/unauthorized" replace />;
        }

        return <Outlet />;
    }

    if (!user || !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
}
