import { useEffect, useMemo, useState } from "react";
import { panel } from "./adminUi";
import { adminGetGrowthSummary, type AdminGrowthSummary } from "../../api/nestxApi";
import { useNavigate } from "react-router-dom";

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function AdminNewGrowthPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AdminGrowthSummary | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await adminGetGrowthSummary();
      setData(r || null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load growth summary.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const latest = useMemo(() => data?.users?.latest || [], [data]);

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>New / Growth</div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            Lightweight admin growth stats (Phase 1B).
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

      {!data && !loading && !err && (
        <div style={{ marginTop: 14, opacity: 0.8, fontWeight: 900 }}>No data.</div>
      )}

      {data && (
        <>
          {/* TOP METRICS */}
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <div style={{ fontWeight: 950, opacity: 0.85 }}>Users</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 950 }}>{data.users.total}</div>
              <div style={{ marginTop: 6, opacity: 0.85 }}>New (7d): <b>{data.users.new7d}</b></div>
            </div>

            <div style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <div style={{ fontWeight: 950, opacity: 0.85 }}>Activation (7d)</div>
              <div style={{ marginTop: 10, opacity: 0.9 }}>Email verified: <b>{data.activation.emailVerified7d}</b></div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>Adult consent: <b>{data.activation.adultConsent7d}</b></div>
            </div>

            <div style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <div style={{ fontWeight: 950, opacity: 0.85 }}>Creators</div>
              <div style={{ marginTop: 10, opacity: 0.9 }}>Total creators: <b>{data.creators.total}</b></div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>Requested (pending): <b>{data.creators.requestedPendingApproval}</b></div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>Eligible: <b>{data.creators.eligible}</b></div>
            </div>
          </div>

          {/* LATEST USERS */}
          <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Latest 20 users</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {latest.map((u) => (
                <button
                  key={u._id}
                  onClick={() => nav(`/app/profile/${u._id}`)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.92)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                  title="Open profile"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <span>{u.displayName}</span>
                    <span style={{ opacity: 0.75, fontWeight: 800 }}>
                      {u.accountType} • {fmtDate(u.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Window: 7 days since {fmtDate(data.meta.since7d)}.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
