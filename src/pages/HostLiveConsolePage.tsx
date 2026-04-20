import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RealtimeKitProvider, useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import { api, type LiveTokenResponse } from "../api/nestxApi";

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
  | "INITIALIZING"
  | "CONNECTING"
  | "READY"
  | "GOING_LIVE"
  | "LIVE"
  | "FINISHING"
  | "ERROR";

type HostConsoleStep = "DEVICE_SETUP" | "PRE_GO_LIVE" | "LIVE_RUNNING";

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

type MeetingStats = {
  participantsNow: number;
  startedAt: number | null;
  durationMs: number;
};

type HostCoreConsoleProps = {
  authToken: string;
  step: HostConsoleStep;
  onJoined: () => void;
  onLeft: () => void;
  onError: (msg: string) => void;
  onMeetingStatsChange?: (stats: MeetingStats) => void;
};

function extractMeetingStats(meeting: any): MeetingStats {
  const rawParticipants = meeting?.participants;
  let participantsNow = 0;

  if (Array.isArray(rawParticipants)) {
    participantsNow = rawParticipants.length;
  } else if (rawParticipants && typeof rawParticipants.size === "number") {
    participantsNow = rawParticipants.size;
  } else if (rawParticipants && typeof rawParticipants === "object") {
    participantsNow = Object.keys(rawParticipants).length;
  }

  const rawStartedAt = meeting?.meta?.meetingStartedTimestamp;
  const startedAt =
    rawStartedAt != null && Number.isFinite(Number(rawStartedAt))
      ? Number(rawStartedAt)
      : null;

  const durationMs =
    startedAt != null ? Math.max(0, Date.now() - startedAt) : 0;

  return {
    participantsNow,
    startedAt,
    durationMs,
  };
}

function HostCoreConsole({
  authToken,
  step,
  onJoined,
  onLeft,
  onError,
  onMeetingStatsChange,
}: HostCoreConsoleProps) {
  const [meeting, initMeeting] = useRealtimeKitClient();

  const initializedAuthTokenRef = useRef("");
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [roomState, setRoomState] = useState("disconnected");

  const [currentAudioId, setCurrentAudioId] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [currentSpeakerId, setCurrentSpeakerId] = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadBrowserDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;

      const devices = await navigator.mediaDevices.enumerateDevices();

      const audios = devices.filter((d) => d.kind === "audioinput");
      const videos = devices.filter((d) => d.kind === "videoinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");

      setAudioDevices(audios);
      setVideoDevices(videos);
      setSpeakerDevices(speakers);

      if (!currentAudioId && audios[0]?.deviceId) setCurrentAudioId(audios[0].deviceId);
      if (!currentVideoId && videos[0]?.deviceId) setCurrentVideoId(videos[0].deviceId);
      if (!currentSpeakerId && speakers[0]?.deviceId) setCurrentSpeakerId(speakers[0].deviceId);
    } catch (e: any) {
      onError(String(e?.message || "Failed to enumerate devices"));
    }
  }, [currentAudioId, currentSpeakerId, currentVideoId, onError]);

  const loadMeetingState = useCallback(async () => {
    if (!meeting) return;

    try {
      const current = meeting.self.getCurrentDevices?.() || {};
      setCurrentAudioId(String(current?.audio?.deviceId || currentAudioId || ""));
      setCurrentVideoId(String(current?.video?.deviceId || currentVideoId || ""));
      setCurrentSpeakerId(String(current?.speaker?.deviceId || currentSpeakerId || ""));
      setAudioEnabled(!!meeting.self.audioEnabled);
      setVideoEnabled(!!meeting.self.videoEnabled);
      setRoomState(String(meeting.self.roomState || "disconnected"));
    } catch {
      // ignore
    }
  }, [currentAudioId, currentSpeakerId, currentVideoId, meeting]);

  useEffect(() => {
    if (!authToken) return;
    if (initializedAuthTokenRef.current === authToken) return;

    initializedAuthTokenRef.current = authToken;
    joinedRef.current = false;
    joiningRef.current = false;

    setRoomState("disconnected");

    void initMeeting({
      authToken,
      defaults: {
        audio: true,
        video: true,
      },
    });
  }, [authToken, initMeeting]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        }
      } catch {
        // ignore
      }

      if (!cancelled) {
        await loadBrowserDevices();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadBrowserDevices]);

  useEffect(() => {
    if (!meeting) return;

    let cancelled = false;

    const run = async () => {
      const currentRoomState = String(meeting?.self?.roomState || "").trim().toLowerCase();

      if (joinedRef.current) return;
      if (joiningRef.current) return;
      if (currentRoomState === "joined" || currentRoomState === "joining" || currentRoomState === "connecting") {
        return;
      }

      joiningRef.current = true;

      try {
        await meeting.join();

        if (cancelled) return;

        joinedRef.current = true;
        await loadMeetingState();
      } catch (e: any) {
        if (cancelled) return;
        onError(String(e?.message || "Failed to join preview"));
      } finally {
        joiningRef.current = false;
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadMeetingState, meeting, onError]);

  useEffect(() => {
    if (!meeting || !videoRef.current) return;

    const el = videoRef.current;

    try {
      meeting.self.registerVideoElement(el, true);
    } catch {
      // ignore
    }

    return () => {
      try {
        meeting.self.deregisterVideoElement(el);
      } catch {
        // ignore
      }
    };
  }, [meeting]);

  useEffect(() => {
    if (!meeting) return;

    const handleRoomJoined = () => {
      joinedRef.current = true;
      joiningRef.current = false;

      setRoomState(String(meeting.self.roomState || "joined"));
      setAudioEnabled(!!meeting.self.audioEnabled);
      setVideoEnabled(!!meeting.self.videoEnabled);
      onJoined();
      void loadBrowserDevices();
      void loadMeetingState();
    };

    const handleRoomLeft = () => {
      joinedRef.current = false;
      joiningRef.current = false;

      setRoomState(String(meeting.self.roomState || "left"));
      onLeft();
    };

    const handleDeviceListUpdate = () => {
      void loadBrowserDevices();
      void loadMeetingState();
    };

    meeting.self.on("roomJoined", handleRoomJoined);
    meeting.self.on("roomLeft", handleRoomLeft);
    meeting.self.on("deviceListUpdate", handleDeviceListUpdate);

    return () => {
      try {
        meeting.self.off("roomJoined", handleRoomJoined);
        meeting.self.off("roomLeft", handleRoomLeft);
        meeting.self.off("deviceListUpdate", handleDeviceListUpdate);
      } catch {
        // ignore
      }
    };
  }, [loadBrowserDevices, loadMeetingState, meeting, onJoined, onLeft]);

  useEffect(() => {
    if (!meeting) return;

    return () => {
      joinedRef.current = false;
      joiningRef.current = false;

      try {
        void meeting.leave();
      } catch {
        // ignore
      }
    };
  }, [meeting]);

  useEffect(() => {
    if (!meeting || !onMeetingStatsChange) return;

    const emitStats = () => {
      onMeetingStatsChange(extractMeetingStats(meeting));
    };

    emitStats();

    const t = window.setInterval(emitStats, 1000);

    return () => {
      window.clearInterval(t);
    };
  }, [meeting, onMeetingStatsChange]);

  async function toggleAudio() {
    if (!meeting) return;

    try {
      if (meeting.self.audioEnabled) {
        await meeting.self.disableAudio();
        setAudioEnabled(false);
      } else {
        await meeting.self.enableAudio();
        setAudioEnabled(true);
      }
    } catch (e: any) {
      onError(String(e?.message || "Failed to toggle microphone"));
    }
  }

  async function toggleVideo() {
    if (!meeting) return;

    try {
      if (meeting.self.videoEnabled) {
        await meeting.self.disableVideo();
        setVideoEnabled(false);
      } else {
        await meeting.self.enableVideo();
        setVideoEnabled(true);
      }
    } catch (e: any) {
      onError(String(e?.message || "Failed to toggle camera"));
    }
  }

  async function changeDevice(deviceId: string, list: MediaDeviceInfo[]) {
    if (!meeting) return;
    const device = list.find((d) => d.deviceId === deviceId);
    if (!device) return;

    try {
      await meeting.self.setDevice(device);

      if (device.kind === "audioinput") setCurrentAudioId(device.deviceId);
      if (device.kind === "videoinput") setCurrentVideoId(device.deviceId);
      if (device.kind === "audiooutput") setCurrentSpeakerId(device.deviceId);

      await loadMeetingState();
    } catch (e: any) {
      onError(String(e?.message || "Failed to change device"));
    }
  }

  const isDeviceSetup = step === "DEVICE_SETUP";

  return (
    <RealtimeKitProvider value={meeting as any}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDeviceSetup ? "minmax(320px, 1fr) minmax(280px, 340px)" : "1fr",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            background: "rgba(0,0,0,0.30)",
            minHeight: 520,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              background: "#111",
              display: "block",
            }}
          />

          {step === "PRE_GO_LIVE" || step === "LIVE_RUNNING" ? (
            <>
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: 12,
                  display: "flex",
                  justifyContent: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  pointerEvents: "none",
                }}
              >
                <button onClick={() => void toggleAudio()} style={overlayBtnStyle}>
                  {audioEnabled ? "Mute mic" : "Unmute mic"}
                </button>

                <button onClick={() => void toggleVideo()} style={overlayBtnStyle}>
                  {videoEnabled ? "Turn camera off" : "Turn camera on"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                style={gearBtnStyle}
                aria-label="Open preview settings"
              >
                ⚙
              </button>

              {settingsOpen ? (
                <div style={settingsPanelStyle}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Preview settings</div>

                  <label style={labelStyle}>
                    <span>Microphone</span>
                    <select
                      value={currentAudioId}
                      onChange={(e) => void changeDevice(e.target.value, audioDevices)}
                      style={selectStyle}
                    >
                      <option value="">Select microphone</option>
                      {audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || "Microphone"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    <span>Camera</span>
                    <select
                      value={currentVideoId}
                      onChange={(e) => void changeDevice(e.target.value, videoDevices)}
                      style={selectStyle}
                    >
                      <option value="">Select camera</option>
                      {videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || "Camera"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    <span>Speakers</span>
                    <select
                      value={currentSpeakerId}
                      onChange={(e) => void changeDevice(e.target.value, speakerDevices)}
                      style={selectStyle}
                    >
                      <option value="">Select speakers</option>
                      {speakerDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || "Speakers"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    <button onClick={() => void toggleAudio()} style={secondaryBtnStyle}>
                      {audioEnabled ? "Mute mic" : "Unmute mic"}
                    </button>
                    <button onClick={() => void toggleVideo()} style={secondaryBtnStyle}>
                      {videoEnabled ? "Turn camera off" : "Turn camera on"}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {isDeviceSetup ? (
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.05)",
              padding: 14,
              display: "grid",
              gap: 12,
              alignContent: "start",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Device setup</div>

            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Room state: <b>{roomState}</b>
            </div>

            <label style={labelStyle}>
              <span>Microphone</span>
              <select
                value={currentAudioId}
                onChange={(e) => void changeDevice(e.target.value, audioDevices)}
                style={selectStyle}
              >
                <option value="">Select microphone</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Microphone"}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              <span>Camera</span>
              <select
                value={currentVideoId}
                onChange={(e) => void changeDevice(e.target.value, videoDevices)}
                style={selectStyle}
              >
                <option value="">Select camera</option>
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Camera"}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              <span>Speakers</span>
              <select
                value={currentSpeakerId}
                onChange={(e) => void changeDevice(e.target.value, speakerDevices)}
                style={selectStyle}
              >
                <option value="">Select speakers</option>
                {speakerDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Speakers"}
                  </option>
                ))}
              </select>
            </label>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: 13,
                opacity: 0.9,
                lineHeight: 1.45,
              }}
            >
              Select camera, microphone and speakers, and make sure your preview is working before continuing.
            </div>
          </div>
        ) : null}
      </div>
    </RealtimeKitProvider>
  );
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

  const [joinedPreview, setJoinedPreview] = useState(false);
  const [step, setStep] = useState<HostConsoleStep>("DEVICE_SETUP");
  const [, setProviderParticipantsNow] = useState<number | null>(null);
  const [providerDurationMs, setProviderDurationMs] = useState(0);
  const stepStorageKey = `nx_host_console_step_${eventId}`;
  const hostLiveLockStorageKey = "nx_host_live_lock";

  const liveTokenEventIdRef = useRef("");
  const liveTokenScopeRef = useRef<LiveScope | null>(null);
  const liveTokenRoleRef = useRef<"host" | "viewer" | null>(null);
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
            : (isLive ? eventBaseScope : eventBaseScope);

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
    [eventBaseScope, eventDetail, eventId, isLive]
  );

  const consoleState: HostConsoleState = useMemo(() => {
    if (err || liveTokenErr) return "ERROR";
    if (loadingFinish) return "FINISHING";
    if (loadingGoLive) return "GOING_LIVE";
    if (isLive) return "LIVE";
    if (loadingBootstrap) return "BOOTING";
    if (loadingLiveToken) return "INITIALIZING";
    if (!liveToken?.authToken) return "INITIALIZING";
    if (joinedPreview) return "READY";
    return "CONNECTING";
  }, [err, isLive, joinedPreview, liveToken?.authToken, liveTokenErr, loadingBootstrap, loadingFinish, loadingGoLive, loadingLiveToken]);

  const handleMeetingStatsChange = useCallback((stats: MeetingStats) => {
    setProviderParticipantsNow(
      Number.isFinite(Number(stats?.participantsNow))
        ? Number(stats.participantsNow)
        : 0
    );

    setProviderDurationMs(
      Number.isFinite(Number(stats?.durationMs))
        ? Number(stats.durationMs)
        : 0
    );
  }, []);

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

  useEffect(() => {
    if (!liveToken?.authToken) {
      setProviderParticipantsNow(null);
      setProviderDurationMs(0);
    }
  }, [liveToken?.authToken]);

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

    try {
      const saved = sessionStorage.getItem(stepStorageKey);
      if (saved === "DEVICE_SETUP" || saved === "PRE_GO_LIVE" || saved === "LIVE_RUNNING") {
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
          runtimeScopeRef.current = getEventBaseScope(ev);
          setStep("LIVE_RUNNING");
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
    if (!eventId || !eventDetail || !isHost) return;
    if (isLive || isFinished || isCancelled) return;

    runtimeScopeRef.current = eventBaseScope;
    void syncHostRealtimeState(joinedPreview ? "joined" : "setup");
  }, [eventBaseScope, eventDetail, eventId, isCancelled, isFinished, isHost, isLive, joinedPreview, syncHostRealtimeState]);

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
    if (step !== "PRE_GO_LIVE" && step !== "LIVE_RUNNING") return;

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
    if (!isHost) return;
    if (!eventDetail) return;
    if (isFinished || isCancelled) return;
    if (step !== "LIVE_RUNNING") return;
    if (!joinedPreview) return;

    let cancelled = false;

    const run = async () => {
      try {
        const scope: LiveScope =
          runtimeScopeRef.current ||
          eventBaseScope;

        await api.liveStartBroadcast(eventId, scope);
        await syncHostRealtimeState("broadcasting");
        await api.liveHostPing(eventId, scope);
      } catch {
        // ignore
      }
    };

    void run();

    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [
    eventBaseScope,
    eventDetail,
    eventId,
    isCancelled,
    isFinished,
    isHost,
    joinedPreview,
    step,
    syncHostRealtimeState,
  ]);

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

  async function handleGoLive() {
    if (!eventId) return;
    if (!isHost) return;
    if (loadingGoLive) return;
    if (isFinished || isCancelled) return;

    setLoadingGoLive(true);
    setErr("");

    try {
      await api.liveStartBroadcast(eventId, eventBaseScope);
      await api.eventGoLive(eventId);
      await syncHostRealtimeState("broadcasting");
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
            <span style={pillStyle}>{step}</span>
            <span style={pillStyle}>
              {step === "LIVE_RUNNING"
                ? "LIVE_CONNECTED"
                : joinedPreview
                ? "PREVIEW_JOINED"
                : "PREVIEW_NOT_JOINED"}
            </span>
            <span style={pillStyle}>
              👁 0 watching
            </span>
            <span style={pillStyle}>
              ⏱ {formatDuration(providerDurationMs)}
            </span>
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
            {step === "LIVE_RUNNING" ? "Host live console" : "Pre-live host console"}
          </div>

          {loadingLiveToken ? (
            <div style={{ minHeight: 560, display: "grid", placeItems: "center", opacity: 0.9 }}>
              Initializing host preview…
            </div>
          ) : liveToken?.authToken ? (
            <HostCoreConsole
              authToken={liveToken.authToken}
              step={step}
              onJoined={() => {
                setJoinedPreview(true);
                void syncHostRealtimeState("joined");
              }}
              onLeft={() => {
                setJoinedPreview(false);
                void syncHostRealtimeState("setup");
              }}
              onError={(msg) => {
                setErr(msg);
              }}
              onMeetingStatsChange={handleMeetingStatsChange}
            />
          ) : (
            <div style={{ minHeight: 560, display: "grid", placeItems: "center", opacity: 0.9 }}>
              Waiting for host preview…
            </div>
          )}

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
                ? "Complete device setup first, then continue to the final pre-live check."
                : step === "PRE_GO_LIVE"
                ? "Final preview before live. Go live only when you are fully ready."
                : "You are live. Audio, camera and settings remain available here while the live stays aligned with NestX scope, goal and chat logic."}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {step === "DEVICE_SETUP" ? (
                <button
                  onClick={() => setStep("PRE_GO_LIVE")}
                  disabled={!liveToken?.authToken || !joinedPreview}
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
                    disabled={loadingGoLive || loadingFinish || !liveToken?.authToken || !joinedPreview}
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
                      void loadEvent();
                    }}
                    disabled={loadingFinish}
                    style={secondaryBtnStyle}
                  >
                    Refresh status
                  </button>

                  <button
                    onClick={async () => {
                      if (!eventId || loadingFinish) return;
                      setLoadingFinish(true);
                      setErr("");
                      try {
                        await syncHostRealtimeState("ended");
                        await api.eventFinish(eventId);
                        setHostLiveLock(false);
                        try {
                          sessionStorage.removeItem(stepStorageKey);
                        } catch {}
                        nav("/app/live", { replace: true });
                      } catch (e: any) {
                        setErr(String(e?.message || "Failed to finish event"));
                      }
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

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
} as const;

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  outline: "none",
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

const overlayBtnStyle = {
  pointerEvents: "auto",
  padding: "8px 12px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
  background: "rgba(0,0,0,0.42)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.18)",
  backdropFilter: "blur(4px)",
} as const;

const gearBtnStyle = {
  position: "absolute" as const,
  right: 12,
  bottom: 12,
  width: 42,
  height: 42,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.42)",
  color: "white",
  cursor: "pointer",
  backdropFilter: "blur(4px)",
  fontSize: 18,
  fontWeight: 900,
  zIndex: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
};

const settingsPanelStyle = {
  position: "absolute" as const,
  right: 12,
  bottom: 62,
  width: 300,
  maxWidth: "calc(100% - 24px)",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(18,18,18,0.96)",
  color: "white",
  padding: 12,
  display: "grid",
  gap: 10,
  zIndex: 7,
};