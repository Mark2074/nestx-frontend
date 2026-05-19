import type { AppVariant } from "./appVariant";

export type AppCapabilityKey =
  | "content.hot.visible"
  | "adv.hot.visible"
  | "events.create"
  | "live.enabled"
  | "economy.enabled"
  | "discover.hot.filter";

export type AppCapabilities = Record<AppCapabilityKey, boolean>;

export const CAPABILITIES_BY_VARIANT: Record<AppVariant, AppCapabilities> = {
  web: {
    "content.hot.visible": true,
    "adv.hot.visible": true,
    "events.create": true,
    "live.enabled": true,
    "economy.enabled": true,
    "discover.hot.filter": true,
  },
  store: {
    "content.hot.visible": false,
    "adv.hot.visible": false,
    "events.create": false,
    "live.enabled": false,
    "economy.enabled": false,
    "discover.hot.filter": false,
  },
  full: {
    "content.hot.visible": true,
    "adv.hot.visible": true,
    "events.create": true,
    "live.enabled": true,
    "economy.enabled": true,
    "discover.hot.filter": true,
  },
};
