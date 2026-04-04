import { useEffect, useMemo, useState } from "react";
import {
  adminApproveCreator,
  adminGetCreatorPending,
  adminRejectCreator,
  type AdminCreatorPendingItem,
} from "../../api/nestxApi";

function fmt(dt?: string) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AdminCreatorApprovalPage() {
  const [items, setItems] = useState<AdminCreatorPendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const count = useMemo(() => items.length, [items]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await adminGetCreatorPending();
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

  async function approve(userId: string) {
    setBusyId(userId);
    setErr(null);
    try {
      const note = noteOpenId === userId ? adminNote.trim() : "";
      await adminApproveCreator(userId, note ? note : null);
      setNoteOpenId(null);
      setAdminNote("");
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Approve failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(userId: string) {
    setBusyId(userId);
    setErr(null);
    try {
      const note = noteOpenId === userId ? adminNote.trim() : "";
      await adminRejectCreator(userId, note ? note : null);
      setNoteOpenId(null);
      setAdminNote("");
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

  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
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
          <h1 style={{ margin: 0, fontSize: 22 }}>Creator approval</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>Pending requests: {count}</div>
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
        {items.map((u) => {
          const id = String(u?._id || "");
          const disabled = busyId === id;

          return (
            <div key={id} style={cardStyle}>
              <div style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u?.displayName || "—"}
                  </div>
                  <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u?.email || "—"} • <span style={{ opacity: 0.8 }}>id:</span> {id}
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                    submitted: {fmt(u?.creatorVerification?.submittedAt)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    style={btn}
                    onClick={() => {
                      setAdminNote("");
                      setNoteOpenId(noteOpenId === id ? null : id);
                    }}
                  >
                    Admin note
                  </button>

                  <button style={btnOk} disabled={disabled} onClick={() => approve(id)}>
                    {disabled ? "..." : "Approve"}
                  </button>

                  <button style={btnDanger} disabled={disabled} onClick={() => reject(id)}>
                    {disabled ? "..." : "Reject"}
                  </button>
                </div>
              </div>

              {noteOpenId === id ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6, opacity: 0.9 }}>Internal admin note (not visible to user)</div>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    placeholder="Optional internal note..."
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
                </div>
              ) : null}
            </div>
          );
        })}

        {!loading && items.length === 0 ? (
          <div style={{ ...cardStyle, opacity: 0.85 }}>
            No pending creator requests.
          </div>
        ) : null}
      </div>
    </div>
  );
}