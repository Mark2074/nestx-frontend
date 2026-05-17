export type AppVariant = "web" | "store" | "full";

const KNOWN_APP_VARIANTS = new Set<AppVariant>(["web", "store", "full"]);

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

export function shouldExcludeHotContent(): boolean {
  return getAppVariant() === "store";
}
