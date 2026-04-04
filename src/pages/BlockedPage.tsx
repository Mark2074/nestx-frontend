import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export default function BlockedPage() {
  const nav = useNavigate();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mode = (params.get("mode") || "blocked").toLowerCase();
  const until = params.get("until");
  const reason = params.get("reason");

  const title =
    mode === "banned" ? "Account banned" :
    mode === "suspended" ? "Account suspended" :
    mode === "email" ? "Access restricted" :
    mode === "adult" ? "Access restricted" :
    "Access restricted";

  const subtitle =
    mode === "banned" ? "Your account has been restricted by administration." :
    mode === "suspended" ? "Your account is temporarily suspended." :
    mode === "email" ? "You cannot access the platform right now." :
    mode === "adult" ? "You cannot access the platform right now." :
    "You cannot access the platform right now.";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
      <div style={{ maxWidth: 720, width: "100%", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 18, background: "rgba(255,255,255,0.03)" }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{title}</div>
        <div style={{ opacity: 0.9, lineHeight: 1.55 }}>{subtitle}</div>

        {mode === "suspended" && until ? (
          <div style={{ marginTop: 10, fontWeight: 800, opacity: 0.95 }}>
            Until: {new Date(until).toLocaleString()}
          </div>
        ) : null}

        {mode === "suspended" && reason ? (
          <div style={{ marginTop: 6, fontWeight: 800, opacity: 0.95 }}>
            Reason: {reason}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("token");
                localStorage.removeItem("accountType");
                localStorage.removeItem("username");
                localStorage.removeItem("avatar");
              } catch {}
              nav("/auth?mode=login", { replace: true });
            }}
            style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}
          >
            Go to login
          </button>
        </div>
      </div>
    </div>
  );
}
