import { useEffect, useState } from "react";

import { getAPICall } from "../api/api";
import type { SchoolLogoPayload } from "../constant/schoolInfo";

// Module-level cache so the public login/landing pages and authenticated
// sidebar share one logo request. The endpoint is public, so this hook is safe
// to use before sign-in.
let cachedPromise: Promise<string | null> | null = null;

export function invalidateSchoolLogoCache() {
    cachedPromise = null;
}

export function fetchSchoolLogo(): Promise<string | null> {
    if (!cachedPromise) {
        cachedPromise = getAPICall<SchoolLogoPayload>("/school-info/logo", {
            toast: false,
            skipErrorToast: true,
        })
            .then((response) => response.data?.logo?.dataUrl ?? null)
            .catch(() => null);
    }
    return cachedPromise;
}

export function useSchoolLogo() {
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const logo = await fetchSchoolLogo();
            if (!cancelled) setSchoolLogo(logo);
        };

        load();

        const onUpdated = () => {
            invalidateSchoolLogoCache();
            load();
        };
        window.addEventListener("school-info-updated", onUpdated);

        return () => {
            cancelled = true;
            window.removeEventListener("school-info-updated", onUpdated);
        };
    }, []);

    return { schoolLogo };
}
