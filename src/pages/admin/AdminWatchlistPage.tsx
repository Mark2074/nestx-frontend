import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { panel } from "./adminUi";
import {
  adminGetBlockedUsers,
  adminUnbanUser,
  adminUnsuspendUser,
  type AdminBlockedUser,
  adminGetAgeGateLogs,
  type AdminAgeGateLog,
} from "../../api/nestxApi";

type TabKey = "accounts" | "agegate";

export default function AdminWatchlistPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("accounts");

  // shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accounts tab
  const [accounts, setAccounts] = useState<AdminBlockedUser[]>([]);

  // Age-gate tab
  const [logs, setLogs] = useState<AdminAgeGateLog[]>([]);
  const [q, setQ] = useState("");
  const [minAttempts, setMinAttempts] = useState(1);
  const limit = 50;

  const title = useMemo(() => {
    return tab === "accounts" ? "Watchlist — Accounts" : `Watchlist — Age-gate (${minAttempts}+ underage attempts)`;
  }, [tab]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "accounts") {
        const res = await adminGetBlockedUsers();
        setAccounts(res.users || []);
      } else {
        const res = await adminGetAgeGateLogs({
          q: q.trim() ? q.trim() : undefined,
          minAttempts,
          sort: "newest",
          limit,
        });
        setLogs(res.logs || []);
      }
    } catch (e: any) {
      setError(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onUnban = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      await adminUnbanUser(userId);
      await load();
    } catch (e: any) {
      setError(e?.message || "Unban failed");
      setLoading(false);
    }
  };

  const onUnsuspend = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      await adminUnsuspendUser(userId);
      await load();
    } catch (e: any) {
      setError(e?.message || "Unsuspend failed");
      setLoading(false);
    }
  };

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>Watchlist</div>
          <div style={{ marginTop: 6, opacity: 0.85 }}>{title}</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setTab("accounts")}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: tab === "accounts" ? "rgba(255,255,255,0.14)" : "transparent",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Accounts
          </button>
          <button
            onClick={() => setTab("agegate")}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: tab === "agegate" ? "rgba(255,255,255,0.14)" : "transparent",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Age-gate
          </button>

          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.10)",
              color: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 950,
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "rgba(255,0,0,0.12)", fontWeight: 800 }}>
          {error}
        </div>
      )}

      {tab === "agegate" && (
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search (user / ip)"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              color: "inherit",
              minWidth: 240,
              outline: "none",
              fontWeight: 800,
            }}
          />
          <select
            value={String(minAttempts)}
            onChange={(e) => setMinAttempts(Number(e.target.value))}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              color: "inherit",
              outline: "none",
              fontWeight: 900,
            }}
          >
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="5">5+</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.10)",
              color: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 950,
            }}
          >
            Apply
          </button>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {tab === "accounts" ? (
          <AccountsTable accounts={accounts} onUnban={onUnban} onUnsuspend={onUnsuspend} />
        ) : (
          <AgeGateLogsTable
            logs={logs}
            onOpenUser={(userId) => navigate(`/app/profile/${userId}`)}
          />
        )}
      </div>
    </div>
  );
}

function AccountsTable({
  accounts,
  onUnban,
  onUnsuspend,
}: {
  accounts: AdminBlockedUser[];
  onUnban: (id: string) => void;
  onUnsuspend: (id: string) => void;
}) {
  if (!accounts.length) {
    return <div style={{ opacity: 0.8, fontWeight: 900 }}>No blocked/suspended users.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontWeight: 800 }}>
        <thead>
          <tr style={{ textAlign: "left", opacity: 0.85 }}>
            <th style={{ padding: "10px 8px" }}>User</th>
            <th style={{ padding: "10px 8px" }}>Status</th>
            <th style={{ padding: "10px 8px" }}>Reason</th>
            <th style={{ padding: "10px 8px" }}>Created</th>
            <th style={{ padding: "10px 8px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((u) => {
            const status = u.isBanned ? "banned" : u.isSuspended ? "suspended" : "unknown";
            const reason = u.isBanned ? u.banReason : u.suspendReason;
            const created = u.createdAt ? new Date(u.createdAt).toLocaleString() : "-";
            return (
              <tr key={u._id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <td style={{ padding: "10px 8px" }}>
                  <div style={{ fontWeight: 950 }}>{u.displayName || "Unknown"}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>{u._id}</div>
                </td>
                <td style={{ padding: "10px 8px" }}>{status}</td>
                <td style={{ padding: "10px 8px", opacity: 0.85 }}>{reason || "-"}</td>
                <td style={{ padding: "10px 8px", opacity: 0.85 }}>{created}</td>
                <td style={{ padding: "10px 8px" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {u.isBanned && (
                      <button
                        onClick={() => onUnban(u._id)}
                        style={actionBtn}
                      >
                        Unban
                      </button>
                    )}
                    {u.isSuspended && (
                      <button
                        onClick={() => onUnsuspend(u._id)}
                        style={actionBtn}
                      >
                        Unsuspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AgeGateLogsTable({
  logs,
  onOpenUser,
}: {
  logs: AdminAgeGateLog[];
  onOpenUser: (userId: string) => void;
}) {
  if (!logs.length) {
    return <div style={{ opacity: 0.8, fontWeight: 900 }}>No age-gate logs (min attempts threshold applied).</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontWeight: 800 }}>
        <thead>
          <tr style={{ textAlign: "left", opacity: 0.85 }}>
            <th style={{ padding: "10px 8px" }}>Last attempt</th>
            <th style={{ padding: "10px 8px" }}>Email</th>
            <th style={{ padding: "10px 8px" }}>Attempts</th>
            <th style={{ padding: "10px 8px" }}>First DOB</th>
            <th style={{ padding: "10px 8px" }}>Success DOB</th>
            <th style={{ padding: "10px 8px" }}>User</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => {
            const when = l.lastUnderageAttemptAt ? new Date(l.lastUnderageAttemptAt).toLocaleString() : "-";

            const linkedUser =
              l.userId && typeof l.userId === "object" ? l.userId : null;

            const linkedUserId =
              linkedUser?._id ||
              (typeof l.userId === "string" ? l.userId : "");

            const linkedLabel =
              linkedUser?.displayName ||
              linkedUser?.username ||
              linkedUserId ||
              "-";

            return (
              <tr key={l._id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <td style={{ padding: "10px 8px", opacity: 0.9 }}>{when}</td>
                <td style={{ padding: "10px 8px", fontWeight: 950 }}>{l.email}</td>
                <td style={{ padding: "10px 8px" }}>{l.failedUnderageAttempts}</td>
                <td style={{ padding: "10px 8px", opacity: 0.85 }}>{l.firstDobString || "-"}</td>
                <td style={{ padding: "10px 8px", opacity: 0.85 }}>{l.successDobString || "-"}</td>
                <td style={{ padding: "10px 8px" }}>
                  {linkedUserId ? (
                    <button
                      onClick={() => onOpenUser(linkedUserId)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.08)",
                        color: "inherit",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      title={linkedUserId}
                    >
                      {linkedLabel}
                    </button>
                  ) : (
                    <span style={{ opacity: 0.75, fontSize: 12 }}>-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.10)",
  color: "inherit",
  cursor: "pointer",
  fontWeight: 950,
};
