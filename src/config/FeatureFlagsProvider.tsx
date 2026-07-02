import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/nestxApi";
import {
  DEFAULT_RUNTIME_FEATURES,
  normalizeRuntimeFeatures,
  type FeatureFlagName,
  type RuntimeFeatures,
} from "./featureFlags";

type FeatureFlagsContextValue = RuntimeFeatures & {
  loaded: boolean;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  ...DEFAULT_RUNTIME_FEATURES,
  loaded: false,
});

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<RuntimeFeatures>(DEFAULT_RUNTIME_FEATURES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .getFeatures()
      .then((payload) => {
        if (!cancelled) setFeatures(normalizeRuntimeFeatures(payload));
      })
      .catch(() => {
        if (!cancelled) setFeatures(DEFAULT_RUNTIME_FEATURES);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      ...features,
      loaded,
    }),
    [features, loaded]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

export function useFeatureFlag(name: FeatureFlagName) {
  const features = useFeatureFlags();
  return name === "ECONOMY" ? features.economyEnabled : features.liveEnabled;
}

export function useEffectiveVipPrivileges(realIsVip: boolean | null | undefined) {
  const features = useFeatureFlags();
  if (!features.loaded) return realIsVip === true;
  return features.economyEnabled === false || realIsVip === true;
}
