import { useEffect, useMemo, useState } from "react";
import {
  adminApproveShowcase,
  adminGetShowcasePending,
  adminRejectShowcase,
  type AdminShowcasePendingItem,
} from "../../api/nestxApi";

function fmt(dt?: string) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function creatorLabel(x: any) {
  if (!x) return "—";
  const id = String(x?._id || x || "").trim();
  const name = String(x?.displayName || "").trim();
  return name ? `${name} • ${id}` : id || "—";
}

export default function AdminShowcaseApprovalPage() {
  const [items, setItems] = useState<AdminShowcasePendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectNoteById, setRejectNoteById] = useState<Record<string, string>>({});

  const count = useMemo(() => items.length, [items]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await adminGetShowcasePending();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(String(e?.message || "Load failed"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await adminApproveShowcase(id);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Approve failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const note = String(rejectNoteById[id] || "").trim();
    if (note.length < 10) return;

    setBusyId(id);
    setErr(null);
    try {
      await adminRejectShowcase(id, note);
      setRejectNoteById((p) => ({ ...p, [id]: "" }));
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Reject failed"));
    } finally {
      setBusyId(null);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const btn: React.CSSProperties = {
    border: "none",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.92)",
  };

  const btnDanger: React.CSSProperties = {
    ...btn,
    background: "rgba(255,70,70,0.18)",
  };

  const btnOk: React.CSSProperties = {
    ...btn,
    background: "rgba(120,255,120,0.14)",
  };

  return (
    <div style={{ padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Showcase approval</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>Pending items: {count}</div>
        </div>

        <button onClick={load} style={btn} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 12, ...cardStyle, borderColor: "rgba(255,80,80,0.25)" }}>
          <div style={{ fontWeight: 900 }}>Error</div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>{err}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => {
          const id = String(it?._id || "");
          const disabled = busyId === id;

          const billing = it?.billingType === "paid"
            ? `PAID • ${Number(it?.paidTokens || 0)} tokens`
            : "FREE";

          return (
            <div key={id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it?.title || "—"}
                  </div>

                  <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
                    {billing} • created: {fmt(it?.createdAt)}
                  </div>

                  <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
                    creator: {creatorLabel(it?.creatorId)}
                  </div>

                  {it?.text ? (
                    <div style={{ marginTop: 10, opacity: 0.92, lineHeight: 1.35 }}>
                      {it.text}
                    </div>
                  ) : null}

                  {it?.mediaUrl ? (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>

                        <div style={{ fontWeight: 900, opacity: 0.85 }}>Media</div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ opacity: 0.7, fontSize: 13, wordBreak: "break-all" }}>
                            {String(it.mediaUrl)}
                        </div>

                        <button
                            onClick={() => window.open(String(it.mediaUrl), "_blank", "noopener,noreferrer")}
                            style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.92)",
                            fontWeight: 800,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            }}
                        >
                            Open
                        </button>
                        </div>

                        {/* Preview */}
                        {/\.(png|jpg|jpeg|gif|webp|svg)(\?|#|$)/i.test(it.mediaUrl) ? (
                        <img
                            src={it.mediaUrl}
                            alt="showcase"
                            style={{
                            width: "100%",
                            height: 260,
                            objectFit: "contain",
                            background: "rgba(0,0,0,0.25)",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.10)",
                            }}
                        />
                        ) : /\.(mp4|webm|ogg)(\?|#|$)/i.test(it.mediaUrl) ? (
                        <video
                            src={it.mediaUrl}
                            controls
                            style={{
                            width: "100%",
                            height: 300,
                            background: "rgba(0,0,0,0.25)",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.10)",
                            }}
                        />
                        ) : null}

                    </div>
                    ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button style={btnOk} disabled={disabled} onClick={() => approve(id)}>
                    {disabled ? "..." : "Approve"}
                  </button>
                  <button
                    style={btnDanger}
                    disabled={disabled || String(rejectNoteById[id] || "").trim().length < 10}
                    onClick={() => reject(id)}
                    title="Reject requires adminNote (min 10 chars)"
                  >
                    {disabled ? "..." : "Reject"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6, opacity: 0.9 }}>Reject note (required, min 10 chars)</div>
                <textarea
                  value={rejectNoteById[id] || ""}
                  onChange={(e) => setRejectNoteById((p) => ({ ...p, [id]: e.target.value }))}
                  rows={3}
                  placeholder="Write the rejection reason (visible to creator)..."
                  style={{
                    width: "100%",
                    resize: "vertical",
                    borderRadius: 12,
                    padding: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.25)",
                    color: "rgba(255,255,255,0.90)",
                    outline: "none",
                  }}
                />
                <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                  {Math.max(0, 10 - String(rejectNoteById[id] || "").trim().length)} chars to enable Reject
                </div>
              </div>
            </div>
          );
        })}

        {!loading && items.length === 0 ? (
          <div style={{ ...cardStyle, opacity: 0.85 }}>
            No pending showcase items.
          </div>
        ) : null}
      </div>
    </div>
  );
}