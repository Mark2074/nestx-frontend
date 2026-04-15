import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ProfileLeftPage from "./ProfileLeftPage.tsx";
import ProfileRightPage from "./ProfileRightPage.tsx";
import LiveRightPanel from "./LiveRightPanel.tsx";
import AdminDictionaryDrawer from "./admin/AdminDictionaryDrawer";

export default function ProfileLayoutPage() {

  const loc = useLocation();
  const rightKey = `${loc.pathname}${loc.search}`;

  const isLiveRoom = useMemo(() => {
    const p = String(loc.pathname || "");
    // match: /app/live/:id/room
    return /^\/app\/live\/[^/]+\/room\/?$/.test(p);
  }, [loc.pathname]);

  const block = (() => {
    try { return localStorage.getItem("auth_block"); } catch { return null; }
  })();

  const [dictOpen, setDictOpen] = useState(false);
  const [dictPrefill, setDictPrefill] = useState<string | undefined>(undefined);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDictOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      const text = e?.detail?.text;
      if (typeof text === "string" && text.trim()) {
        setDictPrefill(text.trim());
        setDictOpen(true);
      }
    };
    window.addEventListener("dictionary:add", handler as any);
    return () => window.removeEventListener("dictionary:add", handler as any);
  }, []);

  if (block === "ACCOUNT_BANNED") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 720, width: "100%", border: "1px solid rgba(239,68,68,0.30)", background: "rgba(239,68,68,0.10)", borderRadius: 16, padding: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Account blocked by administration.</div>
          <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 700 }}>You can still logout and sign in with a different account.</div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("token");
                  localStorage.removeItem("auth_block");
                  localStorage.removeItem("auth_block_until");
                  localStorage.removeItem("auth_block_reason");
                } catch {}
                window.location.href = "/";
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

  if (block === "ACCOUNT_SUSPENDED") {
    let untilLabel = "";
    let reason = "";
    try {
      const untilRaw = localStorage.getItem("auth_block_until");
      const r = localStorage.getItem("auth_block_reason");
      reason = (r || "").trim();
      if (untilRaw) untilLabel = new Date(untilRaw).toLocaleString();
    } catch {}

    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 720, width: "100%", border: "1px solid rgba(239,68,68,0.30)", background: "rgba(239,68,68,0.10)", borderRadius: 16, padding: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            Account suspended{untilLabel ? ` (until ${untilLabel})` : ""}
          </div>
          {reason ? <div style={{ marginTop: 8, fontWeight: 800 }}>Reason: {reason}</div> : null}

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem("token");
                } catch {}
                window.location.href = "/";
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

  // normale layout
  return (
    <div
      onContextMenu={(e) => {
        try {
          const selected = window.getSelection?.()?.toString().trim() || "";
          if (selected.length >= 2) {
            e.preventDefault();

            // TODO: qui aggancia la tua logica dizionario ESISTENTE
            // 1) se già usi localStorage per aprire modal: setta la key e dispatcha event
            // 2) oppure chiama una funzione globale se esiste
            try {
              localStorage.setItem("dictionary_draft", selected);
              window.dispatchEvent(new CustomEvent("dictionary:add", { detail: { text: selected } }));
            } catch {}
          }
        } catch {}
      }}
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "260px minmax(0, 1fr) 340px",
        gap: 16,
        padding: 16,
        boxSizing: "border-box",
        alignItems: "start",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 16,
          alignSelf: "start",
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          paddingBottom: 12,
        }}
      >
        <ProfileLeftPage />
      </div>

      <div style={{ minWidth: 0 }}>
        <Outlet />
      </div>

      <div
        style={{
          position: "sticky",
          top: 16,
          alignSelf: "start",
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          paddingBottom: 12,
        }}
      >
        {isLiveRoom ? (
          <LiveRightPanel />
        ) : (
          <ProfileRightPage key={rightKey} />
        )}
      </div>
      <AdminDictionaryDrawer
        open={dictOpen}
        onClose={() => setDictOpen(false)}
        initialQuery={dictPrefill}
      />
    </div>
  );
}

