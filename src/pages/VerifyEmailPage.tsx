import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/nestxApi";

const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

export default function VerifyEmailPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";

  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    async function run() {
      setErr("");
      setInfo("");
      if (!token) {
        setErr("Missing token.");
        return;
      }
      setBusy(true);
      try {
        await api.verifyEmailConfirm(token);
        setInfo("Email verified. Redirecting to login...");
        setTimeout(() => nav("/auth?mode=login"), 900);
      } catch (e: any) {
        setErr(e?.message || "Verification failed");
      } finally {
        setBusy(false);
      }
    }
    run();
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "stretch" }}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 12 }}>
          <img src={LOGO_SRC} alt="NestX" style={{ height: 44, width: "auto" }} />
          <div style={{ fontWeight: 900, fontSize: 18, textAlign: "center" }}>Verifying your email</div>
        </div>

        <div style={{ marginTop: 18, ...panelStyle }}>
          {err ? <div style={errBoxStyle}>{err}</div> : null}
          {info ? <div style={okBoxStyle}>{info}</div> : null}

          <button type="button" onClick={() => nav("/auth?mode=login")} style={linkBtnStyle} disabled={busy}>
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}

const panelStyle = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,255,255,0.03)",
} as const;

const linkBtnStyle = {
  marginTop: 6,
  border: "none",
  background: "transparent",
  color: "white",
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  fontWeight: 800,
  justifySelf: "start",
} as const;

const errBoxStyle = {
  border: "1px solid rgba(255,120,120,0.35)",
  background: "rgba(255,120,120,0.12)",
  borderRadius: 14,
  padding: 12,
  fontWeight: 800,
  marginBottom: 10,
} as const;

const okBoxStyle = {
  border: "1px solid rgba(120,255,170,0.25)",
  background: "rgba(120,255,170,0.10)",
  borderRadius: 14,
  padding: 12,
  fontWeight: 800,
  marginBottom: 10,
} as const;
