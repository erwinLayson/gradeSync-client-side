import { useEffect, useState } from "react";

import { getAPICall } from "../api/api";
import type { SchoolInfoProps } from "../constant/schoolInfo";

// Module-level cache so the Sidebar and layout header share a single request,
// and so the saved school name survives page navigation within the app.
let cachedPromise: Promise<SchoolInfoProps | null> | null = null;

// Called after the school info is edited so consumers re-fetch on the next render.
export function invalidateSchoolInfoCache() {
    cachedPromise = null;
}

function fetchSchoolInfo(): Promise<SchoolInfoProps | null> {
    if (!cachedPromise) {
        cachedPromise = getAPICall<SchoolInfoProps>("/school-info", { toast: false })
            .then((response) => response.data ?? null)
            .catch(() => null);
    }
    return cachedPromise;
}

// Loads the school name once; also refreshes when the "school-info-updated"
// window event fires (dispatched by the settings page after a successful save).
export function useSchoolInfo() {
    const [schoolName, setSchoolName] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const info = await fetchSchoolInfo();
            if (!cancelled) {
                setSchoolName(info?.name ?? null);
            }
        };

        load();

        const onUpdated = () => {
            invalidateSchoolInfoCache();
            load();
        };
        window.addEventListener("school-info-updated", onUpdated);

        return () => {
            cancelled = true;
            window.removeEventListener("school-info-updated", onUpdated);
        };
    }, []);

    return { schoolName };
}
