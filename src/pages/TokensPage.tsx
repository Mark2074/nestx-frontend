import { useEffect, useMemo, useState } from "react";
import { api } from "../api/nestxApi"; // NOTE: adjust path in project if needed
import { Link } from "react-router-dom";

type Wallet = {
  economyEnabled: boolean;
  balance: number;
  purchased: number;
  earnings: number;
  redeemable: number;
  held: number;
};

type TxItem = any;

export default function TokensPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [wallet, setWallet] = useState<Wallet>({
    economyEnabled: false,
    balance: 0,
    purchased: 0,
    earnings: 0,
    redeemable: 0,
    held: 0,
  });

  const [tx, setTx] = useState<{ count: number; items: TxItem[] }>({ count: 0, items: [] });

  const [elig, setElig] = useState<{ ok: boolean; code: string } | null>(null);
  const [available, setAvailable] = useState<any | null>(null);

  const economyEnabled = wallet.economyEnabled;
  const held = Math.max(0, Number(wallet.held || 0));
  const balance = Math.max(0, Number(wallet.balance || 0));
  const purchased = Math.max(0, Number(wallet.purchased || 0));
  const earnings = Math.max(0, Number(wallet.earnings || 0));
  const redeemable = Math.max(0, Number(wallet.redeemable || 0));

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [w, txs, e, a] = await Promise.all([
          api.getTokensMe(),
          api.getTokenTransactions(50),
          api.getPayoutEligibility(),
          api.getPayoutAvailable(),
        ]);

        if (!alive) return;

        setWallet(w);
        setTx(txs);
        setElig({ ok: Boolean(e?.ok), code: String(e?.code || "UNKNOWN") });
        setAvailable(a || null);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "Failed to load tokens.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const badge = useMemo(() => {
    if (!economyEnabled) {
      return { label: "Economy: Disabled", helper: "The token economy is currently disabled during testing." };
    }
    return { label: "Economy: Live", helper: "" };
  }, [economyEnabled]);

  const availableToWithdraw = Number(available?.availableToWithdrawTokens || 0);

  const canRequestPayout =
    Boolean(economyEnabled) &&
    Boolean(elig?.ok) &&
    availableToWithdraw > 0;

  function formatTxKind(kindRaw: string) {
    const kind = String(kindRaw || "").trim().toLowerCase();

    switch (kind) {
      case "topup":
        return "Top up";
      case "vip_purchase":
        return "VIP purchase";
      case "donation":
        return "Donation";
      case "tip":
        return "Tip";

      case "showcase_hold":
        return "Showcase reservation";
      case "showcase_release":
        return "Showcase reservation released";
      case "showcase_charge":
        return "Showcase final charge";

      case "adv_hold":
        return "Promoted reservation";
      case "adv_release":
        return "Promoted reservation released";
      case "adv_charge":
        return "Promoted final charge";

      case "payout_request":
        return "Payout request";
      case "payout_release":
        return "Payout release";
      case "payout_paid":
        return "Payout paid";
      case "refund":
        return "Refund";
      default:
        return kindRaw || "transaction";
    }
  }

  function formatTxNote(kindRaw: string) {
    const kind = String(kindRaw || "").trim().toLowerCase();

    switch (kind) {
      case "showcase_hold":
        return "Tokens temporarily held pending admin review.";
      case "showcase_release":
        return "Held tokens released back to your balance.";
      case "showcase_charge":
        return "Final charge after showcase approval.";

      case "adv_hold":
        return "Tokens temporarily held pending approval.";
      case "adv_release":
        return "Held tokens released back to your balance.";
      case "adv_charge":
        return "Final charge after approval.";

      case "vip_purchase":
        return "Tokens used to activate or renew VIP.";
      case "donation":
        return "Direct donation to a VIP profile.";
      case "tip":
        return "Tip sent during a live event.";
      case "topup":
        return "Tokens purchased on the platform.";
      case "payout_request":
        return "Tokens moved into payout processing.";
      case "payout_release":
        return "Payout hold released back to your balance.";
      case "payout_paid":
        return "Payout completed.";
      case "refund":
        return "Tokens refunded.";
      default:
        return "";
    }
  }

  const cardStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 16,
    background: "rgba(255,255,255,0.04)",
    marginBottom: 14,
  };

  const h2Style: React.CSSProperties = { margin: "0 0 10px 0", fontSize: 16 };

  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.8, marginBottom: 4 };
  const valueStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, marginBottom: 10 };

  const pillStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 12,
    opacity: 0.9,
  };

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: disabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontWeight: 700,
  });

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Tokens</h1>
        <span style={pillStyle}>{badge.label}</span>
      </div>
      {!economyEnabled && (
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
          {badge.helper}
        </div>
      )}

      {loading && <div style={{ marginTop: 18, opacity: 0.8 }}>Loading…</div>}
      {error && (
        <div style={{ marginTop: 18, color: "#ff8a8a" }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Wallet */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={h2Style}>Wallet</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <div style={labelStyle}>Balance</div>
                <div style={valueStyle}>{balance}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Total token balance reported by the system.
                </div>
              </div>

              <div>
                <div style={labelStyle}>Purchased</div>
                <div style={valueStyle}>{purchased}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Tokens bought directly on the platform.
                </div>
              </div>

              <div>
                <div style={labelStyle}>Earnings</div>
                <div style={valueStyle}>{earnings}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Tokens received through platform activity.
                </div>
              </div>

              <div>
                <div style={labelStyle}>Redeemable</div>
                <div style={valueStyle}>{redeemable}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Creator tokens eligible for payout, if approved.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={labelStyle}>Held</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{held}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Tokens temporarily held for pending actions or payout processing.
              </div>
            </div>
          </div>

          {/* Buy tokens */}
          <div style={cardStyle}>
            <h2 style={h2Style}>Buy tokens</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                style={btnStyle(!economyEnabled)}
                disabled={!economyEnabled}
                onClick={() => {
                  if (!economyEnabled) return;
                  alert("Buy tokens (Stripe) — Coming soon");
                }}
              >
                {economyEnabled ? "Buy" : "Coming soon"}
              </button>
              {!economyEnabled ? (
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Token purchases are disabled during testing.
                </div>
              ) : (
                <div style={{ fontSize: 13, opacity: 0.85 }}>Buy is not implemented yet (Stripe placeholder).</div>
              )}
            </div>
          </div>

          {/* Transactions */}
          <div style={cardStyle}>
            <h2 style={h2Style}>Transactions</h2>

            {(!tx.items || tx.items.length === 0) ? (
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                No transactions yet.
                <br />
                Transactions will appear here once the economy is live.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tx.items.map((it: any, i: number) => {
                  const amount = Number(it?.amountTokens || 0);
                  const direction = String(it?.direction || "");
                  const kindRaw = String(it?.kind || "");
                  const kind = formatTxKind(kindRaw);
                  const note = formatTxNote(kindRaw);
                  const when = it?.createdAt ? new Date(it.createdAt).toLocaleString() : "";

                  return (
                    <div
                      key={String(it?._id || i)}
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 10,
                        padding: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                          {kind || "transaction"}{" "}
                          <span style={{ fontWeight: 400, opacity: 0.75 }}>· {direction || "-"}</span>
                        </div>

                        {note ? (
                          <div style={{ fontSize: 12, opacity: 0.82, marginBottom: 4 }}>
                            {note}
                          </div>
                        ) : null}

                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {when}
                        </div>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>
                        {direction === "debit" ? "-" : "+"}
                        {amount}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payouts */}
          <div style={cardStyle}>
            <h2 style={h2Style}>Payouts</h2>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
              Withdraw your earnings if you are eligible.
            </div>

            {!economyEnabled && (
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                Payouts are disabled during testing.
              </div>
            )}

            {elig && !elig.ok && (
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
                To withdraw Redeemable tokens, you must complete Creator onboarding and be approved.{" "}
                <Link to="/app/rules/become-creator" style={{ textDecoration: "underline" }}>
                  Become a creator
                </Link>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                style={btnStyle(!canRequestPayout)}
                disabled={!canRequestPayout}
                onClick={() => {
                  if (!canRequestPayout) return;
                  alert("Request payout — Coming soon");
                  // in 1B reale: api.requestPayout(...)
                }}
              >
                Request payout
              </button>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Available for payout: {availableToWithdraw} tokens
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
