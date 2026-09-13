import { useEffect, useState } from "react";

import { getAPICall } from "../api/api";
import {
    mergeLandingContent,
    type LandingContent,
} from "../constant/landingContent";

/*
 * Public landing content (docs/landing-content-plan.md Phase 3).
 *
 * Pattern: module-level cache + window-event invalidation (useSchoolInfo).
 * The GET is PUBLIC (no auth) and FAILS OPEN — on any error the hook serves
 * DEFAULT_LANDING_CONTENT, so an API outage degrades to today's hardcoded
 * page. Silent on failure (skipErrorToast): the anonymous landing page must
 * never toast.
 */

let cachedPromise: Promise<LandingContent> | null = null;

// Called after the developer saves a section so consumers re-fetch on the
// next render (and any open landing tab can refresh via the event).
export function invalidateLandingContentCache() {
    cachedPromise = null;
}

function fetchLandingContent(): Promise<LandingContent> {
    if (!cachedPromise) {
        cachedPromise = getAPICall<Record<string, unknown>>("/landing-content", {
            toast: false,
            skipErrorToast: true,
        })
            .then((response) => mergeLandingContent(response.data))
            // Fail-open: serve the defaults on any network/parse error.
            .catch(() => mergeLandingContent(null));
    }
    return cachedPromise;
}

/**
 * Loads landing content once and merges it over the defaults. Also refreshes
 * when the "landing-content-updated" window event fires (dispatched by the
 * developer page after a successful save — Phase 4).
 */
export function useLandingContent() {
    const [content, setContent] = useState<LandingContent | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const merged = await fetchLandingContent();
            if (!cancelled) {
                setContent(merged);
            }
        };

        load();

        const onUpdated = () => {
            invalidateLandingContentCache();
            load();
        };
        window.addEventListener("landing-content-updated", onUpdated);

        return () => {
            cancelled = true;
            window.removeEventListener("landing-content-updated", onUpdated);
        };
    }, []);

    return { content };
}
