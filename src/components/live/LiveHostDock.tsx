import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/nestxApi";
import RealtimeMeetingEmbed from "./RealtimeMeetingEmbed";

type LiveScope = "public" | "private";

type DockState = {
  active: boolean;
  eventId: string;
  scope: LiveScope;
  authToken: string;
  meetingId: string;
  role: "host" | "viewer";
  isHost: boolean;
  isLive: boolean;
  visible: boolean;
};

function readDockState(): DockState | null {
  try {
    const raw = sessionStorage.getItem("nx_live_host_dock");
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      parsed.active !== true ||
      !parsed.eventId ||
      !parsed.scope ||
      !parsed.authToken ||
      !parsed.meetingId ||
      !parsed.role
    ) {
      return null;
    }

    return {
      active: true,
      eventId: String(parsed.eventId),
      scope: parsed.scope === "private" ? "private" : "public",
      authToken: String(parsed.authToken),
      meetingId: String(parsed.meetingId),
      role: parsed.role === "viewer" ? "viewer" : "host",
      isHost: parsed.isHost === true,
      isLive: parsed.isLive === true,
      visible: parsed.visible !== false,
    };
  } catch {
    return null;
  }
}

function writeDockState(next: DockState | null) {
  try {
    if (!next || !next.active) {
      sessionStorage.removeItem("nx_live_host_dock");
      return;
    }
    sessionStorage.setItem("nx_live_host_dock", JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function LiveHostDock() {
  const [dock, setDock] = useState<DockState | null>(() => readDockState());
  const lastSyncRef = useRef("");

  useEffect(() => {
    writeDockState(dock);
  }, [dock]);

  useEffect(() => {
    const onSync = (ev: Event) => {
      const e = ev as CustomEvent;
      const detail = e?.detail || {};
      const next: DockState = {
        active: detail?.active === true,
        eventId: String(detail?.eventId || ""),
        scope: detail?.scope === "private" ? "private" : "public",
        authToken: String(detail?.authToken || ""),
        meetingId: String(detail?.meetingId || ""),
        role: detail?.role === "viewer" ? "viewer" : "host",
        isHost: detail?.isHost === true,
        isLive: detail?.isLive === true,
        visible: detail?.visible !== false,
      };

      if (!next.active || !next.eventId || !next.authToken || !next.meetingId || !next.isHost) {
        setDock(null);
        return;
      }

      setDock((prev) => {
        if (
          prev &&
          prev.eventId === next.eventId &&
          prev.scope === next.scope &&
          prev.authToken === next.authToken &&
          prev.meetingId === next.meetingId &&
          prev.isLive === next.isLive &&
          prev.visible === next.visible
        ) {
          return prev;
        }
        return next;
      });
    };

    const onClear = () => setDock(null);

    window.addEventListener("nx:live-host-dock:sync", onSync as EventListener);
    window.addEventListener("nx:live-host-dock:clear", onClear);

    return () => {
      window.removeEventListener("nx:live-host-dock:sync", onSync as EventListener);
      window.removeEventListener("nx:live-host-dock:clear", onClear);
    };
  }, []);

  const shouldRender = useMemo(() => {
    return !!dock?.active && !!dock?.isHost && !!dock?.authToken && !!dock?.meetingId;
  }, [dock]);

  if (!shouldRender || !dock) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: 1,
        height: 1,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      <div style={{ width: 1, height: 1, overflow: "hidden" }}>
        <RealtimeMeetingEmbed
          key={`dock:${dock.eventId}:${dock.scope}:host`}
          authToken={dock.authToken}
          isHost={true}
          showSetupScreen={!dock.isLive}
          shouldStartBroadcast={dock.isLive}
          onHostRealtimeStateSync={(state) => {
            const syncKey = `${dock.eventId}:${dock.scope}:${state}`;
            if (lastSyncRef.current === syncKey) return;
            lastSyncRef.current = syncKey;

            void api.liveHostRealtimeState(dock.eventId, {
              scope: dock.scope,
              state,
            }).catch(() => {});
          }}
        />
      </div>
    </div>
  );
}