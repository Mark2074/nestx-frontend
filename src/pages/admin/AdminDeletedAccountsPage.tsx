import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/nestxApi";

type DeletedUserRow = {
  userId: string;
  displayName?: string;
  deletedAt?: string;
  daysLeft?: number;
  readyToPurge?: boolean;
};

function formatDate(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString();
}

export default function AdminDeletedAccountsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<DeletedUserRow[]>([]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      // BE: { status:"ok", users:[...] }
      const res: any = await api.adminDeletedUsersList();
      const list: any[] = Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
      const normalized: DeletedUserRow[] = list
        .map((x: any) => ({
          userId: String(x?.userId || x?._id || x?.id || ""),
          displayName: x?.displayName,
          deletedAt: x?.deletedAt,
          daysLeft: typeof x?.daysLeft === "number" ? x.daysLeft : undefined,
          readyToPurge: Boolean(x?.readyToPurge),
        }))
        .filter((x) => !!x.userId);

      setRows(normalized);
    } catch (e: any) {
      setErr(e?.message || "Failed to load deleted accounts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readyCount = useMemo(() => rows.filter((r) => r.readyToPurge).length, [rows]);

  return (
    <div style={{ padding: 22, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Deleted Accounts</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Queue of accounts scheduled for purge (30 days). Ready to purge: <b>{readyCount}</b>
          </div>
        </div>

        <button
          onClick={load}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 900,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,120,120,0.12)", border: "1px solid rgba(255,120,120,0.25)" }}>
          <b style={{ color: "rgba(255,160,160,1)" }}>{err}</b>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No deleted accounts.</div>
        ) : (
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              overflow: "hidden",
            }}
          >
            {/* header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 2.2fr 1fr 1fr 1fr",
                gap: 10,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.04)",
                fontWeight: 900,
              }}
            >
              <div>User</div>
              <div>Deleted at</div>
              <div style={{ textAlign: "center" }}>Days left</div>
              <div style={{ textAlign: "center" }}>Ready</div>
              <div style={{ textAlign: "right" }}>Action</div>
            </div>

            {/* rows */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {rows.map((r) => (
                <div
                  key={r.userId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.2fr 2.2fr 1fr 1fr 1fr",
                    gap: 10,
                    padding: "12px 14px",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.displayName || "User"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.userId}
                    </div>
                  </div>

                  <div style={{ opacity: 0.85 }}>{formatDate(r.deletedAt)}</div>

                  <div style={{ textAlign: "center", fontWeight: 900 }}>
                    {typeof r.daysLeft === "number" ? r.daysLeft : "-"}
                  </div>

                  <div style={{ textAlign: "center" }}>
                    {r.readyToPurge ? (
                      <span style={{ fontWeight: 900, color: "rgba(140,255,170,1)" }}>YES</span>
                    ) : (
                      <span style={{ opacity: 0.65 }}>NO</span>
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <button
                      disabled={!r.readyToPurge}
                      onClick={() => window.alert("Purge endpoint not wired yet. (We add it next)")}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        fontWeight: 900,
                        border: "1px solid rgba(255,120,120,0.35)",
                        background: r.readyToPurge ? "rgba(255,120,120,0.16)" : "rgba(255,255,255,0.05)",
                        color: "white",
                        cursor: r.readyToPurge ? "pointer" : "not-allowed",
                        opacity: r.readyToPurge ? 1 : 0.55,
                      }}
                    >
                      Purge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}