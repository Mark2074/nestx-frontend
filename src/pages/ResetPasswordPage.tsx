import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/nestxApi";

const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");

  function validate(): string {
    if (!token) return "Missing token.";
    if (!p1) return "New password is required";
    if (p1.length < 8) return "Password must be at least 8 characters";
    if (p1 !== p2) return "Passwords do not match";
    return "";
  }

  async function onSubmit() {
    setErr("");
    setInfo("");

    const v = validate();
    if (v) return setErr(v);

    setBusy(true);
    try {
      await api.resetPassword(token, p1);
      setInfo("Password updated. Redirecting to login...");
      setTimeout(() => nav("/auth?mode=login"), 900);
    } catch (e: any) {
      // token invalido/scaduto -> backend message
      setErr(e?.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "stretch" }}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 12 }}>
          <img src={LOGO_SRC} alt="NestX" style={{ height: 44, width: "auto" }} />
          <div style={{ fontWeight: 900, fontSize: 18, textAlign: "center" }}>Choose a new password</div>
        </div>

        <div style={{ marginTop: 18, ...panelStyle }}>
          {err ? <div style={errBoxStyle}>{err}</div> : null}
          {info ? <div style={okBoxStyle}>{info}</div> : null}

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              placeholder="New password"
              type="password"
              style={inputStyle}
              autoComplete="new-password"
            />
            <input
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              placeholder="Confirm new password"
              type="password"
              style={inputStyle}
              autoComplete="new-password"
            />

            <button onClick={onSubmit} disabled={busy} style={primaryBtnStyle(busy)}>
              {busy ? "Updating..." : "Update password"}
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
