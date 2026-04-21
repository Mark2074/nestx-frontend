import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/nestxApi";

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

type HostConsoleState =
  | "BOOTING"
  | "READY"
  | "GOING_LIVE"
  | "LIVE"
  | "LIVE_RECOVERY"
  | "FINISHING"
  | "ERROR";

type HostConsoleStep = "DEVICE_SETUP" | "PRE_GO_LIVE" | "LIVE_RECOVERY" | "LIVE_RUNNING";

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

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;

  const p2 = (n: number) => String(n).padStart(2, "0");

  if (hh > 0) return `${p2(hh)}:${p2(mm)}:${p2(ss)}`;
  return `${p2(mm)}:${p2(ss)}`;
}

function formatCountdownTo(targetIso: string | null): string {
  if (!targetIso) return "00:00";

  const targetMs = new Date(targetIso).getTime();
  if (!Number.isFinite(targetMs)) return "00:00";

  const diff = Math.max(0, targetMs - Date.now());
  return formatDuration(diff);
}

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
  const [previewErr] = useState("");

  const [step, setStep] = useState<HostConsoleStep>("DEVICE_SETUP");
  const [providerDurationMs] = useState(0);

  const [, setGraceTick] = useState(0);
  const [hostDisconnectState, setHostDisconnectState] = useState("offline");
  const [hostGraceActive, setHostGraceActive] = useState(false);
  const [hostGraceExpiresAt, setHostGraceExpiresAt] = useState<string | null>(null);

  const stepStorageKey = `nx_host_console_step_${eventId}`;
  const hostLiveLockStorageKey = "nx_host_live_lock";

  const runtimeScopeRef = useRef<LiveScope | null>(null);

  const creatorId = useMemo(() => getCreatorId(eventDetail), [eventDetail]);
  const isHost = useMemo(() => !!meId && !!creatorId && meId === creatorId, [meId, creatorId]);
  const isAdmin = meAccountType === "admin";

  const eventStatus = getEventStatus(eventDetail);
  const isLive = eventStatus === "live";
  const isFinished = eventStatus === "finished";
  const isCancelled = eventStatus === "cancelled";

  const eventBaseScope = getEventBaseScope(eventDetail);

  const emitHostLiveChatState = useCallback(
    (overrides?: Partial<{
      entered: boolean;
      joinedPresence: boolean;
      authorizedScope: LiveScope | null;
      authorizedRoomId: string;
      shouldPausePublic: boolean;
      canWriteChat: boolean;
      roomBlockCode: "" | "ROOM_FULL";
    }>) => {
      try {
        const authorizedScope =
          overrides?.authorizedScope !== undefined
            ? overrides.authorizedScope
            : eventBaseScope;

        const authorizedRoomId =
          overrides?.authorizedRoomId !== undefined
            ? overrides.authorizedRoomId
            : (
                eventBaseScope === "private"
                  ? String(eventDetail?.privateSession?.roomId || "")
                  : String(eventDetail?.live?.roomId || eventDetail?._id || "")
              );

        window.dispatchEvent(
          new CustomEvent("nx:livechat:state", {
            detail: {
              eventId,
              entered: overrides?.entered ?? true,
              joinedPresence: overrides?.joinedPresence ?? true,
              authorizedScope,
              authorizedRoomId,
              shouldPausePublic: overrides?.shouldPausePublic ?? false,
              canWriteChat: overrides?.canWriteChat ?? true,
              canWriteChatReason: "HOST",
              roomBlockCode: overrides?.roomBlockCode ?? "",
            },
          })
        );
      } catch {
        // ignore
      }
    },
    [eventBaseScope, eventDetail, eventId]
  );

  const consoleState: HostConsoleState = useMemo(() => {
    if (err || previewErr) return "ERROR";
    if (loadingFinish) return "FINISHING";
    if (loadingGoLive) return "GOING_LIVE";
    if (step === "LIVE_RECOVERY") return "LIVE_RECOVERY";
    if (isLive) return "LIVE";
    if (loadingBootstrap) return "BOOTING";
    return "READY";
  }, [
    err,
    isLive,
    previewErr,
    loadingBootstrap,
    loadingFinish,
    loadingGoLive,
    step,
  ]);

  const setHostLiveLock = useCallback(
    (active: boolean) => {
      try {
        if (active) {
          sessionStorage.setItem(
            hostLiveLockStorageKey,
            JSON.stringify({
              active: true,
              eventId,
              ts: Date.now(),
            })
          );
        } else {
          sessionStorage.removeItem(hostLiveLockStorageKey);
        }
      } catch {
        // ignore
      }

      try {
        window.dispatchEvent(
          new CustomEvent("nx:live:host-active", {
            detail: { active, eventId },
          })
        );
      } catch {
        // ignore
      }
    },
    [eventId, hostLiveLockStorageKey]
  );

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

  const loadStatus = useCallback(
    async (scope: LiveScope) => {
      if (!eventId) return;

      try {
        const res: any = await api.liveStatus(eventId, scope);

        setHostDisconnectState(
          String(res?.hostDisconnectState || "offline").trim().toLowerCase()
        );
        setHostGraceActive(Boolean(res?.hostGraceActive));
        setHostGraceExpiresAt(
          res?.hostGraceExpiresAt ? String(res.hostGraceExpiresAt) : null
        );
      } catch {
        // ignore
      }
    },
    [eventId]
  );

  useEffect(() => {
    if (!eventId) return;

    try {
      const saved = sessionStorage.getItem(stepStorageKey);
      if (
        saved === "DEVICE_SETUP" ||
        saved === "PRE_GO_LIVE" ||
        saved === "LIVE_RECOVERY" ||
        saved === "LIVE_RUNNING"
      ) {
        setStep(saved);
      }
    } catch {
      // ignore
    }
  }, [eventId, stepStorageKey]);

  useEffect(() => {
    if (!eventId) return;

    try {
      sessionStorage.setItem(stepStorageKey, step);
    } catch {
      // ignore
    }
  }, [eventId, step, stepStorageKey]);

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
          const baseScope = getEventBaseScope(ev);
          runtimeScopeRef.current = baseScope;
          setStep("LIVE_RECOVERY");
          await loadStatus(baseScope);
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
  }, [eventId, loadStatus]);

  useEffect(() => {
    if (!eventId) return;
    if (!isHost) return;
    if (!eventDetail) return;
    if (isFinished || isCancelled) return;

    emitHostLiveChatState({
      entered: true,
      joinedPresence: true,
      authorizedScope: eventBaseScope,
      authorizedRoomId:
        eventBaseScope === "private"
          ? String(eventDetail?.privateSession?.roomId || "")
          : String(eventDetail?.live?.roomId || eventDetail?._id || ""),
      shouldPausePublic: false,
      canWriteChat: true,
      roomBlockCode: "",
    });
  }, [
    emitHostLiveChatState,
    eventBaseScope,
    eventDetail,
    eventId,
    isCancelled,
    isFinished,
    isHost,
  ]);

  useEffect(() => {
    if (!eventId) return;
    if (!isHost) return;
    if (isFinished || isCancelled) return;
    if (step !== "LIVE_RUNNING") return;

    const t = window.setInterval(async () => {
      const latest = await loadEvent();
      const latestStatus = String(latest?.status || "").trim().toLowerCase();

      if (latestStatus === "finished" || latestStatus === "cancelled") {
        try {
          sessionStorage.removeItem(stepStorageKey);
        } catch {}
        nav("/app/live", { replace: true });
      }
    }, 5000);

    return () => window.clearInterval(t);
  }, [eventId, isCancelled, isFinished, isHost, loadEvent, nav, step, stepStorageKey]);

  useEffect(() => {
    if (!eventId) return;
    if (!isHost) return;

    const shouldLock = step === "LIVE_RUNNING" && !isFinished && !isCancelled;
    setHostLiveLock(shouldLock);

    return () => {
      setHostLiveLock(false);
    };
  }, [eventId, isCancelled, isFinished, isHost, setHostLiveLock, step]);

  useEffect(() => {
    if (!eventId) return;
    if (!isHost) return;
    if (isFinished || isCancelled) return;
    if (step !== "PRE_GO_LIVE" && step !== "LIVE_RECOVERY" && step !== "LIVE_RUNNING") return;

    const t = window.setInterval(async () => {
      try {
        const scope: LiveScope =
          runtimeScopeRef.current ||
          eventBaseScope;

        await api.liveHostPing(eventId, scope);
      } catch {
        // ignore
      }
    }, 5000);

    return () => window.clearInterval(t);
  }, [eventBaseScope, eventId, isCancelled, isFinished, isHost, step]);

  useEffect(() => {
    if (!eventId) return;

    return () => {
      try {
        window.dispatchEvent(
          new CustomEvent("nx:livechat:state", {
            detail: {
              eventId,
              entered: false,
              joinedPresence: false,
              authorizedScope: null,
              authorizedRoomId: "",
              shouldPausePublic: false,
              canWriteChat: false,
              canWriteChatReason: "",
              roomBlockCode: "",
            },
          })
        );
      } catch {
        // ignore
      }
    };
  }, [eventId]);

  useEffect(() => {
    if (!hostGraceActive || !hostGraceExpiresAt) return;

    const t = window.setInterval(() => {
      setGraceTick((v) => v + 1);
    }, 1000);

    return () => window.clearInterval(t);
  }, [hostGraceActive, hostGraceExpiresAt]);

  useEffect(() => {
    if (!eventId) return;
    if (!isHost) return;
    if (step !== "LIVE_RECOVERY") return;

    const t = window.setInterval(() => {
      const scope: LiveScope =
        runtimeScopeRef.current ||
        eventBaseScope;

      void loadStatus(scope);
    }, 1000);

    return () => window.clearInterval(t);
  }, [eventBaseScope, eventId, isHost, loadStatus, step]);

  async function handleGoLive() {
    if (!eventId) return;
    if (!isHost) return;
    if (loadingGoLive) return;
    if (isFinished || isCancelled) return;

    setLoadingGoLive(true);
    setErr("");

    try {
      await api.eventGoLive(eventId);
      await api.liveHostPing(eventId, eventBaseScope);
      await loadEvent();

      runtimeScopeRef.current = eventBaseScope;
      setStep("LIVE_RUNNING");
    } catch (e: any) {
      setErr(String(e?.message || "Failed to go live"));
    } finally {
      setLoadingGoLive(false);
    }
  }

  async function handleResumeLive() {
    if (!eventId) return;
    if (!isHost) return;
    if (loadingGoLive) return;
    if (isFinished || isCancelled) return;

    setLoadingGoLive(true);
    setErr("");

    try {
      const scope: LiveScope =
        runtimeScopeRef.current ||
        eventBaseScope;

      await api.liveHostPing(eventId, scope);
      await loadEvent();

      setStep("LIVE_RUNNING");
    } catch (e: any) {
      setErr(String(e?.message || "Failed to resume live"));
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
      await api.eventCancel(eventId);
      setHostLiveLock(false);
      try {
        sessionStorage.removeItem(stepStorageKey);
      } catch {
        // ignore
      }
      nav("/app/live", { replace: true });
    } catch (e: any) {
      setErr(String(e?.message || "Failed to cancel event"));
    } finally {
      setLoadingFinish(false);
    }
  }

  async function handleFinishEvent() {
    if (!eventId) return;
    if (loadingFinish) return;

    setLoadingFinish(true);
    setErr("");

    try {
      await api.eventFinish(eventId);
      setHostLiveLock(false);
      try {
        sessionStorage.removeItem(stepStorageKey);
      } catch {}
      nav("/app/live", { replace: true });
    } catch (e: any) {
      setErr(String(e?.message || "Failed to finish event"));
    } finally {
      setLoadingFinish(false);
    }
  }

  function goBack() {
    if (step !== "LIVE_RUNNING") {
      setHostLiveLock(false);
      try {
        sessionStorage.removeItem(stepStorageKey);
      } catch {
        // ignore
      }
    }

    nav(`/app/live/${eventId}`);
  }

  if (!eventId) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 12 }}>
        <div style={{ color: "salmon", fontWeight: 900 }}>Invalid event id</div>
      </div>
    );
  }

  if (!loadingBootstrap && !isHost && !isAdmin) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 12 }}>
        <div style={{ color: "salmon", fontWeight: 900 }}>Access denied</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: 12 }}>
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
            <span style={pillStyle}>host {hostDisconnectState}</span>
            <span style={pillStyle}>{step}</span>
            <span style={pillStyle}>
              {step === "LIVE_RUNNING" ? "LIVE_CONNECTED" : "PREVIEW_DISABLED"}
            </span>
            <span style={pillStyle}>👁 0 watching</span>
            <span style={pillStyle}>⏱ {formatDuration(providerDurationMs)}</span>
            {hostGraceActive ? (
              <span style={pillStyle}>
                reconnect {formatCountdownTo(hostGraceExpiresAt)}
              </span>
            ) : null}
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

      <div
        style={{
          marginTop: 14,
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>
            {step === "LIVE_RUNNING"
              ? "Host live console"
              : step === "LIVE_RECOVERY"
              ? "Live recovery console"
              : "Pre-live host console"}
          </div>

          <div
            style={{
              minHeight: 560,
              display: "grid",
              placeItems: "center",
              opacity: 0.9,
              borderRadius: 14,
              background: "rgba(0,0,0,0.28)",
              textAlign: "center",
              padding: 20,
              position: "relative",
            }}
          >
            <div>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>
                Host media preview disabled
              </div>
              <div style={{ marginTop: 8, opacity: 0.88, fontWeight: 800, lineHeight: 1.45 }}>
                The old realtime host console has been disabled during live system migration.
              </div>
            </div>

            {step === "LIVE_RECOVERY" && hostGraceActive ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 30,
                  display: "grid",
                  placeItems: "center",
                  padding: 20,
                  background: "rgba(0,0,0,0.72)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div
                  style={{
                    width: "min(520px, 100%)",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(12,12,12,0.94)",
                    padding: 20,
                    textAlign: "center",
                    boxShadow: "0 20px 80px rgba(0,0,0,0.45)",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 1000, lineHeight: 1.1 }}>
                    Resume live
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 14,
                      lineHeight: 1.45,
                      opacity: 0.92,
                      fontWeight: 800,
                    }}
                  >
                    Your live is still active, but your host connection was interrupted.
                    Resume before the reconnect window expires.
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 16px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.06)",
                      fontWeight: 1000,
                      fontSize: 18,
                      minWidth: 110,
                    }}
                  >
                    {formatCountdownTo(hostGraceExpiresAt)}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => {
                        void handleResumeLive();
                      }}
                      disabled={loadingGoLive}
                      style={{
                        ...primaryBtnStyle,
                        minWidth: 180,
                        fontSize: 14,
                      }}
                    >
                      {loadingGoLive ? "Resuming..." : "Resume now"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ opacity: 0.86, lineHeight: 1.45 }}>
              {step === "DEVICE_SETUP"
                ? "Media preview is temporarily disabled. Continue to the final pre-live check when ready."
                : step === "PRE_GO_LIVE"
                ? "Final pre-live state. Go live only when you are fully ready."
                : step === "LIVE_RECOVERY"
                ? "The event is still marked as live, but the host connection was interrupted. Resume the live before the timer reaches zero."
                : "You are live. The old provider-based host console has been disabled while NestX transitions to the new live media system."}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {step === "DEVICE_SETUP" ? (
                <button
                  onClick={() => setStep("PRE_GO_LIVE")}
                  style={primaryBtnStyle}
                >
                  Continue
                </button>
              ) : step === "PRE_GO_LIVE" ? (
                <>
                  <button
                    onClick={() => setStep("DEVICE_SETUP")}
                    disabled={loadingGoLive || loadingFinish}
                    style={secondaryBtnStyle}
                  >
                    Back to setup
                  </button>

                  <button
                    onClick={() => void handleGoLive()}
                    disabled={loadingGoLive || loadingFinish}
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
                </>
              ) : step === "LIVE_RECOVERY" ? (
                <>
                  <button
                    onClick={() => {
                      void handleFinishEvent();
                    }}
                    disabled={loadingFinish}
                    style={secondaryBtnStyle}
                  >
                    {loadingFinish ? "Finishing..." : "Finish"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      void loadEvent();
                    }}
                    disabled={loadingFinish}
                    style={secondaryBtnStyle}
                  >
                    Refresh status
                  </button>

                  <button
                    onClick={() => {
                      void handleFinishEvent();
                    }}
                    disabled={loadingFinish}
                    style={secondaryBtnStyle}
                  >
                    {loadingFinish ? "Finishing..." : "Finish"}
                  </button>
                </>
              )}
            </div>
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