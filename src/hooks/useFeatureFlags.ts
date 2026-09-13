import { useContext } from "react";

import { FeatureFlagContext } from "../context/featureFlagContextDefinition";

export function useFeatureFlags() {
    const context = useContext(FeatureFlagContext);

    if (!context) {
        throw new Error("FeatureFlags Must be use inside the context provider");
    }

    return context;
}
