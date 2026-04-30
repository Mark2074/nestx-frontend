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

type HostConsoleStep = "PRE_GO_LIVE" | "LIVE_RUNNING";

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

  const [step, setStep] = useState<HostConsoleStep>("PRE_GO_LIVE");

  const [, setGraceTick] = useState(0);
  const [hostGraceActive, setHostGraceActive] = useState(false);
  const [hostGraceExpiresAt, setHostGraceExpiresAt] = useState<string | null>(null);

  const [, setHostSession] = useState<{
    rtmpUrl: string;
    streamKey: string;
    playbackUrl: string | null;
    hostMediaStatus: "idle" | "live";
  } | null>(null);

  const [mediaLive, setMediaLive] = useState(false);
  const [viewersNow, setViewersNow] = useState(0);

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

  const loadHostSession = useCallback(
    async (scope: LiveScope) => {
      if (!eventId) return null;
      try {
        const res: any = await api.liveHostSession(eventId, scope);
        setHostSession({
          rtmpUrl: String(res?.rtmpUrl || "").trim(),
          streamKey: String(res?.streamKey || "").trim(),
          playbackUrl: String(res?.playbackUrl || "").trim() || null,
          hostMediaStatus:
            String(res?.hostMediaStatus || "idle") === "live" ? "live" : "idle",
        });
        return res;
      } catch (e: any) {
        setErr(String(e?.message || "Failed to load host session"));
        return null;
      }
    },
    [eventId]
  );

  const loadMediaStatus = useCallback(
    async (scope: LiveScope) => {
      if (!eventId) return null;
      try {
        const res: any = await api.liveMediaStatus(eventId, scope);

        setHostSession((prev) => ({
          rtmpUrl: prev?.rtmpUrl || "",
          streamKey: String(res?.streamKey || prev?.streamKey || "").trim(),
          playbackUrl: String(res?.playbackUrl || prev?.playbackUrl || "").trim() || null,
          hostMediaStatus:
            String(res?.hostMediaStatus || (res?.isLive ? "live" : "idle")) === "live"
              ? "live"
              : "idle",
        }));

        const liveNow =
          String(res?.hostMediaStatus || (res?.isLive ? "live" : "idle")) === "live";

        setMediaLive(liveNow);

        return res;
      } catch {
        setMediaLive(false);
        return null;
      }
    },
    [eventId]
  );

  useEffect(() => {
    if (!eventId) return;

    try {
      const saved = sessionStorage.getItem(stepStorageKey);

      if (saved === "PRE_GO_LIVE" || saved === "LIVE_RUNNING") {
        setStep(saved);
        return;
      }

      setStep("PRE_GO_LIVE");
    } catch {
      setStep("PRE_GO_LIVE");
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

        const baseScope = getEventBaseScope(ev);
        runtimeScopeRef.current = baseScope;

        await loadHostSession(baseScope);
        if (String(ev?.status || "").trim().toLowerCase() === "live") {
          await api.liveHostRealtimeState(eventId, {
            scope: baseScope,
            state: "broadcasting",
          });

          await api.liveHostPing(eventId, baseScope);

          setStep("LIVE_RUNNING");
          await loadStatus(baseScope);
          return;
        }

        await api.liveHostRealtimeState(eventId, {
          scope: baseScope,
          state: "joined",
        });

        setStep("PRE_GO_LIVE");
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
  }, [eventId, loadHostSession, loadMediaStatus, loadStatus]);

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
    const scope: LiveScope =
      runtimeScopeRef.current ||
      eventBaseScope;

    try {
      await api.liveHostPing(eventId, scope);
    } catch {}

    try {
      const res: any = await api.liveStatus(eventId, scope);
      setViewersNow(Number(res?.viewersNow || 0));

      setHostGraceActive(Boolean(res?.hostGraceActive));
      setHostGraceExpiresAt(
        res?.hostGraceExpiresAt ? String(res.hostGraceExpiresAt) : null
      );
    } catch {}

    void loadMediaStatus(scope);
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
    if (step !== "PRE_GO_LIVE" && step !== "LIVE_RUNNING") return;

    const sendHostPing = async () => {
      try {
        const scope: LiveScope =
          runtimeScopeRef.current ||
          eventBaseScope;

        await api.liveHostPing(eventId, scope);
      } catch {
        // ignore
      }
    };

    void sendHostPing();

    const t = window.setInterval(() => {
      void sendHostPing();
    }, 3000);

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
    if (step !== "LIVE_RUNNING") return;

    const t = window.setInterval(async () => {
      const scope: LiveScope =
        runtimeScopeRef.current ||
        eventBaseScope;

      try {
        await api.liveHostPing(eventId, scope);
      } catch {
        // ignore
      }

      void loadStatus(scope);
      void loadMediaStatus(scope);
    }, 5000);

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
      await api.liveHostRealtimeState(eventId, {
        scope: eventBaseScope,
        state: "broadcasting",
      });

      await api.liveHostPing(eventId, eventBaseScope);

      await loadEvent();
      await loadHostSession(eventBaseScope);

      runtimeScopeRef.current = eventBaseScope;
      setStep("LIVE_RUNNING");
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
      await api.liveHostRealtimeState(eventId, {
        scope: runtimeScopeRef.current || eventBaseScope,
        state: "ended",
      });
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
            <span style={pillStyle}>
              {isFinished || isCancelled ? "ENDED" : isLive ? "LIVE" : "WAITING"}
            </span>
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
          <div
            style={{
              borderRadius: 16,
              background: "rgba(255,255,255,0.035)",
              padding: 18,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 26, fontWeight: 1000 }}>
                {step === "LIVE_RUNNING" ? "Live active" : "Ready to go live"}
              </div>

              <div style={{ opacity: 0.82, fontWeight: 800 }}>
                {step === "LIVE_RUNNING"
                  ? "Your event is live on NestX."
                  : "Start streaming in OBS, then click Go Live."}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <div style={statusCardStyle}>
                <div style={statusLabelStyle}>Viewers</div>
                <div style={statusValueStyle}>
                  {viewersNow}
                </div>
              </div>
              
              <div style={statusCardStyle}>
                <div style={statusLabelStyle}>Event</div>
                <div style={statusValueStyle}>
                  {isFinished || isCancelled ? "ENDED" : isLive ? "LIVE" : "WAITING"}
                </div>
              </div>

              <div style={statusCardStyle}>
                <div style={statusLabelStyle}>Stream</div>
                <div style={statusValueStyle}>
                  {mediaLive ? "ACTIVE" : "WAITING"}
                </div>
              </div>

              <div style={statusCardStyle}>
                <div style={statusLabelStyle}>OBS</div>
                <div style={statusValueStyle}>
                  {hostGraceActive ? "DISCONNECTED" : mediaLive ? "CONNECTED" : "WAITING"}
                </div>
              </div>
            </div>

            {hostGraceActive ? (
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(234,179,8,0.35)",
                  background: "rgba(234,179,8,0.10)",
                  padding: 12,
                  fontWeight: 900,
                }}
              >
                Reconnecting… {formatCountdownTo(hostGraceExpiresAt)}
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
            <div />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {step === "PRE_GO_LIVE" ? (
                <>
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
              ) : (
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

const statusCardStyle = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  padding: 14,
  display: "grid",
  gap: 6,
} as const;

const statusLabelStyle = {
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.7,
} as const;

const statusValueStyle = {
  fontSize: 15,
  fontWeight: 1000,
} as const;