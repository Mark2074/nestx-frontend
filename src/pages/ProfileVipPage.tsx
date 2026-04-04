import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/nestxApi";

type VipStatus = {
  isVipActive: boolean;
  vipExpiresAt: string | null;
  vipAutoRenew: boolean;
  priceTokens: number;
  days: number;
};

function formatLocal(dtIso: string | null) {
  if (!dtIso) return "—";
  try {
    const d = new Date(dtIso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

export default function ProfileVipPage() {
  const nav = useNavigate();

  const [status, setStatus] = React.useState<VipStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busyBuy, setBusyBuy] = React.useState(false);
  const [busyCancel, setBusyCancel] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const r = await api.vipStatus(); // GET /api/vip/status
      setStatus(r as any);
    } catch (e: any) {
      setMsg(String(e?.message || "Failed to load VIP status"));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const isVipActive = !!status?.isVipActive;
  const priceTokens = Number(status?.priceTokens ?? 80);
  const days = Number(status?.days ?? 30);

  const onBuy = async () => {
    if (busyBuy) return;
    setBusyBuy(true);
    setMsg("");

    try {
      await api.vipBuy(); // POST /api/vip/buy
      await load();

      window.dispatchEvent(new Event("nestx-wallet-updated"));
      window.dispatchEvent(new Event("nestx-profile-updated"));

      setMsg("VIP activated.");
    } catch (e: any) {
      const code = String(
        e?.code || e?.data?.code || e?.response?.data?.code || ""
      ).trim();

      if (code === "INSUFFICIENT_TOKENS") {
        setMsg("Not enough tokens.");
      } else {
        setMsg(String(e?.message || "VIP purchase failed"));
      }
    } finally {
      setBusyBuy(false);
    }
  };

  const onCancel = async () => {
    if (busyCancel) return;
    setBusyCancel(true);
    setMsg("");

    try {
      await api.vipCancel(); // POST /api/vip/cancel
      setMsg("Auto-renew disabled.");
      await load();
    } catch (e: any) {
      setMsg(String(e?.message || "Failed to cancel auto-renew"));
    } finally {
      setBusyCancel(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 980, margin: "0 auto" }}>
      {/* header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 0.5 }}>VIP</div>

        {/* membership card */}
        <div
          style={{
            minWidth: 360,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>VIP Membership</div>

          {loading ? (
            <div style={{ marginTop: 8, opacity: 0.75 }}>Loading…</div>
          ) : (
            <>
              <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
                {isVipActive ? "Active" : "Not active"}
              </div>

              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                <div>
                  <span style={{ fontWeight: 900 }}>Active until:</span>{" "}
                  {formatLocal(status?.vipExpiresAt ?? null)}
                </div>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: 900 }}>Auto-renew:</span>{" "}
                  {isVipActive ? (status?.vipAutoRenew ? "ON" : "OFF") : "OFF"}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {!isVipActive ? (
                  <button
                    onClick={onBuy}
                    disabled={busyBuy}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {busyBuy ? "Buying..." : `Buy VIP — ${priceTokens} tokens / ${days} days`}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => nav("/app/profile/vip-feed")}
                      style={{
                        padding: "9px 12px",
                        borderRadius: 12,
                        fontWeight: 900,
                        cursor: "pointer",
                        opacity: 0.92,
                        background: "transparent",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.14)",
                      }}
                    >
                      Open VIP tools
                    </button>

                    {status?.vipAutoRenew ? (
                      <button
                        onClick={onCancel}
                        disabled={busyCancel}
                        style={{
                          padding: "7px 10px",          // ✅ smaller
                          borderRadius: 10,              // ✅ smaller
                          fontWeight: 900,
                          fontSize: 13,                  // ✅ smaller
                          cursor: "pointer",
                          opacity: 0.92,
                          background: "transparent",
                          color: "white",
                          border: "1px solid rgba(255,255,255,0.14)",
                        }}
                      >
                        {busyCancel ? "Cancelling..." : "Cancel auto-renew"}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </>
          )}

          {msg ? <div style={{ marginTop: 10, opacity: 0.85 }}>{msg}</div> : null}
        </div>
      </div>

      {/* benefits */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 18,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>What VIP includes</div>
        <div style={{ opacity: 0.85, marginTop: 10, lineHeight: 1.55 }}>
          <div>• Delete your post comments</div>
          <div>• Delete messages you sent</div>
          <div>• VIP feed personalization</div>
          <div>• Write in live chat</div>
          <div>• Send up to 100 messages/day</div>
          <div>• Publish up to 2 Showcase items/week</div>
          <div>• Receive donations</div>
          <div>• Upload videos up to 3 minutes (Base: 1 minute)</div>
          <div>• Create polls</div>
          <div>• Change your poll vote</div>
        </div>

        {!isVipActive ? (
          <div style={{ marginTop: 14 }}>
            <button
              onClick={onBuy}
              disabled={busyBuy}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {busyBuy ? "Buying..." : `Buy VIP — ${priceTokens} tokens / ${days} days`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}