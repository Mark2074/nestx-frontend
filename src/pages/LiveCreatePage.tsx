import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, mapApiErrorMessage, getApiRetryAfterMs, formatRetryAfterLabel } from "../api/nestxApi";
import { EVENT_CATEGORY_OPTIONS } from "../utils/eventCategories";

// BE expects: HOT | NO_HOT
type Scope = "HOT" | "NO_HOT";

const EVENT_CATEGORIES = EVENT_CATEGORY_OPTIONS;

export default function LiveCreatePage() {
  const nav = useNavigate();

  const [economyEnabled, setEconomyEnabled] = useState<boolean | null>(null);
  const liveEnabled = true;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [accessScope, setAccessScope] = useState<"public" | "private">("public");

  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [ticketPriceTokens, setTicketPriceTokens] = useState<number | "">("");

  const [maxSeats, setMaxSeats] = useState<number | "">("");

  // ADV (event-banner) from Live setup only
  const [promote, setPromote] = useState(false);

  const isHot = category === "NSFW";
  const isNoHot = !isHot;
  const contentScope: Scope = isHot ? "HOT" : "NO_HOT";

  const effectiveAccessScope: "public" | "private" =
    isNoHot ? "private" : accessScope;

  const isPrivateModel = isHot && effectiveAccessScope === "private";
  const shouldSendTicketFields = isNoHot || isPrivateModel;
  const showTicketFields = shouldSendTicketFields;
  const canPromoteEvent = liveEnabled;

  const interactionMode: "broadcast" | "interactive" = "broadcast";

  const isPaidModel = shouldSendTicketFields;

  let blockingMessage = "";
  if (!liveEnabled) {
    blockingMessage = "Live creation is currently disabled by NestX.";
  } else if (economyEnabled === false && isPaidModel) {
    blockingMessage = "Tickets are disabled in this phase.";
  }

  const canCreateEvent = !blockingMessage;

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
    void loadEconomyFlag();
  }, []);

  function handleCategoryChange(nextCategory: string) {
    const nextIsHot = nextCategory === "NSFW";
    const currentIsHot = isHot;

    setCategory(nextCategory);
    if (nextIsHot === currentIsHot) return;

    setAccessScope("public");
    setTicketPriceTokens("");
    setMaxSeats("");
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

    const safeCategory = String(category || "").trim();

    if (!safeCategory) {
      throw new Error("Select a category for this event.");
    }

    if (shouldSendTicketFields) {
      const price = Number(ticketPriceTokens);
      const seats = Number(maxSeats);

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Ticket price must be greater than 0.");
      }

      if (!Number.isFinite(seats) || seats <= 0) {
        throw new Error("Max seats must be greater than 0.");
      }
    }

    const res = await api.createEvent({
      title: title.trim(),
      description: description.trim(),
      category: safeCategory,
      startTime: effectiveStartTime,
      durationMinutes: effectiveDuration,
      ticketPriceTokens: shouldSendTicketFields ? Number(ticketPriceTokens) : 0,
      maxSeats: shouldSendTicketFields ? Number(maxSeats) : null,
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

    setSubmitErr("");

    if (!canCreateEvent) {
      setSubmitErr(blockingMessage);
      return;
    }

    setSubmitting(true);

    try {
      let shouldPromote = promote;

      if (shouldPromote) {
        const precheck: any = await api.advPrecheckCampaign({
          promote: true,
          targetType: "event",
          startTime: startTime || null,
        });

        const advCheck = precheck?.data ?? precheck;

        if (advCheck?.paidRequired === true) {
          const price = Number(advCheck?.priceTokens || 10);
          const ok = window.confirm(`This promoted item costs ${price} tokens. Continue?`);

          if (!ok) {
            return;
          }
        }

        if (advCheck?.applicable === false || advCheck?.requiresConfirmation === true) {
          const ok = window.confirm(
            "Promotion is not available for this event.\nCreate the event without promotion?"
          );

          if (!ok) {
            return;
          }

          shouldPromote = false;
          setPromote(false);
        }
      }

      const { eventId } = await createEventOnce();

      if (!shouldPromote) {
        nav("/app/live/discover");
        return;
      }

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
            nav("/app/live/discover");
            return;
          }

          await createAdvForEvent(eventId, true);
          nav("/app/live/discover");
          return;
        }

        if (
          code === "ADV_TOO_EARLY" ||
          code === "ADV_EVENT_STARTED" ||
          code === "ADV_PAID_DISABLED"
        ) {
          const ok = window.confirm(
            "Promotion is not available for this event.\nCreate the event without promotion?"
          );

          if (ok) {
            nav("/app/live/discover");
            return;
          }

          return;
        }

        if (code === "INSUFFICIENT_TOKENS") {
          alert("Not enough tokens to promote this event.");
          nav("/app/live/discover");
          return;
        }

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

  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      <button
        onClick={() => nav("/app/live/discover")}
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
        <h2 style={{ margin: 0 }}>Create Event</h2>

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

        <label style={labelStyle}>Category</label>
        <select
          style={inputStyle}
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          required
        >
          <option value="">Select category</option>
          {EVENT_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

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

        {isHot ? (
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
                Public
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccessScope("private");
                }}
                style={{
                  ...modeBtnStyle,
                  ...(accessScope === "private" ? modeBtnActiveStyle : modeBtnIdleStyle),
                }}
              >
                Private
              </button>
            </div>
        </div>
        ) : null}

        {showTicketFields ? (
          <>
            <label style={labelStyle}>Ticket price (tokens)</label>
            <input
              style={{
                ...inputStyle,
                opacity: economyEnabled === false ? 0.6 : 1,
              }}
              type="number"
              value={ticketPriceTokens}
              onChange={(e) => setTicketPriceTokens(e.target.value === "" ? "" : Number(e.target.value))}
              min={1}
              disabled={economyEnabled === false}
              required
            />

            <label style={labelStyle}>Max seats</label>
            <input
              style={{
                ...inputStyle,
                opacity: economyEnabled === false ? 0.6 : 1,
              }}
              type="number"
              value={maxSeats}
              onChange={(e) => setMaxSeats(e.target.value === "" ? "" : Number(e.target.value))}
              min={1}
              disabled={economyEnabled === false}
              required
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
        {!canCreateEvent ? (
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
            {blockingMessage}
          </div>
        ) : null}

        <button
          onClick={handleSubmit}
          disabled={submitting || !canCreateEvent}
          style={{
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: submitting || !canCreateEvent ? "not-allowed" : "pointer",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            opacity: submitting || !canCreateEvent ? 0.6 : 1,
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
