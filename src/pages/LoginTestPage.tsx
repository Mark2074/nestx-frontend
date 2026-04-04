import { useState } from "react";
import { api } from "../api/nestxApi";
import { useNavigate } from "react-router-dom";

export default function LoginTestPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function doLogin() {
    setMsg("Logging in...");
    try {
      const res = await api.login(email, password);
      localStorage.setItem("token", res.token);
      setMsg("OK: token saved to localStorage.");
      nav("/profile");
    } catch (e: any) {
      setMsg(`Errore: ${e.message || "login failed"}`);
    }
  }

  return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: 22,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 10 }}>
          <img src="/legal/nestx-horizontal-dark.png" alt="NestX" style={{ height: 56, width: "auto", maxWidth: "85%" }} />
          <h1 style={{ margin: 0 }}>Login Test</h1>
          <p style={{ opacity: 0.75, margin: 0 }}>Dev only: saves token to localStorage.</p>
        </div>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "transparent", color: "white" }}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "transparent", color: "white" }}
        />
        <button onClick={doLogin} style={{ padding: 10, borderRadius: 8, fontWeight: 700 }}>
          Login
        </button>
        <div>{msg}</div>
      </div>
      </div>
    </div>
  );
}