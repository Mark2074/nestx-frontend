import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import ProfileLeftPage from "./ProfileLeftPage.tsx";
import ProfileRightPage from "./ProfileRightPage.tsx";
import LiveRightPanel from "./LiveRightPanel.tsx";
import AdminDictionaryDrawer from "./admin/AdminDictionaryDrawer";

function ObsSetupPanel({ eventId }: { eventId: string }) {
  const rtmpUrl = "rtmp://46.101.183.107:1935/app";
  const streamKey = eventId;

  const copy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(15,23,42,0.72)",
        padding: 14,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 16 }}>OBS setup</div>

      {/* STEP 1 */}
      <div style={obsStepStyle}>
        <div style={obsStepTitleStyle}>1. Download</div>
        <a
          href="https://obsproject.com/download"
          target="_blank"
          rel="noreferrer"
          style={obsButtonStyle}
        >
          Download OBS
        </a>
      </div>

      {/* STEP 2 */}
      <div style={obsStepStyle}>
        <div style={obsStepTitleStyle}>2. Stream setup</div>

        <div style={obsHintStyle}>Open OBS → Controls → Settings → Stream</div>

        <div style={obsRowStyle}>
          <div style={obsLabelStyle}>Server</div>
          <div style={obsValueStyle}>{rtmpUrl || "-"}</div>
          <button onClick={() => copy(rtmpUrl)} style={obsCopyBtn}>
            Copy
          </button>
        </div>
        <div style={obsHintStyle}>Paste into OBS Server</div>

        <div style={obsRowStyle}>
          <div style={obsLabelStyle}>Stream Key</div>
          <div style={obsValueStyle}>{streamKey || "-"}</div>
          <button onClick={() => copy(streamKey)} style={obsCopyBtn}>
            Copy
          </button>
        </div>
        <div style={obsHintStyle}>Paste into OBS Stream Key</div>

        <div style={obsHintStyle}>Click Apply → OK</div>
      </div>

      {/* STEP 3 */}
      <div style={obsStepStyle}>
        <div style={obsStepTitleStyle}>3. Camera</div>
        <div style={obsHintStyle}>Click ➕ (Sources)</div>
        <div style={obsHintStyle}>Video Capture Device</div>
        <div style={obsHintStyle}>Select camera & microphone</div>
      </div>

      {/* STEP 4 */}
      <div style={obsStepStyle}>
        <div style={obsStepTitleStyle}>4. Go live</div>
        <div style={obsHintStyle}>Start Streaming (OBS Controls)</div>
        <div style={obsHintStyle}>Go Live (NestX)</div>
      </div>
    </div>
  );
}

const obsStepStyle: React.CSSProperties = {
  borderRadius: 14,
  background: "rgba(255,255,255,0.055)",
  padding: 10,
  display: "grid",
  gap: 6,
};

const obsStepTitleStyle: React.CSSProperties = {
  fontWeight: 950,
  fontSize: 13,
};

const obsHintStyle: React.CSSProperties = {
  fontWeight: 750,
  fontSize: 12,
  opacity: 0.86,
  lineHeight: 1.25,
};

const obsButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 10px",
  borderRadius: 12,
  background: "rgba(59,130,246,0.95)",
  color: "white",
  fontWeight: 950,
  fontSize: 13,
  textDecoration: "none",
};

const obsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1fr 60px",
  alignItems: "center",
  gap: 6,
};

const obsLabelStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 12,
};

const obsValueStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.9,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const obsCopyBtn: React.CSSProperties = {
  borderRadius: 10,
  padding: "6px 8px",
  fontWeight: 900,
  fontSize: 11,
  cursor: "pointer",
};

export default function ProfileLayoutPage() {

  const loc = useLocation();
  const { id } = useParams();
  const eventId = String(id || "").trim();
  const rightKey = `${loc.pathname}${loc.search}`;

  const isLiveRoomRoute = useMemo(() => {
    const p = String(loc.pathname || "");
    return /^\/app\/live\/[^/]+\/room\/?$/.test(p);
  }, [loc.pathname]);

  const isHostConsoleRoute = useMemo(() => {
    const p = String(loc.pathname || "");
    return /^\/app\/live\/[^/]+\/host-console\/?$/.test(p);
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
        {isHostConsoleRoute ? (
          <ObsSetupPanel eventId={eventId} />
        ) : isLiveRoomRoute ? (
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

