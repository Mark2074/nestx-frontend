import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type LiveTokenResponse } from "../api/nestxApi";
import RealtimeMeetingEmbed from "../components/live/RealtimeMeetingEmbed";

type LiveScope = "public" | "private";

type EventDetail = {
  id: string;
  _id?: string;
  title?: string;
  status?: string;
  ticketPriceTokens?: number;
  accessScope?: LiveScope;
  contentScope?: "HOT" | "NO_HOT";
  coverImage?: string | null;
  startTime?: string;
  creator?: {
    id?: string;
    _id?: string;
    displayName?: string;
    avatar?: string;
  };
  privateSession?: {
    roomId?: string | null;
    status?: string;
  } | null;
  live?: any;
};

function normalizeEventDetail(input: any): EventDetail {
  return {
    ...input,
    privateSession: input?.privateSession ?? input?.live?.privateSession ?? null,
  };
}

function getCreatorId(ev: EventDetail | null): string {
  return String(ev?.creator?.id || ev?.creator?._id || "").trim();
}

function getEventStatus(ev: EventDetail | null): string {
  return String(ev?.status || "scheduled").trim().toLowerCase();
}

function getEventBaseScope(ev: EventDetail | null): LiveScope {
  return ev?.accessScope === "private" ? "private" : "public";
}

type HostConsoleState =
  | "BOOTING"
  | "INITIALIZING"
  | "CONNECTING"
  | "READY"
  | "GOING_LIVE"
  | "LIVE"
  | "FINISHING"
  | "ERROR";

export default function HostLiveConsolePage() {
  const nav = useNavigate();
  const { id } = useParams();
  const eventId = String(id || "").trim();

  const [meId, setMeId] = useState("");
  const [meAccountType, setMeAccountType] = useState("");
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);

  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [loadingGoLive, setLoadingGoLive] = useState(false);
  const [loadingFinish, setLoadingFinish] = useState(false);

  const [err, setErr] = useState("");
  const [liveToken, setLiveToken] = useState<LiveTokenResponse | null>(null);
  const [loadingLiveToken, setLoadingLiveToken] = useState(false);
  const [liveTokenErr, setLiveTokenErr] = useState("");

  const [hostMeetingState, setHostMeetingState] = useState<
    "idle" | "setup" | "waiting" | "joined" | "ended"
  >("idle");

  const liveTokenEventIdRef = useRef("");
  const liveTokenScopeRef = useRef<LiveScope | null>(null);
  const liveTokenRoleRef = useRef<"host" | "viewer" | null>(null);

  const creatorId = useMemo(() => getCreatorId(eventDetail), [eventDetail]);
  const isHost = useMemo(() => !!meId && !!creatorId && meId === creatorId, [meId, creatorId]);
  const isAdmin = meAccountType === "admin";

  const eventStatus = getEventStatus(eventDetail);
  const isLive = eventStatus === "live";
  const isFinished = eventStatus === "finished";
  const isCancelled = eventStatus === "cancelled";

  const eventBaseScope = getEventBaseScope(eventDetail);

  const consoleState: HostConsoleState = useMemo(() => {
    if (err || liveTokenErr) return "ERROR";
    if (loadingFinish) return "FINISHING";
    if (loadingGoLive) return "GOING_LIVE";
    if (isLive) return "LIVE";
    if (loadingBootstrap) return "BOOTING";
    if (loadingLiveToken) return "INITIALIZING";
    if (!liveToken?.authToken) return "INITIALIZING";
    if (hostMeetingState === "joined") return "READY";
    return "CONNECTING";
  }, [err, hostMeetingState, isLive, liveToken?.authToken, liveTokenErr, loadingBootstrap, loadingFinish, loadingGoLive, loadingLiveToken]);

  const loadEvent = useCallback(async () => {
    if (!eventId) return null;
    try {
      const raw = await api.eventGet(eventId);
      const ev = normalizeEventDetail(raw);
      setEventDetail(ev);
      return ev;
    } catch (e: any) {
      setErr(String(e?.message || "Failed to load event"));
      return null;
    }
  }, [eventId]);

  const syncHostRealtimeState = useCallback(
    async (state: "setup" | "joined" | "broadcasting" | "ended") => {
      if (!eventId) return;
      if (!isHost) return;

      try {
        await api.liveHostRealtimeState(eventId, {
          scope: eventBaseScope,
          state,
        });
      } catch {
        // ignore
      }
    },
    [eventBaseScope, eventId, isHost]
  );

  useEffect(() => {
    if (!eventId) return;

    let alive = true;

    const run = async () => {
      setLoadingBootstrap(true);
      setErr("");

      try {
        const [me, rawEvent] = await Promise.all([
          api.meProfile(),
          api.eventGet(eventId),
        ]);

        if (!alive) return;

        setMeId(String((me as any)?._id || (me as any)?.id || "").trim());
        setMeAccountType(String((me as any)?.accountType || "").trim().toLowerCase());

        const ev = normalizeEventDetail(rawEvent);
        setEventDetail(ev);

        if (String(ev?.status || "").trim().toLowerCase() === "live") {
          nav(`/app/live/${eventId}/room?scope=${getEventBaseScope(ev)}`, { replace: true });
          return;
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || "Failed to initialize host console"));
      } finally {
        if (alive) setLoadingBootstrap(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [eventId, nav]);

  useEffect(() => {
    if (!eventId) return;
    if (!eventDetail) return;
    if (!isHost) return;
    if (isLive || isFinished || isCancelled) return;

    void syncHostRealtimeState("setup");
  }, [eventDetail, eventId, isCancelled, isFinished, isHost, isLive, syncHostRealtimeState]);

  useEffect(() => {
    if (!eventId || !eventDetail || !isHost) return;
    if (isFinished || isCancelled) return;

    const tokenScope = getEventBaseScope(eventDetail);
    const desiredRole: "host" = "host";

    const canReuseCurrentToken =
      !!liveToken?.authToken &&
      liveTokenEventIdRef.current === eventId &&
      liveTokenScopeRef.current === tokenScope &&
      liveTokenRoleRef.current === desiredRole &&
      String(liveToken?.role || "").trim().toLowerCase() === desiredRole;

    if (canReuseCurrentToken) {
      setLoadingLiveToken(false);
      setLiveTokenErr("");
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoadingLiveToken(true);
      setLiveTokenErr("");

      try {
        const tokenRes = await api.liveGetToken(eventId, tokenScope);
        if (cancelled) return;

        setLiveToken(tokenRes);
        liveTokenEventIdRef.current = eventId;
        liveTokenScopeRef.current = tokenScope;
        liveTokenRoleRef.current = desiredRole;
      } catch (e: any) {
        if (cancelled) return;
        setLiveToken(null);
        liveTokenEventIdRef.current = "";
        liveTokenScopeRef.current = null;
        liveTokenRoleRef.current = null;
        setLiveTokenErr(String(e?.message || "Failed to initialize live preview"));
      } finally {
        if (!cancelled) setLoadingLiveToken(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [eventDetail, eventId, isCancelled, isFinished, isHost, liveToken]);

  async function handleGoLive() {
    if (!eventId) return;
    if (!isHost) return;
    if (loadingGoLive) return;
    if (isFinished || isCancelled) return;

    setLoadingGoLive(true);
    setErr("");

    try {
      await api.eventGoLive(eventId);
      await syncHostRealtimeState("broadcasting");
      const latest = await loadEvent();
      const nextScope = getEventBaseScope(latest);
      nav(`/app/live/${eventId}/room?scope=${nextScope}`, { replace: true });
    } catch (e: any) {
      setErr(String(e?.message || "Failed to go live"));
    } finally {
      setLoadingGoLive(false);
    }
  }

  async function handleCancelEvent() {
    if (!eventId) return;
    if (!isHost) return;
    if (loadingFinish) return;

    const ok = window.confirm("Cancel this event?");
    if (!ok) return;

    setLoadingFinish(true);
    setErr("");

    try {
      await syncHostRealtimeState("ended");
      await api.eventCancel(eventId);
      nav("/app/live", { replace: true });
    } catch (e: any) {
      setErr(String(e?.message || "Failed to cancel event"));
    } finally {
      setLoadingFinish(false);
    }
  }

  function goBack() {
    nav(`/app/live/${eventId}`);
  }

  if (!eventId) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 12 }}>
        <div style={{ color: "salmon", fontWeight: 900 }}>Invalid event id</div>
      </div>
    );
  }

  if (!loadingBootstrap && !isHost && !isAdmin) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 12 }}>
        <div style={{ color: "salmon", fontWeight: 900 }}>Access denied</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            {eventDetail?.title || "Host console"}
          </div>

          <div
            style={{
              opacity: 0.85,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={pillStyle}>{(eventDetail?.contentScope || "—").toString()}</span>
            <span style={pillStyle}>{eventBaseScope.toUpperCase()}</span>
            <span style={pillStyle}>{consoleState}</span>
            <span style={pillStyle}>{hostMeetingState}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={goBack} style={secondaryBtnStyle}>
            Back
          </button>
          <button
            onClick={() => {
              void loadEvent();
            }}
            style={secondaryBtnStyle}
          >
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <div style={{ marginTop: 10, color: "salmon", fontWeight: 900 }}>{err}</div>
      ) : null}

      {liveTokenErr ? (
        <div style={{ marginTop: 10, color: "salmon", fontWeight: 900 }}>{liveTokenErr}</div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Pre-live host console</div>

        <div
          style={{
            height: 540,
            minHeight: 540,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 12,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {loadingLiveToken ? (
            <div style={{ opacity: 0.9 }}>Initializing host preview…</div>
          ) : liveTokenErr ? (
            <div style={{ opacity: 0.95, color: "salmon", fontWeight: 900 }}>
              {liveTokenErr}
            </div>
          ) : liveToken?.authToken ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "stretch",
                justifyContent: "center",
                padding: 0,
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <RealtimeMeetingEmbed
                  key={`${eventId}:host-console:${eventBaseScope}`}
                  authToken={liveToken.authToken}
                  isHost={true}
                  showSetupScreen={true}
                  shouldStartBroadcast={false}
                  onHostMeetingStateChange={(state) => {
                    setHostMeetingState(state);
                  }}
                  onHostRealtimeStateSync={(state) => {
                    void syncHostRealtimeState(state);
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ opacity: 0.9 }}>Waiting for host preview…</div>
          )}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ opacity: 0.86, lineHeight: 1.45 }}>
            Configure camera, microphone and speakers, check preview, then go live.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => void handleGoLive()}
              disabled={
                loadingGoLive ||
                loadingFinish ||
                !liveToken?.authToken ||
                !(hostMeetingState === "joined" || hostMeetingState === "setup" || hostMeetingState === "waiting")
              }
              style={primaryBtnStyle}
            >
              {loadingGoLive ? "Starting..." : "Go live"}
            </button>

            <button
              onClick={() => void handleCancelEvent()}
              disabled={loadingGoLive || loadingFinish}
              style={{
                ...secondaryBtnStyle,
                borderColor: "rgba(255,100,120,0.35)",
                color: "salmon",
              }}
            >
              {loadingFinish ? "Cancelling..." : "Cancel event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const pillStyle = {
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
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