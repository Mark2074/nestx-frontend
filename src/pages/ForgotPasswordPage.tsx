import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/nestxApi";

const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

export default function ForgotPasswordPage() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit() {
    setErr("");
    setInfo("");
    setBusy(true);

    try {
      if (!email.trim()) throw new Error("Email is required");

      await api.forgotPassword(email.trim());

      // ✅ neutro sempre
      setInfo("If the email is registered, you will receive a reset link.");
    } catch (e: any) {
      // ✅ non rivelare mai “email non esiste”
      setErr("Temporary error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "stretch" }}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 12 }}>
          <img src={LOGO_SRC} alt="NestX" style={{ height: 44, width: "auto" }} />
          <div style={{ fontWeight: 900, fontSize: 18, textAlign: "center" }}>Reset your password</div>
          <div style={{ opacity: 0.75, fontSize: 13, textAlign: "center" }}>
            Enter your email to receive a reset link.
          </div>
        </div>

        <div style={{ marginTop: 18, ...panelStyle }}>
          {err ? <div style={errBoxStyle}>{err}</div> : null}
          {info ? <div style={okBoxStyle}>{info}</div> : null}

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={inputStyle}
              autoComplete="email"
            />

            <button onClick={onSubmit} disabled={busy} style={primaryBtnStyle(busy)}>
              {busy ? "Sending..." : "Send reset link"}
            </button>

            <button type="button" onClick={() => nav("/auth?mode=login")} style={linkBtnStyle}>
              Back to login
            </button>
          </div>
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

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
} as const;

function primaryBtnStyle(disabled: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
  } as const;
}

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
