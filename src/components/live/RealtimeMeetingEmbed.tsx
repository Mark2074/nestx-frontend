import { useEffect, useMemo, useState } from "react";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from "@cloudflare/realtimekit-react";
import {
  RtkMeeting,
  RtkUiProvider,
  RtkStage,
  RtkGrid,
  RtkParticipantsAudio,
  RtkDialogManager,
  RtkNotifications,
  RtkWaitingScreen,
  RtkEndedScreen,
} from "@cloudflare/realtimekit-react-ui";

import type { States } from "@cloudflare/realtimekit-react-ui";

type Props = {
  authToken: string;
  isHost: boolean;
};

type ViewerMeetingState = "idle" | "setup" | "waiting" | "joined" | "ended";

function FullCenterMessage({ text }: { text: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: "white",
        opacity: 0.85,
        textAlign: "center",
        padding: 16,
      }}
    >
      {text}
    </div>
  );
}

function HostMeeting({ meeting }: { meeting: any }) {
  return (
    <RtkMeeting
      mode="fill"
      meeting={meeting}
      showSetupScreen={true}
    />
  );
}

function ViewerMeeting({ meeting }: { meeting: any }) {
  const [meetingState, setMeetingState] = useState<ViewerMeetingState>("idle");

  function handleStatesUpdate(event: { detail: States }) {
    const next = String(event?.detail?.meeting || "").trim().toLowerCase();

    if (
      next === "idle" ||
      next === "setup" ||
      next === "waiting" ||
      next === "joined" ||
      next === "ended"
    ) {
      setMeetingState(next as ViewerMeetingState);
      return;
    }

    setMeetingState("idle");
  }

  return (
    <RtkUiProvider
      meeting={meeting}
      showSetupScreen={false}
      onRtkStatesUpdate={handleStatesUpdate}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          height: "100%",
          width: "100%",
          overflow: "hidden",
          background: "transparent",
        }}
      >
        {meetingState === "idle" ? (
          <FullCenterMessage text="Connecting live…" />
        ) : null}

        {meetingState === "setup" ? (
          <FullCenterMessage text="Preparing live…" />
        ) : null}

        {meetingState === "waiting" ? (
          <div style={{ height: "100%" }}>
            <RtkWaitingScreen />
          </div>
        ) : null}

        {meetingState === "ended" ? (
          <div style={{ height: "100%" }}>
            <RtkEndedScreen />
          </div>
        ) : null}

        {meetingState === "joined" ? (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <RtkStage
              style={{
                flex: 1,
                minHeight: 0,
                width: "100%",
              }}
            >
              <RtkGrid />
            </RtkStage>
          </div>
        ) : null}
      </div>

      {/* Necessari per audio remoto, dialog interni e notifiche SDK */}
      <RtkParticipantsAudio />
      <RtkDialogManager />
      <RtkNotifications />
    </RtkUiProvider>
  );
}

export default function RealtimeMeetingEmbed({ authToken, isHost }: Props) {
  const [meeting, initMeeting] = useRealtimeKitClient();

  const defaults = useMemo(
    () => ({
      audio: !!isHost,
      video: !!isHost,
    }),
    [isHost]
  );

  useEffect(() => {
    if (!authToken) return;

    void initMeeting({
      authToken,
      defaults,
    });
  }, [authToken, defaults, initMeeting]);

  if (!authToken) {
    return <FullCenterMessage text="Missing auth token" />;
  }

  if (!meeting) {
    return <FullCenterMessage text="Initializing live…" />;
  }

  return (
    <RealtimeKitProvider value={meeting}>
      {isHost ? (
        <HostMeeting meeting={meeting} />
      ) : (
        <ViewerMeeting meeting={meeting} />
      )}
    </RealtimeKitProvider>
  );
}