export {
  getAppVariant,
  getAppVariantConfig,
  isAppModuleEnabled,
  shouldExcludeHotContent,
} from "../config/appVariant";
export {
  hasCapability,
  isModuleEnabled,
  shouldBlockHotAdv,
  shouldBlockHotContent,
} from "../config/gates";
export type { AppCapabilityKey, AppCapabilities } from "../config/capabilities";
export type { AppModuleKey, AppVariant, AppVariantConfig } from "../config/appVariant";
