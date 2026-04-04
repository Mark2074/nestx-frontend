import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/nestxApi";
import type { MeProfile } from "../api/nestxApi";

export default function ProfileVipToolsPage() {
  const nav = useNavigate();
  const [me, setMe] = React.useState<MeProfile | null>(null);
  const [keywordsText, setKeywordsText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  // --- Showcase composer (VIP only) ---
  const [scTitle, setScTitle] = React.useState("");
  const [scText, setScText] = React.useState("");
  const [scFile, setScFile] = React.useState<File | null>(null);
  const [scPreview, setScPreview] = React.useState<string | null>(null);

  const [scBusy, setScBusy] = React.useState(false);
  const [scStatusMsg, setScStatusMsg] = React.useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmMsg, setConfirmMsg] = React.useState<string>(
    "You already have 2 free active Showcase items. This request is paid (30 tokens / 7 days). Proceed?"
  );

  React.useEffect(() => {
    if (!scFile) {
      setScPreview(null);
      return;
    }
    const url = URL.createObjectURL(scFile);
    setScPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [scFile]);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const m = await api.meProfile();
        if (!alive) return;
        setMe(m);
        try {
          const vs = await api.vipStatus();
          if (!alive) return;
          setVip(vs as any);
        } catch {
          setVip(null);
        }

        const existing = Array.isArray((m as any)?.interestsVip) ? (m as any).interestsVip : [];
        setKeywordsText(existing.join("\n"));
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, []);

  const onSave = async () => {
    if (!me?.isVip) return;

    const list = keywordsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    setBusy(true);
    setSaved(false);

    try {
    // backend /profile/update richiede sempre area (mandatory area)
    await api.profileUpdate({
        area: String(me?.area || "").trim() || "Italy",
        interestsVip: list,
    });
    setSaved(true);
    } catch (err: any) {
    alert(err?.message || "Save failed");
    } finally {
    setBusy(false);
    }
  };

  const refreshVip = async () => {
    try {
      const vs = await api.vipStatus();
      setVip(vs as any);
    } catch {
      setVip(null);
    }
  };

  const onVipConfirmBuy = async () => {
    setVipPurchaseBusy(true);
    setVipPurchaseMsg(null);

    try {
      await api.vipBuy();
      await refreshVip();

      const m = await api.meProfile();
      setMe(m);

      window.dispatchEvent(new Event("nestx-wallet-updated"));
      window.dispatchEvent(new Event("nestx-profile-updated"));

      setVipPurchaseMsg("VIP activated.");
      setTimeout(() => setVipModalOpen(false), 600);
    } catch (err: any) {
      const code = String(
        err?.data?.code || err?.code || err?.response?.data?.code || ""
      ).trim();

      if (code === "INSUFFICIENT_TOKENS") {
        setVipPurchaseMsg("Not enough tokens.");
      } else {
        setVipPurchaseMsg(err?.message || "VIP purchase failed");
      }
    } finally {
      setVipPurchaseBusy(false);
    }
  };

  const onVipCancel = async () => {
    const ok = window.confirm("Cancel VIP auto-renew?");
    if (!ok) return;

    setVipBusy(true);
    setVipMsg(null);
    try {
      await api.vipCancel();
      setVipMsg("Auto-renew canceled.");
      await refreshVip();
    } catch (err: any) {
      setVipMsg(err?.message || "Cancel failed");
    } finally {
      setVipBusy(false);
    }
  };

  const submitShowcase = async (confirmPaid: boolean) => {
    if (!me?.isVip) return;

    const title = scTitle.trim();
    const text = scText.trim();

    if (!title) {
      setScStatusMsg("Title is required.");
      return;
    }
    if (!scFile) {
      setScStatusMsg("Image is required.");
      return;
    }

    setScBusy(true);
    setScStatusMsg(null);

    try {
      const mediaUrl = await api.uploadShowcaseImage(scFile);

      await api.showcaseRequest({
        title,
        text,
        mediaUrl,
        confirmPaid,
      });

      setScStatusMsg("Request sent. Pending approval.");
      setScTitle("");
      setScText("");
      setScFile(null);
      setConfirmOpen(false);
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const code = String(err?.data?.code || "");

      if (status === 409 && code === "VETRINA_PAYMENT_REQUIRED") {
        setConfirmMsg(
          "You already have 2 free active Showcase items. This request is paid (30 tokens / 7 days). Proceed?"
        );
        setConfirmOpen(true);
        return;
      }

      if (status === 403 && code === "INSUFFICIENT_TOKENS") {
        setScStatusMsg("Not enough tokens");
        return;
      }

      setScStatusMsg(err?.message || "Request failed");
    } finally {
      setScBusy(false);
    }
  };

  type VipStatus = {
  isVipActive: boolean;
  vipExpiresAt: string | null;
  vipAutoRenew: boolean;
  priceTokens: number;
  days: number;
  };

  const [vip, setVip] = React.useState<VipStatus | null>(null);
  const [vipBusy, setVipBusy] = React.useState(false);
  const [vipMsg, setVipMsg] = React.useState<string | null>(null);
  // --- VIP Benefits modal ---
  const [vipModalOpen, setVipModalOpen] = React.useState(false);
  const [vipPurchaseBusy, setVipPurchaseBusy] = React.useState(false);
  const [vipPurchaseMsg, setVipPurchaseMsg] = React.useState<string | null>(null);

  const VIP_BENEFITS: string[] = [
    "Delete comments on your posts",
    "Personalized VIP feed (custom keywords)",
    "Write in live chat",
    "Send up to 100 messages/day",
    "Publish up to 2 Showcase items/week",
    "Receive donations",
    "Upload videos up to 3 minutes (base: 1 minute)",
    "Create polls",
    "Change your poll vote",
  ];

  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 0.5 }}>VIP</div>

        <div
          style={{
            minWidth: 320,
            maxWidth: 420,
            flex: "1 1 320px",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 14,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>VIP Membership</div>

          {!vip ? (
            <div style={{ marginTop: 8, opacity: 0.7 }}>Loading…</div>
          ) : vip.isVipActive ? (
            <>
              <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.45, fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 900 }}>Active until:</span>{" "}
                  {vip.vipExpiresAt ? new Date(vip.vipExpiresAt).toLocaleString() : "—"}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontWeight: 900 }}>Auto-renew:</span>{" "}
                  {vip.vipAutoRenew ? "ON" : "OFF"}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setVipPurchaseMsg(null);
                    setVipModalOpen(true);
                  }}
                  disabled={vipBusy}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: vipBusy ? 0.6 : 1,
                    background: "transparent",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  Benefits
                </button>

                <button
                  onClick={onVipCancel}
                  disabled={vipBusy || !vip.vipAutoRenew}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: vipBusy || !vip.vipAutoRenew ? 0.6 : 1,
                    background: "transparent",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  Cancel auto-renew
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                VIP gives you access to Feed Personalization and Showcase requests.
                <br />
                Purchase and membership management are handled in the VIP Membership page.
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={() => {
                    setVipPurchaseMsg(null);
                    setVipModalOpen(true);
                  }}
                  disabled={vipBusy}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: vipBusy ? 0.6 : 1,
                    background: "transparent",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  Benefits
                </button>

                <button
                  onClick={() => nav("/app/profile/vip")}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: 1,
                  }}
                >
                  Open VIP Membership
                </button>
              </div>
            </>
          )}

          {vipMsg ? (
            <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 900 }}>
              {vipMsg}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 18,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>VIP Feed Personalization</div>
        <div style={{ opacity: 0.75, fontSize: 14, marginTop: 6 }}>
          Add custom keywords to personalize your VIP feed.
          <br />
          One keyword per line.
        </div>

        {!me ? (
          <div style={{ marginTop: 14, opacity: 0.7 }}>Loading…</div>
        ) : !me.isVip ? (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px dashed rgba(255,255,255,0.18)",
              opacity: 0.9,
              fontWeight: 800,
            }}
          >
            VIP membership required to use this feature.
          </div>
        ) : (
          <>
            <textarea
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder={"example:\nfitness\ncrypto\nAI\ntravel"}
              style={{
                marginTop: 16,
                width: "calc(100% - 2px)",
                boxSizing: "border-box",
                minHeight: 140,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "inherit",
                resize: "vertical",
              }}
              disabled={busy}
            />

            <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={onSave}
                disabled={busy}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {busy ? "Saving..." : "Save"}
              </button>

              {saved ? <div style={{ opacity: 0.8 }}>Saved.</div> : null}
            </div>
          </>
        )}
      </div>
      {/* SHOWCASE (VIP only) */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 18,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>Showcase</div>
        <div style={{ opacity: 0.75, fontSize: 14, marginTop: 6 }}>
          Request Showcase placement (VIP only).
        </div>

        {!me ? (
          <div style={{ marginTop: 14, opacity: 0.7 }}>Loading…</div>
        ) : !me.isVip ? (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px dashed rgba(255,255,255,0.18)",
              opacity: 0.9,
              fontWeight: 800,
            }}
          >
            VIP membership required to request Showcase placement.
          </div>
        ) : (
          <>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <input
                value={scTitle}
                onChange={(e) => setScTitle(e.target.value)}
                placeholder="Title (required)"
                disabled={scBusy}
                style={{
                  width: "calc(100% - 2px)",
                  boxSizing: "border-box",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                }}
              />

              <textarea
                value={scText}
                onChange={(e) => setScText(e.target.value)}
                placeholder="Description / text (optional)"
                disabled={scBusy}
                style={{
                  width: "calc(100% - 2px)",
                  boxSizing: "border-box",
                  minHeight: 110,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit",
                  resize: "vertical",
                }}
              />

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  disabled={scBusy}
                  onChange={(e) => setScFile(e.target.files?.[0] || null)}
                />

                {scPreview ? (
                  <img
                    src={scPreview}
                    alt="preview"
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 16,
                      objectFit: "cover",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  />
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  onClick={() => submitShowcase(false)}
                  disabled={scBusy}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {scBusy ? "Sending..." : "Submit request"}
                </button>

                {scStatusMsg ? <div style={{ opacity: 0.85 }}>{scStatusMsg}</div> : null}
              </div>
            </div>

            {/* Paid confirm modal */}
            {confirmOpen ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.35)",
                }}
              >
                <div style={{ fontWeight: 900 }}>Paid slot</div>
                <div style={{ marginTop: 6, opacity: 0.85, lineHeight: 1.35 }}>{confirmMsg}</div>

                <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                  <button
                    onClick={() => submitShowcase(true)}
                    disabled={scBusy}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Proceed
                  </button>

                  <button
                    onClick={() => setConfirmOpen(false)}
                    disabled={scBusy}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                      opacity: 0.85,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      {/* VIP Benefits + Buy modal */}
      {vipModalOpen ? (
        <div
          onClick={() => !vipPurchaseBusy && setVipModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(20,20,20,0.96)",
              padding: 16,
              boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>VIP Membership</div>

              <button
                onClick={() => !vipPurchaseBusy && setVipModalOpen(false)}
                disabled={vipPurchaseBusy}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                  opacity: vipPurchaseBusy ? 0.6 : 0.9,
                  background: "transparent",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.45, fontSize: 14 }}>
              <div style={{ opacity: 0.85 }}>
                Price: <b>{vip?.priceTokens ?? 80} tokens</b> — Duration: <b>{vip?.days ?? 30} days</b> — Auto-renew:{" "}
                <b>ON</b>
              </div>
              <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
                Auto-renew only if enabled. If you don’t have enough tokens at expiry, VIP ends and auto-renew turns off.
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, opacity: 0.9 }}>Benefits</div>
              <ul style={{ marginTop: 8, paddingLeft: 18, opacity: 0.9, lineHeight: 1.45 }}>
                {VIP_BENEFITS.map((b) => (
                  <li key={b} style={{ marginBottom: 6 }}>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {!vip?.isVipActive ? (
                <button
                  onClick={onVipConfirmBuy}
                  disabled={vipPurchaseBusy}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: vipPurchaseBusy ? 0.6 : 1,
                  }}
                >
                  {vipPurchaseBusy ? "Processing..." : "Confirm purchase"}
                </button>
              ) : (
                <div style={{ fontWeight: 900, opacity: 0.85 }}>You already have VIP active.</div>
              )}

              {vipPurchaseMsg ? (
                <div style={{ fontWeight: 900, opacity: 0.9 }}>{vipPurchaseMsg}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}