import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/nestxApi";
import type { MeProfile } from "../../api/nestxApi";

type Eligibility = {
  eligible?: boolean;
  isEligible?: boolean;
  canPayout?: boolean;

  // optional extra signals (backend may vary)
  needsVerification?: boolean;
  reason?: string;
  status?: string;
};

type CreatorStage = "not_creator" | "pending" | "approved_no_stripe" | "stripe_verified";

export default function ProfilePayoutCard() {
  const nav = useNavigate();

  const [me, setMe] = useState<MeProfile | null>(null);
  const [elig, setElig] = useState<Eligibility | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // request creator form
  const [over18, setOver18] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");
      setToast("");

      try {
        const [meRes, eligRes] = await Promise.all([
          api.meProfile(),
          api.payoutEligibility().catch(() => ({})),
        ]);

        if (!alive) return;

        setMe(meRes || null);
        setElig((eligRes as any) || {});
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || "Failed to load"));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const normalized = useMemo(() => {
    const m = me || ({} as MeProfile);
    const e = elig || {};

    const creatorVerificationStatus = String(m.creatorVerificationStatus || "").trim().toLowerCase();
    const isCreator = Boolean(m.isCreator);
    const payoutEnabled = Boolean(m.payoutEnabled);
    const payoutStatus = String(m.payoutStatus || "").trim().toLowerCase();

    const canPayout = Boolean((e as any)?.canPayout);
    const eligible = Boolean((e as any)?.eligible ?? (e as any)?.isEligible);
    const needsVerification = Boolean((e as any)?.needsVerification);
    const reason = String((e as any)?.reason || "").trim();
    const status = String((e as any)?.status || "").trim();

    let stage: CreatorStage = "not_creator";

    if (creatorVerificationStatus === "pending") stage = "pending";
    else if (isCreator && (!payoutEnabled || payoutStatus !== "verified")) stage = "approved_no_stripe";
    else if (isCreator && payoutEnabled && payoutStatus === "verified") stage = "stripe_verified";
    else stage = "not_creator";

    return {
      stage,
      isCreator,
      creatorVerificationStatus,
      payoutEnabled,
      payoutStatus,
      canPayout,
      eligible,
      needsVerification,
      reason,
      status,
    };
  }, [me, elig]);

  const subtitle = useMemo(() => {
    if (loading) return "Loading...";
    if (err) return err;

    if (normalized.stage === "pending") return "Your creator request is under review.";
    if (normalized.stage === "approved_no_stripe") return "Creator approved. Complete Stripe payout setup.";
    if (normalized.stage === "stripe_verified") {
      if (normalized.canPayout) return "Payout available.";
      if (normalized.reason) return normalized.reason;
      if (normalized.status) return normalized.status;
      return "Payout verified.";
    }

    // not creator
    return "Request creator access to start hosting and unlock payouts via Stripe.";
  }, [loading, err, normalized]);

  async function onRequestCreator() {
    setToast("");
    setErr("");

    if (!over18 || !acceptTerms) {
      setToast("Please confirm you are over 18 and accept Creator Terms.");
      return;
    }

    setBusy(true);
    try {
      await api.creatorRequest({
        over18,
        acceptTerms,
        note: note.trim() ? note.trim() : null,
      });

      // refresh
      const meRes = await api.meProfile();
      setMe(meRes || null);
      setToast("Request sent. Waiting for admin approval.");
    } catch (e: any) {
      setErr(String(e?.message || "Failed to submit request"));
    } finally {
      setBusy(false);
    }
  }

  async function onStripeOnboarding() {
    setToast("");
    setErr("");
    setBusy(true);

    try {
      const res = await api.stripeCreateAccountLink();
      const url = String(res?.url || "").trim();
      if (!url) throw new Error("Missing Stripe onboarding URL");
      window.location.href = url;
    } catch (e: any) {
      setErr(String(e?.message || "Failed to start Stripe onboarding"));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900 }}>Creator / Payout</div>
          <div style={{ opacity: 0.75, fontSize: 13, marginTop: 6 }}>{subtitle}</div>
        </div>

        {normalized.stage === "stripe_verified" ? (
          <button
            onClick={() => nav("/app/tokens")}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              whiteSpace: "nowrap",
            }}
          >
            Tokens → Payout
          </button>
        ) : normalized.stage === "approved_no_stripe" ? (
          <button
            onClick={onStripeOnboarding}
            disabled={busy || loading}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: busy || loading ? "not-allowed" : "pointer",
              border: "1px solid rgba(255,255,255,0.12)",
              background: busy || loading ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              opacity: busy || loading ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            Complete payout setup
          </button>
        ) : null}
      </div>

      {/* BODY */}
      <div style={{ marginTop: 12 }}>
        {loading ? null : normalized.stage === "not_creator" ? (
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
              <input type="checkbox" checked={over18} onChange={(e) => setOver18(e.target.checked)} />
              I confirm I am over 18
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              <span>
                I accept{" "}
                <a
                  href="/rules/en/9_CREATOR_TERMS_AND_MONETIZATION.html"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontWeight: 900, textDecoration: "underline", color: "rgba(180,190,255,0.95)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Creator Terms
                </a>
              </span>
            </label>

            <div>
              <div style={{ fontWeight: 800, marginBottom: 6, opacity: 0.9 }}>Optional notes</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Write a short note for the admin (optional)"
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.20)",
                  color: "rgba(255,255,255,0.92)",
                  padding: 10,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={onRequestCreator}
                disabled={busy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: busy ? "not-allowed" : "pointer",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: busy ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.92)",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Request Creator Access
              </button>
            </div>
          </div>
        ) : normalized.stage === "pending" ? (
          <div style={{ opacity: 0.9, fontWeight: 800 }}>
            Please wait for admin approval. You will receive a notification when ready.
          </div>
        ) : normalized.stage === "approved_no_stripe" ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 800, opacity: 0.95 }}>
              Identity verification and payout compliance are handled securely by Stripe.
            </div>
            <div style={{ opacity: 0.8 }}>
              NestX does not store identity documents.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {normalized.reason || normalized.status ? (
              <div style={{ opacity: 0.85 }}>{normalized.reason || normalized.status}</div>
            ) : null}

            <div style={{ fontWeight: 800, opacity: 0.95 }}>
              Identity verification and payout compliance are handled securely by Stripe.
            </div>
            <div style={{ opacity: 0.8 }}>
              NestX does not store identity documents.
            </div>
          </div>
        )}
      </div>

      {/* feedback */}
      {toast ? (
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>{toast}</div>
      ) : null}
      {err ? (
        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(239,68,68,0.95)", fontWeight: 800 }}>{err}</div>
      ) : null}

      {/* mandatory footer */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.10)", fontSize: 12, opacity: 0.78 }}>
        Identity verification and payout compliance are handled securely by Stripe. NestX does not store identity documents.
      </div>
    </div>
  );
}