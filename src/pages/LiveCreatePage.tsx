import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, mapApiErrorMessage, getApiRetryAfterMs, formatRetryAfterLabel } from "../api/nestxApi";

// BE expects: HOT | NO_HOT
type Scope = "HOT" | "NO_HOT";

export default function LiveCreatePage() {
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [contentScope, setContentScope] = useState<Scope | null>(null);

  const [economyEnabled, setEconomyEnabled] = useState<boolean | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessScope, setAccessScope] = useState<"public" | "private">("public");

  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [ticketPriceTokens, setTicketPriceTokens] = useState(0);

  const [maxSeats, setMaxSeats] = useState<number | "">("");

  // ADV (event-banner) from Live setup only
  const [promote, setPromote] = useState(false);

  const isNoHot = contentScope === "NO_HOT";
  const isHot = contentScope === "HOT";

  const effectiveAccessScope: "public" | "private" =
    isNoHot ? "private" : accessScope;

  const isPrivateModel = effectiveAccessScope === "private";
  const canPromoteEvent = economyEnabled !== false && !!contentScope;

  const interactionMode: "broadcast" | "interactive" = "broadcast";

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");

  async function loadEconomyFlag() {
    try {
      const t = await api.getTokensMe();
      const payload = (t as any)?.data ?? t;
      setEconomyEnabled(Boolean(payload?.economyEnabled));
    } catch {
      setEconomyEnabled(false);
    }
  }

  useEffect(() => {
    if (step === 2) void loadEconomyFlag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // When economy is OFF, disable promote (avoid paid logic in a phase that doesn't support it)
  useEffect(() => {
    if (economyEnabled === false) {
      setPromote(false);
    }
  }, [economyEnabled]);

  function goBack() {
    setStep(1);
    setContentScope(null);
    setAccessScope("public");
    setTicketPriceTokens(0);
    setMaxSeats("");
    setPromote(false);
  }

  async function createEventOnce() {
    // qui tieni TUTTE le validazioni che già fai (title, description, economy gates, seats, ecc.)
    // e costruisci payload finale

    const effectiveStartTime =
      contentScope === "HOT" ? (startTime ? startTime : new Date().toISOString()) : startTime;

    const effectiveDuration =
      contentScope === "HOT"
        ? (Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 0)
        : Number(durationMinutes);

    const res = await api.createEvent({
      title: title.trim(),
      description: description.trim(),
      category: "general",
      startTime: effectiveStartTime,
      durationMinutes: effectiveDuration,
      ticketPriceTokens: isPrivateModel ? Number(ticketPriceTokens) : 0,
      maxSeats: isPrivateModel ? Number(maxSeats) : null,
      interactionMode,
      accessScope: effectiveAccessScope,
      contentScope, // "HOT" | "NO_HOT"
    });

    // normalizza id evento (backend può tornare shape diversa)
    const eventId = String(res?.data?._id || res?._id || res?.event?._id || res?.id || "").trim();
    if (!eventId) throw new Error("Event created but missing id");

    return { eventId };
  }

  async function createAdvForEvent(eventId: string, confirmPaid: boolean) {
    // ADV link interno verso event detail (usa il path reale del FE)
    const targetUrl = `/app/live/${eventId}`;

    return api.advCreateCampaign({
      title: title.trim() || "Event",
      text: description.trim(),
      mediaUrl: "",                 // opzionale, backend prenderà coverImage se targetType=event
      placement: "feed",
      targetType: "event",
      targetId: eventId,
      targetUrl,
      confirmPaid: confirmPaid === true,
    });
  }

  async function handleSubmit() {
    if (submitting) return;

    setSubmitting(true);
    setSubmitErr("");
    try {
      // 1) crea evento UNA SOLA volta
      const { eventId } = await createEventOnce();

      // 2) se non devo promuovere → fine
      if (!promote) {
        nav("/app/live/discover");
        return;
      }

      // 3) prova a creare ADV (prima senza conferma)
      try {
        await createAdvForEvent(eventId, false);
        nav("/app/live/discover");
        return;
      } catch (err: any) {
        const code = String(err?.data?.code || err?.code || "");

        if (code === "ADV_PAYMENT_REQUIRED") {
          const price = Number(err?.data?.priceTokens || 10);
          const ok = window.confirm(`This promoted item costs ${price} tokens. Continue?`);
          if (!ok) {
            // evento rimane creato, ma senza promoted: ok.
            nav("/app/live/discover");
            return;
          }

          // ritenta SOLO ADV con confirmPaid=true (non ricreare evento)
          await createAdvForEvent(eventId, true);
          nav("/app/live/discover");
          return;
        }

        if (code === "INSUFFICIENT_TOKENS") {
          alert("Not enough tokens to promote this event.");
          nav("/app/live/discover"); // evento creato, ma niente adv
          return;
        }

        // qualsiasi altro errore ADV: evento creato, ma niente adv
        alert(err?.message || "Error promoting event");
        nav("/app/live/discover");
        return;
      }
    } catch (err: any) {
      const code = String(err?.data?.code || err?.code || "");
      const retryAfterMs = getApiRetryAfterMs(err);

      if (code === "INSUFFICIENT_TOKENS") {
        setSubmitErr("Not enough tokens.");
        return;
      }

      if (code === "TOKENS_DISABLED") {
        setSubmitErr("Tickets are currently disabled.");
        return;
      }

      setSubmitErr(
        mapApiErrorMessage(err, "Error creating event") +
          formatRetryAfterLabel(retryAfterMs)
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 1) {
    return (
      <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
        <h2>Select content type</h2>

        <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
          <button
            onClick={() => {
              setContentScope("HOT");
              setAccessScope("public");
              setTicketPriceTokens(0);
              setMaxSeats("");
              setStep(2);
            }}
            style={scopeBtn("HOT")}
          >
            CAM (HOT)
            <div style={{ fontSize: 13, opacity: 0.8 }}>Adult content</div>
          </button>

          <button
            onClick={() => {
              setContentScope("NO_HOT");
              setAccessScope("private");
              if (Number(ticketPriceTokens) <= 0) setTicketPriceTokens(10);
              if (!Number(maxSeats)) setMaxSeats(10);
              setStep(2);
            }}
            style={scopeBtn("NO_HOT")}
          >
            EVENT (NO_HOT)
            <div style={{ fontSize: 13, opacity: 0.8 }}>Non-adult content</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      <button
        onClick={goBack}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.85)",
          cursor: "pointer",
          fontWeight: 900,
          marginBottom: 8,
        }}
      >
        ← Back
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>
          Create {contentScope === "HOT" ? "HOT" : "NO_HOT"} event
        </h2>

        {economyEnabled === false ? (
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              opacity: 0.9,
            }}
          >
            Economy: OFF
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <label style={labelStyle}>Title</label>
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />

        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 84 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label style={labelStyle}>
          Start time{" "}
          {contentScope === "HOT" ? <span style={{ opacity: 0.7 }}>(optional — does not constrain the live)</span> : null}
        </label>
        <input style={inputStyle} type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />

        <label style={labelStyle}>
          Duration (minutes){" "}
          {contentScope === "HOT" ? <span style={{ opacity: 0.7 }}>(optional — does not constrain the live)</span> : null}
        </label>
        <input
          style={inputStyle}
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          min={0}
        />

        <div
          style={{
            marginTop: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Access type</div>

          {isNoHot ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 900 }}>PRIVATE</span>
              <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>
                Public not available for NO_HOT
              </span>
            </div>
          ) : null}

          {isHot ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setAccessScope("public");
                  setTicketPriceTokens(0);
                  setMaxSeats("");
                }}
                style={{
                  ...modeBtnStyle,
                  ...(accessScope === "public" ? modeBtnActiveStyle : modeBtnIdleStyle),
                }}
              >
                HOT Public
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccessScope("private");
                  if (Number(ticketPriceTokens) <= 0) setTicketPriceTokens(10);
                  if (!Number(maxSeats)) setMaxSeats(10);
                }}
                style={{
                  ...modeBtnStyle,
                  ...(accessScope === "private" ? modeBtnActiveStyle : modeBtnIdleStyle),
                }}
              >
                HOT Private
              </button>
            </div>
          ) : null}
        </div>

        <label style={labelStyle}>Ticket price (tokens)</label>
        <input
          style={{
            ...inputStyle,
            opacity: economyEnabled === false || !isPrivateModel ? 0.6 : 1,
          }}
          type="number"
          value={isPrivateModel ? ticketPriceTokens : 0}
          onChange={(e) => setTicketPriceTokens(Number(e.target.value))}
          min={0}
          disabled={!isPrivateModel || (economyEnabled === false && contentScope === "HOT")}
        />

        {isPrivateModel ? (
          <>
            <label style={labelStyle}>Max seats</label>
            <input
              style={{
                ...inputStyle,
                opacity: economyEnabled === false ? 0.6 : 1,
              }}
              type="number"
              value={maxSeats}
              onChange={(e) => setMaxSeats(Number(e.target.value))}
              min={1}
              disabled={economyEnabled === false && contentScope === "HOT"}
            />
          </>
        ) : null}

        {/* ADV toggle */}
        {canPromoteEvent ? (
          <div
            style={{
              marginTop: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 900 }}>
              <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} />
              Promote this event
              <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>
                (2 free/day, then 10 tokens)
              </span>
            </label>

            <div style={{ marginTop: 6, opacity: 0.72, fontSize: 12 }}>
              Available for public and private events.
            </div>
          </div>
        ) : null}

        {/* Hard warning when economy off + NON_HOT */}
        {economyEnabled === false && contentScope === "NO_HOT" ? (
          <div
            style={{
              marginTop: 6,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.10)",
              borderRadius: 12,
              padding: 10,
              fontWeight: 800,
            }}
          >
            Tickets are disabled in this phase. NO_HOT events cannot be created.
          </div>
        ) : null}

        <button
          onClick={handleSubmit}
          disabled={submitting || (economyEnabled === false && contentScope === "NO_HOT")}
          style={{
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: submitting ? "not-allowed" : "pointer",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            opacity: submitting || (economyEnabled === false && contentScope === "NO_HOT") ? 0.6 : 1,
          }}
        >
          {submitting ? "Creating..." : "Create Event"}
        </button>
        {submitErr ? (
          <div style={{ marginTop: 10, color: "#ffb3b3", fontWeight: 800 }}>
            {submitErr}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function scopeBtn(scope: Scope) {
  return {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    fontWeight: 900,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.14)",
    background: scope === "HOT" ? "rgba(255,80,120,0.10)" : "rgba(120,255,200,0.10)",
    color: "white",
  } as const;
}

const labelStyle = {
  fontWeight: 900,
  fontSize: 13,
  opacity: 0.9,
} as const;

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  outline: "none",
} as const;

const modeBtnStyle = {
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "white",
  background: "rgba(255,255,255,0.04)",
} as const;

const modeBtnActiveStyle = {
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.24)",
  opacity: 1,
} as const;

const modeBtnIdleStyle = {
  opacity: 0.82,
} as const;