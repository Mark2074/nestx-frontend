import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";

type Props = {
  eventId: string;
  stageReady?: boolean;
  stageErr?: string;
  isHost: boolean;
  shouldPausePublic: boolean;
  roomBlockCode: "" | "ROOM_FULL";
  uiMode: string;
  eventBaseScope: "public" | "private";
  runtimeScope: "public" | "private" | null;
  playbackUrl?: string | null;
  onBack: () => void;
  onRetry: () => void;
  navToLive: () => void;
};

type PlayerState =
  | "idle"
  | "loading"
  | "waiting_stream"
  | "playing"
  | "interrupted"
  | "failed";

const STREAM_RETRY_MS = 5000;

export default function ViewerLiveStage({
  stageReady,
  stageErr,
  isHost,
  shouldPausePublic,
  roomBlockCode,
  uiMode,
  playbackUrl,
  onBack,
  onRetry,
  navToLive,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const attachedPlaybackUrlRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState>("idle");

  const isSafariNative = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  }, []);

  const canShowVideo =
    !isHost &&
    !!stageReady &&
    !!playbackUrl &&
    !shouldPausePublic &&
    uiMode !== "PRELIVE_HOST_WAITING" &&
    uiMode !== "ENDED";

  useEffect(() => {
    const video = videoRef.current;
    let lastTime = 0;
    let stuckCount = 0;
    let monitorInterval: number | null = null;
    let hasPlayedOnce = false;

    if (!video) return;
    if (!canShowVideo) return;

    const normalizedPlaybackUrl = String(playbackUrl || "").trim();
    if (!normalizedPlaybackUrl) return;

    let disposed = false;

    const clearRetryTimer = () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const resetMedia = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        // ignore
      }
    };

    const markStreamUnavailable = () => {
      clearRetryTimer();

      setPlayerState(hasPlayedOnce ? "interrupted" : "waiting_stream");

      retryTimerRef.current = window.setTimeout(() => {
        if (disposed) return;

        attachedPlaybackUrlRef.current = null;
        resetMedia();
        void bootPlayer();
      }, STREAM_RETRY_MS);
    };

    const bootPlayer = async () => {
      if (disposed) return;

      setPlayerState("loading");

      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";
      video.muted = true;

      const samePlaybackAlreadyAttached =
        attachedPlaybackUrlRef.current === normalizedPlaybackUrl;

      if (samePlaybackAlreadyAttached) {
        await video.play().catch(() => {});
        return;
      }

      attachedPlaybackUrlRef.current = normalizedPlaybackUrl;
      resetMedia();

      if (isSafariNative && video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = normalizedPlaybackUrl;
        video.load();
        await video.play().catch(() => {});
        return;
      }

      if (!Hls.isSupported()) {
        video.src = normalizedPlaybackUrl;
        video.load();
        await video.play().catch(() => {});
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        liveDurationInfinity: true,
        startPosition: -1,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
        maxBufferLength: 8,
        maxMaxBufferLength: 12,
        backBufferLength: 4,
        maxBufferHole: 0.5,
        maxFragLookUpTolerance: 0.25,
        maxLiveSyncPlaybackRate: 1.05,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        if (disposed) return;
        await video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (disposed) return;
        if (hlsRef.current !== hls) return;

        const details = String(data?.details || "");
        const fatal = Boolean(data?.fatal);

        if (details === "bufferStalledError") {
          void video.play().catch(() => {});
          return;
        }

        if (!fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          markStreamUnavailable();
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          markStreamUnavailable();
          hls.recoverMediaError();
          return;
        }

        markStreamUnavailable();
      });

      hls.loadSource(normalizedPlaybackUrl);
      hls.attachMedia(video);
    };

    const onPlaying = () => {
      hasPlayedOnce = true;
      lastTime = video.currentTime;
      stuckCount = 0;
      retryCountRef.current = 0;
      clearRetryTimer();
      setPlayerState("playing");
    };

    const onWaiting = () => {
      if (video.paused) void video.play().catch(() => {});
    };

    const onStalled = () => {
      markStreamUnavailable();
    };

    const onVideoError = () => {
      markStreamUnavailable();
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onVideoError);

    void bootPlayer();
    monitorInterval = window.setInterval(() => {
      if (!video || video.paused) return;
      if (!hasPlayedOnce) return;
      if (video.readyState < 2) return;
      if (video.currentTime <= 0.2) return;

      const current = video.currentTime;

      if (Math.abs(current - lastTime) < 0.05) {
        stuckCount += 1;
      } else {
        stuckCount = 0;
      }

      lastTime = current;

      if (stuckCount >= 12) {
        console.log("[PLAYER STUCK DETECTED]");
        stuckCount = 0;
        void video.play().catch(() => {});
      }
    }, 1000);

    return () => {
      disposed = true;
      clearRetryTimer();

      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onVideoError);
      if (monitorInterval !== null) {
        window.clearInterval(monitorInterval);
      }
    };
  }, [canShowVideo, isSafariNative, playbackUrl]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      attachedPlaybackUrlRef.current = null;

      const video = videoRef.current;
      
      if (video) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const showRecoveryOverlay =
    canShowVideo &&
    (playerState === "loading" ||
      playerState === "waiting_stream" ||
      playerState === "interrupted" ||
      playerState === "failed");

  return (
    <div style={stageBoxStyle(isHost, shouldPausePublic)}>
      {canShowVideo ? (
        <video ref={videoRef} controls autoPlay playsInline style={videoStyle} />
      ) : isHost ? (
        <InfoBox
          title="Live is running."
          text="Host streaming is managed from OBS/OME. This page does not render host return video."
        />
      ) : uiMode === "PRELIVE_HOST_WAITING" ? (
        <InfoBox title="Waiting to go live." text="The host has not started the live yet." />
      ) : stageErr ? (
        <div style={{ opacity: 0.95, color: "salmon", fontWeight: 900 }}>{stageErr}</div>
      ) : stageReady && !playbackUrl ? (
        <InfoBox
          title="Waiting for live stream…"
          text="Room access is active, but no playback url is available yet."
        />
      ) : (
        <div style={{ opacity: 0.9 }}>Waiting for live stream…</div>
      )}

      {showRecoveryOverlay ? (
        <div style={softOverlayStyle}>
          <div style={overlayCardStyle}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>
              {playerState === "failed"
                ? "Stream unavailable"
                : playerState === "interrupted"
                ? "Stream temporarily unavailable"
                : "Waiting for stream"}
            </div>

            <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800, lineHeight: 1.45 }}>
              {playerState === "failed"
                ? "Playback could not be restored automatically."
                : playerState === "interrupted"
                ? "The live stream paused or lost signal. It will resume automatically when available."
                : "The host has started the room. Video will appear when the stream is available."}
            </div>

            {playerState === "failed" ? (
              <button
                onClick={() => {
                  retryCountRef.current = 0;
                  attachedPlaybackUrlRef.current = null;
                  setPlayerState("idle");
                  onRetry();
                }}
                style={{ ...secondaryBtnStyle, marginTop: 14 }}
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {shouldPausePublic ? (
        <div style={hardOverlayStyle}>
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>Host is in a private session.</div>
            <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
              Public live is temporarily paused.
            </div>
          </div>
        </div>
      ) : null}

      {roomBlockCode === "ROOM_FULL" ? (
        <div style={hardOverlayStyle}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 18, color: "salmon" }}>Room is full</div>
            <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
              Maximum capacity reached. Try again later.
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 10 }}>
              <button onClick={onBack} style={secondaryBtnStyle}>Back</button>
              <button onClick={onRetry} style={secondaryBtnStyle}>Retry</button>
            </div>
          </div>
        </div>
      ) : null}

      {uiMode === "ENDED" ? (
        <div style={hardOverlayStyle}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 16, color: "salmon" }}>
              This live has ended.
            </div>
            <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
              You can go back to Live.
            </div>

            <button onClick={navToLive} style={{ ...secondaryBtnStyle, marginTop: 12 }}>
              Back to Live
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoBox({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ maxWidth: 560, textAlign: "center", opacity: 0.95 }}>
      <div style={{ fontWeight: 1000, fontSize: 18 }}>{title}</div>
      <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800, lineHeight: 1.45 }}>
        {text}
      </div>
    </div>
  );
}

const stageBoxStyle = (isHost: boolean, shouldPausePublic: boolean) =>
  ({
    height: isHost ? 500 : 520,
    minHeight: isHost ? 500 : 520,
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
    opacity: shouldPausePublic ? 0 : 1,
    pointerEvents: shouldPausePublic ? "none" : "auto",
  }) as const;

const videoStyle = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  borderRadius: 10,
  background: "black",
} as const;

const softOverlayStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 12,
  display: "grid",
  placeItems: "center",
  padding: 16,
  background: "rgba(0,0,0,0.34)",
  pointerEvents: "none",
} as const;

const hardOverlayStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 30,
  display: "grid",
  placeItems: "center",
  padding: 16,
  background: "rgba(0,0,0,0.92)",
  pointerEvents: "all",
} as const;

const overlayCardStyle = {
  width: "min(520px, 100%)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(12,12,12,0.94)",
  padding: 20,
  textAlign: "center",
  boxShadow: "0 20px 80px rgba(0,0,0,0.45)",
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