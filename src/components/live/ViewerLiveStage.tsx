import RealtimeMeetingEmbed from "./RealtimeMeetingEmbed";

type MeetingStats = {
  participantsNow: number;
  startedAt: number | null;
  durationMs: number;
};

type Props = {
  eventId: string;
  authToken?: string;
  loadingLiveToken: boolean;
  liveTokenErr?: string;
  isHost: boolean;
  shouldPausePublic: boolean;
  roomBlockCode: "" | "ROOM_FULL";
  uiMode: string;
  eventBaseScope: "public" | "private";
  runtimeScope: "public" | "private" | null;
  onBack: () => void;
  onRetry: () => void;
  navToLive: () => void;
  onMeetingStatsChange?: (stats: MeetingStats) => void;
};

export default function ViewerLiveStage({
  authToken,
  loadingLiveToken,
  liveTokenErr,
  isHost,
  shouldPausePublic,
  roomBlockCode,
  uiMode,
  onBack,
  onRetry,
  navToLive,
  onMeetingStatsChange,
}: Props) {
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
      {isHost ? (
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
            Host realtime stays attached to the pre-live console to avoid a second join and duplicate video.
          </div>
        </div>
      ) : uiMode === "HOST_RECONNECTING" ? (
        <div
          style={{
            maxWidth: 560,
            textAlign: "center",
            opacity: 0.95,
          }}
        >
          <div style={{ fontWeight: 1000, fontSize: 18, color: "salmon" }}>
            Host disconnected.
          </div>
          <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 800, lineHeight: 1.45 }}>
            Reconnecting to the live stream…
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
      ) : loadingLiveToken ? (
        <div style={{ opacity: 0.9 }}>Initializing live stream…</div>
      ) : liveTokenErr ? (
        <div style={{ opacity: 0.95, color: "salmon", fontWeight: 900 }}>
          {liveTokenErr}
        </div>
      ) : authToken ? (
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
              key={`${uiMode}:${authToken || "no-token"}`}
              authToken={authToken}
              isHost={false}
              showSetupScreen={false}
              shouldStartBroadcast={false}
              onMeetingStatsChange={onMeetingStatsChange}
            />
          </div>
        </div>
      ) : uiMode === "PUBLIC_ACTIVE" || uiMode === "PRIVATE_ACTIVE" || uiMode === "RETURNING_PUBLIC" ? (
        <div style={{ opacity: 0.9 }}>Reconnecting live stream…</div>
      ) : (
        <div style={{ opacity: 0.9 }}>Waiting for live stream…</div>
      )}

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