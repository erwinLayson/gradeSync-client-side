import { useEffect, useRef, useState } from "react";

import { getAPICall } from "../api/api";
import { ROLES } from "../constant/users";
import { useUser } from "./useUser";

export interface AcademicSettings {
    id: number;
    currentQuarter: number;
    numQuarters: number;
    enrollmentOpen: boolean | number;
    submissionsLocked: boolean | number;
}

// Module-level cache so all pages share a single request.
let cachedPromise: Promise<AcademicSettings | null> | null = null;
// Track which user (and role) the cache belongs to so we re-fetch after
// login/logout — and so a student never reuses an admin/teacher response.
let cachedKey: string | null = null;

// Called after academic settings are edited so consumers re-fetch on the next render.
export function invalidateAcademicSettingsCache() {
    cachedPromise = null;
    cachedKey = null;
}

// The grading configuration lives behind two endpoints with identical payloads:
// /academic-settings is restricted to admin/teacher, while students read the
// same data through the student-only /students/current-quarter. Calling the
// admin/teacher route as a student returned 403 ("Forbidden"), which surfaced as
// an error toast on the student's My Classrooms and Prospectus pages.
function settingsEndpointFor(role: string | null | undefined): string {
    return role === ROLES.STUDENT ? "/students/current-quarter" : "/academic-settings";
}

function fetchAcademicSettings(userId: number | string | null, role: string | null | undefined): Promise<AcademicSettings | null> {
    const key = `${userId ?? "anonymous"}:${role ?? "none"}`;
    if (!cachedPromise || cachedKey !== key) {
        cachedKey = key;
        // Expected-optional fetch: the hook falls back to sane defaults, so a
        // failure must stay silent instead of raising a global error toast.
        cachedPromise = getAPICall<AcademicSettings>(settingsEndpointFor(role), { toast: false, skipErrorToast: true })
            .then((response) => response.data ?? null)
            .catch(() => null);
    }
    return cachedPromise;
}

/**
 * Returns the school's academic settings including numQuarters.
 * Listens for the "academic-settings-updated" window event to auto-refresh.
 * Automatically re-fetches when the logged-in user changes (login/logout).
 */
export function useAcademicSettings() {
    const { user } = useUser();
    const [settings, setSettings] = useState<AcademicSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const prevUserIdRef = useRef<number | string | null>(null);

    useEffect(() => {
        let cancelled = false;

        // When the user changes (login/logout), clear the cache so we
        // always pick up the latest settings for the new session.
        const currentUserId = user?.id ?? null;
        if (prevUserIdRef.current !== currentUserId) {
            invalidateAcademicSettingsCache();
            prevUserIdRef.current = currentUserId;
        }

        const load = async () => {
            const data = await fetchAcademicSettings(currentUserId, user?.role);
            if (!cancelled) {
                setSettings(data);
                setLoading(false);
            }
        };

        load();

        const onUpdated = () => {
            invalidateAcademicSettingsCache();
            load();
        };
        window.addEventListener("academic-settings-updated", onUpdated);

        return () => {
            cancelled = true;
            window.removeEventListener("academic-settings-updated", onUpdated);
        };
    }, [user]);

    const numQuarters = settings?.numQuarters ?? 4;
    const currentQuarter = settings?.currentQuarter ?? 1;

    /** Returns an array of valid quarter numbers, e.g. [1, 2, 3] or [1, 2, 3, 4]. */
    const quarters = Array.from({ length: numQuarters }, (_, i) => i + 1);

    return { settings, numQuarters, currentQuarter, quarters, loading };
}
