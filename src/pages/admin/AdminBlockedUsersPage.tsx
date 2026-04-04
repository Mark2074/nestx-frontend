import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminGetBlockedUsers, adminUnbanUser, adminUnsuspendUser, type AdminBlockedUser } from "../../api/nestxApi";

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function getRowStatus(u: AdminBlockedUser) {
  const now = Date.now();
  const until = u.suspendedUntil ? new Date(u.suspendedUntil).getTime() : 0;
  const suspendedActive = !!u.isSuspended && (!!until ? now < until : true);

  if (u.isBanned) return "BANNED";
  if (suspendedActive) return "SUSPENDED";
  return u.isSuspended ? "SUSPENDED" : "—";
}

export default function AdminBlockedUsersPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminBlockedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await adminGetBlockedUsers();
      setUsers(r?.users || []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to load blocked users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => users, [users]);

  async function onUnblock(u: AdminBlockedUser) {
    if (!u?._id) return;
    setBusyId(u._id);
    setErr(null);
    try {
      if (u.isBanned) await adminUnbanUser(u._id);
      if (u.isSuspended) await adminUnsuspendUser(u._id);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Unblock failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900 }}>Blocked / Suspended</h2>
          <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>
            Admin quick control: list → profile → unblock.
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: loading ? "default" : "pointer",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,80,80,0.12)" }}>
          <b style={{ display: "block", marginBottom: 6 }}>Error</b>
          <div style={{ opacity: 0.92 }}>{err}</div>
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 && !loading && (
          <div style={{ opacity: 0.85, padding: 12 }}>No blocked users found.</div>
        )}

        {rows.map((u) => {
          const st = getRowStatus(u);
          const untilTxt = u.suspendedUntil ? fmtDate(u.suspendedUntil) : "";
          const busy = busyId === u._id;

          return (
            <div
              key={u._id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 220px",
                gap: 10,
                padding: 12,
                borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.displayName} <span style={{ opacity: 0.6, fontWeight: 700 }}>• {u._id}</span>
                </div>

                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, opacity: 0.92 }}>{st}</span>

                  {st === "SUSPENDED" && (
                    <span style={{ opacity: 0.9 }}>
                      {untilTxt ? `until ${untilTxt}` : "until (missing) — cleanup case"}
                    </span>
                  )}

                  {u.isBanned && u.banReason ? <span style={{ opacity: 0.85 }}>reason: {u.banReason}</span> : null}
                  {!u.isBanned && u.isSuspended && u.suspendReason ? <span style={{ opacity: 0.85 }}>reason: {u.suspendReason}</span> : null}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => nav(`/app/profile/${u._id}`)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.02)",
                    color: "rgba(255,255,255,0.92)",
                    textAlign: "left",
                    opacity: 0.92,
                  }}
                >
                  Open profile
                </button>

                <button
                  onClick={() => onUnblock(u)}
                  disabled={busy}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: busy ? "default" : "pointer",
                    border: "none",
                    background: busy ? "rgba(255,255,255,0.08)" : "rgba(120,255,180,0.18)",
                    color: "rgba(255,255,255,0.92)",
                    textAlign: "left",
                  }}
                >
                  {busy ? "Working..." : "Unblock"}
                </button>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Unblock clears ban and/or suspension.
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
