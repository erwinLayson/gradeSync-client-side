import { useEffect, useState } from "react";

import { getAPICall } from "../api/api";
import type { SchoolInfoProps } from "../constant/schoolInfo";
import { fetchSchoolLogo, invalidateSchoolLogoCache } from "./useSchoolLogo";

interface SchoolInfoData {
    schoolName: string | null;
    schoolLogo: string | null;
}

// Module-level cache so the Sidebar and layout header share a single request,
// and so the saved school name/logo survive page navigation within the app.
let cachedPromise: Promise<SchoolInfoData> | null = null;

// Called after the school info or logo is edited so consumers re-fetch on the
// next render.
export function invalidateSchoolInfoCache() {
    cachedPromise = null;
    invalidateSchoolLogoCache();
}

function fetchSchoolInfo(): Promise<SchoolInfoData> {
    if (!cachedPromise) {
        cachedPromise = Promise.all([
            getAPICall<SchoolInfoProps>("/school-info", { toast: false })
                .then((response) => response.data ?? null)
                .catch(() => null),
            fetchSchoolLogo(),
        ]).then(([info, logo]) => ({
            schoolName: info?.name ?? null,
            schoolLogo: logo,
        }));
    }
    return cachedPromise;
}

// Loads the school identity once; also refreshes when the "school-info-updated"
// window event fires (dispatched by the settings page after a successful save).
export function useSchoolInfo() {
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfoData>({
        schoolName: null,
        schoolLogo: null,
    });

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const info = await fetchSchoolInfo();
            if (!cancelled) {
                setSchoolInfo(info);
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

    return schoolInfo;
}
