import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/nestxApi";
import { panel } from "./adminUi";

type BugStatus = "open" | "closed" | "all";
type SortMode = "new" | "old";

function truncate(s: string, n: number) {
  const x = String(s || "");
  return x.length > n ? x.slice(0, n - 1) + "…" : x;
}

export default function AdminBugReportsPage() {
  const [status, setStatus] = useState<BugStatus>("open");
  const [sort, setSort] = useState<SortMode>("new");

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    const s = status === "all" ? "All" : status === "closed" ? "Closed" : "Open";
    return `Bug reports — ${s}`;
  }, [status]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.adminBugReportsList({ status, sort, limit: 200, skip: 0 });
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sort]);

  async function toggle(it: any) {
    const next = it?.status === "closed" ? "open" : "closed";
    try {
      await api.adminBugReportPatch(String(it?._id), { status: next });
      await load();
    } catch {}
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 950 }}>{title}</div>
        <div style={{ marginTop: 6, opacity: 0.85 }}>Minimal list + status toggle.</div>
      </div>

      <div style={{ ...panel, padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Status</div>
          <select value={status} onChange={(e) => setStatus(e.target.value as BugStatus)} style={{ padding: "8px 10px", borderRadius: 10 }}>
            <option value="open">open</option>
            <option value="closed">closed</option>
            <option value="all">all</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Sort</div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} style={{ padding: "8px 10px", borderRadius: 10 }}>
            <option value="new">new</option>
            <option value="old">old</option>
          </select>
        </div>

        <button
          onClick={load}
          style={{ marginLeft: "auto", padding: "8px 10px", borderRadius: 10, border: "none", fontWeight: 900, cursor: "pointer" }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div style={{ ...panel, padding: 14 }}>
        {loading ? (
          <div style={{ opacity: 0.85 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.85 }}>No bug reports.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((it) => (
              <div
                key={String(it?._id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ fontWeight: 950 }}>
                    {String(it?.category || "—")}
                    <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>
                      {it?.createdAt ? new Date(it.createdAt).toLocaleString() : ""}
                    </span>
                  </div>

                  <button
                    onClick={() => toggle(it)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "none",
                      fontWeight: 900,
                      cursor: "pointer",
                      opacity: 0.95,
                    }}
                    title="Toggle open/closed"
                  >
                    {it?.status === "closed" ? "Reopen" : "Close"}
                  </button>
                </div>

                <div style={{ marginTop: 6, opacity: 0.92 }}>{truncate(String(it?.text || ""), 180)}</div>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {it?.route ? <span>route: {truncate(String(it.route), 80)}</span> : null}
                  <span>status: {String(it?.status || "—")}</span>
                  {it?.userId?.username ? <span>user: @{it.userId.username}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}