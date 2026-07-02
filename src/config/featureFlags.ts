export type FeatureFlagName = "ECONOMY" | "LIVE";

export function featureFlag(name: FeatureFlagName) {
  const env =
    name === "ECONOMY"
      ? import.meta.env.VITE_ECONOMY_ENABLED
      : import.meta.env.VITE_LIVE_ENABLED;

  return String(env).toLowerCase() === "true";
}
