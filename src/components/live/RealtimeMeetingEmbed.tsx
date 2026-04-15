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

type Props = {
  authToken: string;
  isHost: boolean;
  showSetupScreen?: boolean;
  onHostMeetingStateChange?: (state: "idle" | "setup" | "waiting" | "joined" | "ended") => void;
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
        // Host uses NestX buttons for flow; hide SDK leave
        hideByLabel(currentRoot, ["leave"]);
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

function HostMeeting({
  meeting,
  showSetupScreen,
  onHostMeetingStateChange,
}: {
  meeting: any;
  showSetupScreen: boolean;
  onHostMeetingStateChange?: (state: HostMeetingState) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useSdkUiHardening(rootRef, true);

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

function ViewerMeeting({ meeting }: { meeting: any }) {
  const [meetingState, setMeetingState] = useState<ViewerMeetingState>("idle");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useSdkUiHardening(rootRef, false);

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
  onHostMeetingStateChange,
}: Props) {
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
        <HostMeeting
          meeting={meeting}
          showSetupScreen={showSetupScreen}
          onHostMeetingStateChange={onHostMeetingStateChange}
        />
      ) : (
        <ViewerMeeting meeting={meeting} />
      )}
    </RealtimeKitProvider>
  );
}