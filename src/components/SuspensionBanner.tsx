import { useEffect, useMemo, useState } from "react";
import type { MeProfile } from "../api/nestxApi";

export default function SuspensionBanner({ me }: { me: MeProfile | null }) {
  const [infoState, setInfoState] = useState<{ userId: string | null; message: string }>({
    userId: null,
    message: "",
  });
  const [nowMs, setNowMs] = useState<number | null>(null);
  const authMode = useMemo(() => new URLSearchParams(window.location.search).get("mode"), []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  if (!me) return null;

  // NEVER show this banner during /auth (login/register)
  const isAuthPath = window.location.pathname.startsWith("/auth");
  if (isAuthPath && authMode === "register") return null;
  if (isAuthPath && authMode === "login") return null;
  if (isAuthPath) return null;

  const isSuspended = Boolean((me as any).isSuspended);

  const untilRaw = (me as any).suspendedUntil || null;
  const untilMs = untilRaw ? new Date(untilRaw).getTime() : 0;

  // If no valid until, don't gate (avoid soft-lock by malformed data)
  if (!isSuspended || !untilMs) return null;
  if (nowMs == null) return null;

  const stillActive = nowMs < untilMs;
  if (!stillActive) return null;

  const reason = ((me as any).suspendReason || "").trim() || null;
  const info = infoState.userId === me._id ? infoState.message : "";

  const untilLabel = new Date(untilMs).toLocaleString();

  return (
    <div
      style={{
        border: "1px solid rgba(239,68,68,0.30)",
        background: "rgba(239,68,68,0.10)",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontWeight: 900 }}>
        Account suspended{" "}
        <span style={{ fontWeight: 700, opacity: 0.85 }}>
          (until {untilLabel})
        </span>

        {reason ? (
          <div style={{ marginTop: 6, opacity: 0.95, fontWeight: 800 }}>
            Reason: {reason}
          </div>
        ) : null}

        {info ? (
          <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 800 }}>
            {info}
          </div>
        ) : null}
      </div>

      <button
        onClick={() => {
          try {
            // force re-login experience (client-side)
            localStorage.removeItem("token");
          } catch (err) {
            console.warn("Unable to clear auth token before login redirect.", err);
          }
          setInfoState({ userId: me._id, message: "Please sign in again." });
          window.location.href = "/auth?mode=login";
        }}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          fontWeight: 900,
          cursor: "pointer",
          background: "transparent",
          color: "white",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        Go to login
      </button>
    </div>
  );
}

