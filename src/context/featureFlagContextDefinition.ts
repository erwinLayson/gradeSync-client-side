import { createContext } from "react";

export interface FeatureFlagContextValue {
    /** Flag map from GET /features. Empty while loading or on fetch failure. */
    flags: Record<string, boolean>;
    /** True while the initial GET /features request is in flight. */
    loading: boolean;
    /**
     * Fail-open check: a missing key or a failed fetch returns true, so a
     * flags outage can never lock users out of working features.
     */
    isEnabled: (key: string) => boolean;
    /**
     * Optimistic toggle used by the developer UI. Applies immediately;
     * call refetch() to roll back if the PATCH fails.
     */
    setFlag: (key: string, enabled: boolean) => void;
    /** Re-fetch the flag map from the server (also the rollback path). */
    refetch: () => Promise<void>;
}

// Safe defaults: fail-open (every feature enabled) until real flags arrive.
export const FeatureFlagContext = createContext<FeatureFlagContextValue>({
    flags: {},
    loading: true,
    isEnabled: () => true,
    setFlag: () => undefined,
    refetch: async () => undefined,
});
