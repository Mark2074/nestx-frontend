import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/nestxApi";

type AccessResponse = {
  canEnter: boolean;
  hasTicket?: boolean;
  reason?: string;
  authorizedScope?: "public" | "private";
  authorizedRoomId?: string | null;
};

type EventDetail = {
  id: string;
  _id?: string;
  title: string;
  status: string;
  ticketPriceTokens: number;
  contentScope?: "HOT" | "NO_HOT";
  coverImage?: string | null;
  creator?: { id?: string; _id?: string; displayName?: string; avatar?: string };
  startTime?: string;
  description?: string | null;
  maxSeats?: number | null;
  seatsSold?: number | null;
  seatsRemaining?: number | null;
  viewerCount?: number | null;
  ticketsSoldCount?: number | null;
  accessScope?: "public" | "private";
};

export default function LiveDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();

  const eventId = String(id || "").trim();

  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [eventNotFound, setEventNotFound] = useState(false);

  const [err, setErr] = useState<string>("");

  const [loadingBuy, setLoadingBuy] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [ticketMsg, setTicketMsg] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string>("");
  const [meId, setMeId] = useState<string>("");
  const [meAccountType, setMeAccountType] = useState<string>("");

  const prevStatusRef = useRef<string>("");

  // load meta from sessionStorage (Discover stores it, Promoted usually doesn't)
  useEffect(() => {
    if (!eventId) return;

    // reset to avoid stale meta between events
    setMeta(null);

    try {
      const raw = sessionStorage.getItem(`nx_live_meta_${eventId}`);
      if (raw) setMeta(JSON.parse(raw));
    } catch {}
  }, [eventId]);

  // persist meta so direct/open-from-promoted gets the same nice header later
  useEffect(() => {
    if (!eventId) return;
    if (!meta) return;
    try {
      sessionStorage.setItem(`nx_live_meta_${eventId}`, JSON.stringify(meta));
    } catch {}
  }, [eventId, meta]);

  async function loadAccess(scopeOverride?: "public" | "private") {
    if (!eventId) return;
    setLoadingAccess(true);
    try {
      const scopeToUse = scopeOverride || eventNativeScope;
      const res = await api.eventAccess(eventId, scopeToUse);
      setAccess(res as any);
      setErr("");
    } catch (e: any) {
      const code = String(
        e?.code || e?.data?.code || e?.response?.data?.code || ""
      ).trim();

      const payload =
        e?.data ||
        e?.response?.data ||
        null;

      if (code === "EVENT_NOT_LIVE" && payload) {
        setErr("");
        setAccess(payload as any);
        return;
      }

      setAccess(null);
      setErr(String(e?.message || "Failed to load access"));
    } finally {
      setLoadingAccess(false);
    }
  }

  async function loadEventDetail() {
    if (!eventId) return null;

    try {
      const ev = await api.eventGet(eventId);

      setEventNotFound(false);
      setEventDetail(ev as any);

      setMeta((prev: any) => {
        const next = { ...(prev || {}) };

        if ((ev as any)?.title) next.title = (ev as any).title;
        if ((ev as any)?.status) next.status = (ev as any).status;

        if ((ev as any)?.ticketPriceTokens != null) next.price = (ev as any).ticketPriceTokens;
        if ((ev as any)?.contentScope) next.scope = (ev as any).contentScope;

        if ((ev as any)?.coverImage) next.coverUrl = (ev as any).coverImage;

        if ((ev as any)?.creator?.displayName) next.creatorName = (ev as any).creator.displayName;
        if ((ev as any)?.creator?.avatar) next.avatarUrl = (ev as any).creator.avatar;

        if ((ev as any)?.startTime) next.when = (ev as any).startTime;

        return next;
      });

      return ev as any;
    } catch (e: any) {
      const code = String(
        e?.code ||
        e?.data?.code ||
        e?.response?.data?.code ||
        ""
      ).trim().toUpperCase();

      const status = Number(
        e?.status ||
        e?.response?.status ||
        e?.data?.status ||
        0
      );

      const isMissing =
        status === 404 ||
        code === "EVENT_NOT_FOUND" ||
        code === "NOT_FOUND";

      if (isMissing) {
        setEventNotFound(true);
        setEventDetail(null);
        setAccess(null);
        setErr("");
        setTicketMsg("");
        setMeta(null);

        try {
          sessionStorage.removeItem(`nx_live_meta_${eventId}`);
        } catch {}

        return null;
      }

      return null;
    }
  }

  async function loadMe() {
    try {
      const me = await api.meProfile();
      const id = String((me as any)?._id || (me as any)?.id || "").trim();
      const accountType = String((me as any)?.accountType || "").trim().toLowerCase();

      setMeId(id);
      setMeAccountType(accountType);
    } catch {
      setMeId("");
      setMeAccountType("");
    }
  }

  // initial load
  useEffect(() => {
    if (!eventId) return;

    let alive = true;

    setErr("");
    setTicketMsg("");
    setEventNotFound(false);

    (async () => {
      try {
        const ev: any = await loadEventDetail();
        if (!alive) return;

        const scopeFromEvent: "public" | "private" =
          String(ev?.accessScope || "").trim().toLowerCase() === "private"
            ? "private"
            : "public";

        await loadAccess(scopeFromEvent);
        if (!alive) return;

        await loadMe();
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const eventStatus = String(
    eventDetail?.status || meta?.status || ""
  )
    .trim()
    .toLowerCase();

  const isCancelledEvent = eventStatus === "cancelled";
  const isFinishedEvent = eventStatus === "finished";
  const isLiveEvent = eventStatus === "live";
  const isScheduledEvent = eventStatus === "scheduled";

  // periodic refresh (light)
  useEffect(() => {
    if (!eventId || eventNotFound) return;
    if (isCancelledEvent || isFinishedEvent) return;

    let alive = true;
    let running = false;

    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const ev: any = await loadEventDetail();
        if (!alive || !ev) return;

        const nextStatus = String(ev?.status || "").trim().toLowerCase();
        if (nextStatus === "cancelled" || nextStatus === "finished") {
          return;
        }

        const scopeFromEvent: "public" | "private" =
          String(ev?.accessScope || "").trim().toLowerCase() === "private"
            ? "private"
            : "public";

        await loadAccess(scopeFromEvent);
      } catch {
        // ignore
      } finally {
        running = false;
      }
    };

    const t = window.setInterval(() => {
      void tick();
    }, 5000);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, eventNotFound, isCancelledEvent, isFinishedEvent]);

  useEffect(() => {
    if (!eventStatus) return;

    const prev = prevStatusRef.current;

    if (prev === "scheduled" && eventStatus === "live") {
      setToastMsg("Event is now live.");
    }

    if (eventStatus === "finished") {
      setToastMsg("This event has ended.");
      setTicketMsg("");
    }

    if (eventStatus === "cancelled") {
      setToastMsg("");
      setTicketMsg("");
      setAccess(null);
      setErr("");
    }

    prevStatusRef.current = eventStatus;
  }, [eventStatus]);

  const denyReasonRaw =
    (access as any)?.reason ??
    (access as any)?.code ??
    (access as any)?.denyReason ??
    "";

  const denyReason = String(denyReasonRaw || "").toUpperCase();

  const priceTokens = Number(meta?.price ?? eventDetail?.ticketPriceTokens ?? 0);
  const isPaid = Number.isFinite(priceTokens) && priceTokens > 0;

  const eventStartIso = String(
    meta?.when ??
      (meta as any)?.startTime ??
      eventDetail?.startTime ??
      (eventDetail as any)?.data?.startTime ??
      ""
  ).trim();

  const eventStartMs = useMemo(() => {
    if (!eventStartIso) return NaN;
    const t = Date.parse(eventStartIso);
    return Number.isFinite(t) ? t : NaN;
  }, [eventStartIso]);

  const userTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  }, []);

  const startLocalLabel = useMemo(() => {
    if (!Number.isFinite(eventStartMs)) return "";
    try {
      // local time with timezone name
      const dt = new Date(eventStartMs);
      const s = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(dt);
      return s;
    } catch {
      return new Date(eventStartMs).toLocaleString();
    }
  }, [eventStartMs]);

  const startUtcLabel = useMemo(() => {
    if (!Number.isFinite(eventStartMs)) return "";
    const dt = new Date(eventStartMs);
    // UTC explicit
    return dt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }, [eventStartMs]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => {
      setToastMsg("");
    }, 4000);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const isBlocked = denyReason === "EVENT_BLOCKED";
  const isPrivateMissing = denyReason === "PRIVATE_ROOM_MISSING";
  const isNotLive = denyReason === "EVENT_NOT_LIVE";

  const isNoTicket =
    denyReason === "NO_TICKET" ||
    denyReason === "NO_TICKET_REQUIRED" ||
    denyReason === "NO_TICKET_PUBLIC" ||
    denyReason === "NO_TICKET_PRIVATE";

  const isSoldOut =
    denyReason === "SEATS_SOLD_OUT" ||
    denyReason === "SOLD_OUT";

  const isRoomFull =
    denyReason === "ROOM_FULL" ||
    denyReason === "EVENT_FULL";

  const creatorId = String(
    (eventDetail as any)?.creator?.id ||
    (eventDetail as any)?.creator?._id ||
    (eventDetail as any)?.creator ||
    (eventDetail as any)?.creatorId?._id ||
    (eventDetail as any)?.creatorId?.id ||
    (eventDetail as any)?.creatorId ||
    ""
  ).trim();

  const hostReady = !!meId && !!creatorId;

    const isHost = useMemo(() => {
      return hostReady && meId === creatorId;
    }, [hostReady, meId, creatorId]);
    
  const isAdmin = meAccountType === "admin";

  const eventNativeScope: "public" | "private" =
    String((eventDetail as any)?.accessScope || "").trim().toLowerCase() === "private"
      ? "private"
      : "public";

  const accessLabel = useMemo(() => {
    if (!access) return "";

    if (access.canEnter) {
      return access.authorizedScope === "private"
        ? "Private access granted"
        : "Access granted";
    }

    const reason = String(access.reason || "").toUpperCase();

    switch (reason) {
      case "EVENT_NOT_LIVE":
        return "This live has not started yet.";
      case "NO_TICKET":
      case "NO_TICKET_REQUIRED":
      case "NO_TICKET_PUBLIC":
      case "NO_TICKET_PRIVATE":
        return "Buy a ticket to access this event.";
      case "SEATS_SOLD_OUT":
      case "SOLD_OUT":
        return "Tickets are sold out.";
      case "ROOM_FULL":
        return "The room is full.";
      case "EVENT_BLOCKED":
        return "You cannot access this live.";
      case "PRIVATE_ROOM_MISSING":
        return "Private session not available.";
      case "EVENT_FINISHED":
        return "This live has ended.";
      default:
        return "Buy a ticket to access this event.";
    }
  }, [access]);

  const roomScopeToEnter: "public" | "private" =
    access?.authorizedScope === "private"
      ? "private"
      : access?.authorizedScope === "public"
      ? "public"
      : eventNativeScope;

  const hasTicketPurchased =
    !!access?.hasTicket;

  const userAccessLabel =
    isAdmin
      ? "ADMIN"
      : access?.authorizedScope === "private"
      ? "PRIVATE"
      : access?.authorizedScope === "public"
      ? "PUBLIC"
      : hasTicketPurchased
      ? "TICKET PURCHASED"
      : "NOT GRANTED";

  const canBuyTicket =
    !!access &&
    !isHost &&
    !isAdmin &&
    !hasTicketPurchased &&
    isPaid &&
    !isSoldOut &&
    !isRoomFull &&
    !isBlocked &&
    !isPrivateMissing &&
    !isCancelledEvent &&
    !isFinishedEvent &&
    (isScheduledEvent || isLiveEvent) &&
    (isNoTicket || isNotLive || denyReason === "");

  const buyTicketHint = isCancelledEvent
    ? "Event cancelled"
    : isFinishedEvent
    ? "Event ended"
    : isAdmin
    ? "Admin access does not require ticket"
    : isSoldOut
    ? "Sold out"
    : isRoomFull
    ? "Room is full"
    : hasTicketPurchased
    ? "Ticket already purchased"
    : !access
    ? "Checking access…"
    : access.canEnter
    ? "You can enter"
    : isNoTicket
    ? "Ticket required"
    : (isScheduledEvent || isLiveEvent)
    ? "Buy ticket to enter"
    : "Not available";

  const enterLiveLabel = isCancelledEvent
    ? "Event cancelled"
    : isFinishedEvent
    ? "Event ended"
    : isHost
    ? "Enter live"
    : !access
    ? "Checking access..."
    : access.canEnter
    ? "Enter live"
    : hasTicketPurchased
    ? "Waiting for host to go live"
    : "Enter live";

  async function onBuyTicket() {
    if (!eventId) return;
    if (!canBuyTicket) return;
    if (loadingBuy) return;
    if (isCancelledEvent || isFinishedEvent || (!isScheduledEvent && !isLiveEvent)) return;

    setLoadingBuy(true);
    setErr("");
    setTicketMsg("");
    setToastMsg("");

    try {
      await api.eventBuyTicket(eventId, eventNativeScope);

      setTicketMsg("Ticket purchased.");
      setAccess((prev: any) =>
        prev
          ? {
              ...prev,
              hasTicket: true,
              canEnter: true,
              reason: undefined,
              authorizedScope: eventNativeScope,
            }
          : {
              hasTicket: true,
              canEnter: true,
              authorizedScope: eventNativeScope,
            }
      );

      await loadEventDetail();
      await loadAccess(eventNativeScope);
    } catch (e: any) {
      setErr(String(e?.message || "Ticket purchase failed"));
    } finally {
      setLoadingBuy(false);
    }
  }

  function goBack() {
    nav("/app/live/discover");
  }

  function goRoom(scope: "public" | "private") {
    if (!eventId) return;
    nav(`/app/live/${eventId}/room?scope=${scope}`);
  }

  async function onCancelEvent() {
    if (!eventId) return;
    if (isCancelling) return;
    if (isCancelledEvent || isFinishedEvent) return;

    const ok = window.confirm("Cancel this event?");
    if (!ok) return;

    setIsCancelling(true);
    setErr("");
    setTicketMsg("");
    setToastMsg("");

    try {
      await api.eventCancel(eventId);
      await loadEventDetail();
      setAccess(null);
      setToastMsg("Event cancelled.");
    } catch (e: any) {
      setErr(String(e?.message || "Failed to cancel event"));
    } finally {
      setIsCancelling(false);
    }
  }

  if (eventNotFound) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            Live
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goBack} style={secondaryBtnStyle}>
              Back
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
            This live is no longer available.
          </div>

          <div style={{ opacity: 0.82, lineHeight: 1.5 }}>
            The event may have been deleted, cancelled, or is no longer accessible.
          </div>
        </div>
      </div>
    );
  }

  if (isCancelledEvent) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            {meta?.title ? meta.title : "Live"}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goBack} style={secondaryBtnStyle}>
              Back
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
            This event has been cancelled.
          </div>

          <div style={{ opacity: 0.82, lineHeight: 1.5 }}>
            Access is no longer available and ticket actions are closed.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 12 }}>
      {toastMsg ? (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            border: "1px solid rgba(120,255,200,0.22)",
            background: "rgba(120,255,200,0.10)",
            color: "rgba(180,255,220,0.98)",
          }}
        >
          {toastMsg}
        </div>
      ) : null}
      {/* Top actions (fuori card) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900 }}>
          {meta?.title ? meta.title : "Live"}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={goBack} style={secondaryBtnStyle}>
            Back
          </button>

          <button
            onClick={() => void loadAccess(eventNativeScope)}
            style={secondaryBtnStyle}
            disabled={loadingAccess || isCancelledEvent || isFinishedEvent}
          >
            {loadingAccess ? "Checking..." : "Refresh access"}
          </button>

          {isHost && !isCancelledEvent && !isFinishedEvent ? (
            <button
              onClick={onCancelEvent}
              disabled={isCancelling}
              style={{
                ...secondaryBtnStyle,
                border: "1px solid rgba(239,68,68,0.45)",
                color: "salmon",
                opacity: isCancelling ? 0.55 : 0.92,
                cursor: isCancelling ? "not-allowed" : "pointer",
              }}
            >
              {isCancelling ? "Cancelling..." : "Cancel event"}
            </button>
          ) : null}
        </div>
      </div>

      {/* ONE unified card */}
      <div style={cardStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr",
            gap: 14,
            alignItems: "start",
          }}
        >
          {/* LEFT: avatar square */}
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: 16,
              overflow: "hidden",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 34,
              letterSpacing: 0.5,
              userSelect: "none",
            }}
          >
            {meta?.avatarUrl ? (
              <img
                src={meta.avatarUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>
                {String(meta?.creatorName || "U")
                  .trim()
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
            )}
          </div>

          {/* RIGHT: stacked info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* creator username (clickable) */}
            <div
              onClick={() => {
                if (creatorId) nav(`/app/profile/${creatorId}`);
              }}
              style={{
                fontWeight: 900,
                opacity: 0.9,
                cursor: creatorId ? "pointer" : "default",
                textDecoration: creatorId ? "underline" : "none",
              }}
            >
              {meta?.creatorName || "Unknown creator"}
            </div>

            {/* title */}
            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.15 }}>
              {meta?.title || eventDetail?.title || "Live"}
            </div>

            {/* description */}
            <div style={{ opacity: 0.9, lineHeight: 1.5 }}>
              {eventDetail?.description ? eventDetail.description : "No description."}
            </div>

            {/* when */}
            {eventStartIso ? (
              <div style={{ opacity: 0.86, lineHeight: 1.45 }}>
                <div>
                  <span style={{ fontWeight: 900 }}>Starts:</span>{" "}
                  <span>{startLocalLabel || eventStartIso}</span>
                  {userTz ? (
                    <span style={{ opacity: 0.7 }}>{" "}({userTz})</span>
                  ) : null}
                </div>

                <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>
                  <div>Event time (UTC): {startUtcLabel || "—"}</div>
                  <div>Times are shown in your local timezone. Server time is UTC.</div>
                </div>
              </div>
            ) : null}

            {/* content + access */}
            <div style={{ opacity: 0.82 }}>
              <span style={{ fontWeight: 900 }}>Content:</span>{" "}
              <span>{meta?.scope || eventDetail?.contentScope || "—"}</span>
            </div>

            <div style={{ opacity: 0.82 }}>
              <span style={{ fontWeight: 900 }}>Access type:</span>{" "}
              <span>{eventNativeScope.toUpperCase()}</span>
            </div>

            <div style={{ opacity: 0.82 }}>
              <span style={{ fontWeight: 900 }}>Your access:</span>{" "}
              <span>{userAccessLabel}</span>
            </div>

            <div style={{ opacity: 0.82 }}>
              <span style={{ fontWeight: 900 }}>Status:</span>{" "}
              <span>{String(eventDetail?.status || meta?.status || "—").toUpperCase()}</span>
            </div>

            <div style={{ opacity: 0.82 }}>
              <span style={{ fontWeight: 900 }}>Viewers:</span>{" "}
              <span>{Number(eventDetail?.viewerCount ?? 0)}</span>
            </div>

            {/* seats */}
            {(() => {
              const max = Number(
                (eventDetail as any)?.maxSeats ??
                  (eventDetail as any)?.data?.maxSeats ??
                  0
              );
              const sold = Number(
                (eventDetail as any)?.ticketsSoldCount ??
                  (eventDetail as any)?.data?.ticketsSoldCount ??
                  0
              );
              const remaining =
                (eventDetail as any)?.seatsRemaining ??
                (eventDetail as any)?.data?.seatsRemaining ??
                (Number.isFinite(max) && max > 0
                  ? Math.max(0, max - (Number.isFinite(sold) ? sold : 0))
                  : null);

              if (remaining == null && !(Number.isFinite(max) && max > 0)) return null;

              return (
                <div style={{ opacity: 0.82 }}>
                  <div>
                    <span style={{ fontWeight: 900 }}>Tickets remaining:</span>{" "}
                    <span>
                      {remaining == null ? "—" : Number(remaining)}
                    </span>
                  </div>
                  {Number.isFinite(max) && max > 0 ? (
                    <div style={{ marginTop: 2 }}>
                      <span style={{ fontWeight: 900 }}>Max tickets:</span>{" "}
                      <span>{max}</span>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {/* price + Buy ticket inline */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                paddingTop: 6,
              }}
            >
              <div style={{ opacity: 0.9 }}>
                <span style={{ fontWeight: 900 }}>Price:</span>{" "}
                <span>
                  {priceTokens === 0 ? "FREE" : `${priceTokens} tokens`}
                </span>
              </div>

              {!isHost && !isAdmin && isPaid && !isCancelledEvent && !isFinishedEvent ? (
                hasTicketPurchased ? (
                  <div
                    title="Ticket already purchased"
                    style={{
                      ...secondaryBtnStyle,
                      opacity: 0.9,
                      cursor: "default",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Ticket purchased
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onBuyTicket}
                    disabled={!canBuyTicket || loadingBuy}
                    title={buyTicketHint}
                    style={{
                      ...secondaryBtnStyle,
                      opacity: canBuyTicket && !loadingBuy ? 1 : 0.55,
                      cursor: canBuyTicket && !loadingBuy ? "pointer" : "not-allowed",
                    }}
                  >
                    {loadingBuy ? "Buying..." : "Buy ticket"}
                  </button>
                )
              ) : null}
            </div>

            {/* divider */}
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.10)",
                marginTop: 2,
                marginBottom: 2,
              }}
            />

            {/* Enter live + access label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {!hostReady ? (
                  <div style={{ opacity: 0.85 }}>Loading…</div>
                ) : isCancelledEvent ? (
                  <div
                    style={{
                      fontWeight: 900,
                      color: "salmon",
                    }}
                  >
                    This event has been cancelled.
                  </div>
                ) : isFinishedEvent ? (
                  <div
                    style={{
                      fontWeight: 900,
                      opacity: 0.8,
                    }}
                  >
                    This live has ended.
                  </div>
                ) : !access ? (
                  <div style={{ opacity: 0.85 }}>Checking access…</div>
                ) : isHost || isAdmin || access.canEnter || hasTicketPurchased ? (
                  <>
                    <button
                      onClick={() => goRoom(roomScopeToEnter)}
                      disabled={!isHost && !isAdmin && (!access.canEnter || !isLiveEvent)}
                      style={{
                        ...primaryBtnStyle,
                        opacity: !isHost && !isAdmin && (!access.canEnter || !isLiveEvent) ? 0.55 : 1,
                        cursor: !isHost && !isAdmin && (!access.canEnter || !isLiveEvent) ? "not-allowed" : "pointer",
                      }}
                    >
                      {enterLiveLabel}
                    </button>
                    <span style={{ opacity: 0.85, fontSize: 13 }}>
                      {accessLabel}
                    </span>
                  </>
                ) : (
                  <div
                    style={{
                      fontWeight: 900,
                      opacity: access?.reason === "EVENT_NOT_LIVE" ? 0.75 : 1,
                      color: access?.reason === "EVENT_NOT_LIVE" ? "rgba(255,255,255,0.75)" : "salmon",
                    }}
                  >
                    {accessLabel || "Access not available."}
                  </div>
                )}
              </div>
            </div>

            {/* messages */}
            {err ? (
              <div style={{ marginTop: 6, color: "salmon", fontWeight: 900 }}>
                {err}
              </div>
            ) : null}

            {ticketMsg ? (
              <div
                style={{
                  marginTop: 6,
                  color: "rgba(120,255,200,0.95)",
                  fontWeight: 900,
                }}
              >
                {ticketMsg}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 16,
  padding: 16,
} as const;

const primaryBtnStyle = {
  padding: "8px 12px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
} as const;

const secondaryBtnStyle = {
  padding: "8px 12px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
  opacity: 0.92,
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.14)",
} as const;
