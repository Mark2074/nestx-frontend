import { useEffect, useState } from "react";
import { api } from "../../api/nestxApi";

type SecurityLogItem = {
  _id: string;
  createdAt: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  admin: { _id: string; displayName: string } | null;
  meta: any;
};

export default function AdminSecurityLogPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<SecurityLogItem[]>([]);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const res: any = await api.adminSecurityLogList({ limit: 100 });

      // unwrap super-robusto (copre: array, {status,data}, {data:{status,data}}, {data:[...]})
      let payload: any = res;

      if (Array.isArray(res)) {
        payload = { status: "success", data: res };
      } else if (res?.data && Array.isArray(res.data)) {
        // caso: request() ti torna { data: [...] }
        payload = { status: "success", data: res.data };
      } else if (res?.data?.status && Array.isArray(res.data.data)) {
        // caso: request() ti torna { data: { status, data } }
        payload = res.data;
      }

      if (!payload || payload.status !== "success" || !Array.isArray(payload.data)) {
        setItems([]);
        setErr(payload?.message || res?.message || "Failed to load security log");
        return;
      }

      const normalized: SecurityLogItem[] = payload.data.map((x: any) => ({
        _id: String(x?._id),
        createdAt: String(x?.createdAt || ""),
        actionType: String(x?.actionType || ""),
        targetType: String(x?.targetType || ""),
        targetId: x?.targetId ?? null,
        admin: x?.admin
          ? {
              _id: String(x.admin._id),
              displayName: String(x.admin.displayName || "Admin"),
            }
          : null,
        meta: x?.meta ?? null,
      }));

      setItems(normalized);
    } catch (e: any) {
      console.error("security log load error:", e);
      setErr(e?.message || "Failed to load security log");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Security Log</div>

      <div style={{ opacity: 0.8, marginBottom: 14 }}>
        Minimal admin audit trail (Phase 1B).
      </div>

      <button
        onClick={load}
        style={{
          padding: "8px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.92)",
          cursor: "pointer",
          fontWeight: 900,
          marginBottom: 14,
        }}
      >
        Refresh
      </button>

      {loading ? (
        <div style={{ opacity: 0.8 }}>Loading…</div>
      ) : err ? (
        <div style={{ color: "#ff6b6b", fontWeight: 900 }}>{err}</div>
      ) : !items.length ? (
        <div style={{ opacity: 0.8 }}>No security log entries.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((x) => (
            <div
              key={x._id}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                padding: 12,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>
                  {x.actionType}
                  <span style={{ opacity: 0.75, fontWeight: 700, marginLeft: 10, fontSize: 12 }}>
                    {x.admin?.displayName || "system"}
                  </span>
                </div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>
                  {x.createdAt ? new Date(x.createdAt).toLocaleString() : ""}
                </div>
              </div>

              <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>
                target: <b>{x.targetType}</b> {x.targetId ? `• ${x.targetId}` : ""}
              </div>

              {x.meta ? (
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
                  {"decision" in x.meta && x.meta?.decision ? (
                    <div>
                      <b>Decision:</b> {String(x.meta.decision)}
                    </div>
                  ) : null}

                  {"reason" in x.meta && x.meta?.reason ? (
                    <div>
                      <b>Reason:</b> {String(x.meta.reason)}
                    </div>
                  ) : null}

                  {"action" in x.meta && x.meta?.action ? (
                    <div>
                      <b>Action:</b> {String(x.meta.action)}
                    </div>
                  ) : null}

                  {"newStatus" in x.meta && x.meta?.newStatus ? (
                    <div>
                      <b>Status:</b> {String(x.meta.newStatus)}
                    </div>
                  ) : null}

                  {"severity" in x.meta && x.meta?.severity ? (
                    <div>
                      <b>Severity:</b> {String(x.meta.severity)}
                    </div>
                  ) : null}

                  {"category" in x.meta && x.meta?.category ? (
                    <div>
                      <b>Category:</b> {String(x.meta.category)}
                    </div>
                  ) : null}

                  {"adminNote" in x.meta && x.meta?.adminNote ? (
                    <div>
                      <b>Admin note:</b> {String(x.meta.adminNote)}
                    </div>
                  ) : null}

                  {"reportReason" in x.meta && x.meta?.reportReason ? (
                    <div>
                      <b>Report reason:</b> {String(x.meta.reportReason)}
                    </div>
                  ) : null}

                  {"reporterId" in x.meta && x.meta?.reporterId ? (
                    <div>
                      <b>Reporter:</b> {String(x.meta.reporterId)}
                    </div>
                  ) : null}

                  {x.meta?.before ? (
                    <div style={{ marginTop: 6 }}>
                      <b>Before:</b> {JSON.stringify(x.meta.before)}
                    </div>
                  ) : null}

                  {x.meta?.after ? (
                    <div>
                      <b>After:</b> {JSON.stringify(x.meta.after)}
                    </div>
                  ) : null}

                  {x.meta?.reportNote ? (
                    <div>
                      <b>Report note:</b> {String(x.meta.reportNote)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}