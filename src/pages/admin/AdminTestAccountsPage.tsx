import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { panel } from "./adminUi";
import {
  adminGrantTestTokens,
  adminGrantTestVip,
  adminListTestAccounts,
  type AdminTestAccountItem,
} from "../../api/nestxApi";

function fmtDate(iso?: string | null) {
  if (!iso) return "None";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString();
}

function fmtNumber(value?: number) {
  return Number(value || 0).toLocaleString();
}

function userLabel(user: AdminTestAccountItem) {
  return user.username || user.displayName || user.email || user._id;
}

export default function AdminTestAccountsPage() {
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<AdminTestAccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});
  const [vipDays, setVipDays] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => account.isInternalTest === true),
    [accounts],
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await adminListTestAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load test accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function grantTokens(account: AdminTestAccountItem) {
    if (account.isInternalTest !== true) {
      setErr("Denied: target user is not an internal test account.");
      return;
    }

    const amount = Number.parseInt(tokenAmounts[account._id] || "", 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter a token amount greater than 0.");
      return;
    }

    setBusyKey(`${account._id}:tokens`);
    setErr(null);
    setNotice(null);
    try {
      await adminGrantTestTokens(account._id, {
        amountTokens: amount,
        note: notes[account._id]?.trim() || null,
      });
      setNotice(`Granted ${fmtNumber(amount)} test tokens to ${userLabel(account)}.`);
      setTokenAmounts((current) => ({ ...current, [account._id]: "" }));
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to grant test tokens.");
    } finally {
      setBusyKey(null);
    }
  }

  async function grantVip(account: AdminTestAccountItem) {
    if (account.isInternalTest !== true) {
      setErr("Denied: target user is not an internal test account.");
      return;
    }

    const days = Number.parseInt(vipDays[account._id] || "30", 10);
    if (!Number.isFinite(days) || days <= 0) {
      setErr("Enter VIP days greater than 0.");
      return;
    }

    setBusyKey(`${account._id}:vip`);
    setErr(null);
    setNotice(null);
    try {
      await adminGrantTestVip(account._id, {
        days,
        note: notes[account._id]?.trim() || null,
      });
      setNotice(`Granted test VIP to ${userLabel(account)} for ${days} day${days === 1 ? "" : "s"}.`);
      setVipDays((current) => ({ ...current, [account._id]: "30" }));
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to grant test VIP.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>Test Accounts</div>
          <div style={{ marginTop: 6, opacity: 0.82 }}>
            Internal test wallets and VIP grants. Real users are not shown or actionable here.
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading || !!busyKey}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: loading || busyKey ? "default" : "pointer",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,80,80,0.12)" }}>
          <b style={{ display: "block", marginBottom: 6 }}>Error</b>
          <div style={{ opacity: 0.92 }}>{err}</div>
        </div>
      ) : null}

      {notice ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(46,204,113,0.12)" }}>
          <b style={{ display: "block", marginBottom: 6 }}>Done</b>
          <div style={{ opacity: 0.92 }}>{notice}</div>
        </div>
      ) : null}

      {!loading && visibleAccounts.length === 0 ? (
        <div style={{ marginTop: 14, opacity: 0.82, fontWeight: 900 }}>No internal test accounts found.</div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleAccounts.map((account) => {
          const tokenBusy = busyKey === `${account._id}:tokens`;
          const vipBusy = busyKey === `${account._id}:vip`;
          const disabled = !!busyKey || account.isInternalTest !== true;

          return (
            <div
              key={account._id}
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.2fr) repeat(5, minmax(90px, 0.7fr))",
                  gap: 10,
                  alignItems: "start",
                }}
              >
                <button
                  type="button"
                  onClick={() => nav(`/app/profile/${account._id}`)}
                  style={{
                    width: "100%",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  title="Open account profile"
                >
                  <div style={{ fontWeight: 950 }}>{account.email || "No email"}</div>
                  <div style={{ marginTop: 4, opacity: 0.78, fontSize: 13 }}>
                    @{account.username || account.displayName || "unknown"} · {account.accountType || "user"}
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.72, fontSize: 12 }}>{account._id}</div>
                </button>

                <Metric label="Balance" value={fmtNumber(account.tokenBalance)} />
                <Metric label="Purchased" value={fmtNumber(account.tokenPurchased)} />
                <Metric label="Earnings" value={fmtNumber(account.tokenEarnings)} />
                <Metric label="Held" value={fmtNumber(account.tokenHeld)} />
                <Metric label="VIP" value={account.isVip ? "Yes" : "No"} subValue={fmtDate(account.vipExpiresAt)} />
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "minmax(160px, 0.5fr) minmax(180px, 0.7fr) minmax(220px, 1fr) auto auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Tokens"
                  value={tokenAmounts[account._id] || ""}
                  onChange={(e) => setTokenAmounts((current) => ({ ...current, [account._id]: e.target.value }))}
                  style={inputStyle}
                />

                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="VIP days"
                  value={vipDays[account._id] || ""}
                  onChange={(e) => setVipDays((current) => ({ ...current, [account._id]: e.target.value }))}
                  style={inputStyle}
                />

                <input
                  type="text"
                  placeholder="Audit note"
                  value={notes[account._id] || ""}
                  onChange={(e) => setNotes((current) => ({ ...current, [account._id]: e.target.value }))}
                  style={inputStyle}
                />

                <button disabled={disabled} onClick={() => grantTokens(account)} style={buttonStyle(disabled)}>
                  {tokenBusy ? "Granting..." : "Grant tokens"}
                </button>

                <button disabled={disabled} onClick={() => grantVip(account)} style={buttonStyle(disabled)}>
                  {vipBusy ? "Granting..." : "Grant VIP"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div>
      <div style={{ opacity: 0.68, fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 5, fontWeight: 950 }}>{value}</div>
      {subValue ? <div style={{ marginTop: 4, opacity: 0.76, fontSize: 12 }}>{subValue}</div> : null}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  minWidth: 0,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.92)",
  outline: "none",
} as const;

function buttonStyle(disabled: boolean) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    cursor: disabled ? "default" : "pointer",
    border: "1px solid rgba(255,255,255,0.12)",
    background: disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.92)",
    opacity: disabled ? 0.65 : 1,
  } as const;
}
