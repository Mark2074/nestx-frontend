import { useEffect, useRef } from "react";
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
  hostMediaStatus?: "idle" | "live";
  hostGraceActive: boolean;
  hostGraceExpiresAt: string | null;
  hostGraceCountdownLabel: string;
  onBack: () => void;
  onRetry: () => void;
  navToLive: () => void;
};

export default function ViewerLiveStage({
  stageReady,
  stageErr,
  isHost,
  shouldPausePublic,
  roomBlockCode,
  uiMode,
  playbackUrl,
  hostMediaStatus = "idle",
  hostGraceActive,
  hostGraceCountdownLabel,
  onBack,
  onRetry,
  navToLive,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    console.log("=== VIEWER STAGE MOUNTED ===", {
      playbackUrl,
      stageReady,
      hostMediaStatus,
      isHost,
      shouldPausePublic,
    });
    const video = videoRef.current;
    if (!video) return;
    if (isHost) return;
    if (!stageReady) return;
    if (shouldPausePublic) return;
    if (!playbackUrl) return;

    video?.addEventListener("playing", () => {
      console.log("[VIDEO PLAYING]", { currentTime: video.currentTime });
    });

    video?.addEventListener("waiting", () => {
      console.log("[VIDEO WAITING]", {
        currentTime: video.currentTime,
        readyState: video.readyState,
      });
    });

    video?.addEventListener("stalled", () => {
      console.log("[VIDEO STALLED]", {
        currentTime: video.currentTime,
        readyState: video.readyState,
      });
    });

    video?.addEventListener("error", () => {
      console.log("[VIDEO ERROR]", video.error);
    });

    let hls: Hls | null = null;
    let destroyed = false;

    console.log("[ViewerLiveStage] stageReady =", stageReady);
    console.log("[ViewerLiveStage] playbackUrl =", playbackUrl);
    console.log("[ViewerLiveStage] hostMediaStatus =", hostMediaStatus);
    console.log("[ViewerLiveStage] window.location.origin =", window.location.origin);

    const attach = async () => {
      try {
        video.autoplay = true;
        video.playsInline = true;
        video.muted = false;
        video.preload = "auto";

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = playbackUrl;
          video.addEventListener("error", () => {
            console.log("[VIDEO ERROR]", video.error);
          });
          video.load();
          await video.play().catch(() => {});
          return;
        }

        if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: false,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            liveDurationInfinity: true,
            startPosition: -1,
          });

          hls.loadSource(playbackUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.log("[HLS ERROR]", data);
          });

          hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
            console.log("[HLS FRAG LOADED]", data.frag?.sn);
          });

          hls.on(Hls.Events.BUFFER_APPENDED, () => {
            console.log("[HLS BUFFER APPENDED]");
          });

          video.addEventListener("waiting", () => {
            console.log("[VIDEO WAITING]", {
              currentTime: video.currentTime,
              readyState: video.readyState,
            });
          });

          video.addEventListener("stalled", () => {
            console.log("[VIDEO STALLED]", {
              currentTime: video.currentTime,
              readyState: video.readyState,
            });
          });

          video.addEventListener("error", () => {
            console.log("[VIDEO ERROR]", video.error);
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.log("[HLS ERROR]", data);
          });

          hls.on(Hls.Events.MANIFEST_PARSED, async () => {
            if (destroyed) return;
            await video.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!hls) return;
            if (!data?.fatal) return;

            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                hls = null;
                break;
            }
          });

          return;
        }

        video.src = playbackUrl;
        video.load();
        await video.play().catch(() => {});
      } catch {
        // ignore
      }
    };

    void attach();

    return () => {
      destroyed = true;

      if (hls) {
        hls.destroy();
        hls = null;
      }

      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        // ignore
      }
    };
  }, [isHost, stageReady, shouldPausePublic, playbackUrl, hostMediaStatus]);

  const showVideo =
    !isHost &&
    !!stageReady &&
    !!playbackUrl &&
    !shouldPausePublic &&
    uiMode !== "PRELIVE_HOST_WAITING" &&
    uiMode !== "ENDED";

  return (
    <div
      style={{
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
      }}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: 10,
            background: "black",
          }}
        />
      ) : isHost ? (
        <div
          style={{
            maxWidth: 560,
            textAlign: "center",
            opacity: 0.95,
          }}
        >
          <div style={{ fontWeight: 1000, fontSize: 18 }}>
            Live is running.
          </div>
          <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800, lineHeight: 1.45 }}>
            Host streaming is managed from OBS/OME. This page does not render host return video.
          </div>
        </div>
      ) : uiMode === "PRELIVE_HOST_WAITING" ? (
        <div
          style={{
            maxWidth: 560,
            textAlign: "center",
            opacity: 0.95,
          }}
        >
          <div style={{ fontWeight: 1000, fontSize: 18 }}>
            Waiting to go live.
          </div>
          <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800, lineHeight: 1.45 }}>
            The host has not started the live yet.
          </div>
        </div>
      ) : stageErr ? (
        <div style={{ opacity: 0.95, color: "salmon", fontWeight: 900 }}>
          {stageErr}
        </div>
      ) : stageReady && !playbackUrl ? (
        <div
          style={{
            maxWidth: 560,
            textAlign: "center",
            opacity: 0.95,
          }}
        >
          <div style={{ fontWeight: 1000, fontSize: 18 }}>
            Waiting for live stream…
          </div>
          <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800, lineHeight: 1.45 }}>
            Room access is active, but no playback url is available yet.
          </div>
        </div>
      ) : stageReady && playbackUrl ? (
        <div
          style={{
            maxWidth: 560,
            textAlign: "center",
            opacity: 0.95,
          }}
        >
          <div style={{ fontWeight: 1000, fontSize: 18 }}>
            Stream starting…
          </div>
          <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800, lineHeight: 1.45 }}>
            Playback url is ready. Waiting for media...
          </div>
        </div>
      ) : uiMode === "PUBLIC_ACTIVE" ||
        uiMode === "PRIVATE_ACTIVE" ||
        uiMode === "RETURNING_PUBLIC" ||
        uiMode === "HOST_RECONNECTING" ? (
        <div style={{ opacity: 0.9 }}>Live media temporarily unavailable</div>
      ) : (
        <div style={{ opacity: 0.9 }}>Waiting for live stream…</div>
      )}

      {uiMode === "HOST_RECONNECTING" && hostGraceActive ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 18,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(0,0,0,0.58)",
            backdropFilter: "blur(4px)",
            pointerEvents: "all",
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
            <div style={{ fontWeight: 1000, fontSize: 22, color: "salmon", lineHeight: 1.1 }}>
              Host disconnected
            </div>

            <div
              style={{
                marginTop: 10,
                opacity: 0.92,
                fontWeight: 800,
                lineHeight: 1.45,
                fontSize: 14,
              }}
            >
              Waiting for the host to resume the live stream.
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
              {hostGraceCountdownLabel}
            </div>

            <div
              style={{
                marginTop: 12,
                opacity: 0.84,
                fontWeight: 700,
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              The session will end automatically if the host does not reconnect before the timer reaches zero.
            </div>
          </div>
        </div>
      ) : null}

      {shouldPausePublic ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(0,0,0,0.92)",
            pointerEvents: "all",
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontWeight: 1000, fontSize: 16 }}>
              Host is in a private session.
            </div>
            <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
              Public live is temporarily paused.
            </div>
          </div>
        </div>
      ) : null}

      {roomBlockCode === "ROOM_FULL" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(0,0,0,0.94)",
            pointerEvents: "all",
          }}
        >
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 18, color: "salmon" }}>
              Room is full
            </div>
            <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
              Maximum capacity reached. Try again later.
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button onClick={onBack} style={secondaryBtnStyle}>
                Back
              </button>
              <button onClick={onRetry} style={secondaryBtnStyle}>
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uiMode === "ENDED" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(0,0,0,0.65)",
          }}
        >
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 16, color: "salmon" }}>
              This live has ended.
            </div>
            <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800 }}>
              You can go back to Live.
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={navToLive} style={secondaryBtnStyle}>
                Back to Live
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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