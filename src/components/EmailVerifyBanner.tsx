import { useEffect, useMemo, useState } from "react";
import { api } from "../api/nestxApi";
import type { MeProfile } from "../api/nestxApi";

export default function EmailVerifyBanner({ me }: { me: MeProfile | null }) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  // debounce anti spam: 15s
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  useEffect(() => {
    setInfo("");
  }, [me?._id]);

  if (!me) return null;

  // ✅ Deterministic gate: NEVER show this banner during /auth?mode=register
  const isAuthPath = window.location.pathname.startsWith("/auth");
  const authMode = useMemo(() => new URLSearchParams(window.location.search).get("mode"), []);
  if (isAuthPath && authMode === "register") return null;

  const isEmailVerified = Boolean((me as any).emailVerifiedAt);

  if (isEmailVerified) return null;

  const now = Date.now();
  const inCooldown = now < cooldownUntil;

  async function onResend() {
    if (busy || inCooldown) return;

    setBusy(true);
    setInfo("");
    try {
      await api.verifyEmailRequest();
      setInfo("Verification email sent.");
      setCooldownUntil(Date.now() + 15000);
    } catch {
      setInfo("Unable to send email right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
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
        Email not verified{" "}
        <span style={{ fontWeight: 600, opacity: 0.8 }}>
          (you can still use NestX)
        </span>
        {info ? <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 800 }}>{info}</div> : null}
      </div>

      <button
        onClick={onResend}
        disabled={busy || inCooldown}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          fontWeight: 900,
          cursor: busy || inCooldown ? "not-allowed" : "pointer",
          opacity: busy || inCooldown ? 0.75 : 1,
          background: "transparent",
          color: "white",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        {inCooldown ? "Wait..." : busy ? "Sending..." : "Resend email"}
      </button>
    </div>
  );
}
