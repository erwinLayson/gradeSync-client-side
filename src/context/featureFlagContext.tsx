import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { getAPICall } from "../api/api";
import { FeatureFlagContext, type FeatureFlagContextValue } from "./featureFlagContextDefinition";

// Mock map used when VITE_FEATURE_FLAGS_MOCK is set (e.g. "1"). Lets the flag
// plumbing and the developer UI be built and QA'd before the Phase 3 backend
// (GET /features) exists. Remove the mock branch once the backend is live.
const MOCK_FLAGS: Record<string, boolean> = {
    reports_analytics: true,
    reports_generation: true,
    submission_tracker: true,
};

const isMockMode = (): boolean =>
    Boolean(import.meta.env.VITE_FEATURE_FLAGS_MOCK);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
    const [flags, setFlags] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            if (isMockMode()) {
                // Serve the static map with a small delay so loading states are visible.
                await new Promise((resolve) => window.setTimeout(resolve, 400));
                if (import.meta.env.DEV) {
                    console.info("[featureFlags] mock mode — serving VITE_FEATURE_FLAGS_MOCK map");
                }
                setFlags({ ...MOCK_FLAGS });
                return;
            }

            // A flags outage must be silent (no error toast) and fail open.
            const response = await getAPICall<Record<string, boolean>>("/features", {
                toast: false,
                skipErrorToast: true,
            });
            setFlags(response.data ?? {});
        } catch {
            // Keep the previous/empty map; isEnabled() fails open.
            setFlags((prev) => prev);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Deferred like userContext.tsx does, so the synchronous setLoading
        // inside refetch doesn't cascade renders from within the effect.
        const timer = window.setTimeout(() => {
            void refetch();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [refetch]);

    const setFlag = useCallback((key: string, enabled: boolean) => {
        // Optimistic update; the caller (developer UI) PATCHes and calls
        // refetch() to confirm or roll back on failure.
        setFlags((prev) => ({ ...prev, [key]: enabled }));
    }, []);

    const isEnabled = useCallback(
        (key: string) => {
            // Fail-open: unknown key or empty map (loading/failed fetch) → enabled.
            const value = flags[key];
            return value === undefined ? true : value;
        },
        [flags],
    );

    const value = useMemo<FeatureFlagContextValue>(
        () => ({ flags, loading, isEnabled, setFlag, refetch }),
        [flags, loading, isEnabled, setFlag, refetch],
    );

    return (
        <FeatureFlagContext.Provider value={value}>
            {children}
        </FeatureFlagContext.Provider>
    );
}
