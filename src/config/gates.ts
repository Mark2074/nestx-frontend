import {
  getAppVariantConfig,
  type AppModuleKey,
  type AppVariantConfig,
} from "./appVariant";
import type { AppCapabilityKey } from "./capabilities";

export type AppGateContext = {
  config?: AppVariantConfig;
};

function resolveConfig(context?: AppGateContext): AppVariantConfig {
  return context?.config ?? getAppVariantConfig();
}

export function hasCapability(capability: AppCapabilityKey, context?: AppGateContext): boolean {
  return resolveConfig(context).capabilities[capability] === true;
}

export function isModuleEnabled(moduleKey: AppModuleKey, context?: AppGateContext): boolean {
  return resolveConfig(context).modules[moduleKey] === true;
}

export function shouldBlockHotContent(context?: AppGateContext): boolean {
  return !hasCapability("content.hot.visible", context);
}

export function shouldBlockHotAdv(context?: AppGateContext): boolean {
  return !hasCapability("adv.hot.visible", context);
}
