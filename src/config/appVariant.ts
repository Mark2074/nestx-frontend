import { CAPABILITIES_BY_VARIANT, type AppCapabilities } from "./capabilities";

export type AppVariant = "web" | "store" | "full";

export type AppModuleKey = "core" | "social" | "live" | "economy";

export type AppVariantConfig = {
  variant: AppVariant;
  modules: Record<AppModuleKey, boolean>;
  capabilities: AppCapabilities;
};

const KNOWN_APP_VARIANTS = new Set<AppVariant>(["web", "store", "full"]);

const MODULES_BY_VARIANT: Record<AppVariant, Record<AppModuleKey, boolean>> = {
  web: {
    core: true,
    social: true,
    live: true,
    economy: true,
  },
  store: {
    core: true,
    social: true,
    live: false,
    economy: false,
  },
  full: {
    core: true,
    social: true,
    live: true,
    economy: true,
  },
};

export function getAppVariant(): AppVariant {
  const raw = String(
    import.meta.env.VITE_APP_VARIANT ||
      import.meta.env.VITE_NESTX_APP_VARIANT ||
      "web"
  )
    .trim()
    .toLowerCase();

  return KNOWN_APP_VARIANTS.has(raw as AppVariant) ? (raw as AppVariant) : "web";
}

export function getAppVariantConfig(): AppVariantConfig {
  const variant = getAppVariant();
  return {
    variant,
    modules: MODULES_BY_VARIANT[variant],
    capabilities: CAPABILITIES_BY_VARIANT[variant],
  };
}

export function isAppModuleEnabled(moduleKey: AppModuleKey): boolean {
  return getAppVariantConfig().modules[moduleKey] === true;
}

export function shouldExcludeHotContent(): boolean {
  return getAppVariant() === "store";
}
