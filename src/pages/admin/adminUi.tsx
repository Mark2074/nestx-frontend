import React from "react";
export const adminShell: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "grid",
  gridTemplateColumns: "260px minmax(0, 1fr)",
  gap: 16,
  padding: 16,
  boxSizing: "border-box",
  alignItems: "start",
};

export const panel: React.CSSProperties = {
  borderRadius: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
};

export function featureFlag(name: "ECONOMY" | "LIVE") {
  const env =
    name === "ECONOMY"
      ? import.meta.env.VITE_ECONOMY_ENABLED
      : import.meta.env.VITE_LIVE_ENABLED;

  return String(env).toLowerCase() === "true";
}

export function DisabledBadge() {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 950,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "rgba(255,255,255,0.85)",
      }}
    >
      Disabled in Phase 1A
    </span>
  );
}
