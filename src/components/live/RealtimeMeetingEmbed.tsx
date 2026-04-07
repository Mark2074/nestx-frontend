import { useEffect, useMemo } from "react";
import { RealtimeKitProvider, useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";

type Props = {
  authToken: string;
  isHost: boolean;
};

function MeetingInner({ isHost }: { isHost: boolean }) {
  const { meeting } = useRealtimeKitMeeting();

  if (!meeting) {
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "white",
          opacity: 0.85,
        }}
      >
        Connecting meeting…
      </div>
    );
  }

  return (
    <RtkMeeting
      mode="fill"
      meeting={meeting}
      showSetupScreen={isHost}
    />
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
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "white",
          opacity: 0.85,
        }}
      >
        Missing auth token
      </div>
    );
  }

  if (!meeting) {
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "white",
          opacity: 0.85,
        }}
      >
        Initializing live…
      </div>
    );
  }

  return (
    <RealtimeKitProvider value={meeting}>
      <MeetingInner isHost={isHost} />
    </RealtimeKitProvider>
  );
}