type Props = {
  authToken?: string;
  isHost: boolean;
  showSetupScreen?: boolean;
  shouldStartBroadcast?: boolean;
  onHostMeetingStateChange?: (state: "idle" | "setup" | "waiting" | "joined" | "ended") => void;
  onHostRealtimeStateSync?: (state: "setup" | "joined" | "broadcasting" | "ended") => void;
  onMeetingStatsChange?: (stats: {
    participantsNow: number;
    startedAt: number | null;
    durationMs: number;
  }) => void;
};

export default function RealtimeMeetingEmbed({ isHost }: Props) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,0.35)",
        color: "white",
        textAlign: "center",
        padding: 16,
      }}
    >
      <div>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>
          Live media provider disabled
        </div>
        <div style={{ marginTop: 8, opacity: 0.85, fontWeight: 700, lineHeight: 1.45 }}>
          {isHost
            ? "Host preview/broadcast provider has been disabled during live system migration."
            : "Viewer live stream is temporarily unavailable while the media layer is being replaced."}
        </div>
      </div>
    </div>
  );
}