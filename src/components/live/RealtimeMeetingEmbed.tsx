import { useEffect, useMemo, useRef, useState } from "react";
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

type MeetingStats = {
  participantsNow: number;
  startedAt: number | null;
  durationMs: number;
};

type Props = {
  authToken: string;
  isHost: boolean;
  showSetupScreen?: boolean;
  shouldStartBroadcast?: boolean;
  onHostMeetingStateChange?: (state: "idle" | "setup" | "waiting" | "joined" | "ended") => void;
  onHostRealtimeStateSync?: (state: "setup" | "joined" | "broadcasting" | "ended") => void;
  onMeetingStatsChange?: (stats: MeetingStats) => void;
};

type ViewerMeetingState = "idle" | "setup" | "waiting" | "joined" | "ended";
type HostMeetingState = "idle" | "setup" | "waiting" | "joined" | "ended";

function normalizeText(v: string): string {
  return String(v || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function hideElement(el: HTMLElement | null | undefined) {
  if (!el) return;
  el.style.display = "none";
  el.setAttribute("data-nx-hidden", "1");
}

function hideByLabel(root: HTMLElement, labels: string[]) {
  const wanted = new Set(labels.map(normalizeText));

  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [role="button"], [role="menuitem"], li, div, span'
    )
  );

  for (const node of nodes) {
    const text = normalizeText(node.textContent || "");
    if (!text) continue;
    if (!wanted.has(text)) continue;

    const target =
      node.closest<HTMLElement>('[role="menuitem"]') ||
      node.closest<HTMLElement>("button") ||
      node.closest<HTMLElement>("li") ||
      node;

    hideElement(target);
  }
}

function clickVisibleButtonByLabel(root: HTMLElement, labels: string[]): boolean {
  const wanted = new Set(labels.map(normalizeText));

  const buttons = Array.from(
    root.querySelectorAll<HTMLElement>('button, [role="button"]')
  );

  for (const btn of buttons) {
    const text = normalizeText(btn.textContent || "");
    if (!text) continue;
    if (!wanted.has(text)) continue;
    if (!isVisible(btn)) continue;

    btn.click();
    return true;
  }

  return false;
}

function hideEmptyBottomBars(root: HTMLElement) {
  const containers = Array.from(root.querySelectorAll<HTMLElement>("div, footer, nav"));

  for (const box of containers) {
    const buttons = Array.from(
      box.querySelectorAll<HTMLElement>('button, [role="button"]')
    ).filter(isVisible);

    if (buttons.length !== 0) continue;

    const txt = normalizeText(box.textContent || "");
    if (!txt) continue;

    if (
      txt.includes("join stage") ||
      txt.includes("leave") ||
      txt.includes("more")
    ) {
      hideElement(box);
    }
  }
}

function useSdkUiHardening(rootRef: React.RefObject<HTMLElement | null>, isHost: boolean) {
  const viewerAutoJoinDoneRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const scan = () => {
      const currentRoot = rootRef.current;
      if (!currentRoot) return;

      // VIEWER:
      // - auto-click Join if SDK still shows a prejoin/join step
      // - hide Join stage / Leave
      // - keep More only because it contains Full Screen + Settings
      if (!isHost && !viewerAutoJoinDoneRef.current) {
        const clicked = clickVisibleButtonByLabel(currentRoot, ["join"]);
        if (clicked) {
          viewerAutoJoinDoneRef.current = true;
          return;
        }
      }

      // Common removals from More menu / SDK chrome
      hideByLabel(currentRoot, [
        "chat",
        "polls",
        "plugins",
        "troubleshooting",
        "mute all",
        "share screen",
      ]);

      // Participants: per ora lo togliamo.
      // È più pulito e ci evita elementi inutili.
      hideByLabel(currentRoot, ["participants"]);

      if (isHost) {
        hideByLabel(currentRoot, [
          "leave",
          "leave stage",
          "join stage",
          "go live",
          "start live",
          "start broadcast",
          "start streaming",
          "end live",
          "stop live",
          "stop broadcast",
        ]);
      } else {
        // Viewer pure spectator
        hideByLabel(currentRoot, ["join stage", "leave"]);
      }

      hideEmptyBottomBars(currentRoot);
    };

    scan();

    const mo = new MutationObserver(() => {
      scan();
    });

    mo.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    const t = window.setInterval(scan, 1200);

    return () => {
      mo.disconnect();
      window.clearInterval(t);
    };
  }, [isHost, rootRef]);
}

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

function HostMeeting({
  meeting,
  showSetupScreen,
  shouldStartBroadcast,
  onHostMeetingStateChange,
  onHostRealtimeStateSync,
  onMeetingStatsChange,
}: {
  meeting: any;
  showSetupScreen: boolean;
  shouldStartBroadcast: boolean;
  onHostMeetingStateChange?: (state: HostMeetingState) => void;
  onHostRealtimeStateSync?: (state: "setup" | "joined" | "broadcasting" | "ended") => void;
  onMeetingStatsChange?: (stats: MeetingStats) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const autoStartBroadcastDoneRef = useRef(false);
  const lastSyncedRealtimeStateRef = useRef<string>("");

  useSdkUiHardening(rootRef, true);

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

  useEffect(() => {
    if (!shouldStartBroadcast) {
      autoStartBroadcastDoneRef.current = false;
      return;
    }

    const tryStart = () => {
      const root = rootRef.current;
      if (!root) return;
      if (autoStartBroadcastDoneRef.current) return;

      const clicked = clickVisibleButtonByLabel(root, [
        "go live",
        "start live",
        "start broadcast",
        "start streaming",
      ]);

      if (clicked) {
        autoStartBroadcastDoneRef.current = true;
        onHostRealtimeStateSync?.("broadcasting");
      }
    };

    tryStart();

    const t = window.setInterval(tryStart, 700);
    return () => window.clearInterval(t);
  }, [onHostRealtimeStateSync, shouldStartBroadcast]);

  function handleHostStatesUpdate(event: { detail: States }) {
    const next = String(event?.detail?.meeting || "").trim().toLowerCase();

    if (
      next === "idle" ||
      next === "setup" ||
      next === "waiting" ||
      next === "joined" ||
      next === "ended"
    ) {
      onHostMeetingStateChange?.(next as HostMeetingState);

      let syncState: "setup" | "joined" | "broadcasting" | "ended" | null = null;

      if (next === "setup" || next === "waiting") syncState = "setup";
      if (next === "joined") syncState = shouldStartBroadcast ? "broadcasting" : "joined";
      if (next === "ended") syncState = "ended";

      if (syncState && lastSyncedRealtimeStateRef.current !== syncState) {
        lastSyncedRealtimeStateRef.current = syncState;
        onHostRealtimeStateSync?.(syncState);
      }

      return;
    }

    onHostMeetingStateChange?.("idle");
  }

  return (
    <div ref={rootRef} style={{ height: "100%", width: "100%" }}>
      <RtkUiProvider
        meeting={meeting}
        showSetupScreen={showSetupScreen}
        onRtkStatesUpdate={handleHostStatesUpdate}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
        }}
      >
        <RtkMeeting
          mode="fill"
          meeting={meeting}
          showSetupScreen={showSetupScreen}
        />
      </RtkUiProvider>
    </div>
  );
}

function ViewerMeeting({
  meeting,
  onMeetingStatsChange,
}: {
  meeting: any;
  onMeetingStatsChange?: (stats: MeetingStats) => void;
}) {
  const [meetingState, setMeetingState] = useState<ViewerMeetingState>("idle");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useSdkUiHardening(rootRef, false);

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
    <div ref={rootRef} style={{ height: "100%", width: "100%" }}>
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

        <RtkParticipantsAudio />
        <RtkDialogManager />
        <RtkNotifications />
      </RtkUiProvider>
    </div>
  );
}

export default function RealtimeMeetingEmbed({
  authToken,
  isHost,
  showSetupScreen = false,
  shouldStartBroadcast = false,
  onHostMeetingStateChange,
  onHostRealtimeStateSync,
  onMeetingStatsChange,
}: Props) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const initializedAuthTokenRef = useRef("");

  const defaults = useMemo(
    () => ({
      audio: !!isHost,
      video: !!isHost,
    }),
    [isHost]
  );

  useEffect(() => {
    if (!authToken) return;
    if (initializedAuthTokenRef.current === authToken) return;

    initializedAuthTokenRef.current = authToken;

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
        <HostMeeting
          meeting={meeting}
          showSetupScreen={showSetupScreen}
          shouldStartBroadcast={shouldStartBroadcast}
          onHostMeetingStateChange={onHostMeetingStateChange}
          onHostRealtimeStateSync={onHostRealtimeStateSync}
          onMeetingStatsChange={onMeetingStatsChange}
        />
      ) : (
        <ViewerMeeting
          meeting={meeting}
          onMeetingStatsChange={onMeetingStatsChange}
        />
      )}
    </RealtimeKitProvider>
  );
}