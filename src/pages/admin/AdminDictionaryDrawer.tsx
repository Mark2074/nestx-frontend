import { useEffect, useMemo, useState } from "react";

export default function AdminDictionaryDrawer({
  open,
  onClose,
  initialQuery,
}: {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const [q, setQ] = useState("");
    useEffect(() => {
    if (open && typeof initialQuery === "string") {
      const v = initialQuery.trim();
      if (v) setQ(v);
    }
  }, [open, initialQuery]);

  function copyInitial() {
    const text = (initialQuery || "").trim();
    if (!text) return;

    try {
      navigator.clipboard.writeText(text);
    } catch {
      // fallback vecchio browser
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }
  
  const items = useMemo(() => {
    const base = [
      { key: "trust:attention", enabled: true },
      { key: "trust:critical", enabled: true },
      { key: "trust:block", enabled: false },
    ];
    const qq = q.trim().toLowerCase();
    if (!qq) return base;
    return base.filter((x) => x.key.includes(qq));
  }, [q]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "92vw",
          height: "100%",
          padding: 16,
          background: "rgba(16,16,16,0.98)",
          borderLeft: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>AI Dictionary</div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={copyInitial}
              disabled={!initialQuery}
              style={{
                border: "none",
                background: initialQuery ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                color: initialQuery ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.40)",
                cursor: initialQuery ? "pointer" : "not-allowed",
                padding: "8px 10px",
                borderRadius: 10,
                fontWeight: 900,
              }}
              title={initialQuery ? "Copy selected text" : "No text to copy"}
            >
              Copy
            </button>

            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.92)",
                cursor: "pointer",
                padding: "8px 10px",
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search key…"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.92)",
              outline: "none",
              fontWeight: 700,
            }}
          />
        </div>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((x) => (
            <div
              key={x.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontWeight: 900 }}>{x.key}</div>
              <button
                onClick={() => {}}
                style={{
                  border: "none",
                  cursor: "not-allowed",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontWeight: 900,
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.60)",
                  opacity: 0.85,
                }}
                title="Under construction"
              >
                {x.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          ))}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Placeholder tool (Phase 1A). No navigation.
          </div>
        </div>
      </div>
    </div>
  );
}
