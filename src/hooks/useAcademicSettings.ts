import { useEffect, useRef, useState } from "react";

import { getAPICall } from "../api/api";
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
// Track which user the cache belongs to so we re-fetch after login/logout.
let cachedUserId: number | string | null = null;

// Called after academic settings are edited so consumers re-fetch on the next render.
export function invalidateAcademicSettingsCache() {
    cachedPromise = null;
    cachedUserId = null;
}

function fetchAcademicSettings(userId: number | string | null): Promise<AcademicSettings | null> {
    if (!cachedPromise || cachedUserId !== userId) {
        cachedUserId = userId;
        cachedPromise = getAPICall<AcademicSettings>("/academic-settings", { toast: false })
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
            const data = await fetchAcademicSettings(currentUserId);
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
