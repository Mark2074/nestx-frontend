export type FeatureFlagName = "ECONOMY" | "LIVE";

export type RuntimeFeatures = {
  liveEnabled: boolean;
  economyEnabled: boolean;
};

export const DEFAULT_RUNTIME_FEATURES: RuntimeFeatures = {
  liveEnabled: false,
  economyEnabled: false,
};

export function normalizeRuntimeFeatures(payload: Partial<RuntimeFeatures> | null | undefined): RuntimeFeatures {
  return {
    liveEnabled: payload?.liveEnabled === true,
    economyEnabled: payload?.economyEnabled === true,
  };
}
